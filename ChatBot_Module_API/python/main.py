"""
Universal NLP Chatbot Microservice
Stateless FastAPI service exclusively for NLTK/ML text processing, entity extraction, and intent matching.
Runs on Port 8001.
Zero database connection (NLP-ONLY).
ZERO domain-specific words.
"""
import base64
from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path
import re
import tempfile
from typing import Any
import httpx
import uvicorn
import yaml
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from analyzer.static_analyzer import (
    analyze_project_directory,
    extract_zip_safely,
    parse_markdown_docs,
    parse_openapi_spec,
)
from nlp.answer_composer import as_list, compose_answer
from nlp.entity_extractor import extract_entities
from nlp.intent_detector import IntentCandidate, detect_intent
from nlp.keyword_extractor import extract_keywords_and_phrases
from nlp.nltk_setup import ensure_nltk_resources
from nlp.preprocessing import (
    clean_unicode_and_limit,
    detect_language_hint,
    preprocess_text,
)
from nlp.profile_loader import (
    invalidate_profile_cache,
    load_profile,
    upsert_profile,
)
from nlp.profile_models import ProjectProfile
from nlp.tokenizer import tokenize_and_lemmatize

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("python_nlp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Universal NLP Microservice on Port 8001 (Zero DB)...")
    ensure_nltk_resources(download_missing=True)
    logger.info("NLTK resources verified. NLP ready.")
    yield
    logger.info("Shutting down Universal NLP Microservice.")


app = FastAPI(
    title="Universal Chatbot - Python NLP Microservice (Port 8001)",
    docs_url=None,
    redoc_url=None,
    version="2.1.0",
    lifespan=lifespan,
)


@app.get("/docs", include_in_schema=False)
@app.get("/docs/", include_in_schema=False)
@app.get("/swagger", include_in_schema=False)
@app.get("/", include_in_schema=False)
def redirect_to_main_swagger():
    return RedirectResponse(url="http://localhost:8000/docs/")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CandidateIntentModel(BaseModel):
    intent_name: str
    keywords: list[str] = Field(default_factory=list)
    sample_utterances: list[str] = Field(default_factory=list)
    endpoint_id: int | None = None
    endpoint_name: str | None = None


class NLPProcessRequest(BaseModel):
    question: str
    project_code: str | None = None
    candidates: list[CandidateIntentModel] = Field(default_factory=list)
    extra_statuses: list[str] = Field(default_factory=list)


class NLPProcessResponse(BaseModel):
    original_question: str
    normalized_text: str
    tokens: list[str]
    filtered_tokens: list[str]
    lemmas: list[str]
    pos_tags: list[list[str]]
    keywords: list[str]
    topic_keywords: list[str]
    noun_phrases: list[str]
    entities: dict[str, Any]
    detected_intent: str | None = None
    confidence: float = 0.0
    endpoint_id: int | None = None
    all_scores: dict[str, float] = Field(default_factory=dict)
    # Extended fields
    alternatives: list[dict[str, Any]] = Field(default_factory=list)
    matched_by: str = "classifier"
    normalized_question: str = ""
    language_hint: str = "en"


class AnalyzeRequest(BaseModel):
    question: str
    project_code: str | None = None


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "Universal NLP Microservice",
        "port": 8001,
        "database": "None (Stateless NLP Engine)",
    }


# ----------------------------------------------------------------------
# Admin Profile Endpoints
# ----------------------------------------------------------------------
@app.get("/admin/profile/{project}")
def get_project_profile(project: str):
    ctx = load_profile(project)
    return ctx.profile.model_dump()


@app.put("/admin/profile/{project}")
def put_project_profile(project: str, profile_data: dict[str, Any]):
    profile_data["project_code"] = project.upper()
    saved = upsert_profile(profile_data)
    return {
        "status": "success",
        "message": f"Profile for '{project.upper()}' updated and intent model retrained successfully.",
        "profile": saved.model_dump(),
    }


