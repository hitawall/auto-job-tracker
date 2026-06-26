"""Generic career page scraper — 3-level fallback strategy:
1. requests + JSON-LD  (fast, works for SSR pages)
2. Playwright + JSON-LD (renders JS, catches SPA-injected JSON-LD)
3. Playwright listing → discover job links → requests per link

Bonus: if the rendered page embeds a known ATS (Greenhouse/Lever/Ashby/Workable),
the company_portals record is updated so ingest-ats picks it up next run.
"""

import hashlib
import json
import re
import sys
import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

REMOTE_PATTERNS = re.compile(r"\b(remote|distributed|anywhere|wfh|work from home)\b", re.I)
HYBRID_PATTERNS = re.compile(r"\b(hybrid|flexible|part.?remote)\b", re.I)

# URL-path patterns that suggest individual job postings
JOB_PATH_RE = re.compile(
    r"/(job|jobs|career|careers|position|positions|opening|openings|role|roles|vacancy|vacancies)/",
    re.I,
)
JOB_CLASS_RE = re.compile(r"job|position|role|opening|vacancy", re.I)
JOB_PARAM_RE = re.compile(r"[?&](job_?id|jobId|jid|req_?id|requisition_?id|position_?id)=", re.I)

# Known ATS patterns to detect from rendered page HTML
ATS_DETECTORS = [
    (re.compile(r'boards\.greenhouse\.io/([a-zA-Z0-9_-]+)'), "greenhouse"),
    (re.compile(r'job-boards\.greenhouse\.io/([a-zA-Z0-9_-]+)'), "greenhouse"),
    (re.compile(r'jobs\.lever\.co/([a-zA-Z0-9_-]+)'), "lever"),
    (re.compile(r'jobs\.ashbyhq\.com/([a-zA-Z0-9_-]+)'), "ashby"),
    (re.compile(r'apply\.workable\.com/([a-zA-Z0-9_-]+)'), "workable"),
    (re.compile(r'([a-zA-Z0-9_-]+)\.workable\.com'), "workable"),
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

MAX_JOB_LINKS = 40


# ── helpers ──────────────────────────────────────────────────────────────────

def _log(msg: str) -> None:
    print(msg, flush=True)


def _make_source_id(url: str) -> str:
    return f"portal_{hashlib.md5(url.encode()).hexdigest()[:16]}"


def _infer_remote(job_location_type: str | None, location: str | None) -> str:
    if job_location_type and "telecommute" in job_location_type.lower():
        return "remote"
    text = location or ""
    if REMOTE_PATTERNS.search(text):
        return "remote"
    if HYBRID_PATTERNS.search(text):
        return "hybrid"
    if text:
        return "onsite"
    return "unknown"


def _parse_location(job_location) -> str | None:
    if not job_location:
        return None
    if isinstance(job_location, list):
        job_location = job_location[0] if job_location else {}
    if not isinstance(job_location, dict):
        return None
    address = job_location.get("address") or {}
    if isinstance(address, str):
        return address or None
    if isinstance(address, dict):
        parts = [
            address.get("addressLocality"),
            address.get("addressRegion"),
            address.get("addressCountry"),
        ]
        return ", ".join(p for p in parts if p) or None
    return None


def _extract_jsonld_jobs(html: str, page_url: str, company_name: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    jobs: list[dict] = []

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            raw = json.loads(script.string or "")
        except Exception:
            continue

        items = raw if isinstance(raw, list) else [raw]
        i = 0
        while i < len(items):
            item = items[i]
            i += 1
            if not isinstance(item, dict):
                continue
            if "@graph" in item and item.get("@type", "") != "JobPosting":
                items.extend(item["@graph"])
                continue
            if item.get("@type") != "JobPosting":
                continue

            url = item.get("url") or item.get("sameAs") or page_url
            title = (item.get("title") or "").strip()
            if not title or not url:
                continue

            org = item.get("hiringOrganization") or {}
            company = (org.get("name") if isinstance(org, dict) else None) or company_name
            location = _parse_location(item.get("jobLocation"))
            remote = _infer_remote(str(item.get("jobLocationType") or ""), location)

            jobs.append({
                "source": "portal",
                "source_job_id": _make_source_id(url),
                "title": title,
                "company": company,
                "location": location,
                "remote": remote,
                "posted_at": item.get("datePosted"),
                "url": url,
                "description_md": str(item.get("description") or "")[:8000] or None,
                "raw_payload": {},
            })

    return jobs


def _extract_nextdata_jobs(html: str, page_url: str, company_name: str) -> list[dict]:
    """Pull job listings from Next.js __NEXT_DATA__ SSR payload."""
    soup = BeautifulSoup(html, "lxml")
    script = soup.find("script", id="__NEXT_DATA__")
    if not script or not script.string:
        return []

    try:
        data = json.loads(script.string)
    except Exception:
        return []

    # Walk the JSON tree looking for objects that look like job postings
    jobs: list[dict] = []

    def walk(node, depth=0):
        if depth > 12:
            return
        if isinstance(node, list):
            for item in node:
                walk(item, depth + 1)
        elif isinstance(node, dict):
            keys = {k.lower() for k in node}
            # Heuristic: has title/name + some URL/id field → likely a job object
            has_title = bool(node.get("title") or node.get("name"))
            has_url = bool(node.get("url") or node.get("jobUrl") or node.get("applyUrl") or node.get("link"))
            has_id = bool(node.get("id") or node.get("jobId") or node.get("requisitionId"))
            if has_title and (has_url or has_id):
                title = (node.get("title") or node.get("name") or "").strip()
                url = (
                    node.get("url") or node.get("jobUrl") or
                    node.get("applyUrl") or node.get("link") or page_url
                )
                if title and len(title) > 3 and len(title) < 200:
                    location = (
                        node.get("location") or node.get("city") or
                        node.get("locationName") or node.get("office") or ""
                    )
                    if isinstance(location, dict):
                        location = location.get("name") or location.get("city") or ""
                    remote_text = str(node.get("workplaceType") or node.get("remoteType") or location or "")
                    jobs.append({
                        "source": "portal",
                        "source_job_id": _make_source_id(url if url != page_url else f"{page_url}#{node.get('id',title)}"),
                        "title": title,
                        "company": company_name,
                        "location": location or None,
                        "remote": _infer_remote(None, remote_text),
                        "posted_at": node.get("postedDate") or node.get("publishedDate") or node.get("datePosted"),
                        "url": url,
                        "description_md": str(node.get("description") or node.get("summary") or "")[:8000] or None,
                        "raw_payload": {},
                    })
                    return  # don't recurse into a job node
            for v in node.values():
                walk(v, depth + 1)

    walk(data)
    return jobs


def _detect_embedded_ats(html: str) -> tuple[str, str] | None:
    """Scan rendered HTML for embedded ATS iframes / script tags / links."""
    for pattern, ats_type in ATS_DETECTORS:
        m = pattern.search(html)
        if m:
            slug = m.group(1).split("?")[0].rstrip("/")
            return ats_type, slug
    return None


def _discover_job_links(html: str, base_url: str) -> list[str]:
    """Extract links that likely point to individual job postings."""
    base_domain = urlparse(base_url).netloc
    soup = BeautifulSoup(html, "lxml")
    seen: set[str] = set()
    links: list[str] = []

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("mailto:", "tel:", "javascript:")):
            continue

        full = urljoin(base_url, href)
        parsed = urlparse(full)

        # same-domain only (external ATS handled via ATS detection)
        if parsed.netloc != base_domain:
            continue

        path = parsed.path
        query = parsed.query
        path_match = JOB_PATH_RE.search(path)
        param_match = JOB_PARAM_RE.search(query) if query else False
        class_match = JOB_CLASS_RE.search(" ".join(a.get("class", []))) or any(
            JOB_CLASS_RE.search(" ".join(p.get("class", [])))
            for p in a.parents
            if hasattr(p, "get") and p.get("class")
        )

        if not (path_match or param_match or class_match):
            continue

        clean = parsed._replace(fragment="").geturl()
        if clean == base_url or clean in seen:
            continue
        seen.add(clean)
        links.append(clean)
        if len(links) >= MAX_JOB_LINKS:
            break

    return links


# ── fetch strategies ──────────────────────────────────────────────────────────

def _fetch_static(url: str) -> str | None:
    try:
        resp = requests.get(url, timeout=20, headers=HEADERS, allow_redirects=True)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        _log(f"  [WARN] static fetch({url}): {e}")
        return None


def _fetch_rendered(url: str) -> str | None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        _log("  [WARN] playwright not installed — skipping JS render")
        return None

    _log(f"  [playwright] launching Chromium for {url}")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(user_agent=HEADERS["User-Agent"], locale="en-US")
            page = ctx.new_page()
            try:
                # networkidle waits until no network requests for 500ms
                # — ensures React/Vue has finished fetching job data
                page.goto(url, wait_until="networkidle", timeout=45_000)
                _log(f"  [playwright] networkidle reached for {url}")
            except Exception as e:
                _log(f"  [playwright] networkidle timeout ({e}), continuing")
                try:
                    page.wait_for_timeout(3_000)
                except Exception:
                    pass

            # Scroll to trigger intersection-observer / infinite-scroll lazy loading
            try:
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(2_000)
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1_500)
            except Exception:
                pass

            html = page.content()
            soup = BeautifulSoup(html, "lxml")
            visible_text = soup.get_text()[:300].replace("\n", " ").strip()
            link_count = len(soup.find_all("a", href=True))
            _log(f"  [playwright] size={len(html)} links={link_count} preview: {visible_text!r}")
            browser.close()
            return html
    except Exception as e:
        _log(f"  [WARN] playwright render({url}): {e}")
        return None


