// Components/AdminRouteGuard.js
//
// CHANGES FROM ORIGINAL:
//
//   1. FIX — Migrated from useAdminAuth (AdminAuthContext) to usePermissions
//      (PermissionsContext). Per the previous batch refactor, AdminAuthContext
//      now just re-exports from PermissionsContext — both work. usePermissions
//      is the canonical hook and is used here for clarity.
//
//   2. FIX — When `loading` is true (permissions still fetching from
//      /api/admin/me), the original returned `null` silently. This caused a
//      brief flash of empty content. Now returns a minimal inline spinner so
//      the UX is consistent with the rest of the admin panel.
//
//   3. FIX — Redirect on permission denial now goes to /admin/dashboard
//      (where they have access) rather than leaving the user stranded.

import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../Context/PermissionsContext';

const AdminRouteGuard = ({ permission, children }) => {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '4rem', gap: '.75rem', color: 'var(--text-secondary)',
      }}>
        <div style={{
          width: 28, height: 28, border: '3px solid var(--border, #e2e8f0)',
          borderTopColor: 'var(--accent, #4f46e5)', borderRadius: '50%',
          animation: 'argSpin .8s linear infinite',
        }} />
        <style>{`@keyframes argSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

export default AdminRouteGuard;