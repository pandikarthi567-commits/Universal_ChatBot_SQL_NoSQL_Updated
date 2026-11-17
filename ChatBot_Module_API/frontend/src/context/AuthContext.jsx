import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { loginUser, signupUser, refreshAuthToken } from "../api/authApi";

const STORAGE_KEY = "ucapi_auth";
const AuthContext = createContext(null);

function loadInitialAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadInitialAuth);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [logout]);

  const performTokenRefresh = useCallback(async () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    let current;
    try {
      current = JSON.parse(raw);
    } catch {
      return;
    }
    if (!current?.refresh_token) return;

    try {
      const res = await refreshAuthToken(current.refresh_token);
      if (res?.data?.access_token) {
        const updated = {
          ...current,
          access_token: res.data.access_token,
          refresh_token: res.data.refresh_token || current.refresh_token,
          expires_in_seconds: res.data.expires_in_seconds || 120,
          last_refreshed_at: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setAuth(updated);
        console.log(
          `🔄 [JWT Auto-Refresh] Access token automatically refreshed at ${new Date().toLocaleTimeString()} (valid for 120s)`
        );
      }
    } catch (err) {
      console.warn("⚠️ [JWT Auto-Refresh] Automatic token refresh failed:", err.message);
      if (err.status === 401) {
        logout();
      }
    }
  }, [logout]);

  // Automatic Background Refresh Timer (fires every 110 seconds before 120s expiry)
  useEffect(() => {
    if (!auth?.refresh_token) return;

    const REFRESH_INTERVAL_MS = 110 * 1000; // 110 seconds
    const intervalId = setInterval(() => {
      performTokenRefresh();
    }, REFRESH_INTERVAL_MS);

    // Refresh on tab visibility if more than 110s elapsed
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - (auth.last_refreshed_at || 0);
        if (elapsed >= 110 * 1000) {
          performTokenRefresh();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [auth?.refresh_token, auth?.last_refreshed_at, performTokenRefresh]);

  const login = async (username, password) => {
    const res = await loginUser({ username, password });
    const session = {
      username: res.data.email || username,
      email: res.data.email || username,
      company_name: res.data.company_name,
      company_location: res.data.company_location,
      phone_number: res.data.phone_number,
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
      role: res.data.role,
      project_id: res.data.project_id,
      expires_in_seconds: res.data.expires_in_seconds || 120,
      expires_in_minutes: res.data.expires_in_minutes || 2,
      last_refreshed_at: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuth(session);
    return session;
  };

  const signup = async ({
    company_name,
    company_location,
    phone_number,
    company_details,
    email,
    password,
  }) => {
    const res = await signupUser({
      company_name,
      company_location,
      phone_number,
      company_details,
      email,
      password,
    });
    const session = {
      username: res.data.email || email,
      email: res.data.email || email,
      company_name: res.data.company_name || company_name,
      company_location: res.data.company_location || company_location,
      phone_number: res.data.phone_number || phone_number,
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
      role: res.data.role,
      project_id: res.data.project_id,
      expires_in_seconds: res.data.expires_in_seconds || 120,
      expires_in_minutes: res.data.expires_in_minutes || 2,
      last_refreshed_at: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuth(session);
    return session;
  };

  return (
    <AuthContext.Provider
      value={{
        auth,
        isAuthenticated: Boolean(auth?.access_token),
        login,
        signup,
        logout,
        performTokenRefresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
