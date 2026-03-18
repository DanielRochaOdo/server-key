import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { listControleUberByCompetencia, ControleUberRow } from '../services/controleUber';
import ModuleHeader from '../components/ModuleHeader';

type ClinicKey = 'AGUANAMBI' | 'BEZERRA' | 'PARANGABA' | 'SOBRAL' | 'MATRIZ';

type MensalItem = {
  id: string;
  ano: number;
  mes: number;
  item: string;
  quantidade: number;
  valor_unit: number;
  valor_total_frete: number;
  protocolo_item_id?: string | null;
};

type ProtocoloItemLite = {
  id: string;
  loja: string | null;
  produto: string | null;
};

type InventoryMovement = {
  id: string;
  monthKey: string;
  clinic: ClinicKey;
  product: string;
  store: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: string;
};

type InventoryHistoryMovement = {
  id: string;
  competencia: string;
  clinic: string;
  product: string;
  store: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: string;
};

type MovementStore = Record<string, InventoryMovement[]>;
type UnifyStore = Record<string, string>;
type CarryoverStore = Record<string, Record<string, { quantity: number; totalCost: number }>>;

type MonthData = {
  uber: ControleUberRow[];
  compras: MensalItem[];
  protocoloMap: Record<string, ProtocoloItemLite>;
};

type PurchaseHistoryData = {
  compras: MensalItem[];
  protocoloMap: Record<string, ProtocoloItemLite>;
};

const CLINICAS: { key: ClinicKey; label: string }[] = [
  { key: 'MATRIZ', label: 'Matriz' },
  { key: 'AGUANAMBI', label: 'Aguanambi' },
  { key: 'BEZERRA', label: 'Bezerra' },
  { key: 'PARANGABA', label: 'Parangaba' },
  { key: 'SOBRAL', label: 'Sobral' },
];

const CLINIC_COMPARISON_COLORS: Record<ClinicKey, string> = {
  MATRIZ: '#0ea5e9',
  AGUANAMBI: '#22c55e',
  BEZERRA: '#f59e0b',
  PARANGABA: '#8b5cf6',
  SOBRAL: '#ef4444',
};

const toMonthKey = (date: Date) => date.toISOString().slice(0, 7);

const getPrevMonthKey = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  const prev = new Date(year, month - 2, 1);
  return toMonthKey(prev);
};

const monthKeyToCompetencia = (monthKey: string) => `${monthKey}-01`;

const monthKeyToRange = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    year,
    month,
  };
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeKey = (value?: string | null) => {
  const cleaned = normalizeWhitespace(value || '');
  return (cleaned || 'SEM PRODUTO').toUpperCase();
};
const normalizeAliasKey = (value?: string | null) =>
  normalizeKey(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const normalizeSearch = (value?: string | null) => normalizeWhitespace(value || '').toUpperCase();
const normalizeStore = (value?: string | null) => {
  const cleaned = normalizeWhitespace(value || '');
  return (cleaned || 'SEM LOJA').toUpperCase();
};
const BUILTIN_PRODUCT_ALIASES: Record<string, string> = {
  [normalizeAliasKey('MEMORIA RAM 8GB DDR3')]: 'MEMORIA 8GB',
  [normalizeAliasKey('PLACA MAE SOCKET 1155')]: 'PLACA MAE 1155',
};
const resolveUnifiedTarget = (value: string, unifyMap: UnifyStore) => {
  let current = normalizeKey(value);
  const visited = new Set<string>();

  while (!visited.has(current)) {
    visited.add(current);
    const mappedByAlias = BUILTIN_PRODUCT_ALIASES[normalizeAliasKey(current)];
    const next = normalizeKey(unifyMap[current] || mappedByAlias || current);
    if (!next || next === current) break;
    current = next;
  }

  return current;
};
const productStoreKey = (product: string, store: string) => `${product}__${store}`;
const UI_STATE_KEY = 'serverkey:custos_clinicas_ui';

const loadUiState = () => {
  if (typeof window === 'undefined') {
    return null as null | {
      monthKey?: string;
      expandedProducts?: Record<string, boolean>;
      showMovementModal?: boolean;
      showUnifyModal?: boolean;
      productSearch?: string;
    };
  }
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      monthKey?: string;
      expandedProducts?: Record<string, boolean>;
      showMovementModal?: boolean;
      showUnifyModal?: boolean;
      productSearch?: string;
    };
  } catch {
    return null;
  }
};

const saveUiState = (state: {
  monthKey: string;
  expandedProducts: Record<string, boolean>;
  showMovementModal: boolean;
  showUnifyModal: boolean;
  productSearch: string;
}) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return 'R$ 0,00';
  const numeric = typeof value === 'string'
    ? Number(value.replace(/\./g, '').replace(',', '.'))
    : Number(value);
  if (!Number.isFinite(numeric)) return 'R$ 0,00';
  return numeric.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseNumberValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  let normalized = trimmed;
  if (trimmed.includes(',') && trimmed.includes('.')) {
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else if (trimmed.includes(',')) {
    normalized = trimmed.replace(',', '.');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value?: string | null) => (value || '').toLowerCase();

const resolveClinicLabel = (value?: string | null): ClinicKey | null => {
  const text = normalizeText(value);
  if (!text) return null;
  if (text.includes('aguanambi')) return 'AGUANAMBI';
  if (text.includes('bezerra')) return 'BEZERRA';
  if (text.includes('parangaba')) return 'PARANGABA';
  if (text.includes('sobral')) return 'SOBRAL';
  return null;
};

const isAdminLocation = (value?: string | null) => {
  const text = normalizeText(value);
  if (!text) return false;
  return (
    text.includes('administracao') ||
    text.includes('admin') ||
    text.includes('adm') ||
    text.includes('matriz')
  );
};

const resolveClinicFromUber = (row: ControleUberRow): ClinicKey | null => {
  const destinoClinic = resolveClinicLabel(row.destino);
  if (destinoClinic) return destinoClinic;

  const saidaClinic = resolveClinicLabel(row.saida_local);
  const destinoIsAdmin = isAdminLocation(row.destino);

  if (saidaClinic && destinoIsAdmin) return saidaClinic;
  if (saidaClinic && !destinoIsAdmin) return saidaClinic;

  return null;
};

const fetchUnifyStore = async (): Promise<UnifyStore> => {
  const { data, error } = await supabase
    .from('custos_clinicas_unify')
    .select('source_name, unified_name');

  if (error) {
    console.error('Erro ao carregar unificacao:', error);
    return {};
  }

  const map: UnifyStore = {};
  (data || []).forEach((row: any) => {
    const source = normalizeKey(row.source_name);
    const unified = normalizeKey(row.unified_name || row.source_name);
    if (source) map[source] = unified || source;
  });
  return map;
};

const formatQuantity = (value?: number | string | null) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const fetchMovementsByMonth = async (monthKey: string): Promise<InventoryMovement[]> => {
  const competencia = monthKeyToCompetencia(monthKey);
  const { data, error } = await supabase
    .from('custos_clinicas_movements')
    .select('id, competencia, clinic, product, store, quantity, unit_cost, total_cost, created_at')
    .eq('competencia', competencia)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao carregar movimentacoes:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    monthKey: monthKey,
    clinic: row.clinic as ClinicKey,
    product: normalizeKey(row.product),
    store: normalizeStore(row.store),
    quantity: parseNumberValue(row.quantity),
    unitCost: parseNumberValue(row.unit_cost),
    totalCost: parseNumberValue(row.total_cost),
    createdAt: row.created_at,
  }));
};

const fetchCarryoverByMonth = async (
  monthKey: string
): Promise<Record<string, { quantity: number; totalCost: number }>> => {
  const competencia = monthKeyToCompetencia(monthKey);
  const { data, error } = await supabase
    .from('custos_clinicas_carryover')
    .select('product, store, quantity, total_cost')
    .eq('competencia', competencia);

  if (error) {
    console.error('Erro ao carregar estoque acumulado:', error);
    return {};
  }

  const map: Record<string, { quantity: number; totalCost: number }> = {};
  (data || []).forEach((row: any) => {
    const product = normalizeKey(row.product);
    const store = normalizeStore(row.store);
    if (!product) return;
    map[productStoreKey(product, store)] = {
      quantity: parseNumberValue(row.quantity),
      totalCost: parseNumberValue(row.total_cost),
    };
  });
  return map;
};

