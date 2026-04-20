// Context/AuthContext.js

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useCallback,
  useRef 
} from "react";
import {
  disconnectSocket,
  initializeSocket,
  getSocket,
  onSocketEvent,
} from '../WebSocket/WebSocketClient';
import AuthService from "../Services/AuthService";

const AuthContext = createContext();

const resolveUserId = (userInfo) =>
  userInfo?.id?.toString() ?? userInfo?._id?.toString() ?? null;

// ── reCAPTCHA reset ───────────────────────────────────────────────────────────
function resetCaptcha() {
  try {
    // window.___grecaptcha_cfg.clients is Google's internal registry of
    // rendered v2 widget instances. It is populated only when a v2 checkbox
    // widget has actually been mounted on the page. On admin pages that use
    // a pure reCAPTCHA v3 flow, no widget is ever rendered, so the registry
    // is empty and calling grecaptcha.reset() throws
    // "No reCAPTCHA clients exist". Guard against that here.
    const clients = window.___grecaptcha_cfg?.clients ?? {};
    if (Object.keys(clients).length === 0) return;

    if (window.grecaptcha?.reset) window.grecaptcha.reset();
  } catch (err) {
    // Silently ignore -- no v2 widget to reset is not an actionable error.
  }
}

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
  
  const socketRef     = useRef(null);
  const offConnectRef = useRef(null);

  // ── Socket setup ────────────────────────────────────────────────────────────
  const setupSocket = useCallback(async (userInfo) => {
    try {
      const sock = await initializeSocket();
      if (!sock) return;
      socketRef.current = sock;

      const onConnect = () => {
        const userId = resolveUserId(userInfo);
        if (!userId) return;
        sock.emit('user-online', {
          userId,
          name:        userInfo.name        ?? '',
          hometown:    userInfo.hometown     ?? '',
          currentcity: userInfo.currentcity  ?? '',
        });
        sock.emit('join-room', userId);
      };

      offConnectRef.current?.(); // remove previous listener if any
      offConnectRef.current = onSocketEvent('connect', onConnect);
      if (sock.connected) onConnect();
    } catch (err) {
      console.error('[AuthContext] setupSocket failed:', err);
    }
  }, []);

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

        await setupSocket(userData);
      }

      setLoading(false);
    };

    init();
  }, [setupSocket]);

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

      await setupSocket(res.user);
    }

    return res;
  }, [setupSocket]);

  // ── Signup ─────────────────────────────────────────────────────────────────
  const signup = useCallback(async (data) => {
    const res = await AuthService.signup(data);

    if (res.success) {
      setUser(res.user);
      setIsAuthenticated(true);

      // FIX 1: same as login() — use res.authtoken directly
      const token = res.authtoken || readStoredToken();
      setAuthtoken(token);

      await setupSocket(res.user);
    }

    return res;
  }, [setupSocket]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  // FIX 2: AuthService.logout() now wipes ALL token keys via clearSession().
  // React state is reset here immediately so the UI re-renders to the
  // logged-out state without waiting for any async operation.
  const logout = useCallback(() => {
    resetCaptcha();

    const sock   = socketRef.current || getSocket();
    const userId = resolveUserId(user);
    if (sock?.connected && userId) {
      sock.emit('user-offline', userId);
    }

    offConnectRef.current?.();
    offConnectRef.current = null;
    disconnectSocket();
    socketRef.current = null;

    AuthService.logout();      // clears all localStorage keys
    setUser(null);
    setIsAuthenticated(false);
    setAuthtoken(null);
  }, [user]);

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