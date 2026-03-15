// Components/Admin/AdminFinancial.js — Financial Management
import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import apiRequest from '../../utils/apiRequest';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  PageHeader, Card, StatCard, Btn, Badge, Select,
  Table, Pagination, DateRangeFilter, AdminUIStyles,
} from './AdminUI';

const PLAN_OPTIONS = [
  { value: '',         label: 'All Plans' },
  { value: 'Basic',    label: 'Basic' },
  { value: 'Silver',   label: 'Silver' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Gold',     label: 'Gold' },
  { value: 'Premium',  label: 'Premium' },
];

const PLAN_COLORS = {
  Basic: '#10b981', Silver: '#94a3b8', Standard: '#4f46e5',
  Gold: '#f59e0b', Premium: '#7c3aed',
};

function exportExcel(rows, name) {
  if (!rows.length) return toast.warn('No data');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name);
  XLSX.writeFile(wb, `${name}_${Date.now()}.xlsx`);
  toast.success('Excel exported');
}

function exportCSV(rows, name) {
  if (!rows.length) return toast.warn('No data');
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${name}_${Date.now()}.csv`);
  toast.success('CSV exported');
}

function exportPDF(rows, name) {
  if (!rows.length) return toast.warn('No data');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text(name, 14, 16);
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
  doc.save(`${name}_${Date.now()}.pdf`);
  toast.success('PDF exported');
}

const AdminFinancial = () => {
  const [records,    setRecords]    = useState([]);
  const [analytics,  setAnalytics]  = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading,    setLoading]    = useState(true);
  const [plan,       setPlan]       = useState('');
  const [hasBankDetails, setHasBank]= useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [page,       setPage]       = useState(1);

  const fetchRecords = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p, limit: 25,
        ...(plan           && { plan }),
        ...(hasBankDetails && { hasBankDetails }),
        ...(dateFrom       && { from: dateFrom }),
        ...(dateTo         && { to: dateTo }),
      });
      const res = await apiRequest.get(`/api/admin/reports/financial?${params}`);
      setRecords(res.data.report);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load financial data'); }
    finally   { setLoading(false); }
  }, [plan, hasBankDetails, dateFrom, dateTo]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await apiRequest.get('/api/admin/analytics');
      setAnalytics(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  useEffect(() => { setPage(1); }, [plan, hasBankDetails, dateFrom, dateTo]);
  useEffect(() => { fetchRecords(page); }, [page, plan, hasBankDetails, dateFrom, dateTo]);

  const subPlans = analytics?.subPlans || [];
  const pieData  = subPlans.map((s, i) => ({
    name: s._id || 'Unknown',
    value: s.count,
    fill: PLAN_COLORS[s._id] || '#94a3b8',
  }));

  const columns = [
    { key: 'name',          label: 'Name' },
    { key: 'email',         label: 'Email' },
    { key: 'phone',         label: 'Phone' },
    {
      key: 'plan', label: 'Plan',
      render: r => r.plan && r.plan !== 'None'
        ? <Badge color="blue">{r.plan}</Badge>
        : <Badge color="default">None</Badge>,
    },
    {
      key: 'active', label: 'Sub Active',
      render: r => r.active === 'Yes'
        ? <Badge color="green">Active</Badge>
        : <Badge color="default">Inactive</Badge>,
    },
    { key: 'startDate',     label: 'Start' },
    { key: 'expiresAt',     label: 'Expires' },
    { key: 'paymentId',     label: 'Payment ID', render: r => <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.8125rem' }}>{r.paymentId}</span> },
    {
      key: 'accountNumber', label: 'Bank Acct',
      render: r => r.accountNumber !== 'N/A'
        ? <Badge color="green">✓ Set</Badge>
        : <Badge color="default">—</Badge>,
    },
    { key: 'ifscCode',  label: 'IFSC' },
    { key: 'panNumber', label: 'PAN' },
  ];

  const totals = analytics?.totals;

  return (
    <>
      <AdminUIStyles />
      <PageHeader
        title="Financial Management"
        subtitle="Subscriptions, payments and bank details"
        actions={
          records.length > 0 && (
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <Btn size="sm" variant="secondary" onClick={() => exportCSV(records,   'financial')}>↓ CSV</Btn>
              <Btn size="sm" variant="secondary" onClick={() => exportExcel(records, 'financial')}>↓ Excel</Btn>
              <Btn size="sm" variant="secondary" onClick={() => exportPDF(records,   'Financial Report')}>↓ PDF</Btn>
            </div>
          )
        }
      />

      {/* KPIs */}
      <div className="ap-stats-grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard label="Active Subscriptions" value={(totals?.activeSubs || 0).toLocaleString()} icon="◈" color="#4f46e5" />
        <StatCard label="Total Users"           value={(totals?.users      || 0).toLocaleString()} icon="👤" color="#10b981" />
        <StatCard label="With Bank Details"     value={records.filter(r => r.accountNumber !== 'N/A').length.toLocaleString()} icon="🏦" color="#f59e0b" />
        <StatCard label="Records Shown"         value={pagination.total?.toLocaleString() ?? '—'} icon="▤" color="#7c3aed" />
      </div>

      {/* Subscription plan chart */}
      {pieData.length > 0 && (
        <div className="fn-chart-row" style={{ marginBottom: '1.5rem' }}>
          <Card>
            <div className="ap-section-title">Subscription Plan Distribution</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip formatter={v => [v.toLocaleString(), 'Users']} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <div className="ap-section-title">Users per Plan</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pieData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Filter + Table */}
      <Card>
        <div className="ap-filter-bar">
          <Select value={plan}          onChange={setPlan}     options={PLAN_OPTIONS} placeholder="All Plans" />
          <Select value={hasBankDetails} onChange={setHasBank} options={[{ value: 'true', label: 'Has Bank Details' }]} placeholder="Any" />
          <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
          <Btn size="sm" variant="secondary" onClick={() => { setPlan(''); setHasBank(''); setDateFrom(''); setDateTo(''); }}>Clear</Btn>
        </div>
        <Table columns={columns} rows={records} loading={loading} empty="No financial records found" />
        <Pagination page={page} pages={pagination.pages} onPage={setPage} />
      </Card>

      <style>{`
        .fn-chart-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1rem; }
      `}</style>
    </>
  );
};

export default AdminFinancial;