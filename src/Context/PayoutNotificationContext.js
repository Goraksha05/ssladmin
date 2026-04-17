// Context/PayoutNotificationContext.js
//
// Manages real-time reward & payout notifications for admin users.
//
// WHAT IT DOES
// ────────────
// 1. Subscribes to socket events emitted by rewardNotificationService.js
//    (server) on mount:
//      • reward:new_claim         — user claimed a milestone reward
//      • payout:status_changed    — any payout lifecycle transition
//      • payout:bulk_complete     — a bulk payout batch finished
//      • grocery:new_request      — user submitted a grocery redemption
//      • reward:frozen_attempt    — frozen-account claim attempt (security)
//
// 2. Maintains an ordered in-memory notification feed (most recent first).
//    The feed is bounded to MAX_NOTIFICATIONS entries so it never grows unbounded.
//
// 3. Exposes:
//      notifications    — full list (PayoutNotificationItem[])
//      unreadCount      — count of entries where read === false
//      markRead(id)     — mark a single notification read
//      markAllRead()    — mark all read
//      dismiss(id)      — remove a single notification from the feed
//      clearAll()       — wipe the feed
//      isConnected      — whether the admin socket is alive
//
// CONVENTIONS
// ───────────
// • Mirrors the socket-subscription pattern in AdminKycContext.js:
//   uses onSocketEvent() from WebSocketClient (handles "not ready yet" queuing)
//   and calls initializeSocket() once after auth resolves.
// • Does NOT call apiRequest — all data comes from socket pushes so this
//   context stays fast even on slow connections.
// • Error boundaries: every socket handler is wrapped in try/catch so a
//   malformed event payload cannot crash the context.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { toast } from 'react-toastify';
import {
  initializeSocket,
  onSocketEvent,
} from '../WebSocket/WebSocketClient';
import { useAuth } from './AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_NOTIFICATIONS = 100;

// Maps socket event name → human-readable category label + icon
export const EVENT_META = {
  'reward:new_claim': {
    category: 'New Claim',
    icon:     '🎁',
    color:    '#4f46e5',   // indigo
    priority: 'high',
    tab:      '/admin/financial?tab=claims',
  },
  'payout:status_changed': {
    category: 'Payout Update',
    icon:     '📋',
    color:    '#0284c7',   // sky blue
    priority: 'medium',
    tab:      '/admin/financial?tab=payouts',
  },
  'payout:bulk_complete': {
    category: 'Bulk Complete',
    icon:     '⚡',
    color:    '#7c3aed',   // violet
    priority: 'medium',
    tab:      '/admin/financial?tab=payouts',
  },
  'grocery:new_request': {
    category: 'Grocery Redemption',
    icon:     '🛒',
    color:    '#059669',   // emerald
    priority: 'high',
    tab:      '/admin/financial?tab=claims',
  },
  'reward:frozen_attempt': {
    category: 'Security Alert',
    icon:     '🔴',
    color:    '#dc2626',   // red
    priority: 'critical',
    tab:      '/admin/users',
  },
};

const STATUS_ICONS = {
  pending:    '⏳',
  processing: '⚙️',
  paid:       '✅',
  failed:     '❌',
  on_hold:    '🔒',
};

// ── Context ────────────────────────────────────────────────────────────────────
const PayoutNotificationContext = createContext(null);

