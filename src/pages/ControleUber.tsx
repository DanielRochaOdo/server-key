import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  ControleUberRow,
  deleteControleUber,
  listCompetenciasControleUber,
  listControleUberByCompetencia,
  upsertControleUber,
} from '../services/controleUber';

type FormRow = {
  id?: string;
  tempId: string;
  data: string;
  saidaHora: string;
  retornoHora: string;
  valorSaida: string;
  valorRetorno: string;
  servico: string;
  saidaLocal: string;
  destino: string;
  tipo: string;
  pessoa1: string;
  pessoa2: string;
  pessoa3: string;
};

const LOCATIONS = ['Administracao', 'Parangaba', 'Bezerra', 'Aguanambi'];
const LOCATION_FILTERS = ['Bezerra', 'Parangaba', 'Aguanambi'];
const TIPOS = ['carro', 'moto'];
const PESSOAS = ['Flash', 'Vinicius', 'Daniel', 'Ryan', 'Cezar'];

const toMonthValue = (competencia?: string) => {
  if (!competencia) return new Date().toISOString().slice(0, 7);
  return competencia.slice(0, 7);
};

const toCompetenciaDate = (monthValue: string) => `${monthValue}-01`;

const formatCompetenciaLabel = (competencia?: string) => {
  if (!competencia) return '--/----';
  const match = competencia.match(/^(\d{4})-(\d{2})/);
  if (!match) return competencia;
  return `${match[2]}/${match[1]}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return '-';
  let numeric = typeof value === 'string' ? Number(value) : Number(value);
  if (Number.isNaN(numeric) && typeof value === 'string') {
    numeric = Number(value.replace(',', '.'));
  }
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatCurrencyInput = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return '';
  let numeric = typeof value === 'string' ? Number(value) : Number(value);
  if (Number.isNaN(numeric) && typeof value === 'string') {
    numeric = Number(value.replace(',', '.'));
  }
  if (!Number.isFinite(numeric)) return '';
  return numeric.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseCurrencyInput = (value: string) => {
  const cleaned = value.replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const createTempId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createEmptyRow = (): FormRow => ({
  tempId: createTempId(),
  data: '',
  saidaHora: '',
  retornoHora: '',
  valorSaida: '',
  valorRetorno: '',
  servico: '',
  saidaLocal: '',
  destino: '',
  tipo: '',
  pessoa1: '',
  pessoa2: '',
  pessoa3: '',
});

const mapRowToForm = (row: ControleUberRow): FormRow => ({
  id: row.id,
  tempId: row.id,
  data: row.data || '',
  saidaHora: row.saida_hora || '',
  retornoHora: row.retorno_hora || '',
  valorSaida: formatCurrencyInput(row.valor_saida ?? null),
  valorRetorno: formatCurrencyInput(row.valor_retorno ?? null),
  servico: row.servico || '',
  saidaLocal: row.saida_local || '',
  destino: row.destino || '',
  tipo: row.tipo || '',
  pessoa1: row.pessoa_1 || '',
  pessoa2: row.pessoa_2 || '',
  pessoa3: row.pessoa_3 || '',
});

const isRowEmpty = (row: FormRow) => {
  const values = [
    row.data,
    row.saidaHora,
    row.retornoHora,
    row.valorSaida,
    row.valorRetorno,
    row.servico,
    row.saidaLocal,
    row.destino,
    row.tipo,
    row.pessoa1,
    row.pessoa2,
    row.pessoa3,
  ];
  return values.every((value) => !String(value || '').trim());
};

const matchesLocation = (row: ControleUberRow, location: string) =>
  row.saida_local === location || row.destino === location;

const ControleUber: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [competencias, setCompetencias] = useState<string[]>([]);
  const [selectedCompetencia, setSelectedCompetencia] = useState('');
  const [rows, setRows] = useState<ControleUberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formCompetenciaMonth, setFormCompetenciaMonth] = useState('');
  const [formRows, setFormRows] = useState<FormRow[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const competenciasData = await listCompetenciasControleUber();
      setCompetencias(competenciasData);
      setSelectedCompetencia(competenciasData[0] || '');
    } catch (error) {
      console.error('Erro ao carregar competencias do Controle Uber:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRows = useCallback(async (competencia: string) => {
    if (!competencia) {
      setRows([]);
      return;
    }
    try {
      setRowsLoading(true);
      const data = await listControleUberByCompetencia(competencia);
      setRows(data);
    } catch (error) {
      console.error('Erro ao carregar registros do Controle Uber:', error);
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!selectedCompetencia) {
      setRows([]);
      return;
    }
    loadRows(selectedCompetencia);
  }, [loadRows, selectedCompetencia]);

  const openForm = (mode: 'create' | 'edit') => {
    const monthValue = toMonthValue(selectedCompetencia);
    const initialRows = mode === 'edit' ? rows.map(mapRowToForm) : [];

    setFormCompetenciaMonth(monthValue);
    setFormRows(initialRows.length > 0 ? initialRows : [createEmptyRow()]);
    setDeletedIds([]);
    setFormError('');
    setFormMode(mode);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError('');
    setSaving(false);
    setDeletedIds([]);
  };

  const handleRowChange = (rowId: string, field: keyof FormRow, value: string) => {
    setFormRows((prev) =>
      prev.map((row) => (row.tempId === rowId ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRow = () => {
    setFormRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleDeleteRow = (row: FormRow) => {
    setFormRows((prev) => prev.filter((item) => item.tempId !== row.tempId));
    if (row.id) {
      setDeletedIds((prev) => [...prev, row.id as string]);
    }
  };

  const handleSave = async () => {
    if (!formCompetenciaMonth) {
      setFormError('Informe a competencia.');
      return;
    }
    if (!user?.id) {
      setFormError('Usuario nao autenticado.');
      return;
    }

    const competencia = toCompetenciaDate(formCompetenciaMonth);
    const sanitizedRows = formRows.filter((row) => !isRowEmpty(row));

    if (sanitizedRows.some((row) => !row.data)) {
      setFormError('Informe a data em todas as linhas preenchidas.');
      return;
    }

    const payload = sanitizedRows.map((row) => {
      const base = {
        competencia,
        data: row.data,
        saida_hora: row.saidaHora || null,
        retorno_hora: row.retornoHora || null,
        valor_saida: parseCurrencyInput(row.valorSaida),
        valor_retorno: parseCurrencyInput(row.valorRetorno),
        servico: row.servico ? row.servico.trim() : null,
        saida_local: row.saidaLocal || null,
        destino: row.destino || null,
        tipo: row.tipo || null,
        pessoa_1: row.pessoa1 || null,
        pessoa_2: row.pessoa2 || null,
        pessoa_3: row.pessoa3 || null,
        user_id: user.id,
      };

      if (row.id) {
        return { id: row.id, ...base };
      }

      return base;
    });

    try {
      setSaving(true);
      if (deletedIds.length > 0) {
        await deleteControleUber(deletedIds);
      }
      if (payload.length > 0) {
        await upsertControleUber(payload);
      }

      const competenciasAtualizadas = await listCompetenciasControleUber();
      setCompetencias(competenciasAtualizadas);

      const nextCompetencia =
        competenciasAtualizadas.includes(competencia)
          ? competencia
          : competenciasAtualizadas[0] || '';

      setSelectedCompetencia(nextCompetencia);
      if (nextCompetencia) {
        await loadRows(nextCompetencia);
      } else {
        setRows([]);
      }

      setShowForm(false);
    } catch (error: any) {
      console.error('Erro ao salvar controle Uber:', error);
      const message =
        error?.message ||
        error?.details ||
        error?.hint ||
        (error ? JSON.stringify(error) : '') ||
        'Erro ao salvar controle.';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const competenciaOptions = useMemo(() => {
    return competencias.map((competencia) => ({
      value: competencia,
      label: formatCompetenciaLabel(competencia),
    }));
  }, [competencias]);

  const filteredRows = useMemo(() => {
    if (!locationFilter) return rows;
    return rows.filter((row) => matchesLocation(row, locationFilter));
  }, [locationFilter, rows]);

  const hasData = filteredRows.length > 0;

  const totalMes = useMemo(() => {
    return filteredRows.reduce((acc, row) => {
      const saida = Number(row.valor_saida || 0);
      const retorno = Number(row.valor_retorno || 0);
      return acc + saida + retorno;
    }, 0);
  }, [filteredRows]);

  const locationTotals = useMemo(() => {
    return LOCATION_FILTERS.map((location) => {
      const total = rows.reduce((acc, row) => {
        if (!matchesLocation(row, location)) return acc;
        const saida = Number(row.valor_saida || 0);
        const retorno = Number(row.valor_retorno || 0);
        return acc + saida + retorno;
      }, 0);
      return { location, total };
    });
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Controle Uber</h1>
          <p className="mt-1 text-xs sm:text-sm text-primary-600">Controle mensal de corridas</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <select
              value={selectedCompetencia}
              onChange={(event) => setSelectedCompetencia(event.target.value)}
              className="w-full sm:w-48 pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {competenciaOptions.length === 0 && (
                <option value="">NENHUMA COMPETENCIA</option>
              )}
              {competenciaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          {isAdmin() && (
            <>
              {hasData && (
                <button
                  onClick={() => openForm('edit')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-medium hover:bg-neutral-200 transition-colors"
                >
                  Editar Controle
                </button>
              )}
              <button
                onClick={() => openForm('create')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Novo Registro
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {locationTotals.map((item) => {
            const isActive = locationFilter === item.location;
            return (
              <button
                key={item.location}
                type="button"
                onClick={() => setLocationFilter(isActive ? null : item.location)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-wide">
                  {item.location.toUpperCase()}
                </div>
                <div className="mt-1 text-sm font-semibold">{formatCurrency(item.total)}</div>
                <div className="text-[11px] text-neutral-500">Saída + Retorno</div>
              </button>
            );
          })}
        </div>

        {rowsLoading ? (
          <div className="flex items-center justify-center min-h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : !hasData ? (
          <div className="text-center py-12">
            <p className="text-sm text-neutral-500">
              {locationFilter
                ? 'Nenhum registro encontrado para este filtro.'
                : 'Nenhum registro encontrado para esta competencia.'}
            </p>
            {isAdmin() && (
              <button
                onClick={() => openForm('create')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Criar registro
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-hidden">
            <table className="w-full table-fixed text-[11px]">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-200">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Saida</th>
                  <th className="py-2 pr-2">Retorno</th>
                  <th className="py-2 pr-2">Valor Saida</th>
                  <th className="py-2 pr-2">Valor Retorno</th>
                  <th className="py-2 pr-2">Servico</th>
                  <th className="py-2 pr-2">Saida (local)</th>
                  <th className="py-2 pr-2">Destino</th>
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2 pr-2">Pessoa 1</th>
                  <th className="py-2 pr-2">Pessoa 2</th>
                  <th className="py-2">Pessoa 3</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-b-0">
                    <td className="py-2 pr-2 whitespace-normal break-words">{formatDate(row.data)}</td>
                    <td className="py-2 pr-2 whitespace-normal break-words">{row.saida_hora || '-'}</td>
                    <td className="py-2 pr-2 whitespace-normal break-words">{row.retorno_hora || '-'}</td>
                    <td className="py-2 pr-2 whitespace-normal break-words">{formatCurrency(row.valor_saida ?? null)}</td>
                    <td className="py-2 pr-2 whitespace-normal break-words">{formatCurrency(row.valor_retorno ?? null)}</td>
                    <td className="py-2 pr-2 whitespace-normal break-words">{row.servico || '-'}</td>
                    <td className="py-2 pr-2 whitespace-normal break-words">{row.saida_local || '-'}</td>
                    <td className="py-2 pr-2 whitespace-normal break-words">{row.destino || '-'}</td>
                    <td className="py-2 pr-2 whitespace-normal break-words">{row.tipo || '-'}</td>
                    <td className="py-2 pr-2 whitespace-normal break-words">{row.pessoa_1 || '-'}</td>
                    <td className="py-2 pr-2 whitespace-normal break-words">{row.pessoa_2 || '-'}</td>
                    <td className="py-2 whitespace-normal break-words">{row.pessoa_3 || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasData && (
              <div className="mt-4 flex justify-end">
                <div className="inline-flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm">
                  <span className="text-neutral-600">Valor (mês)</span>
                  <span className="font-semibold text-neutral-900">{formatCurrency(totalMes)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-neutral-200">
              <h2 className="text-base sm:text-lg font-semibold text-neutral-900">
                {formMode === 'edit' ? 'Editar Controle Uber' : 'Novo Controle Uber'}
              </h2>
              <button
                onClick={closeForm}
                className="text-neutral-400 hover:text-neutral-600"
                disabled={saving}
              >
                Fechar
              </button>
            </div>
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 flex-1 overflow-y-auto">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="text-sm font-medium text-neutral-700 whitespace-nowrap">
                  Competencia (mes/ano)
                </label>
                <input
                  type="month"
                  value={formCompetenciaMonth}
                  onChange={(event) => setFormCompetenciaMonth(event.target.value)}
                  className="w-44 px-3 py-1.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={saving || formMode === 'edit'}
                />
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
                  disabled={saving}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar linha
                </button>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="min-w-[1300px] text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500 border-b border-neutral-200">
                      <th className="py-2 pr-2">Data</th>
                      <th className="py-2 pr-2">Saida</th>
                      <th className="py-2 pr-2">Retorno</th>
                      <th className="py-2 pr-2">Valor Saida (R$ BRL)</th>
                      <th className="py-2 pr-2">Valor Retorno (R$ BRL)</th>
                      <th className="py-2 pr-2">Servico</th>
                      <th className="py-2 pr-2">Saida (local)</th>
                      <th className="py-2 pr-2">Destino</th>
                      <th className="py-2 pr-2">Tipo</th>
                      <th className="py-2 pr-2">Pessoa 1</th>
                      <th className="py-2 pr-2">Pessoa 2</th>
                      <th className="py-2 pr-2">Pessoa 3</th>
                      <th className="py-2">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formRows.map((row) => (
                      <tr key={row.tempId} className="border-b border-neutral-100 last:border-b-0">
                        <td className="py-1 pr-2">
                          <input
                            type="date"
                            value={row.data}
                            onChange={(event) => handleRowChange(row.tempId, 'data', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="time"
                            value={row.saidaHora}
                            onChange={(event) => handleRowChange(row.tempId, 'saidaHora', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="time"
                            value={row.retornoHora}
                            onChange={(event) => handleRowChange(row.tempId, 'retornoHora', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.valorSaida}
                            onChange={(event) => handleRowChange(row.tempId, 'valorSaida', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                            placeholder="0,00"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.valorRetorno}
                            onChange={(event) => handleRowChange(row.tempId, 'valorRetorno', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                            placeholder="0,00"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="text"
                            value={row.servico}
                            onChange={(event) => handleRowChange(row.tempId, 'servico', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            value={row.saidaLocal}
                            onChange={(event) => handleRowChange(row.tempId, 'saidaLocal', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          >
                            <option value="">SELECIONAR</option>
                            {LOCATIONS.map((local) => (
                              <option key={local} value={local}>
                                {local.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            value={row.destino}
                            onChange={(event) => handleRowChange(row.tempId, 'destino', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          >
                            <option value="">SELECIONAR</option>
                            {LOCATIONS.map((local) => (
                              <option key={local} value={local}>
                                {local.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            value={row.tipo}
                            onChange={(event) => handleRowChange(row.tempId, 'tipo', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          >
                            <option value="">SELECIONAR</option>
                            {TIPOS.map((tipo) => (
                              <option key={tipo} value={tipo}>
                                {tipo.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            value={row.pessoa1}
                            onChange={(event) => handleRowChange(row.tempId, 'pessoa1', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          >
                            <option value="">SELECIONAR</option>
                            {PESSOAS.map((pessoa) => (
                              <option key={pessoa} value={pessoa}>
                                {pessoa.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            value={row.pessoa2}
                            onChange={(event) => handleRowChange(row.tempId, 'pessoa2', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          >
                            <option value="">SELECIONAR</option>
                            {PESSOAS.map((pessoa) => (
                              <option key={pessoa} value={pessoa}>
                                {pessoa.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            value={row.pessoa3}
                            onChange={(event) => handleRowChange(row.tempId, 'pessoa3', event.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          >
                            <option value="">SELECIONAR</option>
                            {PESSOAS.map((pessoa) => (
                              <option key={pessoa} value={pessoa}>
                                {pessoa.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row)}
                            className="text-neutral-500 hover:text-red-600"
                            title="Excluir"
                            aria-label="Excluir"
                            disabled={saving}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-3 sm:p-4 border-t border-neutral-200">
              <button
                onClick={closeForm}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Salvando...' : formMode === 'edit' ? 'Salvar edicao' : 'Salvar controle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControleUber;


