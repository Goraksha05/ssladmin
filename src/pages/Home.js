// pages/Home.js
//
// FIX: Was checking localStorage.getItem('isLoggedIn') for auth — a key
// that is NEVER set anywhere in the codebase. This meant the redirect to
// /login fired on every single page load, making the home page inaccessible.
// Now uses AuthContext (isAuthenticated / user) as the single source of truth.

import React, { useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import Navbar from '../Components/Navbar';
import './Home.css';

const AdminDashboard    = React.lazy(() => import('../Components/AdminDashboard'));
const AdminRewardsPage  = React.lazy(() => import('../Components/AdminRewardsPage'));
const ClaimDashboard    = React.lazy(() => import('../Components/ClaimDashboard'));
const AdminUserReport   = React.lazy(() => import('../Components/UserReport'));

function LargeSpinner() {
  return (
    <div className="spinner-container">
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <span className="spinner-text">लोड हो रहा है...</span>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, error: err };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <div className="error-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
              <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm2 30h-4v-4h4v4zm0-8h-4V14h4v12z"/>
            </svg>
          </div>
          <h3>रिपोर्ट लोड करने में त्रुटि</h3>
          <p>{this.state.error?.message || 'आंतरिक त्रुटि'}</p>
          <button
            className="btn-retry"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            पुनः प्रयास करें
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Home() {
  const navigate = useNavigate();
  // FIX: Read auth state from context, not from localStorage 'isLoggedIn'
  const { user } = useAuth();
  const [selectedReport, setSelectedReport] = useState(null);

  // Auth guard is handled by PrivateRoute in App.js — no localStorage check needed here.

  const openFullAdmin = () => navigate('/admin');

  const reports = [
    {
      id: 'admin',
      name: 'Admin Control Panel',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>,
      description: 'व्यवस्थापन नियंत्रण केंद्र',
      color: '#667eea',
    },
    {
      id: 'rewards',
      name: 'Rewards Management',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>,
      description: 'पुरस्कार प्रबंधन प्रणाली',
      color: '#f59e0b',
    },
    {
      id: 'claims',
      name: 'Claim Monitor',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>,
      description: 'दावा निगरानी डैशबोर्ड',
      color: '#10b981',
    },
    {
      id: 'users',
      name: 'User Analytics',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
      description: 'उपयोगकर्ता विश्लेषण रिपोर्ट',
      color: '#8b5cf6',
    },
  ];

  return (
    <div className="home-wrapper">
      <Navbar />
      <div className="home-container">
        <div className="welcome-section">
          <div className="welcome-content">
            <h1 className="welcome-title">
              स्वागत है, {user?.name || 'Admin'}! 👋
            </h1>
            <p className="welcome-subtitle">
              आपने सफलतापूर्वक लॉगिन किया है। नीचे दी गई रिपोर्ट में से किसी पर क्लिक करके डेटा एनालिटिक्स एक्सेस करें।
            </p>
          </div>
          <div className="quick-stats">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#667eea20', color: '#667eea' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">सक्रिय</span>
                <span className="stat-value">ऑनलाइन</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#10b98120', color: '#10b981' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">आज की तारीख</span>
                <span className="stat-value">{new Date().toLocaleDateString('hi-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="reports-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">रिपोर्ट डैशबोर्ड</h2>
              <p className="section-subtitle">विश्लेषण और प्रबंधन उपकरण चुनें</p>
            </div>
            <button className="btn-full-admin" onClick={openFullAdmin}>
              पूर्ण व्यवस्थापन पैनल
            </button>
          </div>

          <div className="report-grid">
            {reports.map((report) => (
              <button
                key={report.id}
                className={`report-card ${selectedReport === report.id ? 'active' : ''}`}
                onClick={() => setSelectedReport(report.id)}
                style={{ '--card-color': report.color }}
              >
                <div className="report-card-header">
                  <div className="report-icon" style={{ background: `${report.color}20`, color: report.color }}>
                    {report.icon}
                  </div>
                  {selectedReport === report.id && (
                    <div className="active-badge">✓</div>
                  )}
                </div>
                <h3 className="report-title">{report.name}</h3>
                <p className="report-description">{report.description}</p>
              </button>
            ))}
          </div>

          <div className="report-content">
            <ErrorBoundary>
              <Suspense fallback={<LargeSpinner />}>
                {selectedReport === null ? (
                  <div className="empty-state">
                    <h3>कोई रिपोर्ट चयनित नहीं</h3>
                    <p>शुरू करने के लिए ऊपर से एक रिपोर्ट कार्ड चुनें</p>
                  </div>
                ) : selectedReport === 'admin'   ? <AdminDashboard />
                  : selectedReport === 'rewards' ? <AdminRewardsPage />
                  : selectedReport === 'claims'  ? <ClaimDashboard />
                  : selectedReport === 'users'   ? <AdminUserReport />
                  : <div className="error-state"><p>अमान्य चयन</p></div>
                }
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;