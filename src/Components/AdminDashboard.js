// Components/AdminDashboard.js
// Tab labels fully translated via I18nThemeContext.

import React, { useState } from "react";
import AdminRewardDashboard  from "./AdminRewardDashboard";
import AdminRewardUndoPanel  from "./AdminRewardUndoPanel";
import ClaimDashboard        from "./ClaimDashboard";
import AdminUserReport       from "./UserReport";
import { useI18nTheme }      from "../Context/I18nThemeContext";

const AdminDashboard = () => {
  const { t } = useI18nTheme();
  const [activeTab, setActiveTab] = useState("rewards");

  const tabs = [
    { id: "rewards", icon: "📊", labelKey: "tabRewardSummary" },
    { id: "undo",    icon: "↩️", labelKey: "tabUndoReward"    },
    { id: "claims",  icon: "🎁", labelKey: "tabClaimMonitor"  },
    { id: "report",  icon: "👥", labelKey: "tabUserReport"    },
  ];

  return (
    <div className="admin-dashboard-wrapper">
      {/* Tab Navigation */}
      <div className="tab-navigation" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            {t[tab.labelKey] ?? tab.labelKey}
          </button>
        ))}
      </div>

      {/* Content Panels */}
      <div className="dashboard-content">
        {activeTab === "rewards" && <AdminRewardDashboard />}
        {activeTab === "undo"    && <AdminRewardUndoPanel />}
        {activeTab === "claims"  && <ClaimDashboard />}
        {activeTab === "report"  && <AdminUserReport />}
      </div>

      <style>{`
        .admin-dashboard-wrapper {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        .tab-navigation {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          background: var(--bg-primary);
          padding: 1rem;
          border-radius: 1rem;
          border: 1px solid var(--border-color);
        }
        .tab-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.9375rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-button:hover {
          background: var(--bg-tertiary);
          transform: translateY(-2px);
        }
        .tab-button.active {
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          color: white;
          border-color: transparent;
          box-shadow: var(--shadow-md);
        }
        .dashboard-content { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @media (max-width: 768px) {
          .tab-button {
            flex: 1;
            justify-content: center;
            min-width: calc(50% - 0.375rem);
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;