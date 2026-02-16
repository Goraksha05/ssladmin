import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import { disconnectSocket, initializeSocket, getSocket } from '../WebSocket/WebSocketClient';
import AuthService from '../Services/AuthService';

const AuthContext = createContext();
const API_URL = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_SERVER_URL;

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authtoken, setAuthtoken] = useState(localStorage.getItem('token'));
  const [socket, setSocket] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notifications');
    return saved ? JSON.parse(saved) : [];
  });
  
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
    setNotificationCount(notifications.length);
  }, [notifications]);
  
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('User');
    localStorage.removeItem('refreshToken');
    setAuthtoken(null);
  
  
    if (socket) {
      socket.off();
      socket.removeAllListeners();
      socket.disconnect();
    }
    disconnectSocket();
    setIsAuthenticated(false);
    setUser(null);
    setSocket(null);
    setNotificationCount(0);
    setNotifications([]);
    localStorage.removeItem('notifications');
  }, [socket]);

  useEffect(() => {
    if (authtoken) {
      setIsAuthenticated(true);
      AuthService.getUser()
        .then((userInfo) => setUser(userInfo))
        .catch((err) => {
          console.error('Failed to auto-fetch user:', err);
          setIsAuthenticated(false);
          setAuthtoken(null);
          localStorage.removeItem('token');
        });

      // console.log("🪪 Token being sent to socket:", authtoken);
    }
  }, [authtoken, logout]);

  const login = useCallback(async (token) => {
    if (!token || token === 'null' || token === 'undefined') {
      console.warn("❌ Invalid token received at login:", token);
      toast.error("Invalid login token");
      return;
    }

    localStorage.setItem('token', token);
    setAuthtoken(token);
    setIsAuthenticated(true);

    try {
      const decoded = jwtDecode(token);
      const userId = decoded?.user?.id;
      const userRole = decoded?.user?.role;

      console.log("🔐 Decoded JWT:", decoded);
      console.log("🔐 Role from token:", userRole);

      if (!userId) {
        console.error("Invalid token: no user ID found");
        return;
      }

      const userInfo = await AuthService.getUser();
      setUser(userInfo);
      localStorage.setItem('User', JSON.stringify(userInfo));

      await fetch(`${API_URL}/api/activity/log-daily-streak`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      // Initialize socket connection
      await initializeSocket(); // Internally sets up socket with auth
      const activeSocket = getSocket();

      if (!activeSocket || typeof activeSocket.emit !== 'function') {
        console.error("❌ Socket is invalid or not ready:", activeSocket);
        return;
      }

      activeSocket.on('connect', () => {
        // console.log('✅ Socket connected:', activeSocket.id);

        activeSocket.on('notification', (payload) => {
          console.log('🔔 Notification:', payload);
          toast.info(payload.message);
          setNotifications(prev => [...prev, payload]);
          setNotificationCount(prev => prev + 1);
        });

        if (userInfo && userInfo._id) {
          const payload = {
            userId: userInfo._id,
            name: userInfo.name,
            hometown: userInfo.hometown,
            currentcity: userInfo.currentcity,
            timestamp: new Date().toISOString(),
          };

          activeSocket.emit('user-online', payload);
          activeSocket.emit('add-user', payload);
          activeSocket.emit('join-room', userInfo._id);
          console.log('📡 Emitted user-online and joined room:', userInfo._id);
        }

        setSocket(activeSocket);
      });

      activeSocket.on('connect_error', (err) => {
        console.error('❌ Socket connection failed:', err.message);
      });

    } catch (error) {
      console.error("Login setup failed in AuthContext:", error);
    }
  }, []);

  if (user?._id && socket?.connected) {
    socket.emit('user-offline', user._id);
  }


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
      setNotifications
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
