// src/WebSocket/WebSocketClient.js
//
// ONE file — shared by both the User Panel and the Admin Panel.
//
// The only change from the user-panel version is in getToken():
//   The user panel stores the JWT under "token".
//   The admin panel (AuthContext.js) stores it under "authtoken".
//   getToken() now checks both keys in priority order so initializeSocket()
//   works regardless of which panel is running, with no other logic changed.
//
// Everything else (pending-subscription queue, exponential back-off,
// BroadcastChannel multi-tab sync, onSocketEvent, safeEmit) is untouched
// from the user-panel version.

import { io } from "socket.io-client";

// ─── Config ──────────────────────────────────────────────────────────────────
const SERVER_URL =
  process.env.REACT_APP_SERVER_URL  ||
  process.env.REACT_APP_BACKEND_URL ||
  "http://127.0.0.1:5000";

// ─── Module-level state ──────────────────────────────────────────────────────
let socket            = null;
let reconnectTimer    = null;
let reconnectAttempts = 0;

// ── Pending-subscription queue ────────────────────────────────────────────────
// When onSocketEvent() is called before the socket exists, the subscription is
// stored here. flushPendingSubscriptions() drains the queue onto the socket
// the moment the socket connects.
const _pendingSubscriptions = []; // Array<{ event, handler, unsub: {current} }>

function flushPendingSubscriptions() {
  if (!socket) return;
  // Capture into a block-scoped const so closures created inside the loop
  // reference a stable value, not the mutable module-level `socket` variable.
  const sock = socket;
  while (_pendingSubscriptions.length > 0) {
    const sub = _pendingSubscriptions.shift();
    sock.on(sub.event, sub.handler);
    // Patch the live unsubscribe ref so the caller's cleanup still works.
    sub.unsub.current = () => sock.off(sub.event, sub.handler);
  }
}

// BroadcastChannel keeps other tabs informed of connect/disconnect events.
let broadcastChannel = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    broadcastChannel = new BroadcastChannel("ssl_socket_presence");
  }
} catch {
  // Not supported — gracefully degrade.
}

// ─── Token helpers ────────────────────────────────────────────────────────────
// CHANGE: checks all localStorage keys that either panel's AuthContext may use.
//
// Priority order:
//   "authtoken"   — written by the admin AuthContext (primary admin key)
//   "token"       — written by the user AuthService  (primary user key)
//   "authToken"   — camelCase variant used by some older code paths
//   "accessToken" — future-proofing / third-party auth libraries
//
// apiRequest.js reads the same keys in the same order, so there is one
// consistent token-lookup convention across the entire frontend.
function getToken() {
  try {
    const raw =
      localStorage.getItem("authtoken")   ||
      localStorage.getItem("token")       ||
      localStorage.getItem("authToken")   ||
      localStorage.getItem("accessToken");
    if (!raw || raw === "null" || raw === "undefined") return null;
    return raw.trim().replace(/\s/g, "");
  } catch {
    return null;
  }
}

// Determine which localStorage key is currently holding the live token so
// refreshToken() can write the new value back to the same key.
function getActiveTokenKey() {
  const keys = ["authtoken", "token", "authToken", "accessToken"];
  return keys.find((k) => {
    const v = localStorage.getItem(k);
    return v && v !== "null" && v !== "undefined";
  }) || "token";
}

function isValidToken(t) {
  return !!t && t.split(".").length === 3;
}

async function refreshToken() {
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
      // Write the refreshed token back under whichever key was active.
      localStorage.setItem(getActiveTokenKey(), data.token);
      console.log("[Socket] 🔁 Token refreshed");
      return data.token;
    }

    return null;
  } catch (err) {
    console.error("[Socket] ❌ Token refresh failed:", err);
    return null;
  }
}

// ─── Core listener management ─────────────────────────────────────────────────
// We track the core listeners we register ourselves so we can replace them
// on reconnect without touching app-level listeners added by chat components.
const CORE_EVENTS = ["connect", "disconnect", "connect_error", "notification", "online-users"];
const _coreHandlers = {};

function detachCoreListeners(sock) {
  CORE_EVENTS.forEach((evt) => {
    if (_coreHandlers[evt]) {
      sock.off(evt, _coreHandlers[evt]);
      delete _coreHandlers[evt];
    }
  });
}

function attachCoreListeners(sock) {
  detachCoreListeners(sock); // swap out old handlers only

  _coreHandlers["connect"] = () => {
    console.log("[Socket] ✅ Connected:", sock.id);
    reconnectAttempts = 0;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    broadcastChannel?.postMessage({ type: "connected", socketId: sock.id });
    // Only place flushPendingSubscriptions() is called — prevents double-registration.
    flushPendingSubscriptions();
  };

  _coreHandlers["disconnect"] = (reason) => {
    const isExpected =
      reason === "transport close" || reason === "io client disconnect";
    if (isExpected) {
      console.debug("[Socket] Disconnected:", reason);
    } else {
      console.warn("[Socket] ⛔ Disconnected unexpectedly:", reason);
    }
    broadcastChannel?.postMessage({ type: "disconnected", reason });
    // Do not reconnect on explicit client disconnect (logout).
    if (reason !== "io client disconnect") {
      scheduleReconnect();
    }
  };

  _coreHandlers["connect_error"] = async (err) => {
    console.error("[Socket] ⚠️ Connection error:", err.message);

    if (err.message === "jwt expired") {
      const newToken = await refreshToken();
      if (newToken) {
        sock.auth = { token: newToken };
        sock.connect();
      } else {
        console.warn("[Socket] 🔒 Session expired — redirecting to login.");
        // Clear all token variants so nothing stale survives.
        ["authtoken", "token", "authToken", "accessToken"].forEach((k) =>
          localStorage.removeItem(k)
        );
        window.location.href = "/login";
      }
    } else {
      scheduleReconnect();
    }
  };

  // Native browser notification when the tab is hidden.
  _coreHandlers["notification"] = (payload) => {
    try {
      if (
        document.visibilityState === "hidden" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(payload.title || "SoShoLife", {
          body: payload.message || "",
          data: { url: payload.url || "/" },
        });
      }
    } catch {
      // Notification API unavailable — ignore.
    }
  };

  _coreHandlers["online-users"] = (userIds) => {
    console.debug("[Socket] online-users count:", userIds?.length);
  };

  CORE_EVENTS.forEach((evt) => {
    sock.on(evt, _coreHandlers[evt]);
  });
}

