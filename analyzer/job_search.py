"""Fetch, normalize, cache, and filter jobs from public job APIs."""
import hashlib
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone as datetime_timezone
from difflib import SequenceMatcher
from pathlib import Path

import requests
from django.core.cache import cache
from django.db import transaction

from .models import JobSearchProviderUsage


EXPERIENCE_LABELS = {
    "entry": "Entry-level (0-2 years)",
    "mid": "Mid-level (2-10 years)",
    "senior": "Senior-level (10+ years)",
}
COMPANIES_FILE = Path(__file__).with_name("companies.json")
CACHE_SECONDS = 30 * 60
MAX_RESULTS_PER_SOURCE = 40
REQUEST_TIMEOUT = 12

ENTRY_TERMS = ("junior", "associate", "intern", "internship", "fresher", "graduate", "entry level", "trainee")
SENIOR_TERMS = ("senior", "lead", "manager", "principal", "staff", "director", "head of")


def _reserve_provider_call(source, key_material, bucket, limit_name, default_limit):
    """Persist a conservative provider call cap before contacting a paid API."""
    try:
        limit = max(0, int(os.environ.get(limit_name, default_limit)))
    except (TypeError, ValueError):
        limit = default_limit
    key_hash = hashlib.sha256(key_material.encode("utf-8")).hexdigest()[:16]
    usage_bucket = f"{bucket}:{key_hash}"
    with transaction.atomic():
        usage, _ = JobSearchProviderUsage.objects.select_for_update().get_or_create(
            source=source, bucket=usage_bucket,
        )
        if usage.calls >= limit:
            raise RuntimeError(f"{source.title()} safety limit reached ({limit} calls for this period/key).")
        usage.calls += 1
        usage.save(update_fields=["calls"])


def _companies():
    try:
        payload = json.loads(COMPANIES_FILE.read_text(encoding="utf-8"))
        return [item for item in payload if isinstance(item, dict) and item.get("name") and item.get("ats") and item.get("token")]
    except (OSError, ValueError, TypeError):
        print("[JOB SEARCH] companies.json could not be loaded")
        return []


def _clean(value, limit=500):
    if not value:
        return ""
    value = re.sub(r"<[^>]+>", " ", str(value))
    return re.sub(r"\s+", " ", value).strip()[:limit]


def _level(title):
    normalized = re.sub(r"[^a-z0-9]+", " ", title.lower())
    if any(term in normalized for term in ENTRY_TERMS):
        return "entry"
    if any(term in normalized for term in SENIOR_TERMS):
        return "senior"
    return "mid"


def _has_explicit_level(title):
    normalized = re.sub(r"[^a-z0-9]+", " ", (title or "").lower())
    return any(term in normalized for term in ENTRY_TERMS + SENIOR_TERMS)


def _level_matches(requested_level, title):
    # Most job titles do not state seniority. Keep those results available at
    # every selected level; only exclude a title with an explicit conflicting signal.
    return not _has_explicit_level(title) or _level(title) == requested_level


def _role_terms(text):
    normalized = (text or "").lower()
    normalized = re.sub(r"\b(?:artificial intelligence|machine learning|deep learning)\b", " ai ", normalized)
    normalized = re.sub(r"\bfront[ -]?end\b", " frontend ", normalized)
    normalized = re.sub(r"\bback[ -]?end\b", " backend ", normalized)
    normalized = re.sub(r"\bfull[ -]?stack\b", " fullstack ", normalized)
    tokens = re.findall(r"[a-z0-9+#.]+", normalized)
    level_words = set(ENTRY_TERMS + SENIOR_TERMS + ("mid", "midlevel", "intermediate"))
    tokens = [token for token in tokens if token not in level_words and token not in {"the", "and", "or", "for", "of", "role", "job"}]

    if "ai" in tokens:
        tokens = ["ai_role" if token in {"engineer", "engineering", "developer", "programmer", "scientist", "researcher"} else token for token in tokens]
    elif "data" in tokens:
        tokens = ["data_role" if token in {"engineer", "engineering", "developer", "programmer", "scientist", "science", "analyst"} else token for token in tokens]
    else:
        tokens = ["software_role" if token in {"engineer", "engineering", "developer", "developers", "programmer", "programmers", "software"} else token for token in tokens]
    return set(tokens)


