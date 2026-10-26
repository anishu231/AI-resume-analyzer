# analyzer/views.py
# ============================================================================
# ATS (Applicant Tracking System) Backend API Endpoints
# ============================================================================
# This file contains all Django REST Framework API endpoints for the 
# AI-powered resume screening system.
# ============================================================================
from .utils import extract_text_from_file, extract_skills
from .resume_review import review_resume
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.utils import timezone
from django.core.files.storage import default_storage

from analyzer.models import Candidate

from .serializers import RegisterSerializer

from rest_framework_simplejwt.tokens import RefreshToken

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Candidate, MatchScore
from django.db.models import Avg
import re

import os
import traceback
import json
import requests
from datetime import timedelta
from django.db import transaction
from difflib import SequenceMatcher
from .models import JobSearchQuota
from .job_search import EXPERIENCE_LABELS, search_jobs


def add_gemini_bullet_suggestions(report, job_description):
    """Attach real Gemini rewrites; never present local guidance as AI output."""
    api_key = os.environ.get("GEMINI_API_KEY")
    targets = [item for item in report.get("bullet_feedback", []) if item.get("original")]
    if not targets:
        return report

    for item in targets:
        item["suggestion_source"] = "unavailable"
        item["suggested_version"] = ""
    if not api_key:
        print("[GEMINI REWRITE] GEMINI_API_KEY is not configured; AI rewrites unavailable")
        report["bullet_feedback"] = []
        return report

    configured_model = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash").strip()
    configured_fallbacks = [
        value.strip()
        for value in os.environ.get("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash-lite,gemini-2.5-flash-lite").split(",")
        if value.strip()
    ]
    models = list(dict.fromkeys([configured_model, "gemini-3.8-flash", "gemini-3.5-flash-lite", *configured_fallbacks, "gemini-2.5-flash-lite"]))
    for candidate_model in models:
        pending = [item for item in targets if item["suggestion_source"] != "gemini"]
        if not pending:
            break
        payload = {
            "contents": [{"role": "user", "parts": [{"text": (
                "You are an expert resume editor. Rewrite every supplied resume bullet as a distinct, polished achievement statement tailored to the job description. "
                "Preserve the original meaning and every stated tool, scope, and number exactly. Never invent metrics, outcomes, tools, responsibilities, or facts. "
                "Use a strong, accurate action verb; remove filler; improve grammar and specificity using only facts already present. "
                "Even when a bullet is already strong, provide a genuine concise paraphrase rather than advice, a placeholder, or the original sentence. "
                "Each result must be a rewritten resume bullet, not commentary. Return JSON only as {\"suggestions\":[\"...\"]} in the same order.\n"
                + "Job description (context only): " + job_description[:5000] + "\nBullets: "
                + json.dumps([item["original"][:500] for item in pending])
            )}]}],
            "generationConfig": {"temperature": 0.45, "responseMimeType": "application/json", "maxOutputTokens": 2000},
        }
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{candidate_model}:generateContent",
                headers={"x-goog-api-key": api_key}, json=payload, timeout=12,
            )
            response.raise_for_status()
            text = "".join(part.get("text", "") for part in response.json()["candidates"][0]["content"]["parts"])
            parsed = json.loads(text)
            suggestions = parsed.get("suggestions", []) if isinstance(parsed, dict) else parsed
            if len(suggestions) != len(pending):
                raise ValueError("Gemini returned an unexpected number of suggestions")
            for item, suggestion in zip(pending, suggestions):
                if not isinstance(suggestion, str) or not suggestion.strip():
                    continue
                original = re.sub(r"[^a-z0-9]+", "", item["original"].lower())
                rewritten = re.sub(r"[^a-z0-9]+", "", suggestion.lower())
                if rewritten and SequenceMatcher(None, original, rewritten).ratio() <= 0.92:
                    item["suggested_version"] = suggestion.strip()[:700]
                    item["suggestion_source"] = "gemini"
            print(f"[GEMINI REWRITE] {candidate_model} generated {sum(item['suggestion_source'] == 'gemini' for item in targets)}/{len(targets)} bullet rewrites")
        except (requests.RequestException, ValueError, KeyError, TypeError, IndexError) as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            print(f"[GEMINI REWRITE] {candidate_model} failed (HTTP {status_code or 'request/parse error'}): {exc}")
    report["bullet_feedback"] = [
        item for item in report.get("bullet_feedback", [])
        if item.get("suggestion_source") == "gemini" and item.get("suggested_version")
    ]
    return report


