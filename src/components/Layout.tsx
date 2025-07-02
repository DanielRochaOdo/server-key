import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Shield, Users, BarChart3, Key, UserCheck, Phone, Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: BarChart3,
    },
    {
      name: 'Acessos',
      href: '/acessos',
      icon: Key,
    },
    {
      name: 'Teams',
      href: '/teams',
      icon: UserCheck,
    },
    {
      name: 'Win Users',
      href: '/win-users',
      icon: UserCheck,
    },
    {
      name: 'Rateio Claro',
      href: '/rateio-claro',
      icon: Phone,
    },
  ];

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo and brand */}
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-neutral-200">
            <div className="flex items-center">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" />
              <span className="ml-2 text-lg sm:text-xl font-bold text-primary-800">ServerKey</span>
            </div>
            <button
              onClick={closeSidebar}
              className="lg:hidden text-neutral-400 hover:text-neutral-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 sm:px-4 py-4 sm:py-6 space-y-1 sm:space-y-2">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={closeSidebar}
                className={`
                  flex items-center px-3 sm:px-4 py-2 sm:py-3 text-sm font-medium rounded-lg transition-colors duration-200
                  ${isActive(item.href)
                    ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-500'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                  }
                `}
              >
                <item.icon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                <span className="text-sm sm:text-base">{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* User info and logout */}
          <div className="border-t border-neutral-200 p-3 sm:p-4">
            <div className="flex items-center mb-3 sm:mb-4">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-xs sm:text-sm font-medium text-primary-600">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-2 sm:ml-3 flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-neutral-500">Usuário ativo</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-button-500 transition-colors duration-200"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-white shadow-sm border-b border-neutral-200">
          <div className="flex items-center justify-between h-14 sm:h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-neutral-500 hover:text-neutral-700"
            >
              <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <div className="flex items-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
              <span className="ml-2 text-base sm:text-lg font-bold text-primary-800">ServerKey</span>
            </div>
            <div className="w-5 sm:w-6" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;