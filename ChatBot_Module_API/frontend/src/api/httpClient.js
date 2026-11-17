const STORAGE_KEY = "ucapi_auth";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(status, message, data = null, latencyMs = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.latencyMs = latencyMs;
  }
}

export function getStoredToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || null;
  } catch {
    return null;
  }
}

export function getStoredRefreshToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.refresh_token || null;
  } catch {
    return null;
  }
}

let isRefreshing = false;
let refreshSubscribers = [];

function onTokenRefreshed(newToken) {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
}

async function attemptTokenRefresh() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event("auth:unauthorized"));
      return null;
    }

    const data = await res.json();
    if (data?.access_token) {
      const raw = localStorage.getItem(STORAGE_KEY);
      const current = raw ? JSON.parse(raw) : {};
      const updated = {
        ...current,
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expires_in_seconds: data.expires_in_seconds || 120,
        last_refreshed_at: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return data.access_token;
    }
  } catch (err) {
    console.warn("Refresh attempt failed:", err);
  }
  return null;
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    skipAuth = false,
    _isRetry = false,
  } = options;

  const finalHeaders = {
    Accept: "application/json",
    ...headers,
  };

  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders["Content-Type"] = "application/json";
  }

  if (!skipAuth) {
    const token = getStoredToken();
    if (token) {
      finalHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const startedAt = performance.now();
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
        ? body
        : JSON.stringify(body),
  });
  const latencyMs = Math.round((performance.now() - startedAt) * 100) / 100;

  if (response.status === 204) {
    return { data: null, status: 204, latencyMs };
  }

  let parsed = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    parsed = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => "");
    parsed = text ? { detail: text } : null;
  }

  // Handle Token Expiry & Automatic Refresh Retry
  if (response.status === 401 && !skipAuth && !_isRetry && !path.startsWith("/api/auth/")) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await attemptTokenRefresh();
      isRefreshing = false;
      if (newToken) {
        onTokenRefreshed(newToken);
        return apiRequest(path, { ...options, _isRetry: true });
      }
    } else {
      // Wait for ongoing refresh to complete
      return new Promise((resolve, reject) => {
        refreshSubscribers.push((newToken) => {
          if (newToken) {
            resolve(apiRequest(path, { ...options, _isRetry: true }));
          } else {
            reject(new ApiError(401, "Session expired"));
          }
        });
      });
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth/")) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new Event("auth:unauthorized"));
      } catch {
        // ignore in non-browser environments
      }
    }
    let msg = `Request failed with status ${response.status}`;
    if (parsed?.detail) {
      if (typeof parsed.detail === "string") {
        msg = parsed.detail;
      } else if (Array.isArray(parsed.detail)) {
        msg = parsed.detail
          .map((e) => `${e.loc?.slice(1).join(".") || "field"}: ${e.msg}`)
          .join("; ");
      }
    }
    throw new ApiError(response.status, msg, parsed, latencyMs);
  }

  return { data: parsed, status: response.status, latencyMs };
}
