/**
 * Components/Admin/AdminActivityReport.js
 *
 * Deep per-user activity report for admins.
 * Displays post counts, referral counts, streak days, claimed slabs,
 * in-progress slabs, wallet totals, payout status, and KYC info.
 *
 * Features:
 *   - Server-side paginated table with search, plan, KYC, sub-active filters
 *   - Per-user detail drawer (slide-in panel) with full breakdown
 *   - Progress bars for in-progress slabs
 *   - Export: CSV / Excel / PDF (client-side via xlsx + jspdf)
 *   - Permission-gated: requires 'view_reports'
 */

import React, {
  useState, useCallback, useMemo,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import apiRequest from '../../utils/apiRequest';
import { usePermissions } from '../../Context/PermissionsContext';
import WalletReport from './WalletReport';
import { exportCSV, exportExcel, exportPDF } from '../../utils/adminExport';
import {
  PageHeader, Card, Btn, Badge, SearchBar,
  Select, Pagination, AdminUIStyles,
} from './AdminUI';
import './AdminActivityReport.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAN_OPTIONS = [
  { value: '', label: 'All Plans' },
  { value: '2500', label: 'Basic ₹2500' },
  { value: '3500', label: 'Silver ₹3500' },
  { value: '4500', label: 'Gold ₹4500' },
];

const KYC_OPTIONS = [
  { value: '', label: 'All KYC' },
  { value: 'verified', label: 'Verified' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'required', label: 'Required' },
];

const SUB_OPTIONS = [
  { value: '', label: 'All Users' },
  { value: 'true', label: 'Active Sub' },
  { value: 'false', label: 'No Sub' },
];

// const FROZEN_OPTIONS = [
//   { value: '',      label: 'Any Freeze Status' },
//   { value: 'true',  label: 'Rewards Frozen'    },
//   { value: 'false', label: 'Rewards Active'    },
// ];

const TYPE_COLORS = {
  post: { bg: 'rgba(79,70,229,.12)', color: '#4f46e5', border: 'rgba(79,70,229,.25)' },
  referral: { bg: 'rgba(16,185,129,.12)', color: '#059669', border: 'rgba(16,185,129,.25)' },
  streak: { bg: 'rgba(245,158,11,.12)', color: '#d97706', border: 'rgba(245,158,11,.25)' },
};

const KYC_BADGE = {
  verified: 'green',
  submitted: 'yellow',
  rejected: 'red',
  not_started: 'default',
  required: 'yellow',
};

const RISK_BADGE = {
  clean: 'green',
  watchlist: 'yellow',
  kyc_gate: 'yellow',
  auto_flag: 'red',
};

const fmt = n => (n ?? 0).toLocaleString('en-IN');
const fmtINR = n => `₹${fmt(n)}`;
const fmtDate = s => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchReport(params) {
  const q = new URLSearchParams(Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  ));
  const res = await apiRequest.get(`/api/admin/reports/activity?${q}`);
  return res.data;
}

async function fetchUserDetail(userId) {
  const res = await apiRequest.get(`/api/admin/reports/activity/${userId}`);
  return res.data;
}

async function fetchExportData(params) {
  const q = new URLSearchParams(Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== 1 && v !== 25)
  ));
  const res = await apiRequest.get(`/api/admin/reports/activity/export?${q}`);
  return res.data;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ProgressBar = ({ value, max, color = '#4f46e5' }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
      <div style={{
        flex: 1, height: 6, background: 'var(--bg-canvas,#f1f5f9)',
        borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: color, transition: 'width .4s ease',
        }} />
      </div>
      <span style={{ fontSize: '.7rem', color: 'var(--text-secondary)', minWidth: 32, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
};

const SlabBadge = ({ type, milestone, estimatedINR }) => {
  const meta = TYPE_COLORS[type] || TYPE_COLORS.post;
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      padding: '.25rem .5rem', borderRadius: 6, fontSize: '.7rem',
      background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color,
      fontWeight: 700, gap: 1, minWidth: 48,
    }}>
      <span>{milestone}</span>
      {estimatedINR > 0 && <span style={{ opacity: .8, fontWeight: 500 }}>₹{fmt(estimatedINR)}</span>}
    </div>
  );
};

