// ============================================================
// Navbar.js — Fixed: was only clearing non-existent keys
// ============================================================
// FIX: Old logout cleared 'isLoggedIn' and 'currentUser' (never-set keys),
// so the token was never removed and the user was never actually logged out.
// Now uses AuthContext.logout() which clears token, User, and socket.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import Logo from './XLogo/Logo';
import { I18nThemeProvider } from "../Context/I18nThemeContext";

function Navbar() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <I18nThemeProvider>
      <div className="navbar">
        <div className="container navbar-container">
          <div className="navbar-logo"><Logo /> अॅडमिन पॅनल</div>
          <div className="navbar-links">
            <button onClick={handleLogout} className="btn">
              लॉगआउट
            </button>
          </div>
        </div>
      </div>
    </I18nThemeProvider>
  );
}

export default Navbar;