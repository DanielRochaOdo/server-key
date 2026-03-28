import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Pencil, Plus, RefreshCw, Save, Settings, Share, Trash2, X } from 'lucide-react';
import ModuleHeader from '../components/ModuleHeader';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  createParqueProduto,
  getParquePermissoes,
  getParqueProdutoLabel,
  listParqueCadastrosLinks,
  getParqueProdutoStatus,
  listParqueCatalogos,
  listParqueHistoricoProduto,
  listParqueItemParametroLinks,
  listParqueParametrosLinks,
  listParqueMovimentacoes,
  listParquePedidosEntregues,
  listParqueProdutos,
  listParqueDestinoSetorLinks,
  registerParqueDescarte,
  registerParqueMovimentacao,
  replaceParqueCadastroLinks,
  saveParqueDestinoSetorLink,
  saveParqueBaseCadastro,
  saveParqueParametroLink,
  saveParqueItemParametroLink,
  deleteParqueBaseCadastro,
  deleteParqueProduto,
  updateParqueProduto,
} from '../services/parqueTecnologico';
import type {
  ParqueCadastroLink,
  ParqueBaseCadastroTipo,
  ParqueCatalogos,
  ParqueDestinoSetorLink,
  ParqueDescarteFormValues,
  ParqueItemParametroLink,
  ParqueParametroLink,
  ParqueMovimentacao,
  ParqueMovimentacaoFormValues,
  ParquePedidoCompraEntregue,
  ParqueProduto,
  ParqueProdutoFormValues,
} from '../types/parqueTecnologico';

const initialCatalogos: ParqueCatalogos = {
  itens: [],
  unidades: [],
  marcas: [],
  categorias_produto: [],
  especificacoes_produto: [],
  setores: [],
  tipos_movimentacao: [],
  tipos_origem: [],
  tipos_destino: [],
  descricoes_destino: [],
};

const inputClassName =
  'mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100';

const buttonClassName =
  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition';

const overlayClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4';
const modalClassName = 'w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900/95';
const PARQUE_UI_STATE_KEY = 'serverkey:parque_tecnologico_ui';

const emptyProdutoForm: ParqueProdutoFormValues = {
  item_base_id: '',
  categoria: '',
  especificacao_valor: '',
  unidade_base_id: '',
  marca_base_id: '',
  quantidade_inicial: '',
  quantidade_minima: '',
  ativo: true,
  observacao_inicial: '',
};

const emptyMovimentacaoForm: ParqueMovimentacaoFormValues = {
  produto_id: '',
  tipo_movimentacao: 'entrada_manual',
  quantidade: '',
  valor_unitario: '',
  origem_tipo: 'pre-cadastro',
  origem_descricao: 'PRE-CADASTRO',
  destino_tipo: 'estoque',
  destino_descricao: 'PARQUE TECNOLÓGICO',
  data_movimentacao: new Date().toISOString().slice(0, 16),
  observacao: '',
  pedido_compra_id: '',
  setor_destino: '',
};

const emptyDescarteForm: ParqueDescarteFormValues = {
  produto_id: '',
  quantidade: '',
  data_descarte: new Date().toISOString().slice(0, 16),
  motivo: '',
  observacao: '',
};

interface ParqueUiState {
  search: string;
  itemFilter: string;
  categoriaFilter: string;
  marcaFilter: string;
  unidadeFilter: string;
  statusFilter: string;
  estoqueBaixoOnly: boolean;
  tipoFilter: string;
  origemFilter: string;
  destinoFilter: string;
  clinicaFilter: string;
  setorFilter: string;
  startDate: string;
  endDate: string;
  produtoForm: ParqueProdutoFormValues;
  movimentacaoForm: ParqueMovimentacaoFormValues;
  movimentacaoProdutoBusca: string;
  descarteForm: ParqueDescarteFormValues;
  showProductModal: boolean;
  showAjustesPanel: boolean;
  showMovimentacaoModal: boolean;
  showDescarteModal: boolean;
  showPedidosPendentesModal: boolean;
  baseForms: {
    itens: { id: string; nome: string; sigla: string; ativo: boolean };
    unidades: { id: string; nome: string; sigla: string; ativo: boolean };
    marcas: { id: string; nome: string; sigla: string; ativo: boolean };
    categorias_produto: { id: string; nome: string; sigla: string; ativo: boolean };
    especificacoes_produto: { id: string; nome: string; sigla: string; ativo: boolean };
    setores: { id: string; nome: string; sigla: string; ativo: boolean };
    tipos_movimentacao: { id: string; nome: string; sigla: string; ativo: boolean };
    tipos_origem: { id: string; nome: string; sigla: string; ativo: boolean };
    tipos_destino: { id: string; nome: string; sigla: string; ativo: boolean };
    descricoes_destino: { id: string; nome: string; sigla: string; ativo: boolean };
  };
}

const loadParqueUiState = (): ParqueUiState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PARQUE_UI_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ParqueUiState;
  } catch {
    return null;
  }
};

const saveParqueUiState = (state: ParqueUiState) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PARQUE_UI_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

const movementBadgeClass = (tipo: string) => {
  const base = 'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide';
  const map: Record<string, string> = {
    entrada_manual: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
    entrada_compra: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200',
    saida_clinica: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
    saida_setor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200',
    transferencia: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200',
    ajuste_positivo: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-200',
    ajuste_negativo: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
    descarte: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200',
  };
  return `${base} ${map[tipo] || 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'}`;
};

const statusBadgeClass = (status: string) => {
  if (status === 'estoque_baixo') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200';
  if (status === 'inativo') return 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200';
};

const numberValue = (value: number | '') => (value === '' ? '' : String(value));

const resolvePedidoValorUnitario = (pedido?: ParquePedidoCompraEntregue | null) => {
  if (!pedido) return '';
  if (Number(pedido.valor_unit || 0) > 0) return Number(pedido.valor_unit);
  if (Number(pedido.quantidade || 0) > 0 && Number(pedido.valor_total_frete || 0) > 0) {
    return Number((Number(pedido.valor_total_frete) / Number(pedido.quantidade)).toFixed(2));
  }
  return '';
};

const extractLojaFromOrigemLabel = (origemLabel?: string | null) => {
  const normalized = normalizeLookupText(origemLabel || '');
  if (!normalized) return '';
  const parts = normalized
    .split('•')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  const candidate = parts[parts.length - 1];
  if (!candidate) return '';
  if (/^(QTD|SALDO)\b/.test(candidate)) return '';
  if (/^\d{2}\/\d{4}$/.test(candidate)) return '';
  return candidate;
};

const resolvePedidoLojaOrigem = (pedido?: ParquePedidoCompraEntregue | null) =>
  normalizeLookupText(pedido?.loja || extractLojaFromOrigemLabel(pedido?.origem_label) || '');

const normalizeLookupText = (value?: string | null) =>
  String(value || '')
    .trim()
    .toUpperCase();

const normalizeComparableText = (value?: string | null) =>
  normalizeLookupText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

const normalizeClinicKey = (value?: string | null) => {
  const normalized = normalizeLookupText(value);
  if (!normalized) return null;
  if (normalized.includes('AGUANAMBI')) return 'AGUANAMBI';
  if (normalized.includes('BEZERRA')) return 'BEZERRA';
  if (normalized.includes('PARANGABA')) return 'PARANGABA';
  if (normalized.includes('SOBRAL')) return 'SOBRAL';
  if (normalized.includes('MATRIZ') || normalized.includes('ADMIN') || normalized.includes('ADM')) return 'MATRIZ';
  return null;
};

const resolveDestinoFromHistorico = (destino?: string | null) => {
  const destinoNormalizado = normalizeLookupText(destino);
  if (!destinoNormalizado) {
    return {
      destinoTipo: 'estoque',
      destinoDescricao: DESTINO_PARQUE_TECNOLOGICO,
      setorDestino: '',
    };
  }

  if (destinoNormalizado.startsWith('MATRIZ -')) {
    const setor = normalizeLookupText(destinoNormalizado.replace(/^MATRIZ\s*-\s*/i, ''));
    if (setor) {
      return {
        destinoTipo: 'setor',
        destinoDescricao: `MATRIZ - ${setor}`,
        setorDestino: setor,
      };
    }
  }

  const clinicKey = normalizeClinicKey(destinoNormalizado);
  if (clinicKey && clinicKey !== 'MATRIZ') {
    return {
      destinoTipo: 'clinica',
      destinoDescricao: clinicKey,
      setorDestino: '',
    };
  }

  return {
    destinoTipo: 'estoque',
    destinoDescricao: DESTINO_PARQUE_TECNOLOGICO,
    setorDestino: '',
  };
};

const isLikelySameItem = (candidate?: string | null, pedidoItem?: string | null) => {
  const left = normalizeComparableText(candidate);
  const right = normalizeComparableText(pedidoItem);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const inferPedidoEspecificacao = (pedidoItem?: string | null, itemBaseNome?: string | null) => {
  const pedido = normalizeLookupText(pedidoItem);
  const itemBase = normalizeLookupText(itemBaseNome);
  if (!pedido || !itemBase) return '';

  const itemRegex = new RegExp(`\\b${escapeRegExp(itemBase)}\\b`, 'g');
  const stripped = pedido.replace(itemRegex, ' ').replace(/\s+/g, ' ').trim();
  return stripped || '';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const toDateTimeLocalInput = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 16);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const resolvePedidoDataMovimentacao = (
  pedido: ParquePedidoCompraEntregue,
  destinoAtribuidoEm?: string | null
) => {
  if (destinoAtribuidoEm) return toDateTimeLocalInput(destinoAtribuidoEm);
  const ano = Number(pedido.ano || 0);
  const mes = Number(pedido.mes || 0);
  if (Number.isFinite(ano) && Number.isFinite(mes) && ano > 1900 && mes >= 1 && mes <= 12) {
    return `${ano}-${String(mes).padStart(2, '0')}-01T09:00`;
  }
  return toDateTimeLocalInput();
};

const formatUpperText = (value?: string | null) => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.toUpperCase() : '-';
};

const formatMovementTypeLabel = (tipo: string) => tipo.replace(/_/g, ' ').toUpperCase();

const getMovimentacaoProdutoOptionLabel = (produto: ParqueProduto) =>
  `${formatUpperText(getParqueProdutoLabel(produto))} • SALDO ${Number(produto.quantidade_atual || 0).toLocaleString('pt-BR')}`;

const parametroCategoriaLabel = (categoria: ParqueBaseCadastroTipo) => {
  if (categoria === 'itens') return 'TIPO DE ITEM';
  if (categoria === 'unidades') return 'UNIDADE';
  if (categoria === 'marcas') return 'MARCA';
  if (categoria === 'categorias_produto') return 'CATEGORIA';
  if (categoria === 'especificacoes_produto') return 'ESPECIFICAÇÃO';
  if (categoria === 'setores') return 'SETOR';
  if (categoria === 'tipos_movimentacao') return 'AÇÃO';
  if (categoria === 'tipos_origem') return 'ORIGEM';
  if (categoria === 'tipos_destino') return 'TIPO DESTINO';
  if (categoria === 'descricoes_destino') return 'DESTINO';
  return 'PARÂMETRO';
};

const DESTINO_PARQUE_TECNOLOGICO = 'PARQUE TECNOLÓGICO';
const ORIGENS_FIXAS = ['compra', 'pre-cadastro', 'estoque'] as const;
const CLINICAS_FALLBACK = ['AGUANAMBI', 'BEZERRA', 'PARANGABA', 'SOBRAL'] as const;
const SETORES_MATRIZ_FIXOS = ['TI', 'ADM', 'CALL CENTER', 'CREDENCIAMENTO', 'FINANCEIRO', 'DP', 'RH'] as const;
const TIPOS_MOVIMENTACAO_FIXOS: Array<ParqueMovimentacaoFormValues['tipo_movimentacao']> = [
  'entrada_compra',
  'entrada_manual',
  'saida_clinica',
  'saida_setor',
  'descarte',
];
const PARAMETROS_LINKAVEIS: ParqueBaseCadastroTipo[] = [
  'categorias_produto',
  'especificacoes_produto',
  'setores',
];
const MATRIZ_SETOR_PADRAO = 'TI';
const MATRIZ_SETOR_PREFIXO = 'SETOR MATRIZ:';

const removerSetorMatrizDaObservacao = (observacao?: string | null) =>
  String(observacao || '')
    .replace(/SETOR MATRIZ:\s*[^\n;|]+[;|]?\s*/gi, '')
    .trim();

const aplicarSetorMatrizNaObservacao = (observacao?: string | null, setor = MATRIZ_SETOR_PADRAO) => {
  const base = removerSetorMatrizDaObservacao(observacao).toUpperCase();
  const setorNormalizado = normalizeLookupText(setor);
  if (!setorNormalizado) return base;
  const tag = `${MATRIZ_SETOR_PREFIXO} ${setorNormalizado}`;
  return base ? `${tag} | ${base}` : tag;
};

const extrairSetorMatrizDaObservacao = (observacao?: string | null) => {
  const match = normalizeLookupText(observacao).match(/SETOR MATRIZ:\s*([A-Z0-9 /._-]+)/);
  return match?.[1]?.trim() || '';
};

interface Props {
  mode: 'estoque' | 'inventario';
}

