import axios from "axios";
import { toast } from "react-toastify";

// ─────────────────────────────────────────────
// BASE CONFIG
// ─────────────────────────────────────────────
const BASE_URL =
  process.env.REACT_APP_SERVER_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  "http://127.0.0.1:5000";

const apiRequest = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// ─────────────────────────────────────────────
// TOKEN HELPER (ROBUST)
// ─────────────────────────────────────────────
const getToken = () => {
  if (typeof window === "undefined") return null;

  const keys = ["authtoken", "token", "authToken", "accessToken"];

  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value && value !== "null" && value !== "undefined") {
      return value;
    }
  }

  return null;
};

// ─────────────────────────────────────────────
// REQUEST INTERCEPTOR
// ─────────────────────────────────────────────
apiRequest.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};

    const token = getToken();

    // 🚀 Attach token ONLY if exists
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Default headers
    config.headers.Accept = "application/json";

    const method = (config.method || "get").toLowerCase();
    const isFormData =
      typeof FormData !== "undefined" && config.data instanceof FormData;

    if (!isFormData && method !== "get") {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────────────
// RESPONSE INTERCEPTOR (SMART)
// ─────────────────────────────────────────────
let isRedirecting = false;

apiRequest.interceptors.response.use(
  (response) => response,

  (error) => {
    const res = error?.response;

    if (!res) {
      toast.error("No response from server. Check connection.");
      return Promise.reject(error);
    }

    const { status, data } = res;
    const message = data?.message || data?.error || null;

    console.error("❌ API Error:", status, data);

    // ─────────────────────────────
    // AUTH ERROR (MOST IMPORTANT)
    // ─────────────────────────────
    if (status === 401) {
      if (!isRedirecting) {
        isRedirecting = true;

        toast.error(message || "Session expired. Please login again.");

        // 🔥 Clear invalid tokens
        localStorage.removeItem("authtoken");
        localStorage.removeItem("token");

        // 🔥 Redirect to login (prevent loop)
        setTimeout(() => {
          window.location.href = "/login";
        }, 1200);
      }

      return Promise.reject(error);
    }

    // ─────────────────────────────
    // OTHER ERRORS
    // ─────────────────────────────
    if (status === 403) {
      toast.error(message || "Access denied.");
    } else if (status === 404) {
      if (message) toast.error(message);
    } else if (status === 409) {
      toast.error(message || "Already processed.");
    } else if (status === 422) {
      toast.error(message || "Invalid data.");
    } else if (status === 429) {
      toast.error("Too many requests.");
    } else if (status >= 500) {
      toast.error("Server error. Try again later.");
    } else {
      if (message) toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default apiRequest;