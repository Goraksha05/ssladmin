import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './Context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import AdminRoute from './Components/AdminRoute/AdminRoute';
import AdminLayout from './Components/AdminLayout';
import AdminDashboard from './Components/AdminDashboard';
import AdminUserReport from './Components/UserReport';

const queryClient = new QueryClient();

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication status
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("User");
    
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (err) {
        console.error("Failed to parse user data:", err);
        localStorage.removeItem("User");
        localStorage.removeItem("token");
      }
    }
    
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderTop: '4px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  const isAuthenticated = !!user;
  const isAdmin = user?.isAdmin || user?.role === 'admin';

  console.log("🔐 Auth state:", { isAuthenticated, isAdmin, user });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/login" 
              element={isAuthenticated ? <Navigate to={isAdmin ? "/admin/dashboard" : "/"} replace /> : <Login />} 
            />
            <Route 
              path="/register" 
              element={isAuthenticated ? <Navigate to={isAdmin ? "/admin/dashboard" : "/"} replace /> : <Register />} 
            />

            {/* Admin Routes */}
            {isAdmin ? (
              <>
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route
                  path="/admin/*"
                  element={
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  }
                >
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUserReport />} />
                  <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                </Route>
                <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </>
            ) : (
              <>
                {/* Regular User Routes */}
                <Route 
                  path="/" 
                  element={isAuthenticated ? <Home /> : <Navigate to="/login" replace />} 
                />
                <Route path="/admin/*" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;