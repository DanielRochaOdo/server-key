import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Shield, Users, BarChart3, Key, UserCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
 <div className="hidden md:ml-10 md:flex md:space-x-8">
    <Link
      to="/dashboard"
      className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
        isActive('/dashboard')
          ? 'border-primary-500 text-primary-600'
          : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
      }`}
    >
      <BarChart3 className="h-4 w-4 mr-2" />
      Dashboard
    </Link>
    <Link
      to="/acessos"
      className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
        isActive('/acessos')
          ? 'border-primary-500 text-primary-600'
          : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
      }`}
    >
      <Key className="h-4 w-4 mr-2" />
      Acessos
    </Link>
    <Link
      to="/teams"
      className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
        isActive('/teams')
          ? 'border-primary-500 text-primary-600'
          : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
      }`}
    >
      <UserCheck className="h-4 w-4 mr-2" />
      Teams
    </Link>
    <Link
      to="/usuarios"
      className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
        isActive('/usuarios')
          ? 'border-primary-500 text-primary-600'
          : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
      }`}
    >
      <Users className="h-4 w-4 mr-2" />
      Usuários
    </Link>
  
    {/* NOVO LINK PARA WIN USERS */}
    <Link
      to="/win-users"
      className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
        isActive('/win-users')
          ? 'border-primary-500 text-primary-600'
          : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
      }`}
    >
      {/* Escolhi o ícone UserCheck, mas pode trocar para outro */}
      <UserCheck className="h-4 w-4 mr-2" />
      Win Users
    </Link>
  </div>

  );
};

export default Layout;