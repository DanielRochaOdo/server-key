import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Shield, Users, BarChart3, Key, UserCheck, Monitor, Phone, Menu, Moon, Sun, Lock, Mail, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

interface UserProfileExtended {
  nome?: string;
  telefone?: string;
}

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { userProfile, signOut, hasModuleAccess, isAdmin, isUsuario } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [extendedProfile, setExtendedProfile] = useState<UserProfileExtended | null>(null);
  const { theme, toggleTheme } = useTheme();

  // Fetch extended profile data to get 'nome' field
  React.useEffect(() => {
    const fetchExtendedProfile = async () => {
      if (!userProfile?.auth_uid) return;

      try {
        const { data, error } = await supabase
          .from('users')
          .select('nome, telefone')
          .eq('auth_uid', userProfile.auth_uid)
          .single();

        if (!error && data) {
          setExtendedProfile(data);
        }
      } catch (error) {
        console.error('Error fetching extended profile:', error);
      }
    };

    fetchExtendedProfile();
  }, [userProfile?.auth_uid]);

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Get display name - use 'nome' if available, otherwise fallback to 'name'
  const getDisplayName = () => {
    return extendedProfile?.nome || userProfile?.name || '';
  };

  // Define navigation items based on user permissions
  const getNavigationItems = () => {
    const items = [
    ];

    // Dashboard - não disponível para usuários nível "usuario"
    if (!isUsuario()) {
      items.push({ name: 'Dashboard', href: '/dashboard', icon: BarChart3, module: null });
    }

    // Admin can see user management
    if (isAdmin()) {
      items.push({ name: 'Usuários', href: '/usuarios', icon: Users, module: 'usuarios' });
    }
    
    // Pessoal module - only for usuario role
    if (hasModuleAccess('pessoal')) {
      items.push({ name: 'Pessoal', href: '/pessoal', icon: Lock, module: 'pessoal' });
    }
    
    // Admin and specific role modules (not for usuario role)
    if (hasModuleAccess('acessos') && !isUsuario()) {
      items.push({ name: 'Acessos', href: '/acessos', icon: Key, module: 'acessos' });
    }
    
    if (hasModuleAccess('teams') && !isUsuario()) {
      items.push({ name: 'Teams', href: '/teams', icon: UserCheck, module: 'teams' });
    }
    
    if (hasModuleAccess('win_users') && !isUsuario()) {
      items.push({ name: 'Win Users', href: '/win-users', icon: Monitor, module: 'win_users' });
    }
    
    // Financeiro role modules
    if (hasModuleAccess('rateio_claro')) {
      items.push({ name: 'Rateio Claro', href: '/rateio-claro', icon: Phone, module: 'rateio_claro' });
    }
    
    if (hasModuleAccess('rateio_google')) {
      items.push({ name: 'Rateio Google', href: '/rateio-google', icon: Mail, module: 'rateio_google' });
    }

    items.push({ name: 'Configuracoes', href: '/configuracoes', icon: Settings, module: null });

    return items;
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { label: 'Admin', color: 'bg-red-100 text-red-800' },
      financeiro: { label: 'Financeiro', color: 'bg-blue-100 text-blue-800' },
      usuario: { label: 'Usuário', color: 'bg-green-100 text-green-800' },
    };
    
    return badges[role as keyof typeof badges] || badges.usuario;
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-neutral-900 dark:to-neutral-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-primary-700">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  const navigationItems = getNavigationItems();

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-primary-50 to-primary-100 dark:from-neutral-900 dark:to-neutral-950 flex">
      {/* Sidebar */}
      <div
        className={`
          bg-white dark:bg-neutral-950 shadow-xl transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
          flex flex-col
        `}
      >
        <div className="flex items-center justify-between h-16 px-2 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center">
            <Shield className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            {!sidebarCollapsed && (
              <span className="ml-2 text-lg font-bold text-primary-800 dark:text-primary-200">ServerKey</span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-200"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1">
          {navigationItems.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              title={item.name}
              aria-label={item.name}
              className={`
                flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'px-3'} py-2 text-sm font-medium rounded-lg transition-colors duration-200
                ${isActive(item.href)
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'}
              `}
            >
              <item.icon className="h-5 w-5" />
              {!sidebarCollapsed && <span className="ml-3">{item.name}</span>}
            </Link>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 p-2">
          {!sidebarCollapsed && (
            <div className="flex items-center mb-3">
              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-600">
                  {getDisplayName()?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="ml-2 flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{getDisplayName()}</p>
                <div className="flex items-center space-x-1">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getRoleBadge(userProfile.role).color}`}>
                    {getRoleBadge(userProfile.role).label}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className={`flex ${sidebarCollapsed ? 'flex-col items-center' : 'flex-row'} gap-2`}>
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center px-2 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="sr-only">Tema</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center px-2 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto py-4 px-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
