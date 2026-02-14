import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  FileText,
  Globe,
  Key,
  Lock,
  Monitor,
  Phone,
  ShoppingCart,
  UserCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DashboardStats from '../components/DashboardStats';
import ModuleHeader from '../components/ModuleHeader';

type ModuleKey =
  | 'pessoal'
  | 'acessos'
  | 'teams'
  | 'win_users'
  | 'rateio_claro'
  | 'rateio_google'
  | 'contas_a_pagar'
  | 'pc_protocolos'
  | 'pc_mensal';

interface RecentItem {
  id: string;
  module: ModuleKey;
  title: string;
  subtitle?: string;
  created_at: string;
  created_by_id?: string | null;
  created_by_label?: string;
}

interface ModuleSummary {
  key: ModuleKey;
  label: string;
  total: number;
  recent: RecentItem[];
  icon: React.ElementType;
  color: string;
  bgColor: string;
  description?: string;
}

const MODULE_CONFIG: Record<ModuleKey, Omit<ModuleSummary, 'total' | 'recent'>> = {
  pessoal: {
    key: 'pessoal',
    label: 'Senhas Pessoais',
    icon: Lock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    description: 'Credenciais pessoais',
  },
  acessos: {
    key: 'acessos',
    label: 'Acessos',
    icon: Key,
    color: 'text-primary-600',
    bgColor: 'bg-primary-100',
    description: 'Sistemas cadastrados',
  },
  teams: {
    key: 'teams',
    label: 'Contas Teams',
    icon: UserCheck,
    color: 'text-button-600',
    bgColor: 'bg-button-100',
    description: 'Contas Microsoft Teams',
  },
  win_users: {
    key: 'win_users',
    label: 'Usuarios Windows',
    icon: Monitor,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Contas Windows',
  },
  rateio_claro: {
    key: 'rateio_claro',
    label: 'Rateio Claro',
    icon: Phone,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: 'Linhas telefonicas',
  },
  rateio_google: {
    key: 'rateio_google',
    label: 'Rateio Google',
    icon: Globe,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    description: 'Google Workspace',
  },
  contas_a_pagar: {
    key: 'contas_a_pagar',
    label: 'Contas a Pagar',
    icon: FileText,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    description: 'Documentos financeiros',
  },
  pc_protocolos: {
    key: 'pc_protocolos',
    label: 'Pedidos de Compra (Protocolos)',
    icon: ShoppingCart,
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    description: 'Protocolos abertos',
  },
  pc_mensal: {
    key: 'pc_mensal',
    label: 'Pedidos de Compra (Mensal)',
    icon: ShoppingCart,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    description: 'Itens consolidados',
  },
};

const MODULE_ORDER: ModuleKey[] = [
  'pessoal',
  'acessos',
  'teams',
  'win_users',
  'rateio_claro',
  'rateio_google',
  'contas_a_pagar',
  'pc_protocolos',
  'pc_mensal',
];

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const resolveCreatedBy = (id: string | null | undefined, map: Record<string, string>) => {
  if (!id) return 'Nao informado';
  if (map[id]) return map[id];
  return `${id.slice(0, 8)}...`;
};

