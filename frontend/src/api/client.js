import axios from "axios";

// Default to backend Express server on port 5000.
const rawEnvUrl = import.meta.env.VITE_API_BASE_URL;
const baseURL = rawEnvUrl && rawEnvUrl.startsWith("http")
  ? rawEnvUrl
  : "http://localhost:5000/api";

export const apiClient = axios.create({
  baseURL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach auth token if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("taza_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default apiClient;

/**
 * Turn an axios error into a readable message, preferring the backend's
 * { success:false, message } body (axios's own message is just
 * "Request failed with status code 422").
 */
export function getApiErrorMessage(error, fallback = "Request failed.") {
  const data = error?.response?.data;
  if (data?.message) return data.message;
  if (typeof data?.detail === "string") return data.detail;
  if (error?.code === "ECONNABORTED") return "The request timed out. The AI analysis may still be running; check the batch details before retrying.";
  if (error?.request && !error?.response) return "Cannot reach the backend server. Make sure it is running.";
  return error?.message || fallback;
}
