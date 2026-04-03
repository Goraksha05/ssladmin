import { io } from "socket.io-client";

/* ─────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────── */
const SERVER_URL =
  process.env.REACT_APP_SERVER_URL || "http://127.0.0.1:5000";

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let socket = null;
const listeners = {};

/* ─────────────────────────────────────────────
   TOKEN HELPERS
───────────────────────────────────────────── */
const getToken = () => {
  const raw = localStorage.getItem("token");
  return raw ? raw.trim().replace(/\s/g, "") : null;
};

const refreshToken = async () => {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${SERVER_URL}/api/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (res.ok && data?.token) {
      localStorage.setItem("token", data.token);
      console.log("🔁 Token refreshed");
      return data.token;
    }

    return null;
  } catch (err) {
    console.error("❌ Token refresh failed:", err);
    return null;
  }
};

/* ─────────────────────────────────────────────
   INITIALIZE SOCKET
───────────────────────────────────────────── */
export const initializeSocket = async () => {
  const token = getToken();

  if (!token || token.split(".").length !== 3) {
    console.warn("🚫 Invalid token. Socket not initialized.");
    return null;
  }

  if (socket) return socket;

  socket = io(SERVER_URL, {
    path: "/socket.io",
    transports: ["websocket"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    auth: { token },
  });

  attachListeners(socket);
  socket.connect();

  return socket;
};

/* ─────────────────────────────────────────────
   CORE LISTENERS
───────────────────────────────────────────── */
const attachListeners = (sock) => {
  sock.off(); // clear previous

  sock.on("connect", () => {
    console.log("✅ Connected:", sock.id);
  });

  sock.on("disconnect", (reason) => {
    console.warn("⛔ Disconnected:", reason);
  });

  /* ── AUTH ERROR HANDLING ── */
  sock.on("connect_error", async (err) => {
    console.warn("⚠️ Socket error:", err.message);

    if (err.message === "jwt expired") {
      const newToken = await refreshToken();

      if (newToken) {
        sock.auth = { token: newToken };
        sock.connect();
      } else {
        console.warn("🔒 Session expired. Logging out.");
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
  });

  /* ── DOMAIN EVENTS ── */
  sock.on("user:online", (data) => emitToSubscribers("user:online", data));

  sock.on("reward:updated", (data) =>
    emitToSubscribers("reward:updated", data)
  );

  sock.on("admin:notification", (payload) => {
    // Global UI event
    window.dispatchEvent(
      new CustomEvent("app:notification", { detail: payload })
    );

    emitToSubscribers("admin:notification", payload);
  });

  /* ── DEBUG LOGGER ── */
  sock.onAny((event, ...args) => {
    console.debug("📨", event, args);
  });
};

/* ─────────────────────────────────────────────
   SUBSCRIPTION SYSTEM (EVENT BUS)
───────────────────────────────────────────── */
export const subscribe = (event, callback) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);

  return () => {
    listeners[event] = listeners[event].filter((cb) => cb !== callback);
  };
};

const emitToSubscribers = (event, payload) => {
  listeners[event]?.forEach((cb) => cb(payload));
};

/* ─────────────────────────────────────────────
   EMIT HELPERS
───────────────────────────────────────────── */
export const emitEvent = (event, payload = {}, cb) => {
  if (!socket || !socket.connected) {
    console.warn(`⚠️ Cannot emit '${event}' — socket not ready`);
    return;
  }

  socket.emit(event, payload, cb);
};

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
export const getSocket = () => socket;

export const isSocketReady = () =>
  !!(socket && socket.connected);

/* ─────────────────────────────────────────────
   RECONNECT
───────────────────────────────────────────── */
export const reconnectSocket = async () => {
  const token = getToken();

  if (!token) {
    console.warn("🚫 No token — cannot reconnect");
    return;
  }

  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
  } else {
    await initializeSocket();
  }
};

/* ─────────────────────────────────────────────
   DISCONNECT
───────────────────────────────────────────── */
export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    console.log("🔌 Socket disconnected");
  }
};

export default getSocket;