const fetchMonthData = async (monthKey: string): Promise<MonthData> => {
  const { year, month } = monthKeyToRange(monthKey);

  const [uber, comprasRes] = await Promise.all([
    listControleUberByCompetencia(monthKeyToCompetencia(monthKey)).catch(() => []),
    supabase
      .from('pc_mensal_itens')
      .select('id, ano, mes, item, quantidade, valor_unit, valor_total_frete, protocolo_item_id')
      .eq('ano', year)
      .eq('mes', month)
      .eq('status', 'ENTREGUE'),
  ]);

  if (comprasRes.error) {
    console.error('Erro ao carregar compras:', comprasRes.error);
  }

  const comprasData = (comprasRes.data || []) as MensalItem[];
  const protocoloIds = Array.from(
    new Set(
      comprasData
        .map((item) => item.protocolo_item_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let protocoloMap: Record<string, ProtocoloItemLite> = {};
  if (protocoloIds.length > 0) {
    const { data: protocoloData, error: protocoloError } = await supabase
      .from('pc_protocolo_itens')
      .select('id, loja, produto')
      .in('id', protocoloIds);

    if (protocoloError) {
      console.error('Erro ao carregar itens de protocolo:', protocoloError);
    } else {
      (protocoloData || []).forEach((row: any) => {
        if (!row?.id) return;
        protocoloMap[row.id] = {
          id: row.id,
          loja: row.loja ?? null,
          produto: row.produto ?? null,
        };
      });
    }
  }

  return {
    uber: (uber || []) as ControleUberRow[],
    compras: comprasData,
    protocoloMap,
  };
};

const CustosClinicas: React.FC = () => {
  const [monthKey, setMonthKey] = useState(() => {
    const saved = loadUiState();
    return saved?.monthKey || toMonthKey(new Date());
  });
  const [loading, setLoading] = useState(true);
  const [currentData, setCurrentData] = useState<MonthData>({
    uber: [],
    compras: [],
    protocoloMap: {},
  });
  const [previousData, setPreviousData] = useState<MonthData>({
    uber: [],
    compras: [],
    protocoloMap: {},
  });
  const [unifyStore, setUnifyStore] = useState<UnifyStore>({});
  const [movementStore, setMovementStore] = useState<MovementStore>({});
  const [carryoverStore, setCarryoverStore] = useState<CarryoverStore>({});
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryData>({
    compras: [],
    protocoloMap: {},
  });
  const [movementHistory, setMovementHistory] = useState<InventoryMovement[]>([]);
  const [showMovementModal, setShowMovementModal] = useState(() => {
    const saved = loadUiState();
    return Boolean(saved?.showMovementModal);
  });
  const [showUnifyModal, setShowUnifyModal] = useState(() => {
    const saved = loadUiState();
    return Boolean(saved?.showUnifyModal);
  });
  const [movementError, setMovementError] = useState('');
  const [movementSaving, setMovementSaving] = useState(false);
  const [unifySaving, setUnifySaving] = useState(false);
  const [unifyError, setUnifyError] = useState('');
  const [expandedMovementClinics, setExpandedMovementClinics] = useState<Record<ClinicKey, boolean>>({
    MATRIZ: false,
    AGUANAMBI: false,
    BEZERRA: false,
    PARANGABA: false,
    SOBRAL: false,
  });
  const [movementDraft, setMovementDraft] = useState<{
    product: string;
    store: string;
    clinic: ClinicKey | '';
    quantity: number | '';
  }>({
    product: '',
    store: '',
    clinic: '' as ClinicKey | '',
    quantity: '',
  });
  const [productSearch, setProductSearch] = useState(() => {
    const saved = loadUiState();
    return saved?.productSearch || '';
  });
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [unifyStep, setUnifyStep] = useState<'select' | 'name'>('select');
  const [unifySelected, setUnifySelected] = useState<string[]>([]);
  const [unifyName, setUnifyName] = useState('');
  const [unifySearch, setUnifySearch] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>(() => {
    const saved = loadUiState();
    return saved?.expandedProducts || {};
  });
  const [selectedItemsClinic, setSelectedItemsClinic] = useState<ClinicKey | null>(null);
  const [selectedUberClinic, setSelectedUberClinic] = useState<ClinicKey | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState('');
  const [historyRows, setHistoryRows] = useState<InventoryHistoryMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const prevMonthKey = useMemo(() => getPrevMonthKey(monthKey), [monthKey]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const prevPrevMonthKey = getPrevMonthKey(prevMonthKey);
      const [
        current,
        previous,
        unifyMap,
        movementCurrent,
        movementPrev,
        carryPrev,
        carryPrevPrev,
        historyPurchases,
        historyMovements,
      ] =
        await Promise.all([
        fetchMonthData(monthKey),
        fetchMonthData(prevMonthKey),
        fetchUnifyStore(),
        fetchMovementsByMonth(monthKey),
        fetchMovementsByMonth(prevMonthKey),
        fetchCarryoverByMonth(prevMonthKey),
        fetchCarryoverByMonth(prevPrevMonthKey),
        fetchPurchasesUpToMonth(monthKey),
        fetchMovementsUpToMonth(monthKey),
      ]);
      setCurrentData(current);
      setPreviousData(previous);
      setUnifyStore(unifyMap);
      setMovementStore({
        [monthKey]: movementCurrent,
        [prevMonthKey]: movementPrev,
      });
      setCarryoverStore((prev) => ({
        ...prev,
        [prevMonthKey]: carryPrev,
        [prevPrevMonthKey]: carryPrevPrev,
      }));
      setPurchaseHistory(historyPurchases);
      setMovementHistory(historyMovements);
    } finally {
      setLoading(false);
    }
  }, [monthKey, prevMonthKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    saveUiState({
      monthKey,
      expandedProducts,
      showMovementModal,
      showUnifyModal,
      productSearch,
    });
  }, [monthKey, expandedProducts, showMovementModal, showUnifyModal, productSearch]);

  const movements = useMemo(
    () => movementStore[monthKey] || [],
    [movementStore, monthKey]
  );
  const movementByClinic = useMemo(() => {
    const map: Record<ClinicKey, InventoryMovement[]> = {
      MATRIZ: [],
      AGUANAMBI: [],
      BEZERRA: [],
      PARANGABA: [],
      SOBRAL: [],
    };
    movements.forEach((movement) => {
      map[movement.clinic].push(movement);
    });
    (Object.keys(map) as ClinicKey[]).forEach((clinicKey) => {
      map[clinicKey] = map[clinicKey].slice().sort((a, b) => {
        const productCompare = a.product.localeCompare(b.product, 'pt-BR', { sensitivity: 'base' });
        if (productCompare !== 0) return productCompare;
        return a.store.localeCompare(b.store, 'pt-BR', { sensitivity: 'base' });
      });
    });
    return map;
  }, [movements]);
  const movementClinics = useMemo(
    () => CLINICAS.filter((clinic) => movementByClinic[clinic.key].length > 0),
    [movementByClinic]
  );
  const historyByClinic = useMemo(() => {
    const map: Record<string, number> = {};
    historyRows.forEach((row) => {
      const clinic = normalizeKey(row.clinic);
      map[clinic] = (map[clinic] || 0) + Number(row.quantity || 0);
    });
    return map;
  }, [historyRows]);
  const historyTotalQuantity = useMemo(
    () => historyRows.reduce((acc, row) => acc + Number(row.quantity || 0), 0),
    [historyRows]
  );

  const prevMovements = useMemo(
    () => movementStore[prevMonthKey] || [],
    [movementStore, prevMonthKey]
  );

  const updateUnifyStore = (next: UnifyStore) => {
    setUnifyStore(next);
  };

  const addMovementLocal = (movement: InventoryMovement) => {
    setMovementStore((prev) => {
      const current = prev[monthKey] || [];
      return { ...prev, [monthKey]: [...current, movement] };
    });
    setMovementHistory((prev) => [...prev, movement]);
  };

  const removeMovementLocal = (id: string) => {
    setMovementStore((prev) => {
      const current = prev[monthKey] || [];
      return { ...prev, [monthKey]: current.filter((item) => item.id !== id) };
    });
    setMovementHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const uberTotals = useMemo(() => {
    const totals: Record<ClinicKey, number> = {
      MATRIZ: 0,
      AGUANAMBI: 0,
      BEZERRA: 0,
      PARANGABA: 0,
      SOBRAL: 0,
    };
    currentData.uber.forEach((row) => {
      const clinic = resolveClinicFromUber(row);
      if (!clinic) return;
      const total = Number(row.valor_saida || 0) + Number(row.valor_retorno || 0);
      totals[clinic] += total;
    });
    return totals;
  }, [currentData.uber]);

  const prevUberTotals = useMemo(() => {
    const totals: Record<ClinicKey, number> = {
      MATRIZ: 0,
      AGUANAMBI: 0,
      BEZERRA: 0,
      PARANGABA: 0,
      SOBRAL: 0,
    };
    previousData.uber.forEach((row) => {
      const clinic = resolveClinicFromUber(row);
      if (!clinic) return;
      const total = Number(row.valor_saida || 0) + Number(row.valor_retorno || 0);
      totals[clinic] += total;
    });
    return totals;
  }, [previousData.uber]);

  const purchaseSources = useMemo(() => {
    return currentData.compras.map((item) => {
      const protocolo = item.protocolo_item_id
        ? currentData.protocoloMap[item.protocolo_item_id]
        : undefined;
      const sourceName = normalizeKey(item.item || protocolo?.produto);
      const storeName = normalizeStore(protocolo?.loja);
      const unifiedName = resolveUnifiedTarget(sourceName, unifyStore);
      const quantity = parseNumberValue(item.quantidade);
      const totalCost = parseNumberValue(item.valor_total_frete);
      const unitCost = quantity > 0 ? totalCost / quantity : 0;
      return {
        id: item.id,
        sourceName,
        unifiedName,
        storeName,
        quantity,
        totalCost,
        unitCost,
      };
    });
  }, [currentData.compras, currentData.protocoloMap, unifyStore]);

  const prevPurchaseSources = useMemo(() => {
    return previousData.compras.map((item) => {
      const protocolo = item.protocolo_item_id
        ? previousData.protocoloMap[item.protocolo_item_id]
        : undefined;
      const sourceName = normalizeKey(item.item || protocolo?.produto);
      const storeName = normalizeStore(protocolo?.loja);
      const unifiedName = resolveUnifiedTarget(sourceName, unifyStore);
      const quantity = parseNumberValue(item.quantidade);
      const totalCost = parseNumberValue(item.valor_total_frete);
      const unitCost = quantity > 0 ? totalCost / quantity : 0;
      return {
        id: item.id,
        sourceName,
        unifiedName,
        storeName,
        quantity,
        totalCost,
        unitCost,
      };
    });
  }, [previousData.compras, previousData.protocoloMap, unifyStore]);

  const comprasTotals = useMemo(() => {
    const totals: Record<ClinicKey, number> = {
      MATRIZ: 0,
      AGUANAMBI: 0,
      BEZERRA: 0,
      PARANGABA: 0,
      SOBRAL: 0,
    };

    movements.forEach((movement) => {
      totals[movement.clinic] += Number(movement.totalCost || 0);
    });

    return totals;
  }, [movements]);

  const prevComprasTotals = useMemo(() => {
    const totals: Record<ClinicKey, number> = {
      MATRIZ: 0,
      AGUANAMBI: 0,
      BEZERRA: 0,
      PARANGABA: 0,
      SOBRAL: 0,
    };

    prevMovements.forEach((movement) => {
      totals[movement.clinic] += Number(movement.totalCost || 0);
    });

    return totals;
  }, [prevMovements]);

  const totalUber = useMemo(
    () => Object.values(uberTotals).reduce((acc, value) => acc + value, 0),
    [uberTotals]
  );
  const totalCompras = useMemo(
    () => Object.values(comprasTotals).reduce((acc, value) => acc + value, 0),
    [comprasTotals]
  );
  const totalGeral = totalUber + totalCompras;

  const comparisonRows = useMemo(() => {
    return CLINICAS.map((clinic) => {
      const current = uberTotals[clinic.key] + comprasTotals[clinic.key];
      const previous = prevUberTotals[clinic.key] + prevComprasTotals[clinic.key];
      const diff = current - previous;
      const pct = previous > 0 ? (diff / previous) * 100 : null;
      return { ...clinic, current, previous, diff, pct };
    });
  }, [uberTotals, comprasTotals, prevUberTotals, prevComprasTotals]);

  const comparisonTotalCurrent = useMemo(
    () => comparisonRows.reduce((acc, row) => acc + Number(row.current || 0), 0),
    [comparisonRows]
  );
  const comparisonDonutGradient = useMemo(() => {
    if (comparisonTotalCurrent <= 0) {
      return 'conic-gradient(#d4d4d8 0 100%)';
    }
    let start = 0;
    const slices: string[] = [];
    comparisonRows.forEach((row) => {
      const value = Math.max(0, Number(row.current || 0));
      if (value <= 0) return;
      const end = start + (value / comparisonTotalCurrent) * 100;
      slices.push(`${CLINIC_COMPARISON_COLORS[row.key]} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
      start = end;
    });
    if (start < 100) {
      slices.push(`#d4d4d8 ${start.toFixed(2)}% 100%`);
    }
    return `conic-gradient(${slices.join(', ')})`;
  }, [comparisonRows, comparisonTotalCurrent]);
  const selectedComparisonRow = useMemo(() => {
    if (!selectedItemsClinic) return null;
    return comparisonRows.find((row) => row.key === selectedItemsClinic) || null;
  }, [comparisonRows, selectedItemsClinic]);

  const movementCount = movements.length;
  const clinicItemsMap = useMemo(() => {
    const map: Record<ClinicKey, Record<string, { product: string; store: string; quantity: number; totalCost: number }>> =
      {
        MATRIZ: {},
        AGUANAMBI: {},
        BEZERRA: {},
        PARANGABA: {},
        SOBRAL: {},
      };
    movements.forEach((movement) => {
      const key = productStoreKey(movement.product, movement.store);
      const bucket = map[movement.clinic];
      if (!bucket[key]) {
        bucket[key] = { product: movement.product, store: movement.store, quantity: 0, totalCost: 0 };
      }
      bucket[key].quantity += Number(movement.quantity || 0);
      bucket[key].totalCost += Number(movement.totalCost || 0);
    });
    return (Object.keys(map) as ClinicKey[]).reduce<Record<ClinicKey, { product: string; store: string; quantity: number; totalCost: number }[]>>(
      (acc, clinicKey) => {
        acc[clinicKey] = Object.values(map[clinicKey]).sort((a, b) => {
          const productCompare = a.product.localeCompare(b.product, 'pt-BR', { sensitivity: 'base' });
          if (productCompare !== 0) return productCompare;
          return a.store.localeCompare(b.store, 'pt-BR', { sensitivity: 'base' });
        });
        return acc;
      },
      {
        MATRIZ: [],
        AGUANAMBI: [],
        BEZERRA: [],
        PARANGABA: [],
        SOBRAL: [],
      }
    );
  }, [movements]);
  const uberRowsByClinic = useMemo(() => {
    const map: Record<ClinicKey, ControleUberRow[]> = {
      MATRIZ: [],
      AGUANAMBI: [],
      BEZERRA: [],
      PARANGABA: [],
      SOBRAL: [],
    };
    currentData.uber.forEach((row) => {
      const clinic = resolveClinicFromUber(row);
      if (!clinic) return;
      map[clinic].push(row);
    });
    (Object.keys(map) as ClinicKey[]).forEach((clinicKey) => {
      map[clinicKey] = map[clinicKey].slice().sort((a, b) => {
        const dateCompare = String(a.data || '').localeCompare(String(b.data || ''));
        if (dateCompare !== 0) return dateCompare;
        return String(a.saida_hora || '').localeCompare(String(b.saida_hora || ''));
      });
    });
    return map;
  }, [currentData.uber]);

  const computeInventorySnapshot = useCallback(
    (
      base: Record<string, { quantity: number; totalCost: number }>,
      sources: {
        unifiedName: string;
        storeName: string;
        quantity: number;
        totalCost: number;
      }[],
      movementList: InventoryMovement[]
    ) => {
      const snapshot: Record<string, { quantity: number; totalCost: number }> = {};

      Object.entries(base || {}).forEach(([key, value]) => {
        const [rawProduct, rawStore] = key.split('__');
        const normalizedProduct = resolveUnifiedTarget(rawProduct, unifyStore);
        const normalizedStore = normalizeStore(rawStore);
        const normalizedKey = productStoreKey(normalizedProduct, normalizedStore);
        snapshot[normalizedKey] = {
          quantity: (snapshot[normalizedKey]?.quantity || 0) + Number(value.quantity || 0),
          totalCost: (snapshot[normalizedKey]?.totalCost || 0) + Number(value.totalCost || 0),
        };
      });

      sources.forEach((item) => {
        if (!item.quantity) return;
        const key = productStoreKey(resolveUnifiedTarget(item.unifiedName, unifyStore), item.storeName);
        snapshot[key] = {
          quantity: (snapshot[key]?.quantity || 0) + item.quantity,
          totalCost: (snapshot[key]?.totalCost || 0) + item.totalCost,
        };
      });

      movementList.forEach((movement) => {
        const key = productStoreKey(resolveUnifiedTarget(movement.product, unifyStore), movement.store);
        const current = snapshot[key] || { quantity: 0, totalCost: 0 };
        snapshot[key] = {
          quantity: Math.max(0, current.quantity - Number(movement.quantity || 0)),
          totalCost: Math.max(0, current.totalCost - Number(movement.totalCost || 0)),
        };
      });

      return snapshot;
    },
    [unifyStore]
  );

  const historyPurchaseSources = useMemo(() => {
    return purchaseHistory.compras.map((item) => {
      const protocolo = item.protocolo_item_id
        ? purchaseHistory.protocoloMap[item.protocolo_item_id]
        : undefined;
      const sourceName = normalizeKey(item.item || protocolo?.produto);
      const storeName = normalizeStore(protocolo?.loja);
      const unifiedName = resolveUnifiedTarget(sourceName, unifyStore);
      const quantity = parseNumberValue(item.quantidade);
      const totalCost = parseNumberValue(item.valor_total_frete);
      const unitCost = quantity > 0 ? totalCost / quantity : 0;
      return {
        id: item.id,
        sourceName,
        unifiedName,
        storeName,
        quantity,
        totalCost,
        unitCost,
      };
    });
  }, [purchaseHistory, unifyStore]);

  const inventoryMap = useMemo(() => {
    return computeInventorySnapshot({}, historyPurchaseSources, movementHistory);
  }, [historyPurchaseSources, movementHistory, computeInventorySnapshot]);

  const inventoryRows = useMemo(() => {
    return Object.entries(inventoryMap)
      .map(([key, value]) => {
        const [product, store] = key.split('__');
        const quantity = Number(value.quantity || 0);
        const totalCost = Number(value.totalCost || 0);
        const unitCost = quantity > 0 ? totalCost / quantity : 0;
        return {
          key,
          product,
          store,
          quantity,
          totalCost,
          unitCost,
        };
      })
      .filter((row) => row.quantity > 0)
      .sort((a, b) => {
        const productCompare = a.product.localeCompare(b.product, 'pt-BR', { sensitivity: 'base' });
        if (productCompare !== 0) return productCompare;
        return a.store.localeCompare(b.store, 'pt-BR', { sensitivity: 'base' });
      });
  }, [inventoryMap]);

  const inventoryByProduct = useMemo(() => {
    const map: Record<
      string,
      { store: string; quantity: number; unitCost: number; totalCost: number }[]
    > = {};
    inventoryRows.forEach((row) => {
      if (!map[row.product]) map[row.product] = [];
      map[row.product].push({
        store: row.store,
        quantity: row.quantity,
        unitCost: row.unitCost,
        totalCost: row.totalCost,
      });
    });
    return map;
  }, [inventoryRows]);

  const inventoryProducts = useMemo(
    () => Object.keys(inventoryByProduct).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })),
    [inventoryByProduct]
  );

  const inventoryAuditByProduct = useMemo(() => {
    const map: Record<
      string,
      { purchasedQty: number; directedQty: number; purchasedCost: number; directedCost: number }
    > = {};

    const ensure = (product: string) => {
      if (!map[product]) {
        map[product] = { purchasedQty: 0, directedQty: 0, purchasedCost: 0, directedCost: 0 };
      }
      return map[product];
    };

    historyPurchaseSources.forEach((item) => {
      const product = resolveUnifiedTarget(item.unifiedName, unifyStore);
      const bucket = ensure(product);
      bucket.purchasedQty += Number(item.quantity || 0);
      bucket.purchasedCost += Number(item.totalCost || 0);
    });

    movementHistory.forEach((movement) => {
      const product = resolveUnifiedTarget(movement.product, unifyStore);
      const bucket = ensure(product);
      bucket.directedQty += Number(movement.quantity || 0);
      bucket.directedCost += Number(movement.totalCost || 0);
    });

    return map;
  }, [historyPurchaseSources, movementHistory, unifyStore]);

  const unifiedProducts = useMemo(() => {
    const map: Record<string, { sources: Set<string>; hasRename: boolean }> = {};
    Object.entries(unifyStore).forEach(([source]) => {
      const normalizedSource = normalizeKey(source);
      const normalizedUnified = resolveUnifiedTarget(normalizedSource, unifyStore);
      if (!map[normalizedUnified]) {
        map[normalizedUnified] = { sources: new Set(), hasRename: false };
      }
      map[normalizedUnified].sources.add(normalizedSource);
      if (normalizedSource !== normalizedUnified) {
        map[normalizedUnified].hasRename = true;
      }
    });

    const set = new Set<string>();
    Object.entries(map).forEach(([product, info]) => {
      if (info.sources.size > 1 || info.hasRename) {
        set.add(product);
      }
    });
    return set;
  }, [unifyStore]);

  useEffect(() => {
    if (loading) return;
    const normalized: Record<string, { quantity: number; totalCost: number }> = {};
    Object.entries(inventoryMap).forEach(([key, value]) => {
      if (value.quantity <= 0) return;
      normalized[key] = {
        quantity: Number(value.quantity || 0),
        totalCost: Number(value.totalCost || 0),
      };
    });

    const existing = carryoverStore[monthKey];
    const existingKeys = existing ? Object.keys(existing) : [];
    const nextKeys = Object.keys(normalized);
    const isSame =
      existingKeys.length === nextKeys.length &&
      nextKeys.every((k) => {
        const current = existing?.[k];
        const next = normalized[k];
        return (
          current &&
          Number(current.quantity || 0) === Number(next.quantity || 0) &&
          Number(current.totalCost || 0) === Number(next.totalCost || 0)
        );
      });

    if (isSame) return;

    setCarryoverStore((prev) => ({ ...prev, [monthKey]: normalized }));

    const sync = async () => {
      const competencia = monthKeyToCompetencia(monthKey);
      const rows = Object.entries(normalized).map(([key, value]) => {
        const [product, store] = key.split('__');
        return {
          competencia,
          product,
          store,
          quantity: Number(value.quantity || 0),
          total_cost: Number(value.totalCost || 0),
        };
      });

      const { error: deleteError } = await supabase
        .from('custos_clinicas_carryover')
        .delete()
        .eq('competencia', competencia);

      if (deleteError) {
        console.error('Erro ao limpar estoque acumulado:', deleteError);
        return;
      }

      if (rows.length === 0) return;

      const { error: insertError } = await supabase
        .from('custos_clinicas_carryover')
        .insert(rows);

      if (insertError) {
        console.error('Erro ao salvar estoque acumulado:', insertError);
      }
    };

    sync();
  }, [inventoryMap, monthKey, carryoverStore, loading]);

  const sourceNames = useMemo(() => {
    const set = new Set<string>();
    purchaseSources.forEach((item) => set.add(item.sourceName));
    prevPurchaseSources.forEach((item) => set.add(item.sourceName));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [purchaseSources, prevPurchaseSources]);

  const productOptions = useMemo(
    () => Object.keys(inventoryByProduct).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [inventoryByProduct]
  );

  const filteredProductOptions = useMemo(() => {
    const term = normalizeSearch(productSearch);
    if (!term) return productOptions;
    return productOptions.filter((product) => product.includes(term));
  }, [productOptions, productSearch]);

  const showSuggestions = showProductSuggestions && productSearch.trim().length > 0 && filteredProductOptions.length > 0;

  const storeOptions = useMemo(() => {
    if (!movementDraft.product) return [];
    return inventoryByProduct[movementDraft.product] || [];
  }, [inventoryByProduct, movementDraft.product]);

  const isSelectedUnified = useMemo(
    () => Boolean(movementDraft.product && unifiedProducts.has(movementDraft.product)),
    [movementDraft.product, unifiedProducts]
  );

  useEffect(() => {
    if (!movementDraft.product) return;
    if (isSelectedUnified) return;
    const defaultStore = storeOptions[0];
    if (!defaultStore) return;
    if (movementDraft.store === defaultStore.store) return;
    setMovementDraft((prev) => ({
      ...prev,
      store: defaultStore.store,
      quantity:
        prev.quantity === ''
          ? ''
          : Math.min(Number(prev.quantity), defaultStore.quantity),
    }));
  }, [movementDraft.product, isSelectedUnified, storeOptions, movementDraft.store]);

  const selectedStoreInfo = useMemo(() => {
    if (!movementDraft.store) return null;
    return storeOptions.find((option) => option.store === movementDraft.store) || null;
  }, [movementDraft.store, storeOptions]);

  const availableQuantity = selectedStoreInfo?.quantity || 0;
  const movementUnitCost = selectedStoreInfo?.unitCost || 0;
  const movementTotalCost = movementUnitCost * Number(movementDraft.quantity || 0);
  const isMovementValid =
    !movementSaving &&
    movementDraft.product &&
    movementDraft.store &&
    movementDraft.clinic &&
    Number.isFinite(Number(movementDraft.quantity)) &&
    Number(movementDraft.quantity) > 0 &&
    Number(movementDraft.quantity) <= availableQuantity;

  useEffect(() => {
    if (!showUnifyModal) return;
    setUnifyError('');
    setUnifyStep('select');
    setUnifySelected([]);
    setUnifyName('');
    setUnifySearch('');
  }, [showUnifyModal, sourceNames, unifyStore]);

  useEffect(() => {
    if (!showMovementModal) return;
    setMovementError('');
    setExpandedMovementClinics({
      MATRIZ: false,
      AGUANAMBI: false,
      BEZERRA: false,
      PARANGABA: false,
      SOBRAL: false,
    });
  }, [showMovementModal]);

  const handleAddMovement = async () => {
    setMovementError('');
    if (movementSaving) return;
    if (!movementDraft.product) {
      setMovementError('Selecione um produto.');
      return;
    }
    if (!movementDraft.store) {
      setMovementError('Selecione a loja.');
      return;
    }
    if (!movementDraft.clinic) {
      setMovementError('Selecione a clinica.');
      return;
    }
    const qty = Number(movementDraft.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMovementError('Informe uma quantidade valida.');
      return;
    }
    if (qty > availableQuantity) {
      setMovementError('Quantidade maior que o estoque disponivel.');
      return;
    }
    if (!selectedStoreInfo) {
      setMovementError('Loja invalida para o produto.');
      return;
    }

    setMovementSaving(true);
    try {
      const competencia = monthKeyToCompetencia(monthKey);
      const payload = {
        competencia,
        clinic: movementDraft.clinic,
        product: movementDraft.product,
        store: movementDraft.store,
        quantity: qty,
        unit_cost: movementUnitCost,
        total_cost: movementUnitCost * qty,
      };

      const { data, error } = await supabase
        .from('custos_clinicas_movements')
        .insert(payload)
        .select('id, clinic, product, store, quantity, unit_cost, total_cost, created_at')
        .single();

      if (error) {
        setMovementError('Erro ao salvar movimentacao.');
        console.error('Erro ao salvar movimentacao:', error);
        return;
      }

      addMovementLocal({
        id: data.id,
        monthKey,
        clinic: data.clinic as ClinicKey,
        product: normalizeKey(data.product),
        store: normalizeStore(data.store),
        quantity: Number(data.quantity || 0),
        unitCost: Number(data.unit_cost || 0),
        totalCost: Number(data.total_cost || 0),
        createdAt: data.created_at,
      });

      setMovementDraft({
        product: movementDraft.product,
        store: '',
        clinic: '' as ClinicKey | '',
        quantity: '',
      });
    } finally {
      setMovementSaving(false);
    }
  };

  const handleRemoveMovement = async (id: string) => {
    setMovementError('');
    const { error } = await supabase
      .from('custos_clinicas_movements')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover movimentacao:', error);
      setMovementError('Erro ao remover movimentacao.');
      return;
    }

    removeMovementLocal(id);
  };

  const handleOpenHistoryModal = async (product: string) => {
    const normalizedProduct = normalizeKey(product);
    setHistoryProduct(normalizedProduct);
    setHistoryRows([]);
    setHistoryError('');
    setShowHistoryModal(true);
    setHistoryLoading(true);

    const targetProduct = resolveUnifiedTarget(normalizedProduct, unifyStore);
    const aliases = new Set<string>([normalizedProduct, targetProduct]);
    Object.entries(unifyStore).forEach(([source, unified]) => {
      const normalizedSource = normalizeKey(source);
      const normalizedUnified = normalizeKey(unified || source);
      const resolved = resolveUnifiedTarget(normalizedSource, unifyStore);
      if (
        normalizedSource === normalizedProduct ||
        normalizedUnified === normalizedProduct ||
        resolved === targetProduct
      ) {
        aliases.add(normalizedSource);
        aliases.add(normalizedUnified);
      }
    });

    const { data, error } = await supabase
      .from('custos_clinicas_movements')
      .select('id, competencia, clinic, product, store, quantity, unit_cost, total_cost, created_at')
      .in('product', Array.from(aliases))
      .order('competencia', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar historico do item:', error);
      setHistoryError('Erro ao carregar historico do item.');
      setHistoryLoading(false);
      return;
    }

    const rows: InventoryHistoryMovement[] = (data || []).map((row: any) => ({
      id: row.id,
      competencia: String(row.competencia || ''),
      clinic: normalizeKey(row.clinic),
      product: normalizeKey(row.product),
      store: normalizeStore(row.store),
      quantity: Number(row.quantity || 0),
      unitCost: Number(row.unit_cost || 0),
      totalCost: Number(row.total_cost || 0),
      createdAt: String(row.created_at || ''),
    }));

    setHistoryRows(rows);
    setHistoryLoading(false);
  };

  const handleUnifyToggle = (name: string) => {
    setUnifyError('');
    setUnifySelected((prev) => {
      if (prev.includes(name)) {
        return prev.filter((item) => item !== name);
      }
      return [...prev, name];
    });
  };

  const handleUnifySelectAll = () => {
    setUnifyError('');
    if (unifySelected.length === sourceNames.length) {
      setUnifySelected([]);
      return;
    }
    setUnifySelected([...sourceNames]);
  };

  const handleUnifyNext = () => {
    setUnifyError('');
    if (unifySelected.length === 0) {
      setUnifyError('Selecione ao menos um produto.');
      return;
    }
    const unifiedSet = new Set(
      unifySelected.map((name) => resolveUnifiedTarget(name, unifyStore))
    );
    if (unifiedSet.size === 1) {
      setUnifyName(Array.from(unifiedSet)[0]);
    } else {
      setUnifyName('');
    }
    setUnifyStep('name');
  };

  const filteredUnifyNames = useMemo(() => {
    const term = normalizeSearch(unifySearch);
    if (!term) return sourceNames;
    return sourceNames.filter((name) => name.includes(term));
  }, [sourceNames, unifySearch]);

  const unifyStoresByName = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    purchaseSources.forEach((item) => {
      if (!item.sourceName) return;
      if (!map[item.sourceName]) map[item.sourceName] = new Set();
      map[item.sourceName].add(item.storeName);
    });
    prevPurchaseSources.forEach((item) => {
      if (!item.sourceName) return;
      if (!map[item.sourceName]) map[item.sourceName] = new Set();
      map[item.sourceName].add(item.storeName);
    });
    return map;
  }, [purchaseSources, prevPurchaseSources]);

  const handleSaveUnify = async () => {
    if (unifySaving) return;
    setUnifySaving(true);
    setUnifyError('');
    if (unifySelected.length === 0) {
      setUnifyError('Selecione ao menos um produto.');
      setUnifySaving(false);
      return;
    }
    if (!unifyName.trim()) {
      setUnifyError('Informe o nome unificado.');
      setUnifySaving(false);
      return;
    }

    const normalizedUnified = normalizeKey(unifyName);
    const next: UnifyStore = { ...unifyStore };
    const selectedTargets = new Set<string>(
      unifySelected.map((source) => resolveUnifiedTarget(source, unifyStore))
    );

    Object.keys(next).forEach((source) => {
      if (selectedTargets.has(resolveUnifiedTarget(source, unifyStore))) {
        if (source === normalizedUnified) {
          delete next[source];
        } else {
          next[source] = normalizedUnified;
        }
      }
    });

    unifySelected.forEach((source) => {
      const normalizedSource = normalizeKey(source);
      if (normalizedSource === normalizedUnified) {
        delete next[normalizedSource];
        return;
      }
      next[normalizedSource] = normalizedUnified;
    });

    const rows: { source_name: string; unified_name: string }[] = Object.entries(next).map(
      ([source_name, unified_name]) => ({ source_name, unified_name })
    );

    const removedSources = Object.keys(unifyStore).filter((source) => !next[source]);
    if (removedSources.length > 0) {
      const { error: deleteError } = await supabase
        .from('custos_clinicas_unify')
        .delete()
        .in('source_name', removedSources);
      if (deleteError) {
        console.error('Erro ao remover unificacao antiga:', deleteError);
        setUnifyError('Erro ao salvar unificacao.');
        setUnifySaving(false);
        return;
      }
    }

    let error: any = null;
    if (rows.length > 0) {
      const result = await supabase
        .from('custos_clinicas_unify')
        .upsert(rows, { onConflict: 'source_name' });
      error = result.error;
    }

    if (error) {
      console.error('Erro ao salvar unificacao:', error);
      setUnifyError('Erro ao salvar unificacao.');
      setUnifySaving(false);
      return;
    }

    updateUnifyStore(next);
    setUnifySaving(false);
    setShowUnifyModal(false);
  };

  const resolveClinicName = (clinicValue: string) => {
    const clinic = CLINICAS.find((item) => item.key === clinicValue);
    return clinic?.label || clinicValue;
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <ModuleHeader
        sectionLabel="Financeiro"
        title="Custos das Clinicas"
        subtitle="Transporte, insumos e comparativos mensais"
        actions={(
          <>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
              <input
                type="month"
                value={monthKey}
                onChange={(event) => setMonthKey(event.target.value)}
                className="w-full sm:w-44 pl-9 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              />
            </div>
            <button
              type="button"
              onClick={() => setMonthKey(toMonthKey(new Date()))}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-button bg-neutral-200 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-button transition-colors hover:bg-button-50 sm:w-auto"
              aria-label="Voltar para o mes atual"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Mes atual
            </button>
          </>
        )}
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-200 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Transporte (Uber)</p>
              <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(totalUber)}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Total do mes</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-200 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Insumos</p>
              <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(totalCompras)}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {movementCount > 0 ? `${movementCount} movimentacoes` : 'Sem movimentacoes'}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-200 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Total geral</p>
              <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(totalGeral)}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Uber + Insumos</p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-200 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide dark:text-neutral-100">
                Comparativo por clinica
              </h2>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Mes atual vs anterior
              </span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)] gap-4">
              <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                <div className="flex flex-col items-center justify-center">
                  <div className="relative h-56 w-56 sm:h-60 sm:w-60">
                    <div
                      className="h-full w-full rounded-full"
                      style={{ background: comparisonDonutGradient }}
                    />
                    <div className="absolute inset-[24%] rounded-full border border-neutral-200 bg-neutral-200 flex flex-col items-center justify-center dark:border-neutral-700 dark:bg-neutral-900">
                      <span className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Total gasto
                      </span>
                      <span className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {formatCurrency(comparisonTotalCurrent)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {comparisonRows.map((row) => {
                    const pctLabel =
                      row.pct === null ? 'Sem base' : `${row.pct >= 0 ? '+' : ''}${row.pct.toFixed(1)}%`;
                    const isActive = selectedItemsClinic === row.key;
                    const share = comparisonTotalCurrent > 0 ? (row.current / comparisonTotalCurrent) * 100 : 0;
                    return (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() =>
                          setSelectedItemsClinic((prev) => (prev === row.key ? null : row.key))
                        }
                        aria-pressed={isActive}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                          isActive
                            ? 'border-primary-500 bg-primary-50/40 dark:border-primary-400 dark:bg-primary-950/40'
                            : 'border-neutral-200 hover:bg-neutral-200/80 dark:border-neutral-700 dark:hover:bg-neutral-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-2 text-neutral-700 uppercase dark:text-neutral-200">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: CLINIC_COMPARISON_COLORS[row.key] }}
                            />
                            {row.label}
                          </span>
                          <span className="text-neutral-500 dark:text-neutral-400">{share.toFixed(1)}%</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(row.current)}
                          </span>
                          <span className="text-neutral-500 dark:text-neutral-400">{pctLabel}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-200/70 p-3 text-[10px] uppercase text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-200">
                {!selectedComparisonRow ? (
                  <div className="flex h-full min-h-40 items-center justify-center text-center text-neutral-500 dark:text-neutral-400">
                    Clique em uma clinica no grafico para ver os detalhes.
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-200 px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: CLINIC_COMPARISON_COLORS[selectedComparisonRow.key] }}
                          />
                          <span>{selectedComparisonRow.label}</span>
                        </div>
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {comparisonTotalCurrent > 0
                            ? `${((selectedComparisonRow.current / comparisonTotalCurrent) * 100).toFixed(1)}% do total`
                            : '0,0% do total'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <p className="text-neutral-500 dark:text-neutral-400">Mes atual</p>
                          <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(selectedComparisonRow.current)}
                          </p>
                        </div>
                        <div>
                          <p className="text-neutral-500 dark:text-neutral-400">Mes anterior</p>
                          <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(selectedComparisonRow.previous)}
                          </p>
                        </div>
                        <div>
                          <p className="text-neutral-500 dark:text-neutral-400">Variacao</p>
                          <p
                            className={`font-semibold ${
                              selectedComparisonRow.diff > 0
                                ? 'text-red-600 dark:text-red-300'
                                : selectedComparisonRow.diff < 0
                                  ? 'text-emerald-600 dark:text-emerald-300'
                                  : 'text-neutral-700 dark:text-neutral-200'
                            }`}
                          >
                            {selectedComparisonRow.diff > 0 ? '+' : selectedComparisonRow.diff < 0 ? '-' : ''}
                            {formatCurrency(Math.abs(selectedComparisonRow.diff))}
                            {selectedComparisonRow.pct !== null
                              ? ` (${selectedComparisonRow.pct >= 0 ? '+' : ''}${selectedComparisonRow.pct.toFixed(1)}%)`
                              : ' (Sem base)'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-200/70 px-2 py-2 dark:border-neutral-700 dark:bg-neutral-900/70">
                      {(clinicItemsMap[selectedComparisonRow.key] || []).length === 0 ? (
                        <div className="text-center text-neutral-500 dark:text-neutral-400">
                          Nenhum item designado.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="text-neutral-500 border-b border-neutral-200 dark:text-neutral-400 dark:border-neutral-800">
                              <tr>
                                <th className="py-2 px-2 text-left">Produto</th>
                                <th className="py-2 px-2 text-left">Loja</th>
                                <th className="py-2 px-2 text-center">Qtd</th>
                                <th className="py-2 px-2 text-right">Custo total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(clinicItemsMap[selectedComparisonRow.key] || []).map((item) => (
                                <tr
                                  key={`${selectedComparisonRow.key}-${item.product}-${item.store}`}
                                  className="border-b border-neutral-100 dark:border-neutral-800"
                                >
                                  <td className="py-2 px-2 text-neutral-800 dark:text-neutral-100">{item.product}</td>
                                  <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">{item.store}</td>
                                  <td className="py-2 px-2 text-center">{item.quantity}</td>
                                  <td className="py-2 px-2 text-right">{formatCurrency(item.totalCost)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-200 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide dark:text-neutral-100">
                  Inventario Parque Tecnologico
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Somente leitura. Estoque disponivel, custo unitario e total por item. Clique no produto para expandir as lojas.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowUnifyModal(true)}
                  className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-neutral-200 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-700 transition-colors hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  Unificar Produtos
                </button>
                <button
                  onClick={() => setShowMovementModal(true)}
                  className="inline-flex items-center justify-center rounded-full border border-transparent bg-button px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-button-hover"
                >
                  Gerar movimentacao
                </button>
              </div>
            </div>

            {inventoryRows.length === 0 ? (
              <div className="text-sm text-neutral-500 text-center py-8 dark:text-neutral-400">
                Nenhum item em estoque para o mes selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-[10px] sm:text-[11px] uppercase text-neutral-700 dark:text-neutral-200">
                  <thead className="text-neutral-500 border-b border-neutral-200 dark:text-neutral-400 dark:border-neutral-800">
                    <tr>
                      <th className="py-2 px-2 text-left">Produto</th>
                      <th className="py-2 px-2 text-left">Loja</th>
                      <th className="py-2 px-2 text-center">Qtd disponivel</th>
                      <th className="py-2 px-2 text-right">Custo unit</th>
                      <th className="py-2 px-2 text-right">Custo total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryProducts.map((product) => {
                      const stores = inventoryByProduct[product] || [];
                      if (stores.length === 0) return null;
                      const totalQuantity = stores.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
                      const totalCost = stores.reduce((acc, item) => acc + Number(item.totalCost || 0), 0);
                      const unitCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
                      const audit = inventoryAuditByProduct[product] || {
                        purchasedQty: 0,
                        directedQty: 0,
                        purchasedCost: 0,
                        directedCost: 0,
                      };
                      const auditBalanceQty = audit.purchasedQty - audit.directedQty;
                      if (auditBalanceQty <= 0) return null;
                      const isUnified = unifiedProducts.has(product);
                      const expanded = Boolean(expandedProducts[product]);

                      if (!isUnified) {
                        if (stores.length === 1) {
                          const storeRow = stores[0];
                          return (
                            <tr key={product} className="border-b border-neutral-100 dark:border-neutral-800">
                              <td className="py-2 px-2 text-neutral-800 dark:text-neutral-100">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenHistoryModal(product)}
                                    aria-label={`Ver historico de ${product}`}
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-300 text-[10px] font-bold text-neutral-600 dark:border-neutral-600 dark:text-neutral-300"
                                  >
                                    ?
                                  </button>
                                  <span>{product}</span>
                                </div>
                                <div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                                  Comprado: {formatQuantity(audit.purchasedQty)} | Direcionado: {formatQuantity(audit.directedQty)} | Saldo: {formatQuantity(auditBalanceQty)}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">{storeRow.store}</td>
                              <td className="py-2 px-2 text-center font-semibold text-neutral-800 dark:text-neutral-100">
                                {storeRow.quantity}
                              </td>
                              <td className="py-2 px-2 text-right text-neutral-700 dark:text-neutral-200">
                                {formatCurrency(storeRow.unitCost)}
                              </td>
                              <td className="py-2 px-2 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                                {formatCurrency(storeRow.totalCost)}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <React.Fragment key={product}>
                            {stores.map((storeRow, idx) => (
                              <tr
                                key={`${product}-${storeRow.store}`}
                                className="border-b border-neutral-100 dark:border-neutral-800"
                              >
                                <td className="py-2 px-2 text-neutral-800 dark:text-neutral-100">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenHistoryModal(product)}
                                      aria-label={`Ver historico de ${product}`}
                                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-300 text-[10px] font-bold text-neutral-600 dark:border-neutral-600 dark:text-neutral-300"
                                    >
                                      ?
                                    </button>
                                    <span>{product}</span>
                                  </div>
                                  {idx === 0 && (
                                    <div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                                      Comprado: {formatQuantity(audit.purchasedQty)} | Direcionado: {formatQuantity(audit.directedQty)} | Saldo: {formatQuantity(auditBalanceQty)}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">{storeRow.store}</td>
                                <td className="py-2 px-2 text-center font-semibold text-neutral-800 dark:text-neutral-100">
                                  {storeRow.quantity}
                                </td>
                                <td className="py-2 px-2 text-right text-neutral-700 dark:text-neutral-200">
                                  {formatCurrency(storeRow.unitCost)}
                                </td>
                                <td className="py-2 px-2 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                                  {formatCurrency(storeRow.totalCost)}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      }

                      return (
                        <React.Fragment key={product}>
                          <tr className="border-b border-neutral-100 dark:border-neutral-800">
                            <td className="py-2 px-2 text-neutral-800 dark:text-neutral-100">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedProducts((prev) => ({
                                    ...prev,
                                    [product]: !expanded,
                                  }))
                                }
                                className="flex items-center gap-2 text-left font-semibold text-neutral-900 hover:text-primary-600 dark:text-neutral-100"
                              >
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenHistoryModal(product);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleOpenHistoryModal(product);
                                    }
                                  }}
                                  aria-label={`Ver historico de ${product}`}
                                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-300 text-[10px] font-bold text-neutral-600 dark:border-neutral-600 dark:text-neutral-300"
                                >
                                  ?
                                </span>
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 text-[10px] dark:border-neutral-700">
                                  {expanded ? '-' : '+'}
                                </span>
                                {product}
                              </button>
                              <div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                                {stores.length} loja(s)
                              </div>
                              <div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                                Comprado: {formatQuantity(audit.purchasedQty)} | Direcionado: {formatQuantity(audit.directedQty)} | Saldo: {formatQuantity(auditBalanceQty)}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">UNIFICADO</td>
                            <td className="py-2 px-2 text-center font-semibold text-neutral-800 dark:text-neutral-100">
                              {totalQuantity}
                            </td>
                            <td className="py-2 px-2 text-right text-neutral-700 dark:text-neutral-200">
                              {formatCurrency(unitCost)}
                            </td>
                            <td className="py-2 px-2 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                              {formatCurrency(totalCost)}
                            </td>
                          </tr>
                          {expanded &&
                            stores.map((storeRow) => (
                              <tr
                                key={`${product}-${storeRow.store}`}
                                className="border-b border-neutral-100 bg-neutral-200/60 dark:border-neutral-800 dark:bg-neutral-900/60"
                              >
                                <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">
                                  <span className="ml-6">{product}</span>
                                </td>
                                <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">{storeRow.store}</td>
                                <td className="py-2 px-2 text-center text-neutral-700 dark:text-neutral-200">
                                  {storeRow.quantity}
                                </td>
                                <td className="py-2 px-2 text-right text-neutral-700 dark:text-neutral-200">
                                  {formatCurrency(storeRow.unitCost)}
                                </td>
                                <td className="py-2 px-2 text-right text-neutral-700 dark:text-neutral-200">
                                  {formatCurrency(storeRow.totalCost)}
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-200 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide dark:text-neutral-100">
                  Transporte (Uber)
                </h2>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-300">
                  Legenda: Administracao -&gt; Clinica = clinica | Clinica -&gt; Administracao = clinica | Clinica -&gt; Clinica = destino
                </p>
              </div>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Total por clinica
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {CLINICAS.filter((clinic) => clinic.key !== 'MATRIZ').map((clinic) => (
                <div
                  key={clinic.key}
                  className={`min-w-[160px] rounded-xl border px-3 py-3 text-left transition-colors ${
                    selectedUberClinic === clinic.key
                      ? 'border-primary-500 bg-primary-50/40 dark:border-primary-400 dark:bg-primary-950/40'
                      : 'border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedUberClinic((prev) => (prev === clinic.key ? null : clinic.key))
                    }
                    aria-pressed={selectedUberClinic === clinic.key}
                    className="w-full text-left"
                  >
                    <div className="text-xs text-neutral-500 uppercase dark:text-neutral-400">{clinic.label}</div>
                    <div className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(uberTotals[clinic.key])}
                    </div>
                  </button>
                  {selectedUberClinic === clinic.key && (
                    <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-200/70 px-2 py-2 text-[10px] uppercase text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-200">
                      {uberRowsByClinic[clinic.key]?.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="text-neutral-500 border-b border-neutral-200 dark:text-neutral-400 dark:border-neutral-800">
                              <tr>
                                <th className="py-2 px-2 text-left">Data</th>
                                <th className="py-2 px-2 text-left">Saida</th>
                                <th className="py-2 px-2 text-left">Destino</th>
                                <th className="py-2 px-2 text-right">Custo total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {uberRowsByClinic[clinic.key].map((row) => {
                                const totalCost =
                                  parseNumberValue(row.valor_saida) +
                                  parseNumberValue(row.valor_retorno);
                                return (
                                <tr
                                  key={row.id}
                                  className="border-b border-neutral-100 dark:border-neutral-800"
                                >
                                  <td className="py-2 px-2 text-neutral-800 dark:text-neutral-100">{row.data || '-'}</td>
                                  <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">{row.saida_local || '-'}</td>
                                  <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">{row.destino || '-'}</td>
                                  <td className="py-2 px-2 text-right">{formatCurrency(totalCost)}</td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center text-neutral-500 dark:text-neutral-400">
                          Nenhum custo registrado.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4">
          <div className="bg-neutral-200 rounded-2xl border border-neutral-200 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col dark:bg-neutral-900/95 dark:border-neutral-800">
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-800 dark:text-neutral-100">
                Gerar movimentacao
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Escolha o produto, loja e quantidade para calcular o custo por clinica.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Pesquisar produto
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(event) => {
                        setProductSearch(event.target.value.toUpperCase());
                        setShowProductSuggestions(true);
                      }}
                      onFocus={() => setShowProductSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowProductSuggestions(false), 150)}
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-neutral-200 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                      placeholder="Digite para filtrar"
                    />
                    {showSuggestions && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-200 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                        {filteredProductOptions.map((product) => (
                          <button
                            key={product}
                            type="button"
                            onClick={() => {
                              setMovementDraft((prev) => ({
                                ...prev,
                                product,
                                store: '',
                                quantity: '',
                              }));
                              setProductSearch(product);
                              setShowProductSuggestions(false);
                            }}
                            className="w-full px-3 py-2 text-left text-[11px] uppercase text-neutral-700 hover:bg-neutral-200 dark:text-neutral-100 dark:hover:bg-neutral-800"
                          >
                            {product}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Produto
                  </label>
                  <select
                    value={movementDraft.product}
                    onChange={(event) =>
                      setMovementDraft((prev) => ({
                        ...prev,
                        product: event.target.value,
                        store: '',
                        quantity: '',
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-neutral-200 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                  >
                    <option value="">Selecione</option>
                    {filteredProductOptions.map((product) => (
                      <option key={product} value={product}>
                        {product}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Loja
                  </label>
                  {isSelectedUnified ? (
                    <select
                      value={movementDraft.store}
                      onChange={(event) => {
                        const nextStore = event.target.value;
                        const nextInfo = storeOptions.find((option) => option.store === nextStore);
                        setMovementDraft((prev) => ({
                          ...prev,
                          store: nextStore,
                          quantity:
                            nextInfo && prev.quantity !== ''
                              ? Math.min(Number(prev.quantity), nextInfo.quantity)
                              : prev.quantity,
                        }));
                      }}
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-neutral-200 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                    >
                      <option value="">Selecione</option>
                      {storeOptions.map((option) => (
                        <option key={option.store} value={option.store}>
                          {option.store} ({option.quantity}) - {formatCurrency(option.unitCost)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-neutral-200 text-neutral-600 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200">
                      {selectedStoreInfo?.store || storeOptions[0]?.store || 'SEM LOJA'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={availableQuantity}
                    value={movementDraft.quantity}
                    onChange={(event) =>
                      setMovementDraft((prev) => {
                        const rawValue = event.target.value;
                        if (rawValue === '') {
                          return { ...prev, quantity: '' };
                        }
                        const parsed = Number(rawValue);
                        if (!Number.isFinite(parsed)) return prev;
                        const safeMax = availableQuantity > 0 ? availableQuantity : parsed;
                        return {
                          ...prev,
                          quantity: Math.min(parsed, safeMax),
                        };
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-neutral-200 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                  />
                  <p className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                    Disponivel: {availableQuantity}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Clinica
                  </label>
                  <select
                    value={movementDraft.clinic}
                    onChange={(event) =>
                      setMovementDraft((prev) => ({
                        ...prev,
                        clinic: event.target.value as ClinicKey | '',
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-neutral-200 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                  >
                    <option value="">Selecione</option>
                    {CLINICAS.map((clinic) => (
                      <option key={clinic.key} value={clinic.key}>
                        {clinic.label.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-200 px-4 py-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                <div className="flex items-center justify-between">
                  <span>Custo unitario</span>
                  <span className="font-semibold">{formatCurrency(movementUnitCost)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span>Custo total</span>
                  <span className="font-semibold">{formatCurrency(movementTotalCost)}</span>
                </div>
              </div>

              {movementError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
                  {movementError}
                </div>
              )}

              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Movimentacoes do mes
                </h4>
                {movements.length === 0 ? (
                  <div className="text-[11px] text-neutral-500 mt-2 dark:text-neutral-400">
                    Nenhuma movimentacao registrada.
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {movementClinics.map((clinic) => {
                      const rows = movementByClinic[clinic.key];
                      const expanded = expandedMovementClinics[clinic.key];
                      const clinicTotal = rows.reduce((acc, row) => acc + Number(row.totalCost || 0), 0);
                      return (
                        <div
                          key={clinic.key}
                          className="rounded-lg border border-neutral-200 bg-neutral-200/70 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/70"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedMovementClinics((prev) => ({
                                ...prev,
                                [clinic.key]: !prev[clinic.key],
                              }))
                            }
                            className="flex w-full items-center justify-between text-left"
                          >
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                                {clinic.label}
                              </div>
                              <div className="text-[11px] text-neutral-600 dark:text-neutral-300">
                                {rows.length} movimentacoes
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Total</div>
                              <div className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-100">
                                {formatCurrency(clinicTotal)}
                              </div>
                            </div>
                          </button>
                          {expanded && (
                            <div className="mt-2 overflow-x-auto">
                              <table className="min-w-full text-[10px] uppercase text-neutral-700 dark:text-neutral-200">
                                <thead className="text-neutral-500 border-b border-neutral-200 dark:text-neutral-400 dark:border-neutral-800">
                                  <tr>
                                    <th className="py-2 px-2 text-left">Produto</th>
                                    <th className="py-2 px-2 text-left">Loja</th>
                                    <th className="py-2 px-2 text-center">Qtd</th>
                                    <th className="py-2 px-2 text-right">Total</th>
                                    <th className="py-2 px-2 text-right">Acoes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((movement) => (
                                    <tr key={movement.id} className="border-b border-neutral-100 dark:border-neutral-800">
                                      <td className="py-2 px-2 text-neutral-800 dark:text-neutral-100">{movement.product}</td>
                                      <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">{movement.store}</td>
                                      <td className="py-2 px-2 text-center">{movement.quantity}</td>
                                      <td className="py-2 px-2 text-right">{formatCurrency(movement.totalCost)}</td>
                                      <td className="py-2 px-2 text-right">
                                        <button
                                          onClick={() => handleRemoveMovement(movement.id)}
                                          className="text-[10px] font-semibold text-red-600 hover:text-red-700"
                                        >
                                          Remover
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-200/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  setShowMovementModal(false);
                  setMovementError('');
                }}
                className="rounded-full border border-neutral-300 bg-neutral-200 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                Fechar
              </button>
              <button
                onClick={handleAddMovement}
                disabled={!isMovementValid}
                className={`rounded-full border border-transparent px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide shadow-sm transition-colors ${
                  isMovementValid
                    ? 'bg-button text-white hover:bg-button-hover'
                    : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                }`}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4">
          <div className="bg-neutral-200 rounded-2xl border border-neutral-200 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col dark:bg-neutral-900/95 dark:border-neutral-800">
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-800 dark:text-neutral-100">
                Historico do item
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {historyProduct || '-'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {historyLoading ? (
                <div className="text-sm text-neutral-500 dark:text-neutral-400">Carregando historico...</div>
              ) : historyError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
                  {historyError}
                </div>
              ) : historyRows.length === 0 ? (
                <div className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum direcionamento encontrado.</div>
              ) : (
                <>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-200 px-4 py-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                    <div className="flex items-center justify-between">
                      <span>Total direcionado</span>
                      <span className="font-semibold">{historyTotalQuantity}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {CLINICAS.map((clinic) => {
                        const qty = Number(historyByClinic[clinic.key] || 0);
                        if (qty <= 0) return null;
                        return (
                          <div key={clinic.key} className="flex items-center justify-between">
                            <span>{clinic.label}</span>
                            <span className="font-semibold">{qty}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-[10px] uppercase text-neutral-700 dark:text-neutral-200">
                      <thead className="text-neutral-500 border-b border-neutral-200 dark:text-neutral-400 dark:border-neutral-800">
                        <tr>
                          <th className="py-2 px-2 text-left">Competencia</th>
                          <th className="py-2 px-2 text-left">Clinica</th>
                          <th className="py-2 px-2 text-left">Loja</th>
                          <th className="py-2 px-2 text-center">Qtd</th>
                          <th className="py-2 px-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRows.map((row) => (
                          <tr key={row.id} className="border-b border-neutral-100 dark:border-neutral-800">
                            <td className="py-2 px-2">{row.competencia ? String(row.competencia).slice(0, 7) : '-'}</td>
                            <td className="py-2 px-2">{resolveClinicName(row.clinic)}</td>
                            <td className="py-2 px-2">{row.store}</td>
                            <td className="py-2 px-2 text-center">{row.quantity}</td>
                            <td className="py-2 px-2 text-right">{formatCurrency(row.totalCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-200/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="rounded-full border border-neutral-300 bg-neutral-200 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showUnifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4">
          <div className="bg-neutral-200 rounded-2xl border border-neutral-200 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col dark:bg-neutral-900/95 dark:border-neutral-800">
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-800 dark:text-neutral-100">
                Unificar produtos
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Defina o nome unificado para itens iguais comprados em lojas diferentes.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {sourceNames.length === 0 ? (
                <div className="text-sm text-neutral-500 text-center py-6 dark:text-neutral-400">
                  Nenhum item encontrado para unificar.
                </div>
              ) : unifyStep === 'select' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span>{unifySelected.length} selecionados</span>
                    <button
                      onClick={handleUnifySelectAll}
                      className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      {unifySelected.length === sourceNames.length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Buscar produto
                    </label>
                    <input
                      type="text"
                      value={unifySearch}
                      onChange={(event) => setUnifySearch(event.target.value.toUpperCase())}
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-neutral-200 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                      placeholder="Digite para filtrar"
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-[10px] uppercase text-neutral-700 dark:text-neutral-200">
                      <thead className="text-neutral-500 border-b border-neutral-200 dark:text-neutral-400 dark:border-neutral-800">
                        <tr>
                          <th className="py-2 px-2 text-left">Selecionar</th>
                          <th className="py-2 px-2 text-left">Produto</th>
                          <th className="py-2 px-2 text-left">Loja</th>
                          <th className="py-2 px-2 text-left">Unificado atual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUnifyNames.map((name) => {
                          const unified = resolveUnifiedTarget(name, unifyStore);
                          const checked = unifySelected.includes(name);
                          const stores = Array.from(unifyStoresByName[name] || []).sort((a, b) =>
                            a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
                          );
                          const storesLabel = stores.length > 0 ? stores.join(', ') : 'SEM LOJA';
                          return (
                            <tr key={name} className="border-b border-neutral-100 dark:border-neutral-800">
                              <td className="py-2 px-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleUnifyToggle(name)}
                                  className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                                />
                              </td>
                              <td className="py-2 px-2 text-neutral-800 dark:text-neutral-100">{name}</td>
                              <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">{storesLabel}</td>
                              <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">{unified}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Nome unificado
                    </label>
                    <input
                      type="text"
                      value={unifyName}
                      onChange={(event) => setUnifyName(event.target.value.toUpperCase())}
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-neutral-200 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                      placeholder="Ex.: COOLER"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Itens selecionados
                    </p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-neutral-700 dark:text-neutral-200">
                      {unifySelected.map((name) => (
                        <div key={name} className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700">
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {unifyError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
                  {unifyError}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-200/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  if (unifyStep === 'name') {
                    setUnifyStep('select');
                    return;
                  }
                  setShowUnifyModal(false);
                }}
                className="rounded-full border border-neutral-300 bg-neutral-200 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {unifyStep === 'name' ? 'Voltar' : 'Cancelar'}
              </button>
              {unifyStep === 'select' ? (
                <button
                  onClick={handleUnifyNext}
                  className="rounded-full border border-transparent bg-button px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-button-hover"
                >
                  Seguinte
                </button>
              ) : (
                <button
                  onClick={handleSaveUnify}
                  disabled={unifySaving}
                  className={`rounded-full border border-transparent px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide shadow-sm transition-colors ${
                    unifySaving
                      ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                      : 'bg-button text-white hover:bg-button-hover'
                  }`}
                >
                  Salvar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const fetchPurchasesUpToMonth = async (monthKey: string): Promise<PurchaseHistoryData> => {
  const { year, month } = monthKeyToRange(monthKey);
  const { data, error } = await supabase
    .from('pc_mensal_itens')
    .select('id, ano, mes, item, quantidade, valor_unit, valor_total_frete, protocolo_item_id')
    .eq('status', 'ENTREGUE')
    .order('ano', { ascending: true })
    .order('mes', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao carregar historico de compras:', error);
    return { compras: [], protocoloMap: {} };
  }

  const comprasData = ((data || []) as MensalItem[]).filter((item) => {
    const itemYear = Number(item.ano || 0);
    const itemMonth = Number(item.mes || 0);
    if (!Number.isFinite(itemYear) || !Number.isFinite(itemMonth)) return false;
    return itemYear < year || (itemYear === year && itemMonth <= month);
  });

  const protocoloIds = Array.from(
    new Set(
      comprasData
        .map((item) => item.protocolo_item_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let protocoloMap: Record<string, ProtocoloItemLite> = {};
  if (protocoloIds.length > 0) {
    const { data: protocoloData, error: protocoloError } = await supabase
      .from('pc_protocolo_itens')
      .select('id, loja, produto')
      .in('id', protocoloIds);

    if (protocoloError) {
      console.error('Erro ao carregar itens de protocolo (historico):', protocoloError);
    } else {
      (protocoloData || []).forEach((row: any) => {
        if (!row?.id) return;
        protocoloMap[row.id] = {
          id: row.id,
          loja: row.loja ?? null,
          produto: row.produto ?? null,
        };
      });
    }
  }

  return {
    compras: comprasData,
    protocoloMap,
  };
};

const fetchMovementsUpToMonth = async (monthKey: string): Promise<InventoryMovement[]> => {
  const competencia = monthKeyToCompetencia(monthKey);
  const { data, error } = await supabase
    .from('custos_clinicas_movements')
    .select('id, competencia, clinic, product, store, quantity, unit_cost, total_cost, created_at')
    .lte('competencia', competencia)
    .order('competencia', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao carregar historico de movimentacoes:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    monthKey: String(row.competencia || '').slice(0, 7),
    clinic: row.clinic as ClinicKey,
    product: normalizeKey(row.product),
    store: normalizeStore(row.store),
    quantity: parseNumberValue(row.quantity),
    unitCost: parseNumberValue(row.unit_cost),
    totalCost: parseNumberValue(row.total_cost),
    createdAt: row.created_at,
  }));
};

export default CustosClinicas;
