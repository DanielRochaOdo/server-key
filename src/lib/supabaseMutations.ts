import { supabase } from './supabase';

const noRowsAffectedError = () => new Error(
  'Nenhum registro foi alterado. Verifique se ele ainda existe e se você tem permissão de edição neste módulo.'
);

export const updateRecordById = async (
  table: string,
  id: string,
  values: Record<string, unknown>
) => {
  const { data, error } = await supabase
    .from(table)
    .update(values)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw noRowsAffectedError();
  return data;
};

export const deleteRecordById = async (table: string, id: string) => {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw noRowsAffectedError();
  return data;
};

export const deleteRecordsByIds = async (table: string, ids: string[]) => {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from(table)
    .delete()
    .in('id', ids)
    .select('id');

  if (error) throw error;
  if (!data || data.length !== ids.length) throw noRowsAffectedError();
  return data;
};
