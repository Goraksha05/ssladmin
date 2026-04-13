/**
 * Components/Admin/WalletReport.js
 *
 * Standalone admin page — User-wise Wallet Report.
 *
 * Shows per-user:
 *   • Grocery Coupons  — ₹ cash reward (purple)
 *   • Total Shares     — unit count (cyan)
 *   • Total Tokens     — unit count (pink)
 *
 * Features:
 *   • Paginated table fetched from GET /api/admin/wallet-report
 *   • Search by name / email / username
 *   • "Has Earnings" filter — hide zero-balance users
 *   • Per-user PAY button — processes all pending grocery-coupon claims for
 *     that user via POST /api/admin/payouts/bulk-process
 *   • Confirmation modal before payment (shows amount + claim count)
 *   • Post-payment result modal with success / failure counts
 *   • Download Report — exports full dataset as Excel AND PDF simultaneously
 *     (calls GET /api/admin/wallet-report/export, then renders both files)
 *   • Permission-gated: requires 'view_reports' (read) and 'manage_payouts'
 *     (pay action)
 *
 * Route: /admin/wallet-report
 * Mount in App.js:
 *   const WalletReport = lazy(() => import('./Components/Admin/WalletReport'));
 *   <Route path="wallet-report" element={
 *     <AdminRouteGuard permission="view_reports"><WalletReport /></AdminRouteGuard>
 *   } />
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient }               from '@tanstack/react-query';
import { toast }                                  from 'react-toastify';
import * as XLSX                                  from 'xlsx';
import jsPDF                                      from 'jspdf';
import 'jspdf-autotable';

import apiRequest          from '../../utils/apiRequest';
import { usePermissions }  from '../../Context/PermissionsContext';
import {
  PageHeader, Card, Btn, Badge, Pagination, AdminUIStyles,
} from './AdminUI';

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmt      = n  => (n ?? 0).toLocaleString('en-IN');
const fmtINR   = n  => `₹${fmt(n)}`;
const fmtDate  = s  => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const initials = nm => (nm || 'U').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'U';

const KYC_COLOR = { verified: 'green', submitted: 'yellow', rejected: 'red', not_started: 'default', required: 'yellow' };

// ── API helpers ────────────────────────────────────────────────────────────────
async function fetchWalletReport(params) {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  );
  const res = await apiRequest.get(`/api/admin/wallet-report?${q}`);
  return res.data;
}

async function fetchExportData(params) {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  );
  const res = await apiRequest.get(`/api/admin/wallet-report/export?${q}`);
  return res.data;
}

async function bulkProcessClaims(claimIds, notes = '') {
  const res = await apiRequest.post('/api/admin/payouts/bulk-process', {
    claimIds,
    status: 'processing',
    notes,
  });
  return res.data;
}

// ── Export helpers ─────────────────────────────────────────────────────────────
function doExportExcel(rows) {
  if (!rows.length) { toast.warn('No data to export'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  const colWidths = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 14) }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Wallet Report');
  XLSX.writeFile(wb, `WalletReport_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success('Excel downloaded');
}

function doExportPDF(rows, title = 'User Wallet Report') {
  if (!rows.length) { toast.warn('No data to export'); return; }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header block
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, 297, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 13);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 200, 13);

  // Summary strip
  const totalCoupons = rows.reduce((s, r) => s + (Number(r['Grocery Coupons (₹)']) || 0), 0);
  const totalShares  = rows.reduce((s, r) => s + (Number(r['Shares (units)'])       || 0), 0);
  const totalTokens  = rows.reduce((s, r) => s + (Number(r['Referral Tokens'])      || 0), 0);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.text(`Total Users: ${rows.length}`, 14, 28);
  doc.text(`Total Grocery Coupons: ₹${totalCoupons.toLocaleString('en-IN')}`, 70, 28);
  doc.text(`Total Shares: ${totalShares.toLocaleString('en-IN')} units`, 160, 28);
  doc.text(`Total Tokens: ${totalTokens.toLocaleString('en-IN')}`, 230, 28);

  const cols = Object.keys(rows[0]);
  doc.autoTable({
    startY:     34,
    head:       [cols],
    body:       rows.map(r => cols.map(c => String(r[c] ?? ''))),
    styles:     { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 247, 255] },
    columnStyles: {
      // Grocery Coupons col — highlight
      [cols.indexOf('Grocery Coupons (₹)')]: { textColor: [124, 58, 237], fontStyle: 'bold' },
      [cols.indexOf('Shares (units)')]:       { textColor: [8,  145, 178] },
      [cols.indexOf('Referral Tokens')]:      { textColor: [190,  24, 93] },
    },
  });

  doc.save(`WalletReport_${new Date().toISOString().slice(0, 10)}.pdf`);
  toast.success('PDF downloaded');
}

// ── Confirm Pay Modal ──────────────────────────────────────────────────────────
const ConfirmPayModal = ({ row, onConfirm, onClose, paying }) => {
  const [notes, setNotes] = useState('');

  if (!row) return null;

  return (
    <div style={OVERLAY_STYLE} onClick={onClose}>
      <div style={MODAL_STYLE} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={MODAL_HDR}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Confirm Payment</span>
          <button style={CLOSE_BTN} onClick={onClose}>✕</button>
        </div>

        {/* User strip */}
        <div style={USER_STRIP}>
          <div style={AVATAR_STYLE}>{initials(row.name)}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '.9rem' }}>{row.name}</div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{row.email}</div>
          </div>
        </div>

        {/* Warnings */}
        {!row.hasBankDetails && (
          <div style={WARN_BANNER}>⚠️ This user has no bank details on file.</div>
        )}
        {row.kycStatus !== 'verified' && (
          <div style={WARN_BANNER}>
            ⚠️ KYC status: <strong>{row.kycStatus?.replace(/_/g, ' ') || 'not started'}</strong>
          </div>
        )}

        {/* What will be paid */}
        <div style={BREAKDOWN}>
          <div style={BREAKDOWN_ROW}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Grocery Coupons (cash)</span>
            <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: '1.1rem' }}>
              {fmtINR(row.groceryCoupons)}
            </span>
          </div>
          <div style={BREAKDOWN_ROW}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Pending Claims</span>
            <span style={{ fontWeight: 600, fontSize: '.9rem' }}>{row.pendingClaimIds.length}</span>
          </div>
          <div style={{ ...BREAKDOWN_ROW, borderTop: '1px dashed var(--border-color)', paddingTop: '.5rem', marginTop: '.25rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '.75rem' }}>
              Shares and Tokens are non-cash assets and are <em>not</em> included in this payment.
            </span>
          </div>
        </div>

        {row.pendingClaimIds.length === 0 && (
          <div style={{ ...WARN_BANNER, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>
            ✅ All claims for this user are already paid or processing.
          </div>
        )}

        {/* Notes */}
        <div style={{ margin: '1rem 0 0' }}>
          <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '.3rem' }}>
            Admin Note (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Monthly batch payout — April 2026"
            rows={2}
            style={{
              width: '100%', padding: '.5rem .75rem', borderRadius: 8,
              border: '1px solid var(--border-color)', fontSize: '.85rem',
              background: 'var(--bg-primary)', color: 'var(--text-primary)',
              resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Footer */}
        <div style={MODAL_FTR}>
          <Btn variant="secondary" size="sm" onClick={onClose} disabled={paying}>Cancel</Btn>
          <Btn
            size="sm"
            onClick={() => onConfirm(row, notes)}
            disabled={paying || row.pendingClaimIds.length === 0}
            style={{ background: '#7c3aed', color: '#fff', border: 'none' }}
          >
            {paying ? 'Processing…' : `Pay ${fmtINR(row.groceryCoupons)}`}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ── Pay Result Modal ───────────────────────────────────────────────────────────
const PayResultModal = ({ result, onClose }) => {
  if (!result) return null;
  return (
    <div style={OVERLAY_STYLE} onClick={onClose}>
      <div style={MODAL_STYLE} onClick={e => e.stopPropagation()}>
        <div style={MODAL_HDR}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Payment Result</span>
          <button style={CLOSE_BTN} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', padding: '1rem 0', justifyContent: 'center' }}>
          {[
            { label: 'Processed', count: result.processed?.length ?? 0, color: '#10b981', bg: '#f0fdf4' },
            { label: 'Skipped',   count: result.skipped?.length   ?? 0, color: '#f59e0b', bg: '#fffbeb' },
            { label: 'Failed',    count: result.failed?.length    ?? 0, color: '#ef4444', bg: '#fef2f2' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} style={{
              flex: 1, textAlign: 'center', padding: '1rem .5rem',
              borderRadius: 10, background: bg, border: `1px solid ${color}33`,
            }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color }}>{count}</div>
              <div style={{ fontSize: '.75rem', color, fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={BREAKDOWN}>
          <div style={BREAKDOWN_ROW}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Total INR Dispatched</span>
            <span style={{ fontWeight: 700, color: '#10b981', fontSize: '1.1rem' }}>
              {fmtINR(result.totalINRDispatched ?? 0)}
            </span>
          </div>
        </div>

        {result.failed?.length > 0 && (
          <div style={{ marginTop: '.75rem' }}>
            <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#ef4444', marginBottom: '.35rem' }}>
              Failed Claims
            </div>
            {result.failed.map((f, i) => (
              <div key={i} style={WARN_BANNER}>
                <code style={{ fontSize: '.72rem', fontFamily: 'monospace' }}>{f.claimId}</code>
                {' — '}{f.reason}
              </div>
            ))}
          </div>
        )}

        <div style={MODAL_FTR}>
          <Btn size="sm" onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  );
};

// ── Shared inline styles ───────────────────────────────────────────────────────
const OVERLAY_STYLE = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '1rem',
};
const MODAL_STYLE = {
  background: 'var(--bg-primary)', borderRadius: 14,
  width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.25)',
  padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto',
};
const MODAL_HDR = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: '1rem',
};
const MODAL_FTR = {
  display: 'flex', justifyContent: 'flex-end', gap: '.75rem', marginTop: '1.25rem',
};
const CLOSE_BTN = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1,
};
const USER_STRIP = {
  display: 'flex', alignItems: 'center', gap: '.75rem',
  padding: '.75rem 1rem', borderRadius: 10,
  background: 'var(--bg-secondary)', marginBottom: '1rem',
};
const AVATAR_STYLE = {
  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
  background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 700, fontSize: '.9rem',
};
const BREAKDOWN = {
  padding: '.75rem 1rem', borderRadius: 10,
  background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '.5rem',
};
const BREAKDOWN_ROW = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const WARN_BANNER = {
  background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
  padding: '.5rem .75rem', fontSize: '.8rem', color: '#92400e', marginBottom: '.5rem',
};

// ── Summary KPI strip ──────────────────────────────────────────────────────────
const SummaryStrip = ({ rows }) => {
  const totals = useMemo(() => ({
    coupons: rows.reduce((s, r) => s + r.groceryCoupons, 0),
    shares:  rows.reduce((s, r) => s + r.shares,         0),
    tokens:  rows.reduce((s, r) => s + r.referralToken,  0),
    payable: rows.filter(r => r.pendingClaimIds.length > 0).length,
  }), [rows]);

  const chips = [
    { icon: '🛒', label: 'Total Grocery Coupons', val: fmtINR(totals.coupons), color: '#7c3aed', bg: 'rgba(124,58,237,.08)' },
    { icon: '📈', label: 'Total Shares',           val: `${fmt(totals.shares)} units`,  color: '#0891b2', bg: 'rgba(8,145,178,.08)' },
    { icon: '🪙', label: 'Total Tokens',            val: fmt(totals.tokens),             color: '#be185d', bg: 'rgba(190,24,93,.08)'  },
    { icon: '💳', label: 'Users Awaiting Pay',      val: fmt(totals.payable),            color: '#10b981', bg: 'rgba(16,185,129,.08)' },
  ];

  return (
    <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      {chips.map(({ icon, label, val, color, bg }) => (
        <div key={label} style={{
          display: 'flex', alignItems: 'center', gap: '.75rem',
          padding: '.875rem 1.25rem', borderRadius: 12, background: bg,
          border: `1px solid ${color}33`, flex: '1 1 180px', minWidth: 160,
        }}>
          <span style={{ fontSize: '1.5rem' }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color }}>{val}</div>
            <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: 1 }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const WalletReport = () => {
  const { hasPermission } = usePermissions();
  const queryClient       = useQueryClient();
  const canPay            = hasPermission('manage_payouts');

  // ── Filter state ────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [hasEarnings, setHasEarnings] = useState(false);
  const [page,        setPage]        = useState(1);
  const limit = 25;

  // ── Pay state ───────────────────────────────────────────────────────────────
  const [payingRow,   setPayingRow]   = useState(null);   // row opened in ConfirmPayModal
  const [paying,      setPaying]      = useState(false);  // request in flight
  const [payResult,   setPayResult]   = useState(null);   // BulkProcess result

  // ── Export state ────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────────
  const params = { search, hasEarnings: hasEarnings ? 'true' : '', page, limit };

  const { data, isLoading, isFetching } = useQuery({
    queryKey:        ['walletReport', params],
    queryFn:         () => fetchWalletReport(params),
    keepPreviousData: true,
    staleTime:        60_000,
  });

  const rows       = data?.rows       || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(e => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handlePay = useCallback(async (row, notes) => {
    if (!row.pendingClaimIds.length) {
      toast.info('No pending claims to process for this user.');
      return;
    }
    setPaying(true);
    try {
      const result = await bulkProcessClaims(row.pendingClaimIds, notes);
      setPayingRow(null);
      setPayResult(result);
      // Refresh table so pendingClaimIds updates
      queryClient.invalidateQueries(['walletReport']);
      toast.success(`Payment initiated for ${row.name}`);
    } catch {
      // apiRequest interceptor already showed the error toast
    } finally {
      setPaying(false);
    }
  }, [queryClient]);

  const handleDownload = useCallback(async () => {
    setExporting(true);
    try {
      const { rows: exportRows } = await fetchExportData({ search, hasEarnings: hasEarnings ? 'true' : '' });
      if (!exportRows?.length) { toast.warn('No data to export'); return; }
      doExportExcel(exportRows);
      doExportPDF(exportRows);
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [search, hasEarnings]);

  // ── Access guard ─────────────────────────────────────────────────────────────
  if (!hasPermission('view_reports')) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '4rem 2rem', gap: '1rem', textAlign: 'center',
      }}>
        <span style={{ fontSize: '3rem' }}>🔒</span>
        <h3 style={{ margin: 0 }}>Access Denied</h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          You need the <code>view_reports</code> permission to view the Wallet Report.
        </p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <AdminUIStyles />

      {/* ── Page header ── */}
      <PageHeader
        title="Wallet Report"
        subtitle={`${fmt(pagination.total)} users · Page ${pagination.page} of ${pagination.pages}`}
        actions={
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <Btn
              size="sm" variant="secondary"
              onClick={() => queryClient.invalidateQueries(['walletReport'])}
              disabled={isFetching}
            >
              {isFetching ? '⟳ Loading…' : '⟳ Refresh'}
            </Btn>
            <Btn
              size="sm" variant="primary"
              onClick={handleDownload}
              disabled={exporting || !rows.length}
              style={{ background: '#7c3aed', color: '#fff', border: 'none' }}
            >
              {exporting ? '…' : '↓ Download Report (Excel + PDF)'}
            </Btn>
          </div>
        }
      />

      {/* ── Summary strip (page totals) ── */}
      {rows.length > 0 && <SummaryStrip rows={rows} />}

      {/* ── Filters ── */}
      <Card style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '.5rem',
            background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
            borderRadius: 8, padding: '.45rem .875rem', flex: 1, minWidth: 200, maxWidth: 360,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search name, email, username…"
              value={search}
              onChange={handleSearch}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'none',
                fontSize: '.875rem', color: 'var(--text-primary)',
              }}
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>
                ×
              </button>
            )}
          </div>

          {/* Has Earnings toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '.45rem', fontSize: '.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hasEarnings}
              onChange={e => { setHasEarnings(e.target.checked); setPage(1); }}
              style={{ width: 15, height: 15, cursor: 'pointer' }}
            />
            Only show users with earnings
          </label>
        </div>
      </Card>

      {/* ── Table ── */}
      <Card>
        {isLoading && !rows.length ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '1rem', flexDirection: 'column' }}>
            <div style={{
              width: 36, height: 36, border: '3px solid var(--border-color)',
              borderTopColor: '#7c3aed', borderRadius: '50%',
              animation: 'spin .8s linear infinite',
            }} />
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Loading wallet data…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 2rem', gap: '1rem' }}>
            <span style={{ fontSize: '3rem' }}>👛</span>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No users match the current filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', opacity: isFetching ? .7 : 1, transition: 'opacity .2s' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {[
                    'User', 'Plan / KYC', 'Bank',
                    '🛒 Grocery Coupons', '📈 Shares', '🪙 Tokens',
                    'Pending Claims', 'Last Active', 'Action',
                  ].map(h => (
                    <th key={h} style={{
                      padding: '.75rem 1rem', textAlign: 'left', whiteSpace: 'nowrap',
                      fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.06em', color: 'var(--text-secondary)',
                      borderBottom: '1.5px solid var(--border-color)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row._id} style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background .15s',
                    background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)'}
                  >
                    {/* User */}
                    <td style={{ padding: '.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.625rem' }}>
                        <div style={{
                          ...AVATAR_STYLE, width: 34, height: 34, fontSize: '.8rem', flexShrink: 0,
                        }}>
                          {initials(row.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
                          <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>{row.email}</div>
                          <div style={{ fontSize: '.68rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>#{row.referralId}</div>
                        </div>
                      </div>
                    </td>

                    {/* Plan / KYC */}
                    <td style={{ padding: '.875rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
                        <Badge color={row.subActive ? 'blue' : 'default'} style={{ fontSize: '.7rem' }}>
                          {row.plan}{row.planAmount ? ` ₹${row.planAmount}` : ''}
                        </Badge>
                        <Badge color={KYC_COLOR[row.kycStatus] || 'default'} style={{ fontSize: '.68rem' }}>
                          {row.kycStatus?.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </td>

                    {/* Bank */}
                    <td style={{ padding: '.875rem 1rem', textAlign: 'center' }}>
                      <Badge color={row.hasBankDetails ? 'green' : 'red'} style={{ fontSize: '.7rem' }}>
                        {row.hasBankDetails ? '✓' : '✗'}
                      </Badge>
                    </td>

                    {/* Grocery Coupons — cash ₹ */}
                    <td style={{ padding: '.875rem 1rem', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: '.95rem' }}>
                        {fmtINR(row.groceryCoupons)}
                      </div>
                      <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)' }}>cash</div>
                    </td>

                    {/* Shares — non-cash */}
                    <td style={{ padding: '.875rem 1rem', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#0891b2', fontSize: '.95rem' }}>
                        {fmt(row.shares)}
                      </div>
                      <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)' }}>units</div>
                    </td>

                    {/* Tokens — non-cash */}
                    <td style={{ padding: '.875rem 1rem', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#be185d', fontSize: '.95rem' }}>
                        {fmt(row.referralToken)}
                      </div>
                      <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)' }}>tokens</div>
                    </td>

                    {/* Pending Claims count */}
                    <td style={{ padding: '.875rem 1rem', textAlign: 'center' }}>
                      {row.pendingClaimIds.length > 0 ? (
                        <span style={{
                          display: 'inline-block', padding: '.2rem .6rem',
                          borderRadius: 20, background: '#fef3c7',
                          border: '1px solid #fde68a', color: '#92400e',
                          fontWeight: 700, fontSize: '.78rem',
                        }}>
                          {row.pendingClaimIds.length} pending
                        </span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: 600, fontSize: '.8rem' }}>✓ All paid</span>
                      )}
                    </td>

                    {/* Last Active */}
                    <td style={{ padding: '.875rem 1rem', fontSize: '.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {fmtDate(row.lastActive)}
                    </td>

                    {/* Pay Action */}
                    <td style={{ padding: '.875rem 1rem' }}>
                      {canPay ? (
                        <button
                          onClick={() => setPayingRow(row)}
                          disabled={row.pendingClaimIds.length === 0}
                          style={{
                            padding: '.4rem .875rem', borderRadius: 8, border: 'none',
                            fontWeight: 700, fontSize: '.8rem', cursor: row.pendingClaimIds.length === 0 ? 'not-allowed' : 'pointer',
                            background: row.pendingClaimIds.length > 0
                              ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
                              : 'var(--bg-secondary)',
                            color: row.pendingClaimIds.length > 0 ? '#fff' : 'var(--text-secondary)',
                            opacity: row.pendingClaimIds.length === 0 ? .5 : 1,
                            transition: 'opacity .15s, transform .1s',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => { if (row.pendingClaimIds.length > 0) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                          title={row.pendingClaimIds.length === 0 ? 'No pending claims' : `Process ${row.pendingClaimIds.length} claim(s)`}
                        >
                          💳 Pay
                        </button>
                      ) : (
                        <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} pages={pagination.pages} onPage={setPage} />
      </Card>

      {/* ── Modals ── */}
      {payingRow && (
        <ConfirmPayModal
          row={payingRow}
          onConfirm={handlePay}
          onClose={() => { if (!paying) setPayingRow(null); }}
          paying={paying}
        />
      )}

      {payResult && (
        <PayResultModal
          result={payResult}
          onClose={() => setPayResult(null)}
        />
      )}
    </>
  );
};

export default WalletReport;