// Components/Admin/RewardPayout.js
// ─────────────────────────────────────────────────────────────────────────────
// Payout Management panel — complete refactor.
//
// CHANGES IN THIS VERSION:
//
//   1. payoutReportExport.js WIRED IN:
//      downloadPayoutReportExcel() from payoutReportExport.js is called from
//      the new "Download Full Report" button in every tab that supports export.
//      fetchPayoutReport() from PayoutContext supplies the rows.
//
//   2. TABS re-ordered for clarity:
//      1. Summary             — INR KPIs, charts, recent-paid feed
//      2. User Requests       — grocery_redeem payouts where userRequested:true
//                              (what the admin PAYS — user explicitly clicked Redeem)
//      3. Pending Claims      — all other RewardClaims (post / referral / streak)
//                              with no payout yet
//      4. Unredeemed Wallets  — users with grocery-coupon balance who have NOT
//                              submitted a redemption request yet (admin view only)
//      5. All Payouts         — full paginated history
//
//   3. USER REQUESTS TAB (new primary action tab):
//      Dedicated tab for payouts where userRequested:true (created by
//      POST /api/activity/redeem-grocery-coupons in the user panel).
//      These are the payouts the admin is responsible for paying.
//      Shows inline status update + full bank details prominently.
//      Badge on the tab shows pending count.
//
//   4. REPORT DOWNLOAD:
//      "Download Report" in Summary tab fetches from /api/admin/payouts/report
//      and calls downloadPayoutReportExcel() (multi-sheet Excel with bank details,
//      paid/pending breakdown, summary sheet, grocery redemptions sheet).
//      Per-tab quick exports (CSV/Excel/PDF) via local helpers remain intact.
//
//   5. BANK DETAILS display enhanced:
//      Uses IFSC_BANK_MAP from payoutReportExport.js (same map, inlined here for
//      the front-end so both admin Excel export and inline table show the same
//      bank name without an extra import cycle).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { usePayouts } from '../../Context/PayoutContext';
import {
  PageHeader, Card, Btn, Badge, Select,
  Table, Pagination, DateRangeFilter, AdminUIStyles, SearchBar,
} from './AdminUI';

import { downloadPayoutReportExcel } from '../../utils/payoutReportExport';

import './RewardPayout.css';

// ─────────────────────────────────────────────────────────────────────────────
// IFSC → Bank name  (mirrors payoutReportExport.js — kept here so the table
// column renders without importing the util directly)
// ─────────────────────────────────────────────────────────────────────────────

const IFSC_BANK_MAP = {
  SBIN: 'State Bank of India', BKID: 'Bank of India', BARB: 'Bank of Baroda',
  CNRB: 'Canara Bank', PUNB: 'Punjab National Bank', UBIN: 'Union Bank of India',
  HDFC: 'HDFC Bank', ICIC: 'ICICI Bank', UTIB: 'Axis Bank',
  KKBK: 'Kotak Mahindra Bank', YESB: 'Yes Bank', INDB: 'IndusInd Bank',
  IDFB: 'IDFC First Bank', FDRL: 'Federal Bank', BDBL: 'Bandhan Bank',
  IBKL: 'IDBI Bank', CIUB: 'City Union Bank', DCBL: 'DCB Bank',
  RBLB: 'RBL Bank', SIBL: 'South Indian Bank', AIRP: 'Airtel Payments Bank',
  FINO: 'Fino Payments Bank', IPOS: 'India Post Payments Bank',
  MAHB: 'Bank of Maharashtra', IOBA: 'Indian Overseas Bank',
  IDIB: 'Indian Bank', UCBA: 'UCO Bank', PSIB: 'Punjab & Sind Bank',
};

function bankNameFromIFSC(ifsc) {
  if (!ifsc || typeof ifsc !== 'string') return null;
  return IFSC_BANK_MAP[ifsc.slice(0, 4).toUpperCase()] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '',           label: 'All Statuses' },
  { value: 'pending',    label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'paid',       label: 'Paid' },
  { value: 'failed',     label: 'Failed' },
  { value: 'on_hold',    label: 'On Hold' },
];

const TYPE_OPTIONS = [
  { value: '',               label: 'All Types' },
  { value: 'post',           label: 'Post Reward' },
  { value: 'referral',       label: 'Referral Reward' },
  { value: 'streak',         label: 'Streak Reward' },
  { value: 'grocery_redeem', label: 'Grocery Redemption' },
];

const KYC_STATUS_OPTIONS = [
  { value: '',            label: 'All KYC Statuses' },
  { value: 'verified',    label: 'Verified' },
  { value: 'submitted',   label: 'Under Review' },
  { value: 'rejected',    label: 'Rejected' },
  { value: 'not_started', label: 'Not Started' },
];

const PLAN_LABELS = {
  '2500': 'Basic ₹2500',
  '3500': 'Silver ₹3500',
  '4500': 'Gold ₹4500',
};

const TYPE_COLORS  = { post: '#4f46e5', referral: '#10b981', streak: '#f59e0b', grocery_redeem: '#059669' };
const PLAN_COLORS  = { '2500': '#10b981', '3500': '#4f46e5', '4500': '#f59e0b' };

const TRANSITIONS = {
  pending:    ['processing', 'paid', 'on_hold', 'failed'],
  processing: ['paid', 'failed', 'on_hold'],
  failed:     ['pending'],
  on_hold:    ['pending'],
  paid:       [],
};

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n) =>
  typeof n === 'number' ? `₹${n.toLocaleString('en-IN')}` : '—';

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL EXPORT HELPERS  (quick CSV/Excel/PDF for individual tabs)
// ─────────────────────────────────────────────────────────────────────────────