def _role_relevance(role, title, description=""):
    """Return a transparent 0-100 role-title relevance estimate."""
    wanted = _role_terms(role)
    if not wanted:
        return 100

    title_terms = _role_terms(title)
    description_terms = _role_terms(description)
    families = {"software_role", "ai_role", "data_role"}
    requested_families = wanted & families
    if requested_families and not requested_families.intersection(title_terms):
        return 0

    specific_terms = wanted - families
    if not specific_terms:
        return 100 if requested_families.intersection(title_terms) else 0

    searchable_terms = title_terms | description_terms
    matched = 0
    for term in specific_terms:
        if term in searchable_terms or any(
            len(term) >= 4 and len(candidate) >= 4 and SequenceMatcher(None, term, candidate).ratio() >= 0.84
            for candidate in searchable_terms
        ):
            matched += 1
    coverage = matched / len(specific_terms)
    if coverage < 0.5:
        return 0
    if requested_families:
        return round(75 * coverage + 25)
    return round(100 * coverage)


def _role_matches(role, title, description=""):
    return _role_relevance(role, title, description) >= 45


def _location_matches(location_filter, location):
    if not location_filter:
        return True
    actual = (location or "").casefold()
    cleaned = _provider_location(location_filter)
    local_parts = [part.strip().casefold() for part in re.split(r"[,;]", cleaned) if part.strip()]
    # India-scoped APIs may return a city/state without repeating the country.
    # Match the local place segment instead of requiring "India, Noida" verbatim.
    if local_parts:
        return any(part in actual for part in local_parts)
    return "india" in actual or "bharat" in actual


def _provider_location(location):
    cleaned = re.sub(r"\b(?:india|bharat)\b", " ", location or "", flags=re.I)
    return re.sub(r"\s*[,;]\s*|\s+", " ", cleaned).strip()


def _posted(value):
    if not value:
        return ""
    if isinstance(value, (int, float)):
        try:
            timestamp = value / 1000 if value > 100_000_000_000 else value
            return datetime.fromtimestamp(timestamp, tz=datetime_timezone.utc).isoformat()
        except (ValueError, OverflowError, OSError):
            return ""
    text = str(value).strip()
    if not text:
        return ""
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=datetime_timezone.utc)
        return parsed.isoformat()
    except ValueError:
        for pattern in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(text[:19], pattern).replace(tzinfo=datetime_timezone.utc).isoformat()
            except ValueError:
                pass
    return ""


def _job(title, company, location, url, posted, source, description=""):
    title = _clean(title, 180)
    company = _clean(company, 120)
    location = _clean(location, 160) or "Not specified"
    url = str(url or "").strip()
    if not title or not company or not url.startswith(("https://", "http://")):
        return None
    return {
        "title": title,
        "company": company,
        "location": location,
        "url": url,
        "posted": _posted(posted),
        "level": _level(title),
        "level_specified": _has_explicit_level(title),
        "source": source,
        "_description": _clean(description, 1500),
    }


def _safe_error(exc):
    """Provider error text must never leak keys embedded in request URLs."""
    detail = str(exc)
    for name in ("ADZUNA_APP_ID", "ADZUNA_APP_KEY", "JOOBLE_KEY"):
        secret = os.environ.get(name, "").strip()
        if secret:
            detail = detail.replace(secret, "[redacted]")
    detail = re.sub(r"([?&](?:app_id|app_key)=)[^&\s]+", r"\1[redacted]", detail, flags=re.I)
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        detail = f"HTTP {exc.response.status_code}"
        try:
            provider_message = exc.response.json().get("error", {}).get("message", "")
            if provider_message:
                detail += ": " + str(provider_message)[:180]
        except (ValueError, AttributeError):
            pass
    for name in ("ADZUNA_APP_ID", "ADZUNA_APP_KEY", "JOOBLE_KEY"):
        secret = os.environ.get(name, "").strip()
        if secret:
            detail = detail.replace(secret, "[redacted]")
    return detail[:240] or exc.__class__.__name__


