import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteControleEmpresas,
  insertControleEmpresas,
  listControleEmpresas,
  upsertControleEmpresas,
  upsertControleEmpresasByUnique,
} from '../services/controleEmpresas';

type MonthRow = {
  id?: string;
  tempId: string;
  empresa: string;
  quantidade: string;
};

type MonthState = {
  rows: MonthRow[];
  deletedIds: string[];
  saving: boolean;
  error: string;
};

const MONTHS = [
  { label: 'Janeiro', index: 0 },
  { label: 'Fevereiro', index: 1 },
  { label: 'Março', index: 2 },
  { label: 'Abril', index: 3 },
  { label: 'Maio', index: 4 },
  { label: 'Junho', index: 5 },
  { label: 'Julho', index: 6 },
  { label: 'Agosto', index: 7 },
  { label: 'Setembro', index: 8 },
  { label: 'Outubro', index: 9 },
  { label: 'Novembro', index: 10 },
  { label: 'Dezembro', index: 11 },
];

const DEFAULT_EMPRESAS = ['Jetlaser', 'Goldjet', 'Voxtel', 'Boni'];

const buildMonthDate = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;

const parseMonthIndex = (mes: string) => {
  const monthPart = mes?.slice(5, 7);
  const monthIndex = Number(monthPart) - 1;
  return Number.isFinite(monthIndex) && monthIndex >= 0 && monthIndex < 12 ? monthIndex : -1;
};

