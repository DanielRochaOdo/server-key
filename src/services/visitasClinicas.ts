<<<<<<< HEAD
import { supabase } from '../lib/supabase';

export type VisitaClinicaRow = {
=======
﻿import { supabase } from '../lib/supabase';

export type VisitaClinica = {
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
  id: string;
  data: string;
  servico: string;
  clinica: string;
<<<<<<< HEAD
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
=======
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
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
};

export const updateVisitaClinica = async (
  id: string,
<<<<<<< HEAD
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
=======
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

>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
  if (error) throw error;
};
