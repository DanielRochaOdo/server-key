import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Shield, Users, BarChart3, AlertTriangle, Key, UserCheck, Database, TrendingUp, Phone, Globe, Menu } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Usuários', href: '/usuarios', icon: Users },
    { name: 'Acessos', href: '/acessos', icon: Key },
    { name: 'Teams', href: '/teams', icon: UserCheck },
    { name: 'Win Users', href: '/win-users', icon: UserCheck },
    { name: 'Rateio Claro', href: '/rateio-claro', icon: Phone },
    { name: 'Rateio Google', href: '/rateio-google', icon: Globe },
  ];

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
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-2">
                <p className="text-sm font-medium text-neutral-900 truncate">{user?.email}</p>
                <p className="text-xs text-neutral-500">Usuário ativo</p>
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