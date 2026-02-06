import { supabase } from '../lib/supabase';

export type RateioClaroPlanilhaRow = {
  numero_da_linha: string;
  nome: string;
};

export type RateioClaroSyncDiff = {
  numero_da_linha: string;
  tipo: 'CRIAR' | 'ATUALIZAR' | 'AUSENTE_NA_PLANILHA';
  planilha: { nome: string } | null;
  hub: { id: string; nome_completo: string | null; status?: string | null } | null;
};

export type RateioClaroSyncPreview = {
  diffs: RateioClaroSyncDiff[];
  summary: { criar: number; atualizar: number; ausentes: number };
  warnings?: { nomesVazios?: { line: number; numero_da_linha: string }[] };
};

export type RateioClaroSyncApplyResult = {
  inserted: number;
  updated: number;
  inactivated: number;
  keptActive: number;
  total: number;
};

export type RateioClaroSyncSelection = {
  criar?: string[];
  atualizar?: string[];
  ausentes?: string[];
  manter?: string[];
};

export type RateioClaroSyncErrorDetails = {
  duplicates?: { numero: string; lines: number[] }[];
  invalidRows?: { line: number; value: unknown }[];
  emptyNames?: { line: number; numero_da_linha: string }[];
};

export class RateioClaroSyncError extends Error {
  details?: RateioClaroSyncErrorDetails;
  constructor(message: string, details?: RateioClaroSyncErrorDetails) {
    super(message);
    this.name = 'RateioClaroSyncError';
    this.details = details;
  }
}

const getAccessToken = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = session?.access_token;
  if (!token) throw new Error('Sessao nao encontrada');
  return token;
};

const callSyncFunction = async <T>(action: 'preview' | 'apply', payload?: unknown): Promise<T> => {
  const token = await getAccessToken();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configuracao do Supabase ausente');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/rateio-claro-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      action,
      sessionToken: token,
      ...(payload ?? {}),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || 'Erro ao sincronizar';
    const details = data?.details as RateioClaroSyncErrorDetails | undefined;
    throw new RateioClaroSyncError(message, details);
  }

  return data as T;
};

export const previewRateioClaroSync = async (planilhaRows?: RateioClaroPlanilhaRow[]) => {
  if (!planilhaRows || planilhaRows.length === 0) {
    return callSyncFunction<RateioClaroSyncPreview>('preview');
  }
  return callSyncFunction<RateioClaroSyncPreview>('preview', { planilhaRows });
};

export const applyRateioClaroSync = async (
  planilhaRows: RateioClaroPlanilhaRow[] | undefined,
  options: { onMissingInSheet: 'INACTIVATE' | 'KEEP_ACTIVE' },
  selection?: RateioClaroSyncSelection
) => {
  const payload: Record<string, unknown> = { options };
  if (selection) payload.selection = selection;
  if (!planilhaRows || planilhaRows.length === 0) {
    return callSyncFunction<RateioClaroSyncApplyResult>('apply', payload);
  }
  return callSyncFunction<RateioClaroSyncApplyResult>('apply', { ...payload, planilhaRows });
};