export default function ParqueTecnologico({ mode }: Props) {
  const { hasModuleAccess, hasModuleEditAccess, isAdmin, isOwner } = useAuth();
  const permissoes = getParquePermissoes({
    canRead: hasModuleAccess('parque_tecnologico'),
    canEdit: hasModuleEditAccess('parque_tecnologico'),
    isAdmin: isAdmin(),
    isOwner: isOwner(),
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [catalogos, setCatalogos] = useState<ParqueCatalogos>(initialCatalogos);
  const [produtos, setProdutos] = useState<ParqueProduto[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<ParqueMovimentacao[]>([]);
  const [pedidosEntregues, setPedidosEntregues] = useState<ParquePedidoCompraEntregue[]>([]);
  const [custosClinicasHistory, setCustosClinicasHistory] = useState<Array<{ product: string | null; clinic: string | null; created_at: string | null }>>([]);
  const initialUiStateRef = React.useRef<ParqueUiState | null>(loadParqueUiState());
  const initialUiState = initialUiStateRef.current;

  const [search, setSearch] = useState(() => initialUiState?.search ?? '');
  const [itemFilter, setItemFilter] = useState(() => initialUiState?.itemFilter ?? '');
  const [categoriaFilter, setCategoriaFilter] = useState(() => initialUiState?.categoriaFilter ?? '');
  const [marcaFilter, setMarcaFilter] = useState(() => initialUiState?.marcaFilter ?? '');
  const [unidadeFilter, setUnidadeFilter] = useState(() => initialUiState?.unidadeFilter ?? '');
  const [statusFilter, setStatusFilter] = useState(() => initialUiState?.statusFilter ?? '');
  const [estoqueBaixoOnly, setEstoqueBaixoOnly] = useState(() => initialUiState?.estoqueBaixoOnly ?? false);
  const [tipoFilter, setTipoFilter] = useState(() => initialUiState?.tipoFilter ?? '');
  const [origemFilter, setOrigemFilter] = useState(() => initialUiState?.origemFilter ?? '');
  const [destinoFilter, setDestinoFilter] = useState(() => initialUiState?.destinoFilter ?? '');
  const [clinicaFilter, setClinicaFilter] = useState(() => initialUiState?.clinicaFilter ?? '');
  const [setorFilter, setSetorFilter] = useState(() => initialUiState?.setorFilter ?? '');
  const [startDate, setStartDate] = useState(() => initialUiState?.startDate ?? '');
  const [endDate, setEndDate] = useState(() => initialUiState?.endDate ?? '');
  const [showProductModal, setShowProductModal] = useState(() => initialUiState?.showProductModal ?? false);
  const [showAjustesPanel, setShowAjustesPanel] = useState(() => initialUiState?.showAjustesPanel ?? false);
  const [showMovimentacaoModal, setShowMovimentacaoModal] = useState(() => initialUiState?.showMovimentacaoModal ?? false);
  const [showDescarteModal, setShowDescarteModal] = useState(() => initialUiState?.showDescarteModal ?? false);
  const [showPedidosPendentesModal, setShowPedidosPendentesModal] = useState(() => initialUiState?.showPedidosPendentesModal ?? false);
  const [lastPendingPedidosCount, setLastPendingPedidosCount] = useState(0);
  const [editingProduto, setEditingProduto] = useState<ParqueProduto | null>(null);
  const [historyProduto, setHistoryProduto] = useState<ParqueProduto | null>(null);
  const [historyRows, setHistoryRows] = useState<ParqueMovimentacao[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [itemParametroLinks, setItemParametroLinks] = useState<ParqueItemParametroLink[]>([]);
  const [parametrosLinks, setParametrosLinks] = useState<ParqueParametroLink[]>([]);
  const [cadastrosLinks, setCadastrosLinks] = useState<ParqueCadastroLink[]>([]);
  const [destinoSetorLinks, setDestinoSetorLinks] = useState<ParqueDestinoSetorLink[]>([]);
  const [showItemLinkModal, setShowItemLinkModal] = useState(false);
  const [showParametroLinkModal, setShowParametroLinkModal] = useState(false);
  const [showCadastroLinkModal, setShowCadastroLinkModal] = useState(false);
  const [showDestinoSetorModal, setShowDestinoSetorModal] = useState(false);
  const [itemLinkForm, setItemLinkForm] = useState<{
    id: string;
    item_base_id: string;
    categoria_parametro_id: string;
    especificacao_parametro_id: string;
    unidade_base_id: string;
    marca_base_id: string;
    ativo: boolean;
  }>({
    id: '',
    item_base_id: '',
    categoria_parametro_id: '',
    especificacao_parametro_id: '',
    unidade_base_id: '',
    marca_base_id: '',
    ativo: true,
  });
  const [destinoSetorForm, setDestinoSetorForm] = useState<{
    id: string;
    destino_parametro_id: string;
    setor_parametro_id: string;
    ativo: boolean;
  }>({
    id: '',
    destino_parametro_id: '',
    setor_parametro_id: '',
    ativo: true,
  });
  const [parametroLinkForm, setParametroLinkForm] = useState<{
    id: string;
    origem_parametro_id: string;
    destino_parametro_id: string;
    ativo: boolean;
  }>({
    id: '',
    origem_parametro_id: '',
    destino_parametro_id: '',
    ativo: true,
  });
  const [cadastroLinkForm, setCadastroLinkForm] = useState<{
    origem_tipo: ParqueBaseCadastroTipo;
    origem_id: string;
    destino_tipo: ParqueBaseCadastroTipo;
    destino_ids: string[];
  }>({
    origem_tipo: 'itens',
    origem_id: '',
    destino_tipo: 'itens',
    destino_ids: [],
  });
  const [produtoForm, setProdutoForm] = useState<ParqueProdutoFormValues>(() => ({
    ...emptyProdutoForm,
    ...(initialUiState?.produtoForm || {}),
  }));
  const [movimentacaoForm, setMovimentacaoForm] = useState<ParqueMovimentacaoFormValues>(() => ({
    ...emptyMovimentacaoForm,
    ...(initialUiState?.movimentacaoForm || {}),
  }));
  const [movimentacaoProdutoBusca, setMovimentacaoProdutoBusca] = useState(
    () => initialUiState?.movimentacaoProdutoBusca ?? ''
  );
  const [movimentacaoProdutoBuscaFocused, setMovimentacaoProdutoBuscaFocused] = useState(false);
  const [movimentacaoProdutoBuscaDirty, setMovimentacaoProdutoBuscaDirty] = useState(false);
  const [descarteForm, setDescarteForm] = useState<ParqueDescarteFormValues>(() => ({
    ...emptyDescarteForm,
    ...(initialUiState?.descarteForm || {}),
  }));
  const [formError, setFormError] = useState('');
  const [baseForms, setBaseForms] = useState(() => ({
    itens: { id: '', nome: '', sigla: '', ativo: true, ...(initialUiState?.baseForms?.itens || {}) },
    unidades: { id: '', nome: '', sigla: '', ativo: true, ...(initialUiState?.baseForms?.unidades || {}) },
    marcas: { id: '', nome: '', sigla: '', ativo: true, ...(initialUiState?.baseForms?.marcas || {}) },
    categorias_produto: { id: '', nome: '', sigla: '', ativo: true, ...(initialUiState?.baseForms?.categorias_produto || {}) },
    especificacoes_produto: { id: '', nome: '', sigla: '', ativo: true, ...(initialUiState?.baseForms?.especificacoes_produto || {}) },
    setores: { id: '', nome: '', sigla: '', ativo: true, ...(initialUiState?.baseForms?.setores || {}) },
    tipos_movimentacao: { id: '', nome: '', sigla: '', ativo: true, ...(initialUiState?.baseForms?.tipos_movimentacao || {}) },
    tipos_origem: { id: '', nome: '', sigla: '', ativo: true, ...(initialUiState?.baseForms?.tipos_origem || {}) },
    tipos_destino: { id: '', nome: '', sigla: '', ativo: true, ...(initialUiState?.baseForms?.tipos_destino || {}) },
    descricoes_destino: { id: '', nome: '', sigla: '', ativo: true, ...(initialUiState?.baseForms?.descricoes_destino || {}) },
  }));
  const [baseInlineEdit, setBaseInlineEdit] = useState<
    Partial<Record<ParqueBaseCadastroTipo, { id: string; nome: string; sigla: string; ativo: boolean }>>
  >({});
  const [baseFeedback, setBaseFeedback] = useState<Record<ParqueBaseCadastroTipo, { type: 'info' | 'success' | 'error'; message: string } | null>>({
    itens: null,
    unidades: null,
    marcas: null,
    categorias_produto: null,
    especificacoes_produto: null,
    setores: null,
    tipos_movimentacao: null,
    tipos_origem: null,
    tipos_destino: null,
    descricoes_destino: null,
  });
  const baseNameInputRefs = React.useRef<Record<ParqueBaseCadastroTipo, HTMLInputElement | null>>({
    itens: null,
    unidades: null,
    marcas: null,
    categorias_produto: null,
    especificacoes_produto: null,
    setores: null,
    tipos_movimentacao: null,
    tipos_origem: null,
    tipos_destino: null,
    descricoes_destino: null,
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [catalogosData, produtosData, movimentosData, pedidosData, custosHistoryRes] = await Promise.all([
        listParqueCatalogos(),
        listParqueProdutos(),
        listParqueMovimentacoes(),
        listParquePedidosEntregues(),
        supabase
          .from('custos_clinicas_movements')
          .select('product, clinic, created_at')
          .order('created_at', { ascending: false })
          .limit(5000),
      ]);
      const [itemLinksRes, parametroLinksRes, cadastroLinksRes, destinoSetorRes] = await Promise.allSettled([
        listParqueItemParametroLinks(),
        listParqueParametrosLinks(),
        listParqueCadastrosLinks(),
        listParqueDestinoSetorLinks(),
      ]);
      setCatalogos(catalogosData);
      setProdutos(produtosData);
      setMovimentacoes(movimentosData);
      setPedidosEntregues(pedidosData);
      if (itemLinksRes.status === 'fulfilled') {
        setItemParametroLinks(itemLinksRes.value);
      } else {
        console.warn('Não foi possível carregar vínculos de item x parâmetros:', itemLinksRes.reason);
        setItemParametroLinks([]);
      }
      if (parametroLinksRes.status === 'fulfilled') {
        setParametrosLinks(parametroLinksRes.value);
      } else {
        console.warn('Não foi possível carregar vínculos entre parâmetros:', parametroLinksRes.reason);
        setParametrosLinks([]);
      }
      if (cadastroLinksRes.status === 'fulfilled') {
        setCadastrosLinks(cadastroLinksRes.value);
      } else {
        console.warn('Não foi possível carregar vínculos gerais entre cadastros:', cadastroLinksRes.reason);
        setCadastrosLinks([]);
      }
      if (destinoSetorRes.status === 'fulfilled') {
        setDestinoSetorLinks(destinoSetorRes.value);
      } else {
        console.warn('Não foi possível carregar vínculos de destino x setor:', destinoSetorRes.reason);
        setDestinoSetorLinks([]);
      }
      if (custosHistoryRes.error) {
        console.warn('Não foi possível carregar histórico de custos das clínicas para sugestão de destino:', custosHistoryRes.error);
        setCustosClinicasHistory([]);
      } else {
        setCustosClinicasHistory((custosHistoryRes.data || []) as Array<{ product: string | null; clinic: string | null; created_at: string | null }>);
      }
    } catch (error) {
      console.error('Erro ao carregar Parque Tecnológico:', error);
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Erro ao carregar módulo.' });
    } finally {
      setLoading(false);
    }
  };

  const refreshAjustesData = async () => {
    const [catalogosData, itemLinksRes, parametroLinksRes, cadastroLinksRes, destinoSetorRes] =
      await Promise.all([
        listParqueCatalogos(),
        listParqueItemParametroLinks().catch((error) => {
          console.warn('Não foi possível recarregar vínculos de item x parâmetros:', error);
          return [] as ParqueItemParametroLink[];
        }),
        listParqueParametrosLinks().catch((error) => {
          console.warn('Não foi possível recarregar vínculos entre parâmetros:', error);
          return [] as ParqueParametroLink[];
        }),
        listParqueCadastrosLinks().catch((error) => {
          console.warn('Não foi possível recarregar vínculos gerais entre cadastros:', error);
          return [] as ParqueCadastroLink[];
        }),
        listParqueDestinoSetorLinks().catch((error) => {
          console.warn('Não foi possível recarregar vínculos de destino x setor:', error);
          return [] as ParqueDestinoSetorLink[];
        }),
      ]);

    setCatalogos(catalogosData);
    setItemParametroLinks(itemLinksRes);
    setParametrosLinks(parametroLinksRes);
    setCadastrosLinks(cadastroLinksRes);
    setDestinoSetorLinks(destinoSetorRes);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (mode !== 'estoque') return;
    if (pedidosEntregues.length <= 0) {
      setLastPendingPedidosCount(0);
      return;
    }
    if (pedidosEntregues.length > lastPendingPedidosCount) {
      setToast({
        type: 'success',
        message: `${pedidosEntregues.length} pedido(s) entregue(s) disponível(is) para inclusão no Estoque.`,
      });
    }
    setLastPendingPedidosCount(pedidosEntregues.length);
  }, [mode, pedidosEntregues, lastPendingPedidosCount]);

  useEffect(() => {
    saveParqueUiState({
      search,
      itemFilter,
      categoriaFilter,
      marcaFilter,
      unidadeFilter,
      statusFilter,
      estoqueBaixoOnly,
      tipoFilter,
      origemFilter,
      destinoFilter,
      clinicaFilter,
      setorFilter,
      startDate,
      endDate,
      produtoForm,
      movimentacaoForm,
      movimentacaoProdutoBusca,
      descarteForm,
      showProductModal,
      showAjustesPanel,
      showMovimentacaoModal,
      showDescarteModal,
      showPedidosPendentesModal,
      baseForms,
    });
  }, [
    search,
    itemFilter,
    categoriaFilter,
    marcaFilter,
    unidadeFilter,
    statusFilter,
    estoqueBaixoOnly,
    tipoFilter,
    origemFilter,
    destinoFilter,
    clinicaFilter,
    setorFilter,
    startDate,
    endDate,
    produtoForm,
    movimentacaoForm,
    movimentacaoProdutoBusca,
    descarteForm,
    showProductModal,
    showAjustesPanel,
    showMovimentacaoModal,
    showDescarteModal,
    showPedidosPendentesModal,
    baseForms,
  ]);

  const filteredProdutos = useMemo(() => {
    const searchTerm = normalizeComparableText(search);
    return produtos.filter((produto) => {
      const status = getParqueProdutoStatus(produto);
      const searchable = normalizeComparableText(
        [
          getParqueProdutoLabel(produto),
          produto.item_base?.nome,
          produto.categoria,
          produto.especificacao_valor,
          produto.marca_base?.nome,
          produto.unidade_base?.nome,
          produto.unidade_base?.sigla,
          status,
        ]
          .filter(Boolean)
          .join(' ')
      );
      const matchesSearch = !searchTerm || searchable.includes(searchTerm);
      const matchesItem = !itemFilter || produto.item_base_id === itemFilter;
      const matchesCategoria = !categoriaFilter || produto.categoria.toLowerCase().includes(categoriaFilter.toLowerCase());
      const matchesMarca = !marcaFilter || produto.marca_base_id === marcaFilter;
      const matchesUnidade = !unidadeFilter || produto.unidade_base_id === unidadeFilter;
      const matchesStatus = !statusFilter || status === statusFilter;
      const matchesEstoqueBaixo = !estoqueBaixoOnly || status === 'estoque_baixo';
      return matchesSearch && matchesItem && matchesCategoria && matchesMarca && matchesUnidade && matchesStatus && matchesEstoqueBaixo;
    });
  }, [produtos, search, itemFilter, categoriaFilter, marcaFilter, unidadeFilter, statusFilter, estoqueBaixoOnly]);

  const filteredMovimentacoes = useMemo(() => {
    return movimentacoes.filter((movimento) => {
      const label = getParqueProdutoLabel(movimento.produto).toLowerCase();
      const matchesSearch = !search || label.includes(search.toLowerCase()) || String(movimento.observacao || '').toLowerCase().includes(search.toLowerCase());
      const matchesItem = !itemFilter || movimento.produto?.item_base_id === itemFilter;
      const matchesTipo = !tipoFilter || movimento.tipo_movimentacao === tipoFilter;
      const matchesOrigem = !origemFilter || movimento.origem_tipo === origemFilter;
      const matchesDestino = !destinoFilter || movimento.destino_tipo === destinoFilter;
      const matchesClinica = !clinicaFilter || (movimento.destino_tipo === 'clinica' && String(movimento.destino_descricao || '').toLowerCase().includes(clinicaFilter.toLowerCase()));
      const matchesSetor =
        !setorFilter ||
        [movimento.origem_descricao, movimento.destino_descricao, movimento.observacao]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(setorFilter.toLowerCase()));
      const date = movimento.data_movimentacao.slice(0, 10);
      const matchesStart = !startDate || date >= startDate;
      const matchesEnd = !endDate || date <= endDate;
      return matchesSearch && matchesItem && matchesTipo && matchesOrigem && matchesDestino && matchesClinica && matchesSetor && matchesStart && matchesEnd;
    });
  }, [movimentacoes, search, itemFilter, tipoFilter, origemFilter, destinoFilter, clinicaFilter, setorFilter, startDate, endDate]);

  const lojaOrigemCompraByProdutoId = useMemo(() => {
    const map = new Map<string, string>();
    const ordenadas = [...movimentacoes].sort((a, b) => {
      const aTs = new Date(a.data_movimentacao || a.created_at || '').getTime();
      const bTs = new Date(b.data_movimentacao || b.created_at || '').getTime();
      return bTs - aTs;
    });

    ordenadas.forEach((movimento) => {
      if (movimento.tipo_movimentacao !== 'entrada_compra') return;
      if (!movimento.produto_id || map.has(movimento.produto_id)) return;
      const loja = normalizeLookupText(movimento.origem_descricao);
      if (!loja || loja === 'COMPRA') return;
      map.set(movimento.produto_id, loja);
    });

    const pedidosComLoja = pedidosEntregues
      .map((pedido) => ({
        ...pedido,
        loja_resolvida: resolvePedidoLojaOrigem(pedido),
      }))
      .filter((pedido) => Boolean(pedido.loja_resolvida));

    if (pedidosComLoja.length > 0) {
      produtos.forEach((produto) => {
        if (!produto.id || map.has(produto.id)) return;

        const itemComparable = normalizeComparableText(produto.item_base?.nome);
        const especificacaoComparable = normalizeComparableText(produto.especificacao_valor);
        const labelComparable = normalizeComparableText(getParqueProdutoLabel(produto));

        let bestMatch: { loja: string; score: number; ano: number; mes: number } | null = null;

        pedidosComLoja.forEach((pedido) => {
          const pedidoComparable = normalizeComparableText(pedido.item);
          if (!pedidoComparable) return;

          let score = 0;
          if (itemComparable && (pedidoComparable.includes(itemComparable) || itemComparable.includes(pedidoComparable))) {
            score += 40;
          }
          if (especificacaoComparable && pedidoComparable.includes(especificacaoComparable)) {
            score += 40;
          }
          if (labelComparable && (labelComparable.includes(pedidoComparable) || pedidoComparable.includes(labelComparable))) {
            score += 20;
          }
          if (score <= 0) return;

          const candidato = {
            loja: pedido.loja_resolvida,
            score,
            ano: Number(pedido.ano || 0),
            mes: Number(pedido.mes || 0),
          };

          if (
            !bestMatch ||
            candidato.score > bestMatch.score ||
            (candidato.score === bestMatch.score &&
              (candidato.ano > bestMatch.ano ||
                (candidato.ano === bestMatch.ano && candidato.mes > bestMatch.mes)))
          ) {
            bestMatch = candidato;
          }
        });

        if (bestMatch?.loja) {
          map.set(produto.id, bestMatch.loja);
        }
      });
    }

    return map;
  }, [movimentacoes, pedidosEntregues, produtos]);

  const resolveLojaOrigemCompraProduto = (produtoId?: string | null) => {
    if (!produtoId) return '';
    return lojaOrigemCompraByProdutoId.get(produtoId) || '';
  };

  const produtosMovimentacaoOptions = useMemo(
    () =>
      produtos
        .filter((produto) => produto.ativo)
        .slice()
        .sort((a, b) => getParqueProdutoLabel(a).localeCompare(getParqueProdutoLabel(b), 'pt-BR')),
    [produtos]
  );

  const produtosMovimentacaoComboboxOptions = useMemo(
    () =>
      produtosMovimentacaoOptions.map((produto) => ({
        id: produto.id,
        produto,
        label: getMovimentacaoProdutoOptionLabel(produto),
        searchable: normalizeComparableText(
          `${getParqueProdutoLabel(produto)} ${produto.categoria} ${produto.especificacao_valor || ''}`
        ),
      })),
    [produtosMovimentacaoOptions]
  );

  const produtoBuscaSuggestions = useMemo(() => {
    const term = normalizeComparableText(movimentacaoProdutoBusca);
    if (!term) return produtosMovimentacaoComboboxOptions.slice(0, 8);
    return produtosMovimentacaoComboboxOptions
      .filter((option) => option.searchable.includes(term))
      .slice(0, 8);
  }, [movimentacaoProdutoBusca, produtosMovimentacaoComboboxOptions]);

  const findProdutoByComboboxLabel = (value: string) => {
    const target = normalizeComparableText(value);
    if (!target) return null;
    return (
      produtosMovimentacaoComboboxOptions.find(
        (option) => normalizeComparableText(option.label) === target
      ) || null
    );
  };

  useEffect(() => {
    if (movimentacaoProdutoBuscaDirty || movimentacaoProdutoBuscaFocused) return;
    if (!movimentacaoForm.produto_id) {
      if (movimentacaoProdutoBusca) setMovimentacaoProdutoBusca('');
      return;
    }
    const selectedOption = produtosMovimentacaoComboboxOptions.find(
      (option) => option.id === movimentacaoForm.produto_id
    );
    const nextLabel = selectedOption?.label || '';
    if (nextLabel !== movimentacaoProdutoBusca) {
      setMovimentacaoProdutoBusca(nextLabel);
    }
  }, [
    movimentacaoForm.produto_id,
    movimentacaoProdutoBuscaDirty,
    movimentacaoProdutoBuscaFocused,
    movimentacaoProdutoBusca,
    produtosMovimentacaoComboboxOptions,
  ]);

  useEffect(() => {
    if (movimentacaoForm.tipo_movimentacao !== 'entrada_compra') return;
    if (movimentacaoForm.origem_tipo === 'compra') return;
    setMovimentacaoForm((prev) => ({ ...prev, origem_tipo: 'compra' }));
  }, [movimentacaoForm.tipo_movimentacao, movimentacaoForm.origem_tipo]);

  useEffect(() => {
    if (movimentacaoForm.tipo_movimentacao === 'entrada_compra') return;
    if (normalizeLookupText(movimentacaoForm.origem_tipo) !== 'COMPRA') return;
    const loja = resolveLojaOrigemCompraProduto(movimentacaoForm.produto_id);
    if (!loja) return;
    if (normalizeLookupText(movimentacaoForm.origem_descricao) === loja) return;
    setMovimentacaoForm((prev) => ({ ...prev, origem_descricao: loja }));
  }, [
    movimentacaoForm.tipo_movimentacao,
    movimentacaoForm.origem_tipo,
    movimentacaoForm.produto_id,
    movimentacaoForm.origem_descricao,
    lojaOrigemCompraByProdutoId,
  ]);

  const hasEstoqueFiltersApplied = Boolean(
    search ||
      itemFilter ||
      categoriaFilter ||
      marcaFilter ||
      unidadeFilter ||
      statusFilter ||
      estoqueBaixoOnly
  );

  const hasInventarioFiltersApplied = Boolean(
    search ||
      itemFilter ||
      tipoFilter ||
      origemFilter ||
      destinoFilter ||
      clinicaFilter ||
      setorFilter ||
      startDate ||
      endDate
  );

  const clearEstoqueFilters = () => {
    setSearch('');
    setItemFilter('');
    setCategoriaFilter('');
    setMarcaFilter('');
    setUnidadeFilter('');
    setStatusFilter('');
    setEstoqueBaixoOnly(false);
  };

  const clearInventarioFilters = () => {
    setSearch('');
    setItemFilter('');
    setTipoFilter('');
    setOrigemFilter('');
    setDestinoFilter('');
    setClinicaFilter('');
    setSetorFilter('');
    setStartDate('');
    setEndDate('');
  };

  const clearCurrentModeFilters = () => {
    if (mode === 'estoque') {
      clearEstoqueFilters();
      return;
    }
    clearInventarioFilters();
  };

  const categoriaOptions = useMemo(() => {
    const base = catalogos.categorias_produto
      .filter((item) => item.ativo)
      .map((item) => normalizeLookupText(item.nome))
      .filter(Boolean);
    const existentes = produtos
      .map((produto) => normalizeLookupText(produto.categoria))
      .filter(Boolean);
    return Array.from(new Set([...base, ...existentes])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [catalogos.categorias_produto, produtos]);

  const especificacaoOptions = useMemo(() => {
    const base = catalogos.especificacoes_produto
      .filter((item) => item.ativo)
      .map((item) => normalizeLookupText(item.nome))
      .filter(Boolean);
    const existentes = produtos
      .map((produto) => normalizeLookupText(produto.especificacao_valor))
      .filter(Boolean);
    return Array.from(new Set([...base, ...existentes])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [catalogos.especificacoes_produto, produtos]);

  const produtoCategoriaOptions = useMemo(() => {
    const set = new Set(categoriaOptions);
    const current = normalizeLookupText(produtoForm.categoria);
    if (current) set.add(current);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [categoriaOptions, produtoForm.categoria]);

  const produtoEspecificacaoOptions = useMemo(() => {
    const set = new Set(especificacaoOptions);
    const current = normalizeLookupText(produtoForm.especificacao_valor);
    if (current) set.add(current);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [especificacaoOptions, produtoForm.especificacao_valor]);
  const tipoMovimentacaoOptions = useMemo(() => TIPOS_MOVIMENTACAO_FIXOS, []);

  const tipoMovimentacaoLabelMap = useMemo(() => {
    const map = new Map<string, string>();

    const fallbackKeys = TIPOS_MOVIMENTACAO_FIXOS;

    fallbackKeys.forEach((key) => {
      const normalizedKey = normalizeLookupText(key);
      if (map.has(normalizedKey)) return;
      const suffix = normalizeLookupText(key.split('_').slice(-1)[0] || '');
      if (suffix && map.has(suffix)) {
        map.set(normalizedKey, map.get(suffix) || formatMovementTypeLabel(key));
        return;
      }
      map.set(normalizedKey, formatMovementTypeLabel(key));
    });

    return map;
  }, []);

  const getTipoMovimentacaoLabel = (tipo: string) =>
    tipoMovimentacaoLabelMap.get(normalizeLookupText(tipo)) || formatMovementTypeLabel(tipo);

  const origemTipoOptions = useMemo(() => [...ORIGENS_FIXAS], []);

  const setorOptions = useMemo(() => {
    return [...SETORES_MATRIZ_FIXOS];
  }, []);

  const clinicaDestinoOptions = useMemo(() => {
    const fromHistory = custosClinicasHistory
      .map((row) => normalizeClinicKey(row.clinic))
      .filter((clinic): clinic is string => Boolean(clinic) && clinic !== 'MATRIZ');
    return Array.from(new Set([...CLINICAS_FALLBACK, ...fromHistory])).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
  }, [custosClinicasHistory]);

  const destinoOptions = useMemo(() => {
    const matrizSetorOptions = setorOptions.map((setor) => `MATRIZ - ${setor}`);
    if (movimentacaoForm.tipo_movimentacao === 'descarte') return ['DESCARTE'];
    if (movimentacaoForm.tipo_movimentacao === 'saida_setor') {
      return matrizSetorOptions;
    }
    if (movimentacaoForm.tipo_movimentacao === 'saida_clinica') return [...clinicaDestinoOptions];
    return [DESTINO_PARQUE_TECNOLOGICO, ...clinicaDestinoOptions, ...matrizSetorOptions];
  }, [clinicaDestinoOptions, movimentacaoForm.tipo_movimentacao, setorOptions]);

  const itemLinkByItemId = useMemo(() => {
    const map = new Map<string, ParqueItemParametroLink>();
    itemParametroLinks
      .filter((link) => link.ativo)
      .forEach((link) => {
        if (!map.has(link.item_base_id)) {
          map.set(link.item_base_id, link);
        }
      });
    return map;
  }, [itemParametroLinks]);

  const destinoSetorByDestinoNome = useMemo(() => {
    const map = new Map<string, ParqueDestinoSetorLink>();
    destinoSetorLinks
      .filter((link) => link.ativo)
      .forEach((link) => {
        const nome = normalizeLookupText(link.destino_parametro?.nome);
        if (!nome || map.has(nome)) return;
        map.set(nome, link);
      });
    return map;
  }, [destinoSetorLinks]);

  const parametrosLinkByOrigemId = useMemo(() => {
    const map = new Map<string, ParqueParametroLink>();
    parametrosLinks
      .filter((link) => link.ativo)
      .forEach((link) => {
        if (!map.has(link.origem_parametro_id)) {
          map.set(link.origem_parametro_id, link);
        }
      });
    return map;
  }, [parametrosLinks]);

  const parametrosLinkOptions = useMemo(
    () => [
      ...catalogos.categorias_produto.map((item) => ({ ...item, tipo: 'categorias_produto' as ParqueBaseCadastroTipo })),
      ...catalogos.especificacoes_produto.map((item) => ({ ...item, tipo: 'especificacoes_produto' as ParqueBaseCadastroTipo })),
      ...catalogos.setores.map((item) => ({ ...item, tipo: 'setores' as ParqueBaseCadastroTipo })),
      ...catalogos.tipos_movimentacao.map((item) => ({ ...item, tipo: 'tipos_movimentacao' as ParqueBaseCadastroTipo })),
      ...catalogos.tipos_origem.map((item) => ({ ...item, tipo: 'tipos_origem' as ParqueBaseCadastroTipo })),
      ...catalogos.tipos_destino.map((item) => ({ ...item, tipo: 'tipos_destino' as ParqueBaseCadastroTipo })),
      ...catalogos.descricoes_destino.map((item) => ({ ...item, tipo: 'descricoes_destino' as ParqueBaseCadastroTipo })),
    ].filter((item) => item.ativo),
    [
      catalogos.categorias_produto,
      catalogos.especificacoes_produto,
      catalogos.setores,
      catalogos.tipos_movimentacao,
      catalogos.tipos_origem,
      catalogos.tipos_destino,
      catalogos.descricoes_destino,
    ]
  );

  const cadastroLinkOptions = useMemo(
    () => [
      ...catalogos.itens.map((item) => ({ ...item, tipo: 'itens' as ParqueBaseCadastroTipo })),
      ...catalogos.unidades.map((item) => ({ ...item, tipo: 'unidades' as ParqueBaseCadastroTipo })),
      ...catalogos.marcas.map((item) => ({ ...item, tipo: 'marcas' as ParqueBaseCadastroTipo })),
      ...catalogos.categorias_produto.map((item) => ({ ...item, tipo: 'categorias_produto' as ParqueBaseCadastroTipo })),
      ...catalogos.especificacoes_produto.map((item) => ({ ...item, tipo: 'especificacoes_produto' as ParqueBaseCadastroTipo })),
      ...catalogos.setores.map((item) => ({ ...item, tipo: 'setores' as ParqueBaseCadastroTipo })),
      ...catalogos.tipos_movimentacao.map((item) => ({ ...item, tipo: 'tipos_movimentacao' as ParqueBaseCadastroTipo })),
      ...catalogos.tipos_origem.map((item) => ({ ...item, tipo: 'tipos_origem' as ParqueBaseCadastroTipo })),
      ...catalogos.tipos_destino.map((item) => ({ ...item, tipo: 'tipos_destino' as ParqueBaseCadastroTipo })),
      ...catalogos.descricoes_destino.map((item) => ({ ...item, tipo: 'descricoes_destino' as ParqueBaseCadastroTipo })),
    ].filter((item) => item.ativo),
    [
      catalogos.itens,
      catalogos.unidades,
      catalogos.marcas,
      catalogos.categorias_produto,
      catalogos.especificacoes_produto,
      catalogos.setores,
      catalogos.tipos_movimentacao,
      catalogos.tipos_origem,
      catalogos.tipos_destino,
      catalogos.descricoes_destino,
    ]
  );

  const cadastroLinkByOrigemKey = useMemo(() => {
    const map = new Map<string, ParqueCadastroLink[]>();
    cadastrosLinks
      .filter((link) => link.ativo)
      .forEach((link) => {
        const key = `${link.origem_tipo}:${link.origem_id}`;
        const current = map.get(key) || [];
        current.push(link);
        map.set(key, current);
      });
    return map;
  }, [cadastrosLinks]);

  const cadastroNomeByKey = useMemo(() => {
    const map = new Map<string, string>();
    cadastroLinkOptions.forEach((item) => {
      map.set(`${item.tipo}:${item.id}`, item.nome);
    });
    return map;
  }, [cadastroLinkOptions]);

  const inventorySummary = useMemo(() => {
    return filteredMovimentacoes.reduce(
      (acc, movimento) => {
        acc.total += 1;
        if (
          movimento.tipo_movimentacao === 'entrada_manual' ||
          movimento.tipo_movimentacao === 'entrada_compra' ||
          movimento.tipo_movimentacao === 'ajuste_positivo'
        ) {
          acc.entradas += movimento.quantidade;
        }
        if (
          movimento.tipo_movimentacao === 'saida_clinica' ||
          movimento.tipo_movimentacao === 'saida_setor' ||
          movimento.tipo_movimentacao === 'transferencia' ||
          movimento.tipo_movimentacao === 'ajuste_negativo'
        ) {
          acc.saidas += movimento.quantidade;
        }
        if (movimento.tipo_movimentacao === 'descarte') {
          acc.descartes += movimento.quantidade;
        }
        return acc;
      },
      { total: 0, entradas: 0, saidas: 0, descartes: 0 }
    );
  }, [filteredMovimentacoes]);

  const clinicHistoryByItem = useMemo(() => {
    const map = new Map<string, { clinic: string; assignedAt: string | null }>();
    const ordered = [...movimentacoes].sort((a, b) => {
      const aTs = new Date(a.data_movimentacao || a.created_at || '').getTime();
      const bTs = new Date(b.data_movimentacao || b.created_at || '').getTime();
      return bTs - aTs;
    });

    ordered.forEach((movimento) => {
      if (movimento.tipo_movimentacao !== 'saida_clinica') return;
      const clinic = normalizeClinicKey(movimento.destino_descricao);
      const itemKey = normalizeLookupText(movimento.produto?.item_base?.nome);
      if (!clinic || !itemKey || map.has(itemKey)) return;
      map.set(itemKey, {
        clinic,
        assignedAt: movimento.data_movimentacao || movimento.created_at || null,
      });
    });

    return map;
  }, [movimentacoes]);

  const pedidosEntreguesComDestino = useMemo(
    () =>
      pedidosEntregues.map((pedido) => {
        const bySetor = normalizeClinicKey(pedido.setor);
        const byHistorico = clinicHistoryByItem.get(normalizeLookupText(pedido.item)) || null;
        const byCustosHistoricoRow = custosClinicasHistory.find((row) =>
          isLikelySameItem(row.product, pedido.item)
        );
        const byCustosHistorico = normalizeClinicKey(byCustosHistoricoRow?.clinic);
        const destinoClinica = bySetor || byHistorico?.clinic || byCustosHistorico;
        const destinoAtribuidoEm =
          byHistorico?.assignedAt ||
          byCustosHistoricoRow?.created_at ||
          null;
        return {
          ...pedido,
          destino_clinica: destinoClinica,
          destino_atribuido_em: destinoAtribuidoEm,
        };
      }),
    [pedidosEntregues, clinicHistoryByItem, custosClinicasHistory]
  );

  const pedidoEntregaSelecionado = useMemo(
    () => pedidosEntreguesComDestino.find((row) => row.id === movimentacaoForm.pedido_compra_id) || null,
    [pedidosEntreguesComDestino, movimentacaoForm.pedido_compra_id]
  );

  const pedidoCompraSugeridoByProdutoId = useMemo(() => {
    const map = new Map<string, (typeof pedidosEntreguesComDestino)[number]>();
    const pedidosComSaldo = [...pedidosEntreguesComDestino]
      .filter((pedido) => Number(pedido.quantidade_disponivel || 0) > 0)
      .sort((a, b) => {
        if ((b.ano || 0) !== (a.ano || 0)) return (b.ano || 0) - (a.ano || 0);
        if ((b.mes || 0) !== (a.mes || 0)) return (b.mes || 0) - (a.mes || 0);
        return String(b.id).localeCompare(String(a.id));
      });

    pedidosComSaldo.forEach((pedido) => {
      const pedidoComparable = normalizeComparableText(pedido.item);
      if (!pedidoComparable) return;

      let bestProduto: ParqueProduto | null = null;
      let bestScore = 0;

      produtos.forEach((produto) => {
        const itemComparable = normalizeComparableText(produto.item_base?.nome);
        const especificacaoComparable = normalizeComparableText(produto.especificacao_valor);
        const labelComparable = normalizeComparableText(getParqueProdutoLabel(produto));

        let score = 0;
        if (itemComparable && (pedidoComparable.includes(itemComparable) || itemComparable.includes(pedidoComparable))) {
          score += 50;
        }
        if (especificacaoComparable && pedidoComparable.includes(especificacaoComparable)) {
          score += 30;
        }
        if (labelComparable && (labelComparable.includes(pedidoComparable) || pedidoComparable.includes(labelComparable))) {
          score += 20;
        }

        if (score > bestScore) {
          bestScore = score;
          bestProduto = produto;
        }
      });

      if (bestProduto?.id && bestScore > 0 && !map.has(bestProduto.id)) {
        map.set(bestProduto.id, pedido);
      }
    });

    return map;
  }, [pedidosEntreguesComDestino, produtos]);

  const saldoCompraDisponivel = useMemo(() => {
    if (movimentacaoForm.tipo_movimentacao !== 'entrada_compra') return 0;
    const pedido =
      pedidoEntregaSelecionado ||
      (movimentacaoForm.produto_id ? pedidoCompraSugeridoByProdutoId.get(movimentacaoForm.produto_id) : null);
    return Number(pedido?.quantidade_disponivel || 0);
  }, [
    movimentacaoForm.tipo_movimentacao,
    movimentacaoForm.produto_id,
    pedidoEntregaSelecionado,
    pedidoCompraSugeridoByProdutoId,
  ]);

  useEffect(() => {
    if (movimentacaoForm.tipo_movimentacao !== 'entrada_compra') return;
    if (!movimentacaoForm.produto_id) return;
    if (movimentacaoForm.pedido_compra_id) return;

    const pedido = pedidoCompraSugeridoByProdutoId.get(movimentacaoForm.produto_id);
    if (!pedido) return;

    const destinoSugerido = resolveDestinoFromHistorico(pedido.destino_clinica);
    const lojaOrigem = resolvePedidoLojaOrigem(pedido);

    setMovimentacaoForm((prev) => {
      if (prev.tipo_movimentacao !== 'entrada_compra') return prev;
      if (prev.produto_id !== movimentacaoForm.produto_id) return prev;
      if (prev.pedido_compra_id) return prev;
      return {
        ...prev,
        pedido_compra_id: pedido.id,
        quantidade: Number(pedido.quantidade_disponivel || 0) > 0 ? Number(pedido.quantidade_disponivel) : prev.quantidade,
        origem_tipo: 'compra',
        origem_descricao: lojaOrigem || prev.origem_descricao,
        valor_unitario: resolvePedidoValorUnitario(pedido),
        data_movimentacao: resolvePedidoDataMovimentacao(pedido, pedido.destino_atribuido_em),
        destino_tipo: destinoSugerido.destinoTipo,
        destino_descricao: destinoSugerido.destinoDescricao,
        setor_destino: destinoSugerido.setorDestino,
      };
    });
  }, [
    movimentacaoForm.tipo_movimentacao,
    movimentacaoForm.produto_id,
    movimentacaoForm.pedido_compra_id,
    pedidoCompraSugeridoByProdutoId,
  ]);

  const lojaOrigemSelecionada = useMemo(() => {
    if (movimentacaoForm.tipo_movimentacao === 'entrada_compra') {
      return resolvePedidoLojaOrigem(pedidoEntregaSelecionado) || normalizeLookupText(movimentacaoForm.origem_descricao);
    }
    return normalizeLookupText(movimentacaoForm.origem_descricao);
  }, [movimentacaoForm.tipo_movimentacao, movimentacaoForm.origem_descricao, pedidoEntregaSelecionado]);

  useEffect(() => {
    if (movimentacaoForm.tipo_movimentacao !== 'entrada_compra') return;
    if (!pedidoEntregaSelecionado) return;
    const loja = resolvePedidoLojaOrigem(pedidoEntregaSelecionado);
    if (!loja) return;
    if (movimentacaoForm.origem_tipo === 'compra' && normalizeLookupText(movimentacaoForm.origem_descricao) === loja) {
      return;
    }
    setMovimentacaoForm((prev) => ({
      ...prev,
      origem_tipo: 'compra',
      origem_descricao: loja,
    }));
  }, [
    movimentacaoForm.tipo_movimentacao,
    movimentacaoForm.origem_tipo,
    movimentacaoForm.origem_descricao,
    pedidoEntregaSelecionado,
  ]);

  const findProdutoByPedidoItem = (pedidoItem?: string | null) => {
    if (!pedidoItem) return null;
    const pedidoComparable = normalizeComparableText(pedidoItem);
    const scored = produtos
      .map((produto) => {
        const itemNome = produto.item_base?.nome || '';
        const label = getParqueProdutoLabel(produto);
        const itemComparable = normalizeComparableText(itemNome);
        const labelComparable = normalizeComparableText(label);
        const especificacaoComparable = normalizeComparableText(produto.especificacao_valor);

        let score = 0;
        if (isLikelySameItem(itemNome, pedidoItem)) score += 20;
        if (labelComparable && pedidoComparable && labelComparable === pedidoComparable) score += 100;
        else if (labelComparable && pedidoComparable && (labelComparable.includes(pedidoComparable) || pedidoComparable.includes(labelComparable))) score += 60;
        if (especificacaoComparable && pedidoComparable.includes(especificacaoComparable)) score += 40;
        if (
          especificacaoComparable &&
          pedidoComparable &&
          pedidoComparable.includes(itemComparable) &&
          !pedidoComparable.includes(especificacaoComparable)
        ) {
          score -= 10;
        }

        return { produto, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.produto || null;
  };

  const findItemBaseByPedidoItem = (pedidoItem?: string | null) => {
    if (!pedidoItem) return null;
    return (
      catalogos.itens.find((itemBase) => itemBase.ativo && isLikelySameItem(itemBase.nome, pedidoItem)) ||
      null
    );
  };

  const ensureProdutoFromPedido = async (pedido?: ParquePedidoCompraEntregue | null) => {
    if (!pedido?.item) {
      throw new Error('Pedido sem item informado.');
    }

    const produtoExistente = findProdutoByPedidoItem(pedido.item);
    if (produtoExistente?.id) return produtoExistente.id;

    const nomeItem = normalizeLookupText(pedido.item);
    let itemBase = findItemBaseByPedidoItem(pedido.item);

    if (!itemBase) {
      const { error: upsertError } = await supabase
        .from('parque_itens_base')
        .upsert({ nome: nomeItem, ativo: true }, { onConflict: 'nome' });
      if (upsertError) throw upsertError;

      const { data: itemRow, error: itemError } = await supabase
        .from('parque_itens_base')
        .select('id, nome, ativo')
        .eq('nome', nomeItem)
        .maybeSingle();
      if (itemError) throw itemError;
      if (!itemRow?.id) {
        throw new Error('Não foi possível criar/identificar o item base automaticamente.');
      }

      itemBase = {
        id: itemRow.id,
        nome: itemRow.nome || nomeItem,
        ativo: Boolean(itemRow.ativo),
      };
    }

    const especificacaoInferida = inferPedidoEspecificacao(pedido.item, itemBase?.nome || pedido.item);

    const { data: produtoRows, error: produtoLookupError } = await supabase
      .from('parque_produtos')
      .select('id, especificacao_valor')
      .eq('item_base_id', itemBase.id)
      .eq('categoria', 'TECNOLOGIA')
      .is('unidade_base_id', null)
      .is('marca_base_id', null);

    if (produtoLookupError) throw produtoLookupError;

    const especificacaoNormalizada = normalizeLookupText(especificacaoInferida);
    const produtoComEspecificacao = (produtoRows || []).find(
      (row: { id: string; especificacao_valor?: string | null }) =>
        normalizeLookupText(row.especificacao_valor) === especificacaoNormalizada
    );
    if (produtoComEspecificacao?.id) return produtoComEspecificacao.id;

    const produtoSemEspecificacao = (produtoRows || []).find(
      (row: { id: string; especificacao_valor?: string | null }) =>
        !normalizeLookupText(row.especificacao_valor)
    );
    if (produtoSemEspecificacao?.id) return produtoSemEspecificacao.id;

    try {
      return await createParqueProduto({
        item_base_id: itemBase.id,
        categoria: 'TECNOLOGIA',
        especificacao_valor: especificacaoInferida,
        unidade_base_id: '',
        marca_base_id: '',
        quantidade_inicial: '',
        quantidade_minima: '',
        ativo: true,
        observacao_inicial: `CRIADO AUTOMATICAMENTE A PARTIR DO PEDIDO ${pedido.origem_label || pedido.item || ''}`.trim(),
      });
    } catch (error) {
      const maybeCode = (error as { code?: string } | null)?.code;
      if (maybeCode !== '23505') throw error;

      const { data: retryProdutoRows, error: retryLookupError } = await supabase
        .from('parque_produtos')
        .select('id, especificacao_valor')
        .eq('item_base_id', itemBase.id)
        .eq('categoria', 'TECNOLOGIA')
        .is('unidade_base_id', null)
        .is('marca_base_id', null);
      if (retryLookupError) throw retryLookupError;
      const retryMatch = (retryProdutoRows || []).find(
        (row: { id: string; especificacao_valor?: string | null }) =>
          normalizeLookupText(row.especificacao_valor) === especificacaoNormalizada
      );
      if (retryMatch?.id) return retryMatch.id;
      const retryWithoutSpec = (retryProdutoRows || []).find(
        (row: { id: string; especificacao_valor?: string | null }) =>
          !normalizeLookupText(row.especificacao_valor)
      );
      if (retryWithoutSpec?.id) return retryWithoutSpec.id;
      throw error;
    }
  };

  const applyLinkedProdutoParams = (itemBaseId: string, keepValues = false) => {
    const linked = itemLinkByItemId.get(itemBaseId);
    if (!linked) return;
    setProdutoForm((prev) => ({
      ...prev,
      categoria: linked.categoria_parametro?.nome || (keepValues ? prev.categoria : ''),
      especificacao_valor: linked.especificacao_parametro?.nome || (keepValues ? prev.especificacao_valor : ''),
      unidade_base_id: linked.unidade_base_id || (keepValues ? prev.unidade_base_id : ''),
      marca_base_id: linked.marca_base_id || (keepValues ? prev.marca_base_id : ''),
    }));
    setToast({ type: 'success', message: 'Parâmetros linkados aplicados ao produto.' });
  };

  const openItemLinkModal = (itemBaseId?: string) => {
    const selectedItemId = itemBaseId || produtoForm.item_base_id || '';
    const linked = selectedItemId ? itemParametroLinks.find((item) => item.item_base_id === selectedItemId) : null;
    setItemLinkForm({
      id: linked?.id || '',
      item_base_id: selectedItemId,
      categoria_parametro_id: linked?.categoria_parametro_id || '',
      especificacao_parametro_id: linked?.especificacao_parametro_id || '',
      unidade_base_id: linked?.unidade_base_id || '',
      marca_base_id: linked?.marca_base_id || '',
      ativo: linked?.ativo ?? true,
    });
    setFormError('');
    setShowItemLinkModal(true);
  };

  const openParametroLinkModal = (origemParametroId: string) => {
    const linked = parametrosLinks.find((item) => item.origem_parametro_id === origemParametroId) || null;
    setParametroLinkForm({
      id: linked?.id || '',
      origem_parametro_id: origemParametroId,
      destino_parametro_id: linked?.destino_parametro_id || '',
      ativo: linked?.ativo ?? true,
    });
    setFormError('');
    setShowParametroLinkModal(true);
  };

  const openCadastroLinkModal = (origemTipo: ParqueBaseCadastroTipo, origemId: string) => {
    const linked = cadastrosLinks.filter((item) => item.origem_tipo === origemTipo && item.origem_id === origemId);
    const origemNome = getBaseListByTipo(origemTipo).find((item) => item.id === origemId)?.nome || '';
    const defaultDestinoTipo =
      origemTipo === 'tipos_origem' && normalizeLookupText(origemNome) === 'CLINICA' ? 'descricoes_destino' : origemTipo;
    const selectedDestinoTipo = linked[0]?.destino_tipo || defaultDestinoTipo;
    setCadastroLinkForm({
      origem_tipo: origemTipo,
      origem_id: origemId,
      destino_tipo: selectedDestinoTipo,
      destino_ids: getCadastroLinkDestinoIds(origemTipo, origemId, selectedDestinoTipo),
    });
    setFormError('');
    setShowCadastroLinkModal(true);
  };

  const handleSaveItemLink = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (!itemLinkForm.item_base_id) throw new Error('Selecione o tipo de item.');
      await saveParqueItemParametroLink({
        id: itemLinkForm.id || undefined,
        item_base_id: itemLinkForm.item_base_id,
        categoria_parametro_id: itemLinkForm.categoria_parametro_id || null,
        especificacao_parametro_id: itemLinkForm.especificacao_parametro_id || null,
        unidade_base_id: itemLinkForm.unidade_base_id || null,
        marca_base_id: itemLinkForm.marca_base_id || null,
        ativo: itemLinkForm.ativo,
      });
      setToast({ type: 'success', message: 'Vínculo de parâmetros salvo.' });
      setShowItemLinkModal(false);
      await refreshAjustesData();
      if (itemLinkForm.item_base_id) {
        applyLinkedProdutoParams(itemLinkForm.item_base_id, true);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao salvar vínculo de parâmetros.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDestinoSetorLink = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (!destinoSetorForm.destino_parametro_id) throw new Error('Selecione o destino.');
      if (!destinoSetorForm.setor_parametro_id) throw new Error('Selecione o setor.');
      await saveParqueDestinoSetorLink({
        id: destinoSetorForm.id || undefined,
        destino_parametro_id: destinoSetorForm.destino_parametro_id,
        setor_parametro_id: destinoSetorForm.setor_parametro_id,
        ativo: destinoSetorForm.ativo,
      });
      const destinoNome =
        catalogos.descricoes_destino.find((item) => item.id === destinoSetorForm.destino_parametro_id)?.nome || '';
      const setorNome =
        catalogos.setores.find((item) => item.id === destinoSetorForm.setor_parametro_id)?.nome || '';
      if (normalizeLookupText(destinoNome) === normalizeLookupText(movimentacaoForm.destino_descricao)) {
        setMovimentacaoForm((prev) => ({
          ...prev,
          setor_destino: normalizeLookupText(setorNome),
          observacao:
            prev.tipo_movimentacao === 'saida_clinica' &&
            normalizeClinicKey(prev.destino_descricao) === 'MATRIZ' &&
            setorNome
              ? aplicarSetorMatrizNaObservacao(prev.observacao, setorNome)
              : prev.observacao,
        }));
      }
      setToast({ type: 'success', message: 'Vínculo de destino x setor salvo.' });
      setShowDestinoSetorModal(false);
      await refreshAjustesData();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao salvar vínculo de destino.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveParametroLink = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (!parametroLinkForm.origem_parametro_id) throw new Error('Selecione o parâmetro de origem.');
      if (!parametroLinkForm.destino_parametro_id) throw new Error('Selecione o parâmetro de destino.');
      if (parametroLinkForm.origem_parametro_id === parametroLinkForm.destino_parametro_id) {
        throw new Error('Origem e destino do vínculo não podem ser iguais.');
      }
      await saveParqueParametroLink({
        id: parametroLinkForm.id || undefined,
        origem_parametro_id: parametroLinkForm.origem_parametro_id,
        destino_parametro_id: parametroLinkForm.destino_parametro_id,
        ativo: parametroLinkForm.ativo,
      });
      setToast({ type: 'success', message: 'Vínculo de parâmetro salvo.' });
      setShowParametroLinkModal(false);
      await refreshAjustesData();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao salvar vínculo entre parâmetros.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCadastroLink = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (!cadastroLinkForm.origem_tipo || !cadastroLinkForm.origem_id) {
        throw new Error('Selecione o cadastro de origem.');
      }
      if (!cadastroLinkForm.destino_tipo || cadastroLinkForm.destino_ids.length === 0) {
        throw new Error('Selecione ao menos um cadastro de destino.');
      }

      const hasSelfLink =
        cadastroLinkForm.origem_tipo === cadastroLinkForm.destino_tipo &&
        cadastroLinkForm.destino_ids.includes(cadastroLinkForm.origem_id);

      if (hasSelfLink) {
        throw new Error('Origem e destino não podem ser iguais.');
      }

      await replaceParqueCadastroLinks({
        origem_tipo: cadastroLinkForm.origem_tipo,
        origem_id: cadastroLinkForm.origem_id,
        destino_tipo: cadastroLinkForm.destino_tipo,
        destino_ids: cadastroLinkForm.destino_ids,
      });
      setToast({ type: 'success', message: 'Vínculo do cadastro salvo.' });
      setShowCadastroLinkModal(false);
      await loadAll();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao salvar vínculo do cadastro.');
    } finally {
      setSaving(false);
    }
  };

  const resetProdutoForm = (produto?: ParqueProduto | null) => {
    setEditingProduto(produto || null);
    setProdutoForm(produto ? {
      item_base_id: produto.item_base_id,
      categoria: normalizeLookupText(produto.categoria),
      especificacao_valor: normalizeLookupText(produto.especificacao_valor),
      unidade_base_id: produto.unidade_base_id || '',
      marca_base_id: produto.marca_base_id || '',
      quantidade_inicial: '',
      quantidade_minima: produto.quantidade_minima ?? '',
      ativo: produto.ativo,
      observacao_inicial: '',
    } : emptyProdutoForm);
    setFormError('');
    setShowProductModal(true);
  };

  const handleSaveProduto = async () => {
    setSaving(true);
    setFormError('');
    try {
      const categoria = normalizeLookupText(produtoForm.categoria);
      const especificacaoValor = normalizeLookupText(produtoForm.especificacao_valor);
      if (!produtoForm.item_base_id) throw new Error('Selecione o item base.');
      if (!categoria) throw new Error('Selecione a categoria.');
      if (editingProduto) {
        await updateParqueProduto(editingProduto.id, {
          item_base_id: produtoForm.item_base_id,
          categoria,
          especificacao_valor: especificacaoValor || null,
          unidade_base_id: produtoForm.unidade_base_id || null,
          marca_base_id: produtoForm.marca_base_id || null,
          quantidade_minima: produtoForm.quantidade_minima === '' ? null : Number(produtoForm.quantidade_minima),
          ativo: produtoForm.ativo,
        });
        setToast({ type: 'success', message: 'Produto atualizado.' });
      } else {
        await createParqueProduto({
          ...produtoForm,
          categoria,
          especificacao_valor: especificacaoValor,
        });
        setToast({ type: 'success', message: 'Produto criado.' });
      }
      setShowProductModal(false);
      await loadAll();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrepareEntradaCompra = (
    pedido: ParquePedidoCompraEntregue,
    destinoClinica?: string | null,
    destinoAtribuidoEm?: string | null
  ) => {
    const produtoEncontrado = findProdutoByPedidoItem(pedido.item);
    const produtoLabel = produtoEncontrado ? getMovimentacaoProdutoOptionLabel(produtoEncontrado) : '';
    const lojaOrigem = resolvePedidoLojaOrigem(pedido);
    const destinoSugerido = resolveDestinoFromHistorico(destinoClinica);

    setMovimentacaoForm({
      produto_id: produtoEncontrado?.id || '',
      tipo_movimentacao: 'entrada_compra',
      quantidade: pedido.quantidade_disponivel > 0 ? Number(pedido.quantidade_disponivel) : '',
      valor_unitario: resolvePedidoValorUnitario(pedido),
      origem_tipo: 'compra',
      origem_descricao: lojaOrigem,
      destino_tipo: destinoSugerido.destinoTipo,
      destino_descricao: destinoSugerido.destinoDescricao,
      data_movimentacao: resolvePedidoDataMovimentacao(pedido, destinoAtribuidoEm),
      observacao: destinoClinica ? `DESTINO IDENTIFICADO AUTOMATICAMENTE: ${String(destinoClinica).toUpperCase()}` : '',
      pedido_compra_id: pedido.id,
      setor_destino: destinoSugerido.setorDestino,
    });
    setMovimentacaoProdutoBusca(produtoLabel);
    setMovimentacaoProdutoBuscaDirty(false);
    setMovimentacaoProdutoBuscaFocused(false);

    setShowPedidosPendentesModal(false);
    if (!lojaOrigem) {
      setFormError('Pedido entregue sem loja de origem. Atualize o Pedido de Compras.');
    } else {
      setFormError(
        produtoEncontrado
          ? ''
          : 'Pedido entregue selecionado. Produto correspondente não encontrado; ele será criado automaticamente ao registrar no estoque.'
      );
    }
    setShowMovimentacaoModal(true);
  };

  const handleAdicionarTodosPedidosEntregues = async () => {
    if (pedidosEntreguesComDestino.length === 0) return;
    if (!window.confirm('ADICIONAR TODOS OS PEDIDOS ENTREGUES DISPONÍVEIS AO ESTOQUE?')) return;

    setSaving(true);
    try {
      const produtoPool = produtos
        .map((produto) => ({
          id: produto.id,
          itemNome: produto.item_base?.nome || '',
        }))
        .filter((item) => item.itemNome);

      const findProdutoIdByItem = (pedidoItem?: string | null) =>
        produtoPool.find((item) => isLikelySameItem(item.itemNome, pedidoItem))?.id || '';

      let sucesso = 0;
      const falhas: string[] = [];

      for (const pedido of pedidosEntreguesComDestino) {
        try {
          const quantidadeDisponivel = Number(pedido.quantidade_disponivel || 0);
          if (quantidadeDisponivel <= 0) continue;
          const lojaOrigem = resolvePedidoLojaOrigem(pedido);
          if (!lojaOrigem) throw new Error('PEDIDO SEM LOJA DE ORIGEM.');

          let produtoId = findProdutoIdByItem(pedido.item);
          if (!produtoId) {
            produtoId = await ensureProdutoFromPedido(pedido);
            const itemNome = findItemBaseByPedidoItem(pedido.item)?.nome || normalizeLookupText(pedido.item);
            produtoPool.push({ id: produtoId, itemNome });
          }

          await registerParqueMovimentacao({
            produto_id: produtoId,
            tipo_movimentacao: 'entrada_compra',
            quantidade: quantidadeDisponivel,
            valor_unitario: resolvePedidoValorUnitario(pedido),
            origem_tipo: 'compra',
            origem_descricao: lojaOrigem,
            destino_tipo: 'estoque',
            destino_descricao: DESTINO_PARQUE_TECNOLOGICO,
            data_movimentacao: resolvePedidoDataMovimentacao(pedido, pedido.destino_atribuido_em),
            observacao: pedido.destino_clinica
              ? `DESTINO IDENTIFICADO AUTOMATICAMENTE: ${String(pedido.destino_clinica).toUpperCase()}`
              : '',
            pedido_compra_id: pedido.id,
            setor_destino: '',
          });

          sucesso += 1;
        } catch (error) {
          const mensagem = error instanceof Error ? error.message : 'ERRO AO ADICIONAR.';
          falhas.push(`${formatUpperText(pedido.item)}: ${mensagem}`);
        }
      }

      if (falhas.length === 0) {
        setToast({ type: 'success', message: `${sucesso} pedido(s) adicionado(s) ao estoque.` });
        setShowPedidosPendentesModal(false);
      } else if (sucesso > 0) {
        setToast({ type: 'error', message: `${sucesso} pedido(s) adicionado(s) e ${falhas.length} com falha.` });
      } else {
        setToast({ type: 'error', message: 'Não foi possível adicionar os pedidos em lote.' });
      }

      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const inferDestinoTipo = (tipoMovimentacao: ParqueMovimentacaoFormValues['tipo_movimentacao'], destino: string) => {
    if (tipoMovimentacao === 'entrada_manual') return 'estoque';
    if (tipoMovimentacao === 'saida_clinica') return 'clinica';
    if (tipoMovimentacao === 'saida_setor') return 'setor';
    if (tipoMovimentacao === 'descarte') return 'descarte';

    const destinoUpper = normalizeLookupText(destino);
    if (!destinoUpper) return 'estoque';
    if (destinoUpper.startsWith('MATRIZ -')) return 'setor';
    if (normalizeClinicKey(destinoUpper)) return 'clinica';
    if (destinoUpper.includes('DESCARTE')) return 'descarte';
    if (destinoUpper === DESTINO_PARQUE_TECNOLOGICO || destinoUpper === 'ESTOQUE') return 'estoque';
    return 'setor';
  };

  const handleSaveMovimentacao = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (movimentacaoForm.quantidade === '' || Number(movimentacaoForm.quantidade) <= 0) throw new Error('Informe uma quantidade válida.');
      if (movimentacaoForm.tipo_movimentacao === 'entrada_compra' && !movimentacaoForm.pedido_compra_id) throw new Error('Selecione um pedido entregue.');
      if (movimentacaoForm.tipo_movimentacao === 'entrada_compra' && (movimentacaoForm.valor_unitario === '' || Number(movimentacaoForm.valor_unitario) <= 0)) throw new Error('Informe o valor unitário da entrada por compra.');
      if (movimentacaoForm.tipo_movimentacao === 'saida_clinica' && !movimentacaoForm.destino_descricao) throw new Error('Selecione a clínica de destino.');
      if (movimentacaoForm.tipo_movimentacao === 'saida_setor' && !movimentacaoForm.setor_destino) throw new Error('Selecione o setor da MATRIZ.');

      const isSaidaOuBaixa = ['saida_clinica', 'saida_setor', 'descarte', 'ajuste_negativo', 'transferencia'].includes(
        movimentacaoForm.tipo_movimentacao
      );
      const origemSelecionada = movimentacaoForm.tipo_movimentacao === 'entrada_compra'
        ? 'compra'
        : isSaidaOuBaixa
          ? 'estoque'
          : 'pre-cadastro';

      const setorDestinoNormalizado = normalizeLookupText(movimentacaoForm.setor_destino);
      let destinoDescricaoNormalizada = normalizeLookupText(movimentacaoForm.destino_descricao);
      if (movimentacaoForm.tipo_movimentacao === 'entrada_manual') {
        destinoDescricaoNormalizada = DESTINO_PARQUE_TECNOLOGICO;
      } else if (movimentacaoForm.tipo_movimentacao === 'entrada_compra' && !destinoDescricaoNormalizada) {
        destinoDescricaoNormalizada = DESTINO_PARQUE_TECNOLOGICO;
      } else if (movimentacaoForm.tipo_movimentacao === 'saida_setor') {
        if (!setorDestinoNormalizado) throw new Error('Selecione o setor da MATRIZ.');
        destinoDescricaoNormalizada = `MATRIZ - ${setorDestinoNormalizado}`;
      } else if (movimentacaoForm.tipo_movimentacao === 'descarte') {
        destinoDescricaoNormalizada = 'DESCARTE';
      }
      if (!destinoDescricaoNormalizada) throw new Error('Selecione o destino.');

      const payload: ParqueMovimentacaoFormValues = {
        ...movimentacaoForm,
        origem_tipo: origemSelecionada,
        origem_descricao:
          movimentacaoForm.tipo_movimentacao === 'entrada_compra'
            ? normalizeLookupText(movimentacaoForm.origem_descricao || 'COMPRA')
            : isSaidaOuBaixa
              ? 'PARQUE TECNOLOGICO'
              : normalizeLookupText(movimentacaoForm.origem_descricao || 'PRE-CADASTRO'),
        destino_descricao: destinoDescricaoNormalizada,
        destino_tipo: inferDestinoTipo(movimentacaoForm.tipo_movimentacao, destinoDescricaoNormalizada),
        setor_destino: setorDestinoNormalizado,
      };

      if (payload.tipo_movimentacao !== 'entrada_compra') {
        payload.pedido_compra_id = '';
      }

      if (payload.tipo_movimentacao === 'entrada_compra') {
        const destinoEntradaCompra = normalizeLookupText(payload.destino_descricao || DESTINO_PARQUE_TECNOLOGICO);
        const destinoTipoEntradaCompra = inferDestinoTipo(payload.tipo_movimentacao, destinoEntradaCompra);
        if (!destinoTipoEntradaCompra) {
          throw new Error('Selecione um destino válido para a entrada por compra.');
        }

        const pedidoSelecionado = pedidosEntregues.find((row) => row.id === payload.pedido_compra_id);
        if (!pedidoSelecionado) {
          throw new Error('Pedido entregue não encontrado. Atualize a lista e tente novamente.');
        }
        if (Number(payload.quantidade) > Number(pedidoSelecionado.quantidade_disponivel || 0)) {
          throw new Error(
            `Quantidade excede o saldo disponível do pedido (${Number(pedidoSelecionado.quantidade_disponivel || 0).toLocaleString('pt-BR')}).`
          );
        }
        const lojaOrigem = resolvePedidoLojaOrigem(pedidoSelecionado);
        if (!lojaOrigem) {
          throw new Error('Pedido entregue sem loja de origem. Atualize o pedido de compras antes de registrar.');
        }
        payload.origem_descricao = lojaOrigem;

        if (destinoTipoEntradaCompra === 'clinica') {
          const clinicaDestino = normalizeClinicKey(destinoEntradaCompra);
          if (!clinicaDestino || clinicaDestino === 'MATRIZ') {
            throw new Error('Selecione uma clínica válida (MATRIZ deve usar destino no formato MATRIZ - SETOR).');
          }
          payload.destino_descricao = clinicaDestino;
          payload.destino_tipo = 'clinica';
        } else if (destinoTipoEntradaCompra === 'setor') {
          const setorDestino = normalizeLookupText(destinoEntradaCompra.replace(/^MATRIZ\s*-\s*/i, ''));
          if (!setorDestino) {
            throw new Error('Selecione um destino válido no formato MATRIZ - SETOR.');
          }
          payload.destino_descricao = `MATRIZ - ${setorDestino}`;
          payload.destino_tipo = 'setor';
        } else if (destinoTipoEntradaCompra === 'descarte') {
          payload.destino_descricao = 'DESCARTE';
          payload.destino_tipo = 'descarte';
        } else {
          payload.destino_descricao = DESTINO_PARQUE_TECNOLOGICO;
          payload.destino_tipo = 'estoque';
        }
      }

      payload.observacao = removerSetorMatrizDaObservacao(payload.observacao);
      if (payload.tipo_movimentacao !== 'saida_setor') {
        payload.setor_destino = '';
      }

      if (!payload.produto_id && payload.tipo_movimentacao === 'entrada_compra') {
        const pedido = pedidosEntregues.find((row) => row.id === payload.pedido_compra_id);
        payload.produto_id = await ensureProdutoFromPedido(pedido || null);
      }
      if (!payload.produto_id) throw new Error('Selecione o produto.');

      if (payload.tipo_movimentacao === 'entrada_compra') {
        payload.origem_tipo = 'compra';
        payload.origem_descricao = normalizeLookupText(payload.origem_descricao || '');
      }
      if (payload.tipo_movimentacao === 'entrada_manual') {
        payload.origem_tipo = 'pre-cadastro';
        payload.destino_tipo = 'estoque';
        payload.destino_descricao = DESTINO_PARQUE_TECNOLOGICO;
      }
      if (payload.tipo_movimentacao === 'saida_clinica') {
        const clinicaDestino = normalizeClinicKey(payload.destino_descricao);
        if (!clinicaDestino || clinicaDestino === 'MATRIZ') {
          throw new Error('Selecione uma clínica válida (MATRIZ deve usar saída para setor).');
        }
        payload.origem_tipo = 'estoque';
        payload.origem_descricao = 'PARQUE TECNOLOGICO';
        payload.destino_tipo = 'clinica';
        payload.destino_descricao = clinicaDestino;
      }
      if (payload.tipo_movimentacao === 'saida_setor') {
        if (!payload.setor_destino) throw new Error('Selecione o setor da MATRIZ.');
        payload.origem_tipo = 'estoque';
        payload.origem_descricao = 'PARQUE TECNOLOGICO';
        payload.destino_tipo = 'setor';
        payload.destino_descricao = `MATRIZ - ${payload.setor_destino}`;
      }
      if (payload.tipo_movimentacao === 'descarte') {
        payload.origem_tipo = 'estoque';
        payload.origem_descricao = 'PARQUE TECNOLOGICO';
        payload.destino_tipo = 'descarte';
        payload.destino_descricao = 'DESCARTE';
      }

      await registerParqueMovimentacao(payload);
      setToast({ type: 'success', message: 'Movimentação registrada.' });
      setShowMovimentacaoModal(false);
      setMovimentacaoForm(emptyMovimentacaoForm);
      setMovimentacaoProdutoBusca('');
      setMovimentacaoProdutoBuscaDirty(false);
      setMovimentacaoProdutoBuscaFocused(false);
      await loadAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao registrar movimentação.';
      console.error('Erro ao registrar movimentação (Parque Tecnológico):', message, error);
      setFormError(message);
      setToast({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDescarte = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (!descarteForm.produto_id) throw new Error('Selecione o produto.');
      if (descarteForm.quantidade === '' || Number(descarteForm.quantidade) <= 0) throw new Error('Informe uma quantidade válida.');
      if (!descarteForm.motivo.trim()) throw new Error('Motivo é obrigatório.');
      await registerParqueDescarte(descarteForm);
      setToast({ type: 'success', message: 'Descarte registrado.' });
      setShowDescarteModal(false);
      setDescarteForm(emptyDescarteForm);
      await loadAll();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao registrar descarte.');
    } finally {
      setSaving(false);
    }
  };

  const getBaseListByTipo = (tipo: ParqueBaseCadastroTipo) => {
    if (tipo === 'itens') return catalogos.itens;
    if (tipo === 'unidades') return catalogos.unidades;
    if (tipo === 'marcas') return catalogos.marcas;
    if (tipo === 'categorias_produto') return catalogos.categorias_produto;
    if (tipo === 'especificacoes_produto') return catalogos.especificacoes_produto;
    if (tipo === 'setores') return catalogos.setores;
    if (tipo === 'tipos_movimentacao') return catalogos.tipos_movimentacao;
    if (tipo === 'tipos_origem') return catalogos.tipos_origem;
    if (tipo === 'tipos_destino') return catalogos.tipos_destino;
    return catalogos.descricoes_destino;
  };

  const getCadastroLinkDestinoIds = (
    origemTipo: ParqueBaseCadastroTipo,
    origemId: string,
    destinoTipo: ParqueBaseCadastroTipo
  ) =>
    getBaseListByTipo(destinoTipo)
      .filter((item) => !(destinoTipo === origemTipo && item.id === origemId))
      .map((item) => item.id);

  const handleSaveBase = async (tipo: ParqueBaseCadastroTipo, currentName?: string) => {
    const form = baseForms[tipo];
    const previousNome = form.id
      ? getBaseListByTipo(tipo).find((item) => item.id === form.id)?.nome || ''
      : '';
    setBaseFeedback((prev) => ({ ...prev, [tipo]: { type: 'info', message: 'SALVANDO...' } }));
    setSaving(true);
    try {
      const rawName = String(currentName ?? form.nome ?? '')
        .replace(/\u00A0/g, ' ')
        .trim();
      const nomeUpper = rawName.toUpperCase();
      const nome =
        tipo === 'tipos_movimentacao' || tipo === 'tipos_origem' || tipo === 'tipos_destino'
          ? nomeUpper
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '')
          : nomeUpper;
      if (!nome) throw new Error('Informe o nome do cadastro base.');
      await saveParqueBaseCadastro(tipo, {
        id: form.id || undefined,
        nome,
        sigla: form.sigla?.trim() || undefined,
        ativo: form.ativo,
      }, {
        previousNome,
      });
      setBaseForms((prev) => ({ ...prev, [tipo]: { id: '', nome: '', sigla: '', ativo: true } }));
      setBaseFeedback((prev) => ({ ...prev, [tipo]: { type: 'success', message: 'CADASTRO SALVO COM SUCESSO.' } }));
      setToast({ type: 'success', message: 'Cadastro base salvo.' });
      await loadAll();
    } catch (error) {
      setBaseFeedback((prev) => ({
        ...prev,
        [tipo]: {
          type: 'error',
          message: error instanceof Error ? error.message.toUpperCase() : 'ERRO AO SALVAR CADASTRO BASE.',
        },
      }));
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Erro ao salvar cadastro base.' });
    } finally {
      setSaving(false);
    }
  };

  const startInlineBaseEdit = (tipo: ParqueBaseCadastroTipo, item: { id: string; nome: string; ativo: boolean; sigla?: string | null }) => {
    setBaseInlineEdit((prev) => ({
      ...prev,
      [tipo]: {
        id: item.id,
        nome: String(item.nome || '').toUpperCase(),
        sigla: String(item.sigla || '').toUpperCase(),
        ativo: Boolean(item.ativo),
      },
    }));
  };

  const cancelInlineBaseEdit = (tipo: ParqueBaseCadastroTipo) => {
    setBaseInlineEdit((prev) => ({
      ...prev,
      [tipo]: undefined,
    }));
  };

  const handleSaveInlineBase = async (tipo: ParqueBaseCadastroTipo) => {
    const editing = baseInlineEdit[tipo];
    if (!editing?.id) return;

    const previousNome = getBaseListByTipo(tipo).find((item) => item.id === editing.id)?.nome || '';
    setBaseFeedback((prev) => ({ ...prev, [tipo]: { type: 'info', message: 'SALVANDO...' } }));
    setSaving(true);

    try {
      const rawName = String(editing.nome || '')
        .replace(/\u00A0/g, ' ')
        .trim();
      const nomeUpper = rawName.toUpperCase();
      const nome =
        tipo === 'tipos_movimentacao' || tipo === 'tipos_origem' || tipo === 'tipos_destino'
          ? nomeUpper
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '')
          : nomeUpper;
      if (!nome) throw new Error('Informe o nome do cadastro base.');

      await saveParqueBaseCadastro(
        tipo,
        {
          id: editing.id,
          nome,
          sigla: editing.sigla?.trim() || undefined,
          ativo: editing.ativo,
        },
        { previousNome }
      );

      setBaseInlineEdit((prev) => ({
        ...prev,
        [tipo]: undefined,
      }));
      setBaseFeedback((prev) => ({ ...prev, [tipo]: { type: 'success', message: 'CADASTRO SALVO COM SUCESSO.' } }));
      setToast({ type: 'success', message: 'Cadastro base salvo.' });
      await loadAll();
    } catch (error) {
      setBaseFeedback((prev) => ({
        ...prev,
        [tipo]: {
          type: 'error',
          message: error instanceof Error ? error.message.toUpperCase() : 'ERRO AO SALVAR CADASTRO BASE.',
        },
      }));
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Erro ao salvar cadastro base.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBase = async (tipo: ParqueBaseCadastroTipo, id: string) => {
    if (!window.confirm('EXCLUIR ESTE CADASTRO? ESTA AÇÃO NÃO PODE SER DESFEITA.')) return;
    setSaving(true);
    try {
      await deleteParqueBaseCadastro(tipo, id);
      setToast({ type: 'success', message: 'Cadastro excluído.' });
      await loadAll();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Erro ao excluir cadastro base.' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenHistory = async (produto: ParqueProduto) => {
    setHistoryProduto(produto);
    setHistoryLoading(true);
    try {
      const rows = await listParqueHistoricoProduto(produto.id);
      setHistoryRows(rows);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Erro ao carregar histórico.' });
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteProduto = async (produto: ParqueProduto) => {
    if (!window.confirm(`EXCLUIR O PRODUTO ${formatUpperText(getParqueProdutoLabel(produto))}? ESTA AÇÃO NÃO PODE SER DESFEITA.`)) return;
    setSaving(true);
    try {
      await deleteParqueProduto(produto.id);
      setToast({ type: 'success', message: 'Produto excluído.' });
      await loadAll();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Erro ao excluir produto.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        sectionLabel="Parque Tecnológico"
        title={mode === 'estoque' ? 'Estoque' : 'Inventário'}
        subtitle={
          mode === 'estoque'
            ? 'Visão do quê está guardado: produtos cadastrados, saldo atual, estoque mínimo e cadastros padronizados.'
            : 'Visão do como o controle acontece: movimentações, conferência, rastreabilidade, perdas e integração operacional.'
        }
        actions={
          <>
            {mode === 'estoque' && (
              <button
                type="button"
                onClick={() => setShowAjustesPanel((prev) => !prev)}
                className={`${buttonClassName} border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-800`}
              >
                <Settings className="h-4 w-4" />
                Ajustes
              </button>
            )}
            {mode === 'estoque' && permissoes.cadastrarProduto && (
              <button type="button" onClick={() => resetProdutoForm()} className={`${buttonClassName} bg-button text-white hover:bg-button-hover`}>
                <Plus className="h-4 w-4" />
                Novo produto
              </button>
            )}
            {mode === 'estoque' && permissoes.registrarMovimentacao && (
              <button
                type="button"
                onClick={() => setShowPedidosPendentesModal(true)}
                className={`${buttonClassName} relative border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-200`}
              >
                <AlertCircle className="h-4 w-4" />
                Pedidos entregues
                {pedidosEntregues.length > 0 && (
                  <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {pedidosEntregues.length}
                  </span>
                )}
              </button>
            )}
            {mode === 'inventario' && permissoes.registrarMovimentacao && (
              <button
                type="button"
                onClick={() => {
                  setFormError('');
                  setShowMovimentacaoModal(true);
                }}
                className={`${buttonClassName} border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-800`}
              >
                <RefreshCw className="h-4 w-4" />
                Nova movimentação
              </button>
            )}
            {mode === 'inventario' && permissoes.registrarDescarte && (
              <button
                type="button"
                onClick={() => {
                  setFormError('');
                  setShowDescarteModal(true);
                }}
                className={`${buttonClassName} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200`}
              >
                <Trash2 className="h-4 w-4" />
                Registrar descarte
              </button>
            )}
          </>
        }
      />

      {toast && <div className={`rounded-xl border px-4 py-3 text-sm ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200'}`}>{toast.message}</div>}

      {mode === 'inventario' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-200/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Movimentações</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{inventorySummary.total}</div>
            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Registros de controle no recorte atual</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-200/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Entradas</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{inventorySummary.entradas.toLocaleString('pt-BR')}</div>
            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Reposições, compras e ajustes positivos</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-200/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Saídas</div>
            <div className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-300">{inventorySummary.saidas.toLocaleString('pt-BR')}</div>
            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Saídas para clínicas/setores, transferências e ajustes negativos</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-200/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Perdas</div>
            <div className="mt-2 text-2xl font-semibold text-rose-700 dark:text-rose-300">{inventorySummary.descartes.toLocaleString('pt-BR')}</div>
            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Descartes são ponto final do item</div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-neutral-200/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input
            data-uppercase="off"
            className={inputClassName}
            placeholder="Busca global"
            value={search}
            onChange={(event) => setSearch(event.target.value.toUpperCase())}
          />
          <select className={inputClassName} value={itemFilter} onChange={(event) => setItemFilter(event.target.value)}><option value="">Todos os itens</option>{catalogos.itens.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
          {mode === 'estoque' ? <select className={inputClassName} value={categoriaFilter} onChange={(event) => setCategoriaFilter(event.target.value)}><option value="">Todas as categorias</option>{categoriaOptions.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}</select> : <select className={inputClassName} value={tipoFilter} onChange={(event) => setTipoFilter(event.target.value)}><option value="">Todos os tipos</option>{tipoMovimentacaoOptions.map((tipo) => <option key={tipo} value={tipo}>{getTipoMovimentacaoLabel(tipo)}</option>)}</select>}
          {mode === 'estoque' ? <select className={inputClassName} value={marcaFilter} onChange={(event) => setMarcaFilter(event.target.value)}><option value="">Todas as marcas</option>{catalogos.marcas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select> : <select className={inputClassName} value={origemFilter} onChange={(event) => setOrigemFilter(event.target.value)}><option value="">Todas as origens</option><option value="compra">Compra</option><option value="pre-cadastro">Pré-cadastro</option></select>}
          {mode === 'estoque' ? <select className={inputClassName} value={unidadeFilter} onChange={(event) => setUnidadeFilter(event.target.value)}><option value="">Todas as unidades</option>{catalogos.unidades.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select> : <select className={inputClassName} value={destinoFilter} onChange={(event) => setDestinoFilter(event.target.value)}><option value="">Todos os destinos</option><option value="estoque">Estoque</option><option value="clinica">Clínica</option><option value="setor">Setor</option><option value="descarte">Descarte</option></select>}
          {mode === 'estoque' ? <div className="flex items-center gap-3 rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"><select className="w-full bg-transparent text-sm outline-none" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos os status</option><option value="ativo">Ativo</option><option value="estoque_baixo">Estoque baixo</option><option value="inativo">Inativo</option></select><label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={estoqueBaixoOnly} onChange={(event) => setEstoqueBaixoOnly(event.target.checked)} />Baixo</label></div> : <><input className={inputClassName} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><input className={inputClassName} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></>}
        </div>
        {mode === 'inventario' && <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"><select className={inputClassName} value={clinicaFilter} onChange={(event) => setClinicaFilter(event.target.value)}><option value="">Todas as clínicas</option>{clinicaDestinoOptions.map((clinica) => <option key={clinica} value={clinica}>{clinica}</option>)}</select><select className={inputClassName} value={setorFilter} onChange={(event) => setSetorFilter(event.target.value)}><option value="">Todos os setores</option>{setorOptions.map((setor) => <option key={setor} value={setor}>{setor}</option>)}</select></div>}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={clearCurrentModeFilters}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {mode === 'estoque' ? (
        <>
          {produtos.length > 0 && filteredProdutos.length === 0 && hasEstoqueFiltersApplied && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              Existem registros no estoque, mas os filtros atuais esconderam os resultados.
            </div>
          )}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-200/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"><tr><th className="px-3 py-3">Item</th><th className="px-3 py-3">Categoria</th><th className="px-3 py-3">Especificação</th><th className="px-3 py-3">Marca</th><th className="px-3 py-3 text-right">Quantidade</th><th className="px-3 py-3">Unidade</th><th className="px-3 py-3 text-right">Mínimo</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Ações</th></tr></thead>
                <tbody>
                  {filteredProdutos.map((produto) => {
                    const status = getParqueProdutoStatus(produto);
                    return (
                      <tr key={produto.id} className="border-b border-neutral-100 dark:border-neutral-800">
                        <td className="px-3 py-3 font-medium text-neutral-900 dark:text-neutral-100">{produto.item_base?.nome}</td>
                        <td className="px-3 py-3 text-neutral-600 dark:text-neutral-300">{produto.categoria}</td>
                        <td className="px-3 py-3 text-neutral-600 dark:text-neutral-300">{produto.especificacao_valor || '-'}</td>
                        <td className="px-3 py-3 text-neutral-600 dark:text-neutral-300">{produto.marca_base?.nome || '-'}</td>
                        <td className={`px-3 py-3 text-right font-semibold ${status === 'estoque_baixo' ? 'text-amber-600 dark:text-amber-300' : 'text-neutral-900 dark:text-neutral-100'}`}>
                          {produto.quantidade_atual.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-3 text-neutral-600 dark:text-neutral-300">{produto.unidade_base?.sigla || produto.unidade_base?.nome || '-'}</td>
                        <td className="px-3 py-3 text-right text-neutral-600 dark:text-neutral-300">{produto.quantidade_minima ?? '-'}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(status)}`}>
                            {status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              title="Editar produto"
                              onClick={() => resetProdutoForm(produto)}
                              disabled={!permissoes.editarProduto || saving}
                              className="rounded-full border border-neutral-300 p-2 text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Histórico do item"
                              onClick={() => handleOpenHistory(produto)}
                              disabled={saving}
                              className="rounded-full border border-neutral-300 p-2 text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Excluir produto"
                              onClick={() => handleDeleteProduto(produto)}
                              disabled={!permissoes.editarProduto || saving}
                              className="rounded-full border border-red-200 p-2 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/30"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProdutos.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">Nenhum produto encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {showAjustesPanel && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            {([
              { tipo: 'itens', title: 'Tipos de item', subtitle: 'PADRONIZA O NOME DOS ITENS USADOS EM PRODUTOS E MOVIMENTAÇÕES.', placeholder: 'EX: MOUSE', isCode: false },
              { tipo: 'unidades', title: 'Unidades base', subtitle: 'PADRONIZA UNIDADES DE MEDIDA PARA EVITAR VARIAÇÕES.', placeholder: 'EX: UNIDADE', isCode: false },
              { tipo: 'marcas', title: 'Marcas base', subtitle: 'PADRONIZA MARCAS PARA RELATÓRIOS E FILTROS FUTUROS.', placeholder: 'EX: LOGITECH', isCode: false },
              { tipo: 'categorias_produto', title: 'Categorias', subtitle: 'PADRONIZA AS CATEGORIAS DOS PRODUTOS DO ESTOQUE.', placeholder: 'EX: PERIFÉRICO', isCode: false },
              { tipo: 'especificacoes_produto', title: 'Especificações', subtitle: 'PADRONIZA ESPECIFICAÇÕES PARA SELEÇÃO NO PRODUTO.', placeholder: 'EX: 15', isCode: false },
            ] as Array<{ tipo: ParqueBaseCadastroTipo; title: string; subtitle: string; placeholder: string; isCode: boolean }>).map((def) => {
              const tipo = def.tipo;
              const form = baseForms[tipo];
              const list = getBaseListByTipo(tipo);
              const actionLabel = 'Adicionar';
              return (
                <div key={tipo} className="rounded-2xl border border-neutral-200 bg-neutral-200/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-800 dark:text-neutral-100">{def.title}</h3>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{def.subtitle}</p>
                  <div className="mt-3 space-y-3">
                    <input
                      ref={(node) => {
                        baseNameInputRefs.current[tipo] = node;
                      }}
                      className={inputClassName}
                      placeholder={def.placeholder}
                      value={form.nome}
                      disabled={!permissoes.gerenciarCadastrosBase}
                      onChange={(event) =>
                        setBaseForms((prev) => ({
                          ...prev,
                          [tipo]: { ...prev[tipo], nome: event.target.value.toUpperCase() },
                        }))
                      }
                    />
                    {tipo === 'unidades' && (
                      <input
                        className={inputClassName}
                        placeholder="EX: UND"
                        value={form.sigla}
                        disabled={!permissoes.gerenciarCadastrosBase}
                        onChange={(event) =>
                          setBaseForms((prev) => ({
                            ...prev,
                            [tipo]: { ...prev[tipo], sigla: event.target.value.toUpperCase() },
                          }))
                        }
                      />
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.ativo}
                          disabled={!permissoes.gerenciarCadastrosBase}
                          onChange={(event) =>
                            setBaseForms((prev) => ({
                              ...prev,
                              [tipo]: { ...prev[tipo], ativo: event.target.checked },
                            }))
                          }
                        />
                        Ativo
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveBase(tipo, baseNameInputRefs.current[tipo]?.value ?? form.nome)
                        }
                        disabled={!permissoes.gerenciarCadastrosBase || saving}
                        className={`${buttonClassName} bg-button text-white hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {actionLabel}
                      </button>
                    </div>
                    {!permissoes.gerenciarCadastrosBase && (
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                        Você não possui permissão para gerenciar cadastros base.
                      </div>
                    )}
                    {baseFeedback[tipo] && (
                      <div
                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                          baseFeedback[tipo]?.type === 'error'
                            ? 'text-red-600 dark:text-red-300'
                            : baseFeedback[tipo]?.type === 'success'
                              ? 'text-emerald-600 dark:text-emerald-300'
                              : 'text-sky-600 dark:text-sky-300'
                        }`}
                      >
                        {baseFeedback[tipo]?.message}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    {list.map((item) => {
                      const editing = baseInlineEdit[tipo];
                      const isInlineEditing = editing?.id === item.id;

                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800 ${
                            isInlineEditing ? 'flex flex-col gap-2' : 'flex items-center justify-between gap-3'
                          }`}
                        >
                          <div className={isInlineEditing ? 'w-full' : 'min-w-0 flex-1'}>
                            {isInlineEditing ? (
                              <div className="space-y-2">
                                <input
                                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                                  value={editing?.nome || ''}
                                  disabled={!permissoes.gerenciarCadastrosBase || saving}
                                  onChange={(event) =>
                                    setBaseInlineEdit((prev) => ({
                                      ...prev,
                                      [tipo]: {
                                        ...(prev[tipo] || { id: item.id, nome: '', sigla: '', ativo: true }),
                                        nome: event.target.value.toUpperCase(),
                                      },
                                    }))
                                  }
                                />
                                {tipo === 'unidades' && (
                                  <input
                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                                    placeholder="SIGLA"
                                    value={editing?.sigla || ''}
                                    disabled={!permissoes.gerenciarCadastrosBase || saving}
                                    onChange={(event) =>
                                      setBaseInlineEdit((prev) => ({
                                        ...prev,
                                        [tipo]: {
                                          ...(prev[tipo] || { id: item.id, nome: '', sigla: '', ativo: true }),
                                          sigla: event.target.value.toUpperCase(),
                                        },
                                      }))
                                    }
                                  />
                                )}
                                <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(editing?.ativo)}
                                    disabled={!permissoes.gerenciarCadastrosBase || saving}
                                    onChange={(event) =>
                                      setBaseInlineEdit((prev) => ({
                                        ...prev,
                                        [tipo]: {
                                          ...(prev[tipo] || { id: item.id, nome: '', sigla: '', ativo: true }),
                                          ativo: event.target.checked,
                                        },
                                      }))
                                    }
                                  />
                                  Ativo
                                </label>
                              </div>
                            ) : (
                              <>
                                <div className="font-medium text-neutral-900 dark:text-neutral-100">
                                  {def.isCode ? formatMovementTypeLabel(item.nome) : formatUpperText(item.nome)}
                                </div>
                                {'sigla' in item && item.sigla ? <div className="text-xs text-neutral-500">{item.sigla}</div> : null}
                                {(() => {
                                  const links = cadastroLinkByOrigemKey.get(`${tipo}:${item.id}`) || [];
                                  if (links.length === 0) return null;
                                  const destinoNomes = links
                                    .map((link) => cadastroNomeByKey.get(`${link.destino_tipo}:${link.destino_id}`) || '')
                                    .filter(Boolean);
                                  if (destinoNomes.length === 0) return null;
                                  const tipoDestino = links[0]?.destino_tipo || 'descricoes_destino';
                                  return (
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
                                      VÍNCULOS ({destinoNomes.length}):{' '}
                                      {`${parametroCategoriaLabel(tipoDestino)} • ${formatUpperText(destinoNomes.join(', '))}`}
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                          </div>
                          <div
                            className={`flex items-center gap-2 ${
                              isInlineEditing ? 'w-full justify-end border-t border-neutral-200 pt-2 dark:border-neutral-800' : ''
                            }`}
                          >
                            <button
                              type="button"
                              title="Linkar cadastro"
                              disabled={!permissoes.gerenciarCadastrosBase || saving}
                              onClick={() => openCadastroLinkModal(tipo, item.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                            >
                              <Share className="h-3.5 w-3.5" />
                            </button>
                            {isInlineEditing ? (
                              <>
                                <button
                                  type="button"
                                  title="Salvar edição"
                                  disabled={!permissoes.gerenciarCadastrosBase || saving}
                                  onClick={() => handleSaveInlineBase(tipo)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                                >
                                  <Save className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Cancelar edição"
                                  disabled={!permissoes.gerenciarCadastrosBase || saving}
                                  onClick={() => cancelInlineBaseEdit(tipo)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                title="Editar"
                                disabled={!permissoes.gerenciarCadastrosBase || saving}
                                onClick={() =>
                                  startInlineBaseEdit(tipo, {
                                    id: item.id,
                                    nome: def.isCode ? formatMovementTypeLabel(item.nome) : item.nome,
                                    sigla: 'sigla' in item ? item.sigla || '' : '',
                                    ativo: item.ativo,
                                  })
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Excluir"
                              disabled={!permissoes.gerenciarCadastrosBase || saving}
                              onClick={() => handleDeleteBase(tipo, item.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {list.length === 0 && <div className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum cadastro.</div>}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </>
      ) : (
        <>
          {movimentacoes.length > 0 && filteredMovimentacoes.length === 0 && hasInventarioFiltersApplied && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              Existem registros no inventário, mas os filtros atuais esconderam os resultados.
            </div>
          )}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-200/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80">
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Item</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Origem</th>
                  <th className="px-3 py-3">Destino</th>
                  <th className="px-3 py-3 text-right">Quantidade</th>
                  <th className="px-3 py-3 text-right">Valor Unit.</th>
                  <th className="px-3 py-3">Observação</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovimentacoes.map((movimento) => (
                  <tr key={movimento.id} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-3 text-neutral-700 dark:text-neutral-200">{formatDateTime(movimento.data_movimentacao)}</td>
                    <td className="px-3 py-3 font-medium text-neutral-900 dark:text-neutral-100">{formatUpperText(getParqueProdutoLabel(movimento.produto))}</td>
                    <td className="px-3 py-3"><span className={movementBadgeClass(movimento.tipo_movimentacao)}>{getTipoMovimentacaoLabel(movimento.tipo_movimentacao)}</span></td>
                    <td className="px-3 py-3 text-neutral-600 dark:text-neutral-300">{formatUpperText(movimento.origem_descricao || movimento.origem_tipo)}</td>
                    <td className="px-3 py-3 text-neutral-600 dark:text-neutral-300">{formatUpperText(movimento.destino_descricao || movimento.destino_tipo)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-100">{movimento.quantidade.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                      {movimento.custo_unitario === null ? '-' : `R$ ${movimento.custo_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </td>
                    <td className="px-3 py-3 text-neutral-600 dark:text-neutral-300">{formatUpperText(movimento.observacao)}</td>
                  </tr>
                ))}
                {filteredMovimentacoes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                      Nenhuma movimentação encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        </>
      )}

      {((mode === 'estoque' && showProductModal) || showMovimentacaoModal || (mode === 'inventario' && showDescarteModal) || showPedidosPendentesModal || historyProduto) && <div />}
      {mode === 'estoque' && showProductModal && (
        <div className={overlayClassName}>
          <div className={modalClassName}>
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {editingProduto ? 'Editar produto' : 'Novo produto'}
              </h3>
              <button type="button" onClick={() => setShowProductModal(false)} className="rounded-full border border-neutral-300 p-2">
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
              <div className="mb-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => openItemLinkModal(produtoForm.item_base_id)}
                  disabled={!permissoes.gerenciarCadastrosBase}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Share className="h-3.5 w-3.5" />
                  Linkar parâmetros
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <select
                  className={inputClassName}
                  value={produtoForm.item_base_id}
                  onChange={(event) => {
                    const itemId = event.target.value;
                    setProdutoForm((prev) => ({ ...prev, item_base_id: itemId }));
                    if (itemId) {
                      window.setTimeout(() => applyLinkedProdutoParams(itemId, false), 0);
                    }
                  }}
                >
                  <option value="">Selecione o item base</option>
                  {catalogos.itens.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>

                <select
                  className={inputClassName}
                  value={produtoForm.categoria}
                  onChange={(event) => setProdutoForm((prev) => ({ ...prev, categoria: normalizeLookupText(event.target.value) }))}
                >
                  <option value="">Selecione a categoria</option>
                  {produtoCategoriaOptions.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>

                <select
                  className={inputClassName}
                  value={produtoForm.especificacao_valor}
                  onChange={(event) => setProdutoForm((prev) => ({ ...prev, especificacao_valor: normalizeLookupText(event.target.value) }))}
                >
                  <option value="">Selecione a especificação</option>
                  {produtoEspecificacaoOptions.map((especificacao) => (
                    <option key={especificacao} value={especificacao}>
                      {especificacao}
                    </option>
                  ))}
                </select>

                <select
                  className={inputClassName}
                  value={produtoForm.unidade_base_id}
                  onChange={(event) => setProdutoForm((prev) => ({ ...prev, unidade_base_id: event.target.value }))}
                >
                  <option value="">Selecione a unidade</option>
                  {catalogos.unidades.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                      {item.sigla ? ` (${item.sigla})` : ''}
                    </option>
                  ))}
                </select>

                <select
                  className={inputClassName}
                  value={produtoForm.marca_base_id}
                  onChange={(event) => setProdutoForm((prev) => ({ ...prev, marca_base_id: event.target.value }))}
                >
                  <option value="">Selecione a marca</option>
                  {catalogos.marcas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClassName}
                  placeholder="Quantidade mínima"
                  value={numberValue(produtoForm.quantidade_minima)}
                  onChange={(event) =>
                    setProdutoForm((prev) => ({
                      ...prev,
                      quantidade_minima: event.target.value === '' ? '' : Number(event.target.value),
                    }))
                  }
                />

                {!editingProduto && (
                  <>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputClassName}
                      placeholder="Quantidade inicial"
                      value={numberValue(produtoForm.quantidade_inicial)}
                      onChange={(event) =>
                        setProdutoForm((prev) => ({
                          ...prev,
                          quantidade_inicial: event.target.value === '' ? '' : Number(event.target.value),
                        }))
                      }
                    />
                    <textarea
                      className={inputClassName}
                      placeholder="Observação da entrada inicial"
                      value={produtoForm.observacao_inicial}
                      onChange={(event) =>
                        setProdutoForm((prev) => ({
                          ...prev,
                          observacao_inicial: event.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </>
                )}

                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={produtoForm.ativo}
                    onChange={(event) => setProdutoForm((prev) => ({ ...prev, ativo: event.target.checked }))}
                  />
                  Produto ativo
                </label>
              </div>

              {formError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className={`${buttonClassName} border border-neutral-300 bg-white text-neutral-700`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveProduto}
                disabled={saving}
                className={`${buttonClassName} bg-button text-white hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {mode === 'estoque' && showItemLinkModal && (
        <div className={overlayClassName}>
          <div className={modalClassName}>
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Linkar parâmetros do item</h3>
              <button type="button" onClick={() => setShowItemLinkModal(false)} className="rounded-full border border-neutral-300 p-2">
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <select
                  className={inputClassName}
                  value={itemLinkForm.item_base_id}
                  onChange={(event) => {
                    const itemId = event.target.value;
                    const linked = itemParametroLinks.find((item) => item.item_base_id === itemId);
                    setItemLinkForm((prev) => ({
                      ...prev,
                      id: linked?.id || '',
                      item_base_id: itemId,
                      categoria_parametro_id: linked?.categoria_parametro_id || '',
                      especificacao_parametro_id: linked?.especificacao_parametro_id || '',
                      unidade_base_id: linked?.unidade_base_id || '',
                      marca_base_id: linked?.marca_base_id || '',
                      ativo: linked?.ativo ?? true,
                    }));
                  }}
                >
                  <option value="">Selecione o tipo de item</option>
                  {catalogos.itens.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatUpperText(item.nome)}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClassName}
                  value={itemLinkForm.categoria_parametro_id}
                  onChange={(event) => setItemLinkForm((prev) => ({ ...prev, categoria_parametro_id: event.target.value }))}
                >
                  <option value="">Selecione a categoria (opcional)</option>
                  {catalogos.categorias_produto.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatUpperText(item.nome)}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClassName}
                  value={itemLinkForm.especificacao_parametro_id}
                  onChange={(event) => setItemLinkForm((prev) => ({ ...prev, especificacao_parametro_id: event.target.value }))}
                >
                  <option value="">Selecione a especificação (opcional)</option>
                  {catalogos.especificacoes_produto.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatUpperText(item.nome)}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClassName}
                  value={itemLinkForm.unidade_base_id}
                  onChange={(event) => setItemLinkForm((prev) => ({ ...prev, unidade_base_id: event.target.value }))}
                >
                  <option value="">Selecione a unidade (opcional)</option>
                  {catalogos.unidades.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatUpperText(item.nome)}
                      {item.sigla ? ` (${formatUpperText(item.sigla)})` : ''}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClassName}
                  value={itemLinkForm.marca_base_id}
                  onChange={(event) => setItemLinkForm((prev) => ({ ...prev, marca_base_id: event.target.value }))}
                >
                  <option value="">Selecione a marca (opcional)</option>
                  {catalogos.marcas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatUpperText(item.nome)}
                    </option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={itemLinkForm.ativo}
                    onChange={(event) => setItemLinkForm((prev) => ({ ...prev, ativo: event.target.checked }))}
                  />
                  Vínculo ativo
                </label>
              </div>
              {formError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
              <button type="button" onClick={() => setShowItemLinkModal(false)} className={`${buttonClassName} border border-neutral-300 bg-white text-neutral-700`}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveItemLink}
                disabled={saving || !permissoes.gerenciarCadastrosBase}
                className={`${buttonClassName} bg-button text-white hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {saving ? 'Salvando...' : 'Salvar vínculo'}
              </button>
            </div>
          </div>
        </div>
      )}
      {mode === 'estoque' && showCadastroLinkModal && (
        <div className={overlayClassName}>
          <div className={modalClassName}>
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Linkar cadastro</h3>
              <button type="button" onClick={() => setShowCadastroLinkModal(false)} className="rounded-full border border-neutral-300 p-2">
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Origem</div>
                  <div className={`${inputClassName} mt-1`}>
                    {`${parametroCategoriaLabel(cadastroLinkForm.origem_tipo)} • ${formatUpperText(
                      getBaseListByTipo(cadastroLinkForm.origem_tipo).find((item) => item.id === cadastroLinkForm.origem_id)?.nome
                    )}`}
                  </div>
                </div>
                <select
                  className={inputClassName}
                  value={cadastroLinkForm.destino_tipo}
                  onChange={(event) =>
                    setCadastroLinkForm((prev) => {
                      const destinoTipo = event.target.value as ParqueBaseCadastroTipo;
                      return {
                        ...prev,
                        destino_tipo: destinoTipo,
                        destino_ids: getCadastroLinkDestinoIds(prev.origem_tipo, prev.origem_id, destinoTipo),
                      };
                    })
                  }
                >
                  {([
                    'itens',
                    'unidades',
                    'marcas',
                    'categorias_produto',
                    'especificacoes_produto',
                    'setores',
                    'tipos_movimentacao',
                    'tipos_origem',
                    'tipos_destino',
                    'descricoes_destino',
                  ] as ParqueBaseCadastroTipo[]).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {parametroCategoriaLabel(tipo)}
                    </option>
                  ))}
                </select>
                <div className="md:col-span-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Destinos ({cadastroLinkForm.destino_ids.length} selecionado(s))
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-neutral-300 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        onClick={() =>
                          setCadastroLinkForm((prev) => ({
                            ...prev,
                            destino_ids: getCadastroLinkDestinoIds(prev.origem_tipo, prev.origem_id, prev.destino_tipo),
                          }))
                        }
                      >
                        Marcar todos
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-neutral-300 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        onClick={() =>
                          setCadastroLinkForm((prev) => ({
                            ...prev,
                            destino_ids: [],
                          }))
                        }
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid max-h-60 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                    {getBaseListByTipo(cadastroLinkForm.destino_tipo)
                      .filter((item) => !(cadastroLinkForm.destino_tipo === cadastroLinkForm.origem_tipo && item.id === cadastroLinkForm.origem_id))
                      .map((item) => {
                        const checked = cadastroLinkForm.destino_ids.includes(item.id);
                        return (
                          <label key={item.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setCadastroLinkForm((prev) => ({
                                  ...prev,
                                  destino_ids: event.target.checked
                                    ? Array.from(new Set([...prev.destino_ids, item.id]))
                                    : prev.destino_ids.filter((destinoId) => destinoId !== item.id),
                                }))
                              }
                            />
                            <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatUpperText(item.nome)}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>
              {formError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
              <button type="button" onClick={() => setShowCadastroLinkModal(false)} className={`${buttonClassName} border border-neutral-300 bg-white text-neutral-700`}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCadastroLink}
                disabled={saving || !permissoes.gerenciarCadastrosBase}
                className={`${buttonClassName} bg-button text-white hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {saving ? 'Salvando...' : 'Salvar vínculo'}
              </button>
            </div>
          </div>
        </div>
      )}
      {mode === 'inventario' && showDestinoSetorModal && (
        <div className={overlayClassName}>
          <div className={modalClassName}>
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Linkar destino ao setor</h3>
              <button type="button" onClick={() => setShowDestinoSetorModal(false)} className="rounded-full border border-neutral-300 p-2">
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <select
                  className={inputClassName}
                  value={destinoSetorForm.destino_parametro_id}
                  onChange={(event) => {
                    const destinoId = event.target.value;
                    const linked = destinoSetorLinks.find((item) => item.destino_parametro_id === destinoId);
                    setDestinoSetorForm((prev) => ({
                      ...prev,
                      id: linked?.id || '',
                      destino_parametro_id: destinoId,
                      setor_parametro_id: linked?.setor_parametro_id || '',
                      ativo: linked?.ativo ?? true,
                    }));
                  }}
                >
                  <option value="">Selecione o destino</option>
                  {catalogos.descricoes_destino.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatUpperText(item.nome)}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClassName}
                  value={destinoSetorForm.setor_parametro_id}
                  onChange={(event) => setDestinoSetorForm((prev) => ({ ...prev, setor_parametro_id: event.target.value }))}
                >
                  <option value="">Selecione o setor</option>
                  {catalogos.setores.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatUpperText(item.nome)}
                    </option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={destinoSetorForm.ativo}
                    onChange={(event) => setDestinoSetorForm((prev) => ({ ...prev, ativo: event.target.checked }))}
                  />
                  Vínculo ativo
                </label>
              </div>
              {formError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
              <button type="button" onClick={() => setShowDestinoSetorModal(false)} className={`${buttonClassName} border border-neutral-300 bg-white text-neutral-700`}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDestinoSetorLink}
                disabled={saving || !permissoes.gerenciarCadastrosBase}
                className={`${buttonClassName} bg-button text-white hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {saving ? 'Salvando...' : 'Salvar vínculo'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showPedidosPendentesModal && (
        <div className={overlayClassName}>
          <div className={modalClassName}>
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Pedidos Entregues</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Itens com status ENTREGUE no módulo Pedidos de Compra. Clique em incluir para iniciar o lançamento no Estoque.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAdicionarTodosPedidosEntregues}
                  disabled={saving || pedidosEntreguesComDestino.length === 0}
                  className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200 dark:hover:bg-sky-900/30"
                >
                  {saving ? 'Adicionando...' : 'Adicionar tudo'}
                </button>
                <button type="button" onClick={() => setShowPedidosPendentesModal(false)} className="rounded-full border border-neutral-300 p-2">
                  <Plus className="h-4 w-4 rotate-45" />
                </button>
              </div>
            </div>
            <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
              {pedidosEntreguesComDestino.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                  Nenhum pedido pendente de inclusão no inventário.
                </div>
              ) : (
                <div className="space-y-3">
                  {pedidosEntreguesComDestino.map((pedido) => (
                    <div key={pedido.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{pedido.item}</div>
                        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{pedido.origem_label}</div>
                        <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                          Quantidade entregue: <strong>{Number(pedido.quantidade || 0).toLocaleString('pt-BR')}</strong>
                        </div>
                        <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                          Quantidade já lançada: <strong>{Number(pedido.quantidade_alocada || 0).toLocaleString('pt-BR')}</strong>
                        </div>
                        <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                          Saldo disponível: <strong>{Number(pedido.quantidade_disponivel || 0).toLocaleString('pt-BR')}</strong>
                        </div>
                        <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                          Valor unitário: <strong>R$ {Number(resolvePedidoValorUnitario(pedido) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                        {pedido.destino_atribuido_em && (
                          <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                            Data da atribuição: <strong>{formatDateTime(pedido.destino_atribuido_em)}</strong>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                          Entregue
                        </span>
                        {pedido.destino_clinica ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                            {pedido.destino_clinica}
                          </span>
                        ) : (
                          <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                            Sem destino
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handlePrepareEntradaCompra(
                              pedido,
                              pedido.destino_clinica,
                              pedido.destino_atribuido_em
                            )
                          }
                          className={`${buttonClassName} bg-button text-white hover:bg-button-hover`}
                        >
                          Definir destino
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
              <button type="button" onClick={() => setShowPedidosPendentesModal(false)} className={`${buttonClassName} border border-neutral-300 bg-white text-neutral-700`}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {showMovimentacaoModal && (
        <div className={overlayClassName}>
          <div className="flex w-full max-w-6xl max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900/95">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Nova movimentação</h3>
              <button type="button" onClick={() => setShowMovimentacaoModal(false)} className="rounded-full border border-neutral-300 p-2">
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Produto</div>
                  <div className="relative mt-1">
                    <input
                      className={inputClassName}
                      placeholder="Digite para buscar o produto"
                      value={movimentacaoProdutoBusca}
                      onFocus={() => setMovimentacaoProdutoBuscaFocused(true)}
                      onBlur={() => {
                        window.setTimeout(() => setMovimentacaoProdutoBuscaFocused(false), 120);
                      }}
                      onChange={(event) => {
                        const value = event.target.value.toUpperCase();
                        setMovimentacaoProdutoBusca(value);
                        setMovimentacaoProdutoBuscaDirty(true);

                        const exactMatch = findProdutoByComboboxLabel(value);
                        if (exactMatch) {
                          setMovimentacaoForm((prev) => ({ ...prev, produto_id: exactMatch.id }));
                          setMovimentacaoProdutoBuscaDirty(false);
                          return;
                        }

                        setMovimentacaoForm((prev) => ({ ...prev, produto_id: '' }));
                      }}
                    />
                    {movimentacaoProdutoBuscaFocused && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-950">
                        {produtoBuscaSuggestions.length > 0 ? (
                          produtoBuscaSuggestions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              title={option.label}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setMovimentacaoForm((prev) => ({ ...prev, produto_id: option.id }));
                                setMovimentacaoProdutoBusca(option.label);
                                setMovimentacaoProdutoBuscaDirty(false);
                                setMovimentacaoProdutoBuscaFocused(false);
                              }}
                              className="block w-full truncate rounded px-2 py-1 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                            >
                              {option.label}
                            </button>
                          ))
                        ) : (
                          <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                            Nenhum produto encontrado.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {produtosMovimentacaoOptions.length === 0 && (
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                      Nenhum produto cadastrado no estoque. Cadastre em Estoque &gt; Novo produto.
                    </div>
                  )}
                  {movimentacaoForm.tipo_movimentacao === 'entrada_compra' && !movimentacaoForm.produto_id && (
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
                      Se não houver produto cadastrado, ele será criado automaticamente a partir do tipo de item.
                    </div>
                  )}
                  {movimentacaoForm.tipo_movimentacao === 'entrada_compra' && (
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
                      PEDIDO ENTREGUE: DEFINA O DESTINO FINAL DIRETO NESTA ENTRADA (SEM PASSAR POR SAÍDA).
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Ação</div>
                  <select
                    className={inputClassName}
                    value={movimentacaoForm.tipo_movimentacao}
                    onChange={(event) =>
                      setMovimentacaoForm((prev) => {
                        const nextTipo = event.target.value as ParqueMovimentacaoFormValues['tipo_movimentacao'];
                        if (prev.pedido_compra_id && nextTipo !== 'entrada_compra') {
                          setFormError('PARA PEDIDOS ENTREGUES, USE AÇÃO ENTRADA COMPRA E DEFINA O DESTINO FINAL (PARQUE TECNOLÓGICO, CLÍNICA OU MATRIZ - SETOR).');
                          return prev;
                        }
                        setFormError('');
                        if (nextTipo === 'entrada_compra') {
                          return {
                            ...prev,
                            tipo_movimentacao: nextTipo,
                            origem_tipo: 'compra',
                            origem_descricao: prev.pedido_compra_id ? prev.origem_descricao : '',
                            destino_tipo: 'estoque',
                            destino_descricao: DESTINO_PARQUE_TECNOLOGICO,
                            observacao: removerSetorMatrizDaObservacao(prev.observacao),
                            setor_destino: '',
                          };
                        }
                        if (nextTipo === 'saida_clinica') {
                          return {
                            ...prev,
                            tipo_movimentacao: nextTipo,
                            origem_tipo: 'estoque',
                            origem_descricao: 'PARQUE TECNOLOGICO',
                            destino_tipo: 'clinica',
                            destino_descricao: '',
                            pedido_compra_id: '',
                            setor_destino: '',
                            observacao: removerSetorMatrizDaObservacao(prev.observacao),
                          };
                        }
                        if (nextTipo === 'saida_setor') {
                          const setorAtual = prev.setor_destino || setorOptions[0] || MATRIZ_SETOR_PADRAO;
                          return {
                            ...prev,
                            tipo_movimentacao: nextTipo,
                            origem_tipo: 'estoque',
                            origem_descricao: 'PARQUE TECNOLOGICO',
                            destino_tipo: 'setor',
                            destino_descricao: `MATRIZ - ${normalizeLookupText(setorAtual)}`,
                            pedido_compra_id: '',
                            setor_destino: normalizeLookupText(setorAtual),
                            observacao: removerSetorMatrizDaObservacao(prev.observacao),
                          };
                        }
                        if (nextTipo === 'descarte') {
                          return {
                            ...prev,
                            tipo_movimentacao: nextTipo,
                            origem_tipo: 'estoque',
                            origem_descricao: 'PARQUE TECNOLOGICO',
                            destino_tipo: 'descarte',
                            destino_descricao: 'DESCARTE',
                            pedido_compra_id: '',
                            observacao: removerSetorMatrizDaObservacao(prev.observacao),
                            setor_destino: '',
                          };
                        }
                        return {
                          ...prev,
                          tipo_movimentacao: nextTipo,
                          origem_tipo: nextTipo === 'entrada_manual' ? 'pre-cadastro' : 'estoque',
                          origem_descricao: nextTipo === 'entrada_manual' ? 'PRE-CADASTRO' : 'PARQUE TECNOLOGICO',
                          destino_tipo: 'estoque',
                          destino_descricao: DESTINO_PARQUE_TECNOLOGICO,
                          pedido_compra_id: '',
                          observacao: removerSetorMatrizDaObservacao(prev.observacao),
                          setor_destino: '',
                        };
                      })
                    }
                  >
                    {tipoMovimentacaoOptions.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {getTipoMovimentacaoLabel(tipo)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Quantidade</div>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={
                      movimentacaoForm.tipo_movimentacao === 'entrada_compra' && saldoCompraDisponivel > 0
                        ? saldoCompraDisponivel
                        : undefined
                    }
                    className={inputClassName}
                    placeholder="Quantidade"
                    value={numberValue(movimentacaoForm.quantidade)}
                    onChange={(event) =>
                      setMovimentacaoForm((prev) => ({
                        ...prev,
                        quantidade: event.target.value === '' ? '' : Number(event.target.value),
                      }))
                    }
                  />
                  {movimentacaoForm.tipo_movimentacao === 'entrada_compra' && (
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
                      SALDO COMPRA DISPONÍVEL: {Number(saldoCompraDisponivel || 0).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Data da movimentação</div>
                  <input type="datetime-local" className={inputClassName} value={movimentacaoForm.data_movimentacao} onChange={(event) => setMovimentacaoForm((prev) => ({ ...prev, data_movimentacao: event.target.value }))} />
                </div>

                {movimentacaoForm.tipo_movimentacao === 'entrada_compra' && (
                  <>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Pedido entregue (origem)</div>
                      <select
                        className={inputClassName}
                        value={movimentacaoForm.pedido_compra_id}
                        onChange={(event) => {
                          const pedido = pedidosEntreguesComDestino.find((row) => row.id === event.target.value);
                          const produtoEncontrado = findProdutoByPedidoItem(pedido?.item);
                          const produtoLabel = produtoEncontrado ? getMovimentacaoProdutoOptionLabel(produtoEncontrado) : '';
                          const destinoSugerido = resolveDestinoFromHistorico(pedido?.destino_clinica);
                          setMovimentacaoForm((prev) => ({
                            ...prev,
                            produto_id: produtoEncontrado?.id || prev.produto_id,
                            pedido_compra_id: event.target.value,
                            quantidade: Number(pedido?.quantidade_disponivel || 0) > 0 ? Number(pedido?.quantidade_disponivel) : prev.quantidade,
                            origem_tipo: 'compra',
                            origem_descricao: resolvePedidoLojaOrigem(pedido),
                            destino_tipo: destinoSugerido.destinoTipo,
                            destino_descricao: destinoSugerido.destinoDescricao,
                            valor_unitario: resolvePedidoValorUnitario(pedido),
                            data_movimentacao: pedido ? resolvePedidoDataMovimentacao(pedido, pedido.destino_atribuido_em) : prev.data_movimentacao,
                            setor_destino: destinoSugerido.setorDestino,
                          }));
                          setMovimentacaoProdutoBusca(produtoLabel);
                          setMovimentacaoProdutoBuscaDirty(false);
                        }}
                      >
                        <option value="">Selecione o pedido entregue</option>
                        {pedidosEntreguesComDestino.map((pedido) => (
                          <option key={pedido.id} value={pedido.id}>
                            {pedido.origem_label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Valor unitário (R$)</div>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className={inputClassName}
                        placeholder="Valor unitário"
                        value={numberValue(movimentacaoForm.valor_unitario)}
                        onChange={(event) =>
                          setMovimentacaoForm((prev) => ({
                            ...prev,
                            valor_unitario: event.target.value === '' ? '' : Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </>
                )}

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Origem</div>
                  <select
                    className={inputClassName}
                    value={movimentacaoForm.tipo_movimentacao === 'entrada_compra' ? 'compra' : movimentacaoForm.origem_tipo}
                    disabled={movimentacaoForm.tipo_movimentacao === 'entrada_compra'}
                    onChange={(event) =>
                      setMovimentacaoForm((prev) => {
                        const origemSelecionada = normalizeLookupText(event.target.value);
                        const lojaOrigem = resolveLojaOrigemCompraProduto(prev.produto_id);

                        let origemDescricao = origemSelecionada;
                        if (prev.tipo_movimentacao === 'entrada_compra') {
                          origemDescricao = prev.origem_descricao;
                        } else if (origemSelecionada === 'COMPRA') {
                          origemDescricao = lojaOrigem || 'COMPRA';
                        } else if (origemSelecionada === 'ESTOQUE') {
                          origemDescricao = 'PARQUE TECNOLOGICO';
                        } else if (origemSelecionada === 'PRE-CADASTRO') {
                          origemDescricao = 'PRE-CADASTRO';
                        }

                        return {
                          ...prev,
                          origem_tipo: event.target.value,
                          origem_descricao: origemDescricao,
                        };
                      })
                    }
                  >
                    <option value="">Selecione a origem</option>
                    {origemTipoOptions.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {formatMovementTypeLabel(tipo)}
                      </option>
                    ))}
                  </select>
                  {normalizeLookupText(movimentacaoForm.origem_tipo) === 'COMPRA' && lojaOrigemSelecionada && (
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
                      LOJA DE ORIGEM: {formatUpperText(lojaOrigemSelecionada)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Destino
                  </div>
                  <select
                    className={inputClassName}
                    value={movimentacaoForm.destino_descricao}
                    onChange={(event) =>
                      setMovimentacaoForm((prev) => {
                        const destinoSelecionado = normalizeLookupText(event.target.value);
                        const setorDestino =
                          prev.tipo_movimentacao === 'saida_setor'
                            ? normalizeLookupText(destinoSelecionado.replace(/^MATRIZ\s*-\s*/i, ''))
                            : '';
                        return {
                          ...prev,
                          destino_descricao: destinoSelecionado,
                          destino_tipo: inferDestinoTipo(prev.tipo_movimentacao, destinoSelecionado),
                          setor_destino: setorDestino,
                          observacao: removerSetorMatrizDaObservacao(prev.observacao),
                        };
                      })
                    }
                  >
                    <option value="">Selecione o destino</option>
                    {destinoOptions.map((destino) => (
                      <option key={destino} value={destino}>
                        {formatUpperText(destino)}
                      </option>
                    ))}
                  </select>
                  {movimentacaoForm.tipo_movimentacao === 'saida_setor' && (
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Selecione o destino no formato MATRIZ - SETOR.
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 lg:col-span-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Observação</div>
                  <textarea className={`${inputClassName} h-[42px] min-h-[42px] resize-none`} placeholder="Observação" value={movimentacaoForm.observacao} onChange={(event) => setMovimentacaoForm((prev) => ({ ...prev, observacao: event.target.value.toUpperCase() }))} />
                </div>
              </div>
              {formError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
              <button type="button" onClick={() => setShowMovimentacaoModal(false)} className={`${buttonClassName} border border-neutral-300 bg-white text-neutral-700`}>
                Cancelar
              </button>
              <button type="button" onClick={handleSaveMovimentacao} disabled={saving} className={`${buttonClassName} bg-button text-white hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60`}>
                {saving ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {mode === 'inventario' && showDescarteModal && <div className={overlayClassName}><div className={modalClassName}><div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800"><h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Registrar descarte</h3><button type="button" onClick={() => setShowDescarteModal(false)} className="rounded-full border border-neutral-300 p-2"><Plus className="h-4 w-4 rotate-45" /></button></div><div className="max-h-[72vh] overflow-y-auto px-5 py-4"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><select className={inputClassName} value={descarteForm.produto_id} onChange={(event) => setDescarteForm((prev) => ({ ...prev, produto_id: event.target.value }))}><option value="">Selecione o produto</option>{produtos.map((produto) => <option key={produto.id} value={produto.id}>{getParqueProdutoLabel(produto)}</option>)}</select><input type="number" min="0.01" step="0.01" className={inputClassName} placeholder="Quantidade" value={numberValue(descarteForm.quantidade)} onChange={(event) => setDescarteForm((prev) => ({ ...prev, quantidade: event.target.value === '' ? '' : Number(event.target.value) }))} /><input type="datetime-local" className={inputClassName} value={descarteForm.data_descarte} onChange={(event) => setDescarteForm((prev) => ({ ...prev, data_descarte: event.target.value }))} /><input className={inputClassName} placeholder="Motivo" value={descarteForm.motivo} onChange={(event) => setDescarteForm((prev) => ({ ...prev, motivo: event.target.value.toUpperCase() }))} /><textarea className={inputClassName} placeholder="Observação" value={descarteForm.observacao} onChange={(event) => setDescarteForm((prev) => ({ ...prev, observacao: event.target.value.toUpperCase() }))} /></div>{formError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}</div><div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800"><button type="button" onClick={() => setShowDescarteModal(false)} className={`${buttonClassName} border border-neutral-300 bg-white text-neutral-700`}>Cancelar</button><button type="button" onClick={handleSaveDescarte} disabled={saving} className={`${buttonClassName} bg-button text-white hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60`}>{saving ? 'Salvando...' : 'Registrar'}</button></div></div></div>}
      {historyProduto && <div className={overlayClassName}><div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900/95"><div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800"><div><h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Histórico do item</h3><p className="text-xs text-neutral-500 dark:text-neutral-400">{formatUpperText(getParqueProdutoLabel(historyProduto))}</p></div><button type="button" onClick={() => setHistoryProduto(null)} className="rounded-full border border-neutral-300 p-2"><Plus className="h-4 w-4 rotate-45" /></button></div><div className="max-h-[72vh] overflow-y-auto px-5 py-4">{historyLoading ? <div className="py-8 text-center text-sm text-neutral-500">Carregando...</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Origem</th><th className="px-3 py-3">Destino</th><th className="px-3 py-3 text-right">Quantidade</th><th className="px-3 py-3">Observação</th></tr></thead><tbody>{historyRows.map((row) => <tr key={row.id} className="border-b border-neutral-100 dark:border-neutral-800"><td className="px-3 py-3">{formatDateTime(row.data_movimentacao)}</td><td className="px-3 py-3"><span className={movementBadgeClass(row.tipo_movimentacao)}>{getTipoMovimentacaoLabel(row.tipo_movimentacao)}</span></td><td className="px-3 py-3">{formatUpperText(row.origem_descricao || row.origem_tipo)}</td><td className="px-3 py-3">{formatUpperText(row.destino_descricao || row.destino_tipo)}</td><td className="px-3 py-3 text-right font-semibold">{row.quantidade.toLocaleString('pt-BR')}</td><td className="px-3 py-3">{formatUpperText(row.observacao)}</td></tr>)}{historyRows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-neutral-500">Nenhuma movimentação.</td></tr>}</tbody></table></div>}</div></div></div>}
    </div>
  );
}
