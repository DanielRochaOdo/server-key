export type ClosedLoteEmailStatus = 'sucesso' | 'erro';

export interface ClosedLoteOpsMeta {
  ultimoExportDetalhadoEm?: string;
  ultimoExportResumidoEm?: string;
  ultimoEmailDetalhadoEm?: string;
  ultimoEmailDetalhadoPara?: string[];
  ultimoEmailStatus?: ClosedLoteEmailStatus;
  ultimoEmailErro?: string;
}

const STORAGE_KEY = 'serverkey:contas_apagar_lotes_fechados_ops';

export const loadClosedLoteOps = (): Record<string, ClosedLoteOpsMeta> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, ClosedLoteOpsMeta>;
  } catch {
    return {};
  }
};

export const saveClosedLoteOps = (value: Record<string, ClosedLoteOpsMeta>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // noop
  }
};

export const markClosedLoteDetalhadoExport = (
  current: Record<string, ClosedLoteOpsMeta>,
  loteId: string,
  timestampIso: string
): Record<string, ClosedLoteOpsMeta> => ({
  ...current,
  [loteId]: {
    ...(current[loteId] || {}),
    ultimoExportDetalhadoEm: timestampIso,
  },
});

export const markClosedLoteResumidoExport = (
  current: Record<string, ClosedLoteOpsMeta>,
  loteId: string,
  timestampIso: string
): Record<string, ClosedLoteOpsMeta> => ({
  ...current,
  [loteId]: {
    ...(current[loteId] || {}),
    ultimoExportResumidoEm: timestampIso,
  },
});

export const markClosedLoteEmailResult = (
  current: Record<string, ClosedLoteOpsMeta>,
  loteId: string,
  payload: { timestampIso: string; recipients: string[]; success: boolean; errorMessage?: string }
): Record<string, ClosedLoteOpsMeta> => ({
  ...current,
  [loteId]: {
    ...(current[loteId] || {}),
    ultimoEmailDetalhadoEm: payload.timestampIso,
    ultimoEmailDetalhadoPara: payload.recipients,
    ultimoEmailStatus: payload.success ? 'sucesso' : 'erro',
    ultimoEmailErro: payload.success ? undefined : payload.errorMessage ?? 'Falha ao enviar e-mail.',
  },
});

