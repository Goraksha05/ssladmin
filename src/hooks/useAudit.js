// hooks/useAudit.js

import apiRequest from "../utils/apiRequest";

export const useAudit = () => {
  const logAction = async (action, details = {}) => {
    try {
      await apiRequest.post("/api/admin/audit-log", {
        action,
        details,
      });
    } catch (err) {
      console.warn("Audit log failed", err);
    }
  };

  return { logAction };
};