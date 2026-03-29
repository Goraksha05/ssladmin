// Components/AdminRoute/AdminRoute.js
//
// CHANGES FROM ORIGINAL:
//
//   1. FIX — Missing authLoading guard. Without it, on hard reload the component
//      read `isAuthenticated: false` (auth not yet hydrated from localStorage)
//      and immediately redirected to /login — logging out a valid admin session.
//      Fix: return null while authLoading is true, matching the pattern in
//      PublicOnlyRoute and PrivateRoute in App.js.
//
//   2. NOTE — This file is kept for backward compatibility. App.js now uses
//      the inline AdminGuard function instead, but any component that imports
//      AdminRoute directly from this path will still work correctly.

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../Context/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, authLoading } = useAuth();

  // FIX: wait for session hydration before evaluating auth state
  if (authLoading) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin)   return <Navigate to="/"      replace />;

  return children;
};

export default AdminRoute;