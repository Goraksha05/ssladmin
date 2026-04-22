// utils/payoutReportExport.js
// ─────────────────────────────────────────────────────────────────────────────
// Excel report export for payout data with bank details.
// Uses SheetJS (xlsx) — already installed in the project.
//
// WHAT'S NEW:
//   • Sheet 4 "User Redemptions"  — only payouts where userRequested === true
//     (grocery coupon cash-outs the user explicitly initiated from their wallet).
//     This sheet is the finance team's primary working document for processing
//     bank transfers.
//   • getBankName() surfaced as a named export so RewardPayout.js can use it
//     directly for the inline table column without duplicating the map.
//   • autoWidth() stays internal — nothing else needs it.
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { toast } from 'react-toastify';

// ── Bank name from IFSC ───────────────────────────────────────────────────────

export const IFSC_BANK_MAP = {
  SBIN: 'State Bank of India', BKID: 'Bank of India',    BARB: 'Bank of Baroda',
  CNRB: 'Canara Bank',         PUNB: 'Punjab National Bank', UBIN: 'Union Bank of India',
  HDFC: 'HDFC Bank',           ICIC: 'ICICI Bank',        UTIB: 'Axis Bank',
  KKBK: 'Kotak Mahindra Bank', YESB: 'Yes Bank',          INDB: 'IndusInd Bank',
  IDFB: 'IDFC First Bank',     FDRL: 'Federal Bank',      BDBL: 'Bandhan Bank',
  IBKL: 'IDBI Bank',           CIUB: 'City Union Bank',   DCBL: 'DCB Bank',
  RBLB: 'RBL Bank',            SIBL: 'South Indian Bank', AIRP: 'Airtel Payments Bank',
  FINO: 'Fino Payments Bank',  IPOS: 'India Post Payments Bank',
  MAHB: 'Bank of Maharashtra', IOBA: 'Indian Overseas Bank',
  IDIB: 'Indian Bank',         UCBA: 'UCO Bank',          PSIB: 'Punjab & Sind Bank',
  ORBC: 'Oriental Bank',       ANDB: 'Andhra Bank',       ALLA: 'Allahabad Bank',
  VIJB: 'Vijaya Bank',         CORP: 'Corporation Bank',  UTBI: 'United Bank',
  KARB: 'Karnataka Bank',      KVBL: 'Karur Vysya Bank',  TMBL: 'Tamilnad Mercantile',
  AUBL: 'AU Small Finance',    JSFB: 'Jana Small Finance',
};

/**
 * Get bank name from IFSC code prefix.
 * @param {string} ifsc
 * @returns {string}
 */
export function getBankName(ifsc) {
  if (!ifsc) return '';
  return IFSC_BANK_MAP[String(ifsc).slice(0, 4).toUpperCase()] || '';
}

// ── Internal: set column widths from header + data ────────────────────────────

function autoWidth(sheet, rows, headers) {
  const colWidths = headers.map(h => ({
    wch: Math.max(
      String(h).length,
      ...rows.map(r => String(r[h] ?? '').length),
    ) + 2,
  }));
  sheet['!cols'] = colWidths;
}

// ── Internal: safe string ─────────────────────────────────────────────────────

const s = (v) => (v == null ? '' : String(v));

// ── Internal: format date ─────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? s(d) : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Internal: format INR ──────────────────────────────────────────────────────

const fmtINR = (n) => (typeof n === 'number' ? n : 0);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Download payout report as a multi-sheet Excel workbook with bank details.
 *
 * Sheets produced:
 *   1. All Payouts         — every payout record
 *   2. Paid Payouts        — status === 'paid'
 *   3. Pending Payouts     — status in ['pending', 'processing', 'on_hold']
 *   4. User Redemptions    — rewardType === 'grocery_redeem' && userRequested === 'Yes'
 *                           (these are user-initiated cash-outs from the wallet panel)
 *   5. Summary             — KPIs, count-by-status, amount-by-type, amount-by-plan
 *
 * @param {object[]} rows     — flat row objects from GET /api/admin/payouts/report
 * @param {object}   options  — { format?: 'all'|'paid'|'pending', from?, to? }
 */