def _greenhouse(company, role, level, location):
    response = requests.get(
        f"https://boards-api.greenhouse.io/v1/boards/{company['token']}/jobs",
        params={"content": "true"}, timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    jobs = []
    for item in response.json().get("jobs", []):
        content = item.get("content", "")
        job = _job(item.get("title"), company["name"], (item.get("location") or {}).get("name"), item.get("absolute_url"), item.get("updated_at"), "greenhouse", content)
        if job and _level_matches(level, job["title"]) and _location_matches(location, job["location"]) and _role_matches(role, job["title"], job["_description"]):
            jobs.append(job)
    return jobs


def _lever(company, role, level, location):
    response = requests.get(
        f"https://api.lever.co/v0/postings/{company['token']}",
        params={"mode": "json"}, timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    jobs = []
    for item in response.json():
        categories = item.get("categories") or {}
        job = _job(item.get("text"), company["name"], categories.get("location") or ", ".join(categories.get("allLocations") or []), item.get("applyUrl") or item.get("hostedUrl"), item.get("createdAt"), "lever", item.get("descriptionPlain") or item.get("openingPlain"))
        if job and _level_matches(level, job["title"]) and _location_matches(location, job["location"]) and _role_matches(role, job["title"], job["_description"]):
            jobs.append(job)
    return jobs


def _adzuna(role, level, location):
    app_id = os.environ.get("ADZUNA_APP_ID", "").strip()
    app_key = os.environ.get("ADZUNA_APP_KEY", "").strip()
    if not app_id or not app_key:
        raise RuntimeError("Adzuna is not configured (ADZUNA_APP_ID / ADZUNA_APP_KEY).")
    day = datetime.now(datetime_timezone.utc).date().isoformat()
    _reserve_provider_call("adzuna", f"{app_id}:{app_key}", day, "ADZUNA_DAILY_JOB_SEARCH_LIMIT", 200)
    params = {"app_id": app_id, "app_key": app_key, "results_per_page": MAX_RESULTS_PER_SOURCE, "what": role}
    provider_location = _provider_location(location)
    if provider_location:
        params["where"] = provider_location
    response = requests.get("https://api.adzuna.com/v1/api/jobs/in/search/1", params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return [job for item in response.json().get("results", []) if (job := _job(item.get("title"), (item.get("company") or {}).get("display_name"), (item.get("location") or {}).get("display_name"), item.get("redirect_url"), item.get("created"), "adzuna", item.get("description"))) and _level_matches(level, job["title"]) and _location_matches(location, job["location"]) and _role_matches(role, job["title"], job["_description"])]


def _jooble(role, level, location):
    api_key = os.environ.get("JOOBLE_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Jooble India is not configured (JOOBLE_KEY).")
    _reserve_provider_call("jooble", api_key, "lifetime", "JOOBLE_LIFETIME_JOB_SEARCH_LIMIT", 450)
    payload = {"keywords": role, "location": _provider_location(location) or "India", "page": "1", "ResultOnPage": MAX_RESULTS_PER_SOURCE, "companysearch": "false"}
    response = requests.post(f"https://in.jooble.org/api/{api_key}", json=payload, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return [job for item in response.json().get("jobs", []) if (job := _job(item.get("title"), item.get("company"), item.get("location"), item.get("link"), item.get("updated"), "jooble", item.get("snippet"))) and _level_matches(level, job["title"]) and _location_matches(location, job["location"]) and _role_matches(role, job["title"], job["_description"])]


def _fetch_all(role, level, location):
    companies = _companies()
    jobs, errors = [], []
    tasks = []
    for company in companies:
        if company["ats"].lower() == "greenhouse":
            tasks.append((f"Greenhouse/{company['name']}", lambda company=company: _greenhouse(company, role, level, location)))
        elif company["ats"].lower() == "lever":
            tasks.append((f"Lever/{company['name']}", lambda company=company: _lever(company, role, level, location)))
    tasks.extend([
        ("Adzuna", lambda: _adzuna(role, level, location)),
        ("Jooble", lambda: _jooble(role, level, location)),
    ])
    with ThreadPoolExecutor(max_workers=min(12, max(1, len(tasks)))) as pool:
        futures = {pool.submit(fn): source for source, fn in tasks}
        for future in as_completed(futures):
            source = futures[future]
            try:
                jobs.extend(future.result())
            except Exception as exc:
                detail = _safe_error(exc)
                errors.append(source)
                print(f"[JOB SEARCH] {source} failed: {detail}")

    unique, seen = [], set()
    for job in jobs:
        key = (re.sub(r"[^a-z0-9]", "", job["title"].casefold()), re.sub(r"[^a-z0-9]", "", job["company"].casefold()))
        if key in seen:
            continue
        seen.add(key)
        job["role_relevance"] = _role_relevance(role, job["title"], job.get("_description", ""))
        unique.append(job)
    unique.sort(key=lambda item: (item["role_relevance"], item["posted"] or ""), reverse=True)
    for job in unique:
        job["description"] = job.pop("_description", "")
    return unique, errors, len(tasks)


def search_jobs(role, level, location=""):
    cache_material = "|".join((role.strip().casefold(), level, location.strip().casefold()))
    cache_key = "job-search:" + hashlib.sha256(cache_material.encode("utf-8")).hexdigest()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached, True
    jobs, errors, source_count = _fetch_all(role.strip(), level, location.strip())
    result = {"jobs": jobs, "source_errors": errors, "all_sources_failed": source_count > 0 and len(errors) == source_count}
    if not result["all_sources_failed"]:
        cache.set(cache_key, result, CACHE_SECONDS)
    return result, False