// ─── Reconnect with exponential back-off ──────────────────────────────────────
function scheduleReconnect() {
  if (reconnectTimer) return; // already scheduled

  reconnectAttempts++;
  const delay = Math.min(1_000 * 2 ** reconnectAttempts, 30_000); // cap 30 s
  console.log(`[Socket] Scheduling reconnect #${reconnectAttempts} in ${delay}ms`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    // Read the token at fire-time so a login during the back-off window
    // supplies a fresh token instead of a stale one captured at schedule-time.
    const token = getToken();
    if (!token) {
      console.warn("[Socket] No token at reconnect time — reconnect aborted");
      return;
    }
    if (socket) {
      socket.auth = { token };
      attachCoreListeners(socket);
      socket.connect();
    } else {
      await initializeSocket();
    }
  }, delay);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create (or return) the socket singleton.
 * Safe to call multiple times — returns the existing socket if already
 * initialised. Both panels call this after confirming authtoken is present.
 */
export const initializeSocket = async () => {
  const token = getToken();
  if (!isValidToken(token)) {
    console.warn("[Socket] 🚫 Invalid/missing token — aborting initialisation");
    return null;
  }

  if (socket?.connected) {
    flushPendingSubscriptions();
    return socket;
  }

  // Socket exists but is disconnected — reconnect it in place.
  if (socket) {
    socket.auth = { token };
    attachCoreListeners(socket);
    socket.connect();
    return socket;
  }

  socket = io(SERVER_URL, {
    path:            "/socket.io",
    transports:      ["websocket"],
    autoConnect:     false,
    reconnection:    false,   // manual exponential back-off via scheduleReconnect
    auth:            { token },
    withCredentials: false,
  });

  attachCoreListeners(socket);
  socket.connect();
  return socket;
};

/**
 * Reconnect an existing socket (e.g. after login or token refresh).
 * Creates a new socket if none exists.
 */
export const reconnectSocket = async () => {
  const token = getToken();
  if (!isValidToken(token)) {
    console.warn("[Socket] Cannot reconnect — token missing or invalid");
    return;
  }
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) {
      attachCoreListeners(socket);
      socket.connect();
    } else {
      flushPendingSubscriptions();
    }
  } else {
    await initializeSocket();
  }
};

/** Return the current socket instance (may be null before initialisation). */
export const getSocket = () => socket;

/** True only when the socket exists and is currently connected. */
export const isSocketReady = () => !!(socket?.connected);

/**
 * Emit safely — logs a warning instead of throwing if the socket is not ready.
 */
export const safeEmit = (event, payload = {}, callback) => {
  if (!isSocketReady()) {
    console.warn(`[Socket] Not connected — cannot emit '${event}'`);
    return false;
  }
  if (typeof callback === "function") {
    socket.emit(event, payload, callback);
  } else {
    socket.emit(event, payload);
  }
  return true;
};

// Alias kept for backward-compatibility with older call sites.
export const emitEvent = safeEmit;

/**
 * Fully disconnect and destroy the socket singleton.
 * Call on logout — clears all listeners and prevents reconnect.
 */
export const disconnectSocket = () => {
  clearTimeout(reconnectTimer);
  reconnectTimer    = null;
  reconnectAttempts = 0;
  _pendingSubscriptions.splice(0);

  if (socket) {
    detachCoreListeners(socket);
    socket.removeAllListeners(); // full teardown — safe on logout
    socket.disconnect();
    socket = null;
    broadcastChannel?.postMessage({ type: "disconnected", reason: "logout" });
    console.log("[Socket] 🔌 Manually disconnected and cleared.");
  }
};

/**
 * Subscribe to a socket event safely.
 * Returns an unsubscribe function — always call it in useEffect cleanup.
 *
 * If the socket is null at call time, the subscription is queued and applied
 * the moment the socket connects. The returned cleanup works in both paths.
 *
 *   useEffect(() => {
 *     return onSocketEvent("receive_message", handler);
 *   }, []);
 */
export const onSocketEvent = (event, handler) => {
  if (socket) {
    socket.on(event, handler);
    return () => socket?.off(event, handler);
  }

  // Slow path: socket not ready yet — queue the subscription.
  const unsub = { current: () => {} };
  _pendingSubscriptions.push({ event, handler, unsub });
  return () => unsub.current();
};

export default getSocket;