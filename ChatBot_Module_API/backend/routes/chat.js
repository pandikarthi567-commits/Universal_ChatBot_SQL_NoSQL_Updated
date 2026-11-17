const express = require("express");
const Project = require("../models/Project");
const ChatMessage = require("../models/ChatMessage");
const Conversation = require("../models/Conversation");
const { authenticateToken, requireAdmin, optionalAuth } = require("../middleware/auth");
const { processUserQuestion, buildResponseContract } = require("../services/decisionEngine");
const { processQuestionWithNLP } = require("../services/nlpService");
const { completeExternalExecution, confirmPendingAction } = require("../services/integrationService");
const { clearConversationSession } = require("../services/contextService");

const router = express.Router();

/**
 * POST /api/chat/ask
 * Main conversational endpoint for Universal Chatbot.
 * Orchestrates NLP, grounded knowledge, approved API execution, and multi-turn context.
 */
const universal = require("../universal/routes");
router.post("/ask", authenticateToken, universal.throttle, universal.ask);

/**
 * POST /api/chat/analyze
 * Returns detailed NLP breakdown, language detection, entities, intent candidates,
 * and planned execution mode without triggering live API execution.
 */
router.post("/analyze", requireAdmin, async (req, res) => {
  try {
    const { question, project_id, project_code } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ detail: "question is required" });
    }

    let resolvedCode = project_code;
    let resolvedProjectId = project_id || req.query.project_id;

    if (!resolvedCode && resolvedProjectId) {
      const p = await Project.findOne({ id: Number(resolvedProjectId) });
      if (p) resolvedCode = p.project_code;
    } else if (!resolvedCode) {
      const first = await Project.findOne({ is_active: true });
      if (first) {
        resolvedCode = first.project_code;
        resolvedProjectId = first.id;
      }
    }

    const Intent = require("../models/Intent");
    const Endpoint = require("../models/Endpoint");

    const intents = resolvedProjectId
      ? await Intent.find({ project_id: Number(resolvedProjectId), is_active: true })
      : [];
    const endpoints = resolvedProjectId
      ? await Endpoint.find({ project_id: Number(resolvedProjectId), is_active: true })
      : [];

    const candidates = intents.map((it) => ({
      intent_name: it.intent_name,
      keywords: it.keywords || [],
      sample_utterances: it.sample_utterances || [],
      endpoint_id: it.endpoint_id,
    }));

    const nlpResult = await processQuestionWithNLP({
      question: question.trim(),
      projectCode: resolvedCode,
      candidates,
    });

    let targetEndpoint = null;
    if (nlpResult.detected_intent) {
      const matched = intents.find((it) => it.intent_name === nlpResult.detected_intent);
      if (matched && matched.endpoint_id) {
        targetEndpoint = endpoints.find((ep) => ep.id === matched.endpoint_id);
      }
    }

    const isPostAction = /\b(submit|create|add|save|insert|post|apply|confirm)\b/i.test(question);
    const confidenceLevel =
      (nlpResult.confidence || 0) >= 0.8 ? "HIGH" : (nlpResult.confidence || 0) >= 0.4 ? "MEDIUM" : "LOW";

    res.json({
      original_question: nlpResult.original_question || question,
      normalized_text: nlpResult.normalized_text,
      language_hint: nlpResult.language_hint || "en",
      tokens: nlpResult.tokens,
      filtered_tokens: nlpResult.filtered_tokens,
      lemmas: nlpResult.lemmas,
      pos_tags: nlpResult.pos_tags,
      keywords: nlpResult.keywords,
      noun_phrases: nlpResult.noun_phrases,
      intent: nlpResult.detected_intent,
      confidence: nlpResult.confidence,
      entities: nlpResult.entities || {},
      planned_endpoint_name: targetEndpoint ? targetEndpoint.name : null,
      planned_endpoint_path: targetEndpoint ? targetEndpoint.path : null,
      planned_http_method: targetEndpoint ? targetEndpoint.http_method : (isPostAction ? "POST" : "GET"),
      nlp_pipeline: {
        cleaning: {
          raw_text: question,
          cleaned_text: nlpResult.normalized_text,
          word_count: (nlpResult.tokens || []).length,
          character_count: question.length,
        },
        extraction: {
          entities_count: Object.keys(nlpResult.entities || {}).length,
          entities: nlpResult.entities || {},
          keywords_count: (nlpResult.keywords || []).length,
          keywords: nlpResult.keywords || [],
          noun_phrases: nlpResult.noun_phrases || [],
        },
        analysis: {
          detected_intent: nlpResult.detected_intent,
          confidence: nlpResult.confidence,
          confidence_level: confidenceLevel,
          action_type: isPostAction ? "POST_SUBMISSION" : "GET_QUERY",
        },
      },
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

/**
 * POST /api/chat/complete
 * Mode C (External Execution Mode) completion endpoint.
 * Called by external software applications with the result of business logic execution.
 */
router.post("/complete", authenticateToken, (req,res)=>res.status(403).json({detail:"Universal chatbot is read-only"}));

/**
 * POST /api/chat/confirm
 * Action Confirmation endpoint.
 * Confirms or cancels a pending mutating action identified by correlation_id.
 */
router.post("/confirm", authenticateToken, (req,res)=>res.status(403).json({detail:"Universal chatbot is read-only"}));

/**
 * GET /api/chat/history
 * List chat history with project and session filters.
 */
router.get("/history", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const offset = Number(req.query.offset) || 0;
    const filter = {};

    if (req.query.role) filter.role = req.query.role;
    if (req.query.session_id) filter.session_id = req.query.session_id;
    if (req.query.project_id) filter.project_id = Number(req.query.project_id);
    if (req.query.project_code) filter.project_code = req.query.project_code.toUpperCase();

    const total = await ChatMessage.countDocuments(filter);
    const items = await ChatMessage.find(filter)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit);

    const mapped = items.map((m) => ({
      id: m.id,
      session_id: m.session_id,
      project_id: m.project_id,
      project_name: m.project_name,
      project_code: m.project_code,
      role: m.role,
      question: m.question || m.content,
      answer: m.answer || m.content,
      intent: m.detected_intent,
      confidence: m.confidence,
      response_type: m.response_type,
      source: m.source,
      status: m.status,
      correlation_id: m.correlation_id,
      endpoint_called: m.endpoint_called,
      endpoint_path: m.endpoint_path,
      created_at: m.created_at,
    }));

    res.json({
      total,
      limit,
      offset,
      items: mapped,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

/**
 * GET /api/chat/history/:sessionId
 * Get all messages for a specific session.
 */
router.get("/history/:sessionId", requireAdmin, async (req, res) => {
  try {
    const messages = await ChatMessage.find({ session_id: req.params.sessionId })
      .sort({ created_at: 1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

/**
 * DELETE /api/chat/session
 * Clear session context and history
 */
router.delete("/session", requireAdmin, async (req, res) => {
  try {
    const sessionId = req.query.session_id || req.body?.session_id;
    const projectId = req.query.project_id || req.body?.project_id;

    if (!sessionId) {
      return res.status(400).json({ detail: "session_id is required" });
    }

    if (projectId) {
      await clearConversationSession(sessionId, projectId);
    } else {
      await Conversation.deleteMany({ session_id: sessionId });
    }
    await ChatMessage.deleteMany({ session_id: sessionId });

    res.json({ success: true, message: `Session '${sessionId}' cleared successfully.` });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.delete("/history/:sessionId", requireAdmin, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    await ChatMessage.deleteMany({ session_id: sessionId });
    await Conversation.deleteMany({ session_id: sessionId });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.post("/clear", requireAdmin, async (req, res) => {
  try {
    const result = await ChatMessage.deleteMany({});
    await Conversation.deleteMany({});
    res.json({
      success: true,
      deleted_messages: result.deletedCount,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