# ── public API ────────────────────────────────────────────────────────────────

def scrape_portal(company_name: str, career_url: str) -> list[dict]:
    """
    Level 1 — requests + JSON-LD
    Level 2 — Playwright + JSON-LD
    Level 3 — Playwright listing → discover links → requests per job page
    Returns (jobs, rendered_html) so callers can run ATS detection.
    """
    # Level 1
    html = _fetch_static(career_url)
    if html:
        jobs = _extract_jsonld_jobs(html, career_url, company_name)
        if jobs:
            _log(f"  [portal] {company_name}: {len(jobs)} jobs via static JSON-LD")
            return jobs

    # Level 2
    _log(f"  [portal] {company_name}: no static JSON-LD → rendering with Playwright")
    rendered = _fetch_rendered(career_url)
    if not rendered:
        return []

    jobs = _extract_jsonld_jobs(rendered, career_url, company_name)
    if jobs:
        _log(f"  [portal] {company_name}: {len(jobs)} jobs via rendered JSON-LD")
        return jobs

    # Level 3
    links = _discover_job_links(rendered, career_url)
    if not links:
        _log(f"  [portal] {company_name}: no JSON-LD and no job links found in rendered page")
        return []

    _log(f"  [portal] {company_name}: found {len(links)} job links → scraping each")
    jobs = []
    for link in links:
        link_html = _fetch_static(link)
        if link_html:
            jobs.extend(_extract_jsonld_jobs(link_html, link, company_name))
        time.sleep(0.3)

    _log(f"  [portal] {company_name}: {len(jobs)} jobs via link discovery")
    return jobs


