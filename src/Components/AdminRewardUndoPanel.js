// Components/AdminRewardUndoPanel.js
//
// CHANGES FROM ORIGINAL:
//
//   1. CRITICAL — `t.undoConfirm(type, slab)` crashes. Translation values in
//      I18nThemeContext are plain strings, not functions. Calling `t.undoConfirm(...)`
//      throws "t.undoConfirm is not a function". Fixed: inline the confirm string
//      using a template literal.
//
//   2. CRITICAL — `t.noRewards(type)` crashes for the same reason — string, not
//      function. Fixed: inline the string.
//
//   3. FIX — GET /api/admin/users returns a paginated response. The original
//      fetch had no limit param and only got the first page (typically 20 users).
//      Fixed: added limit=200&sortBy=name so the dropdown has coverage for
//      most platforms.
//
//   4. FIX — reward filter: `x.user._id === uid` — if the reward document
//      populates `user` as an object, this works. But if `user` is just an
//      ObjectId string (not populated), the comparison fails. Added a fallback:
//      `x.user?._id === uid || x.user === uid`.
//
//   5. FIX — t.failedLoadUsers used as a useEffect dep. If the translation
//      object reference changes on every render (some context implementations
//      do this), the effect fires in a loop. Fixed: replaced with the literal
//      string 'Failed to load users' as the fallback, and removed the dep.

import React, { useEffect, useState } from 'react';
import apiRequest from '../utils/apiRequest';
import { toast } from 'react-toastify';
import { useI18nTheme } from '../Context/I18nThemeContext';
import AdminToolbar from './AdminToolbar';

