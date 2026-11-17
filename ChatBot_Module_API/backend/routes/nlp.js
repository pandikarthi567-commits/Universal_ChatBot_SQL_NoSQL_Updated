const express = require("express");
const { optionalAuth } = require("../middleware/auth");
const {
  processQuestionWithNLP,
  cleanResumeWithNLP,
  extractResumeWithNLP,
  analyzeResumeWithNLP,
} = require("../services/nlpService");

const router = express.Router();

/**
 * POST /api/nlp/resume/clean
 * Cleans unstructured resume or job text (removes URLs, emails, phone numbers, noise characters)
 */
router.post("/resume/clean", optionalAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ detail: "text field is required for cleaning" });
    }
    const result = await cleanResumeWithNLP(text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

/**
 * POST /api/nlp/resume/extract
 * Extracts structured entities: contact info, skills, education, experience, candidate name
 */
router.post("/resume/extract", optionalAuth, async (req, res) => {
  try {
    const { resume_text } = req.body;
    if (!resume_text) {
      return res.status(400).json({ detail: "resume_text field is required for extraction" });
    }
    const result = await extractResumeWithNLP(resume_text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

/**
 * POST /api/nlp/resume/analyze
 * Performs automated Resume Screening & Job Matching:
 * - Calculates Skill Match % (matched vs missing skills)
 * - Checks Experience Qualification against job requirement
 * - Computes TF-IDF Semantic Cosine Similarity
 * - Outputs Screening Decision: SHORTLISTED, UNDER_REVIEW, or REJECTED
 */
router.post("/resume/analyze", optionalAuth, async (req, res) => {
  try {
    const {
      resume_text,
      job_description = "",
      required_skills = [],
      min_experience_years = 0,
      role_title = null,
    } = req.body;

    if (!resume_text) {
      return res.status(400).json({ detail: "resume_text is required for screening analysis" });
    }

    const result = await analyzeResumeWithNLP({
      resume_text,
      job_description,
      required_skills,
      min_experience_years,
      role_title,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

/**
 * POST /api/nlp/process
 * General text processing and entity extraction
 */
router.post("/process", optionalAuth, async (req, res) => {
  try {
    const { question, candidates = [], extra_statuses = [] } = req.body;
    if (!question) {
      return res.status(400).json({ detail: "question is required" });
    }
    const result = await processQuestionWithNLP({
      question,
      candidates,
      extraStatuses: extra_statuses,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
