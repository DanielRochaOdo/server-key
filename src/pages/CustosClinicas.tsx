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

type MovementStore = Record<string, InventoryMovement[]>;
type UnifyStore = Record<string, string>;
type CarryoverStore = Record<string, Record<string, { quantity: number; totalCost: number }>>;

type MonthData = {
  uber: ControleUberRow[];
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

const normalizeKey = (value?: string | null) => (value || 'SEM PRODUTO').trim().toUpperCase();
const normalizeSearch = (value?: string | null) => (value || '').trim().toUpperCase();
const normalizeStore = (value?: string | null) => (value || 'SEM LOJA').trim().toUpperCase();
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

const normalizeText = (value?: string | null) => (value || '').toLowerCase();

const resolveClinicFromUber = (row: ControleUberRow): ClinicKey | null => {
  const destino = normalizeText(row.destino);
  const saida = normalizeText(row.saida_local);
  const match = (label: string) => destino.includes(label) || saida.includes(label);
  if (match('aguanambi')) return 'AGUANAMBI';
  if (match('bezerra')) return 'BEZERRA';
  if (match('parangaba')) return 'PARANGABA';
  if (match('sobral')) return 'SOBRAL';
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
    quantity: Number(row.quantity || 0),
    unitCost: Number(row.unit_cost || 0),
    totalCost: Number(row.total_cost || 0),
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
      quantity: Number(row.quantity || 0),
      totalCost: Number(row.total_cost || 0),
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
      .eq('mes', month),
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
  const [movementDraft, setMovementDraft] = useState({
    product: '',
    store: '',
    clinic: '' as ClinicKey | '',
    quantity: 1,
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

  const prevMonthKey = useMemo(() => getPrevMonthKey(monthKey), [monthKey]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const prevPrevMonthKey = getPrevMonthKey(prevMonthKey);
      const [current, previous, unifyMap, movementCurrent, movementPrev, carryPrev, carryPrevPrev] =
        await Promise.all([
        fetchMonthData(monthKey),
        fetchMonthData(prevMonthKey),
        fetchUnifyStore(),
        fetchMovementsByMonth(monthKey),
        fetchMovementsByMonth(prevMonthKey),
        fetchCarryoverByMonth(prevMonthKey),
        fetchCarryoverByMonth(prevPrevMonthKey),
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
  };

  const removeMovementLocal = (id: string) => {
    setMovementStore((prev) => {
      const current = prev[monthKey] || [];
      return { ...prev, [monthKey]: current.filter((item) => item.id !== id) };
    });
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
      const sourceName = normalizeKey(protocolo?.produto || item.item);
      const storeName = normalizeStore(protocolo?.loja);
      const unifiedName = normalizeKey(unifyStore[sourceName] || sourceName);
      const quantity = Number(item.quantidade || 0);
      const totalCost = Number(item.valor_total_frete || 0);
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
      const sourceName = normalizeKey(protocolo?.produto || item.item);
      const storeName = normalizeStore(protocolo?.loja);
      const unifiedName = normalizeKey(unifyStore[sourceName] || sourceName);
      const quantity = Number(item.quantidade || 0);
      const totalCost = Number(item.valor_total_frete || 0);
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

  const maxComparison = useMemo(() => {
    return Math.max(1, ...comparisonRows.map((row) => row.current));
  }, [comparisonRows]);

  const movementCount = movements.length;

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
        const normalizedProduct = normalizeKey(unifyStore[normalizeKey(rawProduct)] || rawProduct);
        const normalizedStore = normalizeStore(rawStore);
        const normalizedKey = productStoreKey(normalizedProduct, normalizedStore);
        snapshot[normalizedKey] = {
          quantity: (snapshot[normalizedKey]?.quantity || 0) + Number(value.quantity || 0),
          totalCost: (snapshot[normalizedKey]?.totalCost || 0) + Number(value.totalCost || 0),
        };
      });

      sources.forEach((item) => {
        if (!item.quantity) return;
        const key = productStoreKey(item.unifiedName, item.storeName);
        snapshot[key] = {
          quantity: (snapshot[key]?.quantity || 0) + item.quantity,
          totalCost: (snapshot[key]?.totalCost || 0) + item.totalCost,
        };
      });

      movementList.forEach((movement) => {
        const key = productStoreKey(movement.product, movement.store);
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

  const carryoverPrev = useMemo(() => {
    const stored = carryoverStore[prevMonthKey];
    if (stored && Object.keys(stored).length > 0) return stored;
    const prevPrev = carryoverStore[getPrevMonthKey(prevMonthKey)] || {};
    return computeInventorySnapshot(prevPrev, prevPurchaseSources, prevMovements);
  }, [carryoverStore, prevMonthKey, prevPurchaseSources, prevMovements, computeInventorySnapshot]);

  const inventoryMap = useMemo(() => {
    const next: Record<string, { quantity: number; totalCost: number }> = {};

    Object.assign(next, computeInventorySnapshot(carryoverPrev, purchaseSources, movements));
    return next;
  }, [carryoverPrev, purchaseSources, movements, computeInventorySnapshot]);

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

  const unifiedProducts = useMemo(() => {
    const map: Record<string, { sources: Set<string>; hasRename: boolean }> = {};
    Object.entries(unifyStore).forEach(([source, unified]) => {
      const normalizedSource = normalizeKey(source);
      const normalizedUnified = normalizeKey(unified || source);
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
      quantity: Math.min(prev.quantity, defaultStore.quantity),
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
        quantity: 1,
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
      unifySelected.map((name) => normalizeKey(unifyStore[name] || name))
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
    const rows: { source_name: string; unified_name: string }[] = unifySelected.map((source) => {
      const normalizedSource = normalizeKey(source);
      next[normalizedSource] = normalizedUnified;
      return { source_name: normalizedSource, unified_name: normalizedUnified };
    });

    const { error } = await supabase
      .from('custos_clinicas_unify')
      .upsert(rows, { onConflict: 'source_name' });

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
                className="w-full sm:w-44 pl-9 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              />
            </div>
            <button
              type="button"
              onClick={() => setMonthKey(toMonthKey(new Date()))}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-button bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-button transition-colors hover:bg-button-50 sm:w-auto"
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
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Transporte (Uber)</p>
              <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(totalUber)}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Total do mes</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Insumos</p>
              <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(totalCompras)}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {movementCount > 0 ? `${movementCount} movimentacoes` : 'Sem movimentacoes'}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Total geral</p>
              <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(totalGeral)}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Uber + Insumos</p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide dark:text-neutral-100">
                Comparativo por clinica
              </h2>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Mes atual vs anterior
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {comparisonRows.map((row) => {
                const pctLabel =
                  row.pct === null ? 'Sem base' : `${row.pct >= 0 ? '+' : ''}${row.pct.toFixed(1)}%`;
                return (
                  <div key={row.key} className="rounded-xl border border-neutral-200 px-3 py-3 dark:border-neutral-700">
                    <div className="flex items-center justify-between text-xs text-neutral-500 uppercase dark:text-neutral-400">
                      <span>{row.label}</span>
                      <span>{pctLabel}</span>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(row.current)}
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-neutral-100 overflow-hidden dark:bg-neutral-800">
                      <div
                        className="h-full bg-primary-500"
                        style={{ width: `${Math.min(100, (row.current / maxComparison) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                      Mes anterior: {formatCurrency(row.previous)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
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
                  className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
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
                      const isUnified = unifiedProducts.has(product);
                      const expanded = Boolean(expandedProducts[product]);

                      if (!isUnified) {
                        if (stores.length === 1) {
                          const storeRow = stores[0];
                          return (
                            <tr key={product} className="border-b border-neutral-100 dark:border-neutral-800">
                              <td className="py-2 px-2 text-neutral-800 dark:text-neutral-100">{product}</td>
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
                            {stores.map((storeRow) => (
                              <tr
                                key={`${product}-${storeRow.store}`}
                                className="border-b border-neutral-100 dark:border-neutral-800"
                              >
                                <td className="py-2 px-2 text-neutral-800 dark:text-neutral-100">{product}</td>
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
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 text-[10px] dark:border-neutral-700">
                                  {expanded ? '-' : '+'}
                                </span>
                                {product}
                              </button>
                              <div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                                {stores.length} loja(s)
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
                                className="border-b border-neutral-100 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/60"
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

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide dark:text-neutral-100">
                Transporte (Uber)
              </h2>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Total por clinica
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {CLINICAS.filter((clinic) => clinic.key !== 'MATRIZ').map((clinic) => (
                <div key={clinic.key} className="min-w-[160px] rounded-xl border border-neutral-200 px-3 py-3 dark:border-neutral-700">
                  <div className="text-xs text-neutral-500 uppercase dark:text-neutral-400">{clinic.label}</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(uberTotals[clinic.key])}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col dark:bg-neutral-900/95 dark:border-neutral-800">
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
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                      placeholder="Digite para filtrar"
                    />
                    {showSuggestions && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                        {filteredProductOptions.map((product) => (
                          <button
                            key={product}
                            type="button"
                            onClick={() => {
                              setMovementDraft((prev) => ({
                                ...prev,
                                product,
                                store: '',
                                quantity: 1,
                              }));
                              setProductSearch(product);
                              setShowProductSuggestions(false);
                            }}
                            className="w-full px-3 py-2 text-left text-[11px] uppercase text-neutral-700 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
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
                        quantity: 1,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
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
                          quantity: nextInfo ? Math.min(prev.quantity, nextInfo.quantity) : prev.quantity,
                        }));
                      }}
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                    >
                      <option value="">Selecione</option>
                      {storeOptions.map((option) => (
                        <option key={option.store} value={option.store}>
                          {option.store} ({option.quantity}) - {formatCurrency(option.unitCost)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200">
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
                        const raw = Number(event.target.value || 1);
                        const safeMin = Number.isFinite(raw) && raw > 0 ? raw : 1;
                        const safeMax = availableQuantity > 0 ? availableQuantity : safeMin;
                        return {
                          ...prev,
                          quantity: Math.min(safeMin, safeMax),
                        };
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
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
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
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

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
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
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-[10px] uppercase text-neutral-700 dark:text-neutral-200">
                      <thead className="text-neutral-500 border-b border-neutral-200 dark:text-neutral-400 dark:border-neutral-800">
                        <tr>
                          <th className="py-2 px-2 text-left">Produto</th>
                          <th className="py-2 px-2 text-left">Loja</th>
                          <th className="py-2 px-2 text-center">Qtd</th>
                          <th className="py-2 px-2 text-left">Clinica</th>
                          <th className="py-2 px-2 text-right">Total</th>
                          <th className="py-2 px-2 text-right">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movements.map((movement) => (
                          <tr key={movement.id} className="border-b border-neutral-100 dark:border-neutral-800">
                            <td className="py-2 px-2 text-neutral-800 dark:text-neutral-100">{movement.product}</td>
                            <td className="py-2 px-2 text-neutral-600 dark:text-neutral-300">{movement.store}</td>
                            <td className="py-2 px-2 text-center">{movement.quantity}</td>
                            <td className="py-2 px-2">{movement.clinic}</td>
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
            </div>
            <div className="px-5 py-3 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  setShowMovementModal(false);
                  setMovementError('');
                }}
                className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
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

      {showUnifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col dark:bg-neutral-900/95 dark:border-neutral-800">
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
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
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
                          const unified = normalizeKey(unifyStore[name] || name);
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
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11px] uppercase bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
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
            <div className="px-5 py-3 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  if (unifyStep === 'name') {
                    setUnifyStep('select');
                    return;
                  }
                  setShowUnifyModal(false);
                }}
                className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
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

export default CustosClinicas;
