import apiClient from "./client";

/**
 * Register a new user account.
 * @param {object} userData - { name, email, password, role, organization, phone }
 */
export async function registerUser(userData) {
  const response = await apiClient.post("/auth/register", userData);
  return response.data?.data || response.data;
}

/**
 * Authenticate with email and password.
 * @param {object} credentials - { email, password }
 */
export async function loginUser(credentials) {
  const response = await apiClient.post("/auth/login", credentials);
  return response.data?.data || response.data;
}

/**
 * Get current authenticated user profile using stored JWT.
 */
export async function getCurrentUser() {
  const response = await apiClient.get("/auth/me");
  return response.data?.data || response.data;
}

/**
 * Update authenticated user profile.
 */
export async function updateUserProfile(data) {
  const response = await apiClient.put("/auth/me", data);
  return response.data?.data || response.data;
}

