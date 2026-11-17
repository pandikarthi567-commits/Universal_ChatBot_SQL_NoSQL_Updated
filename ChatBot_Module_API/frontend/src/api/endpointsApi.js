import { apiRequest } from "./httpClient";

export function listEndpoints(projectId) {
  return apiRequest(`/api/projects/${projectId}/endpoints`);
}

export function createEndpoint(projectId, payload) {
  return apiRequest(`/api/projects/${projectId}/endpoints`, {
    method: "POST",
    body: payload,
  });
}

export function updateEndpoint(projectId, endpointId, payload) {
  return apiRequest(`/api/projects/${projectId}/endpoints/${endpointId}`, {
    method: "PUT",
    body: payload,
  });
}

export function deleteEndpoint(projectId, endpointId) {
  return apiRequest(`/api/projects/${projectId}/endpoints/${endpointId}`, {
    method: "DELETE",
  });
}

