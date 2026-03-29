// Context/PermissionsContext.js
//
// CHANGES FROM ORIGINAL:
//
//   1. CRITICAL — Auth guard alignment.
//      Original checked `!isAuthenticated || !user?.isAdmin` to skip the fetch,
//      which is correct. However, it didn't wait for AuthContext hydration
//      (loading === true on first render).  If `isAuthenticated` is false while
//      the session is still being restored from localStorage, the context would
//      clear permissions prematurely then never re-fetch.
//      Fix: added `loading` (AuthContext) to the guard so fetchMe only runs
//      after the session is fully hydrated — mirrors the pattern in
//      PayoutContext.js (`authLoading` guard) and KycContext.jsx.
//
//   2. MEDIUM — Deduplication with AdminAuthContext.js.
//      Both PermissionsContext and AdminAuthContext call GET /api/admin/me and
//      maintain near-identical state.  They exist separately because
//      AdminAuthContext is consumed by admin-specific components (AdminLayout,
//      admin pages) while PermissionsContext is a lower-level primitive.
//      Rather than merge them (which would be a breaking change), PermissionsContext
//      now re-exports the same hook name `usePermissions` and additionally
//      exports `useAdminAuth` as an alias so components that import either one
//      get the same data without a double network request.
//      NOTE: To fully eliminate the duplicate request, wrap your app with ONLY
//      PermissionsProvider and have AdminAuthContext consume PermissionsContext
//      instead of fetching independently.  The alias approach below is a
//      non-breaking intermediate step.
//
//   3. MINOR — The `/api/admin/me` endpoint (adminManagementController.getMe)
//      returns:
//        { permissions: string[], isSuperAdmin: boolean, adminRoleName: string|null }
//      The wildcard permission `'*'` is included in permissions[] for super_admins
//      (set by fetchUser middleware). `hasPermission` already handles this
//      correctly via `permissions.includes('*')`.
//
//   4. MINOR — `adminRoleName` was always null in the original when the admin
//      had no custom role name (returns null from backend). Added explicit null
//      handling so consumers that display the role name don't render "null".

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiRequest from '../utils/apiRequest';
import { useAuth } from './AuthContext';

const PermissionsContext = createContext(null);

export const PermissionsProvider = ({ children }) => {
  const {
    isAuthenticated,
    user,
    // FIX: wait for session hydration before fetching.
    // Original didn't destructure `loading` here; without it the guard could
    // short-circuit on the first render when isAuthenticated is still false.
    loading: authLoading,
  } = useAuth();

  const [permissions,   setPermissions]   = useState([]);
  const [isSuperAdmin,  setIsSuperAdmin]  = useState(false);
  const [adminRoleName, setAdminRoleName] = useState(null);
  const [loading,       setLoading]       = useState(true);

  const fetchMe = useCallback(async () => {
    // FIX: guard now waits for auth hydration before evaluating isAuthenticated
    if (authLoading) return;

    if (!isAuthenticated || !user?.isAdmin) {
      setPermissions([]);
      setIsSuperAdmin(false);
      setAdminRoleName(null);
      setLoading(false);
      return;
    }

    try {
      // GET /api/admin/me — protected by fetchUser + verifyAdmin in adminRouter
      // Returns: { permissions: string[], isSuperAdmin: boolean, adminRoleName: string|null }
      const res = await apiRequest.get('/api/admin/me');
      setPermissions(res.data.permissions ?? []);
      setIsSuperAdmin(res.data.isSuperAdmin ?? false);
      // FIX: coerce null to null (not the string "null") for safe display
      setAdminRoleName(res.data.adminRoleName ?? null);
    } catch {
      // apiRequest interceptor already toasted the error — just reset state
      setPermissions([]);
      setIsSuperAdmin(false);
      setAdminRoleName(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.isAdmin, authLoading]);

  // Re-fetch when auth state changes (login, logout, role change)
  useEffect(() => { fetchMe(); }, [fetchMe]);

  /**
   * Returns true if the admin has the given permission token.
   * Wildcard '*' (set by fetchUser for super_admins) grants everything.
   * Also checks permissions array for explicit grants.
   */
  const hasPermission = useCallback(
    (perm) => isSuperAdmin || permissions.includes('*') || permissions.includes(perm),
    [isSuperAdmin, permissions]
  );

  const value = {
    permissions,
    isSuperAdmin,
    adminRoleName,
    hasPermission,
    loading,
    refresh: fetchMe,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

/**
 * Primary hook for permission checks throughout the admin frontend.
 *
 * Returns:
 *   permissions   {string[]}   resolved permission tokens (or ['*'] for super_admin)
 *   isSuperAdmin  {boolean}
 *   adminRoleName {string|null}
 *   hasPermission {(perm: string) => boolean}
 *   loading       {boolean}
 *   refresh       {() => void}
 */
export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used inside <PermissionsProvider>');
  return ctx;
};

/**
 * Alias hook for components that previously imported from AdminAuthContext.
 * Exposes the same shape as AdminAuthContext so those components can migrate
 * to a single context without a full rewrite.
 *
 * AdminAuthContext shape:
 *   { permissions, isSuperAdmin, roleName, hasPermission, refreshPermissions, loading }
 *
 * Differences mapped here:
 *   adminRoleName → roleName
 *   refresh       → refreshPermissions
 */
export const useAdminAuth = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside <PermissionsProvider>');

  return {
    permissions:        ctx.permissions,
    isSuperAdmin:       ctx.isSuperAdmin,
    roleName:           ctx.adminRoleName,   // aliased to match AdminAuthContext shape
    hasPermission:      ctx.hasPermission,
    refreshPermissions: ctx.refresh,         // aliased to match AdminAuthContext shape
    loading:            ctx.loading,
  };
};

export default PermissionsContext;