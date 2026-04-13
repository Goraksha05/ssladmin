// Services/AuthService.js
//
// FIXES IN THIS VERSION:
//
//   1. LOGOUT KEY COVERAGE — AuthService.logout() now clears ALL four token
//      keys that could ever hold a JWT: 'authtoken', 'token', 'authToken',
//      'accessToken'. The previous version only cleared 'token' and 'User',
//      leaving 'authtoken' (written by AuthContext / apiRequest) behind.
//      That surviving key was picked up by AuthContext's session-restore on
//      the next mount, re-authenticating the admin without a new login.
//
//   2. TOKEN STORAGE KEY ALIGNMENT — login() and signup() now store the JWT
//      under 'authtoken' instead of 'token'. This matches:
//        • apiRequest.js  → reads keys in order ['authtoken', 'token', ...]
//        • AuthContext.js → restores from localStorage.getItem('authtoken') first
//      Previously the mismatch meant apiRequest sent no Authorization header
//      until 'authtoken' was separately set by AuthContext.
//
//   3. STRICT HTTP STATUS CHECK IN getUser() — previously the function checked
//      data.success after fetch() but never checked res.ok. A 401 or 403 from
//      the backend (expired / invalid token) would not be caught, keeping the
//      admin "logged in" with a dead token. Now: if res.ok is false the
//      function calls clearSession() to wipe all keys and returns null, which
//      causes AuthProvider to render the login page.
//
//   4. DEAD CODE REMOVED — the `if (!token) return null` guard inside the
//      old getUser() appeared AFTER the await fetch(), making it unreachable.
//      Removed.

const API_URL =
  `${process.env.REACT_APP_BACKEND_URL ?? process.env.REACT_APP_SERVER_URL}/api/admin`;

// ── Token key — single source of truth ───────────────────────────────────────
// Matches the first key apiRequest.js checks, and what AuthContext restores.
const TOKEN_KEY = 'authtoken';

// Every key that might hold a JWT from any version of this file.
// ALL must be wiped on logout so no stale token survives.
const ALL_TOKEN_KEYS = ['authtoken', 'token', 'authToken', 'accessToken'];

const cleanToken = (raw) => (raw ?? '').trim().replace(/\s/g, '');

// ── Shared session-clear helper ───────────────────────────────────────────────
// Used by logout() and by getUser() when the backend rejects the token.
function clearSession() {
  ALL_TOKEN_KEYS.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('User');
}

const AuthService = {

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  login: async ({ identifier, password, captchaToken, captchaType = 'v3', captchaAction = 'login' }) => {
    try {
      const res = await fetch(`${API_URL}/adminlogin`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ identifier, password, captchaToken, captchaType, captchaAction }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.authtoken) {
        const token = cleanToken(data.authtoken);

        // FIX 2: store under TOKEN_KEY ('authtoken') — consistent with
        // apiRequest.js and AuthContext session-restore.
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem('User', JSON.stringify(data.user));

        // Return key named 'authtoken' so AuthContext.login() can read it
        // directly from res.authtoken without another localStorage lookup.
        return { success: true, user: data.user, authtoken: token };
      }

      return { success: false, error: data.error || 'Login failed' };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Server error' };
    }
  },

  // ── SIGNUP ─────────────────────────────────────────────────────────────────
  signup: async ({ name, username, email, phone, password, captchaToken, captchaType = 'v3', captchaAction = 'login' }) => {
    try {
      const res = await fetch(`${API_URL}/createadmin`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, username, email, phone, password, captchaToken, captchaType, captchaAction }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.authtoken) {
        const token = cleanToken(data.authtoken);

        // FIX 2: same key alignment as login()
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem('User', JSON.stringify(data.user));

        return { success: true, user: data.user, authtoken: token };
      }

      return { success: false, error: data.error || data.message || 'Signup failed' };
    } catch (err) {
      console.error('Signup error:', err);
      return { success: false, error: 'Server error' };
    }
  },

  // ── GET LOGGED USER ────────────────────────────────────────────────────────
  getUser: async () => {
    const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token');
    const user  = JSON.parse(localStorage.getItem('User') || 'null');

    if (!token || !user) return null;

    try {
      const res = await fetch(
        `${API_URL}/getloggeduser/${user._id || user.id}`,
        { headers: { Authorization: `Bearer ${cleanToken(token)}` } },
      );

      // FIX 3: non-2xx means the token is invalid/expired on the backend.
      // Wipe all storage so AuthProvider drops the user to the login page.
      if (!res.ok) {
        clearSession();
        return null;
      }

      // FIX 4: removed the unreachable `if (!token) return null` that
      // appeared here in the original code (after the await).
      const data = await res.json();
      return data.success ? data.user : null;
    } catch (err) {
      console.error('Get user error:', err);
      return null;
    }
  },

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
  // FIX 1: wipe ALL possible token keys so no stale JWT can re-authenticate
  // the admin on the next page mount / session-restore call.
  logout: () => {
    clearSession();
  },
};

export default AuthService;