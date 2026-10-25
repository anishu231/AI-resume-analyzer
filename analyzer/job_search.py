"""Grounded job search, restricted to links on employers' career sites."""
import json
import os
import re
from urllib.parse import urlparse

import requests


EXPERIENCE_LABELS = {
    "entry": "Entry-level (0–2 years)",
    "mid": "Mid-level (2–10 years)",
    "senior": "Senior-level (10+ years)",
}

ATS_HOSTS = (
    "boards.greenhouse.io", "job-boards.greenhouse.io", "jobs.lever.co",
    "jobs.ashbyhq.com", "myworkdayjobs.com", "careers.smartrecruiters.com",
    "jobs.jobvite.com", "jobs.workable.com", "jobs.personio.com",
    "jobs.icims.com", "jobs.bamboohr.com", "applytojob.com",
)
CAREER_MARKERS = ("career", "jobs", "job", "opening", "workday", "greenhouse", "lever.co", "ashbyhq")


def _normal_url(url):
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None
    return parsed.hostname.lower().removeprefix("www."), parsed.path.rstrip("/") or "/"


def _company_tokens(company):
    tokens = [re.sub(r"[^a-z0-9]", "", word.lower()) for word in company.split()]
    return [token for token in tokens if len(token) >= 3]


def _company_matches_url(company, host, path, hosted_ats):
    searchable = re.sub(r"[^a-z0-9]", "", (path if hosted_ats else host).lower())
    return any(token in searchable for token in _company_tokens(company))


def _is_official_career_url(company, url):
    normalized = _normal_url(url)
    if not normalized:
        return False
    host, path = normalized
    host_is_ats = any(host == domain or host.endswith("." + domain) for domain in ATS_HOSTS)
    path_has_job = any(marker in f"{host}/{path}".lower() for marker in CAREER_MARKERS)
    company_match = _company_matches_url(company, host, path, host_is_ats)
    return path_has_job and company_match


def _extract_json(text):
    cleaned = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text, flags=re.I)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Gemini did not return a JSON object")
    return json.loads(cleaned[start:end + 1])


def find_official_jobs(role, experience_level, location=""):
    api_key = os.environ.get("JOB_SEARCH_GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Job search is not configured yet. Add JOB_SEARCH_GEMINI_API_KEY in Space secrets.")

    level = EXPERIENCE_LABELS[experience_level]
    location_text = location.strip() or "Any location; include remote roles"
    prompt = (
        "Search the live web for current job openings matching the target role, experience level, and location. "
        "Return only openings posted on the hiring company's own careers domain or its official applicant-tracking page. "
        "Never return LinkedIn, Indeed, Glassdoor, job-board, staffing, or scraped aggregator pages. "
        "Do not invent a job, company, requirement, location, or URL. Include a result only when its exact job-detail URL appears in your Google Search grounding sources. "
        "If you cannot verify a company-hosted job-detail page, omit that result. Return at most 8 newest/relevant results. "
        "Return JSON only: {\"jobs\":[{\"company\":\"...\",\"title\":\"...\",\"location\":\"...\",\"experience_evidence\":\"...\",\"summary\":\"...\",\"url\":\"exact source URL\"}]}. "
        f"Target role: {role}. Target experience: {level}. Location: {location_text}."
    )

    configured_model = os.environ.get("JOB_SEARCH_GEMINI_MODEL", "gemini-3.8-flash").strip()
    models = list(dict.fromkeys([
        configured_model,
        "gemini-3.8-flash",
        "gemini-3.5-flash-lite",
    ]))
    last_error = None
    for model in models:
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                headers={"x-goog-api-key": api_key},
                json={
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "tools": [{"google_search": {}}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "responseMimeType": "application/json",
                        "maxOutputTokens": 3500,
                    },
                },
                timeout=45,
            )
            response.raise_for_status()
            candidate = response.json()["candidates"][0]
            text = "".join(part.get("text", "") for part in candidate.get("content", {}).get("parts", []))
            raw_jobs = _extract_json(text).get("jobs", [])
            chunks = candidate.get("groundingMetadata", {}).get("groundingChunks", [])
            grounded_sources = {}
            for chunk in chunks:
                web = chunk.get("web", {})
                url = web.get("uri", "")
                normalized = _normal_url(url)
                if normalized:
                    grounded_sources[normalized] = {"url": url, "title": web.get("title", "Company careers page")}

            verified = []
            seen_urls = set()
            for item in raw_jobs:
                if not isinstance(item, dict):
                    continue
                company = str(item.get("company", "")).strip()[:120]
                title = str(item.get("title", "")).strip()[:180]
                normalized = _normal_url(str(item.get("url", "")))
                source = grounded_sources.get(normalized)
                if not company or not title or not source or normalized in seen_urls:
                    continue
                if not _is_official_career_url(company, source["url"]):
                    continue
                seen_urls.add(normalized)
                verified.append({
                    "company": company,
                    "title": title,
                    "location": str(item.get("location", "Not specified"))[:160],
                    "experience_evidence": str(item.get("experience_evidence", ""))[:300],
                    "summary": str(item.get("summary", ""))[:600],
                    "url": source["url"],
                    "source_title": source["title"][:180],
                })
                if len(verified) == 8:
                    break
            print(f"[JOB SEARCH] {model} returned {len(verified)} verified official-career listings")
            return verified
        except (requests.RequestException, ValueError, KeyError, TypeError, IndexError) as exc:
            last_error = exc
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            print(f"[JOB SEARCH] {model} failed (HTTP {status_code or 'request/parse error'})")

    raise RuntimeError("Gemini job search is temporarily unavailable. Please try again later.") from last_error
