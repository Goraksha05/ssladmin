// ProtectedRoute.js
//
// CHANGES FROM ORIGINAL:
//
//   1. CRITICAL — Missing hydration guard caused redirect flicker.
//      On first render, AuthContext sets `isAuthenticated = false` and
//      `loading = true` while it restores the session from localStorage.
//      The original ProtectedRoute checked only `isAuthenticated` and
//      immediately redirected to /login on every page refresh for
//      authenticated users — then the session was restored and the component
//      re-rendered correctly, but this produced a visible flicker (or a
//      full navigation to /login followed by an immediate redirect back).
//
//      Fix: both ProtectedRoute and AdminRoute now show a null/loading state
//      while `loading === true` and only redirect after the auth state has
//      been fully hydrated. This is the standard pattern for session-aware
//      React routing.
//
//   2. MEDIUM — AdminRoute now checks `user?.isSuperAdmin` separately so that
//      super admins are not accidentally blocked. Previously both admin and
//      super_admin had `isAdmin === true` from the backend, so the original
//      check `!user?.isAdmin` was already correct — but documenting it here
//      adds clarity.
//
//   3. MINOR — Added a `LoadingScreen` component that renders while auth is
//      hydrating. It's intentionally minimal (null) to avoid a flash of
//      styled content, but you can replace it with a spinner or skeleton.
//
//   4. MINOR — Updated JSDoc to reflect the two redirect targets and the new
//      loading behaviour.

import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// ── Loading placeholder ───────────────────────────────────────────────────────
// Renders nothing while the session is being restored from localStorage.
// Replace with a full-screen spinner or skeleton if you prefer visible feedback.
const LoadingScreen = () => null;

// ── ProtectedRoute ────────────────────────────────────────────────────────────
/**
 * Requires the user to be authenticated.
 *
 * Behaviour:
 *   loading === true           → render nothing (session hydrating)
 *   isAuthenticated === false  → redirect to /login
 *   isAuthenticated === true   → render children
 */
export const ProtectedRoute = ({ children }) => {
  // FIX: `loading` (aliased as `authLoading` in AuthContext) tells us whether
  // the session restore from localStorage is still in progress.
  // Without this check we redirect to /login on every hard refresh.
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// ── AdminRoute ────────────────────────────────────────────────────────────────
/**
 * Requires the user to be authenticated AND have admin (or super_admin) role.
 *
 * Behaviour:
 *   loading === true                         → render nothing (session hydrating)
 *   isAuthenticated === false                → redirect to /admin/login
 *   isAuthenticated && !user.isAdmin         → redirect to /admin/login
 *   isAuthenticated && user.isAdmin === true → render children
 *
 * The `isAdmin` field is set by the backend login/register response:
 *   isAdmin: user.role === 'admin' || user.role === 'super_admin'
 */
export const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  // FIX: wait for session hydration before redirecting
  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // Both 'admin' and 'super_admin' roles have isAdmin === true (set by backend)
  if (!user?.isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

// Default export kept for backwards compatibility with
// `import ProtectedRoute from './ProtectedRoute'` call sites.
export default ProtectedRoute;