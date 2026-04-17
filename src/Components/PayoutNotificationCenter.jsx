// Components/Admin/PayoutNotificationCenter.jsx
//
// Reward & Payout real-time notification center for admin users.
//
// Exports:
//   PayoutNotificationBell   — icon button for the navbar (shows unread badge)
//   PayoutNotificationDrawer — slide-in side panel with the full feed
//   PayoutNotificationCenter — convenience wrapper (Bell + Drawer)
//
// Usage in AdminLayout / Navbar:
//   import { PayoutNotificationCenter } from './PayoutNotificationCenter';
//   <PayoutNotificationCenter />
//
// Wire-up required (App.js or AdminLayout):
//   Wrap the admin subtree with <PayoutNotificationProvider>:
//   import { PayoutNotificationProvider } from '../../Context/PayoutNotificationContext';
//   <PayoutNotificationProvider>
//     <AdminLayout />
//   </PayoutNotificationProvider>

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayoutNotifications, EVENT_META, /*STATUS_ICONS*/ } from '../Context/PayoutNotificationContext';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — scoped via CSS custom properties, injected once
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = `
/* ── PayoutNotificationCenter ─────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Syne:wght@500;600;700&display=swap');

:root {
  --pnc-font-ui:   'Syne', sans-serif;
  --pnc-font-mono: 'JetBrains Mono', monospace;
  --pnc-radius:    12px;
  --pnc-shadow:    0 24px 64px rgba(0,0,0,.22), 0 8px 24px rgba(0,0,0,.14);

  /* Category colors */
  --pnc-claim:   #4f46e5;
  --pnc-payout:  #0284c7;
  --pnc-bulk:    #7c3aed;
  --pnc-grocery: #059669;
  --pnc-alert:   #dc2626;
  --pnc-neutral: #64748b;
}

/* ── Bell button ────────────────────────────────────────────── */
.pnc-bell {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .18s, transform .18s;
  color: inherit;
}
.pnc-bell:hover { background: rgba(99,102,241,.1); transform: scale(1.1); }
.pnc-bell:active { transform: scale(.95); }

.pnc-bell svg { width: 24px; height: 24px; }

.pnc-bell-ring { animation: pnc-ring .6s cubic-bezier(.36,.07,.19,.97); }
@keyframes pnc-ring {
  0%,100% { transform: rotate(0deg); }
  15%      { transform: rotate(14deg); }
  30%      { transform: rotate(-12deg); }
  45%      { transform: rotate(10deg); }
  60%      { transform: rotate(-8deg); }
  75%      { transform: rotate(5deg); }
}

/* Badge */
.pnc-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--pnc-alert);
  color: #fff;
  font-family: var(--pnc-font-mono);
  font-size: 10px;
  font-weight: 500;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  box-shadow: 0 0 0 2px #fff;
  animation: pnc-badge-pop .25s cubic-bezier(.34,1.56,.64,1);
}
@keyframes pnc-badge-pop {
  from { transform: scale(0); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

.pnc-dot { /* connected indicator */
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 2px solid #fff;
}
.pnc-dot--on  { background: #22c55e; }
.pnc-dot--off { background: var(--pnc-neutral); }

/* ── Overlay ─────────────────────────────────────────────────── */
.pnc-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.18);
  backdrop-filter: blur(2px);
  z-index: 998;
  animation: pnc-fade-in .18s ease;
}
@keyframes pnc-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Drawer ──────────────────────────────────────────────────── */
.pnc-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 100vw);
  background: var(--bg, #fff);
  border-left: 1px solid var(--border-color, #e5e7eb);
  box-shadow: var(--pnc-shadow);
  z-index: 999;
  display: flex;
  flex-direction: column;
  font-family: var(--pnc-font-ui);
  overflow: hidden;
  animation: pnc-slide-in .26s cubic-bezier(.22,1,.36,1);
}
@keyframes pnc-slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

/* ── Header ──────────────────────────────────────────────────── */
.pnc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  flex-shrink: 0;
}
.pnc-header__title {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -.02em;
  color: var(--text, #111);
  flex: 1;
}
.pnc-header__count {
  font-family: var(--pnc-font-mono);
  font-size: .78rem;
  color: var(--pnc-neutral);
  background: var(--bg-muted, #f1f5f9);
  padding: 2px 8px;
  border-radius: 999px;
}
.pnc-header__actions {
  display: flex;
  gap: 6px;
}
.pnc-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: .8rem;
  color: var(--pnc-neutral);
  padding: 5px 8px;
  border-radius: 6px;
  transition: background .15s, color .15s;
  font-family: var(--pnc-font-ui);
  white-space: nowrap;
}
.pnc-icon-btn:hover { background: var(--bg-muted, #f1f5f9); color: var(--text, #111); }
.pnc-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  color: var(--pnc-neutral);
  padding: 4px 6px;
  border-radius: 6px;
  line-height: 1;
  transition: background .15s;
}
.pnc-close-btn:hover { background: var(--bg-muted, #f1f5f9); }

/* ── Connection status bar ───────────────────────────────────── */
.pnc-status-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 20px;
  font-size: .73rem;
  font-family: var(--pnc-font-mono);
  color: var(--pnc-neutral);
  background: var(--bg-muted, #f8fafc);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  flex-shrink: 0;
}
.pnc-status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pnc-status-dot--on  { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.15); animation: pnc-pulse 2s infinite; }
.pnc-status-dot--off { background: #94a3b8; }
@keyframes pnc-pulse {
  0%,100% { box-shadow: 0 0 0 3px rgba(34,197,94,.15); }
  50%     { box-shadow: 0 0 0 5px rgba(34,197,94,.05); }
}

/* ── Filters bar ─────────────────────────────────────────────── */
.pnc-filters {
  display: flex;
  gap: 6px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: none;
}
.pnc-filters::-webkit-scrollbar { display: none; }
.pnc-filter-chip {
  background: var(--bg-muted, #f1f5f9);
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: .74rem;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
  font-family: var(--pnc-font-ui);
  color: var(--text-muted, #475569);
}
.pnc-filter-chip:hover { border-color: var(--border-color, #e2e8f0); }
.pnc-filter-chip--active {
  color: #fff;
  border-color: transparent;
}

/* ── Feed ────────────────────────────────────────────────────── */
.pnc-feed {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.pnc-feed::-webkit-scrollbar { width: 4px; }
.pnc-feed::-webkit-scrollbar-thumb { background: var(--border-color, #e2e8f0); border-radius: 2px; }

.pnc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 260px;
  gap: 8px;
  color: var(--pnc-neutral);
  font-size: .88rem;
}
.pnc-empty__icon { font-size: 2.4rem; opacity: .4; }

/* ── Notification card ───────────────────────────────────────── */
.pnc-card {
  display: flex;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color, #f1f5f9);
  cursor: pointer;
  transition: background .14s;
  position: relative;
  animation: pnc-card-in .22s ease;
}
@keyframes pnc-card-in {
  from { opacity: 0; transform: translateX(8px); }
  to   { opacity: 1; transform: translateX(0); }
}
.pnc-card:hover { background: var(--bg-muted, #f8fafc); }
.pnc-card--unread::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--pnc-accent, #4f46e5);
}
.pnc-card--critical { background: #fff5f5; }
.pnc-card--critical:hover { background: #fee2e2; }

.pnc-card__icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  flex-shrink: 0;
}
.pnc-card__body { flex: 1; min-width: 0; }
.pnc-card__top {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 2px;
}
.pnc-card__title {
  font-size: .85rem;
  font-weight: 700;
  color: var(--text, #111);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pnc-card__time {
  font-family: var(--pnc-font-mono);
  font-size: .7rem;
  color: var(--pnc-neutral);
  flex-shrink: 0;
}
.pnc-card__desc {
  font-size: .8rem;
  color: var(--text-muted, #475569);
  line-height: 1.45;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.pnc-card__footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}
.pnc-chip {
  font-size: .68rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  font-family: var(--pnc-font-ui);
}
.pnc-chip--priority-critical { background: #fee2e2; color: #991b1b; }
.pnc-chip--priority-high     { background: #e0e7ff; color: #3730a3; }
.pnc-chip--priority-medium   { background: #dbeafe; color: #1e40af; }
.pnc-chip--priority-low      { background: var(--bg-muted, #f1f5f9); color: var(--pnc-neutral); }

.pnc-card__dismiss {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--pnc-neutral);
  font-size: .8rem;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background .14s;
  margin-left: auto;
  opacity: 0;
  transition: opacity .14s;
}
.pnc-card:hover .pnc-card__dismiss { opacity: 1; }
.pnc-card__dismiss:hover { background: var(--bg-muted, #f1f5f9); }

/* ── Amount pill ─────────────────────────────────────────────── */
.pnc-amount {
  font-family: var(--pnc-font-mono);
  font-size: .72rem;
  font-weight: 500;
  background: #f0fdf4;
  color: #166534;
  padding: 2px 7px;
  border-radius: 999px;
}

/* ── Status transition badge ─────────────────────────────────── */
.pnc-transition {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--pnc-font-mono);
  font-size: .68rem;
  background: var(--bg-muted, #f1f5f9);
  padding: 2px 7px;
  border-radius: 6px;
  color: var(--text-muted, #475569);
}

/* ── Scrollbar polish ─────────────────────────────────────────── */
`;

