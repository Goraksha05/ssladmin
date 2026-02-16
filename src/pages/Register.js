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
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'password') {
      calculatePasswordStrength(value);
    }
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

    const { name, username, email, phone, password, confirmPassword } = formData;

    if (!name || !username || !email || !phone || !password || !confirmPassword) {
      toast.error('कृपया सभी फ़ील्ड भरें');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('पासवर्ड मेल नहीं खाते');
      return;
    }

    if (password.length < 8) {
      toast.error('पासवर्ड कम से कम 8 अक्षर का होना चाहिए');
      return;
    }

    setLoading(true);
    const result = await AuthService.signup({
      name,
      username,
      email,
      phone,
      password,
      referralno: '',
      role: 'Admin',
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
              <label htmlFor="name">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 8a3 3 0 100-6 3 3 0 000 6z"/>
                  <path d="M13 14s1 0 1-1-1-4-6-4-6 3-6 4 1 1 1 1h10z"/>
                </svg>
                पूरा नाम
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                autoComplete="name"
                placeholder="अपना पूरा नाम दर्ज करें"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="username">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 100-6 3 3 0 000 6z"/>
                </svg>
                यूज़रनेम
              </label>
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                autoComplete="username"
                placeholder="एक यूनिक यूज़रनेम चुनें"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M.05 3.555A2 2 0 012 2h12a2 2 0 011.95 1.555L8 8.414.05 3.555zM0 4.697v7.104l5.803-3.558L0 4.697zM6.761 8.83l-6.57 4.027A2 2 0 002 14h12a2 2 0 001.808-1.144l-6.57-4.027L8 9.586l-1.239-.757zm3.436-.586L16 11.801V4.697l-5.803 3.546z"/>
              </svg>
              ईमेल पता
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              placeholder="your.email@example.com"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.654 1.328a.678.678 0 00-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 004.168 6.608 17.569 17.569 0 006.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 00-.063-1.015l-2.307-1.794a.678.678 0 00-.58-.122l-2.19.547a1.745 1.745 0 01-1.657-.459L5.482 8.062a1.745 1.745 0 01-.46-1.657l.548-2.19a.678.678 0 00-.122-.58L3.654 1.328z"/>
              </svg>
              फ़ोन नंबर
            </label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              autoComplete="tel"
              placeholder="+91 XXXXX XXXXX"
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
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                placeholder="एक मजबूत पासवर्ड बनाएं"
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
            {formData.password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div 
                    className="strength-fill" 
                    style={{ 
                      width: `${(passwordStrength / 4) * 100}%`,
                      backgroundColor: getStrengthColor()
                    }}
                  />
                </div>
                <span className="strength-label" style={{ color: getStrengthColor() }}>
                  {getStrengthLabel()}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11 6.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1z"/>
                <path d="M5.5 3.5A1.5 1.5 0 017 2h1a1.5 1.5 0 011.5 1.5h-4zM6 6a1 1 0 011-1h1a1 1 0 011 1v.938l-.4 1.599a1 1 0 01-.97.759h-.26a1 1 0 01-.97-.759L6 6.938V6z"/>
                <path d="M11 2.5v-1A1.5 1.5 0 009.5 0h-3A1.5 1.5 0 005 1.5v1H2.506a.58.58 0 00-.01 0H1.5a.5.5 0 000 1h.538l.853 10.66A2 2 0 004.885 16h6.23a2 2 0 001.994-1.84l.853-10.66h.538a.5.5 0 000-1h-.995a.59.59 0 00-.01 0H11zm1.958 1l-.846 10.58a1 1 0 01-.997.92h-6.23a1 1 0 01-.997-.92L3.042 3.5h9.916z"/>
              </svg>
              पासवर्ड की पुष्टि करें
            </label>
            <div className="password-input-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                placeholder="पासवर्ड दोबारा दर्ज करें"
                className="form-input"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label="Toggle confirm password visibility"
              >
                {showConfirmPassword ? (
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

          <button
            type="submit"
            className={`submit-button ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                <span>रजिस्टर हो रहा है...</span>
              </>
            ) : (
              <>
                <span>खाता बनाएं</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 3l7 7-7 7-1.41-1.41L13.17 11H3V9h10.17l-4.58-4.59L10 3z"/>
                </svg>
              </>
            )}
          </button>

          <div className="terms-notice">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 0a7 7 0 110 14A7 7 0 017 0zm0 12.5a5.5 5.5 0 100-11 5.5 5.5 0 000 11zM7 3a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 017 3zm0 7a1 1 0 100-2 1 1 0 000 2z"/>
            </svg>
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
            <Link to="/login" className="login-link">
              लॉगिन करें
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
