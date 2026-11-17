import { apiRequest } from "./httpClient";

export function checkHealth() {
  return apiRequest("/health", { skipAuth: true });
}

export function analyzeQuestion({ question, projectId = null, projectCode = null }) {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return apiRequest(`/api/chat/analyze${qs}`, {
    method: "POST",
    body: {
      question,
      ...(projectId ? { project_id: Number(projectId) } : {}),
      ...(projectCode ? { project_code: projectCode } : {}),
    },
  });
}

export function askQuestion({ sessionId, question, projectId = null, projectCode = null, httpMethod = null, formData = null }) {
  return apiRequest(projectCode ? `/api/chat/${encodeURIComponent(projectCode.toLowerCase())}` : "/api/chat/ask", {
    method: "POST",
    body: {
      session_id: sessionId,
      question,
      ...(projectId ? { project_id: Number(projectId) } : {}),
      ...(projectCode ? { project_code: projectCode } : {}),
      ...(httpMethod ? { http_method: httpMethod } : {}),
      ...(formData ? { form_data: formData } : {}),
    },
  });
}

export function confirmAction({ correlationId, confirmed = true, sessionId = null, projectId = null }) {
  return apiRequest("/api/chat/confirm", {
    method: "POST",
    body: {
      correlation_id: correlationId,
      confirmed,
      session_id: sessionId,
      project_id: projectId ? Number(projectId) : null,
    },
  });
}

export function completeExternal({ correlationId, resultData, sessionId = null, projectId = null }) {
  return apiRequest("/api/chat/complete", {
    method: "POST",
    body: {
      correlation_id: correlationId,
      result_data: resultData,
      session_id: sessionId,
      project_id: projectId ? Number(projectId) : null,
    },
  });
}

export function getHistory({ limit = 30, offset = 0, projectId = null, role = null } = {}) {
  let url = `/api/chat/history?limit=${limit}&offset=${offset}`;
  if (projectId) url += `&project_id=${encodeURIComponent(projectId)}`;
  if (role) url += `&role=${encodeURIComponent(role)}`;
  return apiRequest(url);
}

export function getSessionHistory(sessionId, { limit = 50, offset = 0 } = {}) {
  return apiRequest(
    `/api/chat/history/${encodeURIComponent(sessionId)}?limit=${limit}&offset=${offset}`
  );
}

export function deleteSessionHistory(sessionId) {
  return apiRequest(`/api/chat/history/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export function clearSession(sessionId, projectId = null) {
  const qs = projectId ? `?session_id=${encodeURIComponent(sessionId)}&project_id=${encodeURIComponent(projectId)}` : `?session_id=${encodeURIComponent(sessionId)}`;
  return apiRequest(`/api/chat/session${qs}`, {
    method: "DELETE",
  });
}

export function clearAllHistory() {
  return apiRequest("/api/chat/clear", {
    method: "POST",
  });
}
