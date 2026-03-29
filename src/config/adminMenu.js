// config/adminMenu.js

export const ADMIN_MENU = [
  { label: "Dashboard", path: "/admin/dashboard", icon: "📊" },

  { label: "Users", path: "/admin/users", perm: "view_users", icon: "👥" },

  { label: "Rewards", path: "/admin/rewards", perm: "view_rewards", icon: "🎁" },

  { label: "Claims", path: "/admin/reports", perm: "view_reports", icon: "📄" },

  { label: "Financial", path: "/admin/financial", perm: "view_financial_reports", icon: "💰" },

  { label: "Content", path: "/admin/posts", perm: "moderate_posts", icon: "🛡️" },

  { label: "Audit Logs", path: "/admin/audit-logs", perm: "view_audit_logs", icon: "📜" },

  { label: "Admins", path: "/admin/admins", perm: "manage_admins", icon: "👑" },

  { label: "Roles", path: "/admin/roles", superAdmin: true, icon: "⚙️" },
];