import { apiRequest } from "./httpClient";

export function listProjects() {
  return apiRequest("/api/projects");
}

export function getProjectDetail(projectId) {
  return apiRequest(`/api/projects/${projectId}`);
}

export function registerProject(payload) {
  return apiRequest("/api/projects/register", {
    method: "POST",
    body: payload,
  });
}

export function updateProject(projectId, payload) {
  return apiRequest(`/api/projects/${projectId}`, {
    method: "PUT",
    body: payload,
  });
}

export function patchProjectStatus(projectId, isActive) {
  return apiRequest(`/api/projects/${projectId}/status`, {
    method: "PATCH",
    body: { is_active: isActive },
  });
}

export function deleteProject(projectId) {
  return apiRequest(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
}

export function testProjectConnection(projectId) {
  return apiRequest(`/api/projects/${projectId}/test-connection`, {
    method: "POST",
  });
}

export function createProjectCredential(projectId, payload) {
  return apiRequest(`/api/projects/${projectId}/credentials`, {
    method: "POST",
    body: payload,
  });
}

// -------------------------------------------------------------
// Universal Project Analyzer & Grounded Knowledge Base APIs
// -------------------------------------------------------------
export function analyzeProjectApi(payload) {
  return apiRequest("/api/projects/analyze", {
    method: "POST",
    body: payload,
  });
}

export function getProjectAnalysis(projectId) {
  return apiRequest(`/api/projects/${projectId}/analysis`);
}

export function reanalyzeProjectApi(projectId, payload = {}) {
  return apiRequest(`/api/projects/${projectId}/reanalyze`, {
    method: "POST",
    body: payload,
  });
}

export function getProjectKnowledge(projectId, category = null) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiRequest(`/api/projects/${projectId}/knowledge${qs}`);
}

export function addProjectKnowledge(projectId, payload) {
  return apiRequest(`/api/projects/${projectId}/knowledge`, {
    method: "POST",
    body: payload,
  });
}

export function updateProjectKnowledge(projectId, knowledgeId, payload) {
  return apiRequest(`/api/projects/${projectId}/knowledge/${knowledgeId}`, {
    method: "PUT",
    body: payload,
  });
}

export function deleteProjectKnowledge(projectId, knowledgeId) {
  return apiRequest(`/api/projects/${projectId}/knowledge/${knowledgeId}`, {
    method: "DELETE",
  });
}

export function approveEndpointApi(projectId, endpointId, isApproved = true) {
  return apiRequest(`/api/projects/${projectId}/endpoints/${endpointId}/approve`, {
    method: "POST",
    body: { is_approved: isApproved },
  });
}
