import { apiRequest } from "./httpClient";

export function registerAdmin({ username, email, password }) {
  return apiRequest("/api/auth/register", {
    method: "POST",
    body: {
      username,
      email: email?.trim() ? email.trim() : null,
      password,
    },
  });
}

export function loginUser({ username, password }) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: { username, password },
    skipAuth: true,
  });
}

export function signupUser({
  company_name,
  company_location,
  phone_number,
  company_details,
  email,
  password,
}) {
  return apiRequest("/api/auth/signup", {
    method: "POST",
    body: {
      company_name: company_name.trim(),
      company_location: company_location?.trim() || null,
      phone_number: phone_number?.trim() || null,
      company_details: company_details?.trim() || null,
      email: email.trim(),
      password,
    },
    skipAuth: true,
  });
}

export function refreshAuthToken(refreshToken) {
  return apiRequest("/api/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
    skipAuth: true,
  });
}
