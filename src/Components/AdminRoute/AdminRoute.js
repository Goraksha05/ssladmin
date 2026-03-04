// Components/AdminRoute/AdminRoute.js
//
// FIX: Was redirecting to /unauthorized — a route that doesn't exist in App.js,
// causing a loop. Now redirects to /login for both unauthenticated and
// non-admin users.

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../Context/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated)  return <Navigate to="/login" replace />;
  if (!user?.isAdmin)    return <Navigate to="/login" replace />;

  return children;
};

export default AdminRoute;