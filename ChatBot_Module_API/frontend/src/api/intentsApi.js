import { apiRequest } from "./httpClient";

export function listIntents(projectId) {
  return apiRequest(`/api/projects/${projectId}/intents`);
}

export function createIntent(projectId, payload) {
  return apiRequest(`/api/projects/${projectId}/intents`, {
    method: "POST",
    body: payload,
  });
}

export function updateIntent(projectId, intentId, payload) {
  return apiRequest(`/api/projects/${projectId}/intents/${intentId}`, {
    method: "PUT",
    body: payload,
  });
}

export function deleteIntent(projectId, intentId) {
  return apiRequest(`/api/projects/${projectId}/intents/${intentId}`, {
    method: "DELETE",
  });
}

