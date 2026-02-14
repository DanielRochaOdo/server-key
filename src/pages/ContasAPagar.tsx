import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Plus, Upload, Download, Search, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle, Ban, ExternalLink, Mail } from 'lucide-react';
import ContasAPagarForm from '../components/ContasAPagarForm';
import ContasAPagarFileUpload from '../components/ContasAPagarFileUpload';
import DashboardStats from '../components/DashboardStats';
import PasswordVerificationModal from '../components/PasswordVerificationModal';
import { supabase } from '../lib/supabase';
import { usePersistence } from '../contexts/PersistenceContext';
import * as XLSX from 'xlsx-js-style/dist/xlsx.bundle.js';

type ContaTipo = 'fixa' | 'avulsa' | 'ressarcimento';
type LoteOrigem = ContaTipo | 'misto';
type ActiveTab = ContaTipo | 'lotes' | 'lotes_fechados';

type LoteRowDetalhado = {
  id: string;
  contaId?: string;
  fornecedor: string;
  valor: string;
  vencimento: string;
  pagamento: string;
  empresa: string;
  descricao: string;
  notaFiscal: string;
  setorResponsavel: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  cpfCnpj: string;
  anexos: string;
  tipoRegistro?: ContaTipo;
};

type LoteRowResumido = {
  id: string;
  contaId?: string;
  fornecedor: string;
  valor: string;
  vencimento: string;
  descricao: string;
  notaFiscal: string;
  tipoRegistro?: ContaTipo;
};

interface LoteRegistro {
  id: string;
  nome: string;
  resumido?: boolean;
  detalhado?: boolean;
  fechado?: boolean;
  total: number;
  origem: LoteOrigem;
  fixasTotal?: number;
  avulsasTotal?: number;
  ressarcimentoTotal?: number;
  criado_em: string;
  resumidoRows?: LoteRowResumido[];
  detalhadoRows?: LoteRowDetalhado[];
}

interface ContaAPagar {
  id: string;
  status_documento: string | null;
  tipo_pagto: string | null;
  fornecedor: string | null;
  link?: string | null;
  descricao: string | null;
  valor: string | number | null;
  vencimento?: number | null;
  observacoes?: string | null;
  tipo_conta?: ContaTipo | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  'Nao emitido',
  'Emitido pendente assinatura',
  'Enviado financeiro'
];

const PAGTO_OPTIONS = [
  'BOLETO',
  'CARTAO',
  'PIX',
  'TRANSFERENCIA',
];

const XLSX_EXPORT_HEADERS = [
  'FORNECEDOR',
  'VALOR',
  'VENCIMENTO',
  'PAGAMENTO',
  'EMPRESA',
  'DESCRIÇÃO',
  'NOTA FISCAL',
  'SETOR RESPONSÁVEL',
  'NOME DO BANCO',
  'AGÊNCIA',
  'CONTA',
  'TIPO DE CONTA',
  'CPF/CNPJ',
  'Anexos (Sim/Não)',
];

const textDecoder = new TextDecoder('utf-8');

const decodeLatin1String = (value: string) => {
  try {
    const bytes = Uint8Array.from([...value].map((char) => char.charCodeAt(0)));
    return textDecoder.decode(bytes);
  } catch {
    return value;
  }
};

const decodeLatin1IfNeeded = (value?: string | null): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const decoded = decodeLatin1String(value);
  if (decoded !== value && !decoded.includes('\uFFFD')) {
    return decoded;
  }
  return value;
};

const normalizeEntryFieldValue = (value?: string) => {
  if (value === undefined) return undefined;
  return decodeLatin1IfNeeded(value) ?? value;
};

const normalizeExportEntry = (entry?: ExportEntry) => {
  if (!entry) return undefined;
  const normalized: ExportEntry = {};
  EXPORT_ENTRY_FIELDS.forEach((field) => {
    const value = entry[field];
    if (value !== undefined) {
      normalized[field] = normalizeEntryFieldValue(value);
    }
  });
  return normalized;
};

const normalizeEntriesMap = (entries: Record<string, ExportEntry>) => {
  const normalizedEntries: Record<string, ExportEntry> = {};
  Object.entries(entries).forEach(([id, entry]) => {
    const normalized = normalizeExportEntry(entry);
    if (normalized) {
      normalizedEntries[id] = normalized;
    }
  });
  return normalizedEntries;
};




type ExportFormat = 'csv' | 'xlsx' | 'template' | 'xlsx_resumido';

type ExportEntryField =
  | 'fornecedor'
  | 'vencimento'
  | 'pagamento'
  | 'empresa'
  | 'descricao'
  | 'notaFiscal'
  | 'setorResponsavel'
  | 'banco'
  | 'agencia'
  | 'conta'
  | 'tipoConta'
  | 'cpfCnpj'
  | 'anexos';

type ExportEntry = Partial<Record<ExportEntryField, string>>;

const EXPORT_ENTRY_FIELDS: ExportEntryField[] = [
  'fornecedor',
  'vencimento',
  'pagamento',
  'empresa',
  'descricao',
  'notaFiscal',
  'setorResponsavel',
  'banco',
  'agencia',
  'conta',
  'tipoConta',
  'cpfCnpj',
  'anexos',
];

const EXPORT_TABLE_COLUMNS: {
  label: string;
  field?: ExportEntryField;
  type?: 'text' | 'date';
  readonly?: boolean;
  align?: 'left' | 'center' | 'right';
}[] = [
  { label: 'FORNECEDOR', field: 'fornecedor', align: 'left' },
  { label: 'VALOR', readonly: true, align: 'right' },
  { label: 'VENCIMENTO', field: 'vencimento', type: 'date', align: 'center' },
  { label: 'PAGAMENTO', field: 'pagamento', align: 'center' },
  { label: 'EMPRESA', field: 'empresa', align: 'left' },
  { label: 'DESCRIÇÃO', field: 'descricao', align: 'left' },
  { label: 'NOTA FISCAL', field: 'notaFiscal', align: 'left' },
  { label: 'SETOR RESPONSÁVEL', field: 'setorResponsavel', align: 'left' },
  { label: 'NOME DO BANCO', field: 'banco', align: 'left' },
  { label: 'AGÊNCIA', field: 'agencia', align: 'left' },
  { label: 'CONTA', field: 'conta', align: 'left' },
  { label: 'TIPO DE CONTA', field: 'tipoConta', align: 'left' },
  { label: 'CPF/CNPJ', field: 'cpfCnpj', align: 'left' },
  { label: 'ANEXOS (SIM/NÃO)', field: 'anexos', align: 'center' },
];



const LOTE_DETALHADO_COLUMNS: {
  label: string;
  field: keyof LoteRowDetalhado;
  type?: 'text' | 'date';
  readonly?: boolean;
  align?: 'left' | 'center' | 'right';
}[] = [
  { label: 'FORNECEDOR', field: 'fornecedor', align: 'left' },
  { label: 'VALOR', field: 'valor', align: 'right' },
  { label: 'VENCIMENTO', field: 'vencimento', type: 'date', align: 'center' },
  { label: 'PAGAMENTO', field: 'pagamento', align: 'center' },
  { label: 'EMPRESA', field: 'empresa', align: 'left' },
  { label: 'DESCRIÇÃO', field: 'descricao', align: 'left' },
  { label: 'NOTA FISCAL', field: 'notaFiscal', align: 'left' },
  { label: 'SETOR RESPONSÁVEL', field: 'setorResponsavel', align: 'left' },
  { label: 'NOME DO BANCO', field: 'banco', align: 'left' },
  { label: 'AGÊNCIA', field: 'agencia', align: 'left' },
  { label: 'CONTA', field: 'conta', align: 'left' },
  { label: 'TIPO DE CONTA', field: 'tipoConta', align: 'left' },
  { label: 'CPF/CNPJ', field: 'cpfCnpj', align: 'left' },
  { label: 'ANEXOS (SIM/NÃO)', field: 'anexos', align: 'center' },
];

const LOTE_RESUMIDO_COLUMNS: {
  label: string;
  field: keyof LoteRowResumido;
  type?: 'text' | 'date';
  readonly?: boolean;
  align?: 'left' | 'center' | 'right';
}[] = [
  { label: 'FORNECEDOR', field: 'fornecedor', align: 'left' },
  { label: 'VALOR', field: 'valor', align: 'right' },
  { label: 'VENCIMENTO', field: 'vencimento', type: 'date', align: 'center' },
  { label: 'DESCRIÇÃO', field: 'descricao', align: 'left' },
  { label: 'NF', field: 'notaFiscal', align: 'left' },
];

const EXPORT_MODAL_STORAGE_KEY = 'serverkey:contas_apagar_export_state';
const EMAIL_RECIPIENTS_STORAGE_KEY = 'serverkey:contas_apagar_email_recipients';
const LOTES_STORAGE_KEY = 'serverkey:contas_apagar_lotes';
const MONTH_CLOSE_STORAGE_KEY = 'serverkey:contas_apagar_last_closed_month';
const CONSOLIDADO_FEVEREIRO_2026 = 'LOTE CONSOLIDADO FEVEREIRO/2026';
const DEFAULT_EMAIL_RECIPIENTS = ['daniel.rocha@odontoart.com'];

interface ExportModalState {
  showExportNfModal: boolean;
  exportEntries: Record<string, ExportEntry>;
}

const DEFAULT_EXPORT_MODAL_STATE: ExportModalState = {
  showExportNfModal: false,
  exportEntries: {},
};

const loadEmailRecipients = (): string[] => {
  if (typeof window === 'undefined') return [];
  const normalize = (value: string) => value.trim().toLowerCase();
  const defaultRecipients = DEFAULT_EMAIL_RECIPIENTS
    .map((value) => (typeof value === 'string' ? normalize(value) : ''))
    .filter((value) => value.length > 0);
  try {
    const raw = localStorage.getItem(EMAIL_RECIPIENTS_STORAGE_KEY);
    if (!raw) return Array.from(new Set(defaultRecipients));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((value) => (typeof value === 'string' ? normalize(value) : ''))
      .filter((value) => value.length > 0);
    return Array.from(new Set([...defaultRecipients, ...normalized]));
  } catch {
    return Array.from(new Set(defaultRecipients));
  }
};

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeLoteNome = (value: string) => {
  return value.replace(/\s*\(resumido\)\s*$/i, '').trim();
};

const extractUuidFromString = (value?: string) => {
  if (!value) return undefined;
  const matches = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
  if (!matches || matches.length === 0) return undefined;
  return matches[matches.length - 1];
};

const getMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const loadLotes = (): LoteRegistro[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const map = new Map<string, LoteRegistro>();
    parsed
      .filter((item) => item && typeof item === 'object')
      .filter((item) => {
        const nome = typeof item.nome === 'string' ? item.nome : '';
        return nome !== CONSOLIDADO_FEVEREIRO_2026;
      })
      .forEach((item) => {
        const nomeRaw = typeof item.nome === 'string' ? item.nome : 'Lote';
        const nome = normalizeLoteNome(nomeRaw);
        const origem: LoteOrigem = item.origem === 'avulsa'
          ? 'avulsa'
          : item.origem === 'ressarcimento'
            ? 'ressarcimento'
            : item.origem === 'misto'
              ? 'misto'
              : 'fixa';
        const total = Number.isFinite(Number(item.total)) ? Number(item.total) : 0;
        const fechado = item.fechado === true;
        const fixasTotalRaw = Number.isFinite(Number(item.fixasTotal)) ? Number(item.fixasTotal) : null;
        const avulsasTotalRaw = Number.isFinite(Number(item.avulsasTotal)) ? Number(item.avulsasTotal) : null;
        const ressarcimentoTotalRaw = Number.isFinite(Number(item.ressarcimentoTotal)) ? Number(item.ressarcimentoTotal) : null;
        const fixasTotal = fixasTotalRaw !== null
          ? fixasTotalRaw
          : origem === 'fixa'
            ? total
            : 0;
        const avulsasTotal = avulsasTotalRaw !== null
          ? avulsasTotalRaw
          : origem === 'avulsa'
            ? total
            : 0;
        const ressarcimentoTotal = ressarcimentoTotalRaw !== null
          ? ressarcimentoTotalRaw
          : origem === 'ressarcimento'
            ? total
            : 0;
        const criadoEm = typeof item.criado_em === 'string' ? item.criado_em : new Date().toISOString();
        const isLegacy = 'tipo' in item && !('resumido' in item) && !('detalhado' in item) && !('resumidoRows' in item) && !('detalhadoRows' in item);
        const key = isLegacy
          ? `${nome}::${origem}::${total}`
          : (typeof item.id === 'string' ? item.id : createId());

        const resumidoRows = Array.isArray(item.resumidoRows)
          ? item.resumidoRows
            .filter((row: any) => row && typeof row === 'object')
            .map((row: any) => ({
              id: typeof row.id === 'string' ? row.id : createId(),
              contaId: typeof row.contaId === 'string'
                ? row.contaId
                : extractUuidFromString(typeof row.id === 'string' ? row.id : undefined),
              fornecedor: typeof row.fornecedor === 'string' ? row.fornecedor : '',
              valor: typeof row.valor === 'string' ? row.valor : '',
              vencimento: typeof row.vencimento === 'string' ? row.vencimento : '',
              descricao: typeof row.descricao === 'string' ? row.descricao : '',
              notaFiscal: typeof row.notaFiscal === 'string' ? row.notaFiscal : '',
              tipoRegistro: row.tipoRegistro === 'avulsa'
                ? 'avulsa'
                : row.tipoRegistro === 'ressarcimento'
                  ? 'ressarcimento'
                  : row.tipoRegistro === 'fixa'
                    ? 'fixa'
                    : origem === 'avulsa'
                      ? 'avulsa'
                      : origem === 'ressarcimento'
                        ? 'ressarcimento'
                        : origem === 'fixa'
                          ? 'fixa'
                          : undefined,
            }))
          : undefined;

        const detalhadoRows = Array.isArray(item.detalhadoRows)
          ? item.detalhadoRows
            .filter((row: any) => row && typeof row === 'object')
            .map((row: any) => ({
              id: typeof row.id === 'string' ? row.id : createId(),
              contaId: typeof row.contaId === 'string'
                ? row.contaId
                : extractUuidFromString(typeof row.id === 'string' ? row.id : undefined),
              fornecedor: typeof row.fornecedor === 'string' ? row.fornecedor : '',
              valor: typeof row.valor === 'string' ? row.valor : '',
              vencimento: typeof row.vencimento === 'string' ? row.vencimento : '',
              pagamento: typeof row.pagamento === 'string' ? row.pagamento : '',
              empresa: typeof row.empresa === 'string' ? row.empresa : '',
              descricao: typeof row.descricao === 'string' ? row.descricao : '',
              notaFiscal: typeof row.notaFiscal === 'string' ? row.notaFiscal : '',
              setorResponsavel: typeof row.setorResponsavel === 'string' ? row.setorResponsavel : '',
              banco: typeof row.banco === 'string' ? row.banco : '',
              agencia: typeof row.agencia === 'string' ? row.agencia : '',
              conta: typeof row.conta === 'string' ? row.conta : '',
              tipoConta: typeof row.tipoConta === 'string' ? row.tipoConta : '',
              cpfCnpj: typeof row.cpfCnpj === 'string' ? row.cpfCnpj : '',
              anexos: typeof row.anexos === 'string' ? row.anexos : '',
              tipoRegistro: row.tipoRegistro === 'avulsa'
                ? 'avulsa'
                : row.tipoRegistro === 'ressarcimento'
                  ? 'ressarcimento'
                  : row.tipoRegistro === 'fixa'
                    ? 'fixa'
                    : origem === 'avulsa'
                      ? 'avulsa'
                      : origem === 'ressarcimento'
                        ? 'ressarcimento'
                        : origem === 'fixa'
                          ? 'fixa'
                          : undefined,
            }))
          : undefined;

        const existing = map.get(key);
        const merged: LoteRegistro = existing ?? {
          id: typeof item.id === 'string' ? item.id : createId(),
          nome,
          total,
          origem,
          criado_em: criadoEm,
          fechado,
          fixasTotal,
          avulsasTotal,
          ressarcimentoTotal,
          resumido: false,
          detalhado: false,
          resumidoRows,
          detalhadoRows,
        };

        if ('tipo' in item) {
          if (item.tipo === 'resumido') merged.resumido = true;
          if (item.tipo === 'detalhado') merged.detalhado = true;
        }
        if (item.resumido) merged.resumido = true;
        if (item.detalhado) merged.detalhado = true;
        if (resumidoRows && resumidoRows.length) merged.resumido = true;
        if (detalhadoRows && detalhadoRows.length) merged.detalhado = true;

        if (resumidoRows) merged.resumidoRows = resumidoRows;
        if (detalhadoRows) merged.detalhadoRows = detalhadoRows;
        if (fechado) merged.fechado = true;
        if (merged.fechado === undefined) merged.fechado = false;
        if (fixasTotal !== null) {
          merged.fixasTotal = Math.max(merged.fixasTotal ?? 0, fixasTotal);
        }
        if (avulsasTotal !== null) {
          merged.avulsasTotal = Math.max(merged.avulsasTotal ?? 0, avulsasTotal);
        }
        if (ressarcimentoTotal !== null) {
          merged.ressarcimentoTotal = Math.max(merged.ressarcimentoTotal ?? 0, ressarcimentoTotal);
        }

        if (criadoEm < merged.criado_em) {
          merged.criado_em = criadoEm;
        }

        map.set(key, merged);
      });

    return Array.from(map.values()).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  } catch {
    return [];
  }
};
const loadExportModalState = (): ExportModalState => {
  if (typeof window === 'undefined') return DEFAULT_EXPORT_MODAL_STATE;
  try {
    const raw = localStorage.getItem(EXPORT_MODAL_STORAGE_KEY);
    if (!raw) return DEFAULT_EXPORT_MODAL_STATE;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_EXPORT_MODAL_STATE;

    let storedEntries: Record<string, ExportEntry> = {};
    if (parsed.exportEntries && typeof parsed.exportEntries === 'object' && !Array.isArray(parsed.exportEntries)) {
      storedEntries = { ...parsed.exportEntries };
    } else if (parsed.nfEntries && typeof parsed.nfEntries === 'object' && !Array.isArray(parsed.nfEntries)) {
      storedEntries = Object.entries(parsed.nfEntries).reduce<Record<string, ExportEntry>>((acc, [id, value]) => {
        acc[id] = { notaFiscal: typeof value === 'string' ? value : '' };
        return acc;
      }, {});
    }

    const sanitizedEntries = normalizeEntriesMap(storedEntries);
    return {
      showExportNfModal: parsed.showExportNfModal ?? DEFAULT_EXPORT_MODAL_STATE.showExportNfModal,
      exportEntries: sanitizedEntries,
    };
  } catch (error) {
    console.error('Erro ao carregar estado do export modal:', error);
    return DEFAULT_EXPORT_MODAL_STATE;
  }
};

