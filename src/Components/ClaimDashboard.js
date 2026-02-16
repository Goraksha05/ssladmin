import React from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const fetchClaims = async () => {
  const token = localStorage.getItem("token");
  const { data } = await axios.get("/api/admin/reward-claims", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

const ClaimDashboard = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["claims"],
    queryFn: fetchClaims,
    staleTime: 60_000,
    retry: 2
  });

  const getClaimIcon = (type) => {
    switch(type?.toLowerCase()) {
      case 'referral': return '👥';
      case 'post': return '📝';
      case 'streak': return '🔥';
      default: return '🎁';
    }
  };

  const getClaimColor = (type) => {
    switch(type?.toLowerCase()) {
      case 'referral': return '#7c3aed';
      case 'post': return '#ec4899';
      case 'streak': return '#f59e0b';
      default: return '#2563eb';
    }
  };

  const getTypeStats = () => {
    if (!data || data.length === 0) return [];
    
    const stats = data.reduce((acc, claim) => {
      const type = claim.type || 'other';
      if (!acc[type]) {
        acc[type] = { type, count: 0, icon: getClaimIcon(type), color: getClaimColor(type) };
      }
      acc[type].count++;
      return acc;
    }, {});

    return Object.values(stats);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading claims data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>Failed to load claims</h3>
        <p>Please try refreshing the page</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="empty-container">
        <div className="empty-icon">📭</div>
        <h3>No Reward Claims</h3>
        <p>There are no reward claims to display at this time.</p>
      </div>
    );
  }

  const typeStats = getTypeStats();

  return (
    <>
      <section className="claims-dashboard">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h2 className="dashboard-title">Reward Claim Monitor</h2>
            <p className="dashboard-subtitle">Track all reward claims in real-time</p>
          </div>
          <div className="dashboard-badge">
            <span className="badge-label">Total Claims</span>
            <span className="badge-value">{data.length}</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          {typeStats.map((stat) => (
            <div key={stat.type} className="stat-card" style={{ '--stat-color': stat.color }}>
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-content">
                <span className="stat-label">{stat.type}</span>
                <span className="stat-value">{stat.count}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Claims Table */}
        <div className="claims-table-container">
          <div className="table-wrapper">
            <table className="claims-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Milestone</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {data.map((claim, i) => (
                  <tr key={i}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {(claim.user?.name || "U")[0].toUpperCase()}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{claim.user?.name || "Unknown"}</div>
                          <div className="user-email">{claim.user?.email || "N/A"}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="type-badge" style={{ '--badge-color': getClaimColor(claim.type) }}>
                        <span className="type-icon">{getClaimIcon(claim.type)}</span>
                        <span>{claim.type}</span>
                      </div>
                    </td>
                    <td>
                      <span className="milestone-badge">{claim.milestone}</span>
                    </td>
                    <td>
                      <div className="date-cell">
                        <div className="date-primary">
                          {new Date(claim.date).toLocaleDateString(undefined, { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </div>
                        <div className="date-secondary">
                          {new Date(claim.date).toLocaleTimeString(undefined, { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <style>{`
        .claims-dashboard {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .dashboard-title {
          font-size: 1.875rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .dashboard-subtitle {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin: 0.5rem 0 0 0;
        }

        .dashboard-badge {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          padding: 0.75rem 1.25rem;
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          border-radius: 0.75rem;
          color: white;
        }

        .badge-label {
          font-size: 0.75rem;
          opacity: 0.9;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .badge-value {
          font-size: 1.875rem;
          font-weight: 700;
          margin-top: 0.25rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .stat-card {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 1rem;
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--stat-color);
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }

        .stat-icon {
          font-size: 2rem;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
          font-weight: 500;
          text-transform: capitalize;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .claims-table-container {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 1rem;
          overflow: hidden;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .claims-table {
          width: 100%;
          border-collapse: collapse;
        }

        .claims-table thead {
          background: var(--bg-secondary);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .claims-table th {
          padding: 1rem 1.5rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border-bottom: 2px solid var(--border-color);
        }

        .claims-table td {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
        }

        .claims-table tbody tr {
          transition: background 0.2s;
        }

        .claims-table tbody tr:hover {
          background: var(--bg-secondary);
        }

        .user-cell {
          display: flex;
          align-items: center;
          gap: 0.875rem;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          flex-shrink: 0;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .user-name {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 0.9375rem;
        }

        .user-email {
          font-size: 0.8125rem;
          color: var(--text-secondary);
        }

        .type-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: color-mix(in srgb, var(--badge-color) 15%, transparent);
          border: 1px solid color-mix(in srgb, var(--badge-color) 30%, transparent);
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--badge-color);
          text-transform: capitalize;
        }

        .type-icon {
          font-size: 1.125rem;
        }

        .milestone-badge {
          display: inline-block;
          padding: 0.5rem 1rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .date-cell {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .date-primary {
          font-size: 0.9375rem;
          color: var(--text-primary);
          font-weight: 500;
        }

        .date-secondary {
          font-size: 0.8125rem;
          color: var(--text-secondary);
        }

        .loading-container,
        .error-container,
        .empty-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          gap: 1rem;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid var(--border-color);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-container {
          color: var(--danger);
        }

        .error-icon,
        .empty-icon {
          font-size: 4rem;
        }

        .error-container h3,
        .empty-container h3 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .error-container p,
        .empty-container p {
          margin: 0;
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .dashboard-badge {
            width: 100%;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }

          .badge-value {
            margin-top: 0;
          }

          .claims-table th,
          .claims-table td {
            padding: 0.875rem 1rem;
            font-size: 0.875rem;
          }

          .user-cell {
            gap: 0.625rem;
          }

          .user-avatar {
            width: 36px;
            height: 36px;
            font-size: 0.875rem;
          }

          .user-name {
            font-size: 0.875rem;
          }

          .user-email {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </>
  );
};

export default ClaimDashboard;
