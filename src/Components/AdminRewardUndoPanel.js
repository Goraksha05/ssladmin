import React, { useEffect, useState } from "react";
import apiRequest from "../utils/apiRequest";
import { toast } from "react-toastify";

const AdminRewardUndoPanel = () => {
  const [users, setUsers] = useState([]);
  const [uid, setUid] = useState("");
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    apiRequest
      .get("/api/admin/users")
      .then((r) => setUsers(r.data.users))
      .catch(() => toast.error("Failed to load users"));
  }, []);

  const loadRewards = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const { data } = await apiRequest.get("/api/admin/rewards");
      setRewards({
        referral: data.referralRewards.filter((x) => x.user._id === uid),
        post: data.postRewards.filter((x) => x.user._id === uid),
        streak: data.streakRewards.filter((x) => x.user._id === uid)
      });
    } catch (error) {
      toast.error("Failed to load rewards");
    } finally {
      setLoading(false);
    }
  };

  const undo = async (type, slab) => {
    if (!window.confirm(`Are you sure you want to undo ${type} reward for slab "${slab}"? This action cannot be reversed.`)) return;
    try {
      await apiRequest.post("/api/admin/undo-reward", {
        userId: uid,
        type,
        slab
      });
      toast.success("Reward reverted successfully!");
      loadRewards();
    } catch (error) {
      toast.error("Failed to undo reward");
    }
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedUser = users.find(u => u._id === uid);

  const getRewardIcon = (type) => {
    switch(type) {
      case 'referral': return '👥';
      case 'post': return '📝';
      case 'streak': return '🔥';
      default: return '🎁';
    }
  };

  const getRewardColor = (type) => {
    switch(type) {
      case 'referral': return '#7c3aed';
      case 'post': return '#ec4899';
      case 'streak': return '#f59e0b';
      default: return '#2563eb';
    }
  };

  return (
    <>
      <section className="undo-panel">
        {/* Header */}
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Undo Rewards</h2>
            <p className="panel-subtitle">Revert rewards granted to users</p>
          </div>
        </div>

        {/* User Selection */}
        <div className="selection-card">
          <label className="input-label">Select User</label>
          <div className="search-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="search-icon">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <select
            value={uid}
            onChange={(e) => {
              setUid(e.target.value);
              setRewards(null);
              setSearchTerm("");
            }}
            className="user-select"
          >
            <option value="">Choose a user...</option>
            {filteredUsers.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>

          {selectedUser && (
            <div className="selected-user-info">
              <div className="user-avatar-large">
                {(selectedUser.name || "U")[0].toUpperCase()}
              </div>
              <div>
                <div className="user-name">{selectedUser.name}</div>
                <div className="user-email">{selectedUser.email}</div>
              </div>
            </div>
          )}

          <button
            onClick={loadRewards}
            disabled={!uid || loading}
            className="load-button"
          >
            {loading ? (
              <>
                <div className="button-spinner"></div>
                Loading...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Load Rewards
              </>
            )}
          </button>
        </div>

        {/* Rewards List */}
        {rewards && (
          <div className="rewards-section">
            {["referral", "post", "streak"].map((type) => (
              <div key={type} className="reward-category">
                <div className="category-header" style={{ '--category-color': getRewardColor(type) }}>
                  <div className="category-info">
                    <span className="category-icon">{getRewardIcon(type)}</span>
                    <h3 className="category-title">
                      {type.charAt(0).toUpperCase() + type.slice(1)} Rewards
                    </h3>
                    <span className="category-count">{rewards[type].length}</span>
                  </div>
                </div>

                {rewards[type].length > 0 ? (
                  <div className="reward-list">
                    {rewards[type].map((r, i) => {
                      const slab = r.slabAwarded ?? r.streakslab;
                      return (
                        <div key={i} className="reward-item">
                          <div className="reward-info">
                            <span className="reward-slab">{slab}</span>
                            <span className="reward-date">
                              {new Date(r.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            onClick={() => undo(type, slab)}
                            className="undo-button"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Undo
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="no-rewards">
                    <span className="no-rewards-icon">📭</span>
                    <p>No {type} rewards found for this user</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!rewards && uid && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <p className="empty-state-text">Click "Load Rewards" to view this user's rewards</p>
          </div>
        )}

        {!uid && (
          <div className="empty-state">
            <div className="empty-state-icon">👆</div>
            <p className="empty-state-text">Select a user to get started</p>
          </div>
        )}
      </section>

      <style>{`
        .undo-panel {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          max-width: 900px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .panel-title {
          font-size: 1.875rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .panel-subtitle {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin: 0.5rem 0 0 0;
        }

        .selection-card {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 1rem;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .input-label {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--text-primary);
          margin-bottom: -0.5rem;
        }

        .search-box {
          position: relative;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-secondary);
        }

        .search-input {
          width: 100%;
          padding: 0.875rem 1rem 0.875rem 3rem;
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 0.9375rem;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .user-select {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 0.9375rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .user-select:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .selected-user-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border-radius: 0.75rem;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .user-avatar-large {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.25rem;
        }

        .user-name {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 1rem;
        }

        .user-email {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-top: 0.125rem;
        }

        .load-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.9375rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .load-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(37, 99, 235, 0.3);
        }

        .load-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .button-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .rewards-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .reward-category {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 1rem;
          overflow: hidden;
        }

        .category-header {
          padding: 1.25rem 1.5rem;
          background: var(--bg-secondary);
          border-bottom: 2px solid var(--category-color);
        }

        .category-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .category-icon {
          font-size: 1.5rem;
        }

        .category-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .category-count {
          margin-left: auto;
          background: var(--category-color);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .reward-list {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .reward-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          transition: all 0.2s;
        }

        .reward-item:hover {
          background: var(--bg-tertiary);
          transform: translateX(4px);
        }

        .reward-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .reward-slab {
          font-weight: 600;
          font-size: 1rem;
          color: var(--text-primary);
        }

        .reward-date {
          font-size: 0.8125rem;
          color: var(--text-secondary);
        }

        .undo-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--danger);
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .undo-button:hover {
          background: #dc2626;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .no-rewards {
          padding: 3rem 2rem;
          text-align: center;
          color: var(--text-secondary);
        }

        .no-rewards-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 1rem;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
        }

        .empty-state-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .empty-state-text {
          font-size: 1rem;
          color: var(--text-secondary);
          margin: 0;
        }

        @media (max-width: 768px) {
          .undo-panel {
            max-width: 100%;
          }

          .selection-card {
            padding: 1.5rem;
          }

          .reward-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .undo-button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
};

export default AdminRewardUndoPanel;
