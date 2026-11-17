const axios = require("axios");
const { URL } = require("url");
const ApiExecutionLog = require("../models/ApiExecutionLog");
const { getNextSequence } = require("../models/Counter");

// Blocked metadata addresses (SSRF protection)
const BLOCKED_IPS = ["169.254.169.254", "metadata.google.internal", "100.100.100.200"];

/**
 * Validates target URL against SSRF and project destination allowlist.
 */
function validateDestinationUrl(targetUrl, allowedDomains = []) {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();

    // 1. Block known cloud metadata IP addresses
    if (BLOCKED_IPS.includes(host)) {
      throw new Error(`SSRF Protection: Access to metadata service '${host}' is strictly forbidden.`);
    }

    // 2. Allowlist verification if allowedDomains is configured
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some((domain) => {
        const d = domain.toLowerCase().trim();
        return host === d || host.endsWith(`.${d}`);
      });

      if (!isAllowed) {
        throw new Error(
          `SSRF Protection: Destination host '${host}' is not in project allowed domains: [${allowedDomains.join(", ")}].`
        );
      }
    }

    return true;
  } catch (err) {
    throw new Error(`Invalid destination URL '${targetUrl}': ${err.message}`);
  }
}

/**
 * Masks sensitive keys (passwords, tokens, keys) in objects for safe audit logging.
 */
function maskSensitiveData(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitiveData);

  const masked = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase();
    if (
      keyLower.includes("password") ||
      keyLower.includes("token") ||
      keyLower.includes("secret") ||
      keyLower.includes("api_key") ||
      keyLower.includes("apikey") ||
      keyLower.includes("accesskey") ||
      keyLower.includes("authorization")
    ) {
      masked[k] = "••••••••";
    } else if (v && typeof v === "object") {
      masked[k] = maskSensitiveData(v);
    } else {
      masked[k] = v;
    }
  }
  return masked;
}

/**
 * Builds parameter sets for path, query, and body.
 */
