// Context/AuthContext.js
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import { disconnectSocket, initializeSocket, getSocket } from '../WebSocket/WebSocketClient';
import AuthService from '../Services/AuthService';

const AuthContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_SERVER_URL || '';

const isTokenExpired = (token) => {
  try {
    const { exp } = jwtDecode(token);
    return Date.now() >= (exp - 30) * 1_000;
  } catch {
    return true;
  }
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated,   setIsAuthenticated]   = useState(false);
  const [user,              setUser]              = useState(null);
  const [authtoken,         setAuthtoken]         = useState(() => localStorage.getItem('token'));
  const [socket,            setSocket]            = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications,     setNotifications]     = useState(() => {
    try   { const s = localStorage.getItem('notifications'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });

  // KEY FIX: starts `true` when a token exists so route guards do NOT fire
  // before getUser() resolves. Without this, guards see user=null and redirect
  // immediately, causing an infinite "Maximum update depth exceeded" loop.
  const [authLoading, setAuthLoading] = useState(() => !!localStorage.getItem('token'));

  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
    setNotificationCount(notifications.length);
  }, [notifications]);

  const logout = useCallback(() => {
    const sock = socket || getSocket();
    if (sock?.connected && user?._id) sock.emit('user-offline', user._id);
    localStorage.removeItem('token');
    localStorage.removeItem('User');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('notifications');
    setAuthtoken(null);
    if (sock) { sock.off(); sock.removeAllListeners(); sock.disconnect(); }
    disconnectSocket();
    setIsAuthenticated(false);
    setUser(null);
    setSocket(null);
    setNotificationCount(0);
    setNotifications([]);
  }, [socket, user]);

  // Auto-restore session on mount
  useEffect(() => {
    if (!authtoken) {
      setAuthLoading(false);
      return;
    }
    if (isTokenExpired(authtoken)) {
      console.warn('[AuthContext] Stored token expired — clearing session.');
      logout();
      setAuthLoading(false);
      return;
    }

    setIsAuthenticated(true);

    AuthService.getUser()
      .then((userInfo) => {
        if (!userInfo) { logout(); return; }
        setUser(userInfo);
      })
      .catch((err) => {
        console.error('[AuthContext] Auto-restore failed:', err);
        logout();
      })
      .finally(() => {
        setAuthLoading(false); // hydration done — route guards may now evaluate
      });
  }, []); // mount-only: intentionally runs once, no deps needed

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

      fetch(`${API_URL}/api/activity/log-daily-streak`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cleanToken}` },
      }).catch(() => {});

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
            userId: userInfo._id, name: userInfo.name,
            hometown: userInfo.hometown ?? '', currentcity: userInfo.currentcity ?? '',
            timestamp: new Date().toISOString(),
          });
          activeSocket.emit('add-user',  { userId: userInfo._id, name: userInfo.name });
          activeSocket.emit('join-room', userInfo._id);
        }
        setSocket(activeSocket);
      });

      activeSocket.on('connect_error', (err) => {
        console.error('[AuthContext] Socket connection failed:', err.message);
      });

      if (activeSocket.connected) setSocket(activeSocket);
    } catch (error) {
      console.error('[AuthContext] Login setup failed:', error);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      authLoading,
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