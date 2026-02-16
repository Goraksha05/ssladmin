import { io } from 'socket.io-client';

let socket = null;
let reconnectAttempts = 0;
let reconnectTimer = null;

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://127.0.0.1:5000";

const getToken = () => {
  const rawToken = localStorage.getItem("token");
  return rawToken ? rawToken.trim().replace(/\s/g, '') : null;
};
// console.log("🧪 Raw token:", JSON.stringify(token));

// const refreshToken = async () => {
//   const token = localStorage.getItem('token');

//   // 🚫 If token is missing, don't even try
//   if (!token) {
//     console.warn("⚠️ Cannot refresh: no token in localStorage");
//     return null;
//   }

//   try {
//     const res = await fetch(`${SERVER_URL}/api/auth/refresh-token`, {
//       method: 'POST',
//       credentials: 'include',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${token}`,
//       },
//     });

//     const data = await res.json();
//     if (res.ok && data?.token) {
//       localStorage.setItem('token', data.token);
//       console.log("🔁 Token refreshed successfully");
//       return data.token;
//     } else {
//       console.warn("🚫 Token refresh failed", data?.message || '');
//       return null;
//     }
//   } catch (err) {
//     console.error("❌ Error refreshing token:", err);
//     return null;
//   }
// };

export const initializeSocket = async () => {
  const token = getToken();

  if (!token || token.split('.').length !== 3) {
    console.warn("🚫 Invalid or missing token. Cannot initialize socket.");
    return null;
  }

  // console.log("📤 Sending cleaned token:", JSON.stringify(token));

  if (socket) return socket;

  socket = io(SERVER_URL, {
    withCredentials: false, // ❌ No cookies needed
    path: "/socket.io",
    transports: ["websocket"],
    autoConnect: false,
    reconnection: false,
    auth: { token },
  });

  attachDefaultListeners(socket);
  socket.connect();

  return socket;
};

const attachDefaultListeners = (sock) => {
  sock.off(); // Clear all previous listeners

  sock.on('connect', () => {
    console.log('✅ Socket connected:', sock.id);
    reconnectAttempts = 0;
    clearTimeout(reconnectTimer);
  });

  sock.on('disconnect', (reason) => {
    console.warn(`⛔ Socket disconnected. Reason: ${reason}`);
    if (reason === "io server disconnect") {
      console.warn("🛑 Disconnected by server. Re-authentication might be required.");
    } else if (reason === "transport close") {
      console.warn("🔌 Network or tab closed.");
    } else if (reason === "ping timeout") {
      console.warn("⏱️ Ping timeout — possible lost connection.");
    }
    attemptReconnection();
  });

  sock.on('connect_error', (err) => {
    console.error('❌ Socket connection error:', err.message);
    attemptReconnection();
  });

  sock.on("online-users", (userIds) => {
    console.log("👥 Online users list updated:", userIds);
  });

  sock.on('notification', (payload) => {
    try {
      if (document.visibilityState === 'hidden' &&
        'Notification' in window &&
        Notification.permission === 'granted') {
        new Notification(payload.title || 'Notification', {
          body: payload.message || '',
          data: { url: payload.url || '/' }
        });
      }
    } catch (e) {
      console.warn('Notification API failed:', e);
    }
  });

  // Log every socket event
  sock.onAny((event, ...args) => {
    console.debug(`📨 Socket event: ${event}`, args);
  });
};

const attemptReconnection = () => {
  const token = getToken();

  if (!token) {
    console.warn("🛑 Stopping reconnection: no token (user likely logged out)");
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000); // exponential backoff

  reconnectTimer = setTimeout(async () => {
    console.log(`🔁 Retrying socket connection #${reconnectAttempts}...`);
    if (!socket) {
      await initializeSocket();
    } else {
      socket.auth = { token };
      attachDefaultListeners(socket);
      socket.connect();
    }
  }, delay);
};

export const reconnectSocket = async () => {
  const token = getToken();

  if (!token) {
    console.warn("🚫 Cannot reconnect: token missing");
    return;
  }

  if (socket) {
    socket.auth = { token };
    if (!socket.connected && typeof socket.connect === 'function') {
      console.log("🔄 Reconnecting existing socket...");
      socket.connect();
    }
  } else {
    console.log("🆕 Initializing new socket...");
    await initializeSocket();
  }
};

export const getSocket = () => socket;

export const isSocketReady = () => !!(socket && socket.connected);

export const safeEmit = (eventName, payload = {}, callback) => {
  const sock = getSocket();
  if (!sock || !sock.connected) {
    console.warn(`⚠️ Socket not connected. Cannot emit '${eventName}'`);
    return;
  }
  if (typeof callback === 'function') {
    sock.emit(eventName, payload, callback);
  } else {
    sock.emit(eventName, payload);
  }
};

export const emitEvent = (eventName, payload = {}, callback) => {
  if (!socket || !socket.connected) {
    console.warn(`⚠️ Cannot emit '${eventName}': socket not connected`);
    return;
  }

  if (typeof callback === 'function') {
    socket.emit(eventName, payload, callback);
  } else {
    socket.emit(eventName, payload);
  }
};

export const disconnectSocket = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (socket) {
    socket.off();
    socket.disconnect();
    socket = null;
    console.log("🔌 Socket manually disconnected");
  }
};

export default getSocket;