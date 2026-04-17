// Components/Navbar.js

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import Logo from './XLogo/Logo';
import { PayoutNotificationCenter } from './PayoutNotificationCenter';

function Navbar() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    // FIX: navigate first, then clear state.
    // This ensures admin route components unmount before AuthContext resets,
    // preventing a flash of unauthenticated state in protected routes.
    navigate('/login', { replace: true });
    logout();
  };

  return (
    <div className="navbar">
      <div className="container navbar-container">
        <div className="navbar-logo"><Logo /> अॅडमिन पॅनल</div>
        <div className="navbar-links">
          <button onClick={handleLogout} className="btn">
          <PayoutNotificationCenter />
            लॉगआउट
          </button>
        </div>
      </div>
    </div>
  );
}

export default Navbar;