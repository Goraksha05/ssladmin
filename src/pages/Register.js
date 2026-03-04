// pages/Register.js — User registration page
//
// FIX: Was sending `role: 'Admin'` (capital A, wrong value) in every signup
// request. This meant EVERY registered user was created as an admin, which is
// a critical security vulnerability. Changed to role: 'user'.
//
// Admin accounts must be created directly in the database or via a separate
// seeded admin-creation script — never through a public registration form.

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import AuthService from '../Services/AuthService';
import { toast } from 'react-toastify';
import './Register.css';

function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralno: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'password') calculatePasswordStrength(value);
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    setPasswordStrength(Math.min(strength, 4));
  };

  const getStrengthLabel = () => {
    const labels = ['बहुत कमजोर', 'कमजोर', 'मध्यम', 'मजबूत', 'बहुत मजबूत'];
    return labels[passwordStrength] || '';
  };

  const getStrengthColor = () => {
    const colors = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981'];
    return colors[passwordStrength] || '#e5e7eb';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, username, email, phone, password, confirmPassword, referralno } = formData;

    if (!name || !username || !email || !phone || !password || !confirmPassword) {
      toast.error('कृपया सभी फ़ील्ड भरें');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('पासवर्ड मेल नहीं खाते');
      return;
    }
    if (password.length < 5) {
      toast.error('पासवर्ड कम से कम 5 अक्षर का होना चाहिए');
      return;
    }

    setLoading(true);
    // FIX: role must be 'user' — was 'Admin' (capital A), making every
    // registered user an admin. Admin accounts are provisioned separately.
    const result = await AuthService.signup({
      name,
      username,
      email,
      phone,
      password,
      referralno,
      role: 'user',
    });
    setLoading(false);

    if (result.success) {
      await login(result.authtoken);
      toast.success('रजिस्ट्रेशन सफल हुआ');
      navigate('/');
    } else {
      toast.error(result.error || 'रजिस्ट्रेशन विफल');
    }
  };

  return (
    <div className="register-wrapper">
      <div className="register-container">
        <div className="register-header">
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
            <h1>खाता बनाएं</h1>
            <p className="subtitle">अपनी यात्रा शुरू करें</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">पूरा नाम</label>
              <input
                id="name" type="text" name="name"
                value={formData.name} onChange={handleChange}
                autoComplete="name" placeholder="अपना पूरा नाम दर्ज करें"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="username">यूज़रनेम</label>
              <input
                id="username" type="text" name="username"
                value={formData.username} onChange={handleChange}
                autoComplete="username" placeholder="एक यूनिक यूज़रनेम चुनें"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">ईमेल पता</label>
            <input
              id="email" type="email" name="email"
              value={formData.email} onChange={handleChange}
              autoComplete="email" placeholder="your.email@example.com"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">फ़ोन नंबर</label>
            <input
              id="phone" type="tel" name="phone"
              value={formData.phone} onChange={handleChange}
              autoComplete="tel" placeholder="10-digit number"
              className="form-input"
            />
          </div>

          {/* Referral */}
          <div className="form-group">
            <label htmlFor="referralno">रेफरल ID (वैकल्पिक)</label>
            <input
              id="referralno" type="text" name="referralno"
              value={formData.referralno} onChange={handleChange}
              placeholder="e.g. DU688828"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">पासवर्ड</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                placeholder="एक मजबूत पासवर्ड बनाएं"
                className="form-input"
              />
              <button
                type="button" className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword
                  ? <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                  : <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3C5 3 1.73 7.11 1 10a11.8 11.8 0 003.2 4.4l-2.5 2.5 1.4 1.4 14-14-1.4-1.4-2.3 2.3A9.98 9.98 0 0010 3zm0 12c-2.76 0-5-2.24-5-5 0-.77.18-1.5.49-2.15l1.43 1.43c-.03.24-.05.48-.05.72 0 1.66 1.34 3 3 3 .24 0 .48-.02.72-.05l1.43 1.43A4.98 4.98 0 0110 15z"/></svg>
                }
              </button>
            </div>
            {formData.password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div className="strength-fill" style={{ width: `${(passwordStrength / 4) * 100}%`, backgroundColor: getStrengthColor() }} />
                </div>
                <span className="strength-label" style={{ color: getStrengthColor() }}>{getStrengthLabel()}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">पासवर्ड की पुष्टि करें</label>
            <div className="password-input-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                placeholder="पासवर्ड दोबारा दर्ज करें"
                className="form-input"
              />
              <button
                type="button" className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label="Toggle confirm password visibility"
              >
                {showConfirmPassword
                  ? <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                  : <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3C5 3 1.73 7.11 1 10a11.8 11.8 0 003.2 4.4l-2.5 2.5 1.4 1.4 14-14-1.4-1.4-2.3 2.3A9.98 9.98 0 0010 3zm0 12c-2.76 0-5-2.24-5-5 0-.77.18-1.5.49-2.15l1.43 1.43c-.03.24-.05.48-.05.72 0 1.66 1.34 3 3 3 .24 0 .48-.02.72-.05l1.43 1.43A4.98 4.98 0 0110 15z"/></svg>
                }
              </button>
            </div>
          </div>

          <button type="submit" className={`submit-button ${loading ? 'loading' : ''}`} disabled={loading}>
            {loading
              ? <><span className="spinner"></span><span>रजिस्टर हो रहा है...</span></>
              : <><span>खाता बनाएं</span><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3l7 7-7 7-1.41-1.41L13.17 11H3V9h10.17l-4.58-4.59L10 3z"/></svg></>
            }
          </button>

          <div className="terms-notice">
            <p>
              रजिस्टर करके, आप हमारी{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">सेवा की शर्तें</a>
              {' '}और{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">गोपनीयता नीति</a>
              {' '}से सहमत हैं।
            </p>
          </div>
        </form>

        <div className="register-footer">
          <p>
            पहले से खाता है?{' '}
            <Link to="/login" className="login-link">लॉगिन करें</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;