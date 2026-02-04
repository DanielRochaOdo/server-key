import { supabase } from '../lib/supabase';

export type RateioMkmLayoutRow = {
  'Centro de custo': string;
  'QTD SMS/WABA ENVIADOS a 0,045': number;
  'CUSTOS SMS 0,045/WABA(0,30 E 0,55)': number;
  'OBS': string | null;
};

export type RateioMkmCentroCusto = {
  id: number;
  nome: string;
};

export type RateioMkmUpsertInput = {
  competencia: string;
  centro_custo: number;
  qtd_de_sms: number;
  custo_sms: number;
  obs?: string | null;
};

export const listCompetenciasRateioMkm = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('rateio_mkm')
    .select('competencia')
    .order('competencia', { ascending: false });

  if (error) throw error;

  const competencias = (data || [])
    .map((row: any) => row.competencia)
    .filter(Boolean);

  return Array.from(new Set(competencias));
};

export const listCentrosCustoMkm = async (): Promise<RateioMkmCentroCusto[]> => {
  const { data, error } = await supabase
    .from('centros_custo_mkm')
    .select('id, nome')
    .order('id', { ascending: true });

  if (error) throw error;

  return (data || []) as RateioMkmCentroCusto[];
};

export const seedCentrosCustoMkm = async () => {
  const { error } = await supabase
    .from('centros_custo_mkm')
    .upsert(
      [
        { id: 1, nome: 'COMERCIAL' },
        { id: 2, nome: 'ADMINISTRATIVO' },
        { id: 3, nome: 'COBRANCA' },
        { id: 4, nome: 'CALL CENTER (MARCACAO)' },
      ],
      { onConflict: 'id' }
    );

  if (error) throw error;
};

export const getRateioMkmLayout = async (competencia: string): Promise<RateioMkmLayoutRow[]> => {
  const { data, error } = await supabase.rpc('get_rateio_mkm_layout', {
    p_competencia: competencia,
  });

  if (error) throw error;

  return (data || []) as RateioMkmLayoutRow[];
};

export const upsertRateioMkmLinhas = async (payload: RateioMkmUpsertInput[]) => {
  const { error } = await supabase
    .from('rateio_mkm')
    .upsert(payload, { onConflict: 'competencia,centro_custo' });

  if (error) throw error;
};
