const axios = require("axios");

const PYTHON_NLP_URL = process.env.PYTHON_NLP_URL || "http://127.0.0.1:8001";

/**
 * Call Python NLP microservice for text preprocessing, NLTK tokenization,
 * entity extraction, and intent matching.
 */
async function processQuestionWithNLP({ question, projectCode = null, candidates = [], extraStatuses = [] }) {
  try {
    const response = await axios.post(
      `${PYTHON_NLP_URL}/api/nlp/process`,
      {
        question,
        project_code: projectCode,
        candidates,
        extra_statuses: extraStatuses,
      },
      { timeout: Number(process.env.NLP_TIMEOUT_MS || 12000) }
    );
    return response.data;
  } catch (err) {
    console.error("❌ Python NLP service error:", err.message);
    // Fallback lightweight regex tokenization if Python is offline
    const tokens = question.toLowerCase().split(/\s+/).filter(Boolean);
    return {
      original_question: question,
      normalized_text: question.toLowerCase(),
      tokens,
      filtered_tokens: tokens,
      lemmas: tokens,
      pos_tags: [],
      keywords: tokens,
      topic_keywords: [],
      noun_phrases: [],
      entities: {},
      detected_intent: null,
      confidence: 0,
      endpoint_id: null,
      all_scores: {},
    };
  }
}

/**
 * Clean resume/job description text using Python NLP
 */
async function cleanResumeWithNLP(text) {
  try {
    const response = await axios.post(`${PYTHON_NLP_URL}/api/nlp/resume/clean`, { text }, { timeout: 8000 });
    return response.data;
  } catch (err) {
    return {
      status: "fallback",
      cleaned_text: text.replace(/\s+/g, " ").trim(),
      error: err.message,
    };
  }
}

/**
 * Extract structured resume entities (skills, education, experience, contact)
 */
async function extractResumeWithNLP(resume_text) {
  try {
    const response = await axios.post(`${PYTHON_NLP_URL}/api/nlp/resume/extract`, { resume_text }, { timeout: 8000 });
    return response.data;
  } catch (err) {
    return {
      status: "error",
      error: err.message,
    };
  }
}

/**
 * Perform automated resume screening and job description matching
 */
async function analyzeResumeWithNLP(payload) {
  try {
    const response = await axios.post(`${PYTHON_NLP_URL}/api/nlp/resume/analyze`, payload, { timeout: 8000 });
    return response.data;
  } catch (err) {
    return {
      status: "error",
      error: err.message,
    };
  }
}

module.exports = {
  processQuestionWithNLP,
  cleanResumeWithNLP,
  extractResumeWithNLP,
  analyzeResumeWithNLP,
};

