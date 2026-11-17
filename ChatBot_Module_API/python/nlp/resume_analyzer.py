"""
Job Portal & Resume Screening NLP Module
Data cleaning, entity extraction (skills, education, experience, contact info),
and candidate-job matching analysis for recruitment systems.
"""
import math
import re
from collections import Counter
from typing import Any

from nlp.preprocessing import clean_unicode_and_limit

# Comprehensive Tech & Soft Skills Taxonomy
TECHNICAL_SKILLS = {
    # Programming Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "c", "go", "golang",
    "rust", "ruby", "php", "swift", "kotlin", "r", "dart", "scala", "perl",
    # Web & Frontend
    "react", "react.js", "reactjs", "angular", "vue", "vue.js", "next.js", "nextjs",
    "html", "html5", "css", "css3", "tailwind", "tailwindcss", "bootstrap",
    "sass", "redux", "jquery", "svelte",
    # Backend & Frameworks
    "node.js", "nodejs", "express", "express.js", "django", "flask", "fastapi",
    "spring", "spring boot", "springboot", "asp.net", "dotnet", ".net", "laravel",
    "nest.js", "nestjs", "ruby on rails", "rails",
    # Databases & Storage
    "mongodb", "postgresql", "postgres", "mysql", "sqlite", "redis", "oracle",
    "cassandra", "dynamodb", "elasticsearch", "mariadb", "sql server", "mssql",
    # Cloud & DevOps
    "aws", "amazon web services", "azure", "gcp", "google cloud", "docker",
    "kubernetes", "k8s", "jenkins", "git", "github", "gitlab", "ci/cd", "cicd",
    "terraform", "ansible", "linux", "nginx", "apache", "helm",
    # Data Science & Machine Learning
    "machine learning", "deep learning", "nlp", "natural language processing",
    "data science", "data analysis", "pandas", "numpy", "scipy", "scikit-learn",
    "tensorflow", "pytorch", "keras", "opencv", "nltk", "spacy", "tableau",
    "powerbi", "power bi", "big data", "hadoop", "spark", "pyspark",
    # Testing & Tools
    "jest", "mocha", "pytest", "selenium", "cypress", "postman", "swagger",
    "jira", "graphql", "rest api", "restful api", "microservices",
}

SOFT_SKILLS = {
    "communication", "leadership", "teamwork", "collaboration", "problem solving",
    "critical thinking", "adaptability", "time management", "agile", "scrum",
    "analytical skills", "project management", "creativity", "decision making",
    "negotiation", "work ethic", "interpersonal skills",
}

COMMON_JOB_ROLES = [
    "software engineer", "full stack developer", "full stack engineer",
    "frontend developer", "frontend engineer", "backend developer",
    "backend engineer", "data scientist", "data analyst", "data engineer",
    "devops engineer", "cloud engineer", "machine learning engineer",
    "qa engineer", "quality assurance", "mobile developer", "android developer",
    "ios developer", "system architect", "solution architect", "scrum master",
    "product manager", "project manager", "ui/ux designer", "database administrator",
]

EDUCATION_DEGREES = [
    (re.compile(r"\b(?:b\.?tech|bachelor of technology)\b", re.IGNORECASE), "B.Tech"),
    (re.compile(r"\b(?:b\.?e\.?|bachelor of engineering)\b", re.IGNORECASE), "B.E."),
    (re.compile(r"\b(?:m\.?tech|master of technology)\b", re.IGNORECASE), "M.Tech"),
    (re.compile(r"\b(?:m\.?s\.?|master of science)\b", re.IGNORECASE), "M.S."),
    (re.compile(r"\b(?:b\.?sc\.?|bachelor of science)\b", re.IGNORECASE), "B.Sc"),
    (re.compile(r"\b(?:m\.?sc\.?|master of science)\b", re.IGNORECASE), "M.Sc"),
    (re.compile(r"\b(?:b\.?c\.?a\.?|bachelor of computer applications)\b", re.IGNORECASE), "BCA"),
    (re.compile(r"\b(?:m\.?c\.?a\.?|master of computer applications)\b", re.IGNORECASE), "MCA"),
    (re.compile(r"\b(?:b\.?b\.?a\.?|bachelor of business administration)\b", re.IGNORECASE), "BBA"),
    (re.compile(r"\b(?:m\.?b\.?a\.?|master of business administration)\b", re.IGNORECASE), "MBA"),
    (re.compile(r"\b(?:ph\.?d\.?|doctor of philosophy)\b", re.IGNORECASE), "Ph.D"),
    (re.compile(r"\b(?:diploma)\b", re.IGNORECASE), "Diploma"),
]