def _job_search_payload(quota):
    last_search_at = quota.last_search_at if quota else None
    return {
        "can_search": True,
        "last_search_at": last_search_at.isoformat() if last_search_at else None,
        "next_search_at": None,
        "retry_after": 0,
        "role": quota.target_role if quota else "",
        "experience_level": quota.experience_level if quota else "",
        "location": quota.location if quota else "",
        "jobs": quota.results if quota else [],
    }


def _add_resume_skill_matches(user, jobs):
    """Compare public listing skills with skills extracted from the user's latest resume."""
    candidate = Candidate.objects.filter(user=user).exclude(extracted_text="").first()
    if not candidate:
        return jobs, False

    resume_skills = set(candidate.extracted_skills or extract_skills(candidate.extracted_text))
    for job in jobs:
        job_skills = set(extract_skills(f"{job.get('title', '')}\n{job.get('description', '')}"))
        matched = sorted(resume_skills & job_skills)
        missing = sorted(job_skills - resume_skills)
        job["resume_match"] = {
            "score": round(len(matched) / len(job_skills) * 100) if job_skills else None,
            "matched_skills": matched,
            "missing_skills": missing,
            "skills_assessed": len(job_skills),
        }
    jobs.sort(
        key=lambda job: (
            job["resume_match"]["score"] is not None,
            job["resume_match"]["score"] if job["resume_match"]["score"] is not None else -1,
            job.get("posted", ""),
        ),
        reverse=True,
    )
    return jobs, True


