// utils/handleAuthError.js
//
// CHANGES FROM ORIGINAL:
//
//   1. CRITICAL — Dead branch (documented in original but not fully fixed).
//      The ternary `isAdminPath ? '/login' : '/login'` was identical on both
//      sides. Already corrected conceptually in the original — kept as-is.
//
//   2. FIX — Incomplete localStorage clearance. AuthContext stores the token
//      under both 'authtoken' AND 'token' (it reads both on restore). The
//      original only cleared 'token', 'User', and 'refreshToken'. Added
//      'authtoken' (the key AuthService.login() writes under in the updated
//      backend alignment) so old sessions can't be re-hydrated after 401.
//
//   3. FIX — The 1500ms delay before redirect gave the toast time to show,
//      but during that window the user could trigger additional API calls that
//      would each call handleAuthError again, producing multiple toasts and
//      a double redirect. Added a module-level `redirecting` flag to debounce.

import { toast } from 'react-toastify';

let redirecting = false;   // prevent duplicate 401 handling in parallel requests

const handleAuthError = (error) => {
  if (error?.response?.status === 401 && !redirecting) {
    redirecting = true;

    toast.error('Session expired. Please log in again.', { toastId: 'auth-401' });

    // FIX: clear ALL token keys that AuthContext / AuthService may have written
    ['token', 'authtoken', 'authToken', 'accessToken', 'User', 'refreshToken'].forEach(
      key => localStorage.removeItem(key)
    );

    setTimeout(() => {
      window.location.href = '/login';
      // Reset flag after navigation (in case SPA handles it without a full reload)
      redirecting = false;
    }, 1500);
  }
};

export default handleAuthError;