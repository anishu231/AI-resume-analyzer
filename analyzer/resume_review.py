"""Explainable resume-to-job fit estimate and actionable resume feedback."""

import re
from collections import Counter

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .utils import extract_skills


LEVEL_LABELS = {
    "entry": "Entry-level / fresher (0–2 years)",
    "experienced": "Experienced (3+ years)",
}

BOILERPLATE = (
    "equal opportunity", "reasonable accommodation", "accommodation request",
    "we are an equal", "benefits package", "apply now", "privacy policy",
    "all qualified applicants", "without regard to", "background check",
)
REQUIREMENT_CUES = (
    "responsib", "require", "qualif", "experience", "proficien", "ability",
    "develop", "design", "build", "lead", "manage", "deliver", "analy",
    "collaborat", "implement", "maintain", "support", "work with", "knowledge",
)
WEAK_OPENERS = {
    "responsible for": "Replace this passive opener with the action you personally took.",
    "worked on": "Name the specific action you took instead of saying you worked on it.",
    "helped": "Clarify your own contribution; avoid making your role sound smaller than it was.",
    "assisted": "State the part you owned or completed, if you can support it accurately.",
    "participated in": "Describe your contribution and what changed because of it.",
    "involved in": "Replace this vague opener with a concrete action you performed.",
    "duties included": "Lead with the outcome or action instead of listing duties.",
}
ACTION_VERBS = {
    "built", "created", "designed", "developed", "delivered", "improved", "reduced",
    "increased", "automated", "analyzed", "implemented", "launched", "led", "owned",
    "managed", "mentored", "optimized", "migrated", "resolved", "coordinated",
    "streamlined", "deployed", "secured", "integrated", "wrote", "tested",
}
STOPWORDS = {
    "about", "after", "again", "also", "because", "been", "being", "between", "both",
    "could", "each", "from", "have", "into", "more", "most", "other", "over", "same",
    "should", "some", "such", "than", "that", "their", "there", "these", "they", "this",
    "those", "through", "under", "very", "were", "what", "when", "where", "which", "while",
    "will", "with", "would", "your", "using", "used", "work", "working", "experience",
    "project", "projects", "resume", "team", "role", "company", "client", "business",
}


def _clean_line(value):
    return re.sub(r"^[\s•●▪◦*\-–—]+", "", value).strip()


def _sentences(text):
    pieces = re.split(r"\n+|(?<=[.!?])\s+", text or "")
    result = []
    for piece in pieces:
        line = _clean_line(piece)
        words = re.findall(r"[A-Za-z0-9+#.]+", line)
        if 5 <= len(words) <= 55 and not line.endswith(":"):
            result.append(line)
    return result


def _requirements(job_text):
    candidates = []
    for index, line in enumerate(_sentences(job_text)):
        lowered = line.lower()
        if any(phrase in lowered for phrase in BOILERPLATE):
            continue
        cue_count = sum(cue in lowered for cue in REQUIREMENT_CUES)
        # Give responsibility/qualification language priority while retaining
        # substantive lines that use different wording.
        priority = cue_count * 3 + min(len(line.split()) / 20, 1)
        candidates.append((priority, index, line))
    candidates.sort(key=lambda row: (-row[0], row[1]))
    selected = [row[2] for row in candidates[:10]]
    return selected or [line for line in _sentences(job_text)[:8]]


def _similarity_matrix(left_texts, right_texts):
    if not left_texts or not right_texts:
        return []
    try:
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
        matrix = vectorizer.fit_transform(left_texts + right_texts)
        return cosine_similarity(matrix[:len(left_texts)], matrix[len(left_texts):])
    except ValueError:
        return []


def _resume_lines(text):
    lines = [_clean_line(line) for line in (text or "").splitlines()]
    lines = [
        line for line in lines
        if 5 <= len(line.split()) <= 55
        and not line.endswith(":")
        and not re.search(r"\b(?:https?://|www\.|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})", line, re.I)
    ]
    return lines or _sentences(text)


def _bullet_feedback(lines):
    feedback = []
    openers = Counter()
    for line in lines:
        words = re.findall(r"[A-Za-z]+", line.lower())
        if words:
            openers[words[0]] += 1
    repeated_openers = {word for word, count in openers.items() if count > 1}

    for line in lines:
        lowered = line.lower()
        words = re.findall(r"[A-Za-z0-9]+", line)
        if len(words) < 6:
            continue
        issues = []
        opener = next((phrase for phrase in WEAK_OPENERS if lowered.startswith(phrase)), None)
        if opener:
            issues.append(WEAK_OPENERS[opener])
        first_word = re.sub(r"[^a-z]", "", words[0].lower()) if words else ""
        if first_word in repeated_openers and first_word in ACTION_VERBS:
            issues.append(f"Several bullets start with '{first_word}'; vary the opening verbs where accurate.")
        if not re.search(r"\d|%|\$|\b(?:hours?|days?|weeks?|months?|users?|customers?|records?|requests?)\b", lowered):
            issues.append("No scale or outcome is stated; add a truthful metric or result if available.")
        if len(words) > 32:
            issues.append("This bullet is long; shorten it to one action and its clearest result.")
        if issues:
            feedback.append({
                "original": line[:260],
                "issues": issues[:2],
                "suggestion": (
                    "Rewrite as: [specific action] + [scope or method] + [verified result]. "
                    "Use real figures only; do not add a result you cannot substantiate."
                ),
            })
        if len(feedback) >= 5:
            break

    if not feedback:
        feedback.append({
            "original": "",
            "issues": ["No obvious weak or repetitive achievement bullet was detected in the extracted text."],
            "suggestion": "Check that each experience and project bullet starts with your action and includes a result when you can verify one.",
        })
    return feedback