# ----------------------------------------------------------------------
# NLP Processing Endpoints
# ----------------------------------------------------------------------
@app.post("/api/nlp/process", response_model=NLPProcessResponse)
def process_nlp(payload: NLPProcessRequest) -> NLPProcessResponse:
    ctx = load_profile(payload.project_code)
    profile = ctx.profile

    cleaned = clean_unicode_and_limit(payload.question)
    lang_hint = detect_language_hint(cleaned, profile.language_hints)

    normalized = preprocess_text(
        cleaned,
        lexicon=profile.normalization_lexicon,
        symspell=ctx.symspell,
        vocabulary=ctx.vocabulary,
    )

    tok = tokenize_and_lemmatize(normalized)
    kw = extract_keywords_and_phrases(
        pos_tags=tok.pos_tags,
        filtered_tokens=tok.filtered_tokens,
        lemmas=tok.lemmas,
    )

    entities = extract_entities(
        original_question=cleaned,
        normalized_text=normalized,
        profile=profile,
        extra_statuses=set(payload.extra_statuses) if payload.extra_statuses else None,
    )

    cand_objs = None
    if payload.candidates:
        cand_objs = [
            IntentCandidate(
                intent_name=c.intent_name,
                endpoint_id=c.endpoint_id,
                endpoint_name=c.endpoint_name,
                keywords=c.keywords,
                phrases=c.sample_utterances,
            )
            for c in payload.candidates
        ]

    match = detect_intent(
        normalized_question=normalized,
        raw_question=cleaned,
        entities=entities,
        profile=profile,
        intent_model=ctx.intent_model,
        candidates=cand_objs,
    )

    detected_intent_name = match.intent_name
    confidence = match.confidence
    scores = match.all_scores
    matched_by = match.matched_by
    alternatives = match.alternatives
    endpoint_id = match.endpoint_id

    return NLPProcessResponse(
        original_question=cleaned,
        normalized_text=normalized,
        tokens=tok.tokens,
        filtered_tokens=tok.filtered_tokens,
        lemmas=tok.lemmas,
        pos_tags=[[p[0], p[1]] for p in tok.pos_tags],
        keywords=kw.keywords,
        topic_keywords=kw.topic_keywords,
        noun_phrases=kw.noun_phrases,
        entities=entities,
        detected_intent=detected_intent_name,
        confidence=confidence,
        endpoint_id=endpoint_id,
        all_scores=scores,
        alternatives=alternatives,
        matched_by=matched_by,
        normalized_question=normalized,
        language_hint=lang_hint,
    )


@app.post("/api/nlp/analyze")
@app.post("/api/chat/analyze")
def analyze_endpoint(payload: AnalyzeRequest, project: str | None = Query(default=None)):
    code = payload.project_code or project
    ctx = load_profile(code)
    profile = ctx.profile

    cleaned = clean_unicode_and_limit(payload.question)
    lang_hint = detect_language_hint(cleaned, profile.language_hints)

    normalized = preprocess_text(
        cleaned,
        lexicon=profile.normalization_lexicon,
        symspell=ctx.symspell,
        vocabulary=ctx.vocabulary,
    )

    tok = tokenize_and_lemmatize(normalized)
    kw = extract_keywords_and_phrases(
        pos_tags=tok.pos_tags,
        filtered_tokens=tok.filtered_tokens,
        lemmas=tok.lemmas,
    )

    entities = extract_entities(
        original_question=cleaned,
        normalized_text=normalized,
        profile=profile,
    )

    match = detect_intent(
        normalized_question=normalized,
        raw_question=cleaned,
        entities=entities,
        profile=profile,
        intent_model=ctx.intent_model,
    )

    is_post = bool(re.search(r"\b(?:submit|create|add|save|insert|post|apply)\b", normalized))

    return {
        "original_question": cleaned,
        "normalized_text": normalized,
        "normalized_question": normalized,
        "language_hint": lang_hint,
        "tokens": tok.tokens,
        "filtered_tokens": tok.filtered_tokens,
        "lemmas": tok.lemmas,
        "pos_tags": [[p[0], p[1]] for p in tok.pos_tags],
        "keywords": kw.keywords,
        "noun_phrases": kw.noun_phrases,
        "entities": entities,
        "entity_lists": {k: as_list(v) for k, v in entities.items()},
        "intent": match.intent_name,
        "confidence": match.confidence,
        "matched_by": match.matched_by,
        "alternatives": match.alternatives,
        "nlp_pipeline": {
            "cleaning": {
                "raw_text": payload.question,
                "cleaned_text": normalized,
                "word_count": len(tok.tokens),
                "character_count": len(payload.question),
            },
            "extraction": {
                "entities_count": len(entities),
                "entities": entities,
                "keywords_count": len(kw.keywords),
                "keywords": kw.keywords,
                "noun_phrases": kw.noun_phrases,
            },
            "analysis": {
                "action_type": "POST_SUBMISSION" if is_post else "GET_QUERY",
                "detected_intent": match.intent_name,
                "confidence": match.confidence,
                "matched_by": match.matched_by,
            },
        },
    }


