"""Generic career page scraper — 3-level fallback strategy:
1. requests + JSON-LD  (fast, works for SSR pages)
2. Playwright + JSON-LD (renders JS, catches SPA-injected JSON-LD)
3. Playwright listing → discover job links → requests per link
"""

import hashlib
import json
import re
import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

REMOTE_PATTERNS = re.compile(r"\b(remote|distributed|anywhere|wfh|work from home)\b", re.I)
HYBRID_PATTERNS = re.compile(r"\b(hybrid|flexible|part.?remote)\b", re.I)

JOB_PATH_RE = re.compile(
    r"/(job|jobs|career|careers|position|positions|opening|openings|role|roles|vacancy|vacancies)/",
    re.I,
)

JOB_CLASS_RE = re.compile(r"job|position|role|opening|vacancy", re.I)

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
    """Parse all schema.org/JobPosting JSON-LD blocks from an HTML page."""
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
            # unwrap @graph
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
            description = str(item.get("description") or "")[:8000] or None

            jobs.append({
                "source": "portal",
                "source_job_id": _make_source_id(url),
                "title": title,
                "company": company,
                "location": location,
                "remote": remote,
                "posted_at": item.get("datePosted"),
                "url": url,
                "description_md": description,
                "raw_payload": {},
            })

    return jobs


def _discover_job_links(html: str, base_url: str) -> list[str]:
    """Extract links that likely lead to individual job postings."""
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

        if parsed.netloc != base_domain:
            continue

        path = parsed.path
        # match job-like URL paths
        path_match = JOB_PATH_RE.search(path)
        # or job-like class on the <a> or a parent
        class_match = JOB_CLASS_RE.search(" ".join(a.get("class", []))) or any(
            JOB_CLASS_RE.search(" ".join(p.get("class", [])))
            for p in a.parents
            if hasattr(p, "get") and p.get("class")
        )

        if not (path_match or class_match):
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
    """Plain HTTP fetch — fast, no JS execution."""
    try:
        resp = requests.get(url, timeout=20, headers=HEADERS, allow_redirects=True)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"  [WARN] static fetch({url}): {e}")
        return None


def _fetch_rendered(url: str) -> str | None:
    """Headless Chromium via Playwright — renders JS before returning HTML."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  [WARN] playwright not installed — skipping JS render")
        return None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(user_agent=HEADERS["User-Agent"], locale="en-US")
            page = ctx.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                # Give React/Vue/Angular time to mount and inject JSON-LD
                page.wait_for_timeout(3_000)
            except Exception:
                pass  # grab whatever rendered so far
            html = page.content()
            browser.close()
            return html
    except Exception as e:
        print(f"  [WARN] playwright render({url}): {e}")
        return None


# ── public API ────────────────────────────────────────────────────────────────

def scrape_portal(company_name: str, career_url: str) -> list[dict]:
    """
    Scrape a career page for job postings.

    Level 1 — requests + JSON-LD (fast, SSR pages)
    Level 2 — Playwright + JSON-LD (JS-rendered pages)
    Level 3 — Playwright listing → discover links → requests per job page
    """
    # Level 1: plain HTTP
    html = _fetch_static(career_url)
    if html:
        jobs = _extract_jsonld_jobs(html, career_url, company_name)
        if jobs:
            print(f"  [portal] {company_name}: {len(jobs)} jobs via static JSON-LD")
            return jobs

    # Level 2: Playwright render
    print(f"  [portal] {company_name}: no static JSON-LD → rendering with Playwright")
    rendered = _fetch_rendered(career_url)
    if not rendered:
        return []

    jobs = _extract_jsonld_jobs(rendered, career_url, company_name)
    if jobs:
        print(f"  [portal] {company_name}: {len(jobs)} jobs via rendered JSON-LD")
        return jobs

    # Level 3: discover individual job links from rendered listing page
    links = _discover_job_links(rendered, career_url)
    if not links:
        print(f"  [portal] {company_name}: no JSON-LD and no job links found")
        return []

    print(f"  [portal] {company_name}: found {len(links)} job links → scraping each")
    jobs = []
    for link in links:
        link_html = _fetch_static(link)  # individual job pages are usually SSR
        if link_html:
            jobs.extend(_extract_jsonld_jobs(link_html, link, company_name))
        time.sleep(0.3)

    print(f"  [portal] {company_name}: {len(jobs)} jobs via link discovery")
    return jobs


def scrape_portals_from_db(supabase) -> int:
    """Scrape all active company_portals where ats_type is unknown."""
    result = (
        supabase.table("company_portals")
        .select("id,company_name,career_url")
        .eq("is_active", True)
        .is_("ats_type", "null")
        .execute()
    )
    portals = result.data or []
    if not portals:
        print("[portals] no unknown-ATS portals to scrape")
        return 0

    total = 0
    for portal in portals:
        company = portal["company_name"]
        url = portal["career_url"]
        print(f"[portals] scraping {company} ({url})")

        jobs = scrape_portal(company, url)
        if not jobs:
            continue

        seen: set[str] = set()
        deduped = [j for j in jobs if not (seen.add(j["source_job_id"]) or j["source_job_id"] in seen)]

        try:
            supabase.table("jobs").upsert(
                deduped,
                on_conflict="source,source_job_id",
                ignore_duplicates=False,
            ).execute()
            total += len(deduped)
            print(f"  [portals] {company}: upserted {len(deduped)} jobs")
        except Exception as e:
            print(f"  [portals] {company}: upsert error: {e}")

        time.sleep(1)

    return total
