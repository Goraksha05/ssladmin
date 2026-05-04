// src/Context/AdminKycContext.js

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import apiRequest from '../utils/apiRequest';
import {
  initializeSocket,
  onSocketEvent,
  safeEmit,
} from '../WebSocket/WebSocketClient';
import { useAuth } from './AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_STATS = {
  submitted:  0,
  verified:   0,
  rejected:   0,
  notStarted: 0,
  pending:    0,
  total:      0,
};

const DEFAULT_PAGINATION = {
  page:  1,
  pages: 1,
  total: 0,
  limit: 30,
};

const DEFAULT_LOADING = {
  records: false,
  stats:   false,
  action:  false,
};

const DEFAULT_ERROR = {
  records: null,
  action:  null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_TO_STATUS = {
  approved:       'verified',
  rejected:       'rejected',
  reset:          'not_started',
  bulk_approved:  'verified',
  bulk_rejected:  'rejected',
};

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const AdminKycCtx = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export const AdminKycProvider = ({ children }) => {
  const { authtoken, authLoading } = useAuth();

  const [records,    setRecords]    = useState([]);
  const [stats,      setStats]      = useState(DEFAULT_STATS);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [loading,    setLoading]    = useState(DEFAULT_LOADING);
  const [error,      setError]      = useState(DEFAULT_ERROR);

  // Tracks mount status to guard all async setState calls.
  const mountedRef = useRef(true);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setL = (key, val) => {
    if (mountedRef.current) setLoading(prev => ({ ...prev, [key]: val }));
  };
  const setE = (key, val) => {
    if (mountedRef.current) setError(prev => ({ ...prev, [key]: val }));
  };

  // ── fetchRecords ────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async (params = {}) => {
    setL('records', true);
    setE('records', null);
    try {
      const res = await apiRequest.get('/api/admin/kyc/users', { params });
      if (!mountedRef.current) return;
      setRecords(res.data.users  ?? []);
      setPagination({
        page:  res.data.page   ?? 1,
        pages: res.data.pages  ?? 1,
        total: res.data.total  ?? 0,
        limit: params.limit    ?? DEFAULT_PAGINATION.limit,
      });
    } catch (err) {
      console.error('[AdminKycContext] fetchRecords failed:', err.message);
      if (mountedRef.current) setE('records', 'Failed to load KYC records.');
    } finally {
      setL('records', false);
    }
  }, []);

  // ── fetchStats ──────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setL('stats', true);
    try {
      const res = await apiRequest.get('/api/admin/kyc/stats');
      if (!mountedRef.current) return;
      const d = res.data;
      setStats({
        submitted:  d.submitted  ?? 0,
        verified:   d.verified   ?? 0,
        rejected:   d.rejected   ?? 0,
        notStarted: (d.not_started ?? 0) + (d.required ?? 0),
        pending:    d.pending    ?? d.submitted ?? 0,
        total:      (d.submitted ?? 0) + (d.verified ?? 0) + (d.rejected ?? 0)
                    + (d.not_started ?? 0) + (d.required ?? 0),
      });
    } catch (err) {
      console.error('[AdminKycContext] fetchStats failed:', err.message);
      // Stats failure is non-fatal — don't surface an error banner for it.
    } finally {
      setL('stats', false);
    }
  }, []);

  // ── applyStatusToRecord ────────────────────────────────────────────────────
  // Shared optimistic-update helper: mutates a single record in state.
  const applyStatusToRecord = useCallback((id, status) => {
    if (!mountedRef.current) return;
    setRecords(prev =>
      prev.map(r => r._id === id ? { ...r, 'kyc.status': status, kyc: r.kyc ? { ...r.kyc, status } : r.kyc } : r)
    );
  }, []);

  // ── applyStatusToMany ──────────────────────────────────────────────────────
  const applyStatusToMany = useCallback((ids, status) => {
    if (!mountedRef.current) return;
    const idSet = new Set(ids);
    setRecords(prev =>
      prev.map(r => idSet.has(r._id)
        ? { ...r, 'kyc.status': status, kyc: r.kyc ? { ...r.kyc, status } : r.kyc }
        : r
      )
    );
  }, []);

  // ── approveRecord ───────────────────────────────────────────────────────────
  const approveRecord = useCallback(async (id) => {
    const prevRecords = records; // snapshot for rollback
    applyStatusToRecord(id, 'verified');
    setL('action', true);
    setE('action', null);
    try {
      await apiRequest.post(`/api/admin/kyc/approve/${id}`);
      // Socket event will confirm the update; no further state mutation needed here.
    } catch (err) {
      console.error('[AdminKycContext] approveRecord failed:', err.message);
      if (mountedRef.current) {
        setRecords(prevRecords); // roll back
        setE('action', err.response?.data?.message ?? 'Approval failed.');
      }
    } finally {
      setL('action', false);
    }
  }, [records, applyStatusToRecord]);

  // ── rejectRecord ────────────────────────────────────────────────────────────
  const rejectRecord = useCallback(async (id, reason) => {
    if (!reason?.trim()) {
      setE('action', 'A rejection reason is required.');
      return;
    }
    const prevRecords = records;
    applyStatusToRecord(id, 'rejected');
    setL('action', true);
    setE('action', null);
    try {
      await apiRequest.post(`/api/admin/kyc/reject/${id}`, { reason: reason.trim() });
    } catch (err) {
      console.error('[AdminKycContext] rejectRecord failed:', err.message);
      if (mountedRef.current) {
        setRecords(prevRecords);
        setE('action', err.response?.data?.message ?? 'Rejection failed.');
      }
    } finally {
      setL('action', false);
    }
  }, [records, applyStatusToRecord]);

  // ── resetRecord ─────────────────────────────────────────────────────────────
  const resetRecord = useCallback(async (id) => {
    const prevRecords = records;
    applyStatusToRecord(id, 'not_started');
    setL('action', true);
    setE('action', null);
    try {
      await apiRequest.post(`/api/admin/kyc/reset/${id}`);
    } catch (err) {
      console.error('[AdminKycContext] resetRecord failed:', err.message);
      if (mountedRef.current) {
        setRecords(prevRecords);
        setE('action', err.response?.data?.message ?? 'Reset failed.');
      }
    } finally {
      setL('action', false);
    }
  }, [records, applyStatusToRecord]);

  // ── bulkApprove ─────────────────────────────────────────────────────────────
  // Calls adminKycReviewRoutes PATCH /api/admin/kyc-review/bulk/approve.
  const bulkApprove = useCallback(async (ids) => {
    if (!ids?.length) return;
    const prevRecords = records;
    applyStatusToMany(ids, 'verified');
    setL('action', true);
    setE('action', null);
    try {
      await apiRequest.patch('/api/admin/kyc-review/bulk/approve', { ids });
    } catch (err) {
      console.error('[AdminKycContext] bulkApprove failed:', err.message);
      if (mountedRef.current) {
        setRecords(prevRecords);
        setE('action', err.response?.data?.message ?? 'Bulk approval failed.');
      }
    } finally {
      setL('action', false);
    }
  }, [records, applyStatusToMany]);

  // ── bulkReject ──────────────────────────────────────────────────────────────
  // Calls adminKycReviewRoutes PATCH /api/admin/kyc-review/bulk/reject.
  const bulkReject = useCallback(async (ids, reason) => {
    if (!ids?.length) return;
    if (!reason?.trim()) {
      setE('action', 'A rejection reason is required for bulk reject.');
      return;
    }
    const prevRecords = records;
    applyStatusToMany(ids, 'rejected');
    setL('action', true);
    setE('action', null);
    try {
      await apiRequest.patch('/api/admin/kyc-review/bulk/reject', { ids, reason: reason.trim() });
    } catch (err) {
      console.error('[AdminKycContext] bulkReject failed:', err.message);
      if (mountedRef.current) {
        setRecords(prevRecords);
        setE('action', err.response?.data?.message ?? 'Bulk rejection failed.');
      }
    } finally {
      setL('action', false);
    }
  }, [records, applyStatusToMany]);

  // ── clearError ──────────────────────────────────────────────────────────────
  const clearError = useCallback((key = 'action') => {
    setE(key, null);
  }, []);

  // ── Socket subscription effect ─────────────────────────────────────────────
  // Re-runs when auth resolves (authLoading → false) or the token changes.
  useEffect(() => {
    mountedRef.current = true;

    if (authLoading || !authtoken) return;

    // Bootstrap the socket singleton (idempotent).
    initializeSocket().then(() => {
      if (!mountedRef.current) return;

      const unsubConnect = onSocketEvent('connect', () => {
        safeEmit('join_kyc_admin');
      });

      return () => unsubConnect();
    });

    // ── kyc:admin_update ───────────────────────────────────────────────────
    const unsubAdminUpdate = onSocketEvent('kyc:admin_update', ({ kycId, type }) => {
      if (!mountedRef.current) return;
      const status = TYPE_TO_STATUS[type];
      if (status && kycId) applyStatusToRecord(kycId, status);
    });

    // ── kyc:bulk_update ────────────────────────────────────────────────────
    const unsubBulkUpdate = onSocketEvent('kyc:bulk_update', ({ ids, type }) => {
      if (!mountedRef.current || !ids?.length) return;
      const status = TYPE_TO_STATUS[type];
      if (status) applyStatusToMany(ids, status);
    });

    // ── kyc:stats_update ───────────────────────────────────────────────────
    const unsubStatsUpdate = onSocketEvent('kyc:stats_update', ({ type }) => {
      if (!mountedRef.current) return;

      if (type === 'reset') {
        fetchStats();
        return;
      }

      setStats(prev => {
        const s = { ...prev };
        if (type === 'submitted') {
          s.submitted++;
          s.pending++;
          s.total++;
        } else if (type === 'approved') {
          s.submitted  = Math.max(0, s.submitted - 1);
          s.pending    = Math.max(0, s.pending   - 1);
          s.verified++;
        } else if (type === 'rejected') {
          s.submitted  = Math.max(0, s.submitted - 1);
          s.pending    = Math.max(0, s.pending   - 1);
          s.rejected++;
        }
        return s;
      });
    });

    // Cleanup: remove all event listeners when auth changes or on unmount.
    return () => {
      mountedRef.current = false;
      unsubAdminUpdate();
      unsubBulkUpdate();
      unsubStatsUpdate();
      mountedRef.current = true;
    };
  }, [authtoken, authLoading, fetchStats, applyStatusToRecord, applyStatusToMany]); // eslint-disable-line react-hooks/exhaustive-deps

  // Final unmount — ensure mountedRef stays false permanently.
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    // State
    records,
    stats,
    pagination,
    loading,
    error,

    // Actions
    fetchRecords,
    fetchStats,
    approveRecord,
    rejectRecord,
    resetRecord,
    bulkApprove,
    bulkReject,
    clearError,
  };

  return (
    <AdminKycCtx.Provider value={value}>
      {children}
    </AdminKycCtx.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export const useAdminKyc = () => {
  const ctx = useContext(AdminKycCtx);
  if (!ctx) {
    throw new Error('useAdminKyc must be used within an AdminKycProvider');
  }
  return ctx;
};