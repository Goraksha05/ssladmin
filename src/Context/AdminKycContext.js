// src/Context/AdminKycContext.js
//
// Provides KYC records and real-time stats to the admin dashboard.
//
// Socket strategy — uses onSocketEvent() from the shared WebSocketClient:
//   onSocketEvent() is the safe subscription API introduced in the user-panel
//   WebSocketClient. It handles the "socket not ready yet" case by queuing
//   the subscription internally and flushing it the moment the socket connects,
//   so this context no longer needs its own retry loop.
//
//   initializeSocket() is still called once after auth is confirmed to
//   bootstrap the connection if nothing else has done so yet (idempotent).

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import apiRequest from '../utils/apiRequest';
import {
  initializeSocket,
  safeEmit,
  onSocketEvent,
} from '../WebSocket/WebSocketClient';
import { useAuth } from './AuthContext';

const Ctx = createContext();

export const AdminKycProvider = ({ children }) => {
  const { authtoken, authLoading } = useAuth();

  const [records, setRecords] = useState([]);
  const [stats, setStats]     = useState({
    submitted: 0,
    verified:  0,
    rejected:  0,
    total:     0,
  });

  // Tracks whether the component is still mounted so handlers don't call
  // setState after unmount.
  const mountedRef = useRef(true);

  const fetchKyc = async () => {
    try {
      const res = await apiRequest.get('/api/admin/kyc-review');
      setRecords(res.data.records || []);
    } catch (err) {
      console.error('[AdminKycContext] fetchKyc failed:', err.message);
    }
  };

  // ── Socket effect ─────────────────────────────────────────────────────────
  // Re-runs when auth resolves (authLoading → false) or when the token
  // changes (login / logout).
  useEffect(() => {
    mountedRef.current = true;

    // Wait until AuthContext has finished restoring the session from
    // localStorage. During that window the token is null and the socket
    // client has not been initialised yet.
    if (authLoading || !authtoken) return;

    // Bootstrap the socket singleton if it hasn't been created yet.
    // initializeSocket() is idempotent — safe to call on every re-render.
    // It reads from localStorage using the multi-key lookup in WebSocketClient,
    // so it works for both the admin ("authtoken") and user ("token") panels.
    initializeSocket().then(() => {
      if (!mountedRef.current) return;

      // Ask the server to add this socket to the KYC admin room.
      // The server handles 'join_kyc_admin' in kycSocket.handleKycAdminJoin()
      // (called from onConnection.js) AND auto-joins isAdmin sockets in
      // IOsocket.js on connect — so admins receive events through either path.
      safeEmit('join_kyc_admin');
    });

    // ── Subscribe to KYC events via onSocketEvent() ───────────────────────
    // onSocketEvent() queues the subscription if the socket isn't ready yet
    // and flushes it automatically on connect — no manual retry loop needed.
    const unsubAdminUpdate = onSocketEvent('kyc:admin_update', (data) => {
      if (!mountedRef.current) return;
      setRecords(prev =>
        prev.map(r =>
          r._id === data.kycId
            ? { ...r, status: data.type === 'approved' ? 'verified' : 'rejected' }
            : r
        )
      );
    });

    const unsubBulkUpdate = onSocketEvent('kyc:bulk_update', ({ ids, type }) => {
      if (!mountedRef.current) return;
      setRecords(prev =>
        prev.map(r =>
          ids.includes(r._id)
            ? { ...r, status: type === 'bulk_approved' ? 'verified' : 'rejected' }
            : r
        )
      );
    });

    const unsubStatsUpdate = onSocketEvent('kyc:stats_update', ({ type }) => {
      if (!mountedRef.current) return;
      setStats(prev => {
        const s = { ...prev };
        if (type === 'submitted') { s.submitted++; s.total++; }
        if (type === 'approved')  { s.submitted--; s.verified++; }
        if (type === 'rejected')  { s.submitted--; s.rejected++; }
        return s;
      });
    });

    // Cleanup: remove all three listeners when auth changes or on unmount.
    return () => {
      mountedRef.current = false;
      unsubAdminUpdate();
      unsubBulkUpdate();
      unsubStatsUpdate();
      // Reset for the next attach cycle (e.g. re-login in the same session).
      mountedRef.current = true;
    };
  }, [authtoken, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Final unmount — ensure mountedRef stays false.
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  return (
    <Ctx.Provider value={{ records, stats, fetchKyc }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAdminKyc = () => useContext(Ctx);