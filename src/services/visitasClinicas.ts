import { supabase } from '../lib/supabase';

export type VisitaClinicaRow = {
  id: string;
  data: string;
  servico: string;
  clinica: string;
  pessoa_1: string | null;
  pessoa_2: string | null;
  pessoa_3: string | null;
  status: string;
  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type VisitaClinicaInsert = {
  data: string;
  servico: string;
  clinica: string;
  pessoa_1: string;
  pessoa_2?: string | null;
  pessoa_3?: string | null;
  status: string;
  user_id: string;
};

export type VisitaClinicaUpdate = {
  data?: string;
  servico?: string;
  clinica?: string;
  pessoa_1?: string;
  pessoa_2?: string | null;
  pessoa_3?: string | null;
  status?: string;
};

const VISITAS_SELECT =
  'id, data, servico, clinica, pessoa_1, pessoa_2, pessoa_3, status, user_id, created_at, updated_at';

export const listVisitasClinicas = async (
  startDate: string,
  endDate: string
): Promise<VisitaClinicaRow[]> => {
  const { data, error } = await supabase
    .from('visitas_clinicas')
    .select(VISITAS_SELECT)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as VisitaClinicaRow[];
};

export const createVisitaClinica = async (
  payload: VisitaClinicaInsert
): Promise<VisitaClinicaRow> => {
  const { data, error } = await supabase
    .from('visitas_clinicas')
    .insert(payload)
    .select(VISITAS_SELECT)
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error('Nao foi possivel salvar a visita.');
  }
  return data as VisitaClinicaRow;
};

export const updateVisitaClinica = async (
  id: string,
  payload: VisitaClinicaUpdate
): Promise<VisitaClinicaRow> => {
  const { data, error } = await supabase
    .from('visitas_clinicas')
    .update(payload)
    .eq('id', id)
    .select(VISITAS_SELECT)
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error('Nao foi possivel atualizar a visita.');
  }
  return data as VisitaClinicaRow;
};

export const deleteVisitaClinica = async (id: string) => {
  const { error } = await supabase.from('visitas_clinicas').delete().eq('id', id);
  if (error) throw error;
};