def _run_job_search(user, role, experience_level, location):
    """Run a provider search without a per-user cooldown."""
    if not role or len(role) > 120:
        return Response({"error": "Enter a target role (up to 120 characters)."}, status=status.HTTP_400_BAD_REQUEST)
    if experience_level not in EXPERIENCE_LABELS:
        return Response({"error": "Choose an experience level."}, status=status.HTTP_400_BAD_REQUEST)
    if len(location) > 120:
        return Response({"error": "Location must be 120 characters or fewer."}, status=status.HTTP_400_BAD_REQUEST)
    # This app primarily serves Indian job seekers; an empty location should
    # not fan out into unrelated global listings from company ATS boards.
    location = location or "India"
    try:
        result, cached = search_jobs(role, experience_level, location)
    except RuntimeError as exc:
        result = {"error": str(exc), "all_sources_failed": True}
        cached = False

    if result.get("all_sources_failed"):
        return Response({"error": result.get("error") or "All job sources are temporarily unavailable. Try again later."}, status=status.HTTP_502_BAD_GATEWAY)

    jobs, has_resume = _add_resume_skill_matches(user, result["jobs"])
    with transaction.atomic():
        quota, _ = JobSearchQuota.objects.select_for_update().get_or_create(user=user)
        quota.target_role = role
        quota.experience_level = experience_level
        quota.location = location
        quota.results = jobs
        quota.last_search_at = timezone.now()
        quota.save(update_fields=["last_search_at", "target_role", "experience_level", "location", "results"])
        data = _job_search_payload(quota)
        data["source_errors"] = result.get("source_errors", [])
        data["cached"] = cached
        data["has_resume"] = has_resume
        data["match_basis"] = "recognized_job_skill_coverage"
        return Response(data, status=status.HTTP_200_OK)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def job_search(request):
    """Preserve the original status endpoint and POST contract."""
    if request.method == "GET":
        data = _job_search_payload(JobSearchQuota.objects.filter(user=request.user).first())
        data["jobs"], data["has_resume"] = _add_resume_skill_matches(request.user, data["jobs"])
        return Response(data)
    return _run_job_search(
        request.user,
        str(request.data.get("role", "")).strip(),
        str(request.data.get("experience_level", "")).strip().lower(),
        str(request.data.get("location", "")).strip(),
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_jobs_api(request):
    """GET /api/search?role=&level=&location= for an authenticated account."""
    return _run_job_search(
        request.user,
        str(request.query_params.get("role", "")).strip(),
        str(request.query_params.get("level", "")).strip().lower(),
        str(request.query_params.get("location", "")).strip(),
    )
# ============================================================================
# ML PREDICTOR INITIALIZATION (Run once at server startup)
# ============================================================================

try:
    from .ml_engine.ml_predictor import ATSMLPredictor
    ml_predictor = ATSMLPredictor()
    print("✅ ML Predictor loaded successfully")
except FileNotFoundError as e:
    ml_predictor = None
    print(f"⚠️ ML model file not found: {e}. Using traditional scoring fallback.")
except Exception as e:
    ml_predictor = None
    print(f"⚠️ ML Predictor initialization failed: {e}. Using traditional scoring fallback.")


# ============================================================================
# HELPER FUNCTION: Keyword Extractor
# ============================================================================
def extract_keywords(text, max_keywords=None):
    """
    Extract ALL meaningful keywords from text (no frequency cap).
    Used to build the full vocabulary set for matching.
    """
    words = re.findall(r'\b[A-Za-z]{3,20}\b', text.lower())
    
    stopwords = {
        'the', 'and', 'for', 'with', 'this', 'that', 'you', 'are', 'will', 'can',
        'have', 'has', 'had', 'was', 'were', 'been', 'being', 'is', 'am',
        'from', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
        'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
        'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most',
        'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
        'than', 'too', 'very', 'just', 'also', 'now', 'our', 'your', 'they', 'them',
        'which', 'who', 'what', 'would', 'could', 'should', 'may', 'might', 'must'
    }
    
    filtered = [w for w in words if w not in stopwords]
    
    if max_keywords:
        from collections import Counter
        return [word for word, _ in Counter(filtered).most_common(max_keywords)]
    
    return filtered


def get_top_keywords(text, max_keywords=30):
    """Get top-N most frequent keywords — used for JD's 'important terms' list."""
    return extract_keywords(text, max_keywords=max_keywords)
    
    # from collections import Counter
    # return [word for word, _ in Counter(filtered).most_common(max_keywords)]
def get_top_keywords(text, max_keywords=30):
    """Get top-N frequent keywords (for display purposes only, e.g. missing_keywords)"""
    words = extract_keywords(text)
    from collections import Counter
    return [word for word, _ in Counter(words).most_common(max_keywords)]


# ============================================================================
# ENDPOINT 1: Upload Resume(s) & Generate Score (UPDATED)
# ============================================================================
# POST /api/upload/
# Purpose: Accept MULTIPLE resumes + JD (text OR file) + session_id
# Returns: { "results": [ {filename, success, score, ...}, ... ] }
# ============================================================================
@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):

    serializer = RegisterSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()

        return Response({
            "message": "User created successfully"
        })

    return Response(serializer.errors, status=400)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_user(request):

    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(
        username=username,
        password=password
    )

    if not user:
        return Response(
            {"error": "Invalid credentials"},
            status=401
        )

    refresh = RefreshToken.for_user(user)

    return Response({
        "refresh": str(refresh),
        "access": str(refresh.access_token),
        "username": user.username,
        "email": user.email,      # <-- ye line add karein
    })



# @api_view(['DELETE'])
# @permission_classes([IsAuthenticated])
# def delete_session(request, session_id):

#     print("DELETE SESSION ID =", session_id)

#     all_sessions = Candidate.objects.values_list(
#         "session_id",
#         flat=True
#     ).distinct()

#     print("ALL SESSIONS =", list(all_sessions))

#     candidates = Candidate.objects.filter(
#         session_id=session_id,
#         user=request.user
#     )

#     print("FOUND =", candidates.count())

#     if not candidates.exists():
#         return Response(
#             {"error": "Session not found"},
#             status=404
#         )

#     candidates.delete()

