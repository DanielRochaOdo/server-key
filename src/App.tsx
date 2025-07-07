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
import RateioGoogle from './pages/RateioGoogle';

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
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute requiredModule="usuarios" adminOnly={true}>
                <Usuarios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/acessos"
            element={
              <ProtectedRoute requiredModule="acessos">
                <Acessos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute requiredModule="teams">
                <Teams />
              </ProtectedRoute>
            }
          />
          <Route
            path="/win-users"
            element={
              <ProtectedRoute requiredModule="win_users">
                <WinUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rateio-claro"
            element={
              <ProtectedRoute requiredModule="rateio_claro">
                <RateioClaro />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rateio-google"
            element={
              <ProtectedRoute requiredModule="rateio_google">
                <RateioGoogle />
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