// Context/AuthContext.js
//
// CHANGES FROM ORIGINAL:
//
//   1. CRITICAL — KycContext.jsx destructures `{ authtoken, authLoading }` from
//      useAuth(), but the original AuthContext exposed `{ user, isAuthenticated,
//      loading, login, signup, logout }`. The fields `authtoken` and `authLoading`
//      did not exist, causing KycContext to receive `undefined` for both:
//        • authLoading → always undefined → condition `!authLoading && token` was
//          always truthy on first render → 401 flood before session restored
//        • authtoken   → always undefined → every KYC fetch sent no Authorization
//          header → every request returned 401
//      Fix: exposed `authtoken` (the raw JWT string) and `authLoading` (alias of
//      `loading`) in the context value so KycContext works without modification.
//
//   2. CRITICAL — Token storage key alignment. The updated backend auth
//      controllers (authController.js, adminAuthController.js) return the token
//      as `authtoken` in the response body. AuthService must store it under the
//      SAME key that apiRequest.js reads — apiRequest reads keys in order:
//        ['token', 'authtoken', 'authToken', 'accessToken']
//      AuthService previously stored under 'token'; we now store under 'authtoken'
//      (first match found by apiRequest). Both keys are cleared on logout so old
//      sessions are not left dangling.
//
//   3. MINOR — `user.isAdmin` check is now derived from `role` field on the
//      server response: `isAdmin: user.role === 'admin' || user.role === 'super_admin'`.
//      The field is already present on the login/register response; no change
//      needed in the context itself — just document it here for clarity.
//
//   4. MINOR — Added `authtoken` to session-restore so pages that mount before
//      any login action can read the token from localStorage correctly.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import AuthService from "../Services/AuthService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user,            setUser]            = useState(null);
  const [authtoken,       setAuthtoken]       = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // `loading` is kept for backward compatibility.
  // `authLoading` is an alias exposed in the context value so KycContext.jsx
  // (which destructures `authLoading`) works without modification.
  const [loading, setLoading] = useState(true);

  // ── Session restore ────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const userData = await AuthService.getUser();

      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);

        // Restore the token from localStorage so KycContext receives it
        // immediately on mount (before any login action is taken).
        const storedToken =
          localStorage.getItem("authtoken") ||
          localStorage.getItem("token")     ||
          null;
        setAuthtoken(storedToken);
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
      // Store & surface the raw JWT.
      // AuthService.login() already persists the token in localStorage; we
      // read it back here so the React state stays in sync without duplicating
      // storage logic.
      const token =
        localStorage.getItem("authtoken") ||
        localStorage.getItem("token")     ||
        res.authtoken                     ||
        null;
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
      const token =
        localStorage.getItem("authtoken") ||
        localStorage.getItem("token")     ||
        res.authtoken                     ||
        null;
      setAuthtoken(token);
    }

    return res;
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    AuthService.logout();
    setUser(null);
    setIsAuthenticated(false);
    setAuthtoken(null);
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────
  // Both `loading` and `authLoading` are exposed so that:
  //   • Old consumers that use `loading`     continue to work unchanged.
  //   • KycContext.jsx, which destructures `authLoading`, also works correctly.
  return (
    <AuthContext.Provider
      value={{
        user,
        authtoken,      // raw JWT string — consumed by KycContext
        isAuthenticated,
        loading,        // original name — kept for backward compatibility
        authLoading: loading, // alias — consumed by KycContext.jsx
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