#     return Response({
#         "message": "Session deleted successfully"
#     })

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_session(request, session_id):
    print("DELETE SESSION ID =", session_id)
    
    # Pehle user-owned candidates try karo
    candidates = Candidate.objects.filter(session_id=session_id, user=request.user)
    
    # Agar nahi mile, to bina user filter ke try karo (legacy/null-user records ke liye)
    if not candidates.exists():
        candidates = Candidate.objects.filter(session_id=session_id)
    
    print("FOUND =", candidates.count())
    
    if not candidates.exists():
        return Response({"error": "Session not found"}, status=404)
    
    deleted_count = candidates.count()
    candidates.delete()
    
    return Response({
        "message": "Session deleted successfully",
        "deleted_count": deleted_count,
        "session_id": session_id
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_resume(request):
    """
    Handle batch resume upload with flexible JD input.
    
    Accepts:
        - resumes[]: List of PDF/DOCX files (multiple)
        - job_description: Text of job posting (string)
        - jd_file: File containing job description (optional)
        - session_id: String to group uploads (optional)
    
    Returns:
        {
            "session_id": str,
            "total_uploaded": int,
            "successful": int,
            "failed": int,
            "results": [ {filename, success, score, ...}, ... ]
        }
    """
    
    # Debug logging (remove in production)
    print(f"\n{'='*60}")
    print(f"[UPLOAD] Received request")
    print(f"[UPLOAD] FILES keys: {list(request.FILES.keys())}")
    print(f"[UPLOAD] DATA keys: {list(request.data.keys())}")
    print(f"[UPLOAD] Resumes count: {len(request.FILES.getlist('resumes'))}")
    print(f"[UPLOAD] JD text length: {len(request.data.get('job_description', ''))}")
    print(f"[UPLOAD] JD file present: {'jd_file' in request.FILES}")
    print(f"[UPLOAD] Session ID: {request.data.get('session_id')}")
    print(f"{'='*60}\n")
    
    if request.method != 'POST':
        return Response({"error": "Method not allowed"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
    
    # === GET INPUTS ===
    resumes = request.FILES.getlist('resumes')  # ✅ Multiple files
    job_description_text = request.data.get('job_description', '').strip()  # ✅ Text JD
    jd_file = request.FILES.get('jd_file')  # ✅ File JD (optional)
    session_id = request.data.get('session_id', f"session_{timezone.now().timestamp()}")
    experience_level = request.data.get('experience_level', 'entry').strip().lower()
    
    # === VALIDATION ===
    if not resumes:
        print("[ERROR] No resume files uploaded")
        return Response({"error": "No resume files uploaded"}, status=status.HTTP_400_BAD_REQUEST)

    if experience_level not in {'entry', 'experienced'}:
        return Response(
            {"error": "experience_level must be 'entry' or 'experienced'."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    
    if not job_description_text and not jd_file:
        print("[ERROR] Missing job description (neither text nor file provided)")
        return Response({
            "error": "Missing resume or job description",
            "detail": "Please provide job description as text OR upload a JD file"
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # === PROCESS JD: Extract text if provided as file ===
    jd_temp_path = None
    try:
        if jd_file and not job_description_text:
            print(f"[INFO] Processing JD file: {jd_file.name}")
            jd_ext = os.path.splitext(jd_file.name)[1].lower()
            jd_temp_path = default_storage.save(f"jd_temp/{jd_file.name}", jd_file)
            jd_full_path = os.path.join(settings.MEDIA_ROOT, jd_temp_path)
            
            job_description_text = extract_text_from_file(jd_full_path, jd_ext[1:])
            print(f"[INFO] Extracted JD text length: {len(job_description_text)}")
            
        if not job_description_text.strip():
            print("[ERROR] Could not extract job description text")
            return Response({
                "error": "Could not extract job description text",
                "detail": "The JD file appears to be empty or unreadable"
            }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            
    except Exception as jd_error:
        print(f"[ERROR] JD processing failed: {jd_error}")
        traceback.print_exc()
        return Response({
            "error": "Failed to process job description",
            "details": str(jd_error)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    finally:
        # Clean up temp JD file
        if jd_temp_path and os.path.exists(os.path.join(settings.MEDIA_ROOT, jd_temp_path)):
            try:
                os.remove(os.path.join(settings.MEDIA_ROOT, jd_temp_path))
                default_storage.delete(jd_temp_path)
                print("[INFO] Cleaned up temp JD file")
            except:
                pass
    
    # === PROCESS EACH RESUME ===
    results = []
    print(f"[INFO] Processing {len(resumes)} resume(s) for session: {session_id}")
    
    for resume in resumes:
        result = {"filename": resume.name, "success": False}
        
        try:
            # Validate file type
            file_ext = os.path.splitext(resume.name)[1].lower()
            if file_ext not in ['.pdf', '.docx', '.doc']:
                result["error"] = f"Unsupported file type: {file_ext}"
                results.append(result)
                continue
            
            print(f"[INFO] Processing resume: {resume.name}")
            
            # Save resume file
            file_path = default_storage.save(f"resumes/{resume.name}", resume)
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)
            
            # Extract text from resume
            resume_text = extract_text_from_file(full_path, file_ext[1:])
            if not resume_text.strip():
                result["error"] = "Could not extract text from resume"
                results.append(result)
                continue
            
            print(f"[INFO] Extracted text length: {len(resume_text)}")
            
            resume_skills = extract_skills(resume_text)
            job_skills = extract_skills(job_description_text)
            analysis_report = review_resume(
                resume_text,
                job_description_text,
                experience_level=experience_level,
                resume_skills=resume_skills,
                job_skills=job_skills,
            )
            add_gemini_bullet_suggestions(analysis_report, job_description_text)
            final_score = analysis_report["score"]
            matched_keywords = analysis_report["matched_skills"]
            missing_keywords = analysis_report["missing_skills"]
            recommendations = analysis_report["recommendations"]
            section_scores = analysis_report["component_scores"]
            
            # Save candidate to database WITH session_id
            candidate_name = resume.name.rsplit('.', 1)[0]
            candidate = Candidate.objects.create(
            user=request.user,
            name=candidate_name,
            resume_file=file_path,
            extracted_text=resume_text[:5000],
            extracted_skills=resume_skills,
            session_id=session_id
)
            
            # Save match score
            MatchScore.objects.create(
                candidate=candidate,
                score=final_score/100,
                semantic_similarity=section_scores.get('job_relevance', 0) / 100,
                skill_match_score=section_scores.get('role_skills', 0) / 100,
                job_description_text=job_description_text,
                experience_score=section_scores.get(
                    'experience_and_scope', section_scores.get('projects_and_education', 0)
                ) / 100,
                missing_skills=missing_keywords,
                matched_skills=matched_keywords,
                strengths=analysis_report['strengths'],
                weaknesses=[
                    item['issues'][0]
                    for item in analysis_report['bullet_feedback']
                    if item.get('issues')
                ],
                recommendations=recommendations,
                analysis_report=analysis_report,
            )
            
            # Build success result
            result.update({
                "success": True,
                "candidate_id": candidate.id,
                "score": final_score,
                "matched_keywords": matched_keywords[:15],
                "missing_keywords": missing_keywords[:15],
                "match_report": analysis_report,
                "experience_level": experience_level,
                "section_scores": section_scores,
                "recommendations": recommendations[:8],
                "resume_url": f"http://127.0.0.1:8000/media/{file_path}",
                "scoring_method": "explainable_text_fit_v2"
            })
            
            print(f"[SUCCESS] {resume.name} - Score: {final_score}")
            
        except Exception as e:
            print(f"[ERROR processing {resume.name}] {str(e)}")
            traceback.print_exc()
            result["error"] = str(e)
        
        results.append(result)
    
    # === RETURN BATCH RESPONSE ===
    success_count = sum(1 for r in results if r.get("success"))
    failed_count = len(resumes) - success_count
    
    print(f"\n{'='*60}")
    print(f"[UPLOAD COMPLETE] Total: {len(resumes)}, Success: {success_count}, Failed: {failed_count}")
    print(f"{'='*60}\n")
    
    return Response({
        "session_id": session_id,
        "total_uploaded": len(resumes),
        "successful": success_count,
        "failed": failed_count,
        "results": results
    }, status=status.HTTP_200_OK)


# ============================================================================
# ENDPOINT 2: List All Candidates (Legacy Endpoint)
# ============================================================================
# GET /api/candidates/
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_candidates(request):
    """
    Return all candidates in database with their match scores (legacy endpoint).
    """
    try:
        candidates = Candidate.objects.filter(user=request.user).order_by('-id')
        results = []
        
        for c in candidates:
            match_score = MatchScore.objects.filter(candidate=c).first()
            
            candidate_data = {
                "id": c.id,
                "name": c.name,
                "score": round((match_score.score * 100) if match_score else 0, 1),
                "skills": c.extracted_skills or [],
                "resume_url": f"http://127.0.0.1:8000{c.resume_file}" if c.resume_file else None,
                "session_id": getattr(c, 'session_id', None)
            }
            
            if match_score and match_score.missing_skills:
                candidate_data["match_report"] = {
                    "matched_keywords": [s for s in (c.extracted_skills or []) if s not in (match_score.missing_skills or [])],
                    "missing_keywords": match_score.missing_skills or [],
                    "section_scores": {"skills": 70, "experience": 65, "education": 75, "keywords": 60},
                    "recommendations": [
                        f"Add missing skills: {', '.join(match_score.missing_skills[:3])}" if match_score.missing_skills else "Great skill coverage!",
                        "Quantify achievements with metrics",
                        "Use standard section headings"
                    ]
                }
            results.append(candidate_data)
        
        return Response(results, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"[ERROR in list_candidates] {str(e)}")
        return Response({"error": "Failed to load candidates"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================================
# ENDPOINT 3: Dashboard Data (All Candidates with Filters)
# ============================================================================
# GET /api/dashboard/?min_score=60
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_data(request):
    """
    Return all candidates with optional minimum score filtering.
    """
    min_score = float(request.query_params.get('min_score', 0))
    
    all_candidates = Candidate.objects.filter(user=request.user).order_by('-created_at')
    
    candidates_list = []
    for cand in all_candidates:
        match_score = MatchScore.objects.filter(candidate=cand).first()
        score = round((match_score.score * 100) if match_score else 0, 1)
        analysis_report = None
        if match_score and match_score.analysis_report:
            analysis_report = dict(match_score.analysis_report)
            resume_skills = set(extract_skills(cand.extracted_text or ""))

            def normalize_report_skills(values):
                normalized = set()
                for value in values or []:
                    normalized.update(extract_skills(str(value)))
                return normalized

            analysis_report['matched_skills'] = sorted(
                normalize_report_skills(analysis_report.get('matched_skills')) & resume_skills
            )
            analysis_report['missing_skills'] = sorted(
                normalize_report_skills(analysis_report.get('missing_skills')) - resume_skills
            )
        
        if score >= min_score:
            candidates_list.append({
                "id": cand.id,
                "name": cand.name,
                "score": score,
                "verdict": "Shortlist" if score >= 60 else "Review",
                "file_url": f"http://127.0.0.1:8000/media/{cand.resume_file}" if cand.resume_file else None,
                "skills_count": len(cand.extracted_skills or []),
                "analyzed_at": cand.created_at.isoformat() if cand.created_at else None,
                "matched_keywords": (match_score.matched_skills if match_score else [])[:10],
                "match_report": analysis_report,
                "session_id": getattr(cand, 'session_id', None)
            })
    
    total = Candidate.objects.count()
    avg_score = MatchScore.objects.aggregate(Avg('score'))['score__avg'] or 0
    passed = MatchScore.objects.filter(score__gte=0.6).count()
    
    summary = {
        "total_resumes": total,
        "avg_score": round((avg_score or 0) * 100, 1),
        "pass_rate_percent": round((passed / max(total, 1)) * 100, 1),
        "last_updated": timezone.now().isoformat()
    }
    
    recent = candidates_list[:10]
    comparison = [{
        "resume": c["name"][:25] + ("..." if len(c["name"]) > 25 else ""),
        "score": c["score"],
        "verdict": c["verdict"]
    } for c in recent]
    
    return Response({
        "summary": summary,
        "charts": {"comparison": comparison},
        "candidates": candidates_list,
        "filter_applied": {"min_score": min_score}
    }, status=status.HTTP_200_OK)


# ============================================================================
# ENDPOINT 4: Latest Batch Dashboard (Time-Based Grouping)
# ============================================================================
# GET /api/dashboard/latest/
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_latest(request):
    """
    Return candidates uploaded in the last 10 minutes (latest user session).
    """
    from datetime import timedelta
    
    cutoff = timezone.now() - timedelta(minutes=10)
    
    recent_candidates = Candidate.objects.filter(
        created_at__gte=cutoff
    ).order_by('-created_at')
    
    if not recent_candidates:
        return Response({
            "candidates": [], 
            "summary": {"total_candidates": 0, "avg_score": 0, "pass_rate": 0}, 
            "charts": {"comparison": []}
        }, status=200)
    
    candidates_list = []
    for cand in recent_candidates:
        match_score = MatchScore.objects.filter(candidate=cand).first()
        
        candidates_list.append({
            "id": cand.id,
            "name": cand.name,
            "score": round((match_score.score or 0) * 100, 1) if match_score else 0,
            "verdict": "Shortlist" if (match_score.score or 0) >= 0.6 else "Review",
            "file_url": f"http://127.0.0.1:8000/media/{cand.resume_file}" if cand.resume_file else None,
            "skills": cand.extracted_skills or [],
            "matched_keywords": (match_score.matched_skills if match_score else [])[:10],
            "missing_keywords": (match_score.missing_skills if match_score else [])[:10],
            "analyzed_at": cand.created_at.isoformat() if cand.created_at else None,
            "session_id": getattr(cand, 'session_id', None)
        })
    
    scores = [c["score"] for c in candidates_list if c["score"] > 0]
    avg_score = sum(scores) / len(scores) if scores else 0
    passed = sum(1 for c in candidates_list if c["score"] >= 60)
    
    summary = {
        "total_candidates": len(candidates_list),
        "avg_score": round(avg_score, 1),
        "pass_rate": round((passed / max(len(candidates_list), 1)) * 100, 1),
        "top_candidate": max(candidates_list, key=lambda x: x["score"])["name"] if candidates_list else None,
        "analyzed_at": recent_candidates[0].created_at.isoformat()
    }
    
    chart_data = [{
        "name": c["name"][:20] + ("..." if len(c["name"]) > 20 else ""),
        "score": c["score"],
        "verdict": c["verdict"]
    } for c in candidates_list]
    
    return Response({
        "summary": summary,
        "candidates": candidates_list,
        "charts": {"comparison": chart_data}
    }, status=200)


# ============================================================================
# ENDPOINT 5: Dashboard by Session ID
# ============================================================================
# GET /api/dashboard/session/<session_id>/
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_by_session(request, session_id):
    """
    Return all candidates for a specific session.
    """
    candidates = Candidate.objects.filter(session_id=session_id,user=request.user).order_by('-created_at')
    
    if not candidates:
        return Response({
            "session_id": session_id,
            "candidates": [],
            "summary": {"total": 0, "avg_score": 0}
        }, status=200)
    
    candidates_list = []
    for cand in candidates:
        match_score = MatchScore.objects.filter(candidate=cand).first()
        
        candidates_list.append({
            "id": cand.id,
            "name": cand.name,
            "score": round((match_score.score or 0) * 100, 1) if match_score else 0,
            "verdict": "Shortlist" if (match_score.score or 0) >= 0.6 else "Review",
            "file_url": f"http://127.0.0.1:8000/media/{cand.resume_file}" if cand.resume_file else None,
            "skills": cand.extracted_skills or [],
            "matched_keywords": (match_score.matched_skills if match_score else [])[:10],
            "analyzed_at": cand.created_at.isoformat() if cand.created_at else None
        })
    
    scores = [c["score"] for c in candidates_list if c["score"] > 0]
    avg_score = sum(scores) / len(scores) if scores else 0
    
    summary = {
        "session_id": session_id,
        "total": len(candidates_list),
        "avg_score": round(avg_score, 1),
        "passed": sum(1 for c in candidates_list if c["score"] >= 60)
    }
    
    return Response({
        "session_id": session_id,
        "candidates": candidates_list,
        "summary": summary
    }, status=200)


# ============================================================================
# ENDPOINT 6: History Dashboard (Paginated Full History)
# ============================================================================
# GET /api/dashboard/history/?page=1&search=python&min_score=70
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_history(request):
    """
    Return all candidates ever uploaded, with pagination and filtering.
    """

    try:
        page = int(request.query_params.get('page', 1))
        page_size = 20
        search = request.query_params.get('search', '').lower()
        min_score = float(request.query_params.get('min_score', 0))
        
        candidates = Candidate.objects.filter(user=request.user).order_by('-created_at')
        
        if search:
            candidates = candidates.filter(name__icontains=search)
        
        if min_score > 0:
            candidates = candidates.filter(
                matches__score__gte=min_score/100
            ).distinct()
        
        total = candidates.count()
        start = (page - 1) * page_size
        end = start + page_size
        paginated = candidates[start:end]
        
        results = []
        for cand in paginated:
            match_score = cand.matches.first()
            
            results.append({
                "id": cand.id,
                "name": cand.name,
                "score": round((match_score.score or 0) * 100, 1) if match_score else 0,
                "verdict": "Shortlist" if (match_score and match_score.score and match_score.score >= 0.6) else "Review",
                "session_id": str(getattr(cand, 'session_id', 'default')),
                "analyzed_at": cand.created_at.isoformat() if cand.created_at else None,
                "skills_count": len(cand.extracted_skills or []),
                "file_url": f"http://127.0.0.1:8000/media/{cand.resume_file}" if cand.resume_file else None,
            })
        
        return Response({
            "results": results,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size
            },
            "filters_applied": {
                "search": search,
                "min_score": min_score
            }
        }, status=200)
        
    except Exception as e:
        import traceback
        print(f"[❌ ERROR in dashboard_history] {e}")
        print(traceback.format_exc())
        return Response({"error": "Internal server error", "details": str(e)}, status=500)


# ============================================================================
# ENDPOINT 7: Standalone ML Analysis (Optional/Advanced Use)
# ============================================================================
# POST /api/ml-analyze/
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def ml_analyze(request):
    """
    Standalone ML analysis endpoint for testing or advanced use cases.
    """
    resume_file = request.FILES.get('resume')
    jd = request.data.get('job_description', '').strip()

    if not resume_file or not jd:
        return Response({"error": "Missing 'resume' file or 'job_description'"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        file_ext = os.path.splitext(resume_file.name)[1].lower().replace('.', '')
        file_path = default_storage.save(f"temp_ml/{resume_file.name}", resume_file)
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        print(f"[DEBUG] Saved temp file: {full_path}")

        resume_text = extract_text_from_file(full_path, file_ext)
        print(f"[DEBUG] Extracted text length: {len(resume_text) if resume_text else 0}")
        
        if not resume_text or not resume_text.strip():
            return Response({"error": "Could not extract text"}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        if ml_predictor:
            result = ml_predictor.predict(resume_text, jd)
            score = result['score']
            matched = result['matched_keywords']
        else:
            score = 50.0
            matched = []
            
        verdict = "Shortlist" if score >= 60 else "Review"
        print(f"[DEBUG] ML Score: {score}, Matched: {len(matched)} keywords")

        ml_record = MLAnalysis.objects.create(
            resume_filename=resume_file.name,
            job_description=jd,
            ml_score=score,
            matched_keywords=matched,
            verdict=verdict,
            method="ml_hybrid" if ml_predictor else "fallback"
        )
        print(f"[DEBUG] Saved to DB with ID: {ml_record.id}")

        return Response({
            "match_score_percent": score,
            "matched_keywords": matched,
            "verdict": verdict,
            "method": "ml_hybrid" if ml_predictor else "fallback",
            "analysis_id": ml_record.id,
            "message": "Analysis saved to database"
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ [ML_ANALYZE CRASH] {type(e).__name__}: {str(e)}")
        print(f"{'='*60}")
        print(traceback.format_exc())
        print(f"{'='*60}\n")
        
        return Response({
            "error": "ML analysis failed", 
            "error_type": type(e).__name__,
            "details": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    finally:
        if 'full_path' in locals() and os.path.exists(full_path):
            try:
                os.remove(full_path)
                default_storage.delete(file_path)
                print("[DEBUG] Cleaned up temp file")
            except Exception as cleanup_err:
                print(f"[DEBUG] Cleanup warning: {cleanup_err}")