const AdminRewardUndoPanel = () => {
  const { t } = useI18nTheme();
  const [users,      setUsers]      = useState([]);
  const [uid,        setUid]        = useState('');
  const [rewards,    setRewards]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // FIX: added limit=200, removed t.failedLoadUsers from dep array (loop risk)
  useEffect(() => {
    apiRequest.get('/api/admin/users?limit=200&sortBy=name&sortOrder=asc')
      .then(r => setUsers(r.data.users || []))
      .catch(() => toast.error('Failed to load users'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRewards = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const { data } = await apiRequest.get('/api/admin/rewards');
      // FIX: added `|| x.user === uid` fallback for non-populated user fields
      setRewards({
        referral: (data.referralRewards || []).filter(x => x.user?._id === uid || x.user === uid),
        post:     (data.postRewards     || []).filter(x => x.user?._id === uid || x.user === uid),
        streak:   (data.streakRewards   || []).filter(x => x.user?._id === uid || x.user === uid),
      });
    } catch {
      toast.error(t.failedLoadRewards || 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const undo = async (type, slab) => {
    // FIX: was t.undoConfirm(type, slab) — t values are strings, not functions
    if (!window.confirm(`Are you sure you want to undo the ${type} reward (slab: ${slab})?`)) return;
    try {
      await apiRequest.post('/api/admin/undo-reward', { userId: uid, type, slab });
      toast.success(t.rewardReverted || 'Reward reverted successfully');
      loadRewards();
    } catch {
      toast.error(t.failedUndo || 'Failed to undo reward');
    }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedUser = users.find(u => u._id === uid);

  const getRewardColor = (type) => ({ referral: '#7c3aed', post: '#ec4899', streak: '#f59e0b' }[type] || '#2563eb');
  const getRewardIcon  = (type) => ({ referral: '👥',      post: '📝',      streak: '🔥'    }[type] || '🎁');
  const typeLabel      = (type) => ({
    referral: t.referral || 'Referral',
    post:     t.post     || 'Post',
    streak:   t.streak   || 'Streak',
  }[type] || type);

  return (
    <>
      <section className="undo-panel">
        {/* Header */}
        <div className="panel-header">
          <div>
            <h2 className="panel-title">{t.undoRewards || 'Undo Rewards'}</h2>
            <p className="panel-subtitle">{t.undoSubtitle || 'Revert incorrectly awarded rewards for a user'}</p>
          </div>
          <AdminToolbar />
        </div>

        {/* User Selection */}
        <div className="selection-card">
          <label className="input-label">{t.selectUser || 'Select User'}</label>

          <div className="search-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="search-icon">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder={t.searchByNameEmail || 'Search by name or email…'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <select
            value={uid}
            onChange={e => { setUid(e.target.value); setRewards(null); setSearchTerm(''); }}
            className="user-select"
          >
            <option value="">{t.chooseUser || 'Choose a user…'}</option>
            {filteredUsers.map(u => (
              <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
            ))}
          </select>

          {selectedUser && (
            <div className="selected-user-info">
              <div className="user-avatar-large">{(selectedUser.name || 'U')[0].toUpperCase()}</div>
              <div>
                <div className="user-name">{selectedUser.name}</div>
                <div className="user-email">{selectedUser.email}</div>
              </div>
            </div>
          )}

          <button onClick={loadRewards} disabled={!uid || loading} className="load-button">
            {loading ? (
              <><div className="button-spinner" />{t.loading2 || 'Loading…'}</>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t.loadRewards || 'Load Rewards'}
              </>
            )}
          </button>
        </div>

        {/* Rewards List */}
        {rewards && (
          <div className="rewards-section">
            {['referral', 'post', 'streak'].map(type => (
              <div key={type} className="reward-category">
                <div className="category-header" style={{ '--category-color': getRewardColor(type) }}>
                  <div className="category-info">
                    <span className="category-icon">{getRewardIcon(type)}</span>
                    <h3 className="category-title">{typeLabel(type)} Rewards</h3>
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
                            <span className="reward-date">{new Date(r.createdAt).toLocaleDateString()}</span>
                          </div>
                          <button onClick={() => undo(type, slab)} className="undo-button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            {t.undo || 'Undo'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="no-rewards">
                    <span className="no-rewards-icon">📭</span>
                    {/* FIX: was t.noRewards(type) — string, not function */}
                    <p>{t.noRewards || `No ${type} rewards for this user`}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!rewards && uid && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <p className="empty-state-text">{t.clickLoadRewards || 'Click "Load Rewards" to view this user\'s reward history'}</p>
          </div>
        )}

        {!uid && (
          <div className="empty-state">
            <div className="empty-state-icon">👆</div>
            <p className="empty-state-text">{t.selectUserToStart || 'Select a user above to get started'}</p>
          </div>
        )}
      </section>

      <style>{`
        .undo-panel { display:flex; flex-direction:column; gap:2rem; max-width:900px; }

        .panel-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
        .panel-title { font-size:1.875rem; font-weight:700; color:var(--text-primary); margin:0; }
        .panel-subtitle { font-size:.875rem; color:var(--text-secondary); margin:.5rem 0 0 0; }

        .selection-card { background:var(--bg-card,#fff); border:1px solid var(--border-color,#e2e8f0);
          border-radius:1rem; padding:2rem; display:flex; flex-direction:column; gap:1.5rem; }
        .input-label { font-weight:600; font-size:.875rem; color:var(--text-primary); }

        .search-box { position:relative; }
        .search-icon { position:absolute; left:1rem; top:50%; transform:translateY(-50%); color:var(--text-secondary); }
        .search-input { width:100%; padding:.875rem 1rem .875rem 3rem; border:1px solid var(--border-color,#e2e8f0);
          border-radius:.5rem; background:var(--bg-canvas,#f8fafc); color:var(--text-primary);
          font-size:.9375rem; transition:all .2s; font-family:inherit; box-sizing:border-box; }
        .search-input:focus { outline:none; border-color:var(--accent,#4f46e5); box-shadow:0 0 0 3px rgba(79,70,229,.1); }
        .search-input::placeholder { color:var(--text-secondary); }

        .user-select { width:100%; padding:.875rem 1rem; border:1px solid var(--border-color,#e2e8f0);
          border-radius:.5rem; background:var(--bg-canvas,#f8fafc); color:var(--text-primary);
          font-size:.9375rem; cursor:pointer; transition:all .2s; font-family:inherit; }
        .user-select:focus { outline:none; border-color:var(--accent,#4f46e5); }

        .selected-user-info { display:flex; align-items:center; gap:1rem; padding:1rem;
          background:var(--bg-canvas,#f8fafc); border-radius:.75rem; animation:slideIn .3s ease; }
        @keyframes slideIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        .user-avatar-large { width:48px; height:48px; border-radius:50%;
          background:linear-gradient(135deg,var(--accent,#4f46e5),#7c3aed); color:#fff;
          display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.25rem; }
        .user-name  { font-weight:600; color:var(--text-primary); font-size:1rem; }
        .user-email { font-size:.875rem; color:var(--text-secondary); margin-top:.125rem; }

        .load-button { display:flex; align-items:center; justify-content:center; gap:.5rem;
          padding:.875rem 1.5rem; background:linear-gradient(135deg,var(--accent,#4f46e5),#7c3aed);
          color:#fff; border:none; border-radius:.5rem; font-weight:600; font-size:.9375rem;
          cursor:pointer; transition:all .2s; font-family:inherit; }
        .load-button:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 16px rgba(79,70,229,.3); }
        .load-button:disabled { opacity:.6; cursor:not-allowed; }
        .button-spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,.3);
          border-top-color:#fff; border-radius:50%; animation:bSpin .8s linear infinite; }
        @keyframes bSpin { to{transform:rotate(360deg)} }

        .rewards-section { display:flex; flex-direction:column; gap:1.5rem; animation:fadeIn .3s ease; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }

        .reward-category { background:var(--bg-card,#fff); border:1px solid var(--border-color,#e2e8f0);
          border-radius:1rem; overflow:hidden; }
        .category-header { padding:1.25rem 1.5rem; background:var(--bg-canvas,#f8fafc);
          border-bottom:2px solid var(--category-color); }
        .category-info { display:flex; align-items:center; gap:.75rem; }
        .category-icon  { font-size:1.5rem; }
        .category-title { font-size:1.125rem; font-weight:600; color:var(--text-primary); margin:0; }
        .category-count { margin-left:auto; background:var(--category-color); color:#fff;
          padding:.25rem .75rem; border-radius:9999px; font-size:.875rem; font-weight:600; }

        .reward-list { padding:1rem; display:flex; flex-direction:column; gap:.75rem; }
        .reward-item { display:flex; justify-content:space-between; align-items:center; padding:1rem;
          background:var(--bg-canvas,#f8fafc); border:1px solid var(--border-color,#e2e8f0);
          border-radius:.75rem; transition:all .2s; }
        .reward-item:hover { background:var(--bg-secondary,#f1f5f9); transform:translateX(4px); }
        .reward-info  { display:flex; flex-direction:column; gap:.25rem; }
        .reward-slab  { font-weight:600; font-size:1rem; color:var(--text-primary); }
        .reward-date  { font-size:.8125rem; color:var(--text-secondary); }
        .undo-button  { display:flex; align-items:center; gap:.5rem; padding:.5rem 1rem;
          background:#ef4444; color:#fff; border:none; border-radius:.5rem;
          font-weight:600; font-size:.875rem; cursor:pointer; transition:all .2s; font-family:inherit; }
        .undo-button:hover { background:#dc2626; transform:translateY(-2px); box-shadow:0 4px 12px rgba(239,68,68,.3); }

        .no-rewards { padding:3rem 2rem; text-align:center; color:var(--text-secondary); }
        .no-rewards-icon { font-size:3rem; display:block; margin-bottom:1rem; }
        .no-rewards p { margin:0; }

        .empty-state { text-align:center; padding:4rem 2rem; }
        .empty-state-icon { font-size:4rem; margin-bottom:1rem; }
        .empty-state-text { font-size:1rem; color:var(--text-secondary); margin:0; }

        @media (max-width:768px) {
          .undo-panel { max-width:100%; }
          .panel-header { flex-direction:column; align-items:flex-start; }
          .selection-card { padding:1.5rem; }
          .reward-item { flex-direction:column; align-items:flex-start; gap:1rem; }
          .undo-button { width:100%; justify-content:center; }
        }
      `}</style>
    </>
  );
};

export default AdminRewardUndoPanel;