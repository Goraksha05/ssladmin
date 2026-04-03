// Components/Admin/AdminReports.js — Reports with CSV / Excel / PDF export
import React, { useState, useCallback } from 'react';
import apiRequest from '../../utils/apiRequest';
import { toast } from 'react-toastify';
import { exportCSV, exportExcel, exportPDF } from '../../utils/adminExport';
import {
  PageHeader, Card, Btn, Select, SearchBar,
  Table, Pagination, DateRangeFilter,
} from './AdminUI';

const REPORT_TYPES = [
  { value: 'users',     label: '👤 User Report' },
  { value: 'financial', label: '💳 Financial Report' },
  { value: 'rewards',   label: '◇ Rewards Report' },
];

const PLAN_OPTIONS = [
  { value: '',         label: 'All Plans' },
  { value: 'Basic',    label: 'Basic' },
  { value: 'Silver',   label: 'Silver' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Gold',     label: 'Gold' },
  { value: 'Premium',  label: 'Premium' },
];

// ── User Report ─────────────────────────────────────────────────────────────
const UserReportTab = () => {
  const [rows,       setRows]       = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [plan,       setPlan]       = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [page,       setPage]       = useState(1);
  const [fetched,    setFetched]    = useState(false);

  const cols = [
    { key: 'name',                label: 'Name' },
    { key: 'email',               label: 'Email' },
    { key: 'phone',               label: 'Phone' },
    { key: 'username',            label: 'Username' },
    { key: 'subscription',        label: 'Plan' },
    { key: 'subscriptionActive',  label: 'Active' },
    { key: 'subscriptionStart',   label: 'Start' },
    { key: 'subscriptionExpiry',  label: 'Expiry' },
    { key: 'lastActive',          label: 'Last Active' },
    { key: 'referralTokens',      label: 'Referrals' },
    { key: 'redeemedPostSlabs',   label: 'Post Slabs' },
    { key: 'redeemedReferralSlabs', label: 'Ref Slabs' },
    { key: 'redeemedStreakSlabs', label: 'Streak Slabs' },
    { key: 'banned',              label: 'Banned' },
  ];

  const fetch = useCallback(async (p = 1) => {
    setLoading(true);
    setFetched(true);
    try {
      const params = new URLSearchParams({
        page: p, limit: 25,
        ...(search   && { search }),
        ...(plan     && { plan }),
        ...(dateFrom && { from: dateFrom }),
        ...(dateTo   && { to: dateTo }),
      });
      const res = await apiRequest.get(`/api/admin/reports/users?${params}`);
      setRows(res.data.report);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load user report'); }
    finally   { setLoading(false); }
  }, [search, plan, dateFrom, dateTo]);

  return (
    <div>
      <div className="rp-filter-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Name, email, username…" />
        <Select value={plan} onChange={setPlan} options={PLAN_OPTIONS} placeholder="All Plans" />
        <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
        <Btn size="sm" onClick={() => { setPage(1); fetch(1); }}>Generate</Btn>
        <Btn size="sm" variant="secondary" onClick={() => { setSearch(''); setPlan(''); setDateFrom(''); setDateTo(''); }}>Clear</Btn>
      </div>

      {fetched && rows.length > 0 && (
        <div className="rp-export-bar">
          <span className="rp-count">{pagination.total?.toLocaleString()} users</span>
          <Btn size="sm" variant="secondary" onClick={() => exportCSV(rows,   'users_report')}>↓ CSV</Btn>
          <Btn size="sm" variant="secondary" onClick={() => exportExcel(rows, 'users_report')}>↓ Excel</Btn>
          <Btn size="sm" variant="secondary" onClick={() => exportPDF(rows,   'Users Report', cols)}>↓ PDF</Btn>
        </div>
      )}

      {fetched && (
        <>
          <Table columns={cols} rows={rows} loading={loading} empty="No users found" />
          <Pagination page={page} pages={pagination.pages} onPage={p => { setPage(p); fetch(p); }} />
        </>
      )}

      {!fetched && (
        <div className="rp-prompt">
          <div className="rp-prompt-icon">▤</div>
          <div className="rp-prompt-text">Configure filters and click <strong>Generate</strong> to run the report</div>
        </div>
      )}
    </div>
  );
};

// ── Financial Report ────────────────────────────────────────────────────────
const FinancialReportTab = () => {
  const [rows,       setRows]       = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading,    setLoading]    = useState(false);
  const [plan,       setPlan]       = useState('');
  const [hasBankDetails, setHasBank] = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [page,       setPage]       = useState(1);
  const [fetched,    setFetched]    = useState(false);

  const cols = [
    { key: 'name',          label: 'Name' },
    { key: 'email',         label: 'Email' },
    { key: 'phone',         label: 'Phone' },
    { key: 'plan',          label: 'Plan' },
    { key: 'active',        label: 'Active' },
    { key: 'paymentId',     label: 'Payment ID' },
    { key: 'orderId',       label: 'Order ID' },
    { key: 'startDate',     label: 'Start Date' },
    { key: 'expiresAt',     label: 'Expires' },
    { key: 'accountNumber', label: 'Account No.' },
    { key: 'ifscCode',      label: 'IFSC' },
    { key: 'panNumber',     label: 'PAN' },
  ];

  const fetch = useCallback(async (p = 1) => {
    setLoading(true);
    setFetched(true);
    try {
      const params = new URLSearchParams({
        page: p, limit: 25,
        ...(plan          && { plan }),
        ...(hasBankDetails && { hasBankDetails }),
        ...(dateFrom      && { from: dateFrom }),
        ...(dateTo        && { to: dateTo }),
      });
      const res = await apiRequest.get(`/api/admin/reports/financial?${params}`);
      setRows(res.data.report);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load financial report'); }
    finally   { setLoading(false); }
  }, [plan, hasBankDetails, dateFrom, dateTo]);

  return (
    <div>
      <div className="rp-filter-row">
        <Select value={plan}          onChange={setPlan}     options={PLAN_OPTIONS} placeholder="All Plans" />
        <Select value={hasBankDetails} onChange={setHasBank} options={[{ value: 'true', label: 'Has Bank Details' }]} placeholder="Any" />
        <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
        <Btn size="sm" onClick={() => { setPage(1); fetch(1); }}>Generate</Btn>
        <Btn size="sm" variant="secondary" onClick={() => { setPlan(''); setHasBank(''); setDateFrom(''); setDateTo(''); }}>Clear</Btn>
      </div>

      {fetched && rows.length > 0 && (
        <div className="rp-export-bar">
          <span className="rp-count">{pagination.total?.toLocaleString()} records</span>
          <Btn size="sm" variant="secondary" onClick={() => exportCSV(rows,   'financial_report')}>↓ CSV</Btn>
          <Btn size="sm" variant="secondary" onClick={() => exportExcel(rows, 'financial_report')}>↓ Excel</Btn>
          <Btn size="sm" variant="secondary" onClick={() => exportPDF(rows,   'Financial Report', cols)}>↓ PDF</Btn>
        </div>
      )}

      {fetched && (
        <>
          <Table columns={cols} rows={rows} loading={loading} empty="No records found" />
          <Pagination page={page} pages={pagination.pages} onPage={p => { setPage(p); fetch(p); }} />
        </>
      )}

      {!fetched && (
        <div className="rp-prompt">
          <div className="rp-prompt-icon">💳</div>
          <div className="rp-prompt-text">Configure filters and click <strong>Generate</strong></div>
        </div>
      )}
    </div>
  );
};

// ── Rewards Report ──────────────────────────────────────────────────────────
const RewardsReportTab = () => {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [fetched,  setFetched]  = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setFetched(true);
    try {
      const params = new URLSearchParams({
        ...(dateFrom && { from: dateFrom }),
        ...(dateTo   && { to: dateTo }),
      });
      const res = await apiRequest.get(`/api/admin/reports/rewards?${params}`);
      setData(res.data);
    } catch { toast.error('Failed to load rewards report'); }
    finally   { setLoading(false); }
  }, [dateFrom, dateTo]);

  const toExportRows = (arr) => arr.map(r => ({ Slab: r.slab, Count: r.count }));

  return (
    <div>
      <div className="rp-filter-row">
        <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
        <Btn size="sm" onClick={fetch}>Generate</Btn>
        <Btn size="sm" variant="secondary" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</Btn>
      </div>

      {loading && <div className="ap-spinner-wrap"><div className="ap-spinner" style={{ width: 36, height: 36 }} /></div>}

      {!loading && data && (
        <div className="rp-reward-grid">
          {[
            { label: 'Referral by Slab', rows: data.referralBySlab, color: '#4f46e5' },
            { label: 'Post by Slab',     rows: data.postBySlab,     color: '#7c3aed' },
            { label: 'Streak by Slab',   rows: data.streakBySlab,   color: '#10b981' },
          ].map(({ label, rows, color }) => (
            <div key={label}>
              <div className="rp-reward-label" style={{ borderLeftColor: color }}>{label}</div>
              {rows.length === 0
                ? <p className="rp-empty">No data</p>
                : (
                  <>
                    <div className="rp-export-bar" style={{ marginBottom: '.5rem' }}>
                      <Btn size="sm" variant="secondary" onClick={() => exportCSV(toExportRows(rows),   label.replace(/ /g,'_'))}>↓ CSV</Btn>
                      <Btn size="sm" variant="secondary" onClick={() => exportExcel(toExportRows(rows), label.replace(/ /g,'_'))}>↓ Excel</Btn>
                    </div>
                    <div className="ap-table-wrap" style={{ marginBottom: '1.25rem' }}>
                      <table className="ap-table">
                        <thead><tr><th>Slab</th><th>Count</th></tr></thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={i}>
                              <td style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{r.slab ?? '—'}</td>
                              <td>{r.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              }
            </div>
          ))}
        </div>
      )}

      {!fetched && (
        <div className="rp-prompt">
          <div className="rp-prompt-icon">◇</div>
          <div className="rp-prompt-text">Configure date range and click <strong>Generate</strong></div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
const AdminReports = () => {
  const [reportType, setReportType] = useState('users');

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate, filter and export platform data" />

      <div className="rp-type-selector">
        {REPORT_TYPES.map(rt => (
          <button
            key={rt.value}
            className={`rp-type-btn ${reportType === rt.value ? 'rp-type-active' : ''}`}
            onClick={() => setReportType(rt.value)}
          >
            {rt.label}
          </button>
        ))}
      </div>

      <Card>
        {reportType === 'users'     && <UserReportTab />}
        {reportType === 'financial' && <FinancialReportTab />}
        {reportType === 'rewards'   && <RewardsReportTab />}
      </Card>

      <style>{`
        .rp-type-selector { display:flex; gap:.5rem; margin-bottom:1.25rem; flex-wrap:wrap; }
        .rp-type-btn      { padding:.625rem 1.375rem; border:1px solid var(--border); background:var(--bg-card); border-radius:10px; font-family:inherit; font-size:.875rem; font-weight:600; color:var(--text-secondary); cursor:pointer; transition:all .2s; }
        .rp-type-btn:hover{ background:var(--bg-canvas); color:var(--text-primary); }
        .rp-type-active   { background:var(--accent) !important; border-color:var(--accent) !important; color:#fff !important; }
        .rp-filter-row    { display:flex; gap:.75rem; flex-wrap:wrap; align-items:center; margin-bottom:1.25rem; padding-bottom:1.25rem; border-bottom:1px solid var(--border); }
        .rp-export-bar    { display:flex; gap:.5rem; align-items:center; margin-bottom:.875rem; flex-wrap:wrap; }
        .rp-count         { font-size:.8125rem; color:var(--text-secondary); font-weight:600; margin-right:.25rem; }
        .rp-prompt        { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4rem 2rem; gap:1rem; }
        .rp-prompt-icon   { font-size:2.5rem; opacity:.3; }
        .rp-prompt-text   { font-size:.9375rem; color:var(--text-secondary); text-align:center; }
        .rp-reward-grid   { display:flex; flex-direction:column; gap:.5rem; }
        .rp-reward-label  { font-size:.875rem; font-weight:700; color:var(--text-primary); border-left:3px solid; padding-left:.75rem; margin-bottom:.625rem; }
        .rp-empty         { font-size:.875rem; color:var(--text-secondary); padding:.5rem .75rem; }
      `}</style>
    </>
  );
};

export default AdminReports;