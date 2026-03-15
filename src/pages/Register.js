// pages/Register.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import AuthService from '../Services/AuthService';
import { toast } from 'react-toastify';
import './Register.css';

function Register() {
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const [formData, setFormData] = useState({
    name: '', username: '', email: '', phone: '',
    password: '', confirmPassword: '', referralno: '',
  });
  const [loading,             setLoading]             = useState(false);
  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength,    setPasswordStrength]    = useState(0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
    if (name === 'password') calcStrength(value);
  };

  const calcStrength = (pw) => {
    let s = 0;
    if (pw.length >= 8)  s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^a-zA-Z\d]/.test(pw)) s++;
    setPasswordStrength(Math.min(s, 4));
  };

  const strengthLabel = ['Very Weak','Weak','Fair','Strong','Very Strong'][passwordStrength] || '';
  const strengthColor = ['#ef4444','#f59e0b','#eab308','#22c55e','#10b981'][passwordStrength] || '#334155';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, username, email, phone, password, confirmPassword, referralno } = formData;
    if (!name || !username || !email || !phone || !password || !confirmPassword) {
      toast.error('Please fill in all fields'); return;
    }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (password.length < 5)          { toast.error('Password must be at least 5 characters'); return; }

    setLoading(true);
    const result = await AuthService.signup({ name, username, email, phone, password, referralno, role: 'user' });
    setLoading(false);

    if (result.success) {
      await login(result.authtoken);
      toast.success('Registration successful');
      navigate('/');
    } else {
      toast.error(result.error || 'Registration failed');
    }
  };

  const EyeOpen  = () => <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>;
  const EyeOff   = () => <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3C5 3 1.73 7.11 1 10a11.8 11.8 0 003.2 4.4l-2.5 2.5 1.4 1.4 14-14-1.4-1.4-2.3 2.3A9.98 9.98 0 0010 3zm0 12c-2.76 0-5-2.24-5-5 0-.77.18-1.5.49-2.15l1.43 1.43A2.97 2.97 0 0010 13c.24 0 .48-.02.72-.05l1.43 1.43A4.98 4.98 0 0110 15z"/></svg>;

  return (
    <div className="register-wrapper">
      <div className="register-container">
        <div className="register-header">
          <div className="logo-section">
            <div className="logo-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="url(#lg2)"/>
                <path d="M24 12L35 18.5V31.5L24 38L13 31.5V18.5L24 12Z" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.6" strokeWidth="1.5"/>
                <path d="M24 17L31 21V29L24 33L17 29V21L24 17Z" fill="white" fillOpacity="0.9"/>
                <defs>
                  <linearGradient id="lg2" x1="0" y1="0" x2="48" y2="48">
                    <stop stopColor="#fbbf24"/><stop offset="1" stopColor="#d97706"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1>Create Account</h1>
            <p className="subtitle">Join us today</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input id="name" type="text" name="name" value={formData.name} onChange={handleChange}
                autoComplete="name" placeholder="Your full name" className="form-input"/>
            </div>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input id="username" type="text" name="username" value={formData.username} onChange={handleChange}
                autoComplete="username" placeholder="Unique username" className="form-input"/>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input id="email" type="email" name="email" value={formData.email} onChange={handleChange}
              autoComplete="email" placeholder="your.email@example.com" className="form-input"/>
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleChange}
              autoComplete="tel" placeholder="10-digit mobile number" className="form-input"/>
          </div>

          <div className="form-group">
            <label htmlFor="referralno">Referral ID <span style={{opacity:.5,fontWeight:400,textTransform:'none'}}>(optional)</span></label>
            <input id="referralno" type="text" name="referralno" value={formData.referralno} onChange={handleChange}
              placeholder="e.g. DU688828" className="form-input"/>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input id="password" type={showPassword ? 'text' : 'password'} name="password"
                value={formData.password} onChange={handleChange}
                autoComplete="new-password" placeholder="Create a strong password" className="form-input"/>
              <button type="button" className="password-toggle"
                onClick={() => setShowPassword(v => !v)} aria-label="Toggle password">
                {showPassword ? <EyeOpen/> : <EyeOff/>}
              </button>
            </div>
            {formData.password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div className="strength-fill" style={{ width: `${(passwordStrength/4)*100}%`, backgroundColor: strengthColor }}/>
                </div>
                <span className="strength-label" style={{ color: strengthColor }}>{strengthLabel}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-wrapper">
              <input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword"
                value={formData.confirmPassword} onChange={handleChange}
                autoComplete="new-password" placeholder="Re-enter your password" className="form-input"/>
              <button type="button" className="password-toggle"
                onClick={() => setShowConfirmPassword(v => !v)} aria-label="Toggle confirm password">
                {showConfirmPassword ? <EyeOpen/> : <EyeOff/>}
              </button>
            </div>
          </div>

          <button type="submit" className={`submit-button${loading ? ' loading' : ''}`} disabled={loading}>
            {loading
              ? <><span className="spinner"/><span>Creating account…</span></>
              : <><span>Create Account</span>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3l7 7-7 7-1.41-1.41L13.17 11H3V9h10.17l-4.58-4.59L10 3z"/>
                  </svg>
                </>
            }
          </button>

          <div className="terms-notice">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 0L1 2v4c0 3.5 2.5 6.5 6 7 3.5-.5 6-3.5 6-7V2L7 0zm0 10.5L4 7l1-1 2 2 4-4 1 1-5 5.5z"/>
            </svg>
            <p>
              By registering you agree to our{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
            </p>
          </div>
        </form>

        <div className="register-footer">
          <p>Already have an account?{' '}
            <Link to="/login" className="login-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;