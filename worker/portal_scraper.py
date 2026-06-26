"""Generic career page scraper using schema.org/JobPosting JSON-LD."""

import hashlib
import json
import re
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

REMOTE_PATTERNS = re.compile(r"\b(remote|distributed|anywhere|wfh|work from home)\b", re.I)
HYBRID_PATTERNS = re.compile(r"\b(hybrid|flexible|part.?remote)\b", re.I)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


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


def _extract_jsonld_jobs(html: str, career_url: str, company_name: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    jobs = []

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            raw = json.loads(script.string or "")
        except Exception:
            continue

        items = raw if isinstance(raw, list) else [raw]
        for item in items:
            if not isinstance(item, dict):
                continue
            item_type = item.get("@type", "")
            # Handle @graph wrapper
            if item_type == "" and "@graph" in item:
                items += item["@graph"]
                continue
            if item_type != "JobPosting":
                continue

            url = item.get("url") or item.get("sameAs") or career_url
            title = (item.get("title") or "").strip()
            if not title or not url:
                continue

            org = item.get("hiringOrganization") or {}
            company = (org.get("name") if isinstance(org, dict) else None) or company_name

            location = _parse_location(item.get("jobLocation"))
            job_location_type = str(item.get("jobLocationType") or "")
            remote = _infer_remote(job_location_type, location)

            date_posted = item.get("datePosted")
            description = str(item.get("description") or "")[:8000] or None

            jobs.append({
                "source": "portal",
                "source_job_id": _make_source_id(url),
                "title": title,
                "company": company,
                "location": location,
                "remote": remote,
                "posted_at": date_posted,
                "url": url,
                "description_md": description,
                "raw_payload": {},
            })

    return jobs


def scrape_portal(company_name: str, career_url: str) -> list[dict]:
    """Fetch a career page and extract JSON-LD JobPosting objects."""
    try:
        resp = requests.get(career_url, timeout=20, headers=HEADERS, allow_redirects=True)
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"  [WARN] fetch({career_url}): {e}")
        return []

    jobs = _extract_jsonld_jobs(resp.text, career_url, company_name)
    return jobs


def scrape_portals_from_db(supabase) -> int:
    """Query company_portals for unknown ATS entries and scrape each."""
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
            print(f"  [portals] {company}: no JSON-LD jobs found")
            continue

        # Deduplicate within batch
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
            print(f"  [portals] {company}: upserted {len(deduped)} jobs")
        except Exception as e:
            print(f"  [portals] {company}: upsert error: {e}")

        time.sleep(1)

    return total
