import { supabase } from '../lib/supabase';

export type ControleUberRow = {
  id: string;
  competencia: string;
  data: string;
  saida_hora?: string | null;
  retorno_hora?: string | null;
  valor_saida?: number | null;
  valor_retorno?: number | null;
  servico?: string | null;
  saida_local?: string | null;
  destino?: string | null;
  tipo?: string | null;
  pessoa_1?: string | null;
  pessoa_2?: string | null;
  pessoa_3?: string | null;
  user_id?: string | null;
};

export type ControleUberUpsertInput = {
  id?: string;
  competencia: string;
  data: string;
  saida_hora?: string | null;
  retorno_hora?: string | null;
  valor_saida?: number | null;
  valor_retorno?: number | null;
  servico?: string | null;
  saida_local?: string | null;
  destino?: string | null;
  tipo?: string | null;
  pessoa_1?: string | null;
  pessoa_2?: string | null;
  pessoa_3?: string | null;
  user_id?: string | null;
};

export const listCompetenciasControleUber = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('controle_uber')
    .select('competencia')
    .order('competencia', { ascending: false });

  if (error) throw error;

  const competencias = (data || [])
    .map((row: any) => row.competencia)
    .filter(Boolean);

  return Array.from(new Set(competencias));
};

export const listControleUberByCompetencia = async (
  competencia: string
): Promise<ControleUberRow[]> => {
  const { data, error } = await supabase
    .from('controle_uber')
    .select(
      'id, competencia, data, saida_hora, retorno_hora, valor_saida, valor_retorno, servico, saida_local, destino, tipo, pessoa_1, pessoa_2, pessoa_3, user_id'
    )
    .eq('competencia', competencia)
    .order('data', { ascending: true })
    .order('saida_hora', { ascending: true });

  if (error) throw error;

  return (data || []) as ControleUberRow[];
};

export const upsertControleUber = async (payload: ControleUberUpsertInput[]) => {
  if (payload.length === 0) return;
  const { error } = await supabase
    .from('controle_uber')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw error;
};

export const deleteControleUber = async (ids: string[]) => {
  if (ids.length === 0) return;
  const { error } = await supabase.from('controle_uber').delete().in('id', ids);
  if (error) throw error;
};
