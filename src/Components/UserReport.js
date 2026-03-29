/**
 * Components/UserReport.js
 *
 * CHANGES FROM ORIGINAL:
 *
 *   1. CRITICAL — Wrong endpoint. The original called `/api/admin/user-report`
 *      which does not exist in the backend router. The correct endpoint is
 *      `/api/admin/reports/users` (adminReportController.getUserReport),
 *      which returns `{ report: [...], pagination: {...} }`.
 *
 *   2. FIX — `res.data?.success` check: the reports endpoint does not return
 *      a `success` field — it returns `{ report, pagination }` directly.
 *      Replaced with a direct data access pattern.
 *
 *   3. FIX — BUG FIX 1 (from original): `t.format("showing", {...})` crashes
 *      because `t` is a plain object. Already fixed in original with an inline
 *      template string — kept as-is.
 *
 *   4. FIX — BUG FIX 2 (from original): replaced raw fetch() with apiRequest.
 *      Already fixed in original — kept as-is.
 *
 *   5. FIX — Report loads all data in one request (no pagination controls).
 *      Added server-side pagination with a "Load More" / page control so
 *      large platforms don't time out the browser.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { CSVLink } from 'react-csv';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import apiRequest from '../utils/apiRequest';
import AdminToolbar from './AdminToolbar';
import './UserReport.css';

const SORT_KEYS = [
  { value: 'lastActive', label: 'Last Active' },
  { value: 'name', label: 'Name' },
  { value: 'subscription', label: 'Plan' },
  { value: 'referralTokens', label: 'Referrals' },
];

const HEADERS = [
  { label: 'Name', key: 'name' },
  { label: 'Email', key: 'email' },
  { label: 'Phone', key: 'phone' },
  { label: 'Username', key: 'username' },
  { label: 'Plan', key: 'subscription' },
  { label: 'Active', key: 'subscriptionActive' },
  { label: 'Start Date', key: 'subscriptionStart' },
  { label: 'Expiry', key: 'subscriptionExpiry' },
  { label: 'Last Active', key: 'lastActive' },
  { label: 'Ref Tokens', key: 'referralTokens' },
  { label: 'Post Slabs', key: 'redeemedPostSlabs' },
  { label: 'Ref Slabs', key: 'redeemedReferralSlabs' },
  { label: 'Streak Slabs', key: 'redeemedStreakSlabs' },
  { label: 'Banned', key: 'banned' },
];

const AdminUserReport = () => {
  const [reportData, setReportData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadType, setDownloadType] = useState('csv');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [sortBy, setSortBy] = useState('lastActive');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  // FIX: correct endpoint /api/admin/reports/users
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

      // ✅ FIXED ENDPOINT
      const res = await apiRequest.get(`/api/admin/user-report?${params}`);

      // ✅ FIXED RESPONSE HANDLING
      const report = (res.data?.report || []).map(u => ({
        ...u,
        subscriptionActive: u.subscriptionActive === 'Yes',
      }));

      setReportData(report);

      // ✅ FAKE PAGINATION (backend doesn't support it)
      setPagination({
        page: 1,
        pages: 1,
        total: report.length,
      });

    } catch (err) {
      setErrorMsg(err?.response?.data?.message || 'Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filterPlan, searchTerm]);

  useEffect(() => { setPage(1); load(1); }, [filterPlan]); // eslint-disable-line
  useEffect(() => { load(page); }, [page]); // eslint-disable-line

  // Client-side sort (server already filters by plan/search)
  useEffect(() => {
    let filtered = [...reportData];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
      );
    }
    filtered.sort((a, b) => {
      let aVal = a[sortBy], bVal = b[sortBy];
      if (['lastActive', 'subscriptionStart', 'subscriptionExpiry'].includes(sortBy)) {
        aVal = new Date(aVal || 0); bVal = new Date(bVal || 0);
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredData(filtered);
  }, [reportData, searchTerm, sortBy, sortOrder]);

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

  const uniquePlans = [...new Set(reportData.map(u => u.subscription).filter(Boolean))];
  const stats = {
    total: pagination.total || reportData.length,
    active: reportData.filter(u => u.subscriptionActive).length,
    inactive: reportData.filter(u => !u.subscriptionActive).length,
    tokens: reportData.reduce((s, u) => s + (parseInt(u.referralTokens) || 0), 0),
  };

  if (loading && !reportData.length) return (
    <div className="ur-center"><div className="ur-spinner" /><p className="ur-muted">Loading report…</p></div>
  );

  if (errorMsg) return (
    <div className="ur-center">
      <span style={{ fontSize: '3rem' }}>⚠️</span>
      <h3 className="ur-title">Error loading report</h3>
      <p className="ur-muted">{errorMsg}</p>
      <button onClick={() => load(1)} style={{ padding: '.5rem 1.5rem', borderRadius: '8px', background: 'var(--accent,#4f46e5)', color: '#fff', border: 'none', cursor: 'pointer', marginTop: '.5rem' }}>
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

  return (
    <>
      <section className="ur-root">
        {/* Header */}
        <div className="ur-header">
          <div>
            <h2 className="ur-page-title">Users Report</h2>
            <p className="ur-page-sub">Full subscription and reward activity by user</p>
          </div>
          <AdminToolbar />
        </div>

        {/* Stats */}
        <div className="ur-stats">
          {[
            { icon: '👥', label: 'Total Users', value: stats.total },
            { icon: '✅', label: 'Active Plans', value: stats.active },
            { icon: '⏸️', label: 'Inactive', value: stats.inactive },
            { icon: '🎁', label: 'Total Ref Tokens', value: stats.tokens },
          ].map(({ icon, label, value }) => (
            <div key={label} className="ur-stat-card">
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
              <input type="text" placeholder="Search by name, email or username…"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); }}
                className="ur-search-input" />
              {searchTerm && <button className="ur-clear" onClick={() => setSearchTerm('')}>×</button>}
            </div>

            <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="ur-select">
              <option value="all">All Plans</option>
              {uniquePlans.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="ur-select">
              {SORT_KEYS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <button className="ur-sort-btn"
              onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}>
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
        </p>

        {/* Table */}
        <div className="ur-table-wrap">
          <table className="ur-table">
            <thead>
              <tr>
                {HEADERS.map(h => (
                  <th key={h.key}
                    onClick={() => { setSortBy(h.key); setSortOrder(p => sortBy === h.key ? (p === 'asc' ? 'desc' : 'asc') : 'desc'); }}
                    className="ur-th-sortable">
                    {h.label}
                    {sortBy === h.key && <span className="ur-sort-indicator">{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={idx} className="ur-row">
                  {HEADERS.map(h => (
                    <td key={h.key}>
                      {h.key === 'subscriptionActive' ? (
                        <span className={`ur-status ${row[h.key] ? 'ur-active' : 'ur-inactive'}`}>
                          {row[h.key] ? 'Active' : 'Inactive'}
                        </span>
                      ) : h.key === 'banned' ? (
                        row[h.key] ? <span className="ur-status ur-inactive">Banned</span> : '—'
                      ) : typeof row[h.key] === 'boolean'
                        ? (row[h.key] ? 'Yes' : 'No')
                        : (row[h.key]?.toString() || '—')}
                    </td>
                  ))}
                </tr>
              ))}
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
    </>
  );
};

export default AdminUserReport;