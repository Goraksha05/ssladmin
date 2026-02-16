// src/utils/apiRequest.js
import axios from 'axios';
import { toast } from 'react-toastify';

// Base URL (falls back to localhost if env not present)
const BASE_URL = process.env.REACT_APP_SERVER_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:5000';

// Create axios instance
const apiRequest = axios.create({
  baseURL: BASE_URL,
  // Optionally set a default timeout (uncomment to enable)
  timeout: 15000,
});

// Helper: read token from a few common locations
function readToken() {
  if (typeof window === 'undefined') return null;

  // Try several common keys (some code uses `token`, others `authtoken` etc.)
  const keys = ['token', 'authtoken', 'authToken', 'accessToken'];
  for (const k of keys) {
    const t = localStorage.getItem(k);
    if (t && t !== 'null' && t !== 'undefined') return t;
  }

  // Fallback: check cookies for a token cookie named "token" (if present)
  try {
    const match = document.cookie.match('(^|;)\\s*token\\s*=\\s*([^;]+)');
    if (match) return match.pop();
  } catch (err) {
    // ignore cookie parsing errors
  }

  return null;
}

// Request interceptor: attach token & user-id and sensible defaults
apiRequest.interceptors.request.use(
  (config) => {
    try {
      // Ensure headers object exists
      config.headers = config.headers || {};

      // Attach auth token if present and not already provided
      const token = readToken();
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add Accept header if not provided
      if (!config.headers.Accept) {
        config.headers.Accept = 'application/json';
      }

      // Only add Content-Type when appropriate:
      // - don't set for FormData (browser will set correct multipart boundary)
      // - don't set for GET requests (no body)
      const method = (config.method || 'get').toLowerCase();
      const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
      if (!isFormData && method !== 'get' && !config.headers['Content-Type']) {
        config.headers['Content-Type'] = 'application/json';
      }

      // Add user-id header if we have a User saved in localStorage
      try {
        const rawUser = localStorage.getItem('User');
        if (rawUser) {
          const user = JSON.parse(rawUser);
          if (user && (user._id || user.id)) {
            config.headers['user-id'] = user._id || user.id;
          }
        }
      } catch (err) {
        // Don't fail request on parse error
        console.warn('apiRequest: failed to parse User from localStorage', err);
      }
    } catch (err) {
      // Defensive: ensure we never block the request due to interceptor failure
      console.error('apiRequest request-interceptor error', err);
    }

    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor: handle global errors and toasts
apiRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error && error.response) {
      const { status, data } = error.response;
      console.error('❌ Response Error:', status, data);

      // Friendly user feedback
      if (status === 401) {
        toast.error(data?.message || 'Unauthorized. Please login again.');
        // NOTE: we intentionally do NOT automatically clear tokens here.
        // Let the app decide how to handle re-authentication.
      } else if (status === 403) {
        toast.error(data?.message || 'Forbidden. You do not have access.');
      } else if (status >= 500) {
        toast.error('Server error. Please try again later.');
      } else {
        // prefer message, fallback to generic
        toast.error(data?.message || 'Request failed');
      }
    } else if (error && error.request) {
      console.error('❌ No response received:', error.request);
      toast.error('No response from server');
    } else {
      console.error('❌ Request Setup Error:', error.message);
      toast.error('Failed to send request');
    }

    return Promise.reject(error);
  }
);

export default apiRequest;