# ----------------------------------------------------------------------
# 1. DATA CLEANING
# ----------------------------------------------------------------------
def clean_resume_text(text: str) -> str:
    """
    Cleans unstructured resume or job description text:
    removes URLs, emails, special punctuation, bullet symbols, and redundant whitespace.
    """
    if not text:
        return ""
    cleaned = clean_unicode_and_limit(text, max_length=15000)
    # Remove URLs
    cleaned = re.sub(r"https?://\S+|www\.\S+", " ", cleaned)
    # Remove Email addresses
    cleaned = re.sub(r"\b[\w\.-]+@[\w\.-]+\.\w+\b", " ", cleaned)
    # Remove Phone numbers
    cleaned = re.sub(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", " ", cleaned)
    # Remove bullet symbols & special noise characters
    cleaned = re.sub(r"[•●▪◆★■\t\r\f\v]", " ", cleaned)
    cleaned = re.sub(r"[|/\\_~`^*+=<>{}()\[\]]", " ", cleaned)
    # Replace multiple spaces with single space
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


# ----------------------------------------------------------------------
# 2. DATA EXTRACTION
# ----------------------------------------------------------------------
def extract_contact_info(raw_text: str) -> dict[str, Any]:
    """Extracts candidate emails, phone numbers, and profile URLs."""
    if not raw_text:
        return {"email": None, "phone": None, "linkedin": None, "github": None}

    # Email extraction
    emails = re.findall(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b", raw_text)
    primary_email = emails[0] if emails else None

    # Phone extraction (international and 10-digit Indian formats)
    phones = re.findall(r"(?:\+?\d{1,3}[-.\s]?)?(?:(?:\d{10})|(?:\d{3}[-.\s]?\d{3}[-.\s]?\d{4}))", raw_text)
    valid_phones = [p.strip() for p in phones if len(re.sub(r"\D", "", p)) >= 10]
    primary_phone = valid_phones[0] if valid_phones else None

    # Social / Portfolio links
    linkedin_match = re.search(r"(?:https?://)?(?:www\.)?linkedin\.com/in/[\w\-]+", raw_text, re.IGNORECASE)
    github_match = re.search(r"(?:https?://)?(?:www\.)?github\.com/[\w\-]+", raw_text, re.IGNORECASE)

    return {
        "email": primary_email,
        "phone": primary_phone,
        "linkedin": linkedin_match.group(0) if linkedin_match else None,
        "github": github_match.group(0) if github_match else None,
    }


def extract_skills(text: str) -> dict[str, Any]:
    """Extracts and categorizes technical and soft skills from resume text."""
    if not text:
        return {"technical_skills": [], "soft_skills": [], "total_skills_count": 0}

    text_lower = f" {text.lower()} "
    # Pad punctuation for cleaner token boundaries
    padded_text = re.sub(r"[,;:\n\r\t/()\[\]]", " ", text_lower)
    padded_text = f" {padded_text} "

    found_tech: list[str] = []
    for skill in sorted(TECHNICAL_SKILLS, key=len, reverse=True):
        pattern = rf"(?:\b|\s){re.escape(skill)}(?:\b|\s)"
        if re.search(pattern, padded_text):
            canonical = skill.title()
            if canonical not in found_tech:
                found_tech.append(canonical)

    found_soft: list[str] = []
    for skill in sorted(SOFT_SKILLS, key=len, reverse=True):
        pattern = rf"(?:\b|\s){re.escape(skill)}(?:\b|\s)"
        if re.search(pattern, padded_text):
            canonical = skill.title()
            if canonical not in found_soft:
                found_soft.append(canonical)

    return {
        "technical_skills": found_tech,
        "soft_skills": found_soft,
        "total_skills_count": len(found_tech) + len(found_soft),
    }


def extract_experience(text: str) -> dict[str, Any]:
    """Extracts candidate experience years and detected job roles."""
    if not text:
        return {"total_years": 0.0, "detected_roles": [], "experience_text": None}

    # Experience year regex patterns (e.g., '3.5 years', '5+ yrs of experience')
    exp_patterns = [
        re.compile(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+of)?\s*(?:experience|exp)?", re.IGNORECASE),
        re.compile(r"(?:experience|exp):\s*(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)", re.IGNORECASE),
    ]

    max_years = 0.0
    matched_text = None
    for pattern in exp_patterns:
        for match in pattern.finditer(text):
            try:
                val = float(match.group(1))
                if 0.5 <= val <= 40 and val > max_years:
                    max_years = val
                    matched_text = match.group(0).strip()
            except ValueError:
                pass

    # Extract detected roles
    text_lower = text.lower()
    detected_roles = [role.title() for role in COMMON_JOB_ROLES if role in text_lower]

    return {
        "total_years": max_years,
        "detected_roles": detected_roles,
        "experience_text": matched_text,
    }


def extract_education(text: str) -> list[dict[str, str]]:
    """Extracts degree and academic qualifications."""
    if not text:
        return []

    found_degrees: list[dict[str, str]] = []
    seen = set()
    for pattern, degree_name in EDUCATION_DEGREES:
        match = pattern.search(text)
        if match and degree_name not in seen:
            seen.add(degree_name)
            # Find year if present near degree
            year_match = re.search(r"\b(19\d{2}|20\d{2})\b", text[max(0, match.start() - 30): match.end() + 50])
            found_degrees.append({
                "degree": degree_name,
                "matched_text": match.group(0),
                "year": year_match.group(0) if year_match else None,
            })
    return found_degrees


def extract_candidate_name(text: str) -> str | None:
    """Attempts to identify candidate name from header or initial lines."""
    if not text:
        return None
    lines = [line.strip() for line in text.strip().split("\n") if line.strip()]
    for line in lines[:5]:
        # If line contains 2-3 capitalized words and no email/phone/keywords
        if re.match(r"^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$", line):
            if not any(kw in line.lower() for kw in ["resume", "curriculum", "vitae", "summary", "profile", "contact"]):
                return line
    return None


def extract_resume_entities(raw_text: str) -> dict[str, Any]:
    """
    Unified extraction pipeline for Job Portal & Resume Screening:
    Extracts contact info, skills, education, experience, and candidate profile.
    """
    clean_text = clean_resume_text(raw_text)
    contacts = extract_contact_info(raw_text)
    skills = extract_skills(raw_text)
    exp = extract_experience(raw_text)
    edu = extract_education(raw_text)
    name = extract_candidate_name(raw_text)

    return {
        "candidate_name": name,
        "contact_info": contacts,
        "technical_skills": skills["technical_skills"],
        "soft_skills": skills["soft_skills"],
        "total_skills_count": skills["total_skills_count"],
        "experience_years": exp["total_years"],
        "detected_roles": exp["detected_roles"],
        "experience_text": exp["experience_text"],
        "education": edu,
        "cleaned_preview": clean_text[:300] + ("..." if len(clean_text) > 300 else ""),
    }


# ----------------------------------------------------------------------
# 3. SEMANTIC SIMILARITY (Pure-Python TF-IDF Cosine Similarity)
# ----------------------------------------------------------------------
def compute_cosine_similarity(text1: str, text2: str) -> float:
    """Computes TF-IDF cosine similarity between two texts."""
    words1 = [w.lower() for w in re.findall(r"\b[A-Za-z0-9+#.-]+\b", text1) if len(w) > 1]
    words2 = [w.lower() for w in re.findall(r"\b[A-Za-z0-9+#.-]+\b", text2) if len(w) > 1]

    if not words1 or not words2:
        return 0.0

    tf1 = Counter(words1)
    tf2 = Counter(words2)
    all_words = set(tf1.keys()).union(set(tf2.keys()))

    dot_product = sum(tf1[w] * tf2[w] for w in all_words)
    norm1 = math.sqrt(sum(count ** 2 for count in tf1.values()))
    norm2 = math.sqrt(sum(count ** 2 for count in tf2.values()))

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return round(dot_product / (norm1 * norm2), 4)


# ----------------------------------------------------------------------
# 4. RESUME SCREENING & JOB MATCHING ANALYSIS
# ----------------------------------------------------------------------
def analyze_resume_screening(
    resume_text: str,
    job_description: str = "",
    required_skills: list[str] | None = None,
    min_experience_years: float = 0.0,
    role_title: str | None = None,
) -> dict[str, Any]:
    """
    Performs full Resume Screening and Job Matching:
    - Extracts structured candidate details
    - Compares skills against Job Description requirements
    - Checks minimum experience threshold
    - Computes TF-IDF semantic similarity score
    - Outputs screening decision: SHORTLISTED, UNDER_REVIEW, or REJECTED
    """
    # 1. Extract Resume details
    candidate_profile = extract_resume_entities(resume_text)
    candidate_skills = [s.lower() for s in candidate_profile["technical_skills"] + candidate_profile["soft_skills"]]

    # 2. Determine target job requirements
    target_skills: list[str] = []
    if required_skills:
        target_skills = [s.strip().lower() for s in required_skills if s.strip()]
    elif job_description:
        jd_skills = extract_skills(job_description)
        target_skills = [s.lower() for s in jd_skills["technical_skills"] + jd_skills["soft_skills"]]

    # Extract target experience from JD if not explicitly provided
    target_exp = float(min_experience_years)
    if target_exp == 0.0 and job_description:
        jd_exp = extract_experience(job_description)
        target_exp = jd_exp["total_years"]

    # 3. Match Skills
    target_set = set(target_skills)
    cand_set = set(candidate_skills)

    matched_skills = sorted([s.title() for s in target_set.intersection(cand_set)])
    missing_skills = sorted([s.title() for s in target_set.difference(cand_set)])

    if target_set:
        skill_match_pct = round((len(matched_skills) / len(target_set)) * 100, 2)
    else:
        skill_match_pct = 100.0 if cand_set else 0.0

    # 4. Experience Match
    cand_exp = float(candidate_profile["experience_years"])
    exp_matched = cand_exp >= target_exp if target_exp > 0 else True

    # 5. Semantic Similarity
    semantic_score = compute_cosine_similarity(resume_text, job_description) if job_description else 1.0

    # 6. Overall Weighted Match Score
    # 50% Skill Match + 30% Semantic Similarity + 20% Experience Match
    exp_score = min(1.0, cand_exp / target_exp) if target_exp > 0 else 1.0
    overall_score = round(
        (0.50 * skill_match_pct) + (0.30 * (semantic_score * 100)) + (0.20 * (exp_score * 100)),
        2,
    )
    overall_score = min(100.0, max(0.0, overall_score))

    # 7. Decision Classification (matches Job Portal Screening Standards)
    if overall_score >= 70.0 and (not target_exp or exp_matched):
        decision = "SHORTLISTED"
        badge_color = "#10B981"  # Emerald
    elif overall_score >= 45.0:
        decision = "UNDER_REVIEW"
        badge_color = "#F59E0B"  # Amber
    else:
        decision = "REJECTED"
        badge_color = "#EF4444"  # Rose

    # 8. Human-Readable Verdict
    cand_name = candidate_profile["candidate_name"] or "Candidate"
    verdict = (
        f"{cand_name} scored {overall_score}% match for role '{role_title or 'Target Job'}'. "
        f"Status: {decision}. Matched {len(matched_skills)}/{len(target_set)} skills. "
    )
    if missing_skills:
        verdict += f"Missing key skills: {', '.join(missing_skills[:5])}. "
    if target_exp > 0:
        verdict += f"Experience: {cand_exp} yrs (Required: {target_exp} yrs)."

    return {
        "screening_decision": decision,
        "badge_color": badge_color,
        "overall_match_score": overall_score,
        "skill_match_percentage": skill_match_pct,
        "semantic_similarity_score": semantic_score,
        "experience_matched": exp_matched,
        "candidate_experience_years": cand_exp,
        "required_experience_years": target_exp,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "candidate_profile": candidate_profile,
        "verdict_summary": verdict,
    }
