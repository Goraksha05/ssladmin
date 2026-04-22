// hooks/useAudit.js

import apiRequest from "../utils/apiRequest";

export const useAudit = () => {
  const logAction = async (action, details = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[audit]', action, details);
    }
  };

  return { logAction };
};