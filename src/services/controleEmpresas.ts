import { supabase } from '../lib/supabase';

export type ControleEmpresaRow = {
  id: string;
  mes: string;
  empresa: string;
  quantidade: number;
  user_id?: string | null;
};

export type ControleEmpresaUpsertInput = {
  id?: string;
  mes: string;
  empresa: string;
  quantidade: number;
  user_id?: string | null;
};

export const listControleEmpresas = async (year: number): Promise<ControleEmpresaRow[]> => {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data, error } = await supabase
    .from('controle_empresas')
    .select('id, mes, empresa, quantidade, user_id')
    .gte('mes', startDate)
    .lte('mes', endDate)
    .order('mes', { ascending: true })
    .order('empresa', { ascending: true });

  if (error) throw error;

  return (data || []) as ControleEmpresaRow[];
};

export const insertControleEmpresas = async (payload: ControleEmpresaUpsertInput[]) => {
  if (payload.length === 0) return;
  const { error } = await supabase.from('controle_empresas').insert(payload);
  if (error) throw error;
};

export const upsertControleEmpresas = async (payload: ControleEmpresaUpsertInput[]) => {
  if (payload.length === 0) return;
  const { error } = await supabase
    .from('controle_empresas')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw error;
};

export const upsertControleEmpresasByUnique = async (payload: ControleEmpresaUpsertInput[]) => {
  if (payload.length === 0) return;
  const { error } = await supabase
    .from('controle_empresas')
    .upsert(payload, { onConflict: 'mes,empresa,user_id' });
  if (error) throw error;
};

export const deleteControleEmpresas = async (ids: string[]) => {
  if (ids.length === 0) return;
  const { error } = await supabase.from('controle_empresas').delete().in('id', ids);
  if (error) throw error;
};