def _repetition_checks(text, lines):
    words = [word.lower() for word in re.findall(r"\b[A-Za-z]{4,}\b", text or "")]
    counts = Counter(word for word in words if word not in STOPWORDS)
    repeated_terms = [
        {"term": word, "count": count}
        for word, count in counts.most_common(8)
        if count >= 5
    ]
    repeated_chars = sorted(set(
        match.group(0).lower()
        for match in re.finditer(r"\b\w*(\w)\1{2,}\w*\b", text or "", re.I)
    ))[:8]
    normalized = [re.sub(r"[^a-z0-9]+", " ", line.lower()).strip() for line in lines]
    duplicate_count = sum(count - 1 for count in Counter(normalized).values() if count > 1)
    return {
        "repeated_terms": repeated_terms,
        "possible_repeated_characters": repeated_chars,
        "duplicate_bullets": duplicate_count,
    }


def _level_evidence(resume_text, bullets, level):
    lowered = (resume_text or "").lower()
    years = [int(value) for value in re.findall(r"\b(\d{1,2})\+?\s+years?\b", lowered)]
    project_signals = len(re.findall(r"\b(?:projects?|internships?|capstone|coursework|hackathons?)\b", lowered))
    leadership_signals = len(re.findall(r"\b(?:led|lead|managed|mentored|owned|architected|directed|supervised)\b", lowered))
    has_education = bool(re.search(r"\b(?:education|bachelor|b\.sc|bsc|master|m\.sc|msc|degree|university)\b", lowered))
    metric_bullets = sum(bool(re.search(r"\d|%|\$", bullet)) for bullet in bullets)
    metric_rate = metric_bullets / max(len(bullets), 1)

    if level == "entry":
        score = min(100, 35 + min(project_signals, 3) * 12 + (15 if has_education else 0))
        return score, {
            "projects_and_internships": project_signals,
            "education_signal_found": has_education,
        }

    if years:
        years_score = min(100, 35 + max(years) * 9)
    else:
        years_score = 35  # Unstated tenure is unknown, not proof of no experience.
    score = min(100, years_score + min(leadership_signals, 3) * 8 + round(metric_rate * 15))
    return score, {
        "years_stated": max(years) if years else None,
        "leadership_or_ownership_signals": leadership_signals,
        "bullets_with_metrics": metric_bullets,
    }


def _readability_score(text, lines, repetition):
    words = len((text or "").split())
    section_count = len(re.findall(
        r"(?im)^\s*(?:summary|objective|experience|work history|employment|projects?|education|skills|certifications?)\s*:?[\s]*$",
        text or "",
    ))
    score = 55
    if 150 <= words <= 900:
        score += 20
    elif words < 80 or words > 1400:
        score -= 15
    else:
        score += 8
    score += min(section_count, 4) * 5
    score += min(len(lines), 8) * 1.5
    score -= min(repetition["duplicate_bullets"] * 8, 20)
    score -= min(len(repetition["possible_repeated_characters"]) * 5, 15)
    return max(0, min(100, round(score)))


