import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Shield, Users, BarChart3, Key, UserCheck, Database, Phone, Globe, Menu, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { userProfile, signOut, hasModuleAccess, isAdmin } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Define navigation items based on user permissions
  const getNavigationItems = () => {
    const items = [
      { name: 'Dashboard', href: '/dashboard', icon: BarChart3, module: null },
    ];

    // Admin can see user management
    if (isAdmin()) {
      items.push({ name: 'Usuários', href: '/usuarios', icon: Users, module: 'usuarios' });
    }
    
    // Usuario role modules
    if (hasModuleAccess('acessos')) {
      items.push({ name: 'Acessos', href: '/acessos', icon: Key, module: 'acessos' });
    }
    
    if (hasModuleAccess('pessoal')) {
      items.push({ name: 'Pessoal', href: '/pessoal', icon: User, module: 'pessoal' });
    }
    
    if (hasModuleAccess('teams')) {
      items.push({ name: 'Teams', href: '/teams', icon: UserCheck, module: 'teams' });
    }
    
    if (hasModuleAccess('win_users')) {
      items.push({ name: 'Win Users', href: '/win-users', icon: Database, module: 'win_users' });
    }
    
    // Financeiro role modules
    if (hasModuleAccess('rateio_claro')) {
      items.push({ name: 'Rateio Claro', href: '/rateio-claro', icon: Phone, module: 'rateio_claro' });
    }
    
    if (hasModuleAccess('rateio_google')) {
      items.push({ name: 'Rateio Google', href: '/rateio-google', icon: Globe, module: 'rateio_google' });
    }

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-primary-700">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  const navigationItems = getNavigationItems();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex">
      {/* Sidebar */}
      <div
        className={`
          bg-white shadow-xl transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
          flex flex-col
        `}
      >
        <div className="flex items-center justify-between h-16 px-2 border-b border-neutral-200">
          <div className="flex items-center">
            <Shield className="h-6 w-6 text-primary-600" />
            {!sidebarCollapsed && (
              <span className="ml-2 text-lg font-bold text-primary-800">ServerKey</span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-neutral-400 hover:text-neutral-600"
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
              className={`
                flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200
                ${isActive(item.href)
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}
              `}
            >
              <item.icon className="h-5 w-5" />
              {!sidebarCollapsed && <span className="ml-3">{item.name}</span>}
            </Link>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-neutral-200 p-2">
          {!sidebarCollapsed && (
            <div className="flex items-center mb-3">
              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-600">
                  {userProfile.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-2 flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{userProfile.name}</p>
                <div className="flex items-center space-x-1">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getRoleBadge(userProfile.role).color}`}>
                    {getRoleBadge(userProfile.role).label}
                  </span>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center px-2 py-2 border border-transparent text-xs font-medium rounded-lg text-white bg-button hover:bg-button-hover"
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span className="ml-2">Sair</span>}
          </button>
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