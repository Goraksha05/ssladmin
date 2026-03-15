// Context/PermissionsContext.js
// Fetches the current admin's resolved permission set from /api/admin/me
// and exposes:
//   usePermissions()  →  { permissions, isSuperAdmin, adminRoleName, hasPermission, loading }
//
// Consumed by AdminLayout (sidebar gating) and individual admin pages.

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiRequest from '../utils/apiRequest';
import { useAuth } from './AuthContext';

const PermissionsContext = createContext(null);

export const PermissionsProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  const [permissions,    setPermissions]    = useState([]);
  const [isSuperAdmin,   setIsSuperAdmin]   = useState(false);
  const [adminRoleName,  setAdminRoleName]  = useState(null);
  const [loading,        setLoading]        = useState(true);

  const fetchMe = useCallback(async () => {
    if (!isAuthenticated || !user?.isAdmin) {
      setPermissions([]);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest.get('/api/admin/me');
      setPermissions(res.data.permissions ?? []);
      setIsSuperAdmin(res.data.isSuperAdmin ?? false);
      setAdminRoleName(res.data.adminRoleName ?? null);
    } catch {
      setPermissions([]);
      setIsSuperAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.isAdmin]);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  /** Returns true if the admin has the given permission (or is super_admin). */
  const hasPermission = useCallback(
    (perm) => isSuperAdmin || permissions.includes('*') || permissions.includes(perm),
    [isSuperAdmin, permissions]
  );

  return (
    <PermissionsContext.Provider value={{
      permissions,
      isSuperAdmin,
      adminRoleName,
      hasPermission,
      loading,
      refresh: fetchMe,
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used inside <PermissionsProvider>');
  return ctx;
};