class ComposeRequest(BaseModel):
    question: str
    project_code: str | None = None
    entity_key: str = "Category"
    # Data fetched by your backend, keyed by category name, e.g.
    # {"Marine": {"coverage": "...", "premium": "..."}, "Locker": {...}}
    details: dict[str, dict[str, Any]] = Field(default_factory=dict)


@app.post("/api/nlp/compose")
def compose_endpoint(payload: ComposeRequest, project: str | None = Query(default=None)):
    """Analyze the question, then build an LLM-style comparison matrix for ALL detected categories."""
    ctx = load_profile(payload.project_code or project)
    profile = ctx.profile

    cleaned = clean_unicode_and_limit(payload.question)
    normalized = preprocess_text(
        cleaned,
        lexicon=profile.normalization_lexicon,
        symspell=ctx.symspell,
        vocabulary=ctx.vocabulary,
    )
    entities = extract_entities(original_question=cleaned, normalized_text=normalized, profile=profile)
    match = detect_intent(
        normalized_question=normalized,
        raw_question=cleaned,
        entities=entities,
        profile=profile,
        intent_model=ctx.intent_model,
    )
    result = compose_answer(cleaned, match.intent_name, entities, payload.details, payload.entity_key)
    result.update(
        {
            "confidence": match.confidence,
            "matched_by": match.matched_by,
            "entities": entities,
            "entity_lists": {k: as_list(v) for k, v in entities.items()},
        }
    )
    return result


# ----------------------------------------------------------------------
# Job Portal & Resume Screening NLP Endpoints
# ----------------------------------------------------------------------
class ResumeCleanRequest(BaseModel):
    text: str


class ResumeExtractRequest(BaseModel):
    resume_text: str


class ResumeAnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str = ""
    required_skills: list[str] = Field(default_factory=list)
    min_experience_years: float = 0.0
    role_title: str | None = None


@app.post("/api/nlp/resume/clean")
def clean_resume_endpoint(payload: ResumeCleanRequest):
    from nlp.resume_analyzer import clean_resume_text
    cleaned = clean_resume_text(payload.text)
    return {
        "status": "success",
        "original_length": len(payload.text),
        "cleaned_length": len(cleaned),
        "cleaned_text": cleaned,
    }


@app.post("/api/nlp/resume/extract")
def extract_resume_endpoint(payload: ResumeExtractRequest):
    from nlp.resume_analyzer import extract_resume_entities
    extracted = extract_resume_entities(payload.resume_text)
    return {
        "status": "success",
        "data": extracted,
    }


