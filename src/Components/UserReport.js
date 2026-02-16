import React, { useEffect, useState } from 'react';
import { CSVLink } from 'react-csv';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AdminUserReport = () => {
  const [reportData, setReportData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadType, setDownloadType] = useState('csv');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [sortBy, setSortBy] = useState('lastActive');
  const [sortOrder, setSortOrder] = useState('desc');

  const headers = [
    { label: 'Last Active', key: 'lastActive' },
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Username', key: 'username' },
    { label: 'Subscription Plan', key: 'subscription' },
    { label: 'Active', key: 'subscriptionActive' },
    { label: 'Start Date', key: 'subscriptionStart' },
    { label: 'Expiry Date', key: 'subscriptionExpiry' },
    { label: 'Referral Tokens', key: 'referralTokens' },
    { label: 'Post Milestones', key: 'postMilestoneSlabs' },
    { label: 'Redeemed Post Slabs', key: 'redeemedPostSlabs' },
    { label: 'Redeemed Referral Slabs', key: 'redeemedReferralSlabs' },
    { label: 'Redeemed Streak Slabs', key: 'redeemedStreakSlabs' },
  ];

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setErrorMsg('No token found. Please login again.');
          setLoading(false);
          return;
        }

        const res = await fetch(`${BACKEND_URL}/api/admin/user-report`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setReportData(data.report);
          setFilteredData(data.report);
        } else {
          setErrorMsg(data.message || 'Failed to fetch report');
        }
      } catch (error) {
        console.error('Fetch error:', error);
        setErrorMsg('Failed to load report. Server error.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

  useEffect(() => {
    let filtered = [...reportData];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Plan filter
    if (filterPlan !== 'all') {
      filtered = filtered.filter(user => user.subscription === filterPlan);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle dates
      if (sortBy === 'lastActive' || sortBy === 'subscriptionStart' || sortBy === 'subscriptionExpiry') {
        aVal = new Date(aVal || 0);
        bVal = new Date(bVal || 0);
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredData(filtered);
  }, [reportData, searchTerm, filterPlan, sortBy, sortOrder]);

  const handleDownload = () => {
    if (!filteredData.length) return alert('No data to export.');

    if (downloadType === 'excel') {
      const worksheet = XLSX.utils.json_to_sheet(filteredData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'User Report');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const file = new Blob([excelBuffer], { type: 'application/octet-stream' });
      saveAs(file, 'user-report.xlsx');
    } else if (downloadType === 'pdf') {
      const doc = new jsPDF('landscape');
      doc.setFontSize(16);
      doc.text('User Report', 14, 15);
      
      const tableData = filteredData.map(row => 
        headers.slice(0, 10).map(h => row[h.key]?.toString() || 'N/A')
      );
      
      doc.autoTable({
        head: [headers.slice(0, 10).map(h => h.label)],
        body: tableData,
        startY: 25,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [37, 99, 235] },
      });
      doc.save('user-report.pdf');
    }
  };

  const uniquePlans = [...new Set(reportData.map(u => u.subscription).filter(Boolean))];

  const stats = {
    total: reportData.length,
    active: reportData.filter(u => u.subscriptionActive).length,
    inactive: reportData.filter(u => !u.subscriptionActive).length,
    totalReferrals: reportData.reduce((sum, u) => sum + (parseInt(u.referralTokens) || 0), 0)
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading user report...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>Error Loading Report</h3>
        <p>{errorMsg}</p>
      </div>
    );
  }

  if (reportData.length === 0) {
    return (
      <div className="empty-container">
        <div className="empty-icon">👥</div>
        <h3>No Users Found</h3>
        <p>There are no users in the system yet.</p>
      </div>
    );
  }

  return (
    <>
      <section className="user-report">
        {/* Header */}
        <div className="report-header">
          <div>
            <h2 className="report-title">Users Report</h2>
            <p className="report-subtitle">Complete overview of all registered users</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <span className="stat-label">Total Users</span>
              <span className="stat-value">{stats.total}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <span className="stat-label">Active Subscriptions</span>
              <span className="stat-value">{stats.active}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏸️</div>
            <div className="stat-content">
              <span className="stat-label">Inactive</span>
              <span className="stat-value">{stats.inactive}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎁</div>
            <div className="stat-content">
              <span className="stat-label">Total Referrals</span>
              <span className="stat-value">{stats.totalReferrals}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="controls-section">
          <div className="controls-left">
            {/* Search */}
            <div className="search-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="search-icon">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Filter */}
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Plans</option>
              {uniquePlans.map(plan => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="lastActive">Last Active</option>
              <option value="name">Name</option>
              <option value="subscription">Plan</option>
              <option value="referralTokens">Referrals</option>
            </select>

            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="sort-button"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                {sortOrder === 'asc' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                )}
              </svg>
            </button>
          </div>

          <div className="controls-right">
            <select
              value={downloadType}
              onChange={(e) => setDownloadType(e.target.value)}
              className="download-select"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>

            {downloadType === 'csv' ? (
              <CSVLink
                data={filteredData}
                headers={headers}
                filename={'user-report.csv'}
                className="download-button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </CSVLink>
            ) : (
              <button className="download-button" onClick={handleDownload}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </button>
            )}
          </div>
        </div>

        {/* Results Count */}
        <div className="results-info">
          Showing {filteredData.length} of {reportData.length} users
        </div>

        {/* Table */}
        <div className="table-container">
          <div className="table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => (
                  <tr key={idx}>
                    {headers.map((h) => (
                      <td key={h.key}>
                        {h.key === 'subscriptionActive' ? (
                          <span className={`status-badge ${row[h.key] ? 'active' : 'inactive'}`}>
                            {row[h.key] ? 'Active' : 'Inactive'}
                          </span>
                        ) : typeof row[h.key] === 'boolean' ? (
                          row[h.key] ? 'Yes' : 'No'
                        ) : (
                          row[h.key]?.toString() || 'N/A'
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <style>{`
        .user-report {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .report-title {
          font-size: 1.875rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .report-subtitle {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin: 0.5rem 0 0 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.5rem;
        }

        .stat-card {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 1rem;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }

        .stat-icon {
          font-size: 2.5rem;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .controls-section {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .controls-left,
        .controls-right {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .search-box {
          position: relative;
          flex: 1;
          min-width: 250px;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-secondary);
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 3rem;
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.9375rem;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .filter-select,
        .download-select {
          padding: 0.75rem 1rem;
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.9375rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-select:focus,
        .download-select:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .sort-button {
          padding: 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          background: var(--bg-primary);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sort-button:hover {
          background: var(--bg-secondary);
          transform: scale(1.05);
        }

        .download-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.9375rem;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }

        .download-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(37, 99, 235, 0.3);
        }

        .results-info {
          font-size: 0.875rem;
          color: var(--text-secondary);
          padding: 0.5rem 0;
        }

        .table-container {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 1rem;
          overflow: hidden;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .users-table {
          width: 100%;
          border-collapse: collapse;
        }

        .users-table thead {
          background: var(--bg-secondary);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .users-table th {
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border-bottom: 2px solid var(--border-color);
          white-space: nowrap;
        }

        .users-table td {
          padding: 1rem;
          border-bottom: 1px solid var(--border-color);
          font-size: 0.875rem;
          white-space: nowrap;
        }

        .users-table tbody tr {
          transition: background 0.2s;
        }

        .users-table tbody tr:hover {
          background: var(--bg-secondary);
        }

        .status-badge {
          display: inline-block;
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          font-weight: 600;
          font-size: 0.8125rem;
        }

        .status-badge.active {
          background: color-mix(in srgb, var(--success) 15%, transparent);
          color: var(--success);
        }

        .status-badge.inactive {
          background: color-mix(in srgb, var(--text-secondary) 15%, transparent);
          color: var(--text-secondary);
        }

        .loading-container,
        .error-container,
        .empty-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          gap: 1rem;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid var(--border-color);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-icon,
        .empty-icon {
          font-size: 4rem;
        }

        .error-container h3,
        .empty-container h3 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .error-container p,
        .empty-container p {
          margin: 0;
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .controls-section {
            flex-direction: column;
          }

          .controls-left,
          .controls-right {
            width: 100%;
          }

          .search-box {
            min-width: 100%;
          }

          .filter-select,
          .download-select {
            flex: 1;
          }
        }
      `}</style>
    </>
  );
};

export default AdminUserReport;
