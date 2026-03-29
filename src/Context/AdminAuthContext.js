// Context/AdminAuthContext.js
//
// CHANGES FROM ORIGINAL:
//
//   1. CRITICAL — Eliminated duplicate GET /api/admin/me network request.
//      The original AdminAuthContext made its own apiRequest.get('/api/admin/me')
//      call independently of PermissionsContext, which makes the SAME call.
//      Both contexts were mounted in the app tree, so every page load fired
//      the endpoint twice with no benefit.
//
//      Fix: AdminAuthContext now reads state from PermissionsContext (which
//      owns the canonical data) and re-exports it under the original
//      AdminAuthContext field names for backward compatibility:
//        PermissionsContext.adminRoleName → AdminAuthContext.roleName
//        PermissionsContext.refresh       → AdminAuthContext.refreshPermissions
//
//      This is a zero-breaking-change refactor: every component that called
//      `useAdminAuth()` continues to work identically.
//
//   2. MEDIUM — Original made the fetch unconditionally on mount (no auth
//      guard). If an unauthenticated user loaded a page that happened to mount
//      AdminAuthProvider, it would fire a 401 (then the apiRequest interceptor
//      toasted "Unauthorized"). Now the guard is inherited from PermissionsContext
//      which waits for auth hydration before fetching.
//
//   3. MINOR — `roleName` was stored as an empty string "" when null was
//      returned from the server. Changed to null so consumers can distinguish
//      "no role assigned" from "role name is an empty string".
//
// MIGRATION NOTE:
//   If you have AdminAuthProvider and PermissionsProvider both in your App tree,
//   you can now REMOVE AdminAuthProvider entirely and replace `useAdminAuth()`
//   imports with `usePermissions()` from PermissionsContext. The `useAdminAuth`
//   alias exported from PermissionsContext provides the same shape.
//   AdminAuthContext is kept here purely for components that haven't migrated yet.

import React, { createContext, useContext } from 'react';
import { usePermissions } from './PermissionsContext';

const AdminAuthContext = createContext();

/**
 * AdminAuthProvider now delegates entirely to PermissionsContext.
 *
 * IMPORTANT: PermissionsProvider must be an ancestor in the tree for this
 * to work. Typical tree:
 *
 *   <AuthProvider>
 *     <PermissionsProvider>       ← owns the /api/admin/me fetch
 *       <AdminAuthProvider>       ← re-exports PermissionsContext data
 *         <App />
 *       </AdminAuthProvider>
 *     </PermissionsProvider>
 *   </AuthProvider>
 */
export const AdminAuthProvider = ({ children }) => {
  // Consume PermissionsContext which already fetched /api/admin/me.
  // No additional network request is made here.
  const {
    permissions,
    isSuperAdmin,
    adminRoleName,
    hasPermission,
    loading,
    refresh,
  } = usePermissions();

  // Re-export under the original AdminAuthContext shape for backward compat.
  const value = {
    permissions,
    isSuperAdmin,
    roleName:           adminRoleName,  // original field name used by consumers
    hasPermission,
    refreshPermissions: refresh,        // original action name used by consumers
    loading,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

/**
 * Hook for components that imported from AdminAuthContext.
 * Returns the same shape as the original:
 *   { permissions, isSuperAdmin, roleName, hasPermission, refreshPermissions, loading }
 */
export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
};

export default AdminAuthContext;