// Inject styles once
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = STYLES;
  document.head.appendChild(el);
  stylesInjected = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { id: 'all',                    label: 'All' },
  { id: 'reward:new_claim',       label: '🎁 Claims' },
  { id: 'payout:status_changed',  label: '📋 Payouts' },
  { id: 'grocery:new_request',    label: '🛒 Grocery' },
  { id: 'payout:bulk_complete',   label: '⚡ Bulk' },
  { id: 'reward:frozen_attempt',  label: '🔴 Alerts' },
];

function timeAgo(date) {
  const secs = Math.floor((Date.now() - new Date(date)) / 1000);
  if (secs < 60)  return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function fmtINR(n) {
  if (typeof n !== 'number') return null;
  return `₹${n.toLocaleString('en-IN')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION CARD
// ─────────────────────────────────────────────────────────────────────────────

const NotificationCard = ({ notif, onMarkRead, onDismiss, onNavigate }) => {
  const { event, payload, meta, read, timestamp, title, body, actionUrl } = notif;
  const isCritical = meta.priority === 'critical';

  const handleClick = () => {
    onMarkRead(notif.id);
    onNavigate(actionUrl);
  };

  // Extract amount for display
  const amount = payload?.amountINR ?? payload?.totalINRDispatched ?? null;

  return (
    <div
      className={`pnc-card${!read ? ' pnc-card--unread' : ''}${isCritical ? ' pnc-card--critical' : ''}`}
      style={{ '--pnc-accent': meta.color }}
      onClick={handleClick}
    >
      {/* Icon */}
      <div
        className="pnc-card__icon-wrap"
        style={{ background: `${meta.color}18` }}
      >
        {meta.icon}
      </div>

      {/* Body */}
      <div className="pnc-card__body">
        <div className="pnc-card__top">
          <span className="pnc-card__title">{title}</span>
          <span className="pnc-card__time">{timeAgo(timestamp)}</span>
        </div>
        <div className="pnc-card__desc">{body}</div>

        {/* Footer chips */}
        <div className="pnc-card__footer">
          {/* Category */}
          <span
            className="pnc-chip"
            style={{ background: `${meta.color}18`, color: meta.color }}
          >
            {meta.category}
          </span>

          {/* Priority */}
          <span className={`pnc-chip pnc-chip--priority-${meta.priority}`}>
            {meta.priority}
          </span>

          {/* Amount */}
          {amount !== null && fmtINR(amount) && (
            <span className="pnc-amount">{fmtINR(amount)}</span>
          )}

          {/* Status transition for payout:status_changed */}
          {event === 'payout:status_changed' && payload?.oldStatus && (
            <span className="pnc-transition">
              {payload.oldStatus} → {payload.newStatus}
            </span>
          )}

          {/* Dismiss */}
          <button
            className="pnc-card__dismiss"
            onClick={(e) => { e.stopPropagation(); onDismiss(notif.id); }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DRAWER
// ─────────────────────────────────────────────────────────────────────────────

export const PayoutNotificationDrawer = ({ open, onClose }) => {
  injectStyles();
  const navigate = useNavigate();
  const {
    notifications, unreadCount, isConnected,
    markRead, markAllRead, dismiss, clearAll,
  } = usePayoutNotifications();

  const [activeFilter, setActiveFilter] = useState('all');

  const filtered = activeFilter === 'all'
    ? notifications
    : notifications.filter(n => n.event === activeFilter);

  const handleNavigate = useCallback((url) => {
    onClose();
    navigate(url);
  }, [navigate, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="pnc-overlay" onClick={onClose} />
      <aside className="pnc-drawer" role="dialog" aria-label="Reward & Payout Notifications">

        {/* Header */}
        <div className="pnc-header">
          <span style={{ fontSize: '1.2rem' }}>🔔</span>
          <h2 className="pnc-header__title">Reward Notifications</h2>
          {unreadCount > 0 && (
            <span className="pnc-header__count">{unreadCount} unread</span>
          )}
          <div className="pnc-header__actions">
            {unreadCount > 0 && (
              <button className="pnc-icon-btn" onClick={markAllRead} title="Mark all read">
                ✓ Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button className="pnc-icon-btn" onClick={clearAll} title="Clear all">
                🗑 Clear
              </button>
            )}
            <button className="pnc-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Connection status */}
        <div className="pnc-status-bar">
          <span className={`pnc-status-dot pnc-status-dot--${isConnected ? 'on' : 'off'}`} />
          {isConnected ? 'Live — real-time updates active' : 'Offline — reconnecting…'}
        </div>

        {/* Filters */}
        <div className="pnc-filters">
          {FILTER_OPTIONS.map(opt => {
            const count = opt.id === 'all'
              ? notifications.length
              : notifications.filter(n => n.event === opt.id).length;
            if (opt.id !== 'all' && count === 0) return null;
            return (
              <button
                key={opt.id}
                className={`pnc-filter-chip${activeFilter === opt.id ? ' pnc-filter-chip--active' : ''}`}
                style={activeFilter === opt.id
                  ? { background: EVENT_META[opt.id]?.color ?? '#4f46e5' }
                  : {}
                }
                onClick={() => setActiveFilter(opt.id)}
              >
                {opt.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        {/* Feed */}
        <div className="pnc-feed">
          {filtered.length === 0 ? (
            <div className="pnc-empty">
              <span className="pnc-empty__icon">📭</span>
              <span>No notifications yet</span>
              <span style={{ fontSize: '.75rem', opacity: .6 }}>
                Reward claims and payout updates will appear here
              </span>
            </div>
          ) : (
            filtered.map(n => (
              <NotificationCard
                key={n.id}
                notif={n}
                onMarkRead={markRead}
                onDismiss={dismiss}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BELL BUTTON
// ─────────────────────────────────────────────────────────────────────────────

export const PayoutNotificationBell = ({ onClick }) => {
  injectStyles();
  const { unreadCount, isConnected } = usePayoutNotifications();
  const [ring, setRing] = useState(false);
  const prevCount = useRef(unreadCount);

  // Ring animation when count increases
  useEffect(() => {
    if (unreadCount > prevCount.current) {
      setRing(true);
      const t = setTimeout(() => setRing(false), 700);
      return () => clearTimeout(t);
    }
    prevCount.current = unreadCount;
  }, [unreadCount]);

  return (
    <button
      className={`pnc-bell${ring ? ' pnc-bell-ring' : ''}`}
      onClick={onClick}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      title="Reward & Payout Notifications"
    >
      {/* Bell SVG */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="pnc-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      {/* Connection dot */}
      <span className={`pnc-dot pnc-dot--${isConnected ? 'on' : 'off'}`} />
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const PayoutNotificationCenter = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PayoutNotificationBell onClick={() => setOpen(true)} />
      <PayoutNotificationDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default PayoutNotificationCenter;