// ── Provider ───────────────────────────────────────────────────────────────────
export const PayoutNotificationProvider = ({ children }) => {
  const { authtoken, authLoading, user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const [notifications, setNotifications] = useState([]);
  const [isConnected,   setIsConnected]   = useState(false);
  const mountedRef = useRef(true);
  const nextId     = useRef(0);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const push = useCallback((event, payload) => {
    if (!mountedRef.current) return;
    const meta = EVENT_META[event] ?? { category: 'Notification', icon: '📢', color: '#64748b', priority: 'low' };

    const entry = {
      id:        ++nextId.current,
      event,
      payload,
      meta,
      read:      false,
      timestamp: new Date(),
      // Computed display fields
      title:     buildTitle(event, payload),
      body:      buildBody(event, payload),
      actionUrl: buildActionUrl(event, payload),
    };

    setNotifications(prev => [entry, ...prev].slice(0, MAX_NOTIFICATIONS));

    // Toast for critical events
    if (meta.priority === 'critical') {
      toast.error(`${meta.icon} ${entry.title}`, { autoClose: 8000 });
    } else if (meta.priority === 'high') {
      toast.info(`${meta.icon} ${entry.title}`, { autoClose: 5000 });
    }
  }, []);

  // ── Socket subscriptions ───────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (authLoading || !authtoken || !isAdmin) return;

    let unsubs = [];

    initializeSocket().then(() => {
      if (!mountedRef.current) return;
      setIsConnected(true);

      unsubs = [
        onSocketEvent('reward:new_claim',       (d) => { try { push('reward:new_claim', d);       } catch (_) {} }),
        onSocketEvent('payout:status_changed',  (d) => { try { push('payout:status_changed', d);  } catch (_) {} }),
        onSocketEvent('payout:bulk_complete',   (d) => { try { push('payout:bulk_complete', d);   } catch (_) {} }),
        onSocketEvent('grocery:new_request',    (d) => { try { push('grocery:new_request', d);    } catch (_) {} }),
        onSocketEvent('reward:frozen_attempt',  (d) => { try { push('reward:frozen_attempt', d);  } catch (_) {} }),

        // Connection health
        onSocketEvent('connect',    () => { if (mountedRef.current) setIsConnected(true);  }),
        onSocketEvent('disconnect', () => { if (mountedRef.current) setIsConnected(false); }),
      ];
    }).catch(() => {
      setIsConnected(false);
    });

    return () => {
      mountedRef.current = false;
      unsubs.forEach(fn => { try { fn?.(); } catch (_) {} });
    };
  }, [authtoken, authLoading, isAdmin, push]);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const markRead = useCallback((id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Context value ──────────────────────────────────────────────────────────
  return (
    <PayoutNotificationContext.Provider value={{
      notifications,
      unreadCount,
      isConnected,
      markRead,
      markAllRead,
      dismiss,
      clearAll,
      EVENT_META,
      STATUS_ICONS,
    }}>
      {children}
    </PayoutNotificationContext.Provider>
  );
};

// ── Hook ───────────────────────────────────────────────────────────────────────
export const usePayoutNotifications = () => {
  const ctx = useContext(PayoutNotificationContext);
  if (!ctx) throw new Error('usePayoutNotifications must be used inside <PayoutNotificationProvider>');
  return ctx;
};

// ═════════════════════════════════════════════════════════════════════════════
// DISPLAY BUILDERS
// Pure functions — no side effects, no hooks
// ═════════════════════════════════════════════════════════════════════════════

function fmtINR(n) {
  if (typeof n !== 'number') return '₹—';
  return `₹${n.toLocaleString('en-IN')}`;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function buildTitle(event, payload) {
  switch (event) {
    case 'reward:new_claim':
      return `${payload.isHighValue ? '🔴 High-Value ' : ''}New ${capitalize(payload.rewardType)} Claim`;
    case 'payout:status_changed':
      return `Payout ${capitalize(payload.newStatus)}`;
    case 'payout:bulk_complete':
      return `Bulk Payout Complete`;
    case 'grocery:new_request':
      return `Grocery Redemption Request`;
    case 'reward:frozen_attempt':
      return `Frozen Account Claim Attempt`;
    default:
      return 'Reward Notification';
  }
}

function buildBody(event, payload) {
  switch (event) {
    case 'reward:new_claim':
      return `${payload.userName} claimed ${fmtINR(payload.amountINR)} for ${payload.milestone} ${payload.rewardType}s (Plan ₹${payload.planKey})`;
    case 'payout:status_changed': {
      const icon = STATUS_ICONS[payload.newStatus] || '';
      const base = `${payload.userName} — ${fmtINR(payload.amountINR)} ${icon} ${payload.oldStatus} → ${payload.newStatus}`;
      return payload.failureReason ? `${base}. Reason: ${payload.failureReason}` : base;
    }
    case 'payout:bulk_complete':
      return `By ${payload.adminName}: ${payload.processed} processed (${fmtINR(payload.totalINRDispatched)}), ${payload.skipped} skipped, ${payload.failed} failed`;
    case 'grocery:new_request':
      return `${payload.userName} submitted ${fmtINR(payload.amountINR)} grocery cashout request`;
    case 'reward:frozen_attempt':
      return `${payload.userName} tried to claim a ${payload.rewardType} reward (${payload.milestone}) — account is frozen`;
    default:
      return JSON.stringify(payload);
  }
}

function buildActionUrl(event, payload) {
  switch (event) {
    case 'reward:new_claim':       return `/admin/financial?tab=claims`;
    case 'payout:status_changed':  return `/admin/financial?tab=payouts&payoutId=${payload.payoutId}`;
    case 'payout:bulk_complete':   return `/admin/financial?tab=payouts`;
    case 'grocery:new_request':    return `/admin/financial?tab=claims`;
    case 'reward:frozen_attempt':  return `/admin/trust?userId=${payload.userId}`;
    default:                       return `/admin/financial`;
  }
}

export default PayoutNotificationContext;