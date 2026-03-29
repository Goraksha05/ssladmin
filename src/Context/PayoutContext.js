// Context/PayoutContext.js
// ─────────────────────────────────────────────────────────────────────────────
// Global payout state for the Admin Financial section.
//
// Alignment with project conventions:
//
//   AUTH GATE
//   • Consumes useAuth() from AuthContext (same import path used everywhere).
//   • AuthContext's `loading` is destructured as `authLoading` to avoid
//     shadowing the local payoutLoading map when both are in scope.
//   • Fetches are gated on  !authLoading && isAuthenticated && user?.isAdmin
//     — mirrors the exact guard in PermissionsContext.fetchMe().
//   • Stale data is cleared when the user is not authenticated, matching the
//     reset pattern in PermissionsContext.
//
//   API / ERROR HANDLING
//   • All HTTP calls use apiRequest (utils/apiRequest.js).
//   • apiRequest's response interceptor fires toast.error for every non-2xx
//     status (401 / 403 / 5xx / network).  To avoid double-toasting, catch
//     blocks here only call console.error — never toast.error.
//   • 401 token clearing is handled exclusively by handleAuthError and the
//     app-level auth flow.  This context never touches localStorage.
//   • Success toasts are fired here because apiRequest only handles errors —
//     2xx success messaging is the caller's responsibility.
//
//   LOADING STATE
//   • Exported as `loading` (key in context value) so consumers that already
//     destructure `{ loading }` from usePayouts() need no changes.
//   • The internal state variable is named `payoutLoading` to prevent
//     collision with AuthContext's `loading` boolean in the same scope.
//
// Exposes:
//   payouts          — paginated Payout documents
//   pendingClaims    — RewardClaims not yet paid out
//   summary          — INR dashboard totals from /payouts/summary
//   recentPaid       — last 5 paid payouts (from summary endpoint)
//   userPayouts      — per-user history cache { [userId]: { user, payouts, totals } }
//   pagination       — { page, pages, total, limit } for payouts list
//   claimPagination  — same shape for pending-claims list
//   filters          — active payout query filters
//   claimFilters     — active pending-claims filters
//   loading          — { payouts, claims, summary, action, bulk, user }
//
// Actions:
//   setFilters(partial)         — merge filters + reset to page 1
//   clearFilters()              — reset all payout filters
//   setClaimFilters(partial)    — merge claim filters + reset to claim page 1
//   clearClaimFilters()         — reset all claim filters
//   setPage(n)                  — navigate payouts list
//   setClaimPage(n)             — navigate pending-claims list
//   processPayout(body)         — POST /api/admin/payouts/process
//   bulkProcess(claimIds, opts) — POST /api/admin/payouts/bulk-process
//   updateStatus(id, body)      — PATCH /api/admin/payouts/:id/status
//   fetchUserPayouts(id, force) — GET /api/admin/payouts/user/:id (cached)
//   refresh()                   — re-fetch all three data sources in parallel
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../utils/apiRequest';
import { useAuth } from './AuthContext';

// ── Context ───────────────────────────────────────────────────────────────────
const PayoutContext = createContext(null);

export const usePayouts = () => {
  const ctx = useContext(PayoutContext);
  if (!ctx) throw new Error('usePayouts must be used inside <PayoutProvider>');
  return ctx;
};

// ── Default state ─────────────────────────────────────────────────────────────
const DEFAULT_FILTERS = {
  status:     '',
  rewardType: '',
  userId:     '',
  from:       '',
  to:         '',
};

const DEFAULT_CLAIM_FILTERS = {
  type:     '',
  minINR:   '',
  bankOnly: false,
};

const DEFAULT_PAGINATION = { page: 1, pages: 1, total: 0, limit: 25 };

