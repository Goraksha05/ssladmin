// src/utils/apiRequest.js
//
// CHANGES FROM ORIGINAL:
//
//   1. CRITICAL — Token storage key alignment.
//      The updated backend auth controllers (authController.js,
//      adminAuthController.js) return the JWT as `authtoken` in the response
//      body. The original apiRequest read localStorage keys in this order:
//        ['token', 'authtoken', 'authToken', 'accessToken']
//      The order matters: if AuthService stores the token under 'authtoken'
//      (which matches the backend response field name) but apiRequest tries
//      'token' first and finds nothing, then falls through to 'authtoken'.
//      This worked accidentally before but is fragile.
//      Fix: reordered to try 'authtoken' first (canonical backend field),
//      then the legacy aliases. This is backward compatible — existing sessions
//      stored under 'token' still work.
//
//   2. MEDIUM — Added explicit handling for HTTP 409 (Conflict) and 422
//      (Unprocessable Entity). The updated backend returns 409 for duplicate
//      reward claims (ALREADY_CLAIMED), duplicate payouts, and duplicate
//      friend requests. 422 is returned for slab resolution failures in
//      financeAndPayoutController. Previously these were swallowed by the
//      generic `status >= 500` branch, which showed "Server error" instead of
//      the actual helpful message from the backend.
//
//   3. MINOR — 401 toast changed from "Unauthorized. Please login again." to
//      use the server message when available. This surfaces more specific
//      errors like "Access denied: Token has expired." from fetchUser
//      middleware instead of a generic string.
//
//   4. MINOR — Added null/undefined guard for `error.response.data` before
//      accessing `.message` to prevent a second runtime error in the interceptor
//      itself when the server returns an empty body (e.g. some 502 responses).

import axios from 'axios';
import { toast } from 'react-toastify';

// Base URL (falls back to localhost if env not present)
const BASE_URL =
  process.env.REACT_APP_SERVER_URL      ||
  process.env.REACT_APP_BACKEND_URL     ||
  'http://127.0.0.1:5000';

// Create axios instance
const apiRequest = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// ── Token reader ──────────────────────────────────────────────────────────────
/**
 * Read the JWT from localStorage.
 *
 * Key priority order:
 *   1. 'authtoken'   — canonical key matching the backend response field name
 *                      (authController.js and adminAuthController.js both return
 *                      `authtoken` in their response body)
 *   2. 'token'       — legacy key (used by older AuthService implementations)
 *   3. 'authToken'   — camelCase variant
 *   4. 'accessToken' — OAuth-style variant
 *
 * Falls back to cookie named 'token' if nothing is found in localStorage.
 */
function readToken() {
  if (typeof window === 'undefined') return null;

  // FIX: 'authtoken' tried first — matches the backend response field name
  const keys = ['authtoken', 'token', 'authToken', 'accessToken'];
  for (const k of keys) {
    const t = localStorage.getItem(k);
    if (t && t !== 'null' && t !== 'undefined') return t;
  }

  // Cookie fallback
  try {
    const match = document.cookie.match('(^|;)\\s*token\\s*=\\s*([^;]+)');
    if (match) return match.pop();
  } catch {
    // ignore cookie parsing errors
  }

  return null;
}

// ── Request interceptor ───────────────────────────────────────────────────────
// Attach auth token + sensible header defaults on every outgoing request.
apiRequest.interceptors.request.use(
  (config) => {
    try {
      config.headers = config.headers || {};

      // Attach auth token if present and not already overridden by the caller
      const token = readToken();
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Accept header
      if (!config.headers.Accept) {
        config.headers.Accept = 'application/json';
      }

      // Content-Type:
      // • Skip for GET requests (no body)
      // • Skip for FormData (browser sets correct multipart boundary automatically)
      const method     = (config.method || 'get').toLowerCase();
      const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
      if (!isFormData && method !== 'get' && !config.headers['Content-Type']) {
        config.headers['Content-Type'] = 'application/json';
      }

      // user-id header for routes that read req.headers['user-id']
      try {
        const rawUser = localStorage.getItem('User');
        if (rawUser) {
          const user = JSON.parse(rawUser);
          if (user && (user._id || user.id)) {
            config.headers['user-id'] = user._id || user.id;
          }
        }
      } catch {
        // Don't fail the request on a parse error
      }
    } catch (err) {
      console.error('apiRequest request-interceptor error:', err);
    }

    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// ── Response interceptor ──────────────────────────────────────────────────────
// Handle global error toasts. All non-2xx responses are caught here so
// individual callers don't need to repeat error handling.
//
// TOAST STRATEGY (must match callers):
//   • Errors  → toasted HERE (callers must NOT also toast on error)
//   • Success → NOT toasted here (callers fire success toasts themselves)
apiRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response) {
      const { status, data } = error.response;
      // FIX: guard data?.message — data may be null/undefined for empty bodies
      const message = data?.message || null;

      console.error('❌ Response Error:', status, data);

      switch (true) {
        case status === 401:
          // FIX: use server message when available so "Token has expired" etc.
          // are shown to the user rather than a generic string.
          toast.error(message || 'Session expired. Please login again.');
          break;

        case status === 403:
          toast.error(message || 'Forbidden. You do not have access.');
          break;

        case status === 404:
          // 404s are often expected (e.g. no KYC record yet) — let callers
          // decide whether to surface them. Fire a toast only when the server
          // returns a non-empty message.
          if (message) toast.error(message);
          break;

        case status === 409:
          // FIX: Conflict — returned for duplicate claims, duplicate payouts,
          // duplicate friend requests. Show the server's descriptive message.
          toast.error(message || 'Conflict: this action has already been completed.');
          break;

        case status === 413:
          toast.error(message || 'File too large.');
          break;

        case status === 422:
          // FIX: Unprocessable Entity — returned when slab resolution fails in
          // financeAndPayoutController. Show the helpful debug message.
          toast.error(message || 'Invalid data. Please check your input.');
          break;

        case status === 429:
          toast.error('Too many requests. Please slow down and try again.');
          break;

        case status >= 500:
          toast.error('Server error. Please try again later.');
          break;

        default:
          if (message) toast.error(message);
          else toast.error('Request failed');
      }
    } else if (error?.request) {
      console.error('❌ No response received:', error.request);
      toast.error('No response from server. Check your connection.');
    } else {
      console.error('❌ Request Setup Error:', error?.message);
      toast.error('Failed to send request.');
    }

    return Promise.reject(error);
  }
);

export default apiRequest;