// ── Detail Drawer ─────────────────────────────────────────────────────────────

const DetailDrawer = ({ userId, onClose }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['activityDetail', userId],
    queryFn: () => fetchUserDetail(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const d = data;
  const u = d?.user;
  const s = d?.stats;

  return (
    <div className="ar-drawer-overlay" onClick={onClose}>
      <div className="ar-drawer" onClick={e => e.stopPropagation()}>
        <div className="ar-drawer-header">
          <div>
            <div className="ar-drawer-title">{isLoading ? 'Loading…' : u?.name}</div>
            <div className="ar-drawer-sub">{u?.email}</div>
          </div>
          <button className="ar-drawer-close" onClick={onClose}>✕</button>
        </div>

        {isLoading ? (
          <div className="ar-drawer-loading"><div className="ar-spinner" /></div>
        ) : !d ? (
          <div className="ar-drawer-loading">Failed to load</div>
        ) : (
          <div className="ar-drawer-body">

            {/* Identity */}
            <div className="ar-section-label">Identity</div>
            <div className="ar-info-grid">
              <div className="ar-info-row"><span>Username</span><span>@{u.username}</span></div>
              <div className="ar-info-row"><span>Phone</span><span>{u.phone || '—'}</span></div>
              <div className="ar-info-row"><span>Referral ID</span><span style={{ fontFamily: 'monospace' }}>{u.referralId}</span></div>
              <div className="ar-info-row"><span>Joined</span><span>{fmtDate(u.joinDate)}</span></div>
              <div className="ar-info-row"><span>Last Active</span><span>{fmtDate(u.lastActive)}</span></div>
              <div className="ar-info-row">
                <span>KYC</span>
                <Badge color={KYC_BADGE[u.kycStatus] || 'default'}>{u.kycStatus.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="ar-info-row">
                <span>Plan</span>
                <span>{u.subscription?.plan || 'None'}{u.subscription?.planAmount ? ` ₹${u.subscription.planAmount}` : ''}</span>
              </div>
              <div className="ar-info-row">
                <span>Subscription</span>
                <Badge color={u.subscription?.active ? 'green' : 'default'}>
                  {u.subscription?.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="ar-info-row">
                <span>Risk Tier</span>
                <Badge color={RISK_BADGE[u.riskTier] || 'default'}>{u.riskTier}</Badge>
              </div>
              {u.rewardsFrozen && (
                <div className="ar-info-row">
                  <span>Rewards</span>
                  <Badge color="red">🔒 Frozen</Badge>
                </div>
              )}
            </div>

            {/* Activity KPIs */}
            <div className="ar-section-label" style={{ marginTop: '1.25rem' }}>Activity</div>
            <div className="ar-kpi-row">
              <div className="ar-kpi">
                <div className="ar-kpi-val" style={{ color: '#4f46e5' }}>{fmt(s?.posts?.count)}</div>
                <div className="ar-kpi-label">Posts</div>
              </div>
              <div className="ar-kpi">
                <div className="ar-kpi-val" style={{ color: '#059669' }}>{fmt(s?.referrals?.active)}</div>
                <div className="ar-kpi-label">Active Referrals</div>
              </div>
              <div className="ar-kpi">
                <div className="ar-kpi-val" style={{ color: '#d97706' }}>{fmt(s?.streaks?.uniqueDays)}</div>
                <div className="ar-kpi-label">Streak Days</div>
              </div>
            </div>

            {/* In-Progress Slabs */}
            <div className="ar-section-label" style={{ marginTop: '1.25rem' }}>In Progress (Next Slab)</div>
            {['post', 'referral', 'streak'].map(type => {
              const ip = s?.inProgress?.[type];
              const cur = type === 'post' ? s?.posts?.count
                : type === 'referral' ? s?.referrals?.active
                  : s?.streaks?.uniqueDays;
              if (!ip) return (
                <div key={type} className="ar-ip-row">
                  <div className="ar-ip-type">{type}</div>
                  <span className="ar-ip-done">✓ All slabs claimed</span>
                </div>
              );
              return (
                <div key={type} className="ar-ip-row">
                  <div className="ar-ip-type">{type}</div>
                  <div className="ar-ip-content">
                    <div className="ar-ip-labels">
                      <span>{fmt(cur)} / {fmt(ip.milestone)}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '.75rem' }}>
                        Need {fmt(ip.needed)} more · {fmtINR(ip.estimatedINR)} reward
                      </span>
                    </div>
                    <ProgressBar
                      value={cur} max={ip.milestone}
                      color={TYPE_COLORS[type]?.color || '#4f46e5'}
                    />
                  </div>
                </div>
              );
            })}

            {/* Claimed Slabs */}
            {s?.claimedSlabs?.length > 0 && (
              <>
                <div className="ar-section-label" style={{ marginTop: '1.25rem' }}>
                  Claimed Slabs ({s.claimedSlabs.length})
                </div>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                  {s.claimedSlabs.map((c, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <SlabBadge type={c.type} milestone={c.milestone} estimatedINR={c.estimatedINR} />
                      <span style={{ fontSize: '.65rem', color: 'var(--text-secondary)' }}>{fmtDate(c.claimedAt)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Wallet */}
            <div className="ar-section-label" style={{ marginTop: '1.25rem' }}>Wallet</div>

            {/* ── Cash rewards ── */}
            <div style={{
              fontSize: '.7rem', fontWeight: 700, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '.06em', margin: '.5rem 0 .25rem',
            }}>
              Cash Rewards
            </div>
            <div className="ar-info-grid">
              <div className="ar-info-row">
                <span>🛒 Grocery Coupons</span>
                <span style={{ fontWeight: 700, color: '#7c3aed' }}>{fmtINR(s?.wallet?.groceryCoupons)}</span>
              </div>
            </div>

            {/* ── Non-cash assets ── */}
            <div style={{
              fontSize: '.7rem', fontWeight: 700, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '.06em', margin: '.75rem 0 .25rem',
            }}>
              Non-Cash Assets
            </div>
            <div className="ar-info-grid">
              <div className="ar-info-row">
                <span>📈 Shares</span>
                <span style={{ fontWeight: 700, color: '#0891b2' }}>{fmt(s?.wallet?.shares)} units</span>
              </div>
              <div className="ar-info-row">
                <span>🪙 Referral Tokens</span>
                <span style={{ fontWeight: 700, color: '#be185d' }}>{fmt(s?.wallet?.referralToken)}</span>
              </div>
            </div>

            {/* Payouts */}
            <div className="ar-section-label" style={{ marginTop: '1.25rem' }}>Payouts</div>
            <div className="ar-info-grid">
              <div className="ar-info-row"><span>Total Paid</span><span style={{ color: '#059669', fontWeight: 600 }}>{fmtINR(s?.payouts?.paid)}</span></div>
              <div className="ar-info-row"><span>Pending</span><span style={{ color: '#d97706', fontWeight: 600 }}>{fmtINR(s?.payouts?.pending)}</span></div>
              <div className="ar-info-row"><span>Payout Records</span><span>{fmt(s?.payouts?.count)}</span></div>
              <div className="ar-info-row"><span>Bank Details</span>
                <Badge color={u.hasBankDetails ? 'green' : 'red'}>{u.hasBankDetails ? '✓ Set' : '✗ Missing'}</Badge>
              </div>
            </div>

            {/* Redeemed slab keys */}
            {(u.redeemedPostSlabs?.length > 0 || u.redeemedReferralSlabs?.length > 0 || u.redeemedStreakSlabs?.length > 0) && (
              <>
                <div className="ar-section-label" style={{ marginTop: '1.25rem' }}>Redeemed Milestone Keys</div>
                <div className="ar-info-grid">
                  {u.redeemedPostSlabs?.length > 0 && (
                    <div className="ar-info-row">
                      <span>Posts</span>
                      <span style={{ fontSize: '.8rem', fontFamily: 'monospace' }}>{u.redeemedPostSlabs.join(', ')}</span>
                    </div>
                  )}
                  {u.redeemedReferralSlabs?.length > 0 && (
                    <div className="ar-info-row">
                      <span>Referrals</span>
                      <span style={{ fontSize: '.8rem', fontFamily: 'monospace' }}>{u.redeemedReferralSlabs.join(', ')}</span>
                    </div>
                  )}
                  {u.redeemedStreakSlabs?.length > 0 && (
                    <div className="ar-info-row">
                      <span>Streaks</span>
                      <span style={{ fontSize: '.8rem', fontFamily: 'monospace' }}>{u.redeemedStreakSlabs.join(', ')}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const AdminActivityReport = () => {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const [filters, setFiltersState] = useState({
    search: '', plan: '', kycStatus: '', subActive: '',
    from: '', to: '', page: 1, limit: 25,
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const setFilter = useCallback((key, val) => {
    setFiltersState(prev => ({ ...prev, [key]: val, page: 1 }));
  }, []);

  const setPage = useCallback(p => {
    setFiltersState(prev => ({ ...prev, page: p }));
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['activityReport', filters],
    queryFn: () => fetchReport(filters),
    keepPreviousData: true,
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    return data?.rows || [];
  }, [data?.rows]);

  const pagination = useMemo(() => {
    return data?.pagination || { page: 1, pages: 1, total: 0 };
  }, [data?.pagination]);

  // ── Summary stats from current page ───────────────────────────────────────
  const summary = useMemo(() => {
    if (!rows.length) return null;
    return {
      totalPosts:     rows.reduce((s, r) => s + (r.posts?.count           || 0), 0),
      totalReferrals: rows.reduce((s, r) => s + (r.referrals?.active      || 0), 0),
      totalStreaks:   rows.reduce((s, r) => s + (r.streaks?.uniqueDays     || 0), 0),
      // Cash reward — Grocery Coupons are the only ₹ value
      totalCoupons:   rows.reduce((s, r) => s + (r.wallet?.groceryCoupons || 0), 0),
      // Non-cash assets — counts, not ₹
      totalShares:    rows.reduce((s, r) => s + (r.wallet?.shares         || 0), 0),
      totalTokens:    rows.reduce((s, r) => s + (r.wallet?.referralToken  || 0), 0),
      totalClaimed:   rows.reduce((s, r) => s + (r.totalClaimedINR        || 0), 0),
    };
  }, [rows]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = useCallback(async (format) => {
    setExporting(true);
    try {
      const exportFilters = { ...filters };
      delete exportFilters.page;
      delete exportFilters.limit;
      const { rows: exportRows } = await fetchExportData(exportFilters);
      if (format === 'csv') exportCSV(exportRows);
      if (format === 'excel') exportExcel(exportRows);
      if (format === 'pdf') exportPDF(exportRows);
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [filters]);

  if (!hasPermission('view_reports')) {
    return (
      <div className="ar-access-denied">
        <span>🔒</span>
        <h3>Access Denied</h3>
        <p>You need the <code>view_reports</code> permission to access this report.</p>
      </div>
    );
  }

  return (
    <>
      <AdminUIStyles />
      <div className="ar-container pb-5">
        <WalletReport /> {/* Embedded Wallet Report component */} 
      </div>

      {/* ── Header ── */}
      <PageHeader
        title="User Activity Report"
        subtitle={`${fmt(pagination.total)} users · Page ${pagination.page} of ${pagination.pages}`}
        actions={
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <Btn
              size="sm" variant="secondary"
              onClick={() => handleExport('csv')}
              disabled={exporting}
            >
              {exporting ? '…' : '↓ CSV'}
            </Btn>
            <Btn
              size="sm" variant="secondary"
              onClick={() => handleExport('excel')}
              disabled={exporting}
            >
              {exporting ? '…' : '↓ Excel'}
            </Btn>
            <Btn
              size="sm" variant="secondary"
              onClick={() => handleExport('pdf')}
              disabled={exporting}
            >
              {exporting ? '…' : '↓ PDF'}
            </Btn>
            <Btn
              size="sm" variant="primary"
              onClick={() => queryClient.invalidateQueries(['activityReport'])}
            >
              ↻ Refresh
            </Btn>
          </div>
        }
      />

      {/* ── Summary KPIs (current page) ── */}
      {summary && (
        <div className="ar-kpi-strip">
          {[
            { icon: '📝', label: 'Posts (page)',       val: fmt(summary.totalPosts),                      color: '#4f46e5' },
            { icon: '👥', label: 'Active Refs (page)', val: fmt(summary.totalReferrals),                   color: '#059669' },
            { icon: '🔥', label: 'Streak Days (page)', val: fmt(summary.totalStreaks),                     color: '#d97706' },
            { icon: '🛒', label: 'Grocery Coupons',    val: fmtINR(summary.totalCoupons),                 color: '#7c3aed' },
            { icon: '📈', label: 'Total Shares',        val: `${fmt(summary.totalShares)} units`,          color: '#0891b2' },
            { icon: '🪙', label: 'Total Tokens',         val: fmt(summary.totalTokens),                    color: '#be185d' },
            { icon: '✅', label: 'Total Claimed',        val: fmtINR(summary.totalClaimed),                color: '#ec4899' },
          ].map(({ icon, label, val, color }) => (
            <div key={label} className="ar-kpi-chip" style={{ '--chip-color': color }}>
              <span className="ar-kpi-icon">{icon}</span>
              <div>
                <div className="ar-kpi-chip-val">{val}</div>
                <div className="ar-kpi-chip-label">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <Card style={{ marginBottom: '1rem' }}>
        <div className="ar-filter-bar">
          <SearchBar
            value={filters.search}
            onChange={v => setFilter('search', v)}
            placeholder="Search name, email, username, referral ID…"
          />
          <Select value={filters.plan} onChange={v => setFilter('plan', v)} options={PLAN_OPTIONS} placeholder="All Plans" />
          <Select value={filters.kycStatus} onChange={v => setFilter('kycStatus', v)} options={KYC_OPTIONS} placeholder="All KYC" />
          <Select value={filters.subActive} onChange={v => setFilter('subActive', v)} options={SUB_OPTIONS} placeholder="All Users" />
          <div className="ar-date-range">
            <label>From</label>
            <input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)} className="ar-date-input" />
            <label>To</label>
            <input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)} className="ar-date-input" />
          </div>
          <Btn size="sm" variant="secondary" onClick={() => setFiltersState({
            search: '', plan: '', kycStatus: '', subActive: '',
            from: '', to: '', page: 1, limit: 25,
          })}>Clear</Btn>
        </div>
      </Card>

      {/* ── Table ── */}
      <Card>
        {(isLoading || isFetching) && !rows.length ? (
          <div className="ar-center"><div className="ar-spinner" /><p>Loading report…</p></div>
        ) : rows.length === 0 ? (
          <div className="ar-center">
            <span style={{ fontSize: '3rem' }}>📊</span>
            <p style={{ color: 'var(--text-secondary)' }}>No users match the current filters.</p>
          </div>
        ) : (
          <div className="ar-table-wrap" style={{ opacity: isFetching ? .7 : 1, transition: 'opacity .2s' }}>
            <div className="ar-table-outer">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan / KYC</th>
                    <th>Posts</th>
                    <th>Referrals</th>
                    <th>Streaks</th>
                    <th>Claimed Slabs</th>
                    <th>In Progress</th>
                    <th>Grocery Coupons</th>
                    <th>Shares</th>
                    <th>Tokens</th>
                    <th>Payouts</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <React.Fragment key={row._id}>
                      <tr
                        className={`ar-row ${expandedRow === row._id ? 'ar-row-expanded' : ''}`}
                        onClick={() => setExpandedRow(p => p === row._id ? null : row._id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* User */}
                        <td>
                          <div className="ar-user-cell">
                            <div className="ar-avatar">{row.name?.[0]?.toUpperCase() || 'U'}</div>
                            <div>
                              <div className="ar-user-name">{row.name}</div>
                              <div className="ar-user-email">{row.email}</div>
                              <div className="ar-user-ref">#{row.referralId}</div>
                            </div>
                          </div>
                        </td>

                        {/* Plan / KYC */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
                            <Badge color={row.subActive ? 'blue' : 'default'}>
                              {row.plan}{row.planAmount ? ` ₹${row.planAmount}` : ''}
                            </Badge>
                            <Badge color={KYC_BADGE[row.kycStatus] || 'default'} style={{ fontSize: '.7rem' }}>
                              {row.kycStatus?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </td>

                        {/* Posts */}
                        <td>
                          <div style={{ textAlign: 'center' }}>
                            <div className="ar-count" style={{ color: '#4f46e5' }}>{fmt(row.posts?.count)}</div>
                            {row.redeemedPostSlabs?.length > 0 && (
                              <div className="ar-slab-count">
                                {row.redeemedPostSlabs.length} slabs
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Referrals */}
                        <td>
                          <div style={{ textAlign: 'center' }}>
                            <div className="ar-count" style={{ color: '#059669' }}>{fmt(row.referrals?.active)}</div>
                            <div className="ar-count-sub">/{fmt(row.referrals?.total)} total</div>
                            {row.redeemedReferralSlabs?.length > 0 && (
                              <div className="ar-slab-count">{row.redeemedReferralSlabs.length} slabs</div>
                            )}
                          </div>
                        </td>

                        {/* Streaks */}
                        <td>
                          <div style={{ textAlign: 'center' }}>
                            <div className="ar-count" style={{ color: '#d97706' }}>{fmt(row.streaks?.uniqueDays)}</div>
                            <div className="ar-count-sub">days</div>
                            {row.redeemedStreakSlabs?.length > 0 && (
                              <div className="ar-slab-count">{row.redeemedStreakSlabs.length} slabs</div>
                            )}
                          </div>
                        </td>

                        {/* Claimed Slabs — compact badges */}
                        <td>
                          <div style={{ display: 'flex', gap: '.25rem', flexWrap: 'wrap', maxWidth: 180 }}>
                            {row.claimedSlabs?.slice(0, 4).map((c, i) => (
                              <SlabBadge key={i} type={c.type} milestone={c.milestone} estimatedINR={c.estimatedINR} />
                            ))}
                            {(row.claimedSlabs?.length || 0) > 4 && (
                              <span style={{ fontSize: '.7rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
                                +{row.claimedSlabs.length - 4}
                              </span>
                            )}
                            {!row.claimedSlabs?.length && (
                              <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>None</span>
                            )}
                          </div>
                        </td>

                        {/* In Progress */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '.375rem', minWidth: 140 }}>
                            {['post', 'referral', 'streak'].map(type => {
                              const ip = row.inProgress?.[type];
                              if (!ip) return null;
                              return (
                                <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem' }}>
                                    <span style={{ color: TYPE_COLORS[type]?.color, fontWeight: 600, textTransform: 'capitalize' }}>{type}</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>{ip.progress}%</span>
                                  </div>
                                  <ProgressBar
                                    value={ip.milestone - ip.needed}
                                    max={ip.milestone}
                                    color={TYPE_COLORS[type]?.color}
                                  />
                                </div>
                              );
                            })}
                            {!row.inProgress?.post && !row.inProgress?.referral && !row.inProgress?.streak && (
                              <Badge color="green" style={{ fontSize: '.7rem' }}>All claimed</Badge>
                            )}
                          </div>
                        </td>

                        {/* Grocery Coupons — cash reward ₹ */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: '.875rem' }}>
                            {fmtINR(row.wallet?.groceryCoupons)}
                          </div>
                        </td>

                        {/* Shares — non-cash asset, count only */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color: '#0891b2', fontSize: '.875rem' }}>
                            {fmt(row.wallet?.shares)}
                          </div>
                          <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)' }}>units</div>
                        </td>

                        {/* Referral Tokens — non-cash asset, count only */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color: '#be185d', fontSize: '.875rem' }}>
                            {fmt(row.wallet?.referralToken)}
                          </div>
                          <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)' }}>tokens</div>
                        </td>

                        {/* Payouts */}
                        <td>
                          <div style={{ fontSize: '.8rem', lineHeight: 1.8 }}>
                            <span style={{ color: '#059669', fontWeight: 600 }}>{fmtINR(row.payouts?.paid)}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '.7rem' }}> paid</span><br />
                            <span style={{ color: '#d97706' }}>{fmtINR(row.payouts?.pending)}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '.7rem' }}> pending</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
                            {row.rewardsFrozen && <Badge color="red" style={{ fontSize: '.7rem' }}>🔒 Frozen</Badge>}
                            <Badge color={RISK_BADGE[row.riskTier] || 'default'} style={{ fontSize: '.7rem' }}>{row.riskTier}</Badge>
                            <Badge color={row.hasBankDetails ? 'green' : 'red'} style={{ fontSize: '.65rem' }}>
                              {row.hasBankDetails ? '✓ Bank' : '✗ Bank'}
                            </Badge>
                          </div>
                        </td>

                        {/* Actions */}
                        <td onClick={e => e.stopPropagation()}>
                          <Btn
                            size="sm" variant="ghost"
                            onClick={() => setSelectedUser(row._id)}
                          >
                            Detail
                          </Btn>
                        </td>
                      </tr>

                      {/* Inline expanded row */}
                      {expandedRow === row._id && (
                        <tr className="ar-expanded-row">
                          <td colSpan={13}>
                            <div className="ar-inline-detail">
                              <div className="ar-inline-col">
                                <div className="ar-inline-label">Posts Redeemed</div>
                                <div className="ar-inline-val">
                                  {row.redeemedPostSlabs?.length
                                    ? row.redeemedPostSlabs.map(s => (
                                      <SlabBadge key={s} type="post" milestone={s} estimatedINR={0} />
                                    ))
                                    : <span style={{ color: 'var(--text-secondary)', fontSize: '.8rem' }}>None</span>
                                  }
                                </div>
                              </div>
                              <div className="ar-inline-col">
                                <div className="ar-inline-label">Referrals Redeemed</div>
                                <div className="ar-inline-val">
                                  {row.redeemedReferralSlabs?.length
                                    ? row.redeemedReferralSlabs.map(s => (
                                      <SlabBadge key={s} type="referral" milestone={s} estimatedINR={0} />
                                    ))
                                    : <span style={{ color: 'var(--text-secondary)', fontSize: '.8rem' }}>None</span>
                                  }
                                </div>
                              </div>
                              <div className="ar-inline-col">
                                <div className="ar-inline-label">Streaks Redeemed</div>
                                <div className="ar-inline-val">
                                  {row.redeemedStreakSlabs?.length
                                    ? row.redeemedStreakSlabs.map(s => (
                                      <SlabBadge key={s} type="streak" milestone={s} estimatedINR={0} />
                                    ))
                                    : <span style={{ color: 'var(--text-secondary)', fontSize: '.8rem' }}>None</span>
                                  }
                                </div>
                              </div>
                              <div className="ar-inline-col">
                                <div className="ar-inline-label">Total Claimed Value</div>
                                <div className="ar-inline-val" style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--accent, #4f46e5)' }}>
                                  {fmtINR(row.totalClaimedINR)}
                                </div>
                              </div>
                              <div className="ar-inline-col">
                                <div className="ar-inline-label">Joined / Last Active</div>
                                <div className="ar-inline-val" style={{ fontSize: '.8rem' }}>
                                  <div>{fmtDate(row.joinDate)}</div>
                                  <div style={{ color: 'var(--text-secondary)' }}>{fmtDate(row.lastActive)}</div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Pagination page={filters.page} pages={pagination.pages} onPage={setPage} />
      </Card>

      {/* ── Detail Drawer ── */}
      {selectedUser && (
        <DetailDrawer userId={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </>
  );
};

export default AdminActivityReport;