def scrape_portals_from_db(supabase) -> int:
    result = (
        supabase.table("company_portals")
        .select("id,company_name,career_url")
        .eq("is_active", True)
        .is_("ats_type", "null")
        .execute()
    )
    portals = result.data or []
    if not portals:
        _log("[portals] no unknown-ATS portals to scrape")
        return 0

    total = 0
    for portal in portals:
        company = portal["company_name"]
        url = portal["career_url"]
        portal_id = portal["id"]
        _log(f"[portals] scraping {company} ({url})")

        # First render the page so we can do ATS detection regardless of job count
        rendered = _fetch_rendered(url)

        # ATS auto-detection — if the page embeds a known ATS, upgrade the portal record
        if rendered:
            detected = _detect_embedded_ats(rendered)
            if detected:
                ats_type, ats_slug = detected
                _log(f"  [portals] {company}: detected embedded {ats_type} ATS (slug={ats_slug}) → updating DB")
                try:
                    supabase.table("company_portals").update(
                        {"ats_type": ats_type, "ats_slug": ats_slug}
                    ).eq("id", portal_id).execute()
                    _log(f"  [portals] {company}: portal updated — will be ingested by ingest-ats on next run")
                except Exception as e:
                    _log(f"  [portals] {company}: DB update error: {e}")
                time.sleep(1)
                continue

        # No known ATS detected — try JSON-LD → __NEXT_DATA__ → link discovery
        jobs: list[dict] = []
        if rendered:
            jobs = _extract_jsonld_jobs(rendered, url, company)
            if not jobs:
                jobs = _extract_nextdata_jobs(rendered, url, company)
                if jobs:
                    _log(f"  [portals] {company}: {len(jobs)} jobs via __NEXT_DATA__")
            if not jobs:
                links = _discover_job_links(rendered, url)
                if links:
                    _log(f"  [portals] {company}: found {len(links)} job links → scraping each")
                    for link in links:
                        link_html = _fetch_static(link)
                        if link_html:
                            jobs.extend(_extract_jsonld_jobs(link_html, link, company))
                        time.sleep(0.3)
                else:
                    _log(f"  [portals] {company}: no JSON-LD, no __NEXT_DATA__, no job links found")

        if not jobs:
            time.sleep(1)
            continue

        seen: set[str] = set()
        deduped = []
        for j in jobs:
            key = j["source_job_id"]
            if key not in seen:
                seen.add(key)
                deduped.append(j)

        try:
            supabase.table("jobs").upsert(
                deduped,
                on_conflict="source,source_job_id",
                ignore_duplicates=False,
            ).execute()
            total += len(deduped)
            _log(f"  [portals] {company}: upserted {len(deduped)} jobs")
        except Exception as e:
            _log(f"  [portals] {company}: upsert error: {e}")

        time.sleep(1)

    return total
