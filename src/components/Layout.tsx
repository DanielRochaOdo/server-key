import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LogOut,
  Network,
  Users,
  BarChart3,
  Key,
  UserCheck,
  Monitor,
  Phone,
  Menu,
  Moon,
  Sun,
  Lock,
  Mail,
  Settings,
  FileText,
  ShoppingCart,
  ChevronDown,
  Building2,
  Car,
  Calendar,
  Database,
  Table,
  Package,
  Container,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { normalizeRole, getRoleLabel } from '../utils/roles';

interface UserProfileExtended {
  nome?: string;
  email?: string;
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
  key: 'acessos' | 'financeiro' | 'parque_tecnologico' | 'configuracoes';
  name: string;
  icon: React.ElementType;
  items: NavItem[];
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, userProfile, signOut, hasModuleAccess, isUsuario } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [extendedProfile, setExtendedProfile] = useState<UserProfileExtended | null>(null);
  const { theme, toggleTheme } = useTheme();
  const navRef = React.useRef<HTMLElement | null>(null);
  const sectionPaths = {
    acessos: ['/pessoal', '/acessos', '/teams', '/win-users'],
    financeiro: [
      '/rateio-claro',
      '/rateio-google',
      '/rateio-mkm',
      '/contas-a-pagar',
      '/pedidos-de-compra',
      '/custos-clinicas',
      '/controle-empresas',
      '/controle-uber',
      '/visitas-clinicas',
    ],
    parque_tecnologico: ['/parque-tecnologico/estoque', '/parque-tecnologico/inventario'],
    configuracoes: ['/configuracoes', '/usuarios'],
  };
  const [openSections, setOpenSections] = useState<Record<NavSection['key'], boolean>>(() => ({
    acessos: false,
    financeiro: false,
    parque_tecnologico: false,
    configuracoes: false,
  }));

  // Fetch extended profile data to get 'nome' field
  React.useEffect(() => {
    const fetchExtendedProfile = async () => {
      if (!userProfile?.auth_uid) return;

      try {
        const { data, error } = await supabase
          .from('users')
          .select('nome, email')
          .eq('auth_uid', userProfile.auth_uid)
          .single();

        if (!error && data) {
          setExtendedProfile({
            nome: typeof data.nome === 'string' ? data.nome : undefined,
            email: typeof data.email === 'string' ? data.email : undefined,
          });
        } else if (error) {
          console.error('Error fetching extended profile:', error);
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
    setOpenSections({ acessos: false, financeiro: false, parque_tecnologico: false, configuracoes: false });
  };

  React.useEffect(() => {
    const hasOpenSection = Object.values(openSections).some(Boolean);
    if (!hasOpenSection) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!navRef.current) return;
      if (navRef.current.contains(event.target as Node)) return;
      setOpenSections({ acessos: false, financeiro: false, parque_tecnologico: false, configuracoes: false });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openSections]);

  // Get display name - use 'nome' if available, otherwise fallback to 'name'
  const getEmailPrefix = (value?: string | null) => {
    const safe = (value ?? '').trim();
    if (!safe) return '';
    const atIndex = safe.indexOf('@');
    return atIndex > 0 ? safe.slice(0, atIndex) : safe;
  };

  const getDisplayName = () => {
    const nome = (extendedProfile?.nome ?? '').trim();
    if (nome) return nome;
    const emailSource = (extendedProfile?.email || userProfile?.email || user?.email || '').trim();
    const emailPrefix = getEmailPrefix(emailSource);
    if (emailPrefix) return emailPrefix;
    return (userProfile?.name ?? '').trim();
  };

  // Define navigation items based on user permissions
  const getNavigationItems = () => {
    const topItems: NavItem[] = [];

    // Dashboard - nÃ£o disponÃ­vel para usuÃ¡rios nÃ­vel "usuario"
    if (!isUsuario()) {
      topItems.push({ name: 'Dashboard', href: '/dashboard', icon: BarChart3 });
    }

    const acessosItems: NavItem[] = [];
    if (hasModuleAccess('pessoal')) {
      acessosItems.push({ name: 'Senhas Pessoais', href: '/pessoal', icon: Lock });
    }
    if (hasModuleAccess('acessos')) {
      acessosItems.push({ name: 'Acessos', href: '/acessos', icon: Key });
    }
    if (hasModuleAccess('teams')) {
      acessosItems.push({ name: 'Contas Teams', href: '/teams', icon: UserCheck });
    }
    if (hasModuleAccess('win_users')) {
      acessosItems.push({ name: 'UsuÃ¡rios Windows', href: '/win-users', icon: Monitor });
    }

    const financeiroItems: NavItem[] = [];
    if (hasModuleAccess('rateio_claro')) {
      financeiroItems.push({ name: 'Rateio Claro', href: '/rateio-claro', icon: Phone });
    }
    if (hasModuleAccess('rateio_google')) {
      financeiroItems.push({ name: 'Rateio Google', href: '/rateio-google', icon: Mail });
    }
    if (hasModuleAccess('rateio_mkm')) {
      financeiroItems.push({ name: 'Rateio Fatura MKM', href: '/rateio-mkm', icon: FileText });
    }
    if (hasModuleAccess('controle_empresas')) {
      financeiroItems.push({ name: 'Controle Empresas', href: '/controle-empresas', icon: Building2 });
    }
    if (hasModuleAccess('controle_uber')) {
      financeiroItems.push({ name: 'Controle Uber', href: '/controle-uber', icon: Car });
    }
    if (hasModuleAccess('visitas_clinicas')) {
      financeiroItems.push({ name: 'Visitas as Clinicas', href: '/visitas-clinicas', icon: Calendar });
    }
    if (hasModuleAccess('contas_a_pagar')) {
      financeiroItems.push({ name: 'Contas a Pagar', href: '/contas-a-pagar', icon: FileText });
    }
    if (hasModuleAccess('custos_clinicas')) {
      financeiroItems.push({ name: 'Custos das Clinicas', href: '/custos-clinicas', icon: BarChart3 });
    }
    if (hasModuleAccess('pedidos_de_compra')) {
      financeiroItems.push({ name: 'Pedidos de Compra', href: '/pedidos-de-compra', icon: ShoppingCart });
    }

    const parqueTecnologicoItems: NavItem[] = [];
    if (hasModuleAccess('parque_tecnologico')) {
      parqueTecnologicoItems.push({ name: 'Estoque', href: '/parque-tecnologico/estoque', icon: Container });
      parqueTecnologicoItems.push({ name: 'Inventario', href: '/parque-tecnologico/inventario', icon: Table });
    }

    const configuracoesItems: NavItem[] = [];
    configuracoesItems.push({ name: 'ConfiguraÃ§Ãµes', href: '/configuracoes', icon: Settings });
    if (hasModuleAccess('usuarios')) {
      configuracoesItems.push({ name: 'UsuÃ¡rios', href: '/usuarios', icon: Users });
    }

    const sections: NavSection[] = [
      { key: 'acessos', name: 'Acessos', icon: Key, items: acessosItems },
      { key: 'financeiro', name: 'Financeiro', icon: FileText, items: financeiroItems },
      { key: 'parque_tecnologico', name: 'Parque Tecnologico', icon: Package, items: parqueTecnologicoItems },
      { key: 'configuracoes', name: 'ConfiguraÃ§Ãµes', icon: Settings, items: configuracoesItems },
    ].filter((section) => section.items.length > 0);

    return { topItems, sections };
  };

  const getRoleBadge = (role: string) => {
    const normalized = normalizeRole(role);
    const badges = {
      admin: { label: 'Administrador', color: 'bg-red-100 text-red-800' },
      owner: { label: 'Owner', color: 'bg-amber-100 text-amber-800' },
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
      <div className="min-h-screen flex items-center justify-center app-shell">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-primary-700">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  const navigationItems = getNavigationItems();
  const navItemBase = `group relative flex items-center ${
    sidebarCollapsed ? 'justify-center w-11 h-11 mx-auto' : 'px-3 py-2.5 w-full'
  } text-sm font-medium rounded-xl transition-all duration-200`;
  const navItemBaseExpanded =
    'group relative flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200';
  const navItemActive =
    'bg-primary-50 text-primary-800 shadow-sm dark:bg-primary-900/30 dark:text-primary-100 before:absolute before:left-1 before:top-1 before:bottom-1 before:w-1 before:rounded-full before:bg-primary-500';
  const navItemInactive =
    'text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/60 dark:hover:text-white';

  return (
    <div className="app-shell h-screen overflow-hidden flex">
      {/* Sidebar */}
      <div
        className={`
          relative z-30 flex flex-col transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
          border-r border-neutral-200/70 dark:border-neutral-800/70 bg-white/75 dark:bg-neutral-950/80 backdrop-blur-xl shadow-card
        `}
      >
        <div
          className={`h-16 px-3 border-b border-neutral-200/70 dark:border-neutral-800/70 ${
            sidebarCollapsed ? 'flex flex-col items-center justify-center gap-1.5' : 'flex items-center justify-between'
          }`}
        >
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'}`}>
            <Network className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            {!sidebarCollapsed && (
              <span className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                Odontoart Hub
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/80 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/60 transition-colors ${
              sidebarCollapsed ? 'p-1' : 'p-1.5'
            }`}
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
                ${navItemBase}
                ${isActive(item.href) ? navItemActive : navItemInactive}
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
                        parque_tecnologico: false,
                        configuracoes: false,
                        [section.key]: shouldOpen,
                      };
                    });
                  }}
                  title={section.name}
                  aria-label={section.name}
                  aria-expanded={isSectionOpen}
                  className={`
                    ${navItemBase}
                    ${isSectionActive ? navItemActive : navItemInactive}
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
                  <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1 no-scrollbar">
                    {section.items.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={closeAllSections}
                        title={item.name}
                        aria-label={item.name}
                        className={`
                          relative flex items-center px-3 py-2.5 pl-10 text-sm font-medium rounded-xl transition-all duration-200
                          ${isActive(item.href) ? navItemActive : navItemInactive}
                        `}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="ml-3">{item.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {sidebarCollapsed && isSectionOpen && (
                  <div className="absolute left-full top-0 ml-2 z-50 min-w-[13rem] max-h-[70vh] overflow-y-auto rounded-xl border border-neutral-200 bg-white/90 p-2 shadow-card dark:border-neutral-800 dark:bg-neutral-950/90 backdrop-blur no-scrollbar">
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
                            ${navItemBaseExpanded}
                            ${isActive(item.href) ? navItemActive : navItemInactive}
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
        <div className="border-t border-neutral-200/70 dark:border-neutral-800/70 p-3">
          {!sidebarCollapsed && (
            <div className="flex items-center mb-3">
              <div className="h-9 w-9 rounded-full bg-primary-100/80 dark:bg-primary-900/40 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary-700 dark:text-primary-200">
                  {getDisplayName()?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="ml-2 flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{getDisplayName()}</p>
                <div className="flex items-center space-x-1">
                  <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-full ${getRoleBadge(userProfile.role).color}`}>
                    {getRoleBadge(userProfile.role).label}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className={`flex ${sidebarCollapsed ? 'flex-col items-center' : 'flex-row'} gap-2`}>
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center px-2 py-2 border border-neutral-200/80 dark:border-neutral-800/80 rounded-lg text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/60 dark:hover:text-white transition-colors"
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="sr-only">Tema</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center px-2 py-2 border border-neutral-200/80 dark:border-neutral-800/80 rounded-lg text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/60 dark:hover:text-white transition-colors"
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
      <div className="relative z-0 flex-1 flex flex-col min-h-0 min-w-0">
        <main className="flex-1 min-h-0 min-w-0 overflow-auto">
          <div className="w-full max-w-full py-6 px-4 sm:px-6 lg:px-10">
            <div className="page-animate module-reference max-w-screen-2xl w-full mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;




