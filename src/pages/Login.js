// pages/Login.js — User login page
//
// FIX: Removed "Login as Admin" checkbox entirely.
// Admin login has its own dedicated page at /admin/login (see AdminLogin.js
// produced in the previous batch).
//
// FIX: AuthService.login() already sends role:'user' in the request body
// (from the previous batch fix), so non-admin accounts are rejected server-side
// if someone manually navigates here and tries to use admin credentials.

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import AuthService from '../Services/AuthService';
import { toast } from 'react-toastify';
import './Login.css';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error('कृपया सभी फ़ील्ड भरें');
      return;
    }

    setLoading(true);
    try {
      // FIX: Always use AuthService.login (sends role:'user').
      // Admin credentials will be rejected by the backend with a role-mismatch error.
      const result = await AuthService.login({ identifier, password });

      if (result.success && result.authtoken) {
        await login(result.authtoken);
        toast.success('लॉगिन सफल हुआ');
        navigate('/');
      } else {
        toast.error(result.error || 'लॉगिन विफल');
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error('सर्वर त्रुटि: लॉगिन विफल');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="login-header">
          <div className="logo-section">
            <div className="logo-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="12" fill="url(#gradient)"/>
                <path d="M24 14L32 20V32L24 38L16 32V20L24 14Z" fill="white" fillOpacity="0.9"/>
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="48" y2="48">
                    <stop stopColor="#667eea"/>
                    <stop offset="1" stopColor="#764ba2"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1>वापस आपका स्वागत है</h1>
            <p className="subtitle">अपने खाते में लॉगिन करें</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="identifier">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm2 2H6a5 5 0 00-5 5v1h14v-1a5 5 0 00-5-5z"/>
              </svg>
              ईमेल या उपयोगकर्ता नाम
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              placeholder="अपना ईमेल या यूज़रनेम दर्ज करें"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a2 2 0 012 2v4H6V3a2 2 0 012-2zm3 6V3a3 3 0 00-6 0v4H3.5A1.5 1.5 0 002 8.5v6A1.5 1.5 0 003.5 16h9a1.5 1.5 0 001.5-1.5v-6A1.5 1.5 0 0012.5 7H11z"/>
              </svg>
              पासवर्ड
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="अपना पासवर्ड दर्ज करें"
                className="form-input"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3C5 3 1.73 7.11 1 10a11.8 11.8 0 003.2 4.4l-2.5 2.5 1.4 1.4 14-14-1.4-1.4-2.3 2.3A9.98 9.98 0 0010 3zm0 12c-2.76 0-5-2.24-5-5 0-.77.18-1.5.49-2.15l1.43 1.43c-.03.24-.05.48-.05.72 0 1.66 1.34 3 3 3 .24 0 .48-.02.72-.05l1.43 1.43A4.98 4.98 0 0110 15z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* FIX: Admin toggle REMOVED. Admin login is at /admin/login */}
          <div className="form-options">
            <Link to="/forgot-password" className="forgot-link">
              पासवर्ड भूल गए?
            </Link>
          </div>

          <button
            type="submit"
            className={`submit-button ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                <span>लॉगिन हो रहा है...</span>
              </>
            ) : (
              <>
                <span>लॉगिन करें</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 3l7 7-7 7-1.41-1.41L13.17 11H3V9h10.17l-4.58-4.59L10 3z"/>
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>
            खाता नहीं है?{' '}
            <Link to="/register" className="register-link">
              अभी रजिस्टर करें
            </Link>
          </p>
        </div>

        <div className="security-badge">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M7 0L1 2v4c0 3.5 2.5 6.5 6 7 3.5-.5 6-3.5 6-7V2L7 0zm0 10.5L4 7l1-1 2 2 4-4 1 1-5 5.5z"/>
          </svg>
          <span>सुरक्षित एन्क्रिप्टेड कनेक्शन</span>
        </div>
      </div>
    </div>
  );
}

export default Login;