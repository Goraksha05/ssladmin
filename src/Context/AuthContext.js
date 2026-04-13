// Context/AuthContext.js

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import AuthService from "../Services/AuthService";

const AuthContext = createContext();

// Keys to read during session-restore (ordered by priority — matches apiRequest.js)
const TOKEN_KEYS = ['authtoken', 'token', 'authToken', 'accessToken'];

function readStoredToken() {
  for (const key of TOKEN_KEYS) {
    const val = localStorage.getItem(key);
    if (val && val !== 'null' && val !== 'undefined') return val;
  }
  return null;
}

export const AuthProvider = ({ children }) => {
  const [user,            setUser]            = useState(null);
  const [authtoken,       setAuthtoken]       = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading,         setLoading]         = useState(true);

  // ── Session restore ────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const userData = await AuthService.getUser();

      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);

        // FIX 3: only set token state when a real token is actually present.
        const storedToken = readStoredToken();
        if (storedToken) setAuthtoken(storedToken);
      }

      setLoading(false);
    };

    init();
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (credentials) => {
    const res = await AuthService.login(credentials);

    if (res.success) {
      setUser(res.user);
      setIsAuthenticated(true);

      // FIX 1: AuthService.login() now returns { authtoken } directly.
      // Prefer that over a localStorage re-read to avoid any timing gap.
      const token = res.authtoken || readStoredToken();
      setAuthtoken(token);
    }

    return res;
  }, []);

  // ── Signup ─────────────────────────────────────────────────────────────────
  const signup = useCallback(async (data) => {
    const res = await AuthService.signup(data);

    if (res.success) {
      setUser(res.user);
      setIsAuthenticated(true);

      // FIX 1: same as login() — use res.authtoken directly
      const token = res.authtoken || readStoredToken();
      setAuthtoken(token);
    }

    return res;
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  // FIX 2: AuthService.logout() now wipes ALL token keys via clearSession().
  // React state is reset here immediately so the UI re-renders to the
  // logged-out state without waiting for any async operation.
  const logout = useCallback(() => {
    AuthService.logout();      // clears all localStorage keys
    setUser(null);
    setIsAuthenticated(false);
    setAuthtoken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authtoken,
        isAuthenticated,
        loading,
        authLoading: loading,  // alias for KycContext.jsx compatibility
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);