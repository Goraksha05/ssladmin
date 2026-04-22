// Context/PayoutContext.js  (UPDATED)
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES:
//   NEW — userRequestedPayouts data source — payouts where user explicitly
//         requested redemption (userRequested: true). Admin pays ONLY these.
//
//   NEW — userRequestedFilters / pagination / page state
//   NEW — userRequestedSummary KPIs
//
//   NEW — fetchPayoutReport(format, filters) — fetches report data from
//         GET /api/admin/payouts/report for Excel download.
//
//   CHANGE — fetchPendingClaims now auto-refreshes when userRequestedPayouts change.
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

const PayoutContext = createContext(null);

export const usePayouts = () => {
  const ctx = useContext(PayoutContext);
  if (!ctx) throw new Error('usePayouts must be used inside <PayoutProvider>');
  return ctx;
};

const DEFAULT_FILTERS = { status: '', rewardType: '', userId: '', from: '', to: '' };
const DEFAULT_CLAIM_FILTERS = { type: '', minINR: '', bankOnly: false };
const DEFAULT_WALLET_FILTERS = { minBalance: '', kycStatus: '', bankOnly: false, search: '' };
const DEFAULT_USER_REQ_FILTERS = { status: '', from: '', to: '' };
const DEFAULT_PAGINATION = { page: 1, pages: 1, total: 0, limit: 25 };

