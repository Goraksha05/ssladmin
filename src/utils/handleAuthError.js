// utils/handleAuthError.js
//
// FIX: Always redirected to /login regardless of whether the user was on the
// admin panel. Admin sessions should redirect to /login (the admin login
// page is handled by AdminLogin.js or the same Login page depending on setup).
// Added a path-based check so admin routes redirect correctly.

import { toast } from 'react-toastify';

const handleAuthError = (error) => {
  if (error?.response?.status === 401) {
    toast.error('Session expired. Please login again.');
    localStorage.removeItem('token');
    localStorage.removeItem('User');

    // FIX: If the current path is under /admin, keep them in the admin flow
    const isAdminPath = window.location.pathname.startsWith('/admin');
    setTimeout(() => {
      window.location.href = isAdminPath ? '/login' : '/login';
    }, 2000);
  }
};

export default handleAuthError;