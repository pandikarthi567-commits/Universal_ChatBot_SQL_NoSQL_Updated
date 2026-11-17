const axios = require("axios");

/**
 * Builds parameter dictionary for the endpoint based on extracted entities,
 * expected parameters, and user form_data.
 */
function buildParameters({ endpoint, entities = {}, formData = {} }) {
  const queryParams = {};
  const pathParams = {};
  const bodyParams = {};

  const expected = endpoint.expected_params || [];

  for (const p of expected) {
    const pName = p.name || p.param_name;
    const pIn = (p.in || "query").toLowerCase();
    let val = formData[pName];

    if (val === undefined || val === null) {
      val = entities[pName];
    }
    if (val === undefined || val === null) {
      // Look for fuzzy match in entities (e.g. order_id vs id)
      for (const [k, v] of Object.entries(entities)) {
        if (k.toLowerCase() === pName.toLowerCase() || k.includes(pName) || pName.includes(k)) {
          val = v;
          break;
        }
      }
    }
    if (val === undefined || val === null) {
      val = p.default_value;
    }

    if (val !== undefined && val !== null) {
      if (pIn === "path") {
        pathParams[pName] = val;
      } else if (pIn === "body") {
        bodyParams[pName] = val;
      } else {
        queryParams[pName] = val;
      }
    }
  }

  return { queryParams, pathParams, bodyParams };
}

/**
 * Executes external project API call using the project's base_url and unique endpoint
 */
async function callProjectEndpoint({
  project,
  endpoint,
  entities = {},
  formData = {},
  httpMethodOverride = null,
  question = null,
}) {
  const { queryParams, pathParams, bodyParams } = buildParameters({ endpoint, entities, formData });

  // Pass cleaned question and project accessKey in query parameters for GET calls
  if (question) {
    queryParams.question = question;
  }
  if (project.auth_config?.api_key) {
    queryParams.accessKey = project.auth_config.api_key;
  }
  // Pass extracted scalar entities in query parameters for GET calls
  if (entities && typeof entities === "object") {
    for (const [k, v] of Object.entries(entities)) {
      if (v !== null && v !== undefined && v !== "" && typeof v !== "object") {
        queryParams[k] = v;
      }
    }
  }

  const endpointPath = endpoint.path || project.health_path || `/api/${(project.project_code || "app").toLowerCase()}`;
  let finalPath = endpointPath;
  for (const [k, v] of Object.entries(pathParams)) {
    finalPath = finalPath.replace(`{${k}}`, encodeURIComponent(v)).replace(`:${k}`, encodeURIComponent(v));
  }

  const baseUrl = (project.base_url || "http://localhost:8000").replace(/\/+$/, "");
  const cleanPath = finalPath.startsWith("/") ? finalPath : `/${finalPath}`;
  const fullUrl = `${baseUrl}${cleanPath}`;

  const method = (httpMethodOverride || endpoint.http_method || "GET").toUpperCase();
  const timeoutMs = (endpoint.timeout_seconds || 15) * 1000;

  const headers = {
    "Accept": "application/json",
    "User-Agent": "Universal-Chatbot-Platform/2.0 (Node.js)",
  };

  // Add Project Auth if configured (supports bearer, api_key, or both!)
  if (
    project.auth_type === "bearer" ||
    project.auth_type === "bearer_and_api_key" ||
    project.auth_config?.token
  ) {
    const token = project.auth_config?.token || project.auth_config?.bearer_token;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  if (
    project.auth_type === "api_key" ||
    project.auth_type === "bearer_and_api_key" ||
    project.auth_config?.api_key
  ) {
    const apiKey = project.auth_config?.api_key || project.auth_config?.apiKey;
    const keyHeader = project.auth_config?.header_name || "X-API-Key";
    if (apiKey) {
      headers[keyHeader] = apiKey;
    }
  }

  const requestBody =
    method !== "GET"
      ? {
          question,
          action: "query",
          ...bodyParams,
          ...(formData || {}),
        }
      : undefined;

  try {
    const response = await axios({
      method,
      url: fullUrl,
      params: queryParams,
      data: requestBody,
      headers,
      timeout: timeoutMs,
      validateStatus: () => true, // Don't throw on non-2xx
    });

    return {
      status: response.status,
      success: response.status >= 200 && response.status < 300,
      data: response.data,
      url: fullUrl,
      endpoint_path: cleanPath,
    };
  } catch (err) {
    return {
      status: 502,
      success: false,
      error: err.message,
      data: null,
      url: fullUrl,
      endpoint_path: cleanPath,
    };
  }
}

module.exports = {
  buildParameters,
  callProjectEndpoint,
};

