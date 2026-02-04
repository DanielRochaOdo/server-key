import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Network, Users, BarChart3, Key, UserCheck, Monitor, Phone, Menu, Moon, Sun, Lock, Mail, Settings, FileText, ShoppingCart, ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { normalizeRole, getRoleLabel } from '../utils/roles';

interface UserProfileExtended {
  nome?: string;
  telefone?: string;
}

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  key: 'acessos' | 'financeiro' | 'configuracoes';
  name: string;
  icon: React.ElementType;
  items: NavItem[];
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { userProfile, signOut, hasModuleAccess, isAdmin, isUsuario } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [extendedProfile, setExtendedProfile] = useState<UserProfileExtended | null>(null);
  const { theme, toggleTheme } = useTheme();
  const navRef = React.useRef<HTMLElement | null>(null);
  const sectionPaths = {
    acessos: ['/pessoal', '/acessos', '/teams', '/win-users'],
    financeiro: ['/rateio-claro', '/rateio-google', '/rateio-mkm', '/contas-a-pagar', '/pedidos-de-compra'],
    configuracoes: ['/configuracoes', '/usuarios'],
  };
  const [openSections, setOpenSections] = useState<Record<NavSection['key'], boolean>>(() => ({
    acessos: sectionPaths.acessos.includes(location.pathname),
    financeiro: sectionPaths.financeiro.includes(location.pathname),
    configuracoes: sectionPaths.configuracoes.includes(location.pathname),
  }));

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

  const closeAllSections = () => {
    setOpenSections({ acessos: false, financeiro: false, configuracoes: false });
  };

  const getSectionForPath = (path: string): NavSection['key'] | null => {
    if (sectionPaths.acessos.includes(path)) return 'acessos';
    if (sectionPaths.financeiro.includes(path)) return 'financeiro';
    if (sectionPaths.configuracoes.includes(path)) return 'configuracoes';
    return null;
  };

  React.useEffect(() => {
    const hasOpenSection = Object.values(openSections).some(Boolean);
    if (!hasOpenSection) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!navRef.current) return;
      if (navRef.current.contains(event.target as Node)) return;
      setOpenSections({ acessos: false, financeiro: false, configuracoes: false });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openSections]);

  // Get display name - use 'nome' if available, otherwise fallback to 'name'
  const getDisplayName = () => {
    return extendedProfile?.nome || userProfile?.name || '';
  };

  // Define navigation items based on user permissions
  const getNavigationItems = () => {
    const topItems: NavItem[] = [];

    // Dashboard - não disponível para usuários nível "usuario"
    if (!isUsuario()) {
      topItems.push({ name: 'Dashboard', href: '/dashboard', icon: BarChart3 });
    }

    const acessosItems: NavItem[] = [];
    if (hasModuleAccess('pessoal')) {
      acessosItems.push({ name: 'Senhas Pessoais', href: '/pessoal', icon: Lock });
    }
    if (hasModuleAccess('acessos') && !isUsuario()) {
      acessosItems.push({ name: 'Acessos', href: '/acessos', icon: Key });
    }
    if (hasModuleAccess('teams') && !isUsuario()) {
      acessosItems.push({ name: 'Contas Teams', href: '/teams', icon: UserCheck });
    }
    if (hasModuleAccess('win_users') && !isUsuario()) {
      acessosItems.push({ name: 'Usuários Windows', href: '/win-users', icon: Monitor });
    }

    const financeiroItems: NavItem[] = [];
    if (hasModuleAccess('rateio_claro')) {
      financeiroItems.push({ name: 'Rateio Claro', href: '/rateio-claro', icon: Phone });
    }
    if (hasModuleAccess('rateio_google')) {
      financeiroItems.push({ name: 'Rateio Google', href: '/rateio-google', icon: Mail });
    }
    if (isAdmin() || hasModuleAccess('rateio_mkm')) {
      financeiroItems.push({ name: 'Rateio Fatura MKM', href: '/rateio-mkm', icon: FileText });
    }
    if (isAdmin() && hasModuleAccess('contas_a_pagar')) {
      financeiroItems.push({ name: 'Contas a Pagar', href: '/contas-a-pagar', icon: FileText });
    }
    if (!isUsuario()) {
      financeiroItems.push({ name: 'Pedidos de Compra', href: '/pedidos-de-compra', icon: ShoppingCart });
    }

    const configuracoesItems: NavItem[] = [];
    configuracoesItems.push({ name: 'Configurações', href: '/configuracoes', icon: Settings });
    if (isAdmin()) {
      configuracoesItems.push({ name: 'Usuários', href: '/usuarios', icon: Users });
    }

    const sections: NavSection[] = [
      { key: 'acessos', name: 'Acessos', icon: Key, items: acessosItems },
      { key: 'financeiro', name: 'Financeiro', icon: FileText, items: financeiroItems },
      { key: 'configuracoes', name: 'Configurações', icon: Settings, items: configuracoesItems },
    ].filter((section) => section.items.length > 0);

    return { topItems, sections };
  };

  const getRoleBadge = (role: string) => {
    const normalized = normalizeRole(role);
    const badges = {
      admin: { label: 'Administrador', color: 'bg-red-100 text-red-800' },
      financeiro: { label: 'Financeiro', color: 'bg-blue-100 text-blue-800' },
      usuario: { label: 'Usuario', color: 'bg-green-100 text-green-800' },
    };

    return badges[normalized as keyof typeof badges] || {
      label: getRoleLabel(role) || 'Usuario',
      color: 'bg-green-100 text-green-800',
    };
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
            <Network className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            {!sidebarCollapsed && (
              <span className="ml-2 text-lg font-bold text-primary-800 dark:text-primary-200">Odontoart Hub</span>
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
        <nav ref={navRef} className="flex-1 py-4 space-y-2">
          {navigationItems.topItems.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={closeAllSections}
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

          {navigationItems.sections.map((section) => {
            const isSectionActive = section.items.some((item) => isActive(item.href));
            const isSectionOpen = openSections[section.key];

            return (
              <div key={section.key} className="relative space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpenSections((prev) => {
                      const shouldOpen = !prev[section.key];
                      return {
                        acessos: false,
                        financeiro: false,
                        configuracoes: false,
                        [section.key]: shouldOpen,
                      };
                    });
                  }}
                  title={section.name}
                  aria-label={section.name}
                  aria-expanded={isSectionOpen}
                  className={`
                    flex items-center w-full ${sidebarCollapsed ? 'justify-center px-2' : 'px-3'} py-2 text-sm font-medium rounded-lg transition-colors duration-200
                    ${isSectionActive
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'}
                  `}
                >
                  <section.icon className="h-5 w-5" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="ml-3 flex-1 text-left">{section.name}</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isSectionOpen ? 'rotate-180' : ''}`}
                      />
                    </>
                  )}
                </button>
                {!sidebarCollapsed && isSectionOpen && (
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={closeAllSections}
                        title={item.name}
                        aria-label={item.name}
                        className={`
                          flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors duration-200
                          ${isActive(item.href)
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'}
                        `}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="ml-3">{item.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {sidebarCollapsed && isSectionOpen && (
                  <div className="absolute left-full top-0 ml-2 z-50 min-w-[13rem] rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {section.name}
                    </div>
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={closeAllSections}
                          title={item.name}
                          aria-label={item.name}
                          className={`
                            flex items-center px-2 py-2 text-sm font-medium rounded-lg transition-colors duration-200
                            ${isActive(item.href)
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
                              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'}
                          `}
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="ml-3">{item.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <main className="flex-1 min-h-0 min-w-0 overflow-auto">
          <div className="w-full max-w-full py-4 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