function exportXLSX(rows, name) {
  if (!rows.length) { toast.warn('No data to export'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  XLSX.writeFile(wb, `${name}_${Date.now()}.xlsx`);
  toast.success('Excel exported');
}

function exportCSVLocal(rows, name) {
  if (!rows.length) { toast.warn('No data to export'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${name}_${Date.now()}.csv`);
  toast.success('CSV exported');
}

function exportPDFLocal(rows, title) {
  if (!rows.length) { toast.warn('No data to export'); return; }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
  const cols = Object.keys(rows[0]);
  doc.autoTable({
    startY: 28,
    head: [cols],
    body: rows.map(r => cols.map(c => String(r[c] ?? ''))),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229] },
  });
  doc.save(`${title}_${Date.now()}.pdf`);
  toast.success('PDF exported');
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`rp-status rp-status-${status}`}>
    <span>{status === 'paid' ? '✓' : status === 'failed' ? '✗' : '●'}</span>
    {status?.replace('_', ' ')}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// BANK DETAILS CARD
// ─────────────────────────────────────────────────────────────────────────────

const BankDetailsCard = ({ bankDetails, title = 'Bank Details' }) => {
  if (!bankDetails) return null;
  const { accountNumber, ifscCode, panNumber } = bankDetails;
  const hasAny = accountNumber || ifscCode || panNumber;
  if (!hasAny) return null;
  const bankName = bankNameFromIFSC(ifscCode);

  return (
    <div style={{
      marginTop: '.875rem',
      border: '1px solid var(--border)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '.5rem',
        padding: '.5rem .875rem',
        background: 'rgba(79,70,229,.07)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '1rem' }}>🏦</span>
        <span style={{ fontWeight: 700, fontSize: '.8rem', letterSpacing: '.04em', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
          {title}
        </span>
        {bankName && (
          <span style={{ marginLeft: 'auto', fontSize: '.75rem', fontWeight: 600, color: '#4f46e5', background: 'rgba(79,70,229,.1)', padding: '.15rem .5rem', borderRadius: 5 }}>
            {bankName}
          </span>
        )}
      </div>
      <div style={{ padding: '.625rem .875rem', display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
        {accountNumber && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '.775rem', color: 'var(--text-secondary)', minWidth: 110 }}>Account No.</span>
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '.875rem', fontWeight: 600, letterSpacing: '.08em', color: 'var(--text-primary)', userSelect: 'all' }}>
              {accountNumber}
            </span>
          </div>
        )}
        {ifscCode && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '.775rem', color: 'var(--text-secondary)', minWidth: 110 }}>IFSC Code</span>
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '.875rem', fontWeight: 600, letterSpacing: '.08em', color: 'var(--text-primary)', userSelect: 'all' }}>
              {ifscCode.toUpperCase()}
            </span>
          </div>
        )}
        {bankName && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '.775rem', color: 'var(--text-secondary)', minWidth: 110 }}>Bank Name</span>
            <span style={{ fontSize: '.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{bankName}</span>
          </div>
        )}
        {panNumber && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '.35rem', borderTop: '1px dashed var(--border)', marginTop: '.1rem' }}>
            <span style={{ fontSize: '.775rem', color: 'var(--text-secondary)', minWidth: 110 }}>PAN Number</span>
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '.875rem', fontWeight: 600, letterSpacing: '.12em', color: 'var(--text-primary)', userSelect: 'all' }}>
              {panNumber.toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// INR BREAKDOWN CARD
// ─────────────────────────────────────────────────────────────────────────────

const BreakdownCard = ({ breakdown = {}, totalAmountINR }) => (
  <div className="rp-breakdown">
    <div className="rp-breakdown__row">
      <span className="rp-breakdown__label">🛒 Grocery Coupons</span>
      <span className="rp-breakdown__val">{fmt(breakdown.groceryCoupons)}</span>
    </div>
    <div className="rp-breakdown__row">
      <span className="rp-breakdown__label">📈 Shares</span>
      <span className="rp-breakdown__val">{fmt(breakdown.shares)}</span>
    </div>
    <div className="rp-breakdown__row">
      <span className="rp-breakdown__label">🪙 Referral Tokens</span>
      <span className="rp-breakdown__val">{fmt(breakdown.referralToken)}</span>
    </div>
    <div className="rp-breakdown__row rp-breakdown__total">
      <span>Total Cash</span>
      <span>{fmt(totalAmountINR)}</span>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// USER STRIP
// ─────────────────────────────────────────────────────────────────────────────

const UserStrip = ({ user }) => {
  if (!user) return null;
  const name = user.name || user.username || 'Unknown';
  return (
    <div className="rp-user-strip">
      <div className="rp-user-strip__avatar">{initials(name)}</div>
      <div>
        <div className="rp-user-strip__name">{name}</div>
        <div className="rp-user-strip__email">{user.email || '—'}</div>
        {user.phone && <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: 1 }}>{user.phone}</div>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL — Update Payout Status
// ─────────────────────────────────────────────────────────────────────────────

const UpdateStatusModal = ({ payout, onClose }) => {
  const { updateStatus, loading } = usePayouts();
  const allowed = TRANSITIONS[payout?.status] ?? [];
  const [form, setForm] = useState({
    status: allowed[0] || '',
    transactionRef: payout?.transactionRef || '',
    failureReason: '',
    notes: '',
  });
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.status) { toast.warn('Choose a target status'); return; }
    if (form.status === 'failed' && !form.failureReason.trim()) {
      toast.warn('Failure reason is required when marking as failed'); return;
    }
    const ok = await updateStatus(payout._id, {
      status: form.status,
      transactionRef: form.transactionRef || undefined,
      failureReason: form.failureReason || undefined,
      notes: form.notes || undefined,
    });
    if (ok) onClose();
  };

  if (!payout) return null;

  return (
    <div className="rp-overlay" onClick={onClose}>
      <div className="rp-modal" onClick={e => e.stopPropagation()}>
        <div className="rp-modal__header">
          <span className="rp-modal__title">Update Payout Status</span>
          <button className="rp-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="rp-modal__body">
          <UserStrip user={payout.user} />
          <BreakdownCard breakdown={payout.breakdown} totalAmountINR={payout.totalAmountINR} />
          <BankDetailsCard bankDetails={payout.bankDetails ?? payout.user?.bankDetails} title="Recipient Bank Details" />

          {/* User-requested badge */}
          {payout.userRequested && (
            <div style={{ margin: '.875rem 0 0', display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .75rem', borderRadius: 8, background: 'rgba(5,150,105,.08)', border: '1px solid rgba(5,150,105,.25)', fontSize: '.8rem', color: '#065f46' }}>
              <span>🛒</span>
              <span><strong>User-requested redemption</strong> — this payout was initiated by the user via the Redeem button in their wallet.</span>
            </div>
          )}

          {payout.status === 'paid' || allowed.length === 0 ? (
            <div className="rp-warn-banner">
              {payout.status === 'paid' ? '✅ This payout is already paid — no further transitions allowed.' : `⚠️ No allowed transitions from "${payout.status}".`}
            </div>
          ) : (
            <>
              <div className="rp-field">
                <label>New Status</label>
                <select value={form.status} onChange={e => setField('status', e.target.value)}>
                  {allowed.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="rp-field">
                <label>Transaction Reference (optional)</label>
                <input value={form.transactionRef} onChange={e => setField('transactionRef', e.target.value)} placeholder="Razorpay ID / NEFT UTR / IMPS ref" />
              </div>
              {form.status === 'failed' && (
                <div className="rp-field">
                  <label>Failure Reason <span style={{ color: '#ef4444' }}>*</span></label>
                  <textarea value={form.failureReason} onChange={e => setField('failureReason', e.target.value)} placeholder="Describe why the payout failed" />
                </div>
              )}
              <div className="rp-field">
                <label>Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Admin note" />
              </div>
            </>
          )}
        </div>
        <div className="rp-modal__footer">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          {allowed.length > 0 && payout.status !== 'paid' && (
            <Btn size="sm" onClick={handleSubmit} disabled={loading.action}>
              {loading.action ? 'Saving…' : 'Update Status'}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL — Process single pending claim
// ─────────────────────────────────────────────────────────────────────────────

const ProcessClaimModal = ({ claim, onClose }) => {
  const { processPayout, loading } = usePayouts();
  const [form, setForm] = useState({ status: 'processing', transactionRef: '', notes: '' });
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    const ok = await processPayout({ claimId: claim._id, status: form.status, transactionRef: form.transactionRef || undefined, notes: form.notes || undefined });
    if (ok) onClose();
  };

  if (!claim) return null;

  return (
    <div className="rp-overlay" onClick={onClose}>
      <div className="rp-modal" onClick={e => e.stopPropagation()}>
        <div className="rp-modal__header">
          <span className="rp-modal__title">Process Payout</span>
          <button className="rp-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="rp-modal__body">
          <UserStrip user={claim.user} />
          {!claim.hasBankDetails && <div className="rp-warn-banner">⚠️ User has no bank details on file.</div>}
          {claim.rewardsFrozen && <div className="rp-warn-banner">🔒 User's rewards are currently frozen.</div>}
          {claim.kycStatus !== 'verified' && <div className="rp-warn-banner">⚠️ KYC status: <strong>{claim.kycStatus || 'not started'}</strong></div>}
          {claim.hasBankDetails && claim.user?.bankDetails && (
            <BankDetailsCard bankDetails={claim.user.bankDetails} title="Transfer To (User Bank Details)" />
          )}
          <div className="rp-breakdown">
            <div className="rp-breakdown__row"><span className="rp-breakdown__label">Reward Type</span><span className="rp-breakdown__val" style={{ textTransform: 'capitalize' }}>{claim.type === 'grocery_redeem' ? '🛒 Grocery Redemption' : claim.type}</span></div>
            <div className="rp-breakdown__row"><span className="rp-breakdown__label">Milestone</span><span className="rp-breakdown__val">{claim.milestone}</span></div>
            <div className="rp-breakdown__row"><span className="rp-breakdown__label">Plan</span><span className="rp-breakdown__val">{PLAN_LABELS[claim.planKey] || claim.planKey || '—'}</span></div>
            <div className="rp-breakdown__row"><span className="rp-breakdown__label">Claimed At</span><span className="rp-breakdown__val">{formatDate(claim.claimedAt)}</span></div>
          </div>
          <BreakdownCard breakdown={claim.breakdown} totalAmountINR={claim.estimatedINR} />
          <div className="rp-field">
            <label>Initial Status</label>
            <select value={form.status} onChange={e => setField('status', e.target.value)}>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid (direct)</option>
            </select>
          </div>
          {form.status === 'paid' && (
            <div className="rp-field">
              <label>Transaction Reference</label>
              <input value={form.transactionRef} onChange={e => setField('transactionRef', e.target.value)} placeholder="Razorpay ID / NEFT UTR" />
            </div>
          )}
          <div className="rp-field">
            <label>Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Admin note for this payout" />
          </div>
        </div>
        <div className="rp-modal__footer">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={handleSubmit} disabled={loading.action}>
            {loading.action ? 'Processing…' : 'Create Payout'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL — Bulk process results
// ─────────────────────────────────────────────────────────────────────────────

const BulkResultModal = ({ result, onClose }) => {
  if (!result) return null;
  return (
    <div className="rp-overlay" onClick={onClose}>
      <div className="rp-modal wide" onClick={e => e.stopPropagation()}>
        <div className="rp-modal__header">
          <span className="rp-modal__title">Bulk Process Results</span>
          <button className="rp-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="rp-modal__body">
          <div className="rp-bulk-results">
            <div className="rp-bulk-results__item green"><span>{result.processed?.length ?? 0}</span><span>Processed</span></div>
            <div className="rp-bulk-results__item yellow"><span>{result.skipped?.length ?? 0}</span><span>Skipped</span></div>
            <div className="rp-bulk-results__item red"><span>{result.failed?.length ?? 0}</span><span>Failed</span></div>
          </div>
          <div className="rp-breakdown">
            <div className="rp-breakdown__row rp-breakdown__total"><span>Total INR Dispatched</span><span>{fmt(result.totalINRDispatched)}</span></div>
          </div>
          {result.failed?.length > 0 && (
            <>
              <div className="rp-section-title">Failed claims</div>
              {result.failed.map((f, i) => (
                <div key={i} className="rp-warn-banner" style={{ fontSize: '.8rem' }}>
                  <code style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>{f.claimId}</code>&nbsp;—&nbsp;{f.reason}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="rp-modal__footer"><Btn size="sm" onClick={onClose}>Done</Btn></div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — Summary  (with full Report download via payoutReportExport.js)
// ─────────────────────────────────────────────────────────────────────────────

const SummaryTab = () => {
  const { summary, recentPaid, loading, fetchPayoutReport } = usePayouts();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadReport = useCallback(async (format = 'all') => {
    setDownloading(true);
    try {
      const data = await fetchPayoutReport({ format });
      if (!data?.rows?.length) { toast.warn('No data for this report'); return; }

      // ── Wire payoutReportExport.js ──────────────────────────────────────
      // downloadPayoutReportExcel creates a multi-sheet workbook:
      //   Sheet 1: All Payouts
      //   Sheet 2: Paid Payouts
      //   Sheet 3: Pending Payouts
      //   Sheet 4: Grocery Redemptions (user-requested)
      //   Sheet 5: Summary KPIs
      downloadPayoutReportExcel(data.rows, { format });
    } catch (err) {
      console.error('[RewardPayout] download report:', err);
      toast.error('Failed to generate report');
    } finally {
      setDownloading(false);
    }
  }, [fetchPayoutReport]);

  if (loading.summary && !summary) {
    return (
      <div className="rp-kpi-grid">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rp-kpi-card">
            <div className="rp-skeleton" style={{ height: 14, width: '60%' }} />
            <div className="rp-skeleton" style={{ height: 28, width: '80%', marginTop: 6 }} />
          </div>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
        No summary data available yet.
      </div>
    );
  }

  const kpis = [
    { label: 'Total Paid Out',       value: fmt(summary.totalPaidINR),    color: '#10b981', sub: `${summary.countByStatus?.paid ?? 0} payouts` },
    { label: 'Pending / Processing', value: fmt(summary.totalPendingINR),  color: '#f59e0b', sub: `${(summary.countByStatus?.pending ?? 0) + (summary.countByStatus?.processing ?? 0)} payouts` },
    { label: 'On Hold',              value: fmt(summary.totalOnHoldINR),   color: '#8b5cf6', sub: `${summary.countByStatus?.on_hold ?? 0} payouts` },
    { label: 'Failed',               value: fmt(summary.totalFailedINR),   color: '#ef4444', sub: `${summary.countByStatus?.failed ?? 0} payouts` },
    { label: 'Avg Payout',           value: fmt(summary.avgPayoutINR),     color: '#4f46e5', sub: 'per paid record' },
  ];

  const typeData = Object.entries(summary.paidByRewardType ?? {}).map(([k, v]) => ({ name: k, value: v, fill: TYPE_COLORS[k] || '#94a3b8' }));
  const planData = Object.entries(summary.paidByPlan ?? {}).map(([k, v]) => ({ name: PLAN_LABELS[k] || k, value: v.cashAmountINR, count: v.count, fill: PLAN_COLORS[k] || '#94a3b8' }));

  return (
    <div className="rp-root">
      {/* ── Download Report section ── */}
      <Card style={{ marginBottom: '1.5rem', background: 'rgba(79,70,229,.04)', border: '1px solid rgba(79,70,229,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.9375rem', color: 'var(--text-primary)', marginBottom: '.25rem' }}>
              📊 Download Payout Report
            </div>
            <div style={{ fontSize: '.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Full Excel workbook with bank details, paid/pending breakdown, grocery redemptions, and KPI summary.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <Btn
              size="sm"
              onClick={() => handleDownloadReport('all')}
              disabled={downloading}
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none' }}
            >
              {downloading ? '⟳ Generating…' : '📥 Download All Payouts'}
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => handleDownloadReport('paid')} disabled={downloading}>
              ✅ Paid Only
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => handleDownloadReport('pending')} disabled={downloading}>
              ⏳ Pending Only
            </Btn>
          </div>
        </div>
      </Card>

      {/* ── KPI strip ── */}
      <div className="rp-kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className="rp-kpi-card" style={{ '--kpi-color': k.color }}>
            <div className="rp-kpi-label">{k.label}</div>
            <div className="rp-kpi-value">{k.value}</div>
            <div className="rp-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Pending user-requested callout */}
      {(summary.pendingUserRequestedCount ?? 0) > 0 && (
        <div style={{ display: 'flex', gap: '.75rem', padding: '.875rem 1rem', background: 'rgba(5,150,105,.07)', border: '1px solid rgba(5,150,105,.2)', borderRadius: 10, marginTop: '1rem', marginBottom: '.5rem', fontSize: '.875rem' }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🛒</span>
          <span style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
            <strong>{summary.pendingUserRequestedCount}</strong> user-requested grocery redemption{summary.pendingUserRequestedCount !== 1 ? 's are' : ' is'} awaiting payment.
            Switch to the <strong>User Requests</strong> tab to process them.
          </span>
        </div>
      )}

      {/* Charts */}
      <div className="rp-chart-row">
        {typeData.length > 0 && (
          <Card>
            <div className="rp-section-title">Paid — by Reward Type</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [fmt(v), '₹ Paid']} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>{typeData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
        {planData.length > 0 && (
          <Card>
            <div className="rp-section-title">Paid — by Plan</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={planData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {planData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip formatter={v => [fmt(v), '₹ Paid']} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Recent paid */}
      {recentPaid?.length > 0 && (
        <Card>
          <div className="rp-section-title">Recently Paid</div>
          <div className="rp-feed">
            {recentPaid.map(p => (
              <div key={p._id} className="rp-feed__item">
                <div className="rp-feed__dot" />
                <span className="rp-feed__name">{p.user?.name || p.user?.username || '—'}</span>
                <span className="rp-feed__type">{p.rewardType}{p.userRequested ? ' 🛒' : ''}</span>
                <span className="rp-feed__amt">{fmt(p.cashAmountINR ?? p.totalAmountINR)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — USER REQUESTS (grocery_redeem where userRequested:true)
//
// This is the PRIMARY ACTION tab. These are payouts the user explicitly
// submitted through the "Redeem Grocery Coupons" button in the User Panel
// (POST /api/activity/redeem-grocery-coupons → redeemGrocery.js).
// Admin should pay these first.
// ─────────────────────────────────────────────────────────────────────────────

const UserRequestsTab = () => {
  const {
    userRequestedPayouts, userRequestedSummary,
    userReqPagination, userReqPage, setUserReqPage,
    userReqFilters, setUserReqFilters, clearUserReqFilters,
    loading,
  } = usePayouts();

  const [selected, setSelected] = useState(null);

  // Build export rows
  const exportRows = userRequestedPayouts.map(r => {
    const bd = r.bankDetails ?? r.user?.bankDetails ?? {};
    return {
      'Payout ID':          String(r._id),
      'User Name':          r.user?.name || '',
      'User Email':         r.user?.email || '',
      'User Phone':         r.user?.phone || '',
      'Amount (₹)':         r.cashAmountINR ?? r.totalAmountINR ?? 0,
      'Status':             r.status || '',
      'KYC Status':         r.user?.kyc?.status || '',
      'Bank Name':          bankNameFromIFSC(bd?.ifscCode) || '',
      'Account Number':     bd?.accountNumber || '',
      'IFSC Code':          bd?.ifscCode || '',
      'PAN Number':         bd?.panNumber || '',
      'Transaction Ref':    r.transactionRef || '',
      'Submitted At':       formatDate(r.createdAt),
      'Paid At':            formatDate(r.paidAt),
      'Failure Reason':     r.failureReason || '',
      'Notes':              r.notes || '',
    };
  });

  const columns = [
    {
      key: 'user', label: 'User',
      render: r => {
        const u = r.user;
        if (!u) return <span className="rp-mono">—</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '.875rem' }}>{u.name || u.username || '—'}</span>
            <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{u.email}</span>
            {u.phone && <span style={{ fontSize: '.7rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{u.phone}</span>}
          </div>
        );
      },
    },
    {
      key: 'amount', label: 'Amount',
      render: r => <span className="rp-amount" style={{ color: '#059669', fontWeight: 700 }}>{fmt(r.cashAmountINR ?? r.totalAmountINR)}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'kyc', label: 'KYC',
      render: r => {
        const s = r.user?.kyc?.status || 'n/a';
        return <Badge color={s === 'verified' ? 'green' : s === 'submitted' ? 'yellow' : 'red'}>{s}</Badge>;
      },
    },
    {
      key: 'bank', label: 'Bank Details',
      render: r => {
        const bd = r.bankDetails ?? r.user?.bankDetails;
        if (!bd?.accountNumber) return <Badge color="red">✗ Missing</Badge>;
        const bankName = bankNameFromIFSC(bd.ifscCode);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.15rem', minWidth: 160 }}>
            {bankName && <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '.04em' }}>{bankName}</span>}
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '.8rem', fontWeight: 600, color: 'var(--text-primary)', userSelect: 'all' }}>{bd.accountNumber}</span>
            {bd.ifscCode && <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '.72rem', color: 'var(--text-secondary)', userSelect: 'all' }}>{bd.ifscCode.toUpperCase()}</span>}
            {bd.panNumber && <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '.7rem', color: 'var(--text-secondary)', userSelect: 'all' }}>PAN: {bd.panNumber.toUpperCase()}</span>}
          </div>
        );
      },
    },
    {
      key: 'transactionRef', label: 'Txn Ref',
      render: r => r.transactionRef ? <span className="rp-mono">{r.transactionRef}</span> : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    {
      key: 'createdAt', label: 'Requested',
      render: r => <span style={{ fontSize: '.8rem' }}>{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'actions', label: '',
      render: r => (
        <div className="rp-action-row">
          <button
            className={`rp-btn-icon${r.status === 'paid' ? '' : ' success'}`}
            title={r.status === 'paid' ? 'Already paid' : 'Update status'}
            onClick={() => setSelected(r)}
            disabled={r.status === 'paid'}
          >
            {r.status === 'paid' ? '✓' : '✎'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Explanation banner */}
      <div style={{ display: 'flex', gap: '.75rem', padding: '.875rem 1rem', background: 'rgba(5,150,105,.07)', border: '1px solid rgba(5,150,105,.2)', borderRadius: 10, marginBottom: '1rem', fontSize: '.8125rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🛒</span>
        <span>
          These are payouts the <strong>user explicitly requested</strong> by clicking
          the <em>Redeem Grocery Coupons</em> button in their wallet panel.
          Admin should process these payouts. Non-requested wallet balances are in
          the <strong>Unredeemed Wallets</strong> tab.
        </span>
      </div>

      {/* KPI strip */}
      {userRequestedSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: '.75rem', marginBottom: '1rem' }}>
          {[
            { label: 'Pending Amount', value: fmt(userRequestedSummary.pendingAmount), color: '#f59e0b' },
            { label: 'Pending Count',  value: userRequestedSummary.pendingCount,       color: '#f59e0b' },
            { label: 'Paid Amount',    value: fmt(userRequestedSummary.paidAmount),    color: '#10b981' },
            { label: 'Paid Count',     value: userRequestedSummary.paidCount,          color: '#10b981' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem', borderTop: `3px solid ${k.color}` }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: '"DM Mono", monospace', color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '.775rem', color: 'var(--text-secondary)', marginTop: '.25rem' }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      <Card>
        <div className="rp-filter-bar">
          <Select value={userReqFilters.status} onChange={v => setUserReqFilters({ status: v })} options={STATUS_OPTIONS} placeholder="All Statuses" />
          <DateRangeFilter from={userReqFilters.from} to={userReqFilters.to} onFrom={v => setUserReqFilters({ from: v })} onTo={v => setUserReqFilters({ to: v })} />
          <Btn size="sm" variant="secondary" onClick={clearUserReqFilters}>Clear</Btn>
          <div style={{ flex: 1 }} />
          {exportRows.length > 0 && (
            <>
              <Btn size="sm" variant="secondary" onClick={() => exportXLSX(exportRows, 'user_requests')}>↓ Excel</Btn>
              <Btn size="sm" variant="secondary" onClick={() => exportCSVLocal(exportRows, 'user_requests')}>↓ CSV</Btn>
              <Btn size="sm" variant="secondary" onClick={() => exportPDFLocal(exportRows, 'User Requests')}>↓ PDF</Btn>
            </>
          )}
        </div>

        <Table columns={columns} rows={userRequestedPayouts} loading={loading.userRequested} empty="No user-requested payouts found 🎉" />
        <Pagination page={userReqPage} pages={userReqPagination.pages} onPage={setUserReqPage} />
      </Card>

      {selected && <UpdateStatusModal payout={selected} onClose={() => setSelected(null)} />}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — Pending Claims (post / referral / streak claims with no payout yet)
// ─────────────────────────────────────────────────────────────────────────────

const PendingClaimsTab = () => {
  const {
    pendingClaims, claimPagination, claimPage, setClaimPage,
    claimFilters, setClaimFilters, clearClaimFilters,
    loading, bulkProcess,
  } = usePayouts();

  const [selected,   setSelected]   = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('processing');
  const [bulkResult, setBulkResult] = useState(null);

  const allIds     = pendingClaims.map(c => String(c._id));
  const allChecked = allIds.length > 0 && checkedIds.length === allIds.length;
  const toggleAll  = () => setCheckedIds(allChecked ? [] : allIds);
  const toggleOne  = id => setCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleBulk = async () => {
    const result = await bulkProcess(checkedIds, { status: bulkStatus });
    if (result) { setCheckedIds([]); setBulkResult(result); }
  };

  const exportRows = pendingClaims.map(c => ({
    'Claim ID':       String(c._id),
    'Type':           c.type || '',
    'Milestone':      String(c.milestone || ''),
    'User Name':      c.user?.name || '',
    'User Email':     c.user?.email || '',
    'User Phone':     c.user?.phone || '',
    'Est. Amount (₹)':c.estimatedINR ?? 0,
    'KYC Status':     c.kycStatus || '',
    'Has Bank':       c.hasBankDetails ? 'Yes' : 'No',
    'Plan':           PLAN_LABELS[c.planKey] || c.planKey || '',
    'Claimed At':     formatDate(c.claimedAt),
  }));

  const columns = [
    {
      key: 'check', label: (
        <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ cursor: 'pointer' }} />
      ),
      render: r => <input type="checkbox" checked={checkedIds.includes(String(r._id))} onChange={() => toggleOne(String(r._id))} style={{ cursor: 'pointer' }} />,
    },
    {
      key: 'user', label: 'User',
      render: r => {
        const u = r.user;
        if (!u) return '—';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '.875rem' }}>{u.name || u.username}</span>
            <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{u.email}</span>
          </div>
        );
      },
    },
    {
      key: 'type', label: 'Type',
      render: r => {
        const colorMap = { post: 'blue', referral: 'green', streak: 'yellow', grocery_redeem: 'purple' };
        return <Badge color={colorMap[r.type] || 'default'}>{r.type === 'grocery_redeem' ? '🛒 Grocery' : r.type}</Badge>;
      },
    },
    { key: 'milestone', label: 'Milestone' },
    {
      key: 'estimatedINR', label: 'Est. Amount',
      render: r => <span className={r.estimatedINR > 0 ? 'rp-amount' : 'rp-amount-warn'}>{fmt(r.estimatedINR)}</span>,
    },
    {
      key: 'hasBankDetails', label: 'Bank',
      render: r => r.hasBankDetails ? <Badge color="green">✓ Set</Badge> : <Badge color="default">—</Badge>,
    },
    {
      key: 'kycStatus', label: 'KYC',
      render: r => <Badge color={r.kycStatus === 'verified' ? 'green' : 'default'}>{r.kycStatus || 'n/a'}</Badge>,
    },
    {
      key: 'claimedAt', label: 'Claimed',
      render: r => <span style={{ fontSize: '.8rem' }}>{formatDate(r.claimedAt)}</span>,
    },
    {
      key: 'actions', label: '',
      render: r => <button className="rp-btn-icon success" title="Process this claim" onClick={() => setSelected(r)}>▶</button>,
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: '.75rem', padding: '.875rem 1rem', background: 'rgba(79,70,229,.05)', border: '1px solid rgba(79,70,229,.15)', borderRadius: 10, marginBottom: '1rem', fontSize: '.8125rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>ℹ️</span>
        <span>
          These are <strong>slab reward claims</strong> (post, referral, streak) that do not yet have a payout record.
          User-requested grocery redemptions are in the <strong>User Requests</strong> tab.
        </span>
      </div>

      <Card>
        <div className="rp-filter-bar">
          <Select value={claimFilters.type} onChange={v => setClaimFilters({ type: v })} options={TYPE_OPTIONS.filter(t => t.value !== 'grocery_redeem')} placeholder="All Types" />
          <input type="number" min="0" placeholder="Min ₹ amount" value={claimFilters.minINR} onChange={e => setClaimFilters({ minINR: e.target.value })} style={{ padding: '.35rem .6rem', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: '.85rem', background: 'var(--bg)', minWidth: 120 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.875rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!claimFilters.bankOnly} onChange={e => setClaimFilters({ bankOnly: e.target.checked })} />
            Bank details only
          </label>
          <Btn size="sm" variant="secondary" onClick={clearClaimFilters}>Clear</Btn>
          <div style={{ flex: 1 }} />
          {exportRows.length > 0 && (
            <>
              <Btn size="sm" variant="secondary" onClick={() => exportXLSX(exportRows, 'pending_claims')}>↓ Excel</Btn>
              <Btn size="sm" variant="secondary" onClick={() => exportCSVLocal(exportRows, 'pending_claims')}>↓ CSV</Btn>
            </>
          )}
        </div>

        {checkedIds.length > 0 && (
          <div className="rp-bulk-bar">
            <span className="rp-bulk-bar__count">{checkedIds.length} selected</span>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} style={{ padding: '.3rem .6rem', borderRadius: 6, border: '1px solid #bfdbfe', fontSize: '.85rem', background: '#eff6ff', color: '#1e40af' }}>
              <option value="processing">→ Processing</option>
              <option value="paid">→ Paid (direct)</option>
            </select>
            <div className="rp-bulk-bar__spacer" />
            <Btn size="sm" variant="secondary" onClick={() => setCheckedIds([])}>Deselect All</Btn>
            <Btn size="sm" onClick={handleBulk} disabled={loading.bulk}>
              {loading.bulk ? 'Processing…' : `Bulk Process (${checkedIds.length})`}
            </Btn>
          </div>
        )}

        <Table columns={columns} rows={pendingClaims} loading={loading.claims} empty="No pending claims — all slab rewards have been processed 🎉" />
        <Pagination page={claimPage} pages={claimPagination.pages} onPage={setClaimPage} />
      </Card>

      {selected && <ProcessClaimModal claim={selected} onClose={() => setSelected(null)} />}
      {bulkResult && <BulkResultModal result={bulkResult} onClose={() => setBulkResult(null)} />}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4 — Unredeemed Wallets
// ─────────────────────────────────────────────────────────────────────────────

const UnredeemedWalletsTab = () => {
  const {
    unredeemedWallets, walletSummary,
    walletPagination, walletPage, setWalletPage,
    walletFilters, setWalletFilters, clearWalletFilters,
    loading,
  } = usePayouts();

  const exportRows = unredeemedWallets.map(u => ({
    'Name':              u.name || '',
    'Email':             u.email || '',
    'Phone':             u.phone || '',
    'Balance (₹)':       u.availableGrocery ?? u.totalGroceryCoupons ?? 0,
    'Shares':            u.totalShares ?? 0,
    'Referral Tokens':   u.totalReferralToken ?? 0,
    'Plan':              u.plan || 'None',
    'KYC Status':        u.kycStatus || 'not_started',
    'Bank Name':         bankNameFromIFSC(u.ifscCode) || '',
    'Account Number':    u.accountNumber || '',
    'IFSC Code':         u.ifscCode || '',
    'PAN Number':        u.panNumber || '',
    'Eligible':          u.eligible ? 'Yes' : 'No',
    'Rewards Frozen':    u.rewardsFrozen ? 'Yes' : 'No',
    'Last Active':       formatDate(u.lastActive),
  }));

  const columns = [
    {
      key: 'user', label: 'User',
      // render: r => (
      //   <div style={{ display: 'flex', alignItems: 'center', gap: '.625rem' }}>
      //     <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.875rem', flexShrink: 0 }}>
      //       {(r.name?.[0] || 'U').toUpperCase()}
      //     </div>
      //     <div style={{ display: 'flex', flexDirection: 'column', gap: '.1rem' }}>
      //       <span style={{ fontWeight: 600, fontSize: '.875rem' }}>{r.name || r.username || '—'}</span>
      //       <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{r.email}</span>
      //     </div>
      //   </div>
      // ),

      render: r => {
        const balance = r.availableGrocery ?? r.totalGroceryCoupons ?? 0;
        return (
          <span style={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '.9rem', fontWeight: 700,
            color: balance >= 2500 ? '#10b981' : 'var(--text-primary)',
          }}>
            {fmt(balance)}
          </span>
        );
      },
    },
    {
      key: 'totalGroceryCoupons', label: 'Balance',
      render: r => <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '.9rem', fontWeight: 700, color: r.totalGroceryCoupons >= 2500 ? '#10b981' : 'var(--text-primary)' }}>{fmt(r.totalGroceryCoupons)}</span>,
    },
    { key: 'plan', label: 'Plan', render: r => r.plan ? <Badge color="blue">{r.plan}</Badge> : <Badge color="default">None</Badge> },
    {
      key: 'kycStatus', label: 'KYC',
      render: r => { const colorMap = { verified: 'green', submitted: 'yellow', rejected: 'red' }; return <Badge color={colorMap[r.kycStatus] || 'default'}>{r.kycStatus?.replace('_', ' ') || 'not started'}</Badge>; },
    },
    {
      key: 'eligible', label: 'Can Self-Redeem',
      render: r => r.eligible ? <Badge color="green" style={{ fontSize: '.7rem' }}>✓ Ready</Badge> : <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><Badge color="default" style={{ fontSize: '.7rem' }}>Not ready</Badge>{!r.kycVerified && <span style={{ fontSize: '.65rem', color: '#f59e0b' }}>KYC unverified</span>}{!r.subActive && <span style={{ fontSize: '.65rem', color: '#ef4444' }}>No subscription</span>}{!r.hasBankDetails && <span style={{ fontSize: '.65rem', color: '#ef4444' }}>No bank details</span>}</div>,
    },
    { key: 'lastActive', label: 'Last Active', render: r => <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>{formatDate(r.lastActive)}</span> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {walletSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.75rem' }}>
          {[
            { icon: '👥', label: 'Users with Balance',            val: (walletSummary.totalUsersWithBalance ?? 0).toLocaleString(),   color: '#4f46e5' },
            { icon: '🛒', label: 'Total Unredeemed (Available)',  val: fmt(walletSummary.totalUnredeemedINR),                         color: '#059669' },
            { icon: '✓',  label: 'Eligible to Redeem',            val: (walletSummary.eligibleToRedeem ?? 0).toLocaleString(),        color: '#10b981' },
            { icon: '🏦', label: 'Missing Bank',                  val: (walletSummary.missingBankDetails ?? 0).toLocaleString(),      color: '#ef4444' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.125rem', borderTop: `3px solid ${k.color}` }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '.375rem' }}>{k.icon}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: '"DM Mono", monospace', color: k.color }}>{k.val}</div>
              <div style={{ fontSize: '.775rem', color: 'var(--text-secondary)', marginTop: '.25rem' }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '.75rem', padding: '.875rem 1rem', background: 'rgba(5,150,105,.06)', border: '1px solid rgba(5,150,105,.18)', borderRadius: 10, fontSize: '.8125rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>ℹ️</span>
        <span>
          These users have earned grocery coupons through slab rewards (posts, referrals, streaks)
          but have <strong>not yet requested a redemption</strong>.
          When a user clicks <em>Redeem Grocery Coupons</em> in their wallet, their payout moves to the
          <strong> User Requests</strong> tab.
        </span>
      </div>

      <Card>
        <div className="rp-filter-bar">
          <SearchBar value={walletFilters.search} onChange={v => setWalletFilters({ search: v })} placeholder="Search name, email…" />
          <Select value={walletFilters.kycStatus} onChange={v => setWalletFilters({ kycStatus: v })} options={KYC_STATUS_OPTIONS} placeholder="All KYC Statuses" />
          <input type="number" min="0" placeholder="Min ₹ balance" value={walletFilters.minBalance} onChange={e => setWalletFilters({ minBalance: e.target.value })} style={{ padding: '.375rem .625rem', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: '.85rem', background: 'var(--bg-canvas)', minWidth: 130, color: 'var(--text-primary)' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '.375rem', fontSize: '.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={!!walletFilters.bankOnly} onChange={e => setWalletFilters({ bankOnly: e.target.checked })} />
            Bank details only
          </label>
          <Btn size="sm" variant="secondary" onClick={clearWalletFilters}>Clear</Btn>
          <div style={{ flex: 1 }} />
          {unredeemedWallets.length > 0 && (
            <>
              <Btn size="sm" variant="secondary" onClick={() => exportXLSX(exportRows, 'unredeemed_wallets')}>↓ Excel</Btn>
              <Btn size="sm" variant="secondary" onClick={() => exportCSVLocal(exportRows, 'unredeemed_wallets')}>↓ CSV</Btn>
            </>
          )}
        </div>
        <Table columns={columns} rows={unredeemedWallets} loading={loading.wallets} empty="No users with unredeemed grocery coupon balance found 🎉" />
        <Pagination page={walletPage} pages={walletPagination.pages} onPage={setWalletPage} />
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5 — All Payouts
// ─────────────────────────────────────────────────────────────────────────────

const AllPayoutsTab = () => {
  const {
    payouts, pagination, page, setPage,
    filters, setFilters, clearFilters,
    loading,
  } = usePayouts();

  const [selected, setSelected] = useState(null);

  const exportRows = payouts.map(r => {
    const bd = r.bankDetails ?? r.user?.bankDetails;
    return {
      'Payout ID':          String(r._id),
      'User Name':          r.user?.name || '',
      'User Email':         r.user?.email || '',
      'User Phone':         r.user?.phone || '',
      'Type':               r.rewardType || '',
      'Milestone':          String(r.milestone || ''),
      'Plan':               r.planKey || '',
      'Amount (₹)':         r.cashAmountINR ?? r.totalAmountINR ?? 0,
      'Status':             r.status || '',
      'User Requested':     r.userRequested ? 'Yes' : 'No',
      'Txn Ref':            r.transactionRef || '',
      'Bank Name':          bankNameFromIFSC(bd?.ifscCode) || '',
      'Account No.':        bd?.accountNumber || '',
      'IFSC Code':          bd?.ifscCode || '',
      'PAN Number':         bd?.panNumber || '',
      'Created':            formatDate(r.createdAt),
      'Paid At':            formatDate(r.paidAt),
      'Notes':              r.notes || '',
    };
  });

  const columns = [
    {
      key: 'user', label: 'User',
      render: r => {
        const u = r.user;
        if (!u) return <span className="rp-mono">—</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '.875rem' }}>{u.name || u.username || '—'}</span>
            <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{u.email}</span>
          </div>
        );
      },
    },
    {
      key: 'rewardType', label: 'Type',
      render: r => {
        const colorMap = { post: 'blue', referral: 'green', streak: 'yellow', grocery_redeem: 'purple' };
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Badge color={colorMap[r.rewardType] || 'default'}>{r.rewardType === 'grocery_redeem' ? '🛒 Grocery' : r.rewardType}</Badge>
            {r.userRequested && <Badge color="green" style={{ fontSize: '.65rem' }}>User Requested</Badge>}
          </div>
        );
      },
    },
    { key: 'milestone', label: 'Milestone' },
    {
      key: 'planKey', label: 'Plan',
      render: r => <span style={{ fontSize: '.8rem' }}>{PLAN_LABELS[r.planKey] || r.planKey || '—'}</span>,
    },
    {
      key: 'totalAmountINR', label: 'Amount',
      render: r => <span className="rp-amount">{fmt(r.cashAmountINR ?? r.totalAmountINR)}</span>,
    },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
    {
      key: 'bankDetails', label: 'Bank',
      render: r => {
        const bd = r.bankDetails ?? r.user?.bankDetails;
        if (!bd?.accountNumber) return <span style={{ color: 'var(--text-secondary)', fontSize: '.8rem' }}>—</span>;
        const bankName = bankNameFromIFSC(bd.ifscCode);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.15rem', minWidth: 160 }}>
            {bankName && <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '.04em' }}>{bankName}</span>}
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '.8rem', fontWeight: 600, color: 'var(--text-primary)', userSelect: 'all' }}>{bd.accountNumber}</span>
          </div>
        );
      },
    },
    {
      key: 'createdAt', label: 'Created',
      render: r => <span style={{ fontSize: '.8rem' }}>{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'actions', label: '',
      render: r => (
        <div className="rp-action-row">
          <button className="rp-btn-icon" title={r.status === 'paid' ? 'Already paid' : 'Update status'} onClick={() => setSelected(r)} disabled={r.status === 'paid'}>✎</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <div className="rp-filter-bar">
          <Select value={filters.status} onChange={v => setFilters({ status: v })} options={STATUS_OPTIONS} placeholder="All Statuses" />
          <Select value={filters.rewardType} onChange={v => setFilters({ rewardType: v })} options={TYPE_OPTIONS} placeholder="All Types" />
          <DateRangeFilter from={filters.from} to={filters.to} onFrom={v => setFilters({ from: v })} onTo={v => setFilters({ to: v })} />
          <Btn size="sm" variant="secondary" onClick={clearFilters}>Clear</Btn>
          <div style={{ flex: 1 }} />
          {payouts.length > 0 && (
            <>
              <Btn size="sm" variant="secondary" onClick={() => exportXLSX(exportRows, 'payouts')}>↓ Excel</Btn>
              <Btn size="sm" variant="secondary" onClick={() => exportCSVLocal(exportRows, 'payouts')}>↓ CSV</Btn>
              <Btn size="sm" variant="secondary" onClick={() => exportPDFLocal(exportRows, 'Payouts Report')}>↓ PDF</Btn>
            </>
          )}
        </div>
        <Table columns={columns} rows={payouts} loading={loading.payouts} empty="No payout records found" />
        <Pagination page={page} pages={pagination.pages} onPage={setPage} />
      </Card>
      {selected && <UpdateStatusModal payout={selected} onClose={() => setSelected(null)} />}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const RewardPayout = () => {
  const [tab, setTab] = useState('summary');

  const {
    claimPagination,   pendingClaims,
    walletPagination,  unredeemedWallets,
    userReqPagination, userRequestedPayouts,
    loading, refresh,
  } = usePayouts();

  const pendingClaimCount   = claimPagination.total    ?? pendingClaims.length;
  const walletCount         = walletPagination.total   ?? unredeemedWallets.length;
  const userReqCount        = userReqPagination.total  ?? userRequestedPayouts.length;
  const userReqPendingCount = userRequestedPayouts.filter(p => ['pending', 'processing'].includes(p.status)).length;
  const isBusy              = loading.payouts || loading.claims || loading.summary || loading.wallets || loading.userRequested;

  const TABS = [
    { id: 'summary',   label: 'Summary' },
    {
      id: 'requests',
      label: 'User Requests',
      badge: userReqCount > 0 ? userReqCount : null,
      badgeColor: userReqPendingCount > 0 ? '#ef4444' : '#10b981',
      badgeTitle: 'User-requested grocery redemptions',
    },
    { id: 'claims',    label: 'Pending Claims',    badge: pendingClaimCount > 0 ? pendingClaimCount : null },
    { id: 'wallets',   label: 'Unredeemed Wallets', badge: walletCount > 0 ? walletCount : null, badgeColor: '#059669' },
    { id: 'all',       label: 'All Payouts' },
  ];

  return (
    <>
      <AdminUIStyles />
      <PageHeader
        title="Reward Payouts"
        subtitle="Process, track and manage all user reward disbursements"
        actions={
          <Btn size="sm" variant="secondary" onClick={refresh} disabled={isBusy}>
            {isBusy ? '⟳ Loading…' : '⟳ Refresh'}
          </Btn>
        }
      />

      {/* Tab bar */}
      <div className="rp-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`rp-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
            title={t.badgeTitle}
          >
            {t.label}
            {t.badge != null && (
              <span
                className="rp-tab-badge"
                style={t.badgeColor ? { background: t.badgeColor } : undefined}
              >
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'summary'  && <SummaryTab />}
      {tab === 'requests' && <UserRequestsTab />}
      {tab === 'claims'   && <PendingClaimsTab />}
      {tab === 'wallets'  && <UnredeemedWalletsTab />}
      {tab === 'all'      && <AllPayoutsTab />}
    </>
  );
};

export default RewardPayout;