const Dashboard: React.FC = () => {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userProfile, hasModuleAccess } = useAuth();

  useEffect(() => {
    if (!user || !userProfile) return;
    fetchDashboardData();
  }, [user, userProfile]);

  const MODULE_ACCESS_MAP: Record<ModuleKey, string> = {
    pessoal: 'pessoal',
    acessos: 'acessos',
    teams: 'teams',
    win_users: 'win_users',
    rateio_claro: 'rateio_claro',
    rateio_google: 'rateio_google',
    contas_a_pagar: 'contas_a_pagar',
    pc_protocolos: 'pedidos_de_compra',
    pc_mensal: 'pedidos_de_compra',
  };

  const canViewModule = (module: ModuleKey) => {
    return hasModuleAccess(MODULE_ACCESS_MAP[module]);
  };

  const fetchUsersMap = async (ids: string[]) => {
    if (!ids.length) return {} as Record<string, string>;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('auth_uid, name, email')
        .in('auth_uid', ids);

      if (error) throw error;

      const map: Record<string, string> = {};
      (data || []).forEach((row: any) => {
        if (!row?.auth_uid) return;
        map[row.auth_uid] = row.name || row.email || 'Usuario';
      });
      return map;
    } catch (error) {
      console.error('Error fetching users map:', error);
      return {} as Record<string, string>;
    }
  };

  const fetchModule = async (params: {
    key: ModuleKey;
    table: string;
    select: string;
    mapRow: (row: any) => RecentItem;
    orderBy?: string;
    limit?: number;
  }): Promise<ModuleSummary> => {
    const { key, table, select, mapRow, orderBy = 'created_at', limit = 5 } = params;
    const { data, error, count } = await supabase
      .from(table)
      .select(select, { count: 'exact' })
      .order(orderBy, { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data || []) as any[];
    return {
      ...MODULE_CONFIG[key],
      total: count ?? rows.length,
      recent: rows.map(mapRow),
    };
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const tasks: Array<Promise<ModuleSummary>> = [];

      if (canViewModule('pessoal')) {
        tasks.push(
          fetchModule({
            key: 'pessoal',
            table: 'pessoal',
            select: 'id, descricao, usuario_login, created_at, user_id',
            mapRow: (row) => ({
              id: row.id,
              module: 'pessoal',
              title: row.descricao || 'Senha pessoal',
              subtitle: row.usuario_login ? `Usuario: ${row.usuario_login}` : undefined,
              created_at: row.created_at,
              created_by_id: row.user_id,
            }),
          })
        );
      }

      if (canViewModule('acessos')) {
        tasks.push(
          fetchModule({
            key: 'acessos',
            table: 'acessos',
            select: 'id, descricao, usuario_login, created_at, user_id',
            mapRow: (row) => ({
              id: row.id,
              module: 'acessos',
              title: row.descricao || 'Acesso',
              subtitle: row.usuario_login ? `Login: ${row.usuario_login}` : undefined,
              created_at: row.created_at,
              created_by_id: row.user_id,
            }),
          })
        );
      }

      if (canViewModule('teams')) {
        tasks.push(
          fetchModule({
            key: 'teams',
            table: 'teams',
            select: 'id, usuario, login, created_at, user_id',
            mapRow: (row) => ({
              id: row.id,
              module: 'teams',
              title: row.usuario || row.login || 'Conta Teams',
              subtitle: row.login ? `Login: ${row.login}` : undefined,
              created_at: row.created_at,
              created_by_id: row.user_id,
            }),
          })
        );
      }

      if (canViewModule('win_users')) {
        tasks.push(
          fetchModule({
            key: 'win_users',
            table: 'win_users',
            select: 'id, usuario, login, created_at',
            mapRow: (row) => ({
              id: row.id,
              module: 'win_users',
              title: row.usuario || row.login || 'Usuario Windows',
              subtitle: row.login ? `Login: ${row.login}` : undefined,
              created_at: row.created_at,
              created_by_id: null,
            }),
          })
        );
      }

      if (canViewModule('rateio_claro')) {
        tasks.push(
          fetchModule({
            key: 'rateio_claro',
            table: 'rateio_claro',
            select: 'id, nome, numero_linha, created_at, user_id',
            mapRow: (row) => ({
              id: row.id,
              module: 'rateio_claro',
              title: row.nome || 'Linha Claro',
              subtitle: row.numero_linha ? `Linha: ${row.numero_linha}` : undefined,
              created_at: row.created_at,
              created_by_id: row.user_id,
            }),
          })
        );
      }

      if (canViewModule('rateio_google')) {
        tasks.push(
          fetchModule({
            key: 'rateio_google',
            table: 'google_workspace_accounts',
            select: 'id, full_name, primary_email, suspended, deleted, created_at',
            mapRow: (row) => ({
              id: row.id,
              module: 'rateio_google',
              title: row.full_name || row.primary_email || 'Conta Google',
              subtitle: row.primary_email ? `Email: ${row.primary_email}` : undefined,
              created_at: row.created_at,
              created_by_label: 'Sincronizacao',
            }),
          })
        );
      }

      if (canViewModule('contas_a_pagar')) {
        tasks.push(
          fetchModule({
            key: 'contas_a_pagar',
            table: 'contas_a_pagar',
            select: 'id, fornecedor, descricao, valor, created_at, user_id',
            mapRow: (row) => ({
              id: row.id,
              module: 'contas_a_pagar',
              title: row.fornecedor || row.descricao || 'Conta a pagar',
              subtitle: row.valor ? `Valor: ${formatCurrency(row.valor)}` : undefined,
              created_at: row.created_at,
              created_by_id: row.user_id,
            }),
          })
        );
      }

      if (canViewModule('pc_protocolos')) {
        tasks.push(
          fetchModule({
            key: 'pc_protocolos',
            table: 'pc_protocolos',
            select: 'id, titulo, nome, status, valor_final, created_at, criado_por',
            mapRow: (row) => ({
              id: row.id,
              module: 'pc_protocolos',
              title: row.titulo || row.nome || 'Protocolo',
              subtitle: row.status ? `Status: ${row.status}` : undefined,
              created_at: row.created_at,
              created_by_id: row.criado_por,
            }),
          })
        );

        tasks.push(
          fetchModule({
            key: 'pc_mensal',
            table: 'pc_mensal_itens',
            select: 'id, item, setor, status, valor_total_frete, created_at, criado_por',
            mapRow: (row) => ({
              id: row.id,
              module: 'pc_mensal',
              title: row.item || 'Item mensal',
              subtitle: [row.status, row.setor].filter(Boolean).join(' - ') || undefined,
              created_at: row.created_at,
              created_by_id: row.criado_por,
            }),
          })
        );
      }

      const results = await Promise.allSettled(tasks);
      const summaries: ModuleSummary[] = [];
      const creatorIds = new Set<string>();

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          summaries.push(result.value);
          result.value.recent.forEach((item) => {
            if (item.created_by_id) {
              creatorIds.add(item.created_by_id);
            }
          });
        } else {
          console.error('Error fetching module summary:', result.reason);
        }
      });

      const userMap = await fetchUsersMap(Array.from(creatorIds));
      const normalized = summaries.map((summary) => ({
        ...summary,
        recent: summary.recent.map((item) => ({
          ...item,
          created_by_label:
            item.created_by_label || resolveCreatedBy(item.created_by_id, userMap),
        })),
      }));

      const ordered = MODULE_ORDER
        .map((key) => normalized.find((summary) => summary.key === key))
        .filter((summary): summary is ModuleSummary => Boolean(summary));

      setModules(ordered);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalGeral = useMemo(
    () => modules.reduce((sum, module) => sum + module.total, 0),
    [modules]
  );

  const dashboardCards = useMemo(() => {
    const cards = modules.map((module) => ({
      title: module.label,
      value: module.total,
      icon: module.icon,
      color: module.color,
      bgColor: module.bgColor,
      description: module.description,
    }));

    cards.push({
      title: 'Total Geral',
      value: totalGeral,
      icon: Database,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'Registros totais',
    });

    return cards;
  }, [modules, totalGeral]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <ModuleHeader
        sectionLabel="Dashboard"
        title="Dashboard"
        subtitle="Visao geral de todos os modulos e ultimos registros"
      />

      <DashboardStats stats={dashboardCards} className="xl:grid-cols-4" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {modules.map((summary) => (
          <div key={summary.key} className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${summary.bgColor}`}>
                  <summary.icon className={`h-5 w-5 ${summary.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{summary.label}</p>
                  {summary.description && (
                    <p className="text-xs text-neutral-500">{summary.description}</p>
                  )}
                </div>
              </div>
              <span className="text-lg font-bold text-neutral-900">{summary.total}</span>
            </div>
            <div className="space-y-3">
              {summary.recent.length > 0 ? (
                summary.recent.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1 border-b border-neutral-100 pb-2 last:border-b-0 last:pb-0"
                  >
                    <p className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="text-xs text-neutral-500 truncate">{item.subtitle}</p>
                    )}
                    <p className="text-xs text-neutral-400">
                      {formatDate(item.created_at)} - Por {item.created_by_label}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs sm:text-sm text-neutral-500 text-center py-4">
                  Nenhum registro encontrado
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
