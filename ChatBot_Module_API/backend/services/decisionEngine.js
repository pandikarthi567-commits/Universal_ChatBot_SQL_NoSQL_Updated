const crypto = require("crypto");
const Project = require("../models/Project");
const Endpoint = require("../models/Endpoint");
const Intent = require("../models/Intent");
const PendingAction = require("../models/PendingAction");
const ChatMessage = require("../models/ChatMessage");
const { getNextSequence } = require("../models/Counter");
const { processQuestionWithNLP } = require("./nlpService");
const { searchProjectKnowledge } = require("./knowledgeService");
const { executeProjectEndpoint } = require("./secureApiExecutor");
const {
  getOrCreateConversation,
  resolveConversationReferences,
  updateConversationContext,
} = require("./contextService");
const {
  composeLiveApiResponse,
  composeKnowledgeResponse,
  composeClarificationResponse,
  composeConfirmationPrompt,
  composeGreeting,
  composeOutOfScopeResponse,
  synthesizeWithOptionalLLM,
} = require("./answerService");

/**
 * Intelligent Universal Chatbot Decision Engine
 */
async function processUserQuestion({
  projectId,
  sessionId,
  question,
  userId = null,
  userRoles = ["user"],
  formData = {},
}) {
  const project = await Project.findOne({ id: Number(projectId), is_active: true });
  if (!project) throw new Error(`Active project with ID ${projectId} not found.`);

  // 1. Retrieve Conversation Context & History
  const conversation = await getOrCreateConversation({
    sessionId,
    projectId: project.id,
    userId,
  });
  const context = conversation.context || {};

  // 2. Load Active Intents and Approved Endpoints
  const intents = await Intent.find({ project_id: project.id, is_active: true });
  const approvedEndpoints = await Endpoint.find({
    project_id: project.id,
    is_active: true,
    is_approved: true,
  });

  const candidates = intents.map((it) => ({
    intent_name: it.intent_name,
    keywords: it.keywords || [],
    sample_utterances: it.sample_utterances || [],
    endpoint_id: it.endpoint_id,
  }));

  // 3. Step 1: Call Universal Python NLP Engine
  const nlpResult = await processQuestionWithNLP({
    question,
    projectCode: project.project_code,
    candidates,
  });

  let rawEntities = nlpResult.entities || {};
  let detectedIntent = nlpResult.detected_intent;
  let confidence = typeof nlpResult.confidence === "number" ? nlpResult.confidence : 0.0;

  // 4. Step 2: Conversational Reference Resolution (e.g. "its price" -> ItemName from previous turn)
  const resolvedEntities = resolveConversationReferences({
    question,
    entities: rawEntities,
    context,
  });

  // Check if user is answering a previous pending clarification
  if (context.pending_parameters && Object.keys(context.pending_parameters).length > 0) {
    const missingKeys = Object.keys(context.pending_parameters);
    const firstMissing = missingKeys[0];
    if (!resolvedEntities[firstMissing]) {
      // Use the cleaned text as the parameter value
      resolvedEntities[firstMissing] = nlpResult.normalized_text || question.trim();
    }
    if (context.target_intent_name) {
      detectedIntent = context.target_intent_name;
      confidence = Math.max(confidence, 0.75);
    }
  }

  // Generate a correlation ID
  const correlationId = crypto.randomUUID();

  // 5. Decision Flow
  let responseType = "OUT_OF_SCOPE";
  let answer = "";
  let finalData = null;
  let source = "grounded_engine";
  let requiresClarification = false;
  let requiresConfirmation = false;
  let suggestedQuestions = [];
  let targetEndpoint = null;
  let matchedIntent = null;

  // A. Greeting / Small Talk
  if (detectedIntent && detectedIntent.toLowerCase() === "greeting") {
    responseType = "DIRECT_ANSWER";
    source = "grounded_engine";
    answer = composeGreeting({ projectName: project.name });
    suggestedQuestions = intents
      .filter((i) => i.sample_utterances && i.sample_utterances.length > 0 && i.intent_name.toLowerCase() !== "greeting")
      .slice(0, 3)
      .map((i) => i.sample_utterances[0]);
  }

  // B. Knowledge Base Retrieval (Grounding & FAQs)
  let knowledgeMatches = [];
  if (responseType === "OUT_OF_SCOPE") {
    knowledgeMatches = await searchProjectKnowledge({
      projectId: project.id,
      query: question,
      limit: 3,
      minScore: 0.35,
    });
  }

  // If question is clearly knowledge-related or project is in Mode A (Knowledge Mode)
  if (
    responseType === "OUT_OF_SCOPE" &&
    (project.integration_mode === "MODE_A_KNOWLEDGE" ||
      (knowledgeMatches.length > 0 && (!detectedIntent || confidence < 0.60)))
  ) {
    if (knowledgeMatches.length > 0) {
      responseType = "KNOWLEDGE_ANSWER";
      source = "knowledge_base";
      answer = composeKnowledgeResponse({
        projectName: project.name,
        knowledgeChunks: knowledgeMatches,
      });
      finalData = knowledgeMatches;
    }
  }

  // C. Intent & Endpoint Execution (Mode B or Mode C)
  if (responseType === "OUT_OF_SCOPE" && detectedIntent && detectedIntent !== "Unknown") {
    matchedIntent = intents.find((it) => it.intent_name === detectedIntent);
    if (matchedIntent) {
      // Find matching approved endpoint
      if (matchedIntent.endpoint_id) {
        targetEndpoint = approvedEndpoints.find((ep) => ep.id === matchedIntent.endpoint_id);
      } else {
        // Match by operation_id or path
        targetEndpoint = approvedEndpoints.find(
          (ep) =>
            ep.operation_id === matchedIntent.operation_id ||
            ep.name.toLowerCase() === matchedIntent.intent_name.toLowerCase()
        );
      }
    }
  }

  // Handle Intent execution if matched
  if (responseType === "OUT_OF_SCOPE" && targetEndpoint) {
    // 1. Check Missing Parameters
    const expectedParams = targetEndpoint.expected_params || [];
    const missingParams = [];
    for (const p of expectedParams) {
      if (p.required) {
        const pName = p.name || p.param_name;
        const val = formData[pName] || resolvedEntities[pName];
        if (val === undefined || val === null || val === "") {
          missingParams.push(pName);
        }
      }
    }

    if (missingParams.length > 0) {
      responseType = "CLARIFICATION_REQUIRED";
      requiresClarification = true;
      source = "grounded_engine";
      answer = composeClarificationResponse({
        missingParameters: missingParams,
        intent: matchedIntent,
      });

      // Update pending parameters in context
      const pendingObj = {};
      missingParams.forEach((mp) => (pendingObj[mp] = true));
      await updateConversationContext({
        sessionId,
        projectId: project.id,
        intent: detectedIntent,
        entities: resolvedEntities,
        pendingParams: pendingObj,
        targetEndpointId: targetEndpoint.id,
        targetIntentName: detectedIntent,
        clarificationPrompt: answer,
      });

      return buildResponseContract({
        success: true,
        answer,
        response_type: responseType,
        intent: detectedIntent,
        entities: resolvedEntities,
        confidence,
        data: null,
        source,
        session_id: sessionId,
        correlation_id: null,
        requires_clarification: true,
        requires_confirmation: false,
        suggested_questions: [],
        error: null,
      });
    }

    // 2. Check Action Confirmation (Mutating Actions: POST, PUT, DELETE)
    const isMutatingAction =
      targetEndpoint.is_mutating ||
      ["POST", "PUT", "DELETE", "PATCH"].includes(targetEndpoint.http_method);

    if (isMutatingAction && project.require_action_confirmation) {
      responseType = "ACTION_CONFIRMATION";
      requiresConfirmation = true;
      source = "grounded_engine";

      // Create PendingAction record
      const actionId = await getNextSequence("pending_action");
      await PendingAction.create({
        id: actionId,
        correlation_id: correlationId,
        session_id: sessionId,
        project_id: project.id,
        user_id: userId,
        action_type: "MUTATING_EXECUTION",
        operation: matchedIntent?.intent_name || targetEndpoint.name,
        endpoint_id: targetEndpoint.id,
        endpoint_url: `${project.base_url}${targetEndpoint.path}`,
        http_method: targetEndpoint.http_method,
        parameters: { ...resolvedEntities, ...(formData || {}) },
        summary_message: `Execute ${targetEndpoint.http_method} ${targetEndpoint.path}`,
        status: "PENDING",
      });

      answer = composeConfirmationPrompt({
        operation: matchedIntent?.intent_name || targetEndpoint.name,
        parameters: resolvedEntities,
        endpoint: targetEndpoint,
      });

      return buildResponseContract({
        success: true,
        answer,
        response_type: responseType,
        intent: detectedIntent,
        entities: resolvedEntities,
        confidence,
        data: {
          operation: matchedIntent?.intent_name || targetEndpoint.name,
          endpoint: targetEndpoint.path,
          parameters: resolvedEntities,
        },
        source,
        session_id: sessionId,
        correlation_id: correlationId,
        requires_clarification: false,
        requires_confirmation: true,
        suggested_questions: ["Yes, proceed", "No, cancel"],
        error: null,
      });
    }

    // 3. Mode C: External Execution Mode
    if (project.integration_mode === "MODE_C_EXTERNAL") {
      responseType = "API_REQUIRED";
      source = "external_dispatch";

      const actionId = await getNextSequence("pending_action");
      await PendingAction.create({
        id: actionId,
        correlation_id: correlationId,
        session_id: sessionId,
        project_id: project.id,
        user_id: userId,
        action_type: "EXTERNAL_COMPLETION",
        operation: matchedIntent?.intent_name || targetEndpoint.name,
        endpoint_id: targetEndpoint.id,
        endpoint_url: `${project.base_url}${targetEndpoint.path}`,
        http_method: targetEndpoint.http_method,
        parameters: { ...resolvedEntities, ...(formData || {}) },
        status: "PENDING",
      });

      answer = `Processing request for **${matchedIntent?.intent_name || targetEndpoint.name}**. External application execution dispatched (Correlation ID: \`${correlationId}\`).`;

      return buildResponseContract({
        success: true,
        answer,
        response_type: responseType,
        intent: detectedIntent,
        entities: resolvedEntities,
        confidence,
        data: {
          original_question: question,
          processed_question: nlpResult.normalized_text,
          detected_intent: detectedIntent,
          extracted_entities: resolvedEntities,
          operation_identifier: matchedIntent?.intent_name || targetEndpoint.operation_id || targetEndpoint.name,
          endpoint_path: targetEndpoint.path,
          http_method: targetEndpoint.http_method,
          required_parameters: resolvedEntities,
          missing_parameters: [],
          auth_requirements: {
            auth_type: project.auth_type,
            roles: targetEndpoint.auth_roles || [],
          },
        },
        source,
        session_id: sessionId,
        correlation_id: correlationId,
        requires_clarification: false,
        requires_confirmation: false,
        suggested_questions: [],
        error: null,
      });
    }

    // 4. Mode B: Direct API Execution Mode
    try {
      const execResult = await executeProjectEndpoint({
        project,
        endpoint: targetEndpoint,
        entities: resolvedEntities,
        formData,
        sessionId,
        userId,
        authRoles: userRoles,
      });

      if (execResult.success) {
        responseType = "LIVE_API";
        source = "api_execution";
        finalData = execResult.data;
        answer = composeLiveApiResponse({
          projectName: project.name,
          endpoint: targetEndpoint,
          entities: resolvedEntities,
          apiData: execResult.data,
        });
      } else {
        responseType = "ERROR";
        source = "api_execution";
        answer = `I reached the ${project.name} endpoint, but it encountered an error: ${execResult.error || "Unable to retrieve data."}`;
      }
    } catch (apiErr) {
      if (apiErr.message.includes("Access Denied")) {
        responseType = "ACCESS_DENIED";
        answer = `⛔ ${apiErr.message}`;
      } else if (apiErr.message.includes("SSRF")) {
        responseType = "ACCESS_DENIED";
        answer = `Security policy violation: ${apiErr.message}`;
      } else {
        responseType = "ERROR";
        answer = `Unable to connect to ${project.name} service: ${apiErr.message}`;
      }
    }
  }

  // D. Fallback if still OUT_OF_SCOPE
  if (responseType === "OUT_OF_SCOPE") {
    // If we have any knowledge chunks, use knowledge as fallback
    if (knowledgeMatches.length > 0) {
      responseType = "KNOWLEDGE_ANSWER";
      source = "knowledge_base";
      answer = composeKnowledgeResponse({
        projectName: project.name,
        knowledgeChunks: knowledgeMatches,
      });
      finalData = knowledgeMatches;
    } else {
      // Suggest top active intents/questions
      suggestedQuestions = intents
        .filter((i) => i.sample_utterances && i.sample_utterances.length > 0 && i.intent_name.toLowerCase() !== "greeting")
        .slice(0, 4)
        .map((i) => i.sample_utterances[0]);

      answer = composeOutOfScopeResponse({
        projectName: project.name,
        suggestedQuestions,
      });
    }
  }

  // Optional LLM refinement
  if (project.llm_config && project.llm_config.provider !== "none") {
    answer = await synthesizeWithOptionalLLM({
      prompt: question,
      groundedAnswer: answer,
      llmConfig: project.llm_config,
    });
  }

  // 6. Update Conversation Context
  await updateConversationContext({
    sessionId,
    projectId: project.id,
    intent: detectedIntent,
    entities: resolvedEntities,
    apiResult: finalData ? { data: finalData } : null,
    pendingParams: {},
    targetEndpointId: targetEndpoint ? targetEndpoint.id : null,
    targetIntentName: detectedIntent,
  });

  // 7. Persist to Chat History (User & Assistant messages)
  const userMsgId = await getNextSequence("chat_message");
  await ChatMessage.create({
    id: userMsgId,
    session_id: sessionId,
    project_id: project.id,
    project_name: project.name,
    project_code: project.project_code,
    user_id: userId,
    role: "user",
    content: question,
    question: question,
    detected_intent: detectedIntent,
    confidence,
    entities: resolvedEntities,
  });

  const botMsgId = await getNextSequence("chat_message");
  await ChatMessage.create({
    id: botMsgId,
    session_id: sessionId,
    project_id: project.id,
    project_name: project.name,
    project_code: project.project_code,
    user_id: userId,
    role: "assistant",
    content: answer,
    question,
    answer,
    detected_intent: detectedIntent,
    confidence,
    response_type: responseType,
    source,
    endpoint_called: targetEndpoint ? `${project.base_url}${targetEndpoint.path}` : null,
    endpoint_path: targetEndpoint ? targetEndpoint.path : null,
    status: responseType === "ERROR" ? "ERROR" : "SUCCESS",
    raw_response: finalData,
    correlation_id: correlationId,
    entities: resolvedEntities,
  });

  return buildResponseContract({
    success: responseType !== "ERROR",
    answer,
    response_type: responseType,
    intent: detectedIntent,
    entities: resolvedEntities,
    confidence,
    data: finalData,
    source,
    session_id: sessionId,
    correlation_id: (responseType === "ACTION_CONFIRMATION" || responseType === "API_REQUIRED") ? correlationId : null,
    requires_clarification: requiresClarification,
    requires_confirmation: requiresConfirmation,
    suggested_questions: suggestedQuestions,
    error: responseType === "ERROR" ? answer : null,
  });
}

function buildResponseContract(payload) {
  return {
    success: payload.success !== false,
    answer: payload.answer,
    response_type: payload.response_type,
    intent: payload.intent || null,
    entities: payload.entities || {},
    confidence: typeof payload.confidence === "number" ? Math.round(payload.confidence * 100) / 100 : 0.0,
    data: payload.data || null,
    source: payload.source || "grounded_engine",
    session_id: payload.session_id,
    correlation_id: payload.correlation_id || null,
    requires_clarification: Boolean(payload.requires_clarification),
    requires_confirmation: Boolean(payload.requires_confirmation),
    suggested_questions: payload.suggested_questions || [],
    error: payload.error || null,
  };
}

module.exports = {
  processUserQuestion,
  buildResponseContract,
};
