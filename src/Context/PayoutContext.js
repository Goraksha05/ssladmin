// Context/PayoutContext.js
// ─────────────────────────────────────────────────────────────────────────────
// Global payout state for the Admin Financial section.
//
// CHANGES FROM PREVIOUS VERSION:
//
//   NEW — unredeemedWallets data source.
//     Fetches GET /api/admin/payouts/unredeemed-wallets which returns users who
//     have totalGroceryCoupons > 0 but no active grocery_redeem Payout in flight.
//     This is the "hasn't redeemed yet" list, as opposed to pendingClaims which
//     is the "has submitted a request, admin needs to process" list.
//
//   NEW — walletFilters / walletPagination / walletPage state for the
//     "Unredeemed Wallets" tab in RewardPayout.js.
//
//   NEW — walletSummary: KPI totals (totalUnredeemedINR, eligibleToRedeem,
//     missingBankDetails) returned by the aggregate in the backend.
//
// All other behaviour is unchanged.
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

const DEFAULT_WALLET_FILTERS = {
  minBalance: '',
  kycStatus:  '',
  bankOnly:   false,
  search:     '',
};

const DEFAULT_PAGINATION = { page: 1, pages: 1, total: 0, limit: 25 };

// ── Provider ──────────────────────────────────────────────────────────────────
export const PayoutProvider = ({ children }) => {

  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.isAdmin;

  // ── Data ───────────────────────────────────────────────────────────────────
  const [payouts,            setPayouts]            = useState([]);
  const [pendingClaims,      setPendingClaims]      = useState([]);
  const [summary,            setSummary]            = useState(null);
  const [recentPaid,         setRecentPaid]         = useState([]);
  const [userPayouts,        setUserPayouts]        = useState({});

  // NEW: unredeemed wallets — users with coupon balance but no active redemption
  const [unredeemedWallets,  setUnredeemedWallets]  = useState([]);
  const [walletSummary,      setWalletSummary]      = useState(null);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [pagination,         setPagination]         = useState(DEFAULT_PAGINATION);
  const [claimPagination,    setClaimPagination]    = useState(DEFAULT_PAGINATION);
  const [walletPagination,   setWalletPagination]   = useState(DEFAULT_PAGINATION); // NEW

  // ── Filters + page cursors ─────────────────────────────────────────────────
  const [filters,      setFiltersState]      = useState(DEFAULT_FILTERS);
  const [claimFilters, setClaimFiltersState] = useState(DEFAULT_CLAIM_FILTERS);
  const [walletFilters, setWalletFiltersState] = useState(DEFAULT_WALLET_FILTERS); // NEW
  const [page,         setPage]              = useState(1);
  const [claimPage,    setClaimPage]         = useState(1);
  const [walletPage,   setWalletPage]        = useState(1); // NEW

  // ── Loading map ────────────────────────────────────────────────────────────
  const [payoutLoading, setPayoutLoading] = useState({
    payouts:  false,
    claims:   false,
    summary:  false,
    wallets:  false,   // NEW — for the unredeemed wallets tab
    action:   false,
    bulk:     false,
    user:     false,
  });

  // Stable refs so callbacks don't capture stale filter snapshots
  const filtersRef       = useRef(filters);
  const claimFiltersRef  = useRef(claimFilters);
  const walletFiltersRef = useRef(walletFilters);
  useEffect(() => { filtersRef.current       = filters;       }, [filters]);
  useEffect(() => { claimFiltersRef.current  = claimFilters;  }, [claimFilters]);
  useEffect(() => { walletFiltersRef.current = walletFilters; }, [walletFilters]);

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

  // NEW: build query string for unredeemed-wallets endpoint
  const buildWalletParams = useCallback((p, wf) => {
    const params = new URLSearchParams({ page: p, limit: 25 });
    if (wf.minBalance) params.set('minBalance', wf.minBalance);
    if (wf.kycStatus)  params.set('kycStatus',  wf.kycStatus);
    if (wf.bankOnly)   params.set('bankOnly',   'true');
    if (wf.search)     params.set('search',     wf.search);
    return params.toString();
  }, []);

  // ── Fetchers ───────────────────────────────────────────────────────────────

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

  // NEW: fetch users with balance but no active redemption
  const fetchUnredeemedWallets = useCallback(async (
    p  = 1,
    wf = walletFiltersRef.current,
  ) => {
    setLoad('wallets', true);
    try {
      const res = await apiRequest.get(
        `/api/admin/payouts/unredeemed-wallets?${buildWalletParams(p, wf)}`
      );
      setUnredeemedWallets(res.data.users        ?? []);
      setWalletPagination( res.data.pagination   ?? DEFAULT_PAGINATION);
      setWalletSummary(    res.data.summary       ?? null);
    } catch (err) {
      console.error('[PayoutContext] fetchUnredeemedWallets', err);
    } finally {
      setLoad('wallets', false);
    }
  }, [buildWalletParams, setLoad]);

  // ── Auth-gated reactive fetches ────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !isAdmin) {
      setPayouts([]);
      setPendingClaims([]);
      setSummary(null);
      setRecentPaid([]);
      setUnredeemedWallets([]);
      setWalletSummary(null);
      return;
    }
    fetchSummary();
  }, [authLoading, isAuthenticated, isAdmin, fetchSummary]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !isAdmin) return;
    fetchPayouts(page, filtersRef.current);
  }, [page, filters, authLoading, isAuthenticated, isAdmin]); // eslint-disable-line

  useEffect(() => {
    if (authLoading || !isAuthenticated || !isAdmin) return;
    fetchPendingClaims(claimPage, claimFiltersRef.current);
  }, [claimPage, claimFilters, authLoading, isAuthenticated, isAdmin]); // eslint-disable-line

  // NEW: fetch unredeemed wallets when walletPage or walletFilters change
  useEffect(() => {
    if (authLoading || !isAuthenticated || !isAdmin) return;
    fetchUnredeemedWallets(walletPage, walletFiltersRef.current);
  }, [walletPage, walletFilters, authLoading, isAuthenticated, isAdmin]); // eslint-disable-line

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

  // NEW: wallet filter setters
  const setWalletFilters = useCallback((partial) => {
    setWalletFiltersState(prev => ({ ...prev, ...partial }));
    setWalletPage(1);
  }, []);

  const clearWalletFilters = useCallback(() => {
    setWalletFiltersState(DEFAULT_WALLET_FILTERS);
    setWalletPage(1);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const processPayout = useCallback(async (body) => {
    setLoad('action', true);
    try {
      const res = await apiRequest.post('/api/admin/payouts/process', body);
      toast.success(res.data.message || 'Payout processed successfully');
      setPendingClaims(prev =>
        prev.filter(c => String(c._id) !== String(body.claimId))
      );
      await Promise.all([
        fetchSummary(),
        fetchPayouts(page, filtersRef.current),
        // Refresh the unredeemed wallets list — the user may now have a payout in flight
        fetchUnredeemedWallets(walletPage, walletFiltersRef.current),
      ]);
      return res.data.payout;
    } catch (err) {
      console.error('[PayoutContext] processPayout', err);
      return null;
    } finally {
      setLoad('action', false);
    }
  }, [page, walletPage, fetchSummary, fetchPayouts, fetchUnredeemedWallets, setLoad]);

  const updateStatus = useCallback(async (payoutId, body) => {
    setLoad('action', true);
    try {
      const res = await apiRequest.patch(
        `/api/admin/payouts/${payoutId}/status`,
        body
      );
      toast.success(res.data.message || 'Payout status updated');
      setPayouts(prev =>
        prev.map(p => String(p._id) === String(payoutId) ? res.data.payout : p)
      );
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
      // If a grocery_redeem payout was just marked 'paid' or 'failed',
      // the user may now appear in the unredeemed-wallets list again.
      if (body.status === 'paid' || body.status === 'failed') {
        fetchUnredeemedWallets(walletPage, walletFiltersRef.current);
      }
      return res.data.payout;
    } catch (err) {
      console.error('[PayoutContext] updateStatus', err);
      return null;
    } finally {
      setLoad('action', false);
    }
  }, [walletPage, fetchSummary, fetchUnredeemedWallets, setLoad]);

  const bulkProcess = useCallback(async (claimIds, opts = {}) => {
    if (!claimIds?.length) { toast.warn('No claims selected'); return null; }
    setLoad('bulk', true);
    try {
      const res = await apiRequest.post('/api/admin/payouts/bulk-process', {
        claimIds,
        status: opts.status || 'processing',
        notes:  opts.notes  || '',
      });
      const { results, totalINRDispatched, message } = res.data;
      toast.success(message || 'Bulk process complete');
      const processedSet = new Set(
        (results?.processed ?? []).map(r => String(r.claimId))
      );
      setPendingClaims(prev =>
        prev.filter(c => !processedSet.has(String(c._id)))
      );
      await Promise.all([
        fetchSummary(),
        fetchPayouts(page, filtersRef.current),
        fetchUnredeemedWallets(walletPage, walletFiltersRef.current),
      ]);
      return { ...(results ?? {}), totalINRDispatched };
    } catch (err) {
      console.error('[PayoutContext] bulkProcess', err);
      return null;
    } finally {
      setLoad('bulk', false);
    }
  }, [page, walletPage, fetchSummary, fetchPayouts, fetchUnredeemedWallets, setLoad]);

  const fetchUserPayouts = useCallback(async (userId, force = false) => {
    if (!userId) return null;
    if (!force && userPayouts[userId]) return userPayouts[userId];
    setLoad('user', true);
    try {
      const res  = await apiRequest.get(`/api/admin/payouts/user/${userId}`);
      const data = res.data;
      setUserPayouts(prev => ({ ...prev, [userId]: data }));
      return data;
    } catch (err) {
      console.error('[PayoutContext] fetchUserPayouts', err);
      return null;
    } finally {
      setLoad('user', false);
    }
  }, [userPayouts, setLoad]);

  const refresh = useCallback(async () => {
    await Promise.all([
      fetchSummary(),
      fetchPayouts(page, filtersRef.current),
      fetchPendingClaims(claimPage, claimFiltersRef.current),
      fetchUnredeemedWallets(walletPage, walletFiltersRef.current),
    ]);
  }, [fetchSummary, fetchPayouts, fetchPendingClaims, fetchUnredeemedWallets,
      page, claimPage, walletPage]);

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    // Data
    payouts,
    pendingClaims,
    summary,
    recentPaid,
    userPayouts,
    unredeemedWallets,   // NEW
    walletSummary,       // NEW

    // Pagination
    pagination,
    claimPagination,
    walletPagination,    // NEW
    page,
    claimPage,
    walletPage,          // NEW
    setPage,
    setClaimPage,
    setWalletPage,       // NEW

    // Filters
    filters,
    setFilters,
    clearFilters,
    claimFilters,
    setClaimFilters,
    clearClaimFilters,
    walletFilters,       // NEW
    setWalletFilters,    // NEW
    clearWalletFilters,  // NEW

    // Loading
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