function resolveParameters({ endpoint, entities = {}, formData = {} }) {
  const queryParams = {};
  const pathParams = {};
  const bodyParams = {};
  const missingRequired = [];

  const expected = endpoint.expected_params || [];

  for (const p of expected) {
    const pName = p.name || p.param_name;
    const pIn = (p.in || "query").toLowerCase();
    const isRequired = Boolean(p.required);

    let val = formData[pName];
    if (val === undefined || val === null) val = entities[pName];

    // Case-insensitive & fuzzy matching across entities
    if (val === undefined || val === null) {
      for (const [k, v] of Object.entries(entities)) {
        if (k.toLowerCase() === pName.toLowerCase() || k.toLowerCase().includes(pName.toLowerCase())) {
          val = v;
          break;
        }
      }
    }

    if (val === undefined || val === null) {
      val = p.default_value;
    }

    if (isRequired && (val === undefined || val === null || val === "")) {
      missingRequired.push(pName);
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

  // Also include any scalar entities not explicitly defined in expected_params
  for (const [k, v] of Object.entries(entities)) {
    if (v !== null && v !== undefined && typeof v !== "object" && queryParams[k] === undefined && pathParams[k] === undefined) {
      queryParams[k] = v;
    }
  }

  return { queryParams, pathParams, bodyParams, missingRequired };
}

/**
 * Securely executes approved project endpoints.
 */
async function executeProjectEndpoint({
  project,
  endpoint,
  entities = {},
  formData = {},
  sessionId = null,
  userId = null,
  authRoles = [],
}) {
  // 1. Approval check
  if (!endpoint.is_approved) {
    throw new Error(
      `Endpoint '${endpoint.http_method} ${endpoint.path}' is not approved by administrator. Chatbot execution blocked.`
    );
  }

  // 2. Authorization check
  if (endpoint.auth_roles && endpoint.auth_roles.length > 0) {
    const hasRole = endpoint.auth_roles.some((r) => authRoles.includes(r.toLowerCase()));
    if (!hasRole && !authRoles.includes("admin")) {
      throw new Error(
        `Access Denied: Endpoint requires one of roles [${endpoint.auth_roles.join(", ")}], user has [${authRoles.join(", ")}].`
      );
    }
  }

  // 3. Resolve parameters & check missing required parameters
  const { queryParams, pathParams, bodyParams, missingRequired } = resolveParameters({
    endpoint,
    entities,
    formData,
  });

  if (missingRequired.length > 0) {
    return {
      success: false,
      requires_clarification: true,
      missing_parameters: missingRequired,
      message: `Missing required parameter(s): ${missingRequired.join(", ")}.`,
    };
  }

  // 4. Interpolate path parameters
  let finalPath = endpoint.path;
  for (const [k, v] of Object.entries(pathParams)) {
    finalPath = finalPath.replace(`{${k}}`, encodeURIComponent(v)).replace(`:${k}`, encodeURIComponent(v));
  }

  const baseUrl = (project.base_url || "http://localhost:8000").replace(/\/+$/, "");
  const cleanPath = finalPath.startsWith("/") ? finalPath : `/${finalPath}`;
  const fullUrl = `${baseUrl}${cleanPath}`;

  // 5. SSRF Destination Validation
  validateDestinationUrl(fullUrl, project.allowed_domains);

  const method = (endpoint.http_method || "GET").toUpperCase();
  const timeoutMs = (endpoint.timeout_seconds || 15) * 1000;

  // 6. Header management & secure token forwarding
  const headers = {
    "Accept": "application/json",
    "User-Agent": "Universal-Chatbot-Platform/2.0 (Secure-Executor)",
  };

  if (
    project.auth_type === "bearer" ||
    project.auth_type === "bearer_and_api_key" ||
    project.auth_config?.token
  ) {
    const token = project.auth_config?.token || project.auth_config?.bearer_token;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  if (
    project.auth_type === "api_key" ||
    project.auth_type === "bearer_and_api_key" ||
    project.auth_config?.api_key
  ) {
    const key = project.auth_config?.api_key || project.auth_config?.apiKey;
    const headerName = project.auth_config?.header_name || "X-API-Key";
    if (key) {
      headers[headerName] = key;
      // also pass accessKey in query params for legacy compatibility
      queryParams.accessKey = key;
    }
  }

  const requestBody = method !== "GET" ? { ...bodyParams, ...formData } : undefined;

  // 7. Execution with safe retries for idempotent operations
  const startTime = Date.now();
  let response = null;
  let errorMsg = null;
  const isIdempotent = method === "GET" || method === "HEAD";
  const maxAttempts = isIdempotent ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await axios({
        method,
        url: fullUrl,
        params: queryParams,
        data: requestBody,
        headers,
        timeout: timeoutMs,
        validateStatus: () => true, // Don't throw automatically on 4xx/5xx
      });

      // If server returned 502/503/504 and it's idempotent, retry once after short backoff
      if (isIdempotent && [502, 503, 504].includes(response.status) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      break;
    } catch (netErr) {
      errorMsg = netErr.message;
      if (isIdempotent && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
    }
  }

  const latencyMs = Date.now() - startTime;
  const statusCode = response ? response.status : 504;
  const isSuccess = response ? response.status >= 200 && response.status < 300 : false;
  const responseData = response ? response.data : null;

  // 8. Audit logging
  try {
    const logId = await getNextSequence("api_execution_log");
    await ApiExecutionLog.create({
      id: logId,
      project_id: project.id,
      session_id: sessionId,
      user_id: userId,
      endpoint_url: fullUrl,
      endpoint_path: cleanPath,
      http_method: method,
      status_code: statusCode,
      latency_ms: latencyMs,
      success: isSuccess,
      request_params_masked: maskSensitiveData({ query: queryParams, body: requestBody }),
      response_summary: responseData ? JSON.stringify(responseData).substring(0, 300) : errorMsg,
      error_detail: isSuccess ? null : errorMsg || `HTTP ${statusCode}`,
    });
  } catch (logErr) {
    console.warn("Failed to write API execution log:", logErr.message);
  }

  return {
    success: isSuccess,
    status: statusCode,
    latency_ms: latencyMs,
    data: responseData,
    url: fullUrl,
    error: isSuccess ? null : errorMsg || `Service returned status ${statusCode}`,
  };
}

module.exports = {
  executeProjectEndpoint,
  validateDestinationUrl,
  resolveParameters,
  maskSensitiveData,
};
