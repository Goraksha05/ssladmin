// utils/adminExport.js
// Shared CSV / Excel / PDF export helpers for admin panel pages.
// Previously copy-pasted across AdminFinancial, AdminReports,
// AdminActivityReport, and RewardPayout. Single source of truth.

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'react-toastify';

/**
 * Export an array of flat objects as a CSV file.
 * @param {object[]} rows
 * @param {string}   name  — file name stem (timestamp appended automatically)
 */
export function exportCSV(rows, name = 'export') {
  if (!rows.length) { toast.warn('No data to export'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${name}_${Date.now()}.csv`);
  toast.success('CSV exported');
}

/**
 * Export an array of flat objects as an Excel (.xlsx) file.
 * @param {object[]} rows
 * @param {string}   name  — file name stem and sheet name
 */
export function exportExcel(rows, name = 'export') {
  if (!rows.length) { toast.warn('No data to export'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // sheet name max 31 chars
  XLSX.writeFile(wb, `${name}_${Date.now()}.xlsx`);
  toast.success('Excel exported');
}

/**
 * Export an array of flat objects as a landscape PDF table.
 * @param {object[]}                      rows
 * @param {string}                        title   — heading printed on page 1
 * @param {{ key: string, label: string }[]} [columns] — if omitted, all keys are used
 * @param {'a4'|'a3'}                     [format='a4']
 */
export function exportPDF(rows, title = 'Export', columns, format = 'a4') {
  if (!rows.length) { toast.warn('No data to export'); return; }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format });
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Total rows: ${rows.length}`, 14, 22);

  const cols = columns || Object.keys(rows[0]).map(k => ({ key: k, label: k }));
  doc.autoTable({
    startY: 28,
    head: [cols.map(c => c.label)],
    body: rows.map(r => cols.map(c => String(r[c.key] ?? ''))),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
  toast.success('PDF exported');
}