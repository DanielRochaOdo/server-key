import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Usuarios from './pages/Usuarios';
import Acessos from './pages/Acessos';
import Teams from './pages/Teams';
import WinUsers from './pages/WinUsers';
import RateioClaro from './pages/RateioClaro';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* <Route
            path="/usuarios"
            element={
              <ProtectedRoute>
                <Usuarios />
              </ProtectedRoute>
            }
          /> */}
          <Route
            path="/acessos"
            element={
              <ProtectedRoute>
                <Acessos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <Teams />
              </ProtectedRoute>
            }
          />
          <Route
            path="/win-users"
            element={
              <ProtectedRoute>
                <WinUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rateio-claro"
            element={
              <ProtectedRoute>
                <RateioClaro />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;