def review_resume(resume_text, job_text, experience_level="entry", resume_skills=None, job_skills=None):
    """Score fit with a job description and return evidence-based editing feedback."""
    level = experience_level if experience_level in LEVEL_LABELS else "entry"
    requirements = _requirements(job_text)
    resume_sentences = _resume_lines(resume_text)
    similarities = _similarity_matrix(requirements, resume_sentences)

    requirement_matches = []
    coverage_scores = []
    if len(similarities):
        for index, requirement in enumerate(requirements):
            best_index = int(similarities[index].argmax())
            best_similarity = float(similarities[index][best_index])
            fit = min(100, round(best_similarity * 300))
            coverage_scores.append(fit)
            requirement_matches.append({
                "requirement": requirement[:220],
                "evidence": resume_sentences[best_index][:220] if best_similarity >= 0.07 else "",
                "fit": fit,
                "status": "Evidence found" if best_similarity >= 0.12 else "Partial evidence" if best_similarity >= 0.06 else "Not found in extracted text",
            })
    else:
        requirement_matches = [
            {"requirement": item[:220], "evidence": "", "fit": 0, "status": "Not assessed"}
            for item in requirements[:8]
        ]

    requirement_coverage = round(sum(coverage_scores) / len(coverage_scores)) if coverage_scores else 0
    semantic_matrix = _similarity_matrix([job_text], [resume_text])
    raw_similarity = float(semantic_matrix[0][0]) if len(semantic_matrix) else 0.0
    relevance_score = min(100, round(raw_similarity * 220))

    resume_skills = set(resume_skills if resume_skills is not None else extract_skills(resume_text))
    job_skills = set(job_skills if job_skills is not None else extract_skills(job_text))
    matched_skills = sorted(resume_skills & job_skills)
    missing_skills = sorted(job_skills - resume_skills)
    skill_score = round(len(matched_skills) / len(job_skills) * 100) if job_skills else 60

    repetition = _repetition_checks(resume_text, resume_sentences)
    bullet_feedback = _bullet_feedback(resume_sentences)
    readability = _readability_score(resume_text, resume_sentences, repetition)
    level_score, level_evidence = _level_evidence(resume_text, resume_sentences, level)

    if level == "entry":
        components = {
            "job_relevance": relevance_score,
            "requirement_coverage": requirement_coverage,
            "role_skills": skill_score,
            "projects_and_education": level_score,
            "resume_readability": readability,
        }
        weights = {
            "job_relevance": 30,
            "requirement_coverage": 30,
            "role_skills": 15,
            "projects_and_education": 15,
            "resume_readability": 10,
        }
    else:
        components = {
            "job_relevance": relevance_score,
            "requirement_coverage": requirement_coverage,
            "role_skills": skill_score,
            "experience_and_scope": level_score,
            "impact_evidence": min(100, round(sum(bool(re.search(r"\d|%|\$", line)) for line in resume_sentences) / max(len(resume_sentences), 1) * 250)),
            "resume_readability": readability,
        }
        weights = {
            "job_relevance": 25,
            "requirement_coverage": 25,
            "role_skills": 15,
            "experience_and_scope": 20,
            "impact_evidence": 10,
            "resume_readability": 5,
        }

    score = round(sum(components[key] * weights[key] / 100 for key in components))
    strengths = []
    if requirement_coverage >= 55:
        strengths.append("Several job requirements have related evidence in the resume text.")
    if matched_skills:
        strengths.append("Relevant skills found: " + ", ".join(matched_skills[:5]) + ".")
    if level == "entry" and level_score >= 70:
        strengths.append("Projects, internships, or education provide useful early-career evidence.")
    if level == "experienced" and level_score >= 65:
        strengths.append("The resume includes experience, ownership, or scope signals for this level.")

    recommendations = []
    uncovered = [row["requirement"] for row in requirement_matches if row["fit"] < 18]
    if uncovered:
        recommendations.append("Add a truthful example for a requirement that is not yet visible: “" + uncovered[0][:150] + "”")
    if missing_skills:
        recommendations.append("If you have used these, name them in the relevant project or experience context: " + ", ".join(missing_skills[:5]) + ".")
    if level == "entry" and level_score < 65:
        recommendations.append("For an entry-level application, add 1–2 relevant projects or internships and state your exact contribution.")
    if level == "experienced" and level_score < 65:
        recommendations.append("Make the scope of your work clearer: ownership, team or users affected, and the decisions you led.")
    if any("metric" in issue.lower() for item in bullet_feedback for issue in item["issues"]):
        recommendations.append("Add verified measures where possible—time saved, volume handled, quality change, users, or cost. Never invent numbers.")
    if repetition["duplicate_bullets"]:
        recommendations.append("Remove or rewrite duplicate bullets; the same accomplishment appears more than once.")
    if repetition["possible_repeated_characters"]:
        recommendations.append("Review possible typos with repeated letters: " + ", ".join(repetition["possible_repeated_characters"]) + ".")
    if not recommendations:
        recommendations.append("Keep the resume tailored to this job and verify every claim and metric before applying.")

    word_count = len((resume_text or "").split())
    confidence = "limited" if word_count < 80 or len(requirements) < 3 else "moderate"
    return {
        "score": score,
        "experience_level": level,
        "experience_level_label": LEVEL_LABELS[level],
        "component_scores": components,
        "score_weights": weights,
        "method": "Explainable text-fit estimate: requirement evidence, TF-IDF text relevance, extracted role skills, level signals, and resume structure.",
        "confidence": confidence,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "requirement_matches": requirement_matches[:8],
        "level_evidence": level_evidence,
        "bullet_feedback": bullet_feedback,
        "repetition_checks": repetition,
        "strengths": strengths or ["The resume text was analysed against the supplied job description; review the evidence below for the strongest next edits."],
        "recommendations": recommendations[:8],
        "disclaimer": "This is an explainable estimate for this job description, not a score from an employer’s ATS or a hiring decision. Similarity checks can miss equivalent wording.",
    }
