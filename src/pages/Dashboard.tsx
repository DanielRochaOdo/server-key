import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Car,
  Calendar,
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
  | 'rateio_mkm'
  | 'contas_a_pagar'
  | 'controle_empresas'
  | 'controle_uber'
  | 'visitas_clinicas'
  | 'custos_clinicas'
  | 'pc_protocolos'
  | 'pc_mensal';

type ModuleGroupKey = 'acessos' | 'financeiro' | 'operacoes' | 'compras';

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
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    description: 'Sistemas e plataformas',
  },
  teams: {
    key: 'teams',
    label: 'Contas Teams',
    icon: UserCheck,
    color: 'text-sky-600',
    bgColor: 'bg-sky-100',
    description: 'Microsoft Teams',
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
    color: 'text-rose-600',
    bgColor: 'bg-rose-100',
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
  rateio_mkm: {
    key: 'rateio_mkm',
    label: 'Rateio MKM',
    icon: BarChart3,
    color: 'text-fuchsia-600',
    bgColor: 'bg-fuchsia-100',
    description: 'Fatura MKM',
  },
  contas_a_pagar: {
    key: 'contas_a_pagar',
    label: 'Contas a Pagar',
    icon: FileText,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    description: 'Documentos financeiros',
  },
  controle_empresas: {
    key: 'controle_empresas',
    label: 'Controle Empresas',
    icon: Building2,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    description: 'Volume por empresa',
  },
  controle_uber: {
    key: 'controle_uber',
    label: 'Controle Uber',
    icon: Car,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    description: 'Corridas registradas',
  },
  visitas_clinicas: {
    key: 'visitas_clinicas',
    label: 'Visitas as Clinicas',
    icon: Calendar,
    color: 'text-sky-600',
    bgColor: 'bg-sky-100',
    description: 'Agenda de visitas',
  },
  custos_clinicas: {
    key: 'custos_clinicas',
    label: 'Custos das Clinicas',
    icon: BarChart3,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
    description: 'Movimentacoes registradas',
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
  'rateio_mkm',
  'contas_a_pagar',
  'controle_empresas',
  'controle_uber',
  'visitas_clinicas',
  'custos_clinicas',
  'pc_protocolos',
  'pc_mensal',
];

const MODULE_GROUPS: Array<{
  key: ModuleGroupKey;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  gradient: string;
  modules: ModuleKey[];
}> = [
  {
    key: 'acessos',
    label: 'Acessos',
    description: 'Credenciais, contas e identidades digitais',
    icon: Key,
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-100',
    gradient: 'from-cyan-50 via-white to-sky-50',
    modules: ['pessoal', 'acessos', 'teams', 'win_users'],
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    description: 'Rateios, despesas e cobrancas',
    icon: FileText,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    gradient: 'from-emerald-50 via-white to-lime-50',
    modules: ['rateio_claro', 'rateio_google', 'rateio_mkm', 'contas_a_pagar'],
  },
  {
    key: 'operacoes',
    label: 'Operacoes',
    description: 'Rotinas de campo e controles internos',
    icon: Calendar,
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    gradient: 'from-amber-50 via-white to-orange-50',
    modules: ['controle_empresas', 'controle_uber', 'visitas_clinicas', 'custos_clinicas'],
  },
  {
    key: 'compras',
    label: 'Compras',
    description: 'Protocolos e itens consolidados',
    icon: ShoppingCart,
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    gradient: 'from-slate-50 via-white to-blue-50',
    modules: ['pc_protocolos', 'pc_mensal'],
  },
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
    rateio_mkm: 'rateio_mkm',
    contas_a_pagar: 'contas_a_pagar',
    controle_empresas: 'controle_empresas',
    controle_uber: 'controle_uber',
    visitas_clinicas: 'visitas_clinicas',
    custos_clinicas: 'custos_clinicas',
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

      if (canViewModule('rateio_mkm')) {
        tasks.push(
          fetchModule({
            key: 'rateio_mkm',
            table: 'rateio_mkm',
            select: 'id, competencia, centro_custo, qtd_de_sms, custo_sms, created_at',
            mapRow: (row) => ({
              id: row.id,
              module: 'rateio_mkm',
              title: row.competencia ? `Competencia: ${row.competencia}` : 'Rateio MKM',
              subtitle: row.centro_custo ? `Centro: ${row.centro_custo}` : undefined,
              created_at: row.created_at,
              created_by_label: 'Importacao',
            }),
            orderBy: 'created_at',
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

      if (canViewModule('controle_empresas')) {
        tasks.push(
          fetchModule({
            key: 'controle_empresas',
            table: 'controle_empresas',
            select: 'id, empresa, quantidade, mes, created_at, user_id',
            mapRow: (row) => ({
              id: row.id,
              module: 'controle_empresas',
              title: row.empresa || 'Empresa',
              subtitle: row.quantidade !== null && row.quantidade !== undefined
                ? `Qtd: ${row.quantidade}`
                : undefined,
              created_at: row.created_at || row.mes,
              created_by_id: row.user_id,
            }),
            orderBy: 'created_at',
          })
        );
      }

      if (canViewModule('controle_uber')) {
        tasks.push(
          fetchModule({
            key: 'controle_uber',
            table: 'controle_uber',
            select: 'id, destino, saida_local, valor_saida, valor_retorno, created_at, user_id, data',
            mapRow: (row) => ({
              id: row.id,
              module: 'controle_uber',
              title: row.destino || row.saida_local || 'Corrida Uber',
              subtitle: `Total: ${formatCurrency(
                Number(row.valor_saida || 0) + Number(row.valor_retorno || 0)
              )}`,
              created_at: row.created_at || row.data,
              created_by_id: row.user_id,
            }),
            orderBy: 'created_at',
          })
        );
      }

      if (canViewModule('visitas_clinicas')) {
        tasks.push(
          fetchModule({
            key: 'visitas_clinicas',
            table: 'visitas_clinicas',
            select: 'id, servico, clinica, data, created_at, user_id',
            mapRow: (row) => ({
              id: row.id,
              module: 'visitas_clinicas',
              title: row.servico || 'Visita',
              subtitle: row.clinica ? `Clinica: ${row.clinica}` : undefined,
              created_at: row.created_at || row.data,
              created_by_id: row.user_id,
            }),
            orderBy: 'created_at',
          })
        );
      }

      if (canViewModule('custos_clinicas')) {
        tasks.push(
          fetchModule({
            key: 'custos_clinicas',
            table: 'custos_clinicas_movements',
            select: 'id, product, clinic, total_cost, created_at, created_by',
            mapRow: (row) => ({
              id: row.id,
              module: 'custos_clinicas',
              title: row.product || 'Movimentacao',
              subtitle: row.clinic
                ? `Clinica: ${row.clinic} - ${formatCurrency(row.total_cost)}`
                : `Total: ${formatCurrency(row.total_cost)}`,
              created_at: row.created_at,
              created_by_id: row.created_by,
            }),
            orderBy: 'created_at',
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

  const groupedModules = useMemo(() => {
    const byKey = new Map(modules.map((module) => [module.key, module]));

    return MODULE_GROUPS.map((group) => {
      const groupModules = group.modules
        .map((key) => byKey.get(key))
        .filter((item): item is ModuleSummary => Boolean(item));

      const total = groupModules.reduce((sum, module) => sum + module.total, 0);
      const recent = groupModules
        .flatMap((module) =>
          module.recent.map((item) => ({
            ...item,
            moduleLabel: module.label,
            moduleColor: module.color,
            moduleBgColor: module.bgColor,
          }))
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6);

      return { ...group, total, modules: groupModules, recent };
    }).filter((group) => group.modules.length > 0);
  }, [modules]);

  const groupCards = useMemo(
    () =>
      groupedModules.map((group) => ({
        title: group.label,
        value: group.total,
        icon: group.icon,
        color: group.color,
        bgColor: group.bgColor,
        description: group.description,
        className:
          'bg-neutral-200/80 dark:bg-neutral-900/80 border border-white/70 dark:border-neutral-800/80 backdrop-blur-sm shadow-[0_10px_30px_rgba(15,23,42,0.08)]',
      })),
    [groupedModules]
  );

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

      <DashboardStats stats={groupCards} className="xl:grid-cols-4" />

      <div className="space-y-6">
        {groupedModules.map((group) => (
          <section
            key={group.key}
            className={`rounded-2xl border border-white/70 dark:border-neutral-800/80 bg-gradient-to-br ${group.gradient} dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${group.bgColor} dark:bg-neutral-800/70`}>
                  <group.icon className={`h-5 w-5 ${group.color} dark:text-neutral-200`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{group.label}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{group.description}</p>
                </div>
              </div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {group.modules.length} modulos
              </div>
            </div>

            <div className="mt-4">
              <DashboardStats
                stats={group.modules.map((module) => ({
                  title: module.label,
                  value: module.total,
                  icon: module.icon,
                  color: module.color,
                  bgColor: module.bgColor,
                  description: module.description,
                  className: `bg-neutral-200/80 dark:bg-neutral-900/80 border border-white/70 dark:border-neutral-800/80 backdrop-blur-sm shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:shadow-[0_16px_32px_rgba(15,23,42,0.12)] ${
                    module.key === 'contas_a_pagar'
                      ? 'min-w-[220px]'
                      : 'min-w-[286px] min-h-[170px] p-[1.25rem] sm:p-[2rem]'
                  }`,
                }))}
                layout="row"
                className="mb-2"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-xl border border-white/70 dark:border-neutral-800/80 bg-neutral-200/80 dark:bg-neutral-900/80 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Recentes
                  </p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Ultimos registros</p>
                </div>
                <div className="mt-3 space-y-3">
                  {group.recent.length > 0 ? (
                    group.recent.map((item) => (
                      <div
                        key={`${item.module}-${item.id}`}
                        className="flex flex-col gap-1 border-b border-neutral-100 dark:border-neutral-800 pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${item.moduleBgColor} ${item.moduleColor} dark:bg-neutral-800/80 dark:text-neutral-200`}
                          >
                            {item.moduleLabel}
                          </span>
                          <p className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                            {item.title}
                          </p>
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{item.subtitle}</p>
                        )}
                        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                          {formatDate(item.created_at)} · {item.created_by_label}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                      Nenhum registro encontrado
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-white/70 dark:border-neutral-800/80 bg-neutral-200/80 dark:bg-neutral-900/80 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Resumo</p>
                <div className="mt-3 space-y-3">
                  {group.modules.map((module) => (
                    <div key={module.key} className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300">
                      <span>{module.label}</span>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">{module.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
