import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './XLogo/Logo'

function Navbar() {
  const navigate = useNavigate();
  
  const handleLogout = () => {
    // Clear login status
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    navigate('/login');
  };
  
  return (
    <div className="navbar">
      <div className="container navbar-container">
        <div className="navbar-logo"><Logo/>अॅडमिन पॅनल</div>
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