// ── Provider ──────────────────────────────────────────────────────────────────
export const PayoutProvider = ({ children }) => {

  // ── Auth gate — mirrors PermissionsContext pattern ─────────────────────────
  // `loading` from AuthContext renamed to `authLoading` to avoid shadowing the
  // local payoutLoading map and to be explicit about which context it belongs to.
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.isAdmin;

  // ── Data ───────────────────────────────────────────────────────────────────
  const [payouts,       setPayouts]       = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [summary,       setSummary]       = useState(null);
  const [recentPaid,    setRecentPaid]    = useState([]);
  // Lazy cache keyed by userId: { [userId]: { user, payouts, totals } }
  const [userPayouts,   setUserPayouts]   = useState({});

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [pagination,      setPagination]      = useState(DEFAULT_PAGINATION);
  const [claimPagination, setClaimPagination] = useState(DEFAULT_PAGINATION);

  // ── Filters + page cursors ─────────────────────────────────────────────────
  const [filters,      setFiltersState]      = useState(DEFAULT_FILTERS);
  const [claimFilters, setClaimFiltersState] = useState(DEFAULT_CLAIM_FILTERS);
  const [page,         setPage]              = useState(1);
  const [claimPage,    setClaimPage]         = useState(1);

  // ── Loading map ────────────────────────────────────────────────────────────
  // Stored as `payoutLoading` locally; exposed as `loading` in context value
  // so existing consumers destructure it without changes.
  const [payoutLoading, setPayoutLoading] = useState({
    payouts: false,
    claims:  false,
    summary: false,
    action:  false,  // processPayout / updateStatus
    bulk:    false,  // bulkProcess
    user:    false,  // fetchUserPayouts
  });

  // Stable refs so callbacks don't capture stale filter snapshots
  const filtersRef      = useRef(filters);
  const claimFiltersRef = useRef(claimFilters);
  useEffect(() => { filtersRef.current      = filters;      }, [filters]);
  useEffect(() => { claimFiltersRef.current = claimFilters; }, [claimFilters]);

  // ── Internal helpers ───────────────────────────────────────────────────────
  const setLoad = useCallback((key, val) => {
    setPayoutLoading(prev => ({ ...prev, [key]: val }));
  }, []);

  const buildPayoutParams = useCallback((p, f) => {
    const params = new URLSearchParams({ page: p, limit: 25 });
    if (f.status)     params.set('status',     f.status);
    if (f.rewardType) params.set('rewardType', f.rewardType);
    if (f.userId)     params.set('userId',     f.userId);
    if (f.from)       params.set('from',       f.from);
    if (f.to)         params.set('to',         f.to);
    return params.toString();
  }, []);

  const buildClaimParams = useCallback((p, cf) => {
    const params = new URLSearchParams({ page: p, limit: 25 });
    if (cf.type)     params.set('type',     cf.type);
    if (cf.minINR)   params.set('minINR',   cf.minINR);
    if (cf.bankOnly) params.set('bankOnly', 'true');
    return params.toString();
  }, []);

  // ── Fetchers ───────────────────────────────────────────────────────────────
  // IMPORTANT: catch blocks only call console.error.
  // apiRequest's response interceptor (apiRequest.js) already fires
  // toast.error for every non-2xx response — adding toast.error here would
  // show the user two identical error notifications for the same failure.

  const fetchPayouts = useCallback(async (p = 1, f = filtersRef.current) => {
    setLoad('payouts', true);
    try {
      const res = await apiRequest.get(
        `/api/admin/payouts?${buildPayoutParams(p, f)}`
      );
      setPayouts(res.data.payouts ?? []);
      setPagination(res.data.pagination ?? DEFAULT_PAGINATION);
    } catch (err) {
      console.error('[PayoutContext] fetchPayouts', err);
    } finally {
      setLoad('payouts', false);
    }
  }, [buildPayoutParams, setLoad]);

  const fetchPendingClaims = useCallback(async (p = 1, cf = claimFiltersRef.current) => {
    setLoad('claims', true);
    try {
      const res = await apiRequest.get(
        `/api/admin/payouts/pending-claims?${buildClaimParams(p, cf)}`
      );
      setPendingClaims(res.data.claims ?? []);
      setClaimPagination(res.data.pagination ?? DEFAULT_PAGINATION);
    } catch (err) {
      console.error('[PayoutContext] fetchPendingClaims', err);
    } finally {
      setLoad('claims', false);
    }
  }, [buildClaimParams, setLoad]);

  const fetchSummary = useCallback(async () => {
    setLoad('summary', true);
    try {
      const res = await apiRequest.get('/api/admin/payouts/summary');
      setSummary(res.data.summary ?? null);
      setRecentPaid(res.data.recentPaid ?? []);
    } catch (err) {
      console.error('[PayoutContext] fetchSummary', err);
    } finally {
      setLoad('summary', false);
    }
  }, [setLoad]);

  // ── Auth-gated reactive fetches ────────────────────────────────────────────
  // Wait until AuthContext has finished hydrating (authLoading === false)
  // before issuing any requests.  This mirrors PermissionsContext.useEffect
  // which checks  !isAuthenticated || !user?.isAdmin  before bailing early.

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !isAdmin) {
      // Clear stale data when the admin logs out — same reset pattern as
      // PermissionsContext clears permissions on !isAuthenticated
      setPayouts([]);
      setPendingClaims([]);
      setSummary(null);
      setRecentPaid([]);
      return;
    }
    fetchSummary();
  }, [authLoading, isAuthenticated, isAdmin, fetchSummary]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !isAdmin) return;
    fetchPayouts(page, filtersRef.current);
  }, [page, filters, authLoading, isAuthenticated, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authLoading || !isAuthenticated || !isAdmin) return;
    fetchPendingClaims(claimPage, claimFiltersRef.current);
  }, [claimPage, claimFilters, authLoading, isAuthenticated, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public filter setters ──────────────────────────────────────────────────
  const setFilters = useCallback((partial) => {
    setFiltersState(prev => ({ ...prev, ...partial }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const setClaimFilters = useCallback((partial) => {
    setClaimFiltersState(prev => ({ ...prev, ...partial }));
    setClaimPage(1);
  }, []);

  const clearClaimFilters = useCallback(() => {
    setClaimFiltersState(DEFAULT_CLAIM_FILTERS);
    setClaimPage(1);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * POST /api/admin/payouts/process
   * Create a payout for a single RewardClaim.
   *
   * Toast strategy:
   *   success → toast.success fired here (apiRequest only handles errors)
   *   error   → already toasted by apiRequest interceptor; we only log
   *
   * @param {{ claimId: string, status?: string, transactionRef?: string, notes?: string }} body
   * @returns {object|null} created payout or null on error
   */
  const processPayout = useCallback(async (body) => {
    setLoad('action', true);
    try {
      const res = await apiRequest.post('/api/admin/payouts/process', body);

      toast.success(res.data.message || 'Payout processed successfully');

      // Optimistically remove the claim from the pending list immediately
      setPendingClaims(prev =>
        prev.filter(c => String(c._id) !== String(body.claimId))
      );

      // Re-sync summary totals and the payouts list
      await Promise.all([
        fetchSummary(),
        fetchPayouts(page, filtersRef.current),
      ]);

      return res.data.payout;
    } catch (err) {
      // apiRequest interceptor already showed the error toast — log only
      console.error('[PayoutContext] processPayout', err);
      return null;
    } finally {
      setLoad('action', false);
    }
  }, [page, fetchSummary, fetchPayouts, setLoad]);

  /**
   * PATCH /api/admin/payouts/:payoutId/status
   * Transition a payout through its lifecycle.
   *
   * Allowed transitions (enforced by the controller, mirrored here for UX):
   *   pending    → processing | paid | on_hold | failed
   *   processing → paid | failed | on_hold
   *   failed     → pending  (retry)
   *   on_hold    → pending  (resume)
   *   paid       → (terminal)
   *
   * @param {string} payoutId
   * @param {{ status: string, transactionRef?: string, failureReason?: string, notes?: string }} body
   * @returns {object|null} updated payout or null on error
   */
  const updateStatus = useCallback(async (payoutId, body) => {
    setLoad('action', true);
    try {
      const res = await apiRequest.patch(
        `/api/admin/payouts/${payoutId}/status`,
        body
      );

      toast.success(res.data.message || 'Payout status updated');

      // Patch updated record in-place without a full list refetch
      setPayouts(prev =>
        prev.map(p => String(p._id) === String(payoutId) ? res.data.payout : p)
      );

      // Bust the per-user cache entry so the next fetchUserPayouts is fresh
      const payoutUser = res.data.payout?.user;
      if (payoutUser) {
        setUserPayouts(prev => {
          const uid = typeof payoutUser === 'object'
            ? String(payoutUser._id)
            : String(payoutUser);
          const { [uid]: _dropped, ...rest } = prev;
          return rest;
        });
      }

      await fetchSummary();
      return res.data.payout;
    } catch (err) {
      console.error('[PayoutContext] updateStatus', err);
      return null;
    } finally {
      setLoad('action', false);
    }
  }, [fetchSummary, setLoad]);

  /**
   * POST /api/admin/payouts/bulk-process
   * Batch payout creation — up to 100 claims per request.
   * Server returns 207 Multi-Status, which axios treats as a success
   * (status < 400), so no error handling needed for the 207 case.
   *
   * @param {string[]} claimIds
   * @param {{ status?: 'processing'|'paid', notes?: string }} opts
   * @returns {{ processed, skipped, failed, totalINRDispatched }|null}
   */
  const bulkProcess = useCallback(async (claimIds, opts = {}) => {
    if (!claimIds?.length) {
      toast.warn('No claims selected');
      return null;
    }
    setLoad('bulk', true);
    try {
      const res = await apiRequest.post('/api/admin/payouts/bulk-process', {
        claimIds,
        status: opts.status || 'processing',
        notes:  opts.notes  || '',
      });

      const { results, totalINRDispatched, message } = res.data;
      toast.success(message || 'Bulk process complete');

      // Remove successfully processed claims from the pending list
      const processedSet = new Set(
        (results?.processed ?? []).map(r => String(r.claimId))
      );
      setPendingClaims(prev =>
        prev.filter(c => !processedSet.has(String(c._id)))
      );

      await Promise.all([
        fetchSummary(),
        fetchPayouts(page, filtersRef.current),
      ]);

      return { ...(results ?? {}), totalINRDispatched };
    } catch (err) {
      console.error('[PayoutContext] bulkProcess', err);
      return null;
    } finally {
      setLoad('bulk', false);
    }
  }, [page, fetchSummary, fetchPayouts, setLoad]);

  /**
   * GET /api/admin/payouts/user/:userId
   * Full payout history for one user.  Memoised by userId; pass force=true
   * to bypass the cache (e.g. after a status update on that user's payout).
   *
   * @param {string}  userId
   * @param {boolean} [force=false]
   * @returns {{ user, payouts, totals }|null}
   */
  const fetchUserPayouts = useCallback(async (userId, force = false) => {
    if (!userId) return null;
    if (!force && userPayouts[userId]) return userPayouts[userId];

    setLoad('user', true);
    try {
      const res  = await apiRequest.get(`/api/admin/payouts/user/${userId}`);
      const data = res.data; // { user, payouts, totals }
      setUserPayouts(prev => ({ ...prev, [userId]: data }));
      return data;
    } catch (err) {
      console.error('[PayoutContext] fetchUserPayouts', err);
      return null;
    } finally {
      setLoad('user', false);
    }
  }, [userPayouts, setLoad]);

  /**
   * Re-fetch all three primary data sources simultaneously.
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchSummary(),
      fetchPayouts(page, filtersRef.current),
      fetchPendingClaims(claimPage, claimFiltersRef.current),
    ]);
  }, [fetchSummary, fetchPayouts, fetchPendingClaims, page, claimPage]);

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    // Data
    payouts,
    pendingClaims,
    summary,
    recentPaid,
    userPayouts,

    // Pagination
    pagination,
    claimPagination,
    page,
    claimPage,
    setPage,
    setClaimPage,

    // Filters
    filters,
    setFilters,
    clearFilters,
    claimFilters,
    setClaimFilters,
    clearClaimFilters,

    // Loading — exposed as `loading` so consumer destructuring is unchanged;
    // internally stored as payoutLoading to avoid collision with AuthContext.
    loading: payoutLoading,

    // Actions
    processPayout,
    updateStatus,
    bulkProcess,
    fetchUserPayouts,
    refresh,
  };

  return (
    <PayoutContext.Provider value={value}>
      {children}
    </PayoutContext.Provider>
  );
};

export default PayoutContext;