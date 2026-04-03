// Components/Navbar.js
//
// CHANGES FROM PREVIOUS VERSION:
//
//   1. Removed the <I18nThemeProvider> wrapper that was wrapping the entire
//      Navbar. Both I18nProvider and ThemeModeProvider are now mounted once
//      at the App root, so wrapping again here created an isolated, nested
//      context instance. Any language or theme changes made outside Navbar
//      would not have been reflected inside it (and vice-versa).

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import Logo from './XLogo/Logo';

function Navbar() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
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
  );
}

export default Navbar;