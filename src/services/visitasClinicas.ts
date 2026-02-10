import { supabase } from '../lib/supabase';

export type VisitaClinica = {
  id: string;
  data: string;
  servico: string;
  clinica: string;
  pessoa1: string | null;
  pessoa2: string | null;
  pessoa3: string | null;
  status: 'concluido' | 'pendente' | 'atrasado';
  created_at: string;
  updated_at: string;
};

export type VisitaClinicaInput = {
  data: string;
  servico: string;
  clinica: string;
  pessoa1?: string | null;
  pessoa2?: string | null;
  pessoa3?: string | null;
  status: 'concluido' | 'pendente' | 'atrasado';
};

export const listVisitasClinicas = async (startDate: string, endDate: string): Promise<VisitaClinica[]> => {
  const { data, error } = await supabase
    .from('visitas_clinicas')
    .select('id, data, servico, clinica, pessoa1, pessoa2, pessoa3, status, created_at, updated_at')
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as VisitaClinica[];
};

export const createVisitaClinica = async (payload: VisitaClinicaInput): Promise<VisitaClinica> => {
  const { data, error } = await supabase
    .from('visitas_clinicas')
    .insert({
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id, data, servico, clinica, pessoa1, pessoa2, pessoa3, status, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as VisitaClinica;
};

export const updateVisitaClinica = async (
  id: string,
  payload: Partial<VisitaClinicaInput>
): Promise<VisitaClinica> => {
  const { data, error } = await supabase
    .from('visitas_clinicas')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, data, servico, clinica, pessoa1, pessoa2, pessoa3, status, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as VisitaClinica;
};

export const deleteVisitaClinica = async (id: string) => {
  const { error } = await supabase
    .from('visitas_clinicas')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
