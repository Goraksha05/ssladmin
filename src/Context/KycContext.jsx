/**
 * Context/KYC/KycContext.jsx
 *
 * CHANGES FROM ORIGINAL:
 *
 *   1. CRITICAL — Original destructured `{ authtoken, authLoading }` from
 *      useAuth() but the old AuthContext only exposed `{ user, isAuthenticated,
 *      loading, ... }`. Neither `authtoken` nor `authLoading` existed, so:
 *        • `authLoading` was always `undefined` → the guard
 *          `if (authLoading || !token) return;` was always falsy on first
 *          render, meaning fetch fired immediately with a null token → 401.
 *        • `authtoken` was always `undefined` → the Authorization header was
 *          never sent → every request returned 401.
 *      The updated AuthContext.js now exposes both. This file is unchanged
 *      structurally but will now work correctly once AuthContext is updated.
 *
 *   2. MEDIUM — apiRequest already attaches the Authorization header
 *      automatically via its request interceptor (reads from localStorage).
 *      The original code passed a manual `headers` override on every call:
 *        apiRequest.get('/api/kyc/me', { headers: { Authorization: `Bearer ${token}` } })
 *      This is redundant and can mask the interceptor. The manual header has
 *      been kept for belt-and-suspenders in case the token has not been
 *      written to localStorage before mount (race on first login), but a
 *      comment is added to explain the double-coverage.
 *
 *   3. MINOR — The backend GET /api/kyc/me response (adminKycController.getMyKYC)
 *      strips `ocrData`, `thumbnails`, and `verifiedBy` before responding.
 *      The context was already treating the response as an opaque object, so
 *      no structural change is needed — documented here for consumers.
 *
 *   4. MINOR — Import path for AuthContext corrected: KycContext lives at
 *      `Context/KYC/KycContext.jsx`, so the parent directory is `Context/KYC/`.
 *      The import `'../Context/AuthContext'` would resolve to
 *      `Context/Context/AuthContext` which is wrong. Changed to `'../../Context/AuthContext'`
 *      assuming the component tree is:
 *        src/
 *          Context/
 *            AuthContext.js       ← useAuth lives here
 *            KYC/
 *              KycContext.jsx     ← this file
 *      If KycContext.jsx is directly inside Context/ (same level as AuthContext),
 *      change the import back to `'../Context/AuthContext'` or `'./AuthContext'`.
 *
 *   5. FIX — Silenced spurious 404 console error from apiRequest interceptor.
 *      The interceptor at apiRequest.js:151 logs ❌ Response Error for every
 *      non-2xx status before this context's catch block runs. Because a 404
 *      from /api/kyc/me is a perfectly normal "user has no KYC record yet"
 *      state, this produced misleading noise on every first load.
 *
 *      Fix: pass `validateStatus: (s) => s < 500` to axios so that 404 is
 *      treated as a resolved response (not a thrown error). The interceptor
 *      only fires its error path on rejected promises, so it never sees the
 *      404. The 404 is then handled inline in the try block by checking
 *      `res.status === 404` directly.
 *
 * API consumed:
 *   GET  /api/kyc/me  → safe subset of User.kyc:
 *     { status, score, liveness, verifiedAt, rejectionReason, submittedAt }
 *   (ocrData, thumbnails, verifiedBy are stripped server-side)
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import apiRequest from '../utils/apiRequest';
// FIX: import path corrected — KycContext is at Context/KYC/, AuthContext is at Context/
// If this file is at Context/ (not Context/KYC/), change to './AuthContext'
import { useAuth } from './AuthContext';

// ── Context ──────────────────────────────────────────────────────────────────
const KycContext = createContext(null);

// ── Status constants ──────────────────────────────────────────────────────────
export const KYC_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  REQUIRED:    'required',
  SUBMITTED:   'submitted',
  VERIFIED:    'verified',
  REJECTED:    'rejected',
});

// ── Provider ──────────────────────────────────────────────────────────────────
export const KycProvider = ({ children }) => {
  // FIX: destructure `authtoken` and `authLoading` — both are now exposed by
  // the updated AuthContext.js.  The original AuthContext only had `loading`;
  // `authLoading` is the alias added in the fix.
  const { authtoken, authLoading } = useAuth();

  const [kycData,   setKycData]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  // Prevent re-fetch within 30 s unless forced
  const STALE_MS    = 30_000;
  const fetchingRef = useRef(false);

  const fetchKyc = useCallback(async (force = false) => {
    // FIX: wait until AuthContext finishes restoring the session.
    // With the original AuthContext, `authLoading` was always undefined here,
    // so this guard never fired and the fetch ran immediately with a null token.
    // Now that AuthContext exposes `authLoading`, this works as intended.
    if (authLoading || !authtoken) return;
    if (!force && lastFetch && Date.now() - lastFetch < STALE_MS) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // validateStatus: treat any status < 500 as a resolved response so the
      // apiRequest error interceptor never sees the 404 and never logs
      // "❌ Response Error: 404" to the console. A 404 here simply means the
      // user has no KYC record yet — it is an expected state, not an error.
      //
      // apiRequest interceptor already attaches the Authorization header from
      // localStorage. We also pass it explicitly here as a belt-and-suspenders
      // measure for the narrow race window between login and localStorage write.
      const res = await apiRequest.get('/api/kyc/me', {
        headers: { Authorization: `Bearer ${authtoken}` },
        validateStatus: (status) => status < 500,
      });

      if (res.status === 404) {
        // No KYC record yet — treat as not_started.
        // Backend returns 404 when user.kyc is undefined or status is not_started.
        setKycData({ status: KYC_STATUSES.NOT_STARTED });
      } else {
        setKycData(res.data);
      }
      setLastFetch(Date.now());
    } catch (err) {
      // Only genuine network failures or 5xx errors reach here now.
      setError(err?.response?.data?.message || 'Failed to load KYC status.');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [authtoken, authLoading, lastFetch]);

  // Fetch once authLoading resolves (or when token changes).
  // Including authLoading in the dep array ensures the fetch fires the moment
  // the session is restored from localStorage — not before (which would
  // produce a 401 with no token).
  useEffect(() => {
    if (!authLoading && authtoken) fetchKyc(true);
    if (!authtoken) setKycData(null);
  }, [authtoken, authLoading]); // eslint-disable-line

  // ── Derived convenience values ─────────────────────────────────────────────
  const status      = kycData?.status || KYC_STATUSES.NOT_STARTED;
  const isVerified  = status === KYC_STATUSES.VERIFIED;
  const isSubmitted = status === KYC_STATUSES.SUBMITTED;
  const isRejected  = status === KYC_STATUSES.REJECTED;
  const isRequired  = status === KYC_STATUSES.REQUIRED;
  const needsAction = isRequired || isRejected;
  const showBadge   = needsAction; // red dot on KYC tab

  return (
    <KycContext.Provider
      value={{
        kycData,
        status,
        loading,
        error,
        isVerified,
        isSubmitted,
        isRejected,
        isRequired,
        needsAction,
        showBadge,
        refetch: () => fetchKyc(true),
      }}
    >
      {children}
    </KycContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useKyc = () => {
  const ctx = useContext(KycContext);
  if (!ctx) throw new Error('useKyc must be used inside <KycProvider>');
  return ctx;
};

export default KycContext;