const createTempId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const parseQuantidade = (value: string) => {
  const digits = value.replace(/[^\d-]/g, '');
  const parsed = parseInt(digits, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

const normalizeRows = (rows: MonthRow[]) =>
  rows.map((row) => ({
    ...row,
    empresa: row.empresa.trim(),
    quantidade: row.quantidade,
  }));

const buildCompanyOrder = () => {
  const order = new Map<string, number>();
  DEFAULT_EMPRESAS.forEach((name, index) => {
    order.set(name.toLowerCase(), index);
  });
  return order;
};

const ControleEmpresas: React.FC = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newEmpresa, setNewEmpresa] = useState('');
  const [addEmpresaError, setAddEmpresaError] = useState('');
  const [monthsState, setMonthsState] = useState<MonthState[]>(
    MONTHS.map(() => ({ rows: [], deletedIds: [], saving: false, error: '' }))
  );
  const companyOrder = useMemo(() => buildCompanyOrder(), []);

  const sortRowsByCompany = useCallback(
    (rows: MonthRow[]) => {
      const rowsCopy = [...rows];
      rowsCopy.sort((a, b) => {
        const aKey = a.empresa.trim().toLowerCase();
        const bKey = b.empresa.trim().toLowerCase();
        const aOrder = companyOrder.get(aKey);
        const bOrder = companyOrder.get(bKey);
        if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;
        return aKey.localeCompare(bKey);
      });
      return rowsCopy;
    },
    [companyOrder]
  );

  const updateMonthState = useCallback(
    (monthIndex: number, updater: (state: MonthState) => MonthState) => {
      setMonthsState((prev) =>
        prev.map((month, index) => (index === monthIndex ? updater(month) : month))
      );
    },
    []
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      let data = await listControleEmpresas(year);

      if (user?.id) {
        const missingRowsPayload: { mes: string; empresa: string; quantidade: number; user_id: string }[] = [];
        const groupedByMonth = new Map<number, Set<string>>();

        data.forEach((row) => {
          const monthIndex = parseMonthIndex(row.mes);
          if (monthIndex < 0) return;
          if (!groupedByMonth.has(monthIndex)) {
            groupedByMonth.set(monthIndex, new Set());
          }
          groupedByMonth.get(monthIndex)?.add(row.empresa.trim().toLowerCase());
        });

        MONTHS.forEach((month) => {
          const existingCompanies = groupedByMonth.get(month.index) ?? new Set<string>();
          if (existingCompanies.size > 0) return;
          DEFAULT_EMPRESAS.forEach((empresa) => {
            missingRowsPayload.push({
              mes: buildMonthDate(year, month.index),
              empresa,
              quantidade: 0,
              user_id: user.id,
            });
          });
        });

        if (missingRowsPayload.length > 0) {
          await upsertControleEmpresasByUnique(missingRowsPayload);
          data = await listControleEmpresas(year);
        }
      }

      const grouped: MonthRow[][] = MONTHS.map(() => []);

      data.forEach((row) => {
        const monthIndex = parseMonthIndex(row.mes);
        if (monthIndex < 0) return;
        grouped[monthIndex].push({
          id: row.id,
          tempId: row.id,
          empresa: row.empresa,
          quantidade: String(row.quantidade ?? ''),
        });
      });

      const sortedGrouped = grouped.map((rows) => sortRowsByCompany(rows));

      setMonthsState(
        sortedGrouped.map((rows) => ({
          rows,
          deletedIds: [],
          saving: false,
          error: '',
        }))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar dados.';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [sortRowsByCompany, user?.id, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddEmpresa = () => {
    const empresa = newEmpresa.trim();
    if (!empresa) {
      setAddEmpresaError('Informe o nome da empresa.');
      return;
    }

    const normalized = empresa.toLowerCase();
    const alreadyExists = monthsState.some((month) =>
      month.rows.some((row) => row.empresa.trim().toLowerCase() === normalized)
    );

    if (alreadyExists) {
      setAddEmpresaError('Empresa já existe no controle.');
      return;
    }

    setMonthsState((prev) =>
      prev.map((month) => ({
        ...month,
        rows: sortRowsByCompany([
          ...month.rows,
          {
            tempId: createTempId(),
            empresa,
            quantidade: '',
          },
        ]),
      }))
    );

    setNewEmpresa('');
    setAddEmpresaError('');
  };

  const handleRowChange = (
    monthIndex: number,
    rowId: string,
    field: 'empresa' | 'quantidade',
    value: string
  ) => {
    updateMonthState(monthIndex, (month) => ({
      ...month,
      rows: month.rows.map((row) =>
        row.tempId === rowId ? { ...row, [field]: value } : row
      ),
    }));
  };

  const handleDeleteRow = (monthIndex: number, row: MonthRow) => {
    updateMonthState(monthIndex, (month) => ({
      ...month,
      rows: month.rows.filter((item) => item.tempId !== row.tempId),
      deletedIds: row.id ? [...month.deletedIds, row.id] : month.deletedIds,
    }));
  };

  const handleSaveMonth = async (monthIndex: number) => {
    if (!user?.id) {
      updateMonthState(monthIndex, (month) => ({
        ...month,
        error: 'Usuário não autenticado.',
      }));
      return;
    }

    const month = monthsState[monthIndex];
    const mes = buildMonthDate(year, monthIndex);

    const sanitizedRows = normalizeRows(month.rows).filter((row) => row.empresa);
    const existingRows = sanitizedRows.filter((row) => row.id);
    const newRows = sanitizedRows.filter((row) => !row.id);

    updateMonthState(monthIndex, (state) => ({ ...state, saving: true, error: '' }));

    try {
      if (month.deletedIds.length > 0) {
        await deleteControleEmpresas(month.deletedIds);
      }

      if (existingRows.length > 0) {
        const payload = existingRows.map((row) => ({
          id: row.id,
          mes,
          empresa: row.empresa,
          quantidade: parseQuantidade(row.quantidade),
          user_id: user.id,
        }));
        await upsertControleEmpresas(payload);
      }

      if (newRows.length > 0) {
        const payload = newRows.map((row) => ({
          mes,
          empresa: row.empresa,
          quantidade: parseQuantidade(row.quantidade),
          user_id: user.id,
        }));
        await insertControleEmpresas(payload);
      }

      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar mês.';
      updateMonthState(monthIndex, (state) => ({ ...state, error: message }));
    } finally {
      updateMonthState(monthIndex, (state) => ({ ...state, saving: false }));
    }
  };

  const yearOptions = useMemo(() => {
    return [currentYear - 1, currentYear, currentYear + 1];
  }, [currentYear]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Controle Empresas</h1>
          <p className="mt-1 text-sm text-primary-600">
            Controle mensal de empresas e quantidades.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">Ano:</span>
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-2 sm:items-center">
          <label className="text-sm text-neutral-600">Nova empresa:</label>
          <input
            type="text"
            value={newEmpresa}
            onChange={(event) => setNewEmpresa(event.target.value)}
            className="w-full sm:w-72 px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Digite o nome da empresa"
          />
        </div>
        <button
          onClick={handleAddEmpresa}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Adicionar empresa
        </button>
      </div>

      {addEmpresaError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {addEmpresaError}
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {MONTHS.map((month, index) => {
          const state = monthsState[index];
          const hasRows = state.rows.length > 0;

          return (
            <div key={month.label} className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden">
              <div className="bg-neutral-300 text-neutral-900 text-center font-semibold py-2 uppercase tracking-wide dark:bg-black dark:text-white">
                {month.label}
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-neutral-200 text-neutral-800">
                    <th className="border border-neutral-400 px-2 py-1 text-left">Empresa</th>
                    <th className="border border-neutral-400 px-2 py-1 text-left">Quantidade</th>
                  </tr>
                </thead>
                <tbody className="bg-neutral-100">
                  {hasRows ? (
                    state.rows.map((row) => (
                      <tr key={row.tempId}>
                        <td className="border border-neutral-400 px-2 py-1">
                          <input
                            type="text"
                            value={row.empresa}
                            onChange={(event) =>
                              handleRowChange(index, row.tempId, 'empresa', event.target.value)
                            }
                            className="w-full bg-transparent focus:outline-none"
                            placeholder="Empresa"
                          />
                        </td>
                        <td className="border border-neutral-400 px-2 py-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.quantidade}
                              onChange={(event) =>
                                handleRowChange(index, row.tempId, 'quantidade', event.target.value)
                              }
                              className="w-full bg-transparent focus:outline-none"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(index, row)}
                              className="text-neutral-500 hover:text-red-600"
                              title="Excluir"
                              aria-label="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={2}
                        className="border border-neutral-400 px-2 py-4 text-center text-neutral-500"
                      >
                        Nenhuma empresa cadastrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {state.error && (
                <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border-t border-red-200">
                  {state.error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 px-3 py-2 bg-neutral-50 border-t border-neutral-200">
                <button
                  onClick={() => handleSaveMonth(index)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60"
                  disabled={state.saving}
                >
                  {state.saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  {state.saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ControleEmpresas;
