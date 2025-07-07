import React from 'react';
import { useRequireAuth } from '/hooks/useRequireAuth';
import { useAuth } from '/contexts/AuthContext';
import Layout from './Layout';
import { AlertTriangle } from 'lucide-react';

const ProtectedRoute = ({ children, requiredModule, adminOnly = false }) => {
  const { user, loading: authLoading } = useRequireAuth();
  const { userProfile, hasModuleAccess, isAdmin, loadingProfile } = useAuth();

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-primary-700">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login?error=not_found';
    }
    return null;
  }

  if (!userProfile.is_active) {
    return (
      <Layout>
        <div className="min-h-64 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Conta Inativa</h2>
            <p className="text-neutral-600">Sua conta foi desativada. Entre em contato com o administrador.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (adminOnly && !isAdmin()) {
    return (
      <Layout>
        <div className="min-h-64 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Acesso Negado</h2>
            <p className="text-neutral-600">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (requiredModule && !hasModuleAccess(requiredModule) && !isAdmin()) {
    return (
      <Layout>
        <div className="min-h-64 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Acesso Negado</h2>
            <p className="text-neutral-600">Você não tem permissão para acessar este módulo.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
};

export default ProtectedRoute;
