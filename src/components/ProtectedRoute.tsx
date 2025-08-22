import React from 'react';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useAuth } from '../contexts/AuthContext';
import Layout from './Layout';
import { AlertTriangle, Loader2, Shield } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredModule?: string;
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredModule, 
  adminOnly = false 
}) => {
  const { user, loading: authLoading } = useRequireAuth();
  const { userProfile, hasModuleAccess, isAdmin, loadingProfile } = useAuth();

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-primary-700">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // If no user after auth loading is complete, useRequireAuth will handle redirect
  if (!user) {
    return null;
  }

  // Special handling for dashboard - redirect usuarios to pessoal
  const isDashboardRoute = window.location.pathname === '/dashboard';
  if (isDashboardRoute && userProfile?.role === 'usuario') {
    window.location.href = '/pessoal';
    return null;
  }

  // Special handling for root route - redirect usuarios to pessoal
  const isRootRoute = window.location.pathname === '/';
  if (isRootRoute && userProfile?.role === 'usuario') {
    window.location.href = '/pessoal';
    return null;
  }

  // Show loading while fetching user profile
  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-primary-700">Carregando perfil do usuário...</p>
        </div>
      </div>
    );
  }

  // If no profile after loading is complete, user will be redirected by AuthContext
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Perfil não encontrado</h2>
          <p className="text-neutral-600 mb-4">
            Não foi possível carregar seu perfil. Você será redirecionado para o login.
          </p>
          <div className="text-sm text-neutral-500">
            <p>Usuário autenticado: {user.email}</p>
            <p>ID: {user.id}</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if user account is active
  if (!userProfile.is_active) {
    return (
      <Layout>
        <div className="min-h-64 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Conta Inativa</h2>
            <p className="text-neutral-600 mb-4">
              Sua conta foi desativada pelo administrador.
            </p>
            <div className="bg-neutral-50 rounded-lg p-4 text-sm text-neutral-700">
              <p><strong>Usuário:</strong> {userProfile.name}</p>
              <p><strong>Email:</strong> {userProfile.email}</p>
              <p><strong>Status:</strong> <span className="text-red-600">Inativo</span></p>
            </div>
            <p className="text-sm text-neutral-500 mt-4">
              Entre em contato com o administrador para reativar sua conta.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // Check admin-only access
  if (adminOnly && !isAdmin()) {
    return (
      <Layout>
        <div className="min-h-64 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Acesso Restrito</h2>
            <p className="text-neutral-600 mb-4">
              Esta página requer privilégios de administrador.
            </p>
            <div className="bg-neutral-50 rounded-lg p-4 text-sm text-neutral-700">
              <p><strong>Seu perfil:</strong> {userProfile.role}</p>
              <p><strong>Necessário:</strong> admin</p>
              <p><strong>Módulos disponíveis:</strong></p>
              <div className="mt-2 flex flex-wrap gap-1">
                {userProfile.modules?.map(module => (
                  <span key={module} className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs">
                    {module}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Check module access
  if (requiredModule && !hasModuleAccess(requiredModule) && !isAdmin()) {
    return (
      <Layout>
        <div className="min-h-64 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Módulo Não Autorizado</h2>
            <p className="text-neutral-600 mb-4">
              Você não tem permissão para acessar o módulo "{requiredModule}".
            </p>
            <div className="bg-neutral-50 rounded-lg p-4 text-sm text-neutral-700">
              <p><strong>Seu perfil:</strong> {userProfile.role}</p>
              <p><strong>Módulo solicitado:</strong> {requiredModule}</p>
              <p><strong>Módulos disponíveis:</strong></p>
              <div className="mt-2 flex flex-wrap gap-1">
                {userProfile.modules?.map(module => (
                  <span key={module} className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs">
                    {module}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm text-neutral-500 mt-4">
              Entre em contato com o administrador para solicitar acesso.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // All checks passed, render the protected content
  return <Layout>{children}</Layout>;
};

export default ProtectedRoute;