@app.post("/api/nlp/resume/analyze")
def analyze_resume_endpoint(payload: ResumeAnalyzeRequest):
    from nlp.resume_analyzer import analyze_resume_screening
    analysis = analyze_resume_screening(
        resume_text=payload.resume_text,
        job_description=payload.job_description,
        required_skills=payload.required_skills,
        min_experience_years=payload.min_experience_years,
        role_title=payload.role_title,
    )
    return {
        "status": "success",
        "data": analysis,
    }


# ----------------------------------------------------------------------
# Automatic Static Project Analyzer Endpoints
# ----------------------------------------------------------------------
class ZipAnalyzeRequest(BaseModel):
    zip_base64: str
    project_name: str | None = None


class SpecAnalyzeRequest(BaseModel):
    spec_content: str
    format: str = "json"


class DocsAnalyzeRequest(BaseModel):
    docs_text: str
    filename: str = "README.md"


class BaseUrlProbeRequest(BaseModel):
    base_url: str
    health_path: str | None = None


@app.post("/api/analyzer/analyze-zip")
def analyze_zip_endpoint(payload: ZipAnalyzeRequest):
    try:
        zip_bytes = base64.b64decode(payload.zip_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 zip payload: {e}")

    with tempfile.TemporaryDirectory() as temp_dir:
        target_dir = Path(temp_dir)
        try:
            extract_zip_safely(zip_bytes, target_dir)
            analysis = analyze_project_directory(target_dir)
            return {
                "success": True,
                "project_name": payload.project_name,
                "analysis": analysis,
            }
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as ex:
            logger.error("ZIP analysis error: %s", ex, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Static analysis failed: {str(ex)}")


@app.post("/api/analyzer/analyze-spec")
def analyze_spec_endpoint(payload: SpecAnalyzeRequest):
    try:
        content = payload.spec_content.strip()
        if payload.format.lower() in ("yaml", "yml") or content.startswith("openapi:") or content.startswith("swagger:"):
            spec_dict = yaml.safe_load(content)
        else:
            spec_dict = json.loads(content)

        parsed = parse_openapi_spec(spec_dict)
        return {
            "success": True,
            "analysis": parsed,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse OpenAPI/Swagger specification: {str(e)}")


@app.post("/api/analyzer/analyze-docs")
def analyze_docs_endpoint(payload: DocsAnalyzeRequest):
    try:
        chunks = parse_markdown_docs(payload.docs_text, payload.filename)
        return {
            "success": True,
            "chunks": chunks,
            "count": len(chunks),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Documentation analysis failed: {str(e)}")


@app.post("/api/analyzer/probe-url")
def probe_url_endpoint(payload: BaseUrlProbeRequest):
    base_url = payload.base_url.rstrip("/")
    probe_results = {
        "base_url": base_url,
        "is_reachable": False,
        "health_status": None,
        "discovered_spec": None,
    }

    test_paths = [
        payload.health_path or "/health",
        "/api/health",
        "/healthz",
        "/swagger.json",
        "/openapi.json",
        "/api-docs",
    ]

    with httpx.Client(timeout=4.0) as client:
        for path in test_paths:
            url = f"{base_url}{path}"
            try:
                r = client.get(url)
                if r.status_code < 400:
                    probe_results["is_reachable"] = True
                    if "health" in path:
                        probe_results["health_status"] = {"status_code": r.status_code, "path": path}
                    if "json" in path or "openapi" in path:
                        try:
                            spec = r.json()
                            if isinstance(spec, dict) and ("openapi" in spec or "swagger" in spec):
                                probe_results["discovered_spec"] = parse_openapi_spec(spec)
                        except Exception:
                            pass
            except Exception:
                pass

    return {
        "success": True,
        "probe": probe_results,
    }


def main():
    port = int(os.environ.get("PORT", 8001))
    print("=" * 60)
    print("  Universal NLP Chatbot Microservice (Data-Driven Profile Engine)")
    print(f"  Port        : http://localhost:{port}")
    print(f"  Health Check: http://localhost:{port}/health")
    print("  Database    : None (Stateless NLP)")
    print("=" * 60)
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)


if __name__ == "__main__":
    main()
