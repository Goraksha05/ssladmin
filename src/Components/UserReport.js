/**
 * Components/UserReport.js
 *
 * CHANGES FROM PREVIOUS VERSION:
 *
 *   1. NEW — Ban / Unban button column added to the table.
 *      Only rendered when the current admin has the `ban_users` permission
 *      (checked via usePermissions from PermissionsContext). Super admins
 *      automatically pass the check via the wildcard '*' permission.
 *      Regular admins without `ban_users` in their role see no button at all
 *      — the Actions column is hidden entirely for them.
 *
 *   2. NEW — handleBan(userId, isBanned) — calls:
 *        POST /api/admin/ban-user/:id    { reason }   → ban
 *        POST /api/admin/unban-user/:id               → unban
 *      On success the row's `banned` flag is toggled in local state
 *      (no full reload needed). A confirmation dialog is shown before
 *      banning; unban is immediate.
 *
 *   3. NEW — BanConfirmModal — inline modal that asks the admin to supply
 *      an optional reason before confirming a ban. Dismissible via Escape
 *      or the Cancel button.
 *
 *   4. NEW — Stats card added: "🚫 Banned Users" count derived from reportData.
 *
 *   5. NEW — Ban status filter dropdown ("All / Active / Banned") so admins
 *      can quickly list only banned users.
 *
 *   6. FIX — `banned` column in the table now shows a coloured pill
 *      ("Banned" in red / "Active" in green) instead of a plain dash.
 *      The header HEADERS entry is kept for CSV export compatibility.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { CSVLink } from 'react-csv';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'react-toastify';
import apiRequest from '../utils/apiRequest';
import { usePermissions } from '../Context/PermissionsContext';
import './UserReport.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const SORT_KEYS = [
  { value: 'lastActive',  label: 'Last Active' },
  { value: 'name',        label: 'Name'         },
  { value: 'subscription',label: 'Plan'         },
  { value: 'referralTokens', label: 'Referrals' },
];

const HEADERS = [
  { label: 'Name',           key: 'name'                 },
  { label: 'Email',          key: 'email'                },
  { label: 'Phone',          key: 'phone'                },
  { label: 'Username',       key: 'username'             },
  { label: 'Plan',           key: 'subscription'         },
  { label: 'Active',         key: 'subscriptionActive'   },
  { label: 'Start Date',     key: 'subscriptionStart'    },
  { label: 'Expiry',         key: 'subscriptionExpiry'   },
  { label: 'Last Active',    key: 'lastActive'           },
  { label: 'Ref Tokens',     key: 'referralTokens'       },
  { label: 'Post Slabs',     key: 'redeemedPostSlabs'    },
  { label: 'Ref Slabs',      key: 'redeemedReferralSlabs'},
  { label: 'Streak Slabs',   key: 'redeemedStreakSlabs'  },
  { label: 'Banned',         key: 'banned'               },
];

// ── Ban Confirm Modal ─────────────────────────────────────────────────────────

const BanConfirmModal = ({ user, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="ur-modal-overlay" onClick={onCancel}>
      <div className="ur-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ur-modal-header">
          <span className="ur-modal-icon">🚫</span>
          <div>
            <h3 className="ur-modal-title">Ban User</h3>
            <p className="ur-modal-sub">
              This will immediately block <strong>{user.name}</strong> ({user.email}) from
              accessing the platform.
            </p>
          </div>
        </div>

        {/* Reason input */}
        <div className="ur-modal-body">
          <label className="ur-modal-label" htmlFor="ban-reason">
            Reason <span className="ur-modal-optional">(optional — visible in audit log)</span>
          </label>
          <textarea
            id="ban-reason"
            className="ur-modal-textarea"
            placeholder="e.g. Repeated policy violations, fraud suspicion…"
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            maxLength={500}
            autoFocus
          />
          <div className="ur-modal-char">{reason.length}/500</div>
        </div>

        {/* Actions */}
        <div className="ur-modal-footer">
          <button className="ur-modal-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="ur-modal-confirm"
            onClick={() => onConfirm(reason.trim())}
          >
            Ban User
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const AdminUserReport = () => {
  // ── Permission gate ───────────────────────────────────────────────────────
  const { hasPermission, /*isSuperAdmin*/ } = usePermissions();
  const canBan = hasPermission('ban_users'); // super_admin passes via '*' wildcard

  // ── State ─────────────────────────────────────────────────────────────────
  const [reportData,    setReportData]    = useState([]);
  const [filteredData,  setFilteredData]  = useState([]);
  const [pagination,    setPagination]    = useState({ page: 1, pages: 1, total: 0 });
  const [loading,       setLoading]       = useState(true);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [downloadType,  setDownloadType]  = useState('csv');
  const [searchTerm,    setSearchTerm]    = useState('');
  const [filterPlan,    setFilterPlan]    = useState('all');
  const [filterBanned,  setFilterBanned]  = useState('all'); // 'all' | 'active' | 'banned'
  const [sortBy,        setSortBy]        = useState('lastActive');
  const [sortOrder,     setSortOrder]     = useState('desc');
  const [page,          setPage]          = useState(1);

  // Ban UI state
  const [banTarget,     setBanTarget]     = useState(null); // { userId, name, email } — modal open when set
  const [banningId,     setBanningId]     = useState(null); // userId being processed (spinner)

  // ── Data load ─────────────────────────────────────────────────────────────
  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams({
        page: p,
        limit: 50,
        ...(filterPlan !== 'all' && { plan: filterPlan }),
        ...(searchTerm && { search: searchTerm }),
      });

      const res = await apiRequest.get(`/api/admin/user-report?${params}`);

      const report = (res.data?.report || []).map(u => ({
        ...u,
        subscriptionActive: u.subscriptionActive === 'Yes',
        // Ensure banned is always a boolean — backend returns boolean or undefined
        banned: !!u.banned,
      }));

      setReportData(report);
      setPagination({ page: 1, pages: 1, total: report.length });
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || 'Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filterPlan, searchTerm]);

  useEffect(() => { setPage(1); load(1); }, [filterPlan]); // eslint-disable-line
  useEffect(() => { load(page); },          [page]);        // eslint-disable-line

  // ── Client-side filter + sort ─────────────────────────────────────────────
  useEffect(() => {
    let filtered = [...reportData];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.name?.toLowerCase().includes(q)     ||
        u.email?.toLowerCase().includes(q)    ||
        u.username?.toLowerCase().includes(q)
      );
    }

    if (filterBanned === 'banned')  filtered = filtered.filter(u => u.banned);
    if (filterBanned === 'active')  filtered = filtered.filter(u => !u.banned);

    filtered.sort((a, b) => {
      let aVal = a[sortBy], bVal = b[sortBy];
      if (['lastActive', 'subscriptionStart', 'subscriptionExpiry'].includes(sortBy)) {
        aVal = new Date(aVal || 0); bVal = new Date(bVal || 0);
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ?  1 : -1;
      return 0;
    });

    setFilteredData(filtered);
  }, [reportData, searchTerm, filterBanned, sortBy, sortOrder]);

  // ── Ban / Unban ───────────────────────────────────────────────────────────

  /** Called when admin clicks "Ban" → opens confirmation modal */
  const openBanModal = (user) => {
    setBanTarget({ userId: user._id || user.email, name: user.name, email: user.email });
  };

  /** Called from BanConfirmModal on confirm */
  const handleBan = async (reason) => {
    const { userId } = banTarget;
    setBanTarget(null);
    setBanningId(userId);
    try {
      await apiRequest.post(`/api/admin/ban-user/${userId}`, { reason });
      // Toggle banned flag in local state — no full reload
      setReportData(prev =>
        prev.map(u => (u._id === userId || u.email === userId)
          ? { ...u, banned: true }
          : u
        )
      );
      toast.success('User banned successfully.');
    } catch (err) {
      // apiRequest interceptor already toasted the error
    } finally {
      setBanningId(null);
    }
  };

  /** Unban — no confirmation dialog needed */
  const handleUnban = async (user) => {
    const userId = user._id || user.email;
    setBanningId(userId);
    try {
      await apiRequest.post(`/api/admin/unban-user/${userId}`);
      setReportData(prev =>
        prev.map(u => (u._id === userId || u.email === userId)
          ? { ...u, banned: false }
          : u
        )
      );
      toast.success('User unbanned successfully.');
    } catch (err) {
      // apiRequest interceptor already toasted the error
    } finally {
      setBanningId(null);
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!filteredData.length) { alert('No data to export.'); return; }
    if (downloadType === 'excel') {
      const ws = XLSX.utils.json_to_sheet(filteredData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'User Report');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'user-report.xlsx');
    } else if (downloadType === 'pdf') {
      const doc = new jsPDF('landscape');
      doc.setFontSize(16);
      doc.text('Users Report', 14, 15);
      const cols = HEADERS.slice(0, 10);
      doc.autoTable({
        head: [cols.map(h => h.label)],
        body: filteredData.map(row => cols.map(h => row[h.key]?.toString() || '—')),
        startY: 25,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [79, 70, 229] },
      });
      doc.save('user-report.pdf');
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const uniquePlans = [...new Set(reportData.map(u => u.subscription).filter(Boolean))];
  const stats = {
    total:    pagination.total || reportData.length,
    active:   reportData.filter(u =>  u.subscriptionActive).length,
    inactive: reportData.filter(u => !u.subscriptionActive).length,
    tokens:   reportData.reduce((s, u) => s + (parseInt(u.referralTokens) || 0), 0),
    banned:   reportData.filter(u =>  u.banned).length,
  };

  // ── Early returns ─────────────────────────────────────────────────────────
  if (loading && !reportData.length) return (
    <div className="ur-center">
      <div className="ur-spinner" />
      <p className="ur-muted">Loading report…</p>
    </div>
  );

  if (errorMsg) return (
    <div className="ur-center">
      <span style={{ fontSize: '3rem' }}>⚠️</span>
      <h3 className="ur-title">Error loading report</h3>
      <p className="ur-muted">{errorMsg}</p>
      <button
        onClick={() => load(1)}
        style={{ padding: '.5rem 1.5rem', borderRadius: '8px', background: 'var(--accent,#4f46e5)', color: '#fff', border: 'none', cursor: 'pointer', marginTop: '.5rem' }}
      >
        Retry
      </button>
    </div>
  );

  if (!loading && !reportData.length) return (
    <div className="ur-center">
      <span style={{ fontSize: '3rem' }}>👥</span>
      <h3 className="ur-title">No users found</h3>
      <p className="ur-muted">User data will appear here once accounts are created.</p>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Ban confirm modal */}
      {banTarget && (
        <BanConfirmModal
          user={banTarget}
          onConfirm={handleBan}
          onCancel={() => setBanTarget(null)}
        />
      )}

      <section className="ur-root">
        {/* Header */}
        <div className="ur-header">
          <div>
            <h2 className="ur-page-title">Users Report</h2>
            <p className="ur-page-sub">Full subscription and reward activity by user</p>
          </div>
        </div>

        {/* Stats */}
        <div className="ur-stats">
          {[
            { icon: '👥', label: 'Total Users',      value: stats.total    },
            { icon: '✅', label: 'Active Plans',      value: stats.active   },
            { icon: '⏸️', label: 'Inactive',          value: stats.inactive },
            { icon: '🎁', label: 'Total Ref Tokens',  value: stats.tokens   },
            { icon: '🚫', label: 'Banned Users',      value: stats.banned,  danger: true },
          ].map(({ icon, label, value, danger }) => (
            <div key={label} className={`ur-stat-card ${danger && value > 0 ? 'ur-stat-danger' : ''}`}>
              <span className="ur-stat-icon">{icon}</span>
              <div className="ur-stat-body">
                <span className="ur-stat-value">{value.toLocaleString()}</span>
                <span className="ur-stat-label">{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="ur-controls">
          <div className="ur-controls-left">
            <div className="ur-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email or username…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="ur-search-input"
              />
              {searchTerm && <button className="ur-clear" onClick={() => setSearchTerm('')}>×</button>}
            </div>

            <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="ur-select">
              <option value="all">All Plans</option>
              {uniquePlans.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* Ban status filter */}
            <select value={filterBanned} onChange={e => setFilterBanned(e.target.value)} className="ur-select">
              <option value="all">All Users</option>
              <option value="active">Active Only</option>
              <option value="banned">Banned Only</option>
            </select>

            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="ur-select">
              {SORT_KEYS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <button className="ur-sort-btn" onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}>
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          <div className="ur-controls-right">
            <select value={downloadType} onChange={e => setDownloadType(e.target.value)} className="ur-select">
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
            {downloadType === 'csv' ? (
              <CSVLink data={filteredData} headers={HEADERS} filename="user-report.csv" className="ur-dl-btn">
                ⬇ Download
              </CSVLink>
            ) : (
              <button className="ur-dl-btn" onClick={handleDownload}>⬇ Download</button>
            )}
          </div>
        </div>

        <p className="ur-result-info">
          Showing {filteredData.length.toLocaleString()} of {stats.total.toLocaleString()} users
          {pagination.pages > 1 && ` — page ${page} of ${pagination.pages}`}
          {!canBan && (
            <span className="ur-no-ban-notice"> · Ban controls require the <code>ban_users</code> permission</span>
          )}
        </p>

        {/* Table */}
        <div className="ur-table-wrap">
          <table className="ur-table">
            <thead>
              <tr>
                {HEADERS.map(h => (
                  <th
                    key={h.key}
                    onClick={() => {
                      setSortBy(h.key);
                      setSortOrder(p => sortBy === h.key ? (p === 'asc' ? 'desc' : 'asc') : 'desc');
                    }}
                    className="ur-th-sortable"
                  >
                    {h.label}
                    {sortBy === h.key && (
                      <span className="ur-sort-indicator">{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </th>
                ))}
                {/* Actions column — only rendered when the admin has ban_users permission */}
                {canBan && <th className="ur-th-actions">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => {
                const rowId = row._id || row.email;
                const isProcessing = banningId === rowId;
                return (
                  <tr
                    key={idx}
                    className={`ur-row ${row.banned ? 'ur-row-banned' : ''}`}
                  >
                    {HEADERS.map(h => (
                      <td key={h.key}>
                        {h.key === 'subscriptionActive' ? (
                          <span className={`ur-status ${row[h.key] ? 'ur-active' : 'ur-inactive'}`}>
                            {row[h.key] ? 'Active' : 'Inactive'}
                          </span>
                        ) : h.key === 'banned' ? (
                          <span className={`ur-status ${row[h.key] ? 'ur-banned' : 'ur-active'}`}>
                            {row[h.key] ? '🚫 Banned' : '✓ Active'}
                          </span>
                        ) : typeof row[h.key] === 'boolean'
                          ? (row[h.key] ? 'Yes' : 'No')
                          : (row[h.key]?.toString() || '—')}
                      </td>
                    ))}

                    {/* Ban / Unban button — only when canBan */}
                    {canBan && (
                      <td className="ur-td-actions">
                        {isProcessing ? (
                          <span className="ur-ban-spinner" />
                        ) : row.banned ? (
                          <button
                            className="ur-unban-btn"
                            onClick={() => handleUnban(row)}
                            title={`Unban ${row.name}`}
                          >
                            ✓ Unban
                          </button>
                        ) : (
                          <button
                            className="ur-ban-btn"
                            onClick={() => openBanModal(row)}
                            title={`Ban ${row.name}`}
                          >
                            🚫 Ban
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="ur-pagination">
            <button className="ur-pg-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            <span className="ur-pg-info">Page {page} of {pagination.pages}</span>
            <button className="ur-pg-btn" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
          </div>
        )}
      </section>

      <style>{`
        /* ── Ban modal ── */
        .ur-modal-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
          animation: urFadeIn .15s ease;
        }
        @keyframes urFadeIn { from{opacity:0} to{opacity:1} }

        .ur-modal {
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 1rem;
          box-shadow: 0 24px 64px rgba(0,0,0,.18);
          width: 100%; max-width: 460px;
          animation: urSlideUp .2s ease;
        }
        @keyframes urSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

        .ur-modal-header {
          display: flex; gap: 1rem; align-items: flex-start;
          padding: 1.5rem 1.5rem 1rem;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
        }
        .ur-modal-icon { font-size: 2rem; line-height: 1; flex-shrink: 0; }
        .ur-modal-title {
          margin: 0 0 .25rem;
          font-size: 1.125rem; font-weight: 700;
          color: var(--text-primary, #0f172a);
        }
        .ur-modal-sub {
          margin: 0; font-size: .875rem;
          color: var(--text-secondary, #64748b);
          line-height: 1.5;
        }

        .ur-modal-body { padding: 1.25rem 1.5rem; }
        .ur-modal-label {
          display: block; margin-bottom: .5rem;
          font-size: .8125rem; font-weight: 600;
          color: var(--text-primary, #0f172a);
        }
        .ur-modal-optional { font-weight: 400; color: var(--text-secondary, #64748b); }
        .ur-modal-textarea {
          width: 100%; box-sizing: border-box;
          padding: .625rem .875rem;
          background: var(--bg-secondary, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: .5rem;
          font-size: .875rem; color: var(--text-primary, #0f172a);
          resize: vertical; font-family: inherit;
          transition: border-color .2s;
        }
        .ur-modal-textarea:focus { outline: none; border-color: #ef4444; }
        .ur-modal-char { font-size: .75rem; color: var(--text-secondary,#64748b); text-align: right; margin-top: .25rem; }

        .ur-modal-footer {
          display: flex; justify-content: flex-end; gap: .75rem;
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-color, #e2e8f0);
        }
        .ur-modal-cancel {
          padding: .5rem 1.25rem;
          background: var(--bg-secondary, #f1f5f9);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: .5rem; font-size: .875rem; font-weight: 500;
          color: var(--text-primary, #0f172a); cursor: pointer;
          transition: all .15s;
        }
        .ur-modal-cancel:hover { background: var(--bg-tertiary, #e2e8f0); }
        .ur-modal-confirm {
          padding: .5rem 1.25rem;
          background: #ef4444; border: none;
          border-radius: .5rem; font-size: .875rem; font-weight: 600;
          color: #fff; cursor: pointer; transition: background .15s;
        }
        .ur-modal-confirm:hover { background: #dc2626; }

        /* ── Banned row tint ── */
        .ur-row-banned td { background: rgba(239,68,68,.04); }

        /* ── Status pills (extend existing ur-status) ── */
        .ur-banned {
          background: rgba(239,68,68,.12);
          color: #dc2626;
          border: 1px solid rgba(239,68,68,.25);
          padding: .25rem .625rem; border-radius: .375rem;
          font-size: .75rem; font-weight: 700;
        }

        /* ── Stats danger card ── */
        .ur-stat-danger { border-color: rgba(239,68,68,.3) !important; }
        .ur-stat-danger .ur-stat-value { color: #dc2626; }

        /* ── Actions column ── */
        .ur-th-actions { text-align: center; white-space: nowrap; }
        .ur-td-actions { text-align: center; }

        .ur-ban-btn {
          padding: .35rem .875rem;
          background: rgba(239,68,68,.1);
          border: 1px solid rgba(239,68,68,.3);
          border-radius: .375rem;
          color: #dc2626; font-size: .8rem; font-weight: 600;
          cursor: pointer; transition: all .15s; white-space: nowrap;
        }
        .ur-ban-btn:hover {
          background: #ef4444; color: #fff;
          border-color: #ef4444;
        }

        .ur-unban-btn {
          padding: .35rem .875rem;
          background: rgba(16,185,129,.1);
          border: 1px solid rgba(16,185,129,.3);
          border-radius: .375rem;
          color: #059669; font-size: .8rem; font-weight: 600;
          cursor: pointer; transition: all .15s; white-space: nowrap;
        }
        .ur-unban-btn:hover {
          background: #10b981; color: #fff;
          border-color: #10b981;
        }

        .ur-ban-spinner {
          display: inline-block; width: 18px; height: 18px;
          border: 2px solid var(--border-color, #e2e8f0);
          border-top-color: var(--accent, #4f46e5);
          border-radius: 50%;
          animation: urSpin .7s linear infinite;
        }
        @keyframes urSpin { to { transform: rotate(360deg); } }

        /* ── Permission notice ── */
        .ur-no-ban-notice {
          color: var(--text-secondary, #64748b);
          font-style: italic;
        }
        .ur-no-ban-notice code {
          background: var(--bg-secondary, #f1f5f9);
          padding: .1rem .3rem; border-radius: .25rem;
          font-size: .8em;
        }
      `}</style>
    </>
  );
};

export default AdminUserReport;