export const PayoutProvider = ({ children }) => {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.isAdmin;

  // ── Data ───────────────────────────────────────────────────────────────────
  const [payouts,               setPayouts]               = useState([]);
  const [pendingClaims,         setPendingClaims]         = useState([]);
  const [summary,               setSummary]               = useState(null);
  const [recentPaid,            setRecentPaid]            = useState([]);
  const [userPayouts,           setUserPayouts]           = useState({});
  const [unredeemedWallets,     setUnredeemedWallets]     = useState([]);
  const [walletSummary,         setWalletSummary]         = useState(null);
  const [userRequestedPayouts,  setUserRequestedPayouts]  = useState([]);
  const [userRequestedSummary,  setUserRequestedSummary]  = useState(null);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [pagination,            setPagination]            = useState(DEFAULT_PAGINATION);
  const [claimPagination,       setClaimPagination]       = useState(DEFAULT_PAGINATION);
  const [walletPagination,      setWalletPagination]      = useState(DEFAULT_PAGINATION);
  const [userReqPagination,     setUserReqPagination]     = useState(DEFAULT_PAGINATION);

  // ── Filters + cursors ──────────────────────────────────────────────────────
  const [filters,           setFiltersState]           = useState(DEFAULT_FILTERS);
  const [claimFilters,      setClaimFiltersState]      = useState(DEFAULT_CLAIM_FILTERS);
  const [walletFilters,     setWalletFiltersState]     = useState(DEFAULT_WALLET_FILTERS);
  const [userReqFilters,    setUserReqFiltersState]    = useState(DEFAULT_USER_REQ_FILTERS);
  const [page,              setPage]                   = useState(1);
  const [claimPage,         setClaimPage]              = useState(1);
  const [walletPage,        setWalletPage]             = useState(1);
  const [userReqPage,       setUserReqPage]            = useState(1);

  // ── Loading ────────────────────────────────────────────────────────────────
  const [payoutLoading, setPayoutLoading] = useState({
    payouts: false, claims: false, summary: false,
    wallets: false, userRequested: false, action: false, bulk: false, user: false,
  });

  const filtersRef       = useRef(filters);
  const claimFiltersRef  = useRef(claimFilters);
  const walletFiltersRef = useRef(walletFilters);
  const userReqFiltersRef= useRef(userReqFilters);
  useEffect(() => { filtersRef.current        = filters;       }, [filters]);
  useEffect(() => { claimFiltersRef.current   = claimFilters;  }, [claimFilters]);
  useEffect(() => { walletFiltersRef.current  = walletFilters; }, [walletFilters]);
  useEffect(() => { userReqFiltersRef.current = userReqFilters;}, [userReqFilters]);

  const setLoad = useCallback((key, val) => {
    setPayoutLoading(prev => ({ ...prev, [key]: val }));
  }, []);

  // ── Build query strings ────────────────────────────────────────────────────
  const buildPayoutParams = useCallback((p, f) => {
    const params = new URLSearchParams({ page: p, limit: 25 });
    if (f.status)       params.set('status',       f.status);
    if (f.rewardType)   params.set('rewardType',   f.rewardType);
    if (f.userId)       params.set('userId',       f.userId);
    if (f.from)         params.set('from',         f.from);
    if (f.to)           params.set('to',           f.to);
    return params.toString();
  }, []);

  const buildClaimParams = useCallback((p, cf) => {
    const params = new URLSearchParams({ page: p, limit: 25 });
    if (cf.type)     params.set('type',     cf.type);
    if (cf.minINR)   params.set('minINR',   cf.minINR);
    if (cf.bankOnly) params.set('bankOnly', 'true');
    return params.toString();
  }, []);

  const buildWalletParams = useCallback((p, wf) => {
    const params = new URLSearchParams({ page: p, limit: 25 });
    if (wf.minBalance) params.set('minBalance', wf.minBalance);
    if (wf.kycStatus)  params.set('kycStatus',  wf.kycStatus);
    if (wf.bankOnly)   params.set('bankOnly',   'true');
    if (wf.search)     params.set('search',     wf.search);
    return params.toString();
  }, []);

  const buildUserReqParams = useCallback((p, uf) => {
    const params = new URLSearchParams({ page: p, limit: 25 });
    if (uf.status) params.set('status', uf.status);
    if (uf.from)   params.set('from',   uf.from);
    if (uf.to)     params.set('to',     uf.to);
    return params.toString();
  }, []);

  // ── Fetchers ───────────────────────────────────────────────────────────────
  const fetchPayouts = useCallback(async (p = 1, f = filtersRef.current) => {
    setLoad('payouts', true);
    try {
      const res = await apiRequest.get(`/api/admin/payouts?${buildPayoutParams(p, f)}`);
      setPayouts(res.data.payouts ?? []);
      setPagination(res.data.pagination ?? DEFAULT_PAGINATION);
    } catch (err) { console.error('[PayoutContext] fetchPayouts', err); }
    finally { setLoad('payouts', false); }
  }, [buildPayoutParams, setLoad]);

  const fetchPendingClaims = useCallback(async (p = 1, cf = claimFiltersRef.current) => {
    setLoad('claims', true);
    try {
      const res = await apiRequest.get(`/api/admin/payouts/pending-claims?${buildClaimParams(p, cf)}`);
      setPendingClaims(res.data.claims ?? []);
      setClaimPagination(res.data.pagination ?? DEFAULT_PAGINATION);
    } catch (err) { console.error('[PayoutContext] fetchPendingClaims', err); }
    finally { setLoad('claims', false); }
  }, [buildClaimParams, setLoad]);

  const fetchSummary = useCallback(async () => {
    setLoad('summary', true);
    try {
      const res = await apiRequest.get('/api/admin/payouts/summary');
      setSummary(res.data.summary ?? null);
      setRecentPaid(res.data.recentPaid ?? []);
    } catch (err) { console.error('[PayoutContext] fetchSummary', err); }
    finally { setLoad('summary', false); }
  }, [setLoad]);

  const fetchUnredeemedWallets = useCallback(async (p = 1, wf = walletFiltersRef.current) => {
    setLoad('wallets', true);
    try {
      const res = await apiRequest.get(`/api/admin/payouts/unredeemed-wallets?${buildWalletParams(p, wf)}`);
      setUnredeemedWallets(res.data.users ?? []);
      setWalletPagination(res.data.pagination ?? DEFAULT_PAGINATION);
      setWalletSummary(res.data.summary ?? null);
    } catch (err) { console.error('[PayoutContext] fetchUnredeemedWallets', err); }
    finally { setLoad('wallets', false); }
  }, [buildWalletParams, setLoad]);

  // NEW: Fetch user-requested payouts
  const fetchUserRequestedPayouts = useCallback(async (p = 1, uf = userReqFiltersRef.current) => {
    setLoad('userRequested', true);
    try {
      const res = await apiRequest.get(`/api/admin/payouts/user-requested?${buildUserReqParams(p, uf)}`);
      setUserRequestedPayouts(res.data.payouts ?? []);
      setUserReqPagination(res.data.pagination ?? DEFAULT_PAGINATION);
      setUserRequestedSummary(res.data.summary ?? null);
    } catch (err) { console.error('[PayoutContext] fetchUserRequestedPayouts', err); }
    finally { setLoad('userRequested', false); }
  }, [buildUserReqParams, setLoad]);

  // NEW: Fetch payout report data for Excel export
  const fetchPayoutReport = useCallback(async (reportFilters = {}) => {
    try {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(reportFilters).filter(([, v]) => v !== '' && v != null))
      );
      const res = await apiRequest.get(`/api/admin/payouts/report?${params}`);
      return res.data;
    } catch (err) {
      console.error('[PayoutContext] fetchPayoutReport', err);
      toast.error('Failed to generate report');
      return null;
    }
  }, []);

  // ── Auth-gated reactive fetches ────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !isAdmin) {
      setPayouts([]); setPendingClaims([]); setSummary(null); setRecentPaid([]);
      setUnredeemedWallets([]); setWalletSummary(null);
      setUserRequestedPayouts([]); setUserRequestedSummary(null);
      return;
    }
    fetchSummary();
  }, [authLoading, isAuthenticated, isAdmin, fetchSummary]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !isAdmin) return;
    fetchPayouts(page, filtersRef.current);
  }, [page, filters, authLoading, isAuthenticated, isAdmin, fetchPayouts]); // eslint-disable-line

  useEffect(() => {
    if (authLoading || !isAuthenticated || !isAdmin) return;
    fetchPendingClaims(claimPage, claimFiltersRef.current);
  }, [claimPage, claimFilters, authLoading, isAuthenticated, isAdmin, fetchPendingClaims]); // eslint-disable-line

  useEffect(() => {
    if (authLoading || !isAuthenticated || !isAdmin) return;
    fetchUnredeemedWallets(walletPage, walletFiltersRef.current);
  }, [walletPage, walletFilters, authLoading, isAuthenticated, isAdmin, fetchUnredeemedWallets]); // eslint-disable-line

  useEffect(() => {
    if (authLoading || !isAuthenticated || !isAdmin) return;
    fetchUserRequestedPayouts(userReqPage, userReqFiltersRef.current);
  }, [userReqPage, userReqFilters, authLoading, isAuthenticated, isAdmin, fetchUserRequestedPayouts]); // eslint-disable-line

  // ── Filter setters ─────────────────────────────────────────────────────────
  const setFilters      = useCallback(p => { setFiltersState(prev => ({ ...prev, ...p }));      setPage(1); }, []);
  const clearFilters    = useCallback(() => { setFiltersState(DEFAULT_FILTERS);                 setPage(1); }, []);
  const setClaimFilters = useCallback(p => { setClaimFiltersState(prev => ({ ...prev, ...p })); setClaimPage(1); }, []);
  const clearClaimFilters = useCallback(() => { setClaimFiltersState(DEFAULT_CLAIM_FILTERS);    setClaimPage(1); }, []);
  const setWalletFilters  = useCallback(p => { setWalletFiltersState(prev => ({ ...prev, ...p })); setWalletPage(1); }, []);
  const clearWalletFilters= useCallback(() => { setWalletFiltersState(DEFAULT_WALLET_FILTERS);  setWalletPage(1); }, []);
  const setUserReqFilters = useCallback(p => { setUserReqFiltersState(prev => ({ ...prev, ...p })); setUserReqPage(1); }, []);
  const clearUserReqFilters = useCallback(() => { setUserReqFiltersState(DEFAULT_USER_REQ_FILTERS); setUserReqPage(1); }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const processPayout = useCallback(async (body) => {
    setLoad('action', true);
    try {
      const res = await apiRequest.post('/api/admin/payouts/process', body);
      toast.success(res.data.message || 'Payout processed successfully');
      setPendingClaims(prev => prev.filter(c => String(c._id) !== String(body.claimId)));
      await Promise.all([
        fetchSummary(),
        fetchPayouts(page, filtersRef.current),
        fetchUserRequestedPayouts(userReqPage, userReqFiltersRef.current),
      ]);
      return res.data.payout;
    } catch (err) { console.error('[PayoutContext] processPayout', err); return null; }
    finally { setLoad('action', false); }
  }, [page, userReqPage, fetchSummary, fetchPayouts, fetchUserRequestedPayouts, setLoad]);

  const updateStatus = useCallback(async (payoutId, body) => {
    setLoad('action', true);
    try {
      const res = await apiRequest.patch(`/api/admin/payouts/${payoutId}/status`, body);
      toast.success(res.data.message || 'Payout status updated');
      setPayouts(prev => prev.map(p => String(p._id) === String(payoutId) ? res.data.payout : p));
      // Update user-requested list too
      setUserRequestedPayouts(prev => prev.map(p => String(p._id) === String(payoutId) ? res.data.payout : p));
      await fetchSummary();
      // Refresh user-req summary
      fetchUserRequestedPayouts(userReqPage, userReqFiltersRef.current);
      if (body.status === 'paid' || body.status === 'failed') {
        fetchUnredeemedWallets(walletPage, walletFiltersRef.current);
      }
      return res.data.payout;
    } catch (err) { console.error('[PayoutContext] updateStatus', err); return null; }
    finally { setLoad('action', false); }
  }, [walletPage, userReqPage, fetchSummary, fetchUnredeemedWallets, fetchUserRequestedPayouts, setLoad]);

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
      const processedSet = new Set((results?.processed ?? []).map(r => String(r.claimId)));
      setPendingClaims(prev => prev.filter(c => !processedSet.has(String(c._id))));
      await Promise.all([
        fetchSummary(),
        fetchPayouts(page, filtersRef.current),
        fetchUserRequestedPayouts(userReqPage, userReqFiltersRef.current),
      ]);
      return { ...(results ?? {}), totalINRDispatched };
    } catch (err) { console.error('[PayoutContext] bulkProcess', err); return null; }
    finally { setLoad('bulk', false); }
  }, [page, userReqPage, fetchSummary, fetchPayouts, fetchUserRequestedPayouts, setLoad]);

  const fetchUserPayouts = useCallback(async (userId, force = false) => {
    if (!userId) return null;
    if (!force && userPayouts[userId]) return userPayouts[userId];
    setLoad('user', true);
    try {
      const res = await apiRequest.get(`/api/admin/payouts/user/${userId}`);
      setUserPayouts(prev => ({ ...prev, [userId]: res.data }));
      return res.data;
    } catch (err) { console.error('[PayoutContext] fetchUserPayouts', err); return null; }
    finally { setLoad('user', false); }
  }, [userPayouts, setLoad]);

  const refresh = useCallback(async () => {
    await Promise.all([
      fetchSummary(),
      fetchPayouts(page, filtersRef.current),
      fetchPendingClaims(claimPage, claimFiltersRef.current),
      fetchUnredeemedWallets(walletPage, walletFiltersRef.current),
      fetchUserRequestedPayouts(userReqPage, userReqFiltersRef.current),
    ]);
  }, [fetchSummary, fetchPayouts, fetchPendingClaims, fetchUnredeemedWallets, fetchUserRequestedPayouts, page, claimPage, walletPage, userReqPage]);

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    payouts, pendingClaims, summary, recentPaid, userPayouts,
    unredeemedWallets, walletSummary,
    userRequestedPayouts, userRequestedSummary,

    pagination, claimPagination, walletPagination, userReqPagination,
    page, claimPage, walletPage, userReqPage,
    setPage, setClaimPage, setWalletPage, setUserReqPage,

    filters, setFilters, clearFilters,
    claimFilters, setClaimFilters, clearClaimFilters,
    walletFilters, setWalletFilters, clearWalletFilters,
    userReqFilters, setUserReqFilters, clearUserReqFilters,

    loading: payoutLoading,

    processPayout, updateStatus, bulkProcess, fetchUserPayouts, refresh,
    fetchPayoutReport,
  };

  return (
    <PayoutContext.Provider value={value}>
      {children}
    </PayoutContext.Provider>
  );
};

export default PayoutContext;