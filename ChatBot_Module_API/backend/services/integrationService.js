const PendingAction = require("../models/PendingAction");
const Project = require("../models/Project");
const Endpoint = require("../models/Endpoint");
const ChatMessage = require("../models/ChatMessage");
const { getNextSequence } = require("../models/Counter");
const { executeProjectEndpoint } = require("./secureApiExecutor");
const { composeLiveApiResponse } = require("./answerService");
const { updateConversationContext } = require("./contextService");

/**
 * Completes an external execution request (Mode C).
 */
async function completeExternalExecution({
  correlationId,
  resultData,
  sessionId,
  projectId = null,
  userId = null,
}) {
  const action = await PendingAction.findOne({ correlation_id: correlationId });
  if (!action) {
    throw new Error(`Invalid or unknown correlation_id '${correlationId}'.`);
  }

  if (action.status !== "PENDING") {
    throw new Error(`Action with correlation_id '${correlationId}' has already been ${action.status.toLowerCase()}.`);
  }

  if (action.expires_at && new Date() > action.expires_at) {
    action.status = "EXPIRED";
    await action.save();
    throw new Error(`Correlation ID '${correlationId}' has expired.`);
  }

  // Security binding check: ensure session and project match original request
  if (sessionId && action.session_id !== sessionId) {
    throw new Error(`Session ID mismatch for correlation_id '${correlationId}'.`);
  }
  if (projectId && action.project_id !== Number(projectId)) {
    throw new Error(`Project ID mismatch for correlation_id '${correlationId}'.`);
  }

  const project = await Project.findOne({ id: action.project_id });
  const endpoint = action.endpoint_id ? await Endpoint.findOne({ id: action.endpoint_id }) : null;

  // Generate natural answer from external result
  const answer = composeLiveApiResponse({
    projectName: project ? project.name : "Application",
    endpoint,
    entities: action.parameters || {},
    apiData: resultData,
  });

  // Mark action as completed
  action.status = "COMPLETED";
  action.execution_result = resultData;
  action.updated_at = new Date();
  await action.save();

  // Update conversation context
  await updateConversationContext({
    sessionId: action.session_id,
    projectId: action.project_id,
    intent: action.operation,
    entities: action.parameters || {},
    apiResult: { data: resultData },
  });

  // Record assistant message
  const botMsgId = await getNextSequence("chat_message");
  await ChatMessage.create({
    id: botMsgId,
    session_id: action.session_id,
    project_id: action.project_id,
    project_name: project?.name,
    project_code: project?.project_code,
    user_id: action.user_id,
    role: "assistant",
    content: answer,
    question: `External completion for ${action.operation}`,
    answer,
    detected_intent: action.operation,
    confidence: 1.0,
    response_type: "LIVE_API",
    source: "external_completion",
    status: "SUCCESS",
    raw_response: resultData,
    correlation_id: correlationId,
  });

  return {
    success: true,
    answer,
    response_type: "LIVE_API",
    intent: action.operation,
    entities: action.parameters || {},
    confidence: 1.0,
    data: resultData,
    source: "external_completion",
    session_id: action.session_id,
    correlation_id: correlationId,
    requires_clarification: false,
    requires_confirmation: false,
    suggested_questions: [],
    error: null,
  };
}

/**
 * Confirms or cancels a pending mutating action.
 */
async function confirmPendingAction({
  correlationId,
  confirmed = true,
  sessionId,
  projectId = null,
  userId = null,
  userRoles = ["user"],
}) {
  const action = await PendingAction.findOne({ correlation_id: correlationId });
  if (!action) {
    throw new Error(`Invalid or unknown correlation_id '${correlationId}'.`);
  }

  if (action.status !== "PENDING") {
    throw new Error(`Action '${correlationId}' has already been ${action.status.toLowerCase()}.`);
  }

  if (action.expires_at && new Date() > action.expires_at) {
    action.status = "EXPIRED";
    await action.save();
    throw new Error(`Action '${correlationId}' has expired.`);
  }

  const project = await Project.findOne({ id: action.project_id });
  if (!project) throw new Error("Project not found.");

  // If user declined / cancelled
  if (!confirmed) {
    action.status = "CANCELLED";
    action.updated_at = new Date();
    await action.save();

    const answer = `Action **${action.operation}** was cancelled as requested.`;
    return {
      success: true,
      answer,
      response_type: "DIRECT_ANSWER",
      intent: action.operation,
      entities: action.parameters || {},
      confidence: 1.0,
      data: { status: "CANCELLED" },
      source: "action_cancelled",
      session_id: action.session_id,
      correlation_id: correlationId,
      requires_clarification: false,
      requires_confirmation: false,
      suggested_questions: [],
      error: null,
    };
  }

  // Execute the pending action
  const endpoint = await Endpoint.findOne({ id: action.endpoint_id });
  if (!endpoint) {
    throw new Error("Target endpoint for this action no longer exists.");
  }

  const execResult = await executeProjectEndpoint({
    project,
    endpoint,
    entities: action.parameters || {},
    formData: action.parameters || {},
    sessionId: action.session_id,
    userId: action.user_id,
    authRoles: userRoles,
  });

  action.status = execResult.success ? "COMPLETED" : "FAILED";
  action.execution_result = execResult.data || execResult.error;
  action.updated_at = new Date();
  await action.save();

  let answer = "";
  if (execResult.success) {
    answer = `✅ **Action Confirmed and Executed Successfully!**\n\n${composeLiveApiResponse({
      projectName: project.name,
      endpoint,
      entities: action.parameters || {},
      apiData: execResult.data,
    })}`;
  } else {
    answer = `❌ Action could not be completed: ${execResult.error || "Service execution failed."}`;
  }

  // Record assistant message
  const botMsgId = await getNextSequence("chat_message");
  await ChatMessage.create({
    id: botMsgId,
    session_id: action.session_id,
    project_id: action.project_id,
    project_name: project.name,
    project_code: project.project_code,
    user_id: action.user_id,
    role: "assistant",
    content: answer,
    question: `Confirmed ${action.operation}`,
    answer,
    detected_intent: action.operation,
    confidence: 1.0,
    response_type: execResult.success ? "LIVE_API" : "ERROR",
    source: "confirmed_execution",
    status: execResult.success ? "SUCCESS" : "ERROR",
    raw_response: execResult.data,
    correlation_id: correlationId,
  });

  return {
    success: execResult.success,
    answer,
    response_type: execResult.success ? "LIVE_API" : "ERROR",
    intent: action.operation,
    entities: action.parameters || {},
    confidence: 1.0,
    data: execResult.data,
    source: "confirmed_execution",
    session_id: action.session_id,
    correlation_id: correlationId,
    requires_clarification: false,
    requires_confirmation: false,
    suggested_questions: [],
    error: execResult.success ? null : execResult.error,
  };
}

module.exports = {
  completeExternalExecution,
  confirmPendingAction,
};
