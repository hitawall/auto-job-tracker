import os
import hashlib
import re
from datetime import datetime, timezone

from dotenv import load_dotenv
from jobspy import scrape_jobs
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

SEARCH_TERMS = [
    "Software Engineer",
    "Product Manager",
    "Data Scientist",
    "Frontend Developer",
    "Backend Developer",
    "Full Stack Engineer",
    "DevOps Engineer",
    "Product Designer",
]

SITES = ["indeed", "glassdoor"]

LOCATIONS = ["Remote", "India"]

REMOTE_PATTERNS = re.compile(r"\b(remote|distributed|anywhere|wfh|work from home)\b", re.I)
HYBRID_PATTERNS = re.compile(r"\b(hybrid|flexible|part.?remote)\b", re.I)


def infer_remote(is_remote, location):
    if is_remote is True:
        return "remote"
    text = str(location or "")
    if REMOTE_PATTERNS.search(text):
        return "remote"
    if HYBRID_PATTERNS.search(text):
        return "hybrid"
    if text:
        return "onsite"
    return "unknown"


def make_source_id(site, url):
    """Stable ID from the job URL — last non-empty path segment, else URL hash."""
    try:
        from urllib.parse import urlparse
        parts = [p for p in urlparse(url).path.split("/") if p]
        if parts:
            return f"{site}_{parts[-1]}"
    except Exception:
        pass
    return f"{site}_{hashlib.md5(url.encode()).hexdigest()[:16]}"


def posted_at_iso(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    try:
        return str(value)
    except Exception:
        return None


def normalize(row, site):
    url = str(row.get("job_url") or "")
    if not url:
        return None
    title = str(row.get("title") or "").strip()
    company = str(row.get("company") or "").strip()
    if not title or not company:
        return None
    location = str(row.get("location") or "") or None
    return {
        "source": site,
        "source_job_id": make_source_id(site, url),
        "title": title,
        "company": company,
        "location": location,
        "remote": infer_remote(row.get("is_remote"), location),
        "posted_at": posted_at_iso(row.get("date_posted")),
        "url": url,
        "description_md": str(row.get("description") or "") or None,
        "raw_payload": {},
    }


def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    total = 0

    for term in SEARCH_TERMS:
        for loc in LOCATIONS:
            try:
                df = scrape_jobs(
                    site_name=SITES,
                    search_term=term,
                    location=loc,
                    results_wanted=50,
                    hours_old=24,
                    description_format="markdown",
                )
            except Exception as e:
                print(f"[WARN] scrape_jobs({term!r} @ {loc!r}) failed: {e}")
                continue

            rows = []
            for _, row in df.iterrows():
                site = str(row.get("site") or "")
                record = normalize(row.to_dict(), site)
                if record:
                    rows.append(record)

            if not rows:
                continue

            try:
                supabase.table("jobs").upsert(
                    rows,
                    on_conflict="source,source_job_id",
                    ignore_duplicates=False,
                ).execute()
                total += len(rows)
                print(f"[OK] {term!r} @ {loc!r}: upserted {len(rows)} jobs")
            except Exception as e:
                print(f"[ERROR] upsert({term!r} @ {loc!r}): {e}")

    print(f"Done — {total} total jobs upserted")


if __name__ == "__main__":
    main()
