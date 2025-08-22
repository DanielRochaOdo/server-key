import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PersistenceProvider } from './contexts/PersistenceContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Usuarios from './pages/Usuarios';
import Acessos from './pages/Acessos';
import Pessoal from './pages/Pessoal';
import Teams from './pages/Teams';
import WinUsers from './pages/WinUsers';
import RateioClaro from './pages/RateioClaro';
import RateioGoogle from './pages/RateioGoogle';

function App() {
  return (
    <PersistenceProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Admin only routes */}
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute adminOnly={true}>
                  <Usuarios />
                </ProtectedRoute>
              }
            />
            
            {/* Usuario role routes */}
            <Route
              path="/acessos"
              element={
                <ProtectedRoute requiredModule="acessos">
                  <Acessos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pessoal"
              element={
                <ProtectedRoute requiredModule="pessoal">
                  <Pessoal />
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
            
            {/* Financeiro role routes */}
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
            
            {/* Default redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </PersistenceProvider>
  );
}

export default App;