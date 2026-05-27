import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
const projectRef = (() => {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0] || 'local';
  } catch {
    return 'local';
  }
})();
const storageKey = `sb-${projectRef}-auth-token`;

const EDIT_DENIED_EVENT = 'serverkey:edit-permission-denied';
export const MODULE_PERMISSION_CACHE_KEY = 'serverkey:module-permissions';

const TABLE_MODULE_LABEL_MAP: Record<string, string> = {
  acessos: 'Acessos',
  pessoal: 'Senhas Pessoais',
  teams: 'Contas Teams',
  win_users: 'Usuarios Windows',
  rateio_claro: 'Rateio Claro',
  rateio_google: 'Rateio Google',
  rateio_mkm: 'Rateio Fatura MKM',
  contas_a_pagar: 'Contas a Pagar',
  contas_a_pagar_lotes: 'Contas a Pagar',
  contas_a_pagar_lote_itens: 'Contas a Pagar',
  custos_clinicas_unify: 'Custos das Clinicas',
  custos_clinicas_movements: 'Custos das Clinicas',
  custos_clinicas_carryover: 'Custos das Clinicas',
  controle_empresas: 'Controle Empresas',
  controle_uber: 'Controle Uber',
  visitas_clinicas: 'Visitas as Clinicas',
  pc_protocolos: 'Pedidos de Compra',
  pc_protocolo_itens: 'Pedidos de Compra',
  pc_mensal_itens: 'Pedidos de Compra',
  parque_itens_base: 'Parque Tecnologico',
  parque_unidades_base: 'Parque Tecnologico',
  parque_marcas_base: 'Parque Tecnologico',
  parque_produtos: 'Parque Tecnologico',
  parque_movimentacoes: 'Parque Tecnologico',
  parque_descartes: 'Parque Tecnologico',
  users: 'Usuarios',
};

const TABLE_MODULE_KEY_MAP: Record<string, string> = {
  acessos: 'acessos',
  pessoal: 'pessoal',
  teams: 'teams',
  win_users: 'win_users',
  rateio_claro: 'rateio_claro',
  rateio_google: 'rateio_google',
  rateio_mkm: 'rateio_mkm',
  contas_a_pagar: 'contas_a_pagar',
  contas_a_pagar_lotes: 'contas_a_pagar',
  contas_a_pagar_lote_itens: 'contas_a_pagar',
  custos_clinicas_unify: 'custos_clinicas',
  custos_clinicas_movements: 'custos_clinicas',
  custos_clinicas_carryover: 'custos_clinicas',
  controle_empresas: 'controle_empresas',
  controle_uber: 'controle_uber',
  visitas_clinicas: 'visitas_clinicas',
  pc_protocolos: 'pedidos_de_compra',
  pc_protocolo_itens: 'pedidos_de_compra',
  pc_mensal_itens: 'pedidos_de_compra',
  parque_itens_base: 'parque_tecnologico',
  parque_unidades_base: 'parque_tecnologico',
  parque_marcas_base: 'parque_tecnologico',
  parque_produtos: 'parque_tecnologico',
  parque_movimentacoes: 'parque_tecnologico',
  parque_descartes: 'parque_tecnologico',
  users: 'usuarios',
};

type ModulePermissionCache = {
  role?: string;
  modules?: string[];
  edit_modules?: string[];
  is_active?: boolean;
};

const getRestTableName = (value: string) => {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/rest\/v1\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

const shouldInspectWrite = (method?: string | null) => {
  const value = (method || 'GET').toUpperCase();
  return value === 'POST' || value === 'PATCH' || value === 'PUT' || value === 'DELETE';
};

const normalizeRole = (value?: string | null) => (value || '').trim().toLowerCase();

const loadModulePermissionCache = (): ModulePermissionCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MODULE_PERMISSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModulePermissionCache;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const hasCachedModuleEditAccess = (moduleKey: string): boolean => {
  const cache = loadModulePermissionCache();
  if (!cache) return false;
  if (cache.is_active !== true) return false;

  const role = normalizeRole(cache.role);
  if (role === 'owner') return true;

  const modules = Array.isArray(cache.modules) ? cache.modules : [];
  const editModules = Array.isArray(cache.edit_modules) ? cache.edit_modules : [];
  return modules.includes(moduleKey) && editModules.includes(moduleKey);
};

const dispatchEditDenied = (moduleLabel?: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(EDIT_DENIED_EVENT, {
      detail: { moduleLabel },
    })
  );
};

const wrappedFetch: typeof fetch = async (input, init) => {
  try {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const requestMethod = init?.method || (input instanceof Request ? input.method : undefined);
    const isRestRequest = requestUrl.includes('/rest/v1/');
    const isWrite = shouldInspectWrite(requestMethod);

    if (isRestRequest && isWrite) {
      const tableName = getRestTableName(requestUrl);
      if (tableName) {
        const moduleKey = TABLE_MODULE_KEY_MAP[tableName];
        if (moduleKey && !hasCachedModuleEditAccess(moduleKey)) {
          const moduleLabel = TABLE_MODULE_LABEL_MAP[tableName];
          dispatchEditDenied(moduleLabel);
          return new Response(
            JSON.stringify({
              code: 'CLIENT_EDIT_PERMISSION_DENIED',
              message: 'User does not have edit permission for this module',
            }),
            {
              status: 403,
              headers: {
                'content-type': 'application/json',
              },
            }
          );
        }
      }
    }
  } catch {
    // ignore fetch wrapper pre-check errors
  }

  const response = await fetch(input, init);

  try {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const requestMethod = init?.method || (input instanceof Request ? input.method : undefined);
    const isRestRequest = requestUrl.includes('/rest/v1/');
    const isWrite = shouldInspectWrite(requestMethod);

    if (isRestRequest && isWrite && (response.status === 401 || response.status === 403)) {
      const bodyText = await response.clone().text().catch(() => '');
      const normalized = (bodyText || '').toLowerCase();
      const permissionDenied =
        normalized.includes('row-level security') ||
        normalized.includes('permission denied') ||
        normalized.includes('insufficient_privilege') ||
        normalized.includes('violates row-level security');

      if (permissionDenied) {
        const tableName = getRestTableName(requestUrl);
        const moduleLabel = tableName ? TABLE_MODULE_LABEL_MAP[tableName] : undefined;
        dispatchEditDenied(moduleLabel);
      }
    }
  } catch {
    // ignore fetch wrapper parsing errors
  }

  return response;
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey,
    flowType: 'pkce'
  },
  global: {
    fetch: wrappedFetch,
  },
});

// Debug function to check auth state
export const debugAuthState = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
};

