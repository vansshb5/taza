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