export function downloadPayoutReportExcel(rows, options = {}) {
  if (!rows || rows.length === 0) {
    toast.warn('No payout data to export.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // ── Shared row builder ─────────────────────────────────────────────────────

  /**
   * Map a raw API row to the "All Payouts" column shape.
   * All 30 columns are defined here; sub-sheets pick a subset.
   */
  const mapFull = (r) => ({
    'Payout ID':             s(r.payoutId),
    'Reward Type':           s(r.rewardType),
    'User Requested':        s(r.userRequested),
    'Milestone':             s(r.milestone),
    'Plan':                  s(r.plan),
    'Cash Amount (₹)':       fmtINR(r.cashAmountINR),
    'Grocery Coupons (₹)':  fmtINR(r.groceryCoupons),
    'Shares Held':           fmtINR(r.sharesHeld),
    'Tokens Held':           fmtINR(r.tokensHeld),
    'Status':                s(r.status),
    'Created At':            fmtDate(r.createdAt),
    'Processed At':          fmtDate(r.processedAt),
    'Paid At':               fmtDate(r.paidAt),
    'Transaction Ref':       s(r.transactionRef),
    'Failure Reason':        s(r.failureReason),
    'Processed By':          s(r.processedBy),
    'Notes':                 s(r.notes),
    'User Name':             s(r.userName),
    'User Email':            s(r.userEmail),
    'User Phone':            s(r.userPhone),
    'User Username':         s(r.userUsername),
    'User Plan':             s(r.userPlan),
    'Plan Amount (₹)':       fmtINR(r.userPlanAmount),
    'Sub Active':            s(r.userSubActive),
    'KYC Status':            s(r.userKycStatus),
    'Rewards Frozen':        s(r.userRewardsFrozen),
    'Bank Name':             getBankName(r.bankIfscCode),
    'Account Number':        s(r.bankAccountNumber),
    'IFSC Code':             s(r.bankIfscCode),
    'PAN Number':            s(r.bankPanNumber),
  });

  // ── SHEET 1: All Payouts ───────────────────────────────────────────────────

  const allRows    = rows.map(mapFull);
  const allHeaders = Object.keys(allRows[0] || {});
  const wsAll      = XLSX.utils.json_to_sheet(allRows);
  autoWidth(wsAll, allRows, allHeaders);

  // Header row: bold + indigo background (openpyxl-style — SheetJS CE ignores this
  // but the shape is preserved for the Pro version; col widths are applied above)
  XLSX.utils.book_append_sheet(wb, wsAll, 'All Payouts');

  // ── SHEET 2: Paid Payouts ──────────────────────────────────────────────────

  const paidRawRows = rows.filter(r => r.status === 'paid');
  if (paidRawRows.length > 0) {
    const paidRows = paidRawRows.map(r => ({
      'Payout ID':          s(r.payoutId),
      'Reward Type':        s(r.rewardType),
      'User Requested':     s(r.userRequested),
      'User Name':          s(r.userName),
      'User Email':         s(r.userEmail),
      'User Phone':         s(r.userPhone),
      'Cash Paid (₹)':      fmtINR(r.cashAmountINR),
      'Grocery Coupons (₹)':fmtINR(r.groceryCoupons),
      'Plan':               s(r.userPlan),
      'KYC Status':         s(r.userKycStatus),
      'Bank Name':          getBankName(r.bankIfscCode),
      'Account Number':     s(r.bankAccountNumber),
      'IFSC Code':          s(r.bankIfscCode),
      'PAN Number':         s(r.bankPanNumber),
      'Transaction Ref':    s(r.transactionRef),
      'Paid At':            fmtDate(r.paidAt),
      'Processed By':       s(r.processedBy),
    }));
    const wsPaid = XLSX.utils.json_to_sheet(paidRows);
    autoWidth(wsPaid, paidRows, Object.keys(paidRows[0]));
    XLSX.utils.book_append_sheet(wb, wsPaid, 'Paid Payouts');
  }

  // ── SHEET 3: Pending / Processing / On Hold ────────────────────────────────

  const pendingRawRows = rows.filter(r => ['pending', 'processing', 'on_hold'].includes(r.status));
  if (pendingRawRows.length > 0) {
    const pendingRows = pendingRawRows.map(r => ({
      'Payout ID':       s(r.payoutId),
      'Reward Type':     s(r.rewardType),
      'User Requested':  s(r.userRequested),
      'Status':          s(r.status),
      'User Name':       s(r.userName),
      'User Email':      s(r.userEmail),
      'User Phone':      s(r.userPhone),
      'Cash Amount (₹)': fmtINR(r.cashAmountINR),
      'Plan':            s(r.userPlan),
      'KYC Status':      s(r.userKycStatus),
      'Sub Active':      s(r.userSubActive),
      'Bank Name':       getBankName(r.bankIfscCode),
      'Account Number':  s(r.bankAccountNumber),
      'IFSC Code':       s(r.bankIfscCode),
      'PAN Number':      s(r.bankPanNumber),
      'Created At':      fmtDate(r.createdAt),
      'Notes':           s(r.notes),
    }));
    const wsPending = XLSX.utils.json_to_sheet(pendingRows);
    autoWidth(wsPending, pendingRows, Object.keys(pendingRows[0]));
    XLSX.utils.book_append_sheet(wb, wsPending, 'Pending Payouts');
  }

  // ── SHEET 4: User Redemptions (grocery_redeem + userRequested = Yes) ───────
  //
  // This sheet is the FINANCE TEAM's working document for processing user-
  // requested grocery coupon cash-outs. It includes full unmasked bank details
  // (account number, IFSC, PAN, bank name) so payments can be initiated
  // directly without cross-referencing another system.
  //
  // Each row corresponds to exactly one user request submitted through
  // POST /api/activity/redeem-grocery-coupons (redeemGrocery.js).
  // ─────────────────────────────────────────────────────────────────────────

  const redemptionRows = rows.filter(
    r => r.rewardType === 'grocery_redeem' && r.userRequested === 'Yes',
  );

  if (redemptionRows.length > 0) {
    const redRows = redemptionRows.map(r => ({
      // ── Identifiers ─────────────────────────────────────────────────────
      'Payout ID':         s(r.payoutId),
      'Status':            s(r.status),

      // ── Beneficiary ─────────────────────────────────────────────────────
      'User Full Name':    s(r.userName),
      'User Email':        s(r.userEmail),
      'User Phone':        s(r.userPhone),
      'KYC Verified':      r.userKycStatus === 'verified' ? 'Yes' : 'No',
      'Rewards Frozen':    s(r.userRewardsFrozen),

      // ── Payment amount ───────────────────────────────────────────────────
      'Cash Amount (₹)':   fmtINR(r.cashAmountINR),
      'Grocery Balance (₹)': fmtINR(r.groceryCoupons),

      // ── Bank details (primary payment information) ───────────────────────
      'Bank Name':         getBankName(r.bankIfscCode),
      'Account Number':    s(r.bankAccountNumber),
      'IFSC Code':         s(r.bankIfscCode),
      'PAN Number':        s(r.bankPanNumber),

      // ── Plan context ─────────────────────────────────────────────────────
      'Subscription Plan': s(r.userPlan),
      'Plan Amount (₹)':   fmtINR(r.userPlanAmount),
      'Sub Active':        s(r.userSubActive),

      // ── Lifecycle ────────────────────────────────────────────────────────
      'Request Submitted': fmtDate(r.createdAt),
      'Processed At':      fmtDate(r.processedAt),
      'Paid At':           fmtDate(r.paidAt),
      'Transaction Ref':   s(r.transactionRef),
      'Failure Reason':    s(r.failureReason),
      'Admin Notes':       s(r.notes),
      'Processed By':      s(r.processedBy),
    }));

    const wsRed = XLSX.utils.json_to_sheet(redRows);
    autoWidth(wsRed, redRows, Object.keys(redRows[0]));
    XLSX.utils.book_append_sheet(wb, wsRed, 'User Redemptions');
  }

  // ── SHEET 5: Summary KPIs ─────────────────────────────────────────────────

  const totalPaid          = rows.filter(r => r.status === 'paid').reduce((s, r) => s + fmtINR(r.cashAmountINR), 0);
  const totalPending       = rows.filter(r => ['pending', 'processing'].includes(r.status)).reduce((s, r) => s + fmtINR(r.cashAmountINR), 0);
  const totalFailed        = rows.filter(r => r.status === 'failed').reduce((s, r) => s + fmtINR(r.cashAmountINR), 0);
  const totalOnHold        = rows.filter(r => r.status === 'on_hold').reduce((s, r) => s + fmtINR(r.cashAmountINR), 0);
  const totalUserRequested = rows.filter(r => r.userRequested === 'Yes').reduce((s, r) => s + fmtINR(r.cashAmountINR), 0);
  const totalUserReqPaid   = rows.filter(r => r.userRequested === 'Yes' && r.status === 'paid').reduce((s, r) => s + fmtINR(r.cashAmountINR), 0);
  const totalUserReqPend   = rows.filter(r => r.userRequested === 'Yes' && ['pending', 'processing'].includes(r.status)).reduce((s, r) => s + fmtINR(r.cashAmountINR), 0);

  const summaryData = [
    { Metric: 'Report Generated',                    Value: new Date().toLocaleString('en-IN') },
    { Metric: 'Total Payouts in Report',             Value: rows.length },
    { Metric: '',                                     Value: '' },

    { Metric: '─── FINANCIAL SUMMARY ───',          Value: '' },
    { Metric: 'Total Paid (₹)',                      Value: totalPaid },
    { Metric: 'Total Pending (₹)',                   Value: totalPending },
    { Metric: 'Total Failed (₹)',                    Value: totalFailed },
    { Metric: 'Total On Hold (₹)',                   Value: totalOnHold },
    { Metric: 'Grand Total (₹)',                     Value: totalPaid + totalPending + totalFailed + totalOnHold },
    { Metric: '',                                     Value: '' },

    { Metric: '─── COUNT BY STATUS ───',            Value: '' },
    { Metric: 'Paid',                                Value: rows.filter(r => r.status === 'paid').length },
    { Metric: 'Pending',                             Value: rows.filter(r => r.status === 'pending').length },
    { Metric: 'Processing',                          Value: rows.filter(r => r.status === 'processing').length },
    { Metric: 'Failed',                              Value: rows.filter(r => r.status === 'failed').length },
    { Metric: 'On Hold',                             Value: rows.filter(r => r.status === 'on_hold').length },
    { Metric: '',                                     Value: '' },

    { Metric: '─── BY REWARD TYPE (PAID ONLY) ───', Value: '' },
    { Metric: 'Post Rewards (₹)',                    Value: rows.filter(r => r.rewardType === 'post'     && r.status === 'paid').reduce((s, r) => s + fmtINR(r.cashAmountINR), 0) },
    { Metric: 'Referral Rewards (₹)',                Value: rows.filter(r => r.rewardType === 'referral' && r.status === 'paid').reduce((s, r) => s + fmtINR(r.cashAmountINR), 0) },
    { Metric: 'Streak Rewards (₹)',                  Value: rows.filter(r => r.rewardType === 'streak'   && r.status === 'paid').reduce((s, r) => s + fmtINR(r.cashAmountINR), 0) },
    { Metric: 'Grocery Redemptions (₹)',             Value: rows.filter(r => r.rewardType === 'grocery_redeem' && r.status === 'paid').reduce((s, r) => s + fmtINR(r.cashAmountINR), 0) },
    { Metric: '',                                     Value: '' },

    { Metric: '─── USER-REQUESTED REDEMPTIONS ───', Value: '' },
    { Metric: 'Total User Requests',                 Value: rows.filter(r => r.userRequested === 'Yes').length },
    { Metric: 'User-Requested Total (₹)',            Value: totalUserRequested },
    { Metric: 'User-Requested Paid (₹)',             Value: totalUserReqPaid },
    { Metric: 'User-Requested Pending (₹)',          Value: totalUserReqPend },
    { Metric: 'User-Requested Paid Count',           Value: rows.filter(r => r.userRequested === 'Yes' && r.status === 'paid').length },
    { Metric: 'User-Requested Pending Count',        Value: rows.filter(r => r.userRequested === 'Yes' && ['pending', 'processing'].includes(r.status)).length },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── Save ──────────────────────────────────────────────────────────────────

  const dateStr = new Date().toISOString().slice(0, 10);
  const suffix  = options.format && options.format !== 'all' ? `_${options.format}` : '';
  const filename = `PayoutReport${suffix}_${dateStr}.xlsx`;

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), filename);

  const paidCount   = rows.filter(r => r.status === 'paid').length;
  const pendCount   = rows.filter(r => ['pending', 'processing'].includes(r.status)).length;
  const userReqPend = rows.filter(r => r.userRequested === 'Yes' && ['pending', 'processing'].includes(r.status)).length;

  toast.success(
    `Report downloaded: ${filename} — ${rows.length} payouts` +
    ` (${paidCount} paid, ${pendCount} pending, ${userReqPend} user redemptions pending)`,
  );
}