const ContasAPagar: React.FC = () => {
  const [contas, setContas] = useState<ContaAPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const { getState, setState, clearState } = usePersistence();

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => getState('contasAPagar_activeTab') || 'fixa');
  const [newContaTipo, setNewContaTipo] = useState<ContaTipo>(() => getState('contasAPagar_newContaTipo') || 'fixa');
  const [showForm, setShowForm] = useState(() => getState('contasAPagar_showForm') || false);
  const [showUpload, setShowUpload] = useState(() => getState('contasAPagar_showUpload') || false);
  const [editingConta, setEditingConta] = useState<ContaAPagar | null>(() => getState('contasAPagar_editingConta') || null);
  const [searchTerm, setSearchTerm] = useState(() => getState('contasAPagar_searchTerm') || '');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: 'fornecedor' | 'status_documento' | 'valor' | 'vencimento' | null;
    direction: 'asc' | 'desc';
  }>({ key: 'vencimento', direction: 'asc' });
  const [viewingConta, setViewingConta] = useState<ContaAPagar | null>(() => getState('contasAPagar_viewingConta') || null);
  const [showActionPasswordModal, setShowActionPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [pendingActionConta, setPendingActionConta] = useState<ContaAPagar | null>(null);
  const [updatingStatusIds, setUpdatingStatusIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string | null>(() => getState('contasAPagar_statusFilter') ?? null);
  const [showContaTipoModal, setShowContaTipoModal] = useState(false);
  const persistedStatusFilter = getState('contasAPagar_statusFilter') as string | null | undefined;
  const savedExportState = useMemo(() => loadExportModalState(), []);

  const [showNextWeekModal, setShowNextWeekModal] = useState(false);
  const [showExportNfModal, setShowExportNfModal] = useState(savedExportState.showExportNfModal);
  const [exportEntries, setExportEntries] = useState<Record<string, ExportEntry>>(savedExportState.exportEntries);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showEmailRecipientsModal, setShowEmailRecipientsModal] = useState(false);
  const [emailRecipientInput, setEmailRecipientInput] = useState('');
  const [emailRecipientsError, setEmailRecipientsError] = useState<string | null>(null);
  const [emailRecipients, setEmailRecipients] = useState<string[]>(() => loadEmailRecipients());
  const [emailContext, setEmailContext] = useState<{
    columns: string[];
    rows: Array<Array<string | number | Date | null>>;
  } | null>(null);
  const [showConsolidateLoteModal, setShowConsolidateLoteModal] = useState(false);
  const [consolidateSelection, setConsolidateSelection] = useState<Set<string>>(new Set());
  const [consolidateError, setConsolidateError] = useState<string | null>(null);
  const [lotes, setLotes] = useState<LoteRegistro[]>(() => loadLotes());
  const [loteNome, setLoteNome] = useState('');
  const [loteNomeError, setLoteNomeError] = useState<string | null>(null);
  const [currentLoteId, setCurrentLoteId] = useState<string | null>(null);
  const [editingLoteId, setEditingLoteId] = useState<string | null>(null);
  const [editingLoteType, setEditingLoteType] = useState<'resumido' | 'detalhado' | null>(null);
  const [editingLoteNome, setEditingLoteNome] = useState('');
  const [editingLoteRows, setEditingLoteRows] = useState<Array<LoteRowDetalhado | LoteRowResumido>>([]);
  const [editingLoteReadOnly, setEditingLoteReadOnly] = useState(false);
  const [editingLoteTab, setEditingLoteTab] = useState<ContaTipo>('fixa');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      showExportNfModal,
      exportEntries,
    };
    try {
      localStorage.setItem(EXPORT_MODAL_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Erro ao salvar estado do export modal:', error);
    }
  }, [showExportNfModal, exportEntries]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LOTES_STORAGE_KEY, JSON.stringify(lotes));
    } catch (error) {
      console.error('Erro ao salvar lotes:', error);
    }
  }, [lotes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(LOTES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const filtered = parsed.filter((item) => item?.nome !== CONSOLIDADO_FEVEREIRO_2026);
      if (filtered.length !== parsed.length) {
        localStorage.setItem(LOTES_STORAGE_KEY, JSON.stringify(filtered));
      }
    } catch (error) {
      console.error('Erro ao limpar lote consolidado antigo:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(EMAIL_RECIPIENTS_STORAGE_KEY, JSON.stringify(emailRecipients));
    } catch (error) {
      console.error('Erro ao salvar destinatarios de e-mail:', error);
    }
  }, [emailRecipients]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchContas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contas_a_pagar')
        .select('id, status_documento, fornecedor, tipo_pagto, link, descricao, valor, vencimento, observacoes, tipo_conta, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContas(data || []);
    } catch (error) {
      console.error('Error fetching contas a pagar:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContas();
  }, [fetchContas]);

  useEffect(() => {
    setState('contasAPagar_activeTab', activeTab);
  }, [activeTab, setState]);

  useEffect(() => {
    setState('contasAPagar_newContaTipo', newContaTipo);
  }, [newContaTipo, setState]);

  useEffect(() => {
    setState('contasAPagar_showForm', showForm);
  }, [showForm, setState]);

  useEffect(() => {
    setState('contasAPagar_showUpload', showUpload);
  }, [showUpload, setState]);

  useEffect(() => {
    setState('contasAPagar_editingConta', editingConta);
  }, [editingConta, setState]);

  useEffect(() => {
    setState('contasAPagar_viewingConta', viewingConta);
  }, [viewingConta, setState]);

  useEffect(() => {
    setState('contasAPagar_searchTerm', searchTerm);
  }, [searchTerm, setState]);

  useEffect(() => {
    if (persistedStatusFilter === undefined) return;
    if (statusFilter === persistedStatusFilter) return;
    setStatusFilter(persistedStatusFilter);
  }, [persistedStatusFilter, statusFilter]);

  const updateStatusFilter = useCallback((value: string | null) => {
    setStatusFilter(value);
    if (value === null) {
      clearState('contasAPagar_statusFilter');
      return;
    }
    setState('contasAPagar_statusFilter', value);
  }, [clearState, setState]);

  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const defaultEmailRecipients = useMemo(
    () => DEFAULT_EMAIL_RECIPIENTS.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0),
    []
  );

  const isValidEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const formatBRLFromInput = (input: string) => {
    const cleaned = input.replace(/[^\d,.-]/g, '');
    if (!cleaned) return '';
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numeric);
  };

  const normalizeContaTipo = useCallback((value?: ContaTipo | null) => {
    if (value === 'avulsa') return 'avulsa';
    if (value === 'ressarcimento') return 'ressarcimento';
    return 'fixa';
  }, []);


  const contasByTab = useMemo(() => {
    if (activeTab === 'lotes' || activeTab === 'lotes_fechados') return [];
    return contas.filter((conta) => normalizeContaTipo(conta.tipo_conta) === activeTab);
  }, [contas, activeTab, normalizeContaTipo]);

  const contasTipoMap = useMemo(() => {
    return new Map(
      contas.map((conta) => [
        conta.id,
        normalizeContaTipo(conta.tipo_conta),
      ])
    );
  }, [contas, normalizeContaTipo]);

  const extractContaIdFromValue = useCallback((value?: string) => {
    return extractUuidFromString(value);
  }, []);

  const getRowContaId = useCallback((row: LoteRowDetalhado | LoteRowResumido) => {
    if (row.contaId) return row.contaId;
    return extractContaIdFromValue(row.id);
  }, [extractContaIdFromValue]);

  const getRowTipoRegistro = useCallback((row: LoteRowDetalhado | LoteRowResumido) => {
    const contaId = getRowContaId(row);
    if (contaId && contasTipoMap.has(contaId)) {
      return contasTipoMap.get(contaId);
    }
    if (row.tipoRegistro) return row.tipoRegistro;
    return undefined;
  }, [contasTipoMap, getRowContaId]);

  const getLoteCounts = useCallback((lote: LoteRegistro) => {
    let fixas = lote.fixasTotal ?? 0;
    let avulsas = lote.avulsasTotal ?? 0;
    let ressarcimentos = lote.ressarcimentoTotal ?? 0;

    if (fixas === 0 && avulsas === 0 && ressarcimentos === 0) {
      const rows = lote.detalhadoRows ?? lote.resumidoRows ?? [];
      if (rows.length > 0) {
        rows.forEach((row) => {
          const tipo = getRowTipoRegistro(row as LoteRowDetalhado | LoteRowResumido);
          if (tipo === 'avulsa') avulsas += 1;
          else if (tipo === 'fixa') fixas += 1;
          else if (tipo === 'ressarcimento') ressarcimentos += 1;
        });
      } else if (lote.origem === 'fixa') {
        fixas = lote.total;
      } else if (lote.origem === 'avulsa') {
        avulsas = lote.total;
      } else if (lote.origem === 'ressarcimento') {
        ressarcimentos = lote.total;
      }
    }

    return { fixas, avulsas, ressarcimentos };
  }, [getRowTipoRegistro]);

  const getRowsCounts = useCallback((rows: Array<LoteRowDetalhado | LoteRowResumido>) => {
    return rows.reduce(
      (acc, row) => {
        const tipo = getRowTipoRegistro(row);
        if (tipo === 'fixa') acc.fixas += 1;
        else if (tipo === 'avulsa') acc.avulsas += 1;
        else if (tipo === 'ressarcimento') acc.ressarcimentos += 1;
        return acc;
      },
      { fixas: 0, avulsas: 0, ressarcimentos: 0 }
    );
  }, [getRowTipoRegistro]);

  const contasFixasCount = useMemo(() => {
    return contas.filter((conta) => normalizeContaTipo(conta.tipo_conta) === 'fixa').length;
  }, [contas, normalizeContaTipo]);

  const contasAvulsasCount = useMemo(() => {
    return contas.filter((conta) => normalizeContaTipo(conta.tipo_conta) === 'avulsa').length;
  }, [contas, normalizeContaTipo]);

  const contasRessarcimentoCount = useMemo(() => {
    return contas.filter((conta) => normalizeContaTipo(conta.tipo_conta) === 'ressarcimento').length;
  }, [contas, normalizeContaTipo]);

  const lotesFechados = useMemo(() => lotes.filter((lote) => lote.fechado), [lotes]);
  const lotesAbertos = useMemo(() => lotes.filter((lote) => !lote.fechado), [lotes]);
  const lotesCount = useMemo(() => lotesAbertos.length, [lotesAbertos]);
  const lotesFechadosCount = useMemo(() => lotesFechados.length, [lotesFechados]);
  const lotesVisiveis = useMemo(
    () => (activeTab === 'lotes_fechados' ? lotesFechados : lotesAbertos),
    [activeTab, lotesAbertos, lotesFechados]
  );


  const getDayValue = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const day = Math.trunc(parsed);
    if (day < 1 || day > 31) return null;
    return day;
  };

  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const getNextDueDate = (day: number, baseDate: Date) => {
    let year = baseDate.getFullYear();
    let month = baseDate.getMonth();
    const todayStart = startOfDay(baseDate);
    const monthDays = getDaysInMonth(year, month);
    const clampedDay = Math.min(day, monthDays);
    let due = new Date(year, month, clampedDay);

    if (due < todayStart) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      const nextMonthDays = getDaysInMonth(year, month);
      due = new Date(year, month, Math.min(day, nextMonthDays));
    }

    return due;
  };

  const startOfWeekSunday = (date: Date) => {
    const dayIndex = date.getDay(); // Sunday = 0
    return startOfDay(addDays(date, -dayIndex));
  };

  const toggleSort = useCallback((key: 'fornecedor' | 'status_documento' | 'valor' | 'vencimento') => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: 'asc' };
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;

    try {
      const { error } = await supabase.from('contas_a_pagar').delete().eq('id', id);
      if (error) throw error;
      setContas(prev => prev.filter((conta) => conta.id !== id));
    } catch (error) {
      console.error('Error deleting conta a pagar:', error);
      alert('Erro ao excluir conta');
    }
  }, []);

  const handleStatusChange = useCallback(async (contaId: string, value: string) => {
    const statusValue = value.trim() === '' ? null : value.trim();
    setUpdatingStatusIds(prev => new Set(prev).add(contaId));
    setContas(prev => prev.map((conta) => (
      conta.id === contaId ? { ...conta, status_documento: statusValue } : conta
    )));

    try {
      const { error } = await supabase
        .from('contas_a_pagar')
        .update({
          status_documento: statusValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contaId);

      if (error) throw error;

    } catch (error) {
      console.error('Error updating status do documento:', error);
      alert('Erro ao atualizar status do documento');
      fetchContas();
    } finally {
      setUpdatingStatusIds(prev => {
        const next = new Set(prev);
        next.delete(contaId);
        return next;
      });
    }
  }, [fetchContas]);

  const nextWeekEntries = useMemo(() => {
    if (!contasByTab.length) return [];
    const now = new Date();
    const nextWeekStart = startOfWeekSunday(addDays(startOfDay(now), 7));
    const nextWeekEnd = addDays(nextWeekStart, 6);

    return contasByTab.filter((conta) => {
      const day = getDayValue(conta.vencimento ?? null);
      if (!day) return false;
      const dueDate = getNextDueDate(day, now);
      return dueDate >= nextWeekStart && dueDate <= nextWeekEnd;
    });
  }, [contasByTab]);

  const nextWeekSuppliers = useMemo(() => {
    const entries = nextWeekEntries.map((conta) => ({
      id: conta.id,
      fornecedor: conta.fornecedor || 'Fornecedor nao informado',
      vencimento: conta.vencimento ?? null,
      status: conta.status_documento || '',
    }));
    return entries.sort((a, b) => {
      const aDay = a.vencimento ?? 0;
      const bDay = b.vencimento ?? 0;
      if (aDay !== bDay) return aDay - bDay;
      return a.fornecedor.localeCompare(b.fornecedor);
    });
  }, [nextWeekEntries]);

  const requestActionVerification = useCallback((action: 'view' | 'edit' | 'delete', conta: ContaAPagar) => {
    setPendingAction(action);
    setPendingActionConta(conta);
    setShowActionPasswordModal(true);
  }, []);

  const handleActionPasswordVerified = useCallback(async () => {
    if (!pendingAction || !pendingActionConta) return;
    const action = pendingAction;
    const conta = pendingActionConta;

    setShowActionPasswordModal(false);
    setPendingAction(null);
    setPendingActionConta(null);

    if (action === 'view') {
      setViewingConta(conta);
      return;
    }

    if (action === 'edit') {
      setEditingConta(conta);
      setShowForm(true);
      return;
    }

    await handleDelete(conta.id);
  }, [pendingAction, pendingActionConta, handleDelete]);

  const filteredContasSorted = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let filtered = contasByTab.filter((conta) =>
      (conta.fornecedor || '').toLowerCase().includes(term) ||
      (conta.tipo_pagto || '').toLowerCase().includes(term) ||
      (conta.link || '').toLowerCase().includes(term) ||
      (conta.descricao || '').toLowerCase().includes(term) ||
      (conta.status_documento || '').toLowerCase().includes(term) ||
      (conta.observacoes || '').toLowerCase().includes(term)
    );

    if (statusFilter) {
      filtered = filtered.filter((conta) => conta.status_documento === statusFilter);
    }

    const compareValues = (aValue: string | number | null, bValue: string | number | null) => {
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return aValue - bValue;
      }
      return aValue.toString().localeCompare(bValue.toString());
    };

    const parseValor = (value: string | number | null) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'number') return value;
      const cleaned = value.toString().replace(/[^\d,.-]/g, '');
      if (!cleaned) return null;
      const hasComma = cleaned.includes(',');
      const normalized = hasComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
      const numeric = Number(normalized);
      return Number.isFinite(numeric) ? numeric : null;
    };

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let result = 0;
        if (sortConfig.key === 'fornecedor') {
          result = compareValues(a.fornecedor || null, b.fornecedor || null);
        } else if (sortConfig.key === 'status_documento') {
          result = compareValues(a.status_documento || null, b.status_documento || null);
        } else if (sortConfig.key === 'valor') {
          result = compareValues(parseValor(a.valor), parseValor(b.valor));
        } else if (sortConfig.key === 'vencimento') {
          result = compareValues(a.vencimento ?? null, b.vencimento ?? null);
        }

        return sortConfig.direction === 'asc' ? result : -result;
      });
    }

    return filtered;
  }, [contasByTab, searchTerm, sortConfig, statusFilter]);

  const createDefaultExportEntry = (conta: ContaAPagar) => {
    const now = new Date();
    const day = getDayValue(conta.vencimento ?? null);
    const vencDate = day ? getNextDueDate(day, now) : null;
    return {
      fornecedor: decodeLatin1IfNeeded(conta.fornecedor) ?? '',
      vencimento: vencDate ? vencDate.toISOString().slice(0, 10) : '',
      pagamento: (conta.tipo_pagto || 'BOLETO').toUpperCase(),
      empresa: 'ODONTOART',
      descricao: decodeLatin1IfNeeded(conta.descricao) ?? '',
      notaFiscal: '*',
      setorResponsavel: 'T.I',
      banco: '*',
      agencia: '*',
      conta: '*',
      tipoConta: '*',
      cpfCnpj: '*',
      anexos: 'Não',
    };
  };

  const mergeExportEntryWithDefaults = (conta: ContaAPagar, entry?: ExportEntry) => {
    const defaults = createDefaultExportEntry(conta);
    if (!entry) {
      return defaults;
    }
    const normalized = normalizeExportEntry(entry);
    const merged: Record<ExportEntryField, string> = { ...defaults };
    EXPORT_ENTRY_FIELDS.forEach((field) => {
      const value = normalized?.[field];
      if (value === undefined || value === null) return;
      const textValue = value.toString();
      if (textValue.trim() === '') return;
      merged[field] = textValue;
    });
    return merged;
  };

  const buildDetalhadoRows = useCallback((): LoteRowDetalhado[] => {
    return filteredContasSorted.map((conta) => {
      const entry = mergeExportEntryWithDefaults(conta, exportEntries[conta.id]);
      return {
        id: conta.id,
        contaId: conta.id,
        fornecedor: entry.fornecedor ?? '',
        valor: conta.valor === null || conta.valor === undefined ? '' : conta.valor.toString(),
        vencimento: entry.vencimento ?? '',
        pagamento: entry.pagamento ?? '',
        empresa: entry.empresa ?? '',
        descricao: entry.descricao ?? '',
        notaFiscal: entry.notaFiscal ?? '',
        setorResponsavel: entry.setorResponsavel ?? '',
        banco: entry.banco ?? '',
        agencia: entry.agencia ?? '',
        conta: entry.conta ?? '',
        tipoConta: entry.tipoConta ?? '',
        cpfCnpj: entry.cpfCnpj ?? '',
        anexos: entry.anexos ?? '',
        tipoRegistro: normalizeContaTipo(conta.tipo_conta),
      };
    });
  }, [exportEntries, filteredContasSorted, mergeExportEntryWithDefaults, normalizeContaTipo]);

  const buildResumidoRows = useCallback((): LoteRowResumido[] => {
    return filteredContasSorted.map((conta) => {
      const entry = mergeExportEntryWithDefaults(conta, exportEntries[conta.id]);
      return {
        id: conta.id,
        contaId: conta.id,
        fornecedor: entry.fornecedor ?? '',
        valor: conta.valor === null || conta.valor === undefined ? '' : conta.valor.toString(),
        vencimento: entry.vencimento ?? '',
        descricao: entry.descricao ?? '',
        notaFiscal: entry.notaFiscal ?? '',
        tipoRegistro: normalizeContaTipo(conta.tipo_conta),
      };
    });
  }, [exportEntries, filteredContasSorted, mergeExportEntryWithDefaults, normalizeContaTipo]);

  const buildDetalhadoEmailRows = useCallback((rows: LoteRowDetalhado[]) => {
    const parseValor = (value: string | number | null | undefined) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'number') return value;
      const cleaned = value.toString().replace(/[^\d,.-]/g, '');
      if (!cleaned) return null;
      const normalized = cleaned.replace(/\./g, '').replace(',', '.');
      const numeric = Number(normalized);
      return Number.isFinite(numeric) ? numeric : null;
    };

    return rows.map((row) => {
      const valorNum = parseValor(row.valor);
      let vencDate: Date | null = null;
      if (row.vencimento) {
        const parsedDate = new Date(row.vencimento);
        vencDate = Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
      }
      return [
        row.fornecedor,
        valorNum ?? null,
        vencDate,
        row.pagamento,
        row.empresa,
        row.descricao,
        row.notaFiscal,
        row.setorResponsavel,
        row.banco,
        row.agencia,
        row.conta,
        row.tipoConta,
        row.cpfCnpj,
        row.anexos,
      ];
    });
  }, []);

  const mapDetalhadoToResumido = useCallback((rows: LoteRowDetalhado[]): LoteRowResumido[] => {
    return rows.map((row) => ({
      id: row.id,
      contaId: row.contaId,
      fornecedor: row.fornecedor ?? '',
      valor: row.valor ?? '',
      vencimento: row.vencimento ?? '',
      descricao: row.descricao ?? '',
      notaFiscal: row.notaFiscal ?? '',
      tipoRegistro: row.tipoRegistro,
    }));
  }, []);

  const mapResumidoToDetalhado = useCallback((rows: LoteRowResumido[]): LoteRowDetalhado[] => {
    return rows.map((row) => ({
      id: row.id,
      contaId: row.contaId,
      fornecedor: row.fornecedor ?? '',
      valor: row.valor ?? '',
      vencimento: row.vencimento ?? '',
      pagamento: '',
      empresa: '',
      descricao: row.descricao ?? '',
      notaFiscal: row.notaFiscal ?? '',
      setorResponsavel: '',
      banco: '',
      agencia: '',
      conta: '',
      tipoConta: '',
      cpfCnpj: '',
      anexos: '',
      tipoRegistro: row.tipoRegistro,
    }));
  }, []);

  const buildXlsxDataRows = useCallback((entryMap: Record<string, ExportEntry>) => {
    const parseValor = (value: string | number | null) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'number') return value;
      const cleaned = value.toString().replace(/[^\d,.-]/g, '');
      if (!cleaned) return null;
      const hasComma = cleaned.includes(',');
      const normalized = hasComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
      const numeric = Number(normalized);
      return Number.isFinite(numeric) ? numeric : null;
    };

    return filteredContasSorted.map((conta) => {
      const valorNum = parseValor(conta.valor);
      const entry = mergeExportEntryWithDefaults(conta, entryMap[conta.id]);
      let vencDate: Date | null = null;
      if (entry.vencimento) {
        const parsedDate = new Date(entry.vencimento);
        vencDate = Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
      }

      return [
        entry.fornecedor,
        valorNum ?? null,
        vencDate,
        entry.pagamento,
        entry.empresa,
        entry.descricao,
        entry.notaFiscal,
        entry.setorResponsavel,
        entry.banco,
        entry.agencia,
        entry.conta,
        entry.tipoConta,
        entry.cpfCnpj,
        entry.anexos,
      ];
    });
  }, [filteredContasSorted, mergeExportEntryWithDefaults]);
  const exportData = useCallback((format: ExportFormat, entryMap: Record<string, ExportEntry> = {}) => {
    // ===== base do arquivo (igual ao anexo) =====
    const TITLE = 'PROTOCOLO FINANCEIRO';
    const HEADERS = XLSX_EXPORT_HEADERS;

    // larguras (igual ao arquivo anexado)
    const COL_WIDTHS = [34.71, 15.0, 19.855, 20.425, 13.0, 62.57, 27.285, 19.855, 16.855, 13.0, 10.71, 14.71, 18.71, 17.425];

    const thin = { style: 'thin', color: { rgb: 'FFBFBFBF' } };

    const styleTitle = {
      font: { bold: true, sz: 22 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { left: thin, right: thin, top: thin, bottom: thin },
    };

    const styleHeader = {
      font: { bold: true, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFE7E6E6' } }, // cinza claro (bem próximo do Excel do anexo)
      border: { left: thin, right: thin, top: thin, bottom: thin },
    };

    const styleCell = {
      font: { sz: 11 },
      alignment: { vertical: 'center' },
      border: { left: thin, right: thin, top: thin, bottom: thin },
    };

    const styleDate = {
      ...styleCell,
      alignment: { horizontal: 'center', vertical: 'center' },
      numFmt: 'mm-dd-yy', // no anexo está assim
    };

    const styleMoney = {
      ...styleCell,
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '_-"R$"* #,##0.00_-;_-"R$"* -#,##0.00_-;_-"R$"* "-"??_-;_-@_-',
    };

    const brlFinanceiroFmt =
      '_-"R$"\\ * #,##0.00_-;\\-"R$"\\ * #,##0.00_-;_-"R$"\\ * "-"??_-;_-@_-';

    // ===== monta linhas =====
    const rows: any[][] = [];
    rows.push([TITLE, ...Array(HEADERS.length - 1).fill(null)]);       // linha 1 (A1:N1)
    rows.push([null, ...Array(HEADERS.length - 1).fill(null)]);        // linha 2 (A2:N2) - para manter o merge 2 linhas
    rows.push(HEADERS);                                // linha 3 (cabeçalho)

    if (format === 'xlsx_resumido') {
      const TITLE = 'PROTOCOLO FINANCEIRO';

      const HEADERS = ['FORNECEDOR', 'VALOR', 'VENCIMENTO', 'DESCRIÇÃO', 'NF', null]; // F fica oculto

      // larguras iguais ao anexo (A..F)
      const COL_WIDTHS = [31.71, 18.285, 19.855, 62.57, 18.285, 0];

      const thin = { style: 'thin', color: { rgb: 'FFBFBFBF' } };

      const styleTitle = {
        font: { bold: true, sz: 22 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: { left: thin, right: thin, top: thin, bottom: thin },
      };

      const styleHeader = {
        font: { bold: true, sz: 11 },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { patternType: 'solid', fgColor: { rgb: 'FFE7E6E6' } }, // aproxima o "theme 9"
        border: { left: thin, right: thin, top: thin, bottom: thin },
      };

      const styleCell = {
        font: { sz: 11 },
        alignment: { vertical: 'center' },
        border: { left: thin, right: thin, top: thin, bottom: thin },
      };

      const styleMoney = {
        ...styleCell,
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt: brlFinanceiroFmt,
      };

      const styleDate = {
        ...styleCell,
        alignment: { horizontal: 'center', vertical: 'center' },
        numFmt: 'mm-dd-yy',
      };

      // helpers (use os seus se já existirem no escopo)
      const parseValorLocal = (value: string | number | null) => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return value;
        const cleaned = value.toString().replace(/[^\d,.-]/g, '');
        if (!cleaned) return null;
        const hasComma = cleaned.includes(',');
        const normalized = hasComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
        const n = Number(normalized);
        return Number.isFinite(n) ? n : null;
      };

      const now = new Date();
      const startOfDayLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const getDaysInMonthLocal = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

      const getDayValueLocal = (value: number | null | undefined) => {
        if (value === null || value === undefined) return null;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return null;
        const day = Math.trunc(parsed);
        if (day < 1 || day > 31) return null;
        return day;
      };

      const getNextDueDateLocal = (day: number, baseDate: Date) => {
        let year = baseDate.getFullYear();
        let month = baseDate.getMonth();
        const todayStart = startOfDayLocal(baseDate);

        const monthDays = getDaysInMonthLocal(year, month);
        let due = new Date(year, month, Math.min(day, monthDays));

        if (due < todayStart) {
          month += 1;
          if (month > 11) {
            month = 0;
            year += 1;
          }
          const nextMonthDays = getDaysInMonthLocal(year, month);
          due = new Date(year, month, Math.min(day, nextMonthDays));
        }
        return due;
      };

      // monta AOA (1..)
      const rows: any[][] = [];
      rows.push([TITLE, null, null, null, null, null]);      // linha 1
      rows.push([null, null, null, null, null, null]);       // linha 2
      rows.push(HEADERS);                                    // linha 3

      // dados (linha 4+)
      filteredContasSorted.forEach((conta) => {
        const valorNum = parseValorLocal(conta.valor);
        const entry = mergeExportEntryWithDefaults(conta, entryMap[conta.id]);
        let vencDate: Date | string = '-';
        if (entry.vencimento) {
          const parsedDate = new Date(entry.vencimento);
          vencDate = Number.isNaN(parsedDate.getTime()) ? '-' : parsedDate;
        }

        rows.push([
          entry.fornecedor || '',
          valorNum ?? null,
          vencDate,
          entry.descricao || '',
          entry.notaFiscal || '',
          null,
        ]);
      });

      // TOTAL (igual ao anexo) - soma de B4 até última linha de dados
      const firstDataRow = 4;
      const lastDataRow = rows.length; // antes de adicionar total
      rows.push(['TOTAL', { f: `SUM(B${firstDataRow}:B${lastDataRow})` }, null, null, null, null]);

      const ws = XLSX.utils.aoa_to_sheet(rows);

      const totalRowIndex = rows.length - 1; // índice 0-based dentro do AOA
      const totalCellAddr = XLSX.utils.encode_cell({ r: totalRowIndex, c: 1 }); // coluna B
      if (ws[totalCellAddr]) ws[totalCellAddr].s = styleMoney;

      // merge título: A1:E2 (não inclui F)
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 4 } }];

      // larguras
      ws['!cols'] = COL_WIDTHS.map((w) => ({ wch: w }));

      // estilo título (A1)
      if (ws['A1']) ws['A1'].s = styleTitle;

      // header linha 3 (r=2) col A..E
      for (let c = 0; c <= 4; c++) {
        const addr = XLSX.utils.encode_cell({ r: 2, c });
        if (ws[addr]) ws[addr].s = styleHeader;
      }

      // corpo: da linha 4 em diante (r=3..)
      for (let r = 3; r < rows.length; r++) {
        for (let c = 0; c < 6; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) continue;

          // col B (VALOR)
          if (c === 1) {
            ws[addr].s = styleMoney;
            continue;
          }

          // col C (VENCIMENTO) - só aplica date se for Date
          if (c === 2) {
            if (ws[addr].v instanceof Date) ws[addr].s = styleDate;
            else ws[addr].s = styleCell;
            continue;
          }

          // TOTAL (linha final) â deixa A em bold
          if (r === rows.length - 1 && c === 0) {
            ws[addr].s = { ...styleCell, font: { bold: true, sz: 11 } };
            continue;
          }

          ws[addr].s = styleCell;
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Planilha 3'); // igual ao anexo
      XLSX.writeFile(wb, `PROTOCOLO_FINANCEIRO_RESUMIDO_${new Date().toISOString().slice(0, 10)}.xlsx`);
      return;
    }

    if (format === 'template') {
      // uma linha vazia igual ao modelo (começa na linha 4)
      rows.push([
        '',     // FORNECEDOR
        null,   // VALOR
        null,   // VENCIMENTO
        'BOLETO', // PAGAMENTO
        '',     // EMPRESA
        '',     // DESCRIÇÃO
        '',     // nota fiscal
        'T.I',     // SETOR
        '',     // BANCO
        '',     // AGÊNCIA
        '',     // CONTA
        '',     // TIPO DE CONTA
        '',     // CPF/CNPJ
        'Não',  // Anexos (Sim/Não)
      ]);
    } else {
      // export real (usa o filtro atual da tela)
      const dataRows = buildXlsxDataRows(entryMap);
      dataRows.forEach((row) => rows.push(row));
    }

    // ===== cria planilha =====
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // merge A1:N2
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 13 } }];

    // larguras
    ws['!cols'] = COL_WIDTHS.map((w) => ({ wch: w }));

    // estilos: título (aplica em A1)
    ws['A1'].s = styleTitle;

    // estilos: cabeçalho linha 3 (r=2)
    for (let c = 0; c < 14; c++) {
      const addr = XLSX.utils.encode_cell({ r: 2, c });
      if (ws[addr]) ws[addr].s = styleHeader;
    }

    // estilos: corpo (a partir da linha 4 => r=3)
    for (let r = 3; r < rows.length; r++) {
      for (let c = 0; c < 14; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;

        // VALOR (col B)
        if (c === 1) {
          ws[addr].s = styleMoney;
          continue;
        }

        // VENCIMENTO (col C) e DATA INCLUSÃO (col I)
        if (c === 2 || c === 8) {
          ws[addr].s = styleDate;
          continue;
        }

        ws[addr].s = styleCell;
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planilha1');

    const filenameBase = format === 'template'
      ? 'PROTOCOLO_FINANCEIRO_MODELO'
      : `PROTOCOLO_FINANCEIRO_${new Date().toISOString().slice(0, 10)}`;

    XLSX.writeFile(wb, `${filenameBase}.xlsx`);
  }, [buildXlsxDataRows, filteredContasSorted]);

  const handleExportSelection = useCallback((format: ExportFormat) => {
    exportData(format);
    setShowExportMenu(false);
  }, [exportData]);

  const handleExportEntryChange = (conta: ContaAPagar, field: ExportEntryField, value: string) => {
    setExportEntries((prev) => {
      const next = { ...prev };
      const updated = mergeExportEntryWithDefaults(conta, {
        ...prev[conta.id],
        [field]: value,
      });
      next[conta.id] = updated;
      return next;
    });
  };

  const handleSendXlsxEmail = useCallback(async (
    recipients: string[] = [],
    context?: { columns: string[]; rows: Array<Array<string | number | Date | null>> }
  ) => {
    if (sendingEmail) return false;

    const normalizedRecipients = recipients
      .map((recipient) => normalizeEmail(recipient))
      .filter((recipient) => recipient.length > 0);

    const dataRows = context?.rows ?? buildXlsxDataRows(exportEntries);
    const columns = context?.columns ?? XLSX_EXPORT_HEADERS;
    const rows = dataRows.map((row) =>
      row.map((value) => {
        if (value instanceof Date) {
          const year = value.getFullYear();
          const month = String(value.getMonth() + 1).padStart(2, '0');
          const day = String(value.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        if (value === undefined) return null;
        return value;
      })
    );

    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-contas-a-pagar-xlsx-email', {
        body: {
          columns,
          rows,
          recipients: normalizedRecipients,
        }
      });

      if (error) {
        let errorMessage = 'Falha ao enviar e-mail.';
        const context = (error as { context?: Response }).context;
        if (context instanceof Response) {
          try {
            const body = await context.json();
            if (body?.error) {
              errorMessage = body.error;
            }
          } catch {
            // ignore response parse issues
          }
        }
        console.error('Erro ao enviar e-mail:', error);
        setToast({ type: 'error', message: errorMessage });
        return false;
      }

      if (!data?.ok) {
        console.error('Resposta inesperada da function:', data);
        setToast({ type: 'error', message: 'Falha ao enviar e-mail.' });
        return false;
      }

      setToast({ type: 'success', message: 'E-mail enviado com sucesso' });
      return true;
    } catch (err) {
      console.error('Erro inesperado ao enviar e-mail:', err);
      setToast({ type: 'error', message: 'Falha ao enviar e-mail.' });
      return false;
    } finally {
      setSendingEmail(false);
    }
  }, [buildXlsxDataRows, exportEntries, normalizeEmail, sendingEmail]);

  const handleOpenEmailRecipientsModal = useCallback((context?: { columns: string[]; rows: Array<Array<string | number | Date | null>> }) => {
    setEmailRecipientInput('');
    setEmailRecipientsError(null);
    setEmailContext(context ?? null);
    setShowEmailRecipientsModal(true);
  }, []);

  const handleAddEmailRecipient = useCallback(() => {
    const normalized = normalizeEmail(emailRecipientInput);
    if (!normalized) {
      setEmailRecipientsError('Informe um e-mail valido.');
      return;
    }
    if (!isValidEmail(normalized)) {
      setEmailRecipientsError('Informe um e-mail valido.');
      return;
    }
    setEmailRecipients((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setEmailRecipientInput('');
    setEmailRecipientsError(null);
  }, [emailRecipientInput, isValidEmail, normalizeEmail]);

  const handleRemoveEmailRecipient = useCallback((recipient: string) => {
    const normalized = normalizeEmail(recipient);
    if (defaultEmailRecipients.includes(normalized)) return;
    setEmailRecipients((prev) => prev.filter((item) => item !== recipient));
  }, [defaultEmailRecipients, normalizeEmail]);

  const handleConfirmSendEmail = useCallback(async () => {
    if (emailRecipients.length === 0) {
      setEmailRecipientsError('Adicione ao menos um destinatario.');
      return;
    }
    if (!emailRecipients.every((recipient) => isValidEmail(recipient))) {
      setEmailRecipientsError('Existe um destinatario invalido.');
      return;
    }
    const success = await handleSendXlsxEmail(emailRecipients, emailContext ?? undefined);
    if (success) {
      setShowEmailRecipientsModal(false);
      setEmailContext(null);
    }
  }, [emailContext, emailRecipients, handleSendXlsxEmail, isValidEmail]);

  const buildDefaultLoteNome = useCallback(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `PROTOCLO TI CONTAS A PAGAR ${day}-${month}-${year}`;
  }, []);

  const upsertLote = useCallback((tipo: 'resumido' | 'detalhado', nome: string, rows: LoteRowDetalhado[] | LoteRowResumido[]) => {
    const trimmed = nome.trim();
    if (!trimmed) return false;
    const origem: ContaTipo = activeTab === 'avulsa'
      ? 'avulsa'
      : activeTab === 'ressarcimento'
        ? 'ressarcimento'
        : 'fixa';
    const loteId = currentLoteId ?? createId();
    const totalRows = rows.length;
    setCurrentLoteId(loteId);
    setLotes((prev) => {
      const existing = prev.find((lote) => lote.id === loteId);
      if (existing) {
        return prev.map((lote) => {
          if (lote.id !== loteId) return lote;
          const fixasTotal = origem === 'fixa' ? totalRows : 0;
          const avulsasTotal = origem === 'avulsa' ? totalRows : 0;
          const ressarcimentoTotal = origem === 'ressarcimento' ? totalRows : 0;
          return {
            ...lote,
            nome: trimmed,
            origem,
            total: totalRows,
            fechado: lote.fechado ?? false,
            fixasTotal,
            avulsasTotal,
            ressarcimentoTotal,
            resumido: tipo === 'resumido' ? true : lote.resumido,
            detalhado: tipo === 'detalhado' ? true : lote.detalhado,
            resumidoRows: tipo === 'resumido' ? (rows as LoteRowResumido[]) : lote.resumidoRows,
            detalhadoRows: tipo === 'detalhado' ? (rows as LoteRowDetalhado[]) : lote.detalhadoRows,
          };
        });
      }

      const novoLote: LoteRegistro = {
        id: loteId,
        nome: trimmed,
        total: totalRows,
        origem,
        criado_em: new Date().toISOString(),
        fechado: false,
        fixasTotal: origem === 'fixa' ? totalRows : 0,
        avulsasTotal: origem === 'avulsa' ? totalRows : 0,
        ressarcimentoTotal: origem === 'ressarcimento' ? totalRows : 0,
        resumido: tipo === 'resumido',
        detalhado: tipo === 'detalhado',
        resumidoRows: tipo === 'resumido' ? (rows as LoteRowResumido[]) : undefined,
        detalhadoRows: tipo === 'detalhado' ? (rows as LoteRowDetalhado[]) : undefined,
      };
      return [novoLote, ...prev];
    });
    setToast({
      type: 'success',
      message: `Lote ${tipo} registrado`,
    });
    return true;
  }, [activeTab, currentLoteId]);

  const handleOpenNovoLoteModal = useCallback(() => {
    setLoteNome(buildDefaultLoteNome());
    setLoteNomeError(null);
    setCurrentLoteId(createId());
    setExportEntries((prev) => {
      const next = { ...prev };
      filteredContasSorted.forEach((conta) => {
        next[conta.id] = mergeExportEntryWithDefaults(conta, prev[conta.id]);
      });
      return next;
    });
    setShowExportNfModal(true);
  }, [buildDefaultLoteNome, filteredContasSorted, mergeExportEntryWithDefaults]);

  const handleSaveLoteDetalhado = useCallback(() => {
    const trimmed = loteNome.trim();
    if (!trimmed) {
      setLoteNomeError('Informe o nome do lote.');
      return;
    }
    const rows = buildDetalhadoRows();
    const saved = upsertLote('detalhado', trimmed, rows);
    if (saved) {
      setShowExportNfModal(false);
      setLoteNomeError(null);
      setCurrentLoteId(null);
    }
  }, [buildDetalhadoRows, loteNome, upsertLote]);

  const handleCreateResumidoLote = useCallback(() => {
    const nome = loteNome.trim();
    if (!nome) {
      setLoteNomeError('Informe o nome do lote.');
      return;
    }
    const rows = buildResumidoRows();
    upsertLote('resumido', nome, rows);
  }, [buildResumidoRows, loteNome, upsertLote]);

  const handleStartEditLote = useCallback((lote: LoteRegistro, tipo: 'resumido' | 'detalhado', readOnly = false) => {
    setEditingLoteId(lote.id);
    setEditingLoteNome(lote.nome);
    setEditingLoteType(tipo);
    setEditingLoteReadOnly(readOnly);
    const rows = tipo === 'resumido'
      ? (lote.resumidoRows ? [...lote.resumidoRows] : [])
      : (lote.detalhadoRows ? [...lote.detalhadoRows] : []);
    setEditingLoteRows(rows);
    const counts = getRowsCounts(rows);
    if (readOnly) {
      if (counts.fixas === 0 && counts.avulsas === 0 && counts.ressarcimentos > 0) {
        setEditingLoteTab('ressarcimento');
      } else if (counts.fixas === 0 && counts.avulsas > 0) {
        setEditingLoteTab('avulsa');
      } else {
        setEditingLoteTab('fixa');
      }
    } else {
      setEditingLoteTab('fixa');
    }
  }, [getRowsCounts]);

  const handleCancelEditLote = useCallback(() => {
    setEditingLoteId(null);
    setEditingLoteNome('');
    setEditingLoteType(null);
    setEditingLoteRows([]);
    setEditingLoteReadOnly(false);
    setEditingLoteTab('fixa');
  }, []);

  const handleSaveEditLote = useCallback(() => {
    if (!editingLoteId || !editingLoteType) return;
    setLotes((prev) => prev.map((lote) => {
      if (lote.id !== editingLoteId) return lote;
      if (editingLoteType === 'resumido') {
        return { ...lote, resumidoRows: editingLoteRows as LoteRowResumido[] };
      }
      return { ...lote, detalhadoRows: editingLoteRows as LoteRowDetalhado[] };
    }));
    setToast({ type: 'success', message: 'Lote atualizado' });
    handleCancelEditLote();
  }, [editingLoteId, editingLoteRows, editingLoteType, handleCancelEditLote]);

  const handleDeleteLote = useCallback((id: string) => {
    if (!confirm('Deseja excluir este lote?')) return;
    setLotes((prev) => prev.filter((lote) => lote.id !== id));
    setToast({ type: 'success', message: 'Lote removido' });
  }, []);

  const buildDetalhadoRowsFromContas = useCallback((items: ContaAPagar[], entryMap: Record<string, ExportEntry>) => {
    return items.map((conta) => {
      const entry = mergeExportEntryWithDefaults(conta, entryMap[conta.id]);
      return {
        id: conta.id,
        contaId: conta.id,
        fornecedor: entry.fornecedor ?? '',
        valor: conta.valor === null || conta.valor === undefined ? '' : conta.valor.toString(),
        vencimento: entry.vencimento ?? '',
        pagamento: entry.pagamento ?? '',
        empresa: entry.empresa ?? '',
        descricao: entry.descricao ?? '',
        notaFiscal: entry.notaFiscal ?? '',
        setorResponsavel: entry.setorResponsavel ?? '',
        banco: entry.banco ?? '',
        agencia: entry.agencia ?? '',
        conta: entry.conta ?? '',
        tipoConta: entry.tipoConta ?? '',
        cpfCnpj: entry.cpfCnpj ?? '',
        anexos: entry.anexos ?? '',
        tipoRegistro: normalizeContaTipo(conta.tipo_conta),
      };
    });
  }, [mergeExportEntryWithDefaults, normalizeContaTipo]);

  const buildResumidoRowsFromContas = useCallback((items: ContaAPagar[], entryMap: Record<string, ExportEntry>) => {
    return items.map((conta) => {
      const entry = mergeExportEntryWithDefaults(conta, entryMap[conta.id]);
      return {
        id: conta.id,
        contaId: conta.id,
        fornecedor: entry.fornecedor ?? '',
        valor: conta.valor === null || conta.valor === undefined ? '' : conta.valor.toString(),
        vencimento: entry.vencimento ?? '',
        descricao: entry.descricao ?? '',
        notaFiscal: entry.notaFiscal ?? '',
        tipoRegistro: normalizeContaTipo(conta.tipo_conta),
      };
    });
  }, [mergeExportEntryWithDefaults, normalizeContaTipo]);

  const buildUniqueLoteName = useCallback((baseName: string, existing: LoteRegistro[]) => {
    let name = baseName;
    let counter = 2;
    const exists = (value: string) => existing.some((lote) => lote.nome === value);
    while (exists(name)) {
      name = `${baseName} (${counter})`;
      counter += 1;
    }
    return name;
  }, []);

  const getMesVigenteLabel = () => {
    const now = new Date();
    try {
      const month = now.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
      return `${month}/${now.getFullYear()}`;
    } catch {
      const month = String(now.getMonth() + 1).padStart(2, '0');
      return `${month}/${now.getFullYear()}`;
    }
  };

  const getMesLabel = (date: Date) => {
    try {
      const month = date.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
      return `${month}/${date.getFullYear()}`;
    } catch {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${month}/${date.getFullYear()}`;
    }
  };

  const handleOpenConsolidateModal = useCallback(() => {
    setConsolidateSelection(new Set());
    setConsolidateError(null);
    setShowConsolidateLoteModal(true);
  }, []);

  const handleToggleConsolidateSelection = useCallback((id: string) => {
    setConsolidateSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSaveConsolidatedLote = useCallback(() => {
    const selectedIds = Array.from(consolidateSelection);
    if (selectedIds.length === 0) {
      setConsolidateError('Selecione ao menos um lote.');
      return;
    }
    const selectedLotes = lotesAbertos.filter((lote) => selectedIds.includes(lote.id));
    if (selectedLotes.length === 0) {
      setConsolidateError('Nenhum lote valido selecionado.');
      return;
    }
    const origemSet = new Set(selectedLotes.map((lote) => lote.origem));

    let resumidoRows: LoteRowResumido[] = [];
    let detalhadoRows: LoteRowDetalhado[] = [];

    const normalizeRow = <T extends LoteRowResumido | LoteRowDetalhado>(row: T, lote: LoteRegistro): T => {
      const contaId = row.contaId ?? extractContaIdFromValue(row.id);
      const tipoRegistro = row.tipoRegistro
        ?? getRowTipoRegistro(row)
        ?? (lote.origem === 'avulsa' ? 'avulsa' : lote.origem === 'fixa' ? 'fixa' : undefined);
      return {
        ...row,
        contaId,
        tipoRegistro,
        id: `${lote.id}-${row.id}`,
      };
    };

    selectedLotes.forEach((lote) => {
      if (lote.resumidoRows && lote.resumidoRows.length > 0) {
        resumidoRows = resumidoRows.concat(
          lote.resumidoRows.map((row) => normalizeRow(row, lote))
        );
      }
      if (lote.detalhadoRows && lote.detalhadoRows.length > 0) {
        detalhadoRows = detalhadoRows.concat(
          lote.detalhadoRows.map((row) => normalizeRow(row, lote))
        );
      }
    });

    if (resumidoRows.length === 0 && detalhadoRows.length === 0) {
      setConsolidateError('Os lotes selecionados nao possuem registros.');
      return;
    }
    if (resumidoRows.length === 0 && detalhadoRows.length > 0) {
      resumidoRows = mapDetalhadoToResumido(detalhadoRows);
    }
    if (detalhadoRows.length === 0 && resumidoRows.length > 0) {
      detalhadoRows = mapResumidoToDetalhado(resumidoRows);
    }

    const origem: LoteOrigem = origemSet.size > 1 ? 'misto' : selectedLotes[0].origem;
    const nome = `LOTE CONSOLIDADO ${getMesVigenteLabel()}`;
    const total = detalhadoRows.length > 0 ? detalhadoRows.length : resumidoRows.length;
    const counts = getRowsCounts(detalhadoRows.length > 0 ? detalhadoRows : resumidoRows);
    const novoLote: LoteRegistro = {
      id: createId(),
      nome,
      origem,
      total,
      criado_em: new Date().toISOString(),
      fechado: true,
      fixasTotal: counts.fixas,
      avulsasTotal: counts.avulsas,
      ressarcimentoTotal: counts.ressarcimentos,
      resumido: resumidoRows.length > 0,
      detalhado: detalhadoRows.length > 0,
      resumidoRows,
      detalhadoRows,
    };

    setLotes((prev) => {
      const remaining = prev.filter((lote) => !selectedIds.includes(lote.id));
      return [novoLote, ...remaining];
    });

    setToast({ type: 'success', message: 'Lote consolidado criado' });
    setShowConsolidateLoteModal(false);
    setConsolidateSelection(new Set());
    setConsolidateError(null);
  }, [
    consolidateSelection,
    extractContaIdFromValue,
    getMesVigenteLabel,
    getRowTipoRegistro,
    getRowsCounts,
    lotesAbertos,
    mapDetalhadoToResumido,
    mapResumidoToDetalhado,
  ]);

  const [isMonthClosing, setIsMonthClosing] = useState(false);

  const handleMonthlyClose = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (isMonthClosing) return;
    const now = new Date();
    const currentMonthKey = getMonthKey(now);
    const lastClosed = localStorage.getItem(MONTH_CLOSE_STORAGE_KEY);
    if (!lastClosed) {
      localStorage.setItem(MONTH_CLOSE_STORAGE_KEY, currentMonthKey);
      return;
    }
    if (lastClosed === currentMonthKey) return;

    const contasParaFechar = contas.filter((conta) => {
      const tipo = normalizeContaTipo(conta.tipo_conta);
      return tipo === 'avulsa' || tipo === 'ressarcimento';
    });

    if (contasParaFechar.length === 0) {
      localStorage.setItem(MONTH_CLOSE_STORAGE_KEY, currentMonthKey);
      return;
    }

    setIsMonthClosing(true);
    try {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const baseName = `LOTE CONSOLIDADO ${getMesLabel(prevMonth)}`;
      const nome = buildUniqueLoteName(baseName, lotes);

      const detalhadoRows = buildDetalhadoRowsFromContas(contasParaFechar, exportEntries);
      const resumidoRows = buildResumidoRowsFromContas(contasParaFechar, exportEntries);
      const counts = getRowsCounts(detalhadoRows.length > 0 ? detalhadoRows : resumidoRows);

      const tiposPresentes = new Set(contasParaFechar.map((conta) => normalizeContaTipo(conta.tipo_conta)));
      const origem: LoteOrigem = tiposPresentes.size > 1
        ? 'misto'
        : (tiposPresentes.has('ressarcimento')
          ? 'ressarcimento'
          : tiposPresentes.has('avulsa')
            ? 'avulsa'
            : 'fixa');

      const novoLote: LoteRegistro = {
        id: createId(),
        nome,
        origem,
        total: contasParaFechar.length,
        criado_em: new Date().toISOString(),
        fechado: true,
        resumido: resumidoRows.length > 0,
        detalhado: detalhadoRows.length > 0,
        fixasTotal: counts.fixas,
        avulsasTotal: counts.avulsas,
        ressarcimentoTotal: counts.ressarcimentos,
        resumidoRows,
        detalhadoRows,
      };

      const ids = contasParaFechar.map((conta) => conta.id);
      const { error } = await supabase.from('contas_a_pagar').delete().in('id', ids);
      if (error) throw error;

      setLotes((prev) => [novoLote, ...prev]);
      setContas((prev) => prev.filter((conta) => !ids.includes(conta.id)));
      localStorage.setItem(MONTH_CLOSE_STORAGE_KEY, currentMonthKey);
      setToast({ type: 'success', message: 'Lotes avulsos e ressarcimentos do mês anterior foram fechados.' });
    } catch (error) {
      console.error('Erro ao fechar mês automaticamente:', error);
      setToast({ type: 'error', message: 'Falha ao fechar contas do mês anterior.' });
    } finally {
      setIsMonthClosing(false);
    }
  }, [
    contas,
    exportEntries,
    getMesLabel,
    buildDetalhadoRowsFromContas,
    buildResumidoRowsFromContas,
    getRowsCounts,
    lotes,
    normalizeContaTipo,
    isMonthClosing,
    buildUniqueLoteName,
  ]);

  useEffect(() => {
    if (loading) return;
    handleMonthlyClose();
  }, [handleMonthlyClose, loading]);

  const handleEditLoteFieldChange = useCallback((rowId: string, field: string, value: string) => {
    setEditingLoteRows((prev) => prev.map((row) => (
      row.id === rowId ? { ...row, [field]: value } : row
    )));
  }, []);

  const handleExportEditingLote = useCallback(() => {
    if (!editingLoteType) return;
    const columns = editingLoteType === 'resumido' ? LOTE_RESUMIDO_COLUMNS : LOTE_DETALHADO_COLUMNS;
    const rows = [
      columns.map((column) => column.label),
      ...editingLoteRows.map((row) =>
        columns.map((column) => (row as Record<string, string>)[column.field as string] ?? '')
      ),
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lote');

    const safeName = (editingLoteNome || 'lote')
      .replace(/[^\w\d-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40);
    const suffix = editingLoteType === 'resumido' ? 'RESUMIDO' : 'DETALHADO';
    const filename = `${safeName}_${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, [editingLoteNome, editingLoteRows, editingLoteType]);


  const handleNewContaClick = useCallback(() => {
    setShowContaTipoModal(true);
  }, []);

  const handleSelectContaTipo = useCallback((tipo: ContaTipo) => {
    setNewContaTipo(tipo);
    setShowContaTipoModal(false);
    setEditingConta(null);
    setShowForm(true);
    clearState('contasAPagar_editingConta');
  }, [clearState]);

  const currentItems = filteredContasSorted;

  const handleFormSuccess = useCallback(() => {
    fetchContas();
    setShowForm(false);
    setEditingConta(null);
    clearState('contasAPagar_showForm');
    clearState('contasAPagar_editingConta');
  }, [fetchContas, clearState]);

  const handleUploadSuccess = useCallback(() => {
    fetchContas();
    setShowUpload(false);
    clearState('contasAPagar_showUpload');
  }, [fetchContas, clearState]);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingConta(null);
    clearState('contasAPagar_showForm');
    clearState('contasAPagar_editingConta');
  }, [clearState]);

  const handleCancelUpload = useCallback(() => {
    setShowUpload(false);
    clearState('contasAPagar_showUpload');
  }, [clearState]);

  const handleCloseView = useCallback(() => {
    setViewingConta(null);
    clearState('contasAPagar_viewingConta');
  }, [clearState]);

  const formatDay = (value?: number | null) => {
    if (value === null || value === undefined) return '-';
    return value.toString();
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return date.toLocaleString('pt-BR');
    }
  };

  const getSortIcon = (key: 'fornecedor' | 'status_documento' | 'valor' | 'vencimento') => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 text-neutral-400" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1 text-neutral-600" />
      : <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 text-neutral-600" />;
  };

  const formatCurrency = (value: string | number | null) => {
    if (value === null || value === undefined || value === '') return '-';
    const numericValue = typeof value === 'number'
      ? value
      : Number(value.toString().replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(numericValue)) {
      return value.toString();
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numericValue);
  };

  const parseValorNumber = (value: string | number | null) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    const cleaned = value.toString().replace(/[^\d,.-]/g, '');
    if (!cleaned) return null;
    const hasComma = cleaned.includes(',');
    const normalized = hasComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const getStatusColorClasses = (status: string | null) => {
    if (status === 'Nao emitido') {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (status === 'Emitido pendente assinatura') {
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
    if (status === 'Enviado financeiro') {
      return 'bg-green-50 text-green-700 border-green-200';
    }
    return 'bg-white text-neutral-700 border-neutral-300';
  };

  const dashboardStats = useMemo(() => {
    const totalCount = contasByTab.length;
    const naoEmitidoCount = contasByTab.filter((conta) => conta.status_documento === 'Nao emitido').length;
    const pendenteCount = contasByTab.filter((conta) => conta.status_documento === 'Emitido pendente assinatura').length;
    const enviadoCount = contasByTab.filter((conta) => conta.status_documento === 'Enviado financeiro').length;
    const proximosCount = nextWeekEntries.length;
    const totalValor = contasByTab.reduce((acc, conta) => acc + (parseValorNumber(conta.valor) ?? 0), 0);

    return [
      {
        title: 'Total de Contas',
        value: totalCount,
        icon: FileText,
        color: 'text-primary-600',
        bgColor: 'bg-primary-100',
        description: `${totalCount} conta${totalCount !== 1 ? 's' : ''} cadastrada${totalCount !== 1 ? 's' : ''}`,
        onClick: () => updateStatusFilter(null),
      },
      {
        title: 'Valor total',
        value: formatCurrency(totalValor),
        icon: FileText,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100',
        description: 'Soma de todas as contas',
      },
      {
        title: 'Nao emitido',
        value: naoEmitidoCount,
        icon: FileText,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        description: `${naoEmitidoCount} pendente${naoEmitidoCount !== 1 ? 's' : ''}`,
        onClick: () => updateStatusFilter('Nao emitido'),
      },
      {
        title: 'Pendente assinatura',
        value: pendenteCount,
        icon: FileText,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        description: `${pendenteCount} aguardando`,
        onClick: () => updateStatusFilter('Emitido pendente assinatura'),
      },
      {
        title: 'Enviado financeiro',
        value: enviadoCount,
        icon: FileText,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        description: `${enviadoCount} enviado${enviadoCount !== 1 ? 's' : ''}`,
        onClick: () => updateStatusFilter('Enviado financeiro'),
      },
      {
        title: 'Proximos vencimentos',
        value: proximosCount,
        icon: FileText,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        description: 'Fornecedores da semana seguinte',
        onClick: () => setShowNextWeekModal(true),
      }
    ];
  }, [contasByTab, nextWeekEntries, updateStatusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-2xl px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-500/90' : 'bg-red-500/90'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Contas a Pagar</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-primary-600">Controle de contas e documentos financeiros</p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-button text-xs sm:text-sm font-medium rounded-lg text-button bg-white hover:bg-button-50 hidden"
            >
              <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Importar
            </button>
            {activeTab !== 'lotes' && activeTab !== 'lotes_fechados' && (
              <>
                <button
                  onClick={handleOpenNovoLoteModal}
                  className="inline-flex items-center justify-center w-full sm:w-auto px-3 sm:px-4 py-2 border border-button text-xs sm:text-sm font-medium rounded-lg text-button bg-white hover:bg-button-50"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Gerar Lote
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="inline-flex items-center justify-center w-full sm:w-auto px-3 sm:px-4 py-2 border border-button text-xs sm:text-sm font-medium rounded-lg text-button bg-white hover:bg-button-50"
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Exportar ({filteredContasSorted.length})
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border border-neutral-200">
                      <div className="py-1">
                        <div className="px-4 py-2 text-xs text-neutral-500 border-b border-neutral-100">
                          {searchTerm ? `Exportando ${filteredContasSorted.length} registros filtrados` : `Exportando todos os ${filteredContasSorted.length} registros`}
                        </div>
                        <button
                          onClick={() => handleExportSelection('xlsx')}
                          className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                        >
                          Exportar XLSX
                        </button>
                        <button
                          onClick={() => handleExportSelection('xlsx_resumido')}
                          className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                        >
                          Exportar Resumido (XLSX)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleNewContaClick}
                  className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Nova Conta
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {activeTab !== 'lotes' && activeTab !== 'lotes_fechados' && (
        <DashboardStats
          stats={dashboardStats}
          layout="row"
          className="no-scrollbar"
          cardClassName="min-w-[220px]"
        />
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden hide-scrollbar">
        <div className="border-b border-neutral-200 bg-neutral-50">
          <div className="flex">
            <button
              onClick={() => setActiveTab('fixa')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'fixa'
                  ? 'border-primary-600 text-primary-700 bg-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Contas Fixas
              <span
                className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs ${
                  activeTab === 'fixa' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {contasFixasCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('avulsa')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'avulsa'
                  ? 'border-primary-600 text-primary-700 bg-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Contas Avulsas
              <span
                className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs ${
                  activeTab === 'avulsa' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {contasAvulsasCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('ressarcimento')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'ressarcimento'
                  ? 'border-primary-600 text-primary-700 bg-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Ressarcimento
              <span
                className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs ${
                  activeTab === 'ressarcimento' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {contasRessarcimentoCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('lotes')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'lotes'
                  ? 'border-primary-600 text-primary-700 bg-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Lotes
              <span
                className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs ${
                  activeTab === 'lotes' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {lotesCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('lotes_fechados')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'lotes_fechados'
                  ? 'border-primary-600 text-primary-700 bg-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Lotes Fechados
              <span
                className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs ${
                  activeTab === 'lotes_fechados' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {lotesFechadosCount}
              </span>
            </button>
          </div>
        </div>
        {activeTab === 'lotes' || activeTab === 'lotes_fechados' ? (
          <div className="p-4 sm:p-6">
            {activeTab === 'lotes_fechados' && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-neutral-700">
                  Consolide lotes abertos em um lote fechado.
                </div>
                <button
                  onClick={handleOpenConsolidateModal}
                  disabled={lotesAbertos.length === 0}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                    lotesAbertos.length === 0
                      ? 'border-neutral-200 text-neutral-300 cursor-not-allowed'
                      : 'border-primary-200 text-primary-700 hover:bg-primary-50'
                  }`}
                >
                  Fechar Lote
                </button>
              </div>
            )}
            {lotesVisiveis.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <FileText className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-neutral-400" />
                <h3 className="mt-2 text-sm font-medium text-neutral-900">
                  {activeTab === 'lotes' ? 'Nenhum lote em aberto' : 'Nenhum lote fechado'}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-neutral-500">
                  {activeTab === 'lotes'
                    ? 'Crie um lote detalhado para aparecer aqui.'
                    : 'Finalize um lote detalhado e resumido para aparecer aqui.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {lotesVisiveis.map((lote) => (
                  <div
                    key={lote.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm sm:text-base font-semibold text-neutral-900">
                            {lote.nome}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                            {lote.origem === 'avulsa'
                              ? 'Avulsas'
                              : lote.origem === 'ressarcimento'
                                ? 'Ressarcimento'
                                : lote.origem === 'misto'
                                  ? 'Misto'
                                  : 'Fixas'}
                          </span>
                          {lote.fechado && (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                              Fechado
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-[11px] text-neutral-500">
                          <span className="inline-flex items-center gap-1">
                            Itens:
                            <strong className="font-semibold text-neutral-700">{lote.total}</strong>
                          </span>
                          <span className="hidden sm:inline text-neutral-300">•</span>
                          <span>
                            Criado em: <strong className="font-semibold text-neutral-700">{formatDateTime(lote.criado_em)}</strong>
                          </span>
                          {lote.fechado && (() => {
                            const counts = getLoteCounts(lote);
                            return (
                              <>
                                <span className="hidden sm:inline text-neutral-300">•</span>
                                <span className="inline-flex items-center gap-1">
                                  Fixas:
                                  <strong className="font-semibold text-neutral-700">{counts.fixas}</strong>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  Avulsas:
                                  <strong className="font-semibold text-neutral-700">{counts.avulsas}</strong>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  Ressarcimento:
                                  <strong className="font-semibold text-neutral-700">{counts.ressarcimentos}</strong>
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => lote.resumido && handleStartEditLote(lote, 'resumido', lote.fechado)}
                          disabled={!lote.resumido}
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                            lote.resumido
                              ? 'border-primary-200 text-primary-700 hover:bg-primary-50'
                              : 'border-neutral-200 text-neutral-300 cursor-not-allowed'
                          }`}
                        >
                          Resumido
                        </button>
                        <button
                          onClick={() => lote.detalhado && handleStartEditLote(lote, 'detalhado', lote.fechado)}
                          disabled={!lote.detalhado}
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                            lote.detalhado
                              ? 'border-primary-200 text-primary-700 hover:bg-primary-50'
                              : 'border-neutral-200 text-neutral-300 cursor-not-allowed'
                          }`}
                        >
                          Detalhado
                        </button>
                        <div className="h-6 w-px bg-neutral-200 mx-1 hidden sm:block" />
                        {!lote.fechado && (
                          <button
                            onClick={() => handleDeleteLote(lote.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-600 hover:border-red-200 hover:bg-red-100"
                            title="Excluir lote"
                          >
                            <Trash2 className="h-3 w-3" />
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="p-4 sm:p-6 border-b border-neutral-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar contas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 sm:pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
                  <span className="text-xs sm:text-sm text-neutral-600">{filteredContasSorted.length} contas</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 text-[11px]">
                <thead className="bg-neutral-50">
                  <tr>
                    <th
                      onClick={() => toggleSort('fornecedor')}
                      className="px-2 py-2 text-left font-medium text-neutral-500 uppercase tracking-wider cursor-pointer select-none"
                    >
                      <div className="flex items-center">
                        Fornecedor
                        {getSortIcon('fornecedor')}
                      </div>
                    </th>
                    <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider w-24">
                      Pagamento
                    </th>
                    <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider w-12">
                      Link
                    </th>
                    <th
                      onClick={() => toggleSort('status_documento')}
                      className="px-2 py-2 text-left font-medium text-neutral-500 uppercase tracking-wider cursor-pointer select-none w-36"
                    >
                      <div className="flex items-center">
                        Status
                        {getSortIcon('status_documento')}
                      </div>
                    </th>
                    <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider w-32">Descricao</th>
                    <th
                      onClick={() => toggleSort('valor')}
                      className="px-2 py-2 text-left font-medium text-neutral-500 uppercase tracking-wider cursor-pointer select-none"
                    >
                      <div className="flex items-center">
                        Valor
                        {getSortIcon('valor')}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort('vencimento')}
                      className="hidden sm:table-cell px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider cursor-pointer select-none w-20"
                    >
                      <div className="flex items-center">
                        Vencimento
                        {getSortIcon('vencimento')}
                      </div>
                    </th>
                    <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider w-28">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {currentItems.map((conta) => (
                    <tr key={conta.id} className="group hover:bg-neutral-50 transition-colors duration-150">
                      <td className="px-2 py-2">
                        <div className="font-medium text-neutral-900 truncate max-w-[140px] sm:max-w-none">
                          {decodeLatin1IfNeeded(conta.fornecedor) || '-'}
                        </div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-neutral-600 w-24 text-center">
                        {conta.tipo_pagto ? conta.tipo_pagto.toUpperCase() : '-'}
                      </td>
                      <td className="px-2 py-2 text-center w-12">
                        {conta.link ? (
                          <a
                            href={conta.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center text-primary-600 hover:text-primary-900"
                            title="Abrir link"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center text-neutral-300"
                            title="Sem link"
                            aria-hidden="true"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-neutral-600 w-36">
                        <select
                          value={conta.status_documento || 'Nao emitido'}
                          onChange={(e) => handleStatusChange(conta.id, e.target.value)}
                          disabled={updatingStatusIds.has(conta.id)}
                          className={`border rounded-lg px-2 py-1 w-36 disabled:opacity-60 ${getStatusColorClasses(conta.status_documento || 'Nao emitido')}`}
                          aria-label="Status do documento"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 w-32">
                        <div className="text-neutral-600 truncate max-w-[120px] sm:max-w-none">
                          {decodeLatin1IfNeeded(conta.descricao) || '-'}
                        </div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-neutral-600">{formatCurrency(conta.valor)}</td>
                      <td className="hidden sm:table-cell px-2 py-2 whitespace-nowrap text-neutral-600 w-20 text-center">
                        {formatDay(conta.vencimento)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap font-medium w-28">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <button
                            onClick={() => requestActionVerification('view', conta)}
                            className="text-neutral-600 hover:text-neutral-900"
                            title="Visualizar"
                          >
                            <Search className="h-3 w-3 sm:h-4 sm:w-4 item-center" />
                          </button>
                          <button
                            onClick={() => requestActionVerification('edit', conta)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Editar"
                          >
                            <Edit className="h-3 w-3 sm:h-4 sm:w-4 item-center" />
                          </button>
                          <button
                            onClick={() => requestActionVerification('delete', conta)}
                            className="text-red-600 hover:text-red-900"
                            title="Excluir"
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 item-center" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredContasSorted.length === 0 && (
                <div className="text-center py-8 sm:py-12">
                  <FileText className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-neutral-400" />
                  <h3 className="mt-2 text-sm font-medium text-neutral-900">Nenhuma conta encontrada</h3>
                  <p className="mt-1 text-xs sm:text-sm text-neutral-500">
                    {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando uma nova conta'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {showContaTipoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-lg">
            <h3 className="text-lg font-semibold text-neutral-900">Nova Conta</h3>
            <p className="text-sm text-neutral-600 mt-2">
              Selecione o tipo de conta que deseja cadastrar.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                onClick={() => handleSelectContaTipo('fixa')}
                className="w-full px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
              >
                Conta Fixa
              </button>
              <button
                onClick={() => handleSelectContaTipo('avulsa')}
                className="w-full px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 transition-colors"
              >
                Conta Avulsa
              </button>
              <button
                onClick={() => handleSelectContaTipo('ressarcimento')}
                className="w-full px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 transition-colors"
              >
                Ressarcimento
              </button>
            </div>
            <div className="mt-4 text-right">
              <button
                onClick={() => setShowContaTipoModal(false)}
                className="px-3 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <ContasAPagarForm
          conta={editingConta}
          tipoConta={editingConta ? undefined : newContaTipo}
          onSuccess={handleFormSuccess}
          onCancel={handleCancelForm}
        />
      )}

      {showUpload && (
        <ContasAPagarFileUpload
          onSuccess={handleUploadSuccess}
          onCancel={handleCancelUpload}
        />
      )}

      {viewingConta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-lg w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Detalhes da Conta</h2>
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-neutral-700">
              <div><strong>Status do Documento:</strong> {viewingConta.status_documento || '-'}</div>
            <div>
              <strong>Pagamento:</strong> {viewingConta.tipo_pagto ? viewingConta.tipo_pagto.toUpperCase() : '-'}
            </div>
              <div><strong>Fornecedor:</strong> {viewingConta.fornecedor || '-'}</div>
              <div>
                <strong>Link:</strong>{' '}
                {viewingConta.link ? (
                  <a
                    href={viewingConta.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-900"
                  >
                    Abrir
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  '-'
                )}
              </div>
              <div><strong>Descricao:</strong> {viewingConta.descricao || '-'}</div>
              <div><strong>Valor:</strong> {formatCurrency(viewingConta.valor)}</div>
              <div><strong>Vencimento:</strong> {formatDay(viewingConta.vencimento)}</div>
              <div><strong>Observacoes:</strong> {viewingConta.observacoes || '-'}</div>
            </div>
            <div className="mt-4 sm:mt-6 text-right">
              <button
                onClick={handleCloseView}
                className="px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs sm:text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <PasswordVerificationModal
        isOpen={showActionPasswordModal}
        onClose={() => {
          setShowActionPasswordModal(false);
          setPendingAction(null);
          setPendingActionConta(null);
        }}
        onSuccess={handleActionPasswordVerified}
        title="Verificacao de Senha"
        message={
          pendingAction === 'edit'
            ? 'Digite sua senha para editar esta conta:'
            : pendingAction === 'delete'
              ? 'Digite sua senha para excluir esta conta:'
              : 'Digite sua senha para visualizar os detalhes da conta:'
        }
      />

      {showExportMenu && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowExportMenu(false)}
        />
      )}

      {showExportNfModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 md:p-6 w-full max-w-[calc(100vw-2rem)] shadow-xl border border-neutral-200">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">Novo Lote</h3>
                <span className="text-xs text-neutral-500">{filteredContasSorted.length} itens</span>
              </div>
              <p className="text-sm text-neutral-600">
                Defina o nome do lote detalhado e revise os dados antes de salvar.
              </p>
              <div className="mt-3">
                <label htmlFor="lote_nome" className="block text-sm font-medium text-neutral-700 mb-2">
                  Nome do Lote *
                </label>
                <input
                  id="lote_nome"
                  type="text"
                  value={loteNome}
                  onChange={(event) => {
                    setLoteNome(event.target.value);
                    if (loteNomeError) setLoteNomeError(null);
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="Ex: Lote Detalhado Fevereiro"
                />
                {loteNomeError && (
                  <div className="mt-2 text-xs text-red-600">
                    {loteNomeError}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleCreateResumidoLote}
                className="px-3 py-1 text-xs font-semibold uppercase border border-primary-200 rounded-full text-primary-600 hover:bg-primary-50 transition-colors"
              >
                Resumido
              </button>
              <button
                onClick={handleOpenEmailRecipientsModal}
                disabled={sendingEmail}
                className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase border border-primary-200 rounded-full text-primary-600 transition-colors ${
                  sendingEmail ? 'cursor-not-allowed opacity-60' : 'hover:bg-primary-50'
                }`}
              >
                <Mail className="h-3 w-3" />
                {sendingEmail ? 'ENVIANDO...' : 'ENVIAR EMAIL'}
              </button>
            </div>
            <div className="mt-4 border-t border-dashed border-neutral-200 pt-4">
              <div className="max-h-[72vh] overflow-y-auto pr-2">
                {filteredContasSorted.length === 0 ? (
                  <div className="text-xs text-neutral-500 text-center py-6 border border-dashed rounded-lg">
                    Nenhum registro selecionado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] border border-neutral-200 text-[9px] sm:text-[10px] rounded-lg bg-white">
                      <thead className="bg-neutral-100 text-[9px] uppercase tracking-wide text-neutral-500">
                        <tr>
                          {EXPORT_TABLE_COLUMNS.map((column) => {
                            const headerAlignClass =
                              column.align === 'center'
                                ? 'text-center'
                                : column.align === 'right'
                                  ? 'text-right'
                                  : 'text-left';
                            return (
                              <th
                                key={column.label}
                                className={`px-2 py-1 whitespace-nowrap font-semibold ${headerAlignClass}`}
                              >
                                {column.label}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 bg-white">
                        {filteredContasSorted.map((conta) => {
                          const entry = mergeExportEntryWithDefaults(conta, exportEntries[conta.id]);
                          return (
                            <tr key={conta.id} className="even:bg-neutral-50">
                              {EXPORT_TABLE_COLUMNS.map((column) => {
                                const bodyAlignClass =
                                  column.align === 'center'
                                    ? 'text-center'
                                    : column.align === 'right'
                                      ? 'text-right'
                                      : 'text-left';

                                if (column.readonly || !column.field) {
                                  const rawDisplayValue =
                                    column.field === undefined
                                      ? formatCurrency(conta.valor)
                                      : entry[column.field as ExportEntryField] ?? '';
                                  const displayValue = decodeLatin1IfNeeded(rawDisplayValue) ?? rawDisplayValue;
                                  return (
                                    <td
                                      key={`${conta.id}-${column.label}`}
                                      className={`px-2 py-1 text-xs sm:text-sm text-neutral-700 whitespace-nowrap font-semibold ${bodyAlignClass}`}
                                    >
                                      {displayValue}
                                    </td>
                                  );
                                }

                                const field = column.field as ExportEntryField;
                                const rawValue = entry[field] ?? '';
                                const value = decodeLatin1IfNeeded(rawValue) ?? rawValue;
                                const inputType = column.type === 'date' ? 'date' : 'text';
                                const inputAlignClass =
                                  column.align === 'center'
                                    ? 'text-center'
                                    : column.align === 'right'
                                      ? 'text-right'
                                      : 'text-left';
                                return (
                                  <td
                                    key={`${conta.id}-${column.label}`}
                                    className={`px-2 py-1 ${bodyAlignClass}`}
                                  >
                                    <input
                                      type={inputType}
                                      value={value}
                                      onChange={(event) => handleExportEntryChange(conta, field, event.target.value)}
                                      className={`w-full border border-neutral-200 rounded px-2 py-1 text-[10px] sm:text-xs focus:border-primary-500 focus:outline-none ${inputAlignClass}`}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  setShowExportNfModal(false);
                  setLoteNomeError(null);
                  setCurrentLoteId(null);
                }}
                className="px-4 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLoteDetalhado}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
              >
                Salvar Lote
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailRecipientsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-lg shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Enviar E-mail</h3>
              <button
                onClick={() => {
                  setShowEmailRecipientsModal(false);
                  setEmailRecipientsError(null);
                  setEmailContext(null);
                }}
                className="text-neutral-400 hover:text-neutral-600"
                disabled={sendingEmail}
              >
                Fechar
              </button>
            </div>
            <p className="text-sm text-neutral-600 mt-2">
              Gerencie os destinatarios. Os e-mails adicionados ficam salvos para os proximos envios.
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Destinatarios cadastrados
                </span>
                <span className="text-[11px] text-neutral-400">{emailRecipients.length}</span>
              </div>
              <div className="mt-2 max-h-24 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                {emailRecipients.length === 0 ? (
                  <div className="text-xs text-neutral-500">
                    Nenhum destinatario cadastrado.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {emailRecipients.map((recipient) => {
                      const isDefaultRecipient = defaultEmailRecipients.includes(recipient);
                      return (
                        <span
                          key={recipient}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs text-neutral-700 shadow-sm"
                        >
                          {recipient}
                          {isDefaultRecipient ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-700">
                              Padrao
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRemoveEmailRecipient(recipient)}
                              className="text-neutral-400 hover:text-neutral-600"
                              disabled={sendingEmail}
                              aria-label={`Remover ${recipient}`}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
            </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={emailRecipientInput}
                onChange={(event) => setEmailRecipientInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddEmailRecipient();
                  }
                }}
                className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="email@exemplo.com"
                disabled={sendingEmail}
              />
              <button
                onClick={handleAddEmailRecipient}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700"
                disabled={sendingEmail}
              >
                Adicionar
              </button>
            </div>
            {emailRecipientsError && (
              <div className="mt-2 text-xs text-red-600">
                {emailRecipientsError}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEmailRecipientsModal(false);
                  setEmailRecipientsError(null);
                  setEmailContext(null);
                }}
                className="px-4 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                disabled={sendingEmail}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSendEmail}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                disabled={sendingEmail}
              >
                {sendingEmail ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConsolidateLoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-2xl shadow-xl border border-neutral-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Fechar Lote</h3>
              <button
                onClick={() => {
                  setShowConsolidateLoteModal(false);
                  setConsolidateError(null);
                  setConsolidateSelection(new Set());
                }}
                className="text-neutral-400 hover:text-neutral-600"
              >
                Fechar
              </button>
            </div>
            <p className="text-sm text-neutral-600 mt-2">
              Selecione os lotes em aberto para consolidar. O novo lote sera salvo como{' '}
              <strong className="text-neutral-800">LOTE CONSOLIDADO {getMesVigenteLabel()}</strong>.
            </p>
            <div className="mt-4 max-h-[50vh] overflow-y-auto space-y-3 pr-1">
              {lotesAbertos.length === 0 ? (
                <div className="text-xs text-neutral-500 border border-dashed rounded-lg px-3 py-4 text-center">
                  Nenhum lote em aberto disponivel.
                </div>
              ) : (
                lotesAbertos.map((lote) => {
                  const checked = consolidateSelection.has(lote.id);
                  const hasResumido = lote.resumidoRows && lote.resumidoRows.length > 0;
                  const hasDetalhado = lote.detalhadoRows && lote.detalhadoRows.length > 0;
                  return (
                    <label
                      key={lote.id}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors cursor-pointer ${
                        checked ? 'border-primary-300 bg-primary-50' : 'border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleConsolidateSelection(lote.id)}
                        className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-neutral-900">{lote.nome}</span>
                          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                            {lote.origem === 'avulsa'
                              ? 'Avulsas'
                              : lote.origem === 'ressarcimento'
                                ? 'Ressarcimento'
                                : lote.origem === 'misto'
                                  ? 'Misto'
                                  : 'Fixas'}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                          <span>Itens: <strong className="font-semibold text-neutral-700">{lote.total}</strong></span>
                          <span className="text-neutral-300">•</span>
                          <span>Criado em: <strong className="font-semibold text-neutral-700">{formatDateTime(lote.criado_em)}</strong></span>
                          <span className="text-neutral-300">•</span>
                          <span className="inline-flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              hasResumido ? 'bg-primary-50 text-primary-700' : 'bg-neutral-100 text-neutral-400'
                            }`}>
                              Resumido
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              hasDetalhado ? 'bg-primary-50 text-primary-700' : 'bg-neutral-100 text-neutral-400'
                            }`}>
                              Detalhado
                            </span>
                          </span>
                          {lote.fechado && (() => {
                            const counts = getLoteCounts(lote);
                            return (
                              <>
                                <span className="text-neutral-300">•</span>
                                <span>Fixas: <strong className="font-semibold text-neutral-700">{counts.fixas}</strong></span>
                                <span>Avulsas: <strong className="font-semibold text-neutral-700">{counts.avulsas}</strong></span>
                                <span>Ressarcimento: <strong className="font-semibold text-neutral-700">{counts.ressarcimentos}</strong></span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            {consolidateError && (
              <div className="mt-3 text-xs text-red-600">
                {consolidateError}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowConsolidateLoteModal(false);
                  setConsolidateError(null);
                  setConsolidateSelection(new Set());
                }}
                className="px-4 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConsolidatedLote}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLoteId && editingLoteType && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-[calc(100vw-2rem)] shadow-lg border border-neutral-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  {editingLoteNome} - {editingLoteType === 'resumido' ? 'Resumido' : 'Detalhado'}
                </h3>
                <p className="text-sm text-neutral-600 mt-1">
                  {editingLoteReadOnly
                    ? 'VisualizaÃ§Ã£o do lote. EdiÃ§Ãµes estÃ£o bloqueadas.'
                    : 'Edite os dados do lote. Todos os campos sÃ£o editÃ¡veis.'}
                </p>
              </div>
              <button
                onClick={handleCancelEditLote}
                className="text-neutral-400 hover:text-neutral-600"
              >
                Fechar
              </button>
            </div>
            {editingLoteReadOnly && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(() => {
                  const counts = getRowsCounts(editingLoteRows);
                  const tabBase =
                    'px-3 py-1 text-[11px] font-semibold uppercase rounded-full border transition-colors';
                  return (
                    <>
                      <button
                        onClick={() => setEditingLoteTab('fixa')}
                        disabled={counts.fixas === 0}
                        className={`${tabBase} ${
                          editingLoteTab === 'fixa'
                            ? 'border-primary-200 text-primary-700 bg-primary-50'
                            : 'border-neutral-200 text-neutral-400'
                        } ${counts.fixas === 0 ? 'cursor-not-allowed' : 'hover:bg-primary-50'}`}
                      >
                        Fixas ({counts.fixas})
                      </button>
                      <button
                        onClick={() => setEditingLoteTab('avulsa')}
                        disabled={counts.avulsas === 0}
                        className={`${tabBase} ${
                          editingLoteTab === 'avulsa'
                            ? 'border-primary-200 text-primary-700 bg-primary-50'
                            : 'border-neutral-200 text-neutral-400'
                        } ${counts.avulsas === 0 ? 'cursor-not-allowed' : 'hover:bg-primary-50'}`}
                      >
                        Avulsas ({counts.avulsas})
                      </button>
                      <button
                        onClick={() => setEditingLoteTab('ressarcimento')}
                        disabled={counts.ressarcimentos === 0}
                        className={`${tabBase} ${
                          editingLoteTab === 'ressarcimento'
                            ? 'border-primary-200 text-primary-700 bg-primary-50'
                            : 'border-neutral-200 text-neutral-400'
                        } ${counts.ressarcimentos === 0 ? 'cursor-not-allowed' : 'hover:bg-primary-50'}`}
                      >
                        Ressarcimento ({counts.ressarcimentos})
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
            <div className="mt-4 overflow-x-auto">
              {(() => {
                const rowsToRender = editingLoteReadOnly
                  ? editingLoteRows.filter((row) => {
                    const tipo = getRowTipoRegistro(row as LoteRowDetalhado | LoteRowResumido);
                    if (editingLoteTab === 'avulsa') return tipo === 'avulsa';
                    if (editingLoteTab === 'ressarcimento') return tipo === 'ressarcimento';
                    return tipo === 'fixa';
                  })
                  : editingLoteRows;
                if (rowsToRender.length === 0) {
                  return (
                <div className="text-xs text-neutral-500 text-center py-6 border border-dashed rounded-lg">
                  {editingLoteReadOnly
                    ? `Nenhuma conta ${editingLoteTab === 'avulsa' ? 'avulsa' : editingLoteTab === 'ressarcimento' ? 'ressarcimento' : 'fixa'} no lote.`
                    : 'Nenhum registro no lote.'}
                </div>
                  );
                }
                return (
                <table className="w-full min-w-[1100px] border border-neutral-200 text-[9px] sm:text-[10px] rounded-lg bg-white">
                  <thead className="bg-neutral-100 text-[9px] uppercase tracking-wide text-neutral-500">
                    {editingLoteReadOnly && (
                      <tr className="bg-white">
                        <th
                          colSpan={(editingLoteType === 'resumido' ? LOTE_RESUMIDO_COLUMNS : LOTE_DETALHADO_COLUMNS).length}
                          className="px-2 py-2 text-left text-[10px] font-semibold text-neutral-700"
                        >
                          {(() => {
                            const counts = getRowsCounts(editingLoteRows);
                            return `Fixas: ${counts.fixas} | Avulsas: ${counts.avulsas} | Ressarcimento: ${counts.ressarcimentos}`;
                          })()}
                        </th>
                      </tr>
                    )}
                    <tr>
                      {(editingLoteType === 'resumido' ? LOTE_RESUMIDO_COLUMNS : LOTE_DETALHADO_COLUMNS).map((column) => {
                        const headerAlignClass =
                          column.align === 'center'
                            ? 'text-center'
                            : column.align === 'right'
                              ? 'text-right'
                              : 'text-left';
                        return (
                          <th
                            key={column.label}
                            className={`px-2 py-1 whitespace-nowrap font-semibold ${headerAlignClass}`}
                          >
                            {column.label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {rowsToRender.map((row) => (
                      <tr key={row.id} className="even:bg-neutral-50">
                        {(editingLoteType === 'resumido' ? LOTE_RESUMIDO_COLUMNS : LOTE_DETALHADO_COLUMNS).map((column) => {
                          const bodyAlignClass =
                            column.align === 'center'
                              ? 'text-center'
                              : column.align === 'right'
                                ? 'text-right'
                                : 'text-left';
                          const rawValue = (row as Record<string, string>)[column.field as string] ?? '';
                          const baseValue = decodeLatin1IfNeeded(rawValue) ?? rawValue;
                          const isReadOnlyColumn = column.readonly;
                          const isValorField = column.field === 'valor';
                          const value = isValorField
                            ? formatBRLFromInput(baseValue)
                            : baseValue;
                          const inputType = column.type === 'date' ? 'date' : 'text';
                          const inputAlignClass =
                            column.align === 'center'
                              ? 'text-center'
                              : column.align === 'right'
                                ? 'text-right'
                                : 'text-left';
                          return (
                            <td
                              key={`${row.id}-${column.label}`}
                              className={`px-2 py-1 ${bodyAlignClass}`}
                            >
                              {isReadOnlyColumn ? (
                                <span className="inline-flex min-h-[24px] items-center px-2 text-[10px] sm:text-xs text-neutral-700">
                                  {value || '—'}
                                </span>
                              ) : (
                                <input
                                  type={inputType}
                                  value={value}
                                  onChange={(event) => {
                                    const nextValue = isValorField ? formatBRLFromInput(event.target.value) : event.target.value;
                                    if (!editingLoteReadOnly) {
                                      handleEditLoteFieldChange(row.id, column.field as string, nextValue);
                                    }
                                  }}
                                  readOnly={editingLoteReadOnly}
                                  className={`w-full border border-neutral-200 rounded px-2 py-1 text-[10px] sm:text-xs focus:border-primary-500 focus:outline-none ${inputAlignClass} ${
                                    editingLoteReadOnly ? 'bg-neutral-100 text-neutral-500' : ''
                                  }`}
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                );
              })()}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={handleCancelEditLote}
                className="px-4 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              {editingLoteType === 'detalhado' && !editingLoteReadOnly && (
                <button
                  onClick={() => {
                    const rows = buildDetalhadoEmailRows(editingLoteRows as LoteRowDetalhado[]);
                    handleOpenEmailRecipientsModal({ columns: XLSX_EXPORT_HEADERS, rows });
                  }}
                  disabled={sendingEmail}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-200 text-sm font-medium text-primary-700 transition-colors ${
                    sendingEmail ? 'cursor-not-allowed opacity-60' : 'hover:bg-primary-50'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  {sendingEmail ? 'Enviando...' : 'Enviar Email'}
                </button>
              )}
              <button
                onClick={handleExportEditingLote}
                className="px-4 py-2 rounded-lg border border-primary-200 text-sm font-medium text-primary-700 hover:bg-primary-50"
              >
                Exportar
              </button>
              {!editingLoteReadOnly && (
                <button
                  onClick={handleSaveEditLote}
                  className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                >
                  Salvar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showNextWeekModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-2xl w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-2">Fornecedores da Proxima Semana</h2>
            <p className="text-xs sm:text-sm text-neutral-600 mb-4">
              Lista de fornecedores com vencimento na semana seguinte.
            </p>
            <div className="text-xs sm:text-sm text-neutral-700">
              <div className="font-medium text-neutral-900 mb-2">Fornecedores:</div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {nextWeekSuppliers.length === 0 && (
                  <li className="border border-neutral-200 rounded-lg px-3 py-2 text-neutral-500">
                    Nenhum fornecedor encontrado.
                  </li>
                )}
                {nextWeekSuppliers.map((item) => (
                  <li key={item.id} className="border border-neutral-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                    <span>{item.fornecedor}</span>
                    <div className="flex items-center gap-2 text-neutral-500">
                      <span>Dia {formatDay(item.vencimento)}</span>
                      {item.status === 'Enviado financeiro' && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      {item.status === 'Emitido pendente assinatura' && (
                        <CheckCircle className="h-4 w-4 text-yellow-500" />
                      )}
                      {item.status === 'Nao emitido' && (
                        <Ban className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 sm:mt-6 text-right">
              <button
                onClick={() => setShowNextWeekModal(false)}
                className="px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs sm:text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContasAPagar;




