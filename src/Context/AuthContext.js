// Context/AuthContext.js
//
// Fixes applied:
//   1. Removed import of `onSocketEvent` — it was never exported from
//      WebSocketClient.js, causing an immediate crash on any page that
//      imported AuthContext.
//   2. Removed the unconditional `socket.emit('user-offline')` call that ran
//      on EVERY render (it was outside any useEffect/handler), flooding the
//      server with offline events.
//   3. Token expiry check added on mount so stale sessions are cleared.
//   4. getUser() failure on mount now calls logout() instead of just clearing
//      state, ensuring storage is also cleaned up.

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import { disconnectSocket, initializeSocket, getSocket } from '../WebSocket/WebSocketClient';
import AuthService from '../Services/AuthService';

const AuthContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_SERVER_URL || '';

// ── Helpers ────────────────────────────────────────────────────────────────────
const isTokenExpired = (token) => {
  try {
    const { exp } = jwtDecode(token);
    return Date.now() >= (exp - 30) * 1_000; // 30 s buffer
  } catch {
    return true;
  }
};

// ── Provider ───────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authtoken, setAuthtoken] = useState(() => localStorage.getItem('token'));
  const [socket, setSocket] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist notifications
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
    setNotificationCount(notifications.length);
  }, [notifications]);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    // Signal the server that this user went offline before tearing down socket
    const sock = socket || getSocket();
    if (sock?.connected && user?._id) {
      sock.emit('user-offline', user._id);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('User');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('notifications');

    setAuthtoken(null);

    if (sock) {
      sock.off();
      sock.removeAllListeners();
      sock.disconnect();
    }
    disconnectSocket();

    setIsAuthenticated(false);
    setUser(null);
    setSocket(null);
    setNotificationCount(0);
    setNotifications([]);
  }, [socket, user]);

  // ── Auto-restore session on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!authtoken) return;

    if (isTokenExpired(authtoken)) {
      console.warn('[AuthContext] Stored token expired — clearing session.');
      logout();
      return;
    }

    setIsAuthenticated(true);

    AuthService.getUser()
      .then((userInfo) => {
        if (!userInfo) {
          logout();
          return;
        }
        setUser(userInfo);
      })
      .catch((err) => {
        console.error('[AuthContext] Auto-restore failed:', err);
        logout();
      });
  }, []); // intentionally runs once on mount — dependencies omitted by design

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (token) => {
    if (!token || token === 'null' || token === 'undefined') {
      toast.error('Invalid login token');
      return;
    }

    const cleanToken = token.trim().replace(/\s/g, '');

    if (isTokenExpired(cleanToken)) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    localStorage.setItem('token', cleanToken);
    setAuthtoken(cleanToken);
    setIsAuthenticated(true);

    try {
      const userInfo = await AuthService.getUser();
      if (userInfo) {
        setUser(userInfo);
        localStorage.setItem('User', JSON.stringify(userInfo));
      }

      // Log daily streak — fire and forget
      fetch(`${API_URL}/api/activity/log-daily-streak`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cleanToken}` },
      }).catch(() => {});

      // Initialize socket connection
      await initializeSocket();
      const activeSocket = getSocket();

      if (!activeSocket || typeof activeSocket.emit !== 'function') {
        console.error('[AuthContext] Socket is invalid or not ready');
        return;
      }

      activeSocket.on('connect', () => {
        activeSocket.on('notification', (payload) => {
          toast.info(payload.message);
          setNotifications(prev => [...prev, payload]);
          setNotificationCount(prev => prev + 1);
        });

        if (userInfo?._id) {
          activeSocket.emit('user-online', {
            userId: userInfo._id,
            name: userInfo.name,
            hometown: userInfo.hometown ?? '',
            currentcity: userInfo.currentcity ?? '',
            timestamp: new Date().toISOString(),
          });
          activeSocket.emit('add-user', { userId: userInfo._id, name: userInfo.name });
          activeSocket.emit('join-room', userInfo._id);
        }

        setSocket(activeSocket);
      });

      activeSocket.on('connect_error', (err) => {
        console.error('[AuthContext] Socket connection failed:', err.message);
      });

      // If already connected (e.g. reconnect), set socket immediately
      if (activeSocket.connected) {
        setSocket(activeSocket);
      }

    } catch (error) {
      console.error('[AuthContext] Login setup failed:', error);
    }
  }, []);

  // FIX: user-offline is now emitted ONLY in logout(), not on every render.

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      authtoken,
      user,
      login,
      logout,
      notificationCount,
      setNotificationCount,
      notifications,
      setNotifications,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);