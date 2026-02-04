import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getRateioMkmLayout,
  listCentrosCustoMkm,
  listCompetenciasRateioMkm,
  seedCentrosCustoMkm,
  upsertRateioMkmLinhas,
  RateioMkmCentroCusto,
  RateioMkmLayoutRow,
} from '../services/rateioMkm';

type FormRow = {
  id: number;
  nome: string;
  qtd: number;
  obs: string;
};

const COMPETENCIA_LABEL = 'RATEIO FATURA MKM VENCIMENTO';

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

const formatQtd = (value: number) => {
  const numeric = Number.isFinite(value) ? Math.trunc(value) : 0;
  const safeValue = Math.max(0, numeric);
  return safeValue.toLocaleString('pt-BR');
};

const formatQtdInput = (value: number) => formatQtd(value);

const parseQtdInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  return Math.max(0, parseInt(digits, 10) || 0);
};

const formatCusto = (value: number) => {
  const numeric = Number(value || 0);
  return numeric.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const COSTO_UNITARIO = 0.045;
const calcCusto = (qtd: number) => Number((qtd * COSTO_UNITARIO).toFixed(3));

const RateioMkm: React.FC = () => {
  const { isAdmin } = useAuth();
  const [centros, setCentros] = useState<RateioMkmCentroCusto[]>([]);
  const [competencias, setCompetencias] = useState<string[]>([]);
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('');
  const [layoutRows, setLayoutRows] = useState<RateioMkmLayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formCompetenciaMonth, setFormCompetenciaMonth] = useState<string>('');
  const [formRows, setFormRows] = useState<FormRow[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [centrosData, competenciasData] = await Promise.all([
        listCentrosCustoMkm(),
        listCompetenciasRateioMkm(),
      ]);

      if (centrosData.length === 0 && isAdmin()) {
        try {
          await seedCentrosCustoMkm();
          const refreshed = await listCentrosCustoMkm();
          setCentros(refreshed);
        } catch (seedError) {
          console.error('Erro ao semear centros de custo MKM:', seedError);
          setCentros(centrosData);
        }
      } else {
        setCentros(centrosData);
      }
      setCompetencias(competenciasData);

      if (competenciasData.length > 0) {
        setSelectedCompetencia(competenciasData[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do Rateio MKM:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadLayout = useCallback(async (competencia: string) => {
    if (!competencia) {
      setLayoutRows([]);
      return;
    }

    try {
      setLayoutLoading(true);
      const rows = await getRateioMkmLayout(competencia);
      setLayoutRows(rows);
    } catch (error) {
      console.error('Erro ao carregar layout do Rateio MKM:', error);
      setLayoutRows([]);
    } finally {
      setLayoutLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!selectedCompetencia) return;
    loadLayout(selectedCompetencia);
  }, [selectedCompetencia, loadLayout]);

  const openForm = (mode: 'create' | 'edit') => {
    if (centros.length === 0) {
      setFormError('Centros de custo nao carregados. Execute a migration ou tente novamente.');
      setShowForm(true);
      return;
    }
    const monthValue = toMonthValue(selectedCompetencia);
    const layoutMap = new Map(
      layoutRows
        .filter((row) => row['Centro de custo'] !== 'TOTAL FATURA')
        .map((row) => [row['Centro de custo'], row])
    );

    const rows = centros.map((centro) => {
      const existing = layoutMap.get(centro.nome);
      return {
        id: centro.id,
        nome: centro.nome,
        qtd: existing ? Number(existing['QTD SMS/WABA ENVIADOS a 0,045'] || 0) : 0,
        obs: existing ? existing['OBS'] || '' : '',
      };
    });

    setFormCompetenciaMonth(monthValue);
    setFormRows(rows);
    setFormError('');
    setFormMode(mode);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError('');
    setSaving(false);
  };

  const handleRowChange = (id: number, field: 'qtd' | 'obs', value: string) => {
    setFormRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (field === 'qtd') {
          const parsed = parseQtdInput(value);
          return { ...row, qtd: parsed };
        }
        return { ...row, obs: value };
      })
    );
  };

  const handleSave = async () => {
    if (!formCompetenciaMonth) {
      setFormError('Informe a competencia.');
      return;
    }

    try {
      setSaving(true);
      const competencia = toCompetenciaDate(formCompetenciaMonth);
      const payload = formRows.map((row) => ({
        competencia,
        centro_custo: row.id,
        qtd_de_sms: row.qtd,
        custo_sms: calcCusto(row.qtd),
        obs: row.obs ? row.obs.trim() : null,
      }));

      await upsertRateioMkmLinhas(payload);

      const competenciasAtualizadas = await listCompetenciasRateioMkm();
      setCompetencias(competenciasAtualizadas);
      setSelectedCompetencia(competencia);
      await loadLayout(competencia);
      setShowForm(false);
    } catch (error) {
      console.error('Erro ao salvar rateio MKM:', error);
      setFormError('Erro ao salvar rateio.');
    } finally {
      setSaving(false);
    }
  };

  const hasData = layoutRows.length > 0;
  const competenciaOptions = useMemo(() => {
    return competencias.map((competencia) => ({
      value: competencia,
      label: formatCompetenciaLabel(competencia),
    }));
  }, [competencias]);

  const displayRows = useMemo(() => {
    if (layoutRows.length === 0) return [];
    const hasTotal = layoutRows.some((row) => row['Centro de custo'] === 'TOTAL FATURA');
    if (hasTotal) return layoutRows;

    const totals = layoutRows.reduce(
      (acc, row) => {
        const qtd = Number(row['QTD SMS/WABA ENVIADOS a 0,045'] || 0);
        const custo = Number(row['CUSTOS SMS 0,045/WABA(0,30 E 0,55)'] || 0);
        return {
          qtd: acc.qtd + qtd,
          custo: acc.custo + custo,
        };
      },
      { qtd: 0, custo: 0 }
    );

    return [
      ...layoutRows,
      {
        'Centro de custo': 'TOTAL FATURA',
        'QTD SMS/WABA ENVIADOS a 0,045': totals.qtd,
        'CUSTOS SMS 0,045/WABA(0,30 E 0,55)': Number(totals.custo.toFixed(3)),
        'OBS': '',
      },
    ];
  }, [layoutRows]);

  const formTotals = useMemo(() => {
    return formRows.reduce(
      (acc, row) => {
        const qtd = Number(row.qtd || 0);
        return {
          qtd: acc.qtd + qtd,
          custo: acc.custo + calcCusto(qtd),
        };
      },
      { qtd: 0, custo: 0 }
    );
  }, [formRows]);

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
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Rateio Fatura MKM</h1>
          <p className="mt-1 text-xs sm:text-sm text-primary-600">
            {COMPETENCIA_LABEL}
          </p>
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
                <option value="">Nenhuma competencia</option>
              )}
              {competenciaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
                  Editar Rateio
                </button>
              )}
              <button
                onClick={() => openForm('create')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Novo Rateio
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
        {layoutLoading ? (
          <div className="flex items-center justify-center min-h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : !hasData ? (
          <div className="text-center py-12">
            <p className="text-sm text-neutral-500">Nenhum rateio encontrado para esta competencia.</p>
            {isAdmin() && (
              <button
                onClick={() => openForm('create')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Criar rateio
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-200">
                  <th className="py-2 pr-4">Centro de custo</th>
                  <th className="py-2 pr-4">QTD SMS</th>
                  <th className="py-2 pr-4">CUSTOS SMS (R$ 0,45)</th>
                  <th className="py-2">OBS</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => {
                  const isTotal = row['Centro de custo'] === 'TOTAL FATURA';
                  return (
                    <tr
                      key={`${row['Centro de custo']}-${index}`}
                      className={`border-b border-neutral-100 last:border-b-0 ${isTotal ? 'font-semibold bg-neutral-50' : ''}`}
                    >
                      <td className="py-2 pr-4">{row['Centro de custo']}</td>
                      <td className="py-2 pr-4">{formatQtd(Number(row['QTD SMS/WABA ENVIADOS a 0,045'] || 0))}</td>
                      <td className="py-2 pr-4">{formatCusto(Number(row['CUSTOS SMS 0,045/WABA(0,30 E 0,55)'] || 0))}</td>
                      <td className="py-2">{row['OBS'] || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-neutral-200">
              <h2 className="text-base sm:text-lg font-semibold text-neutral-900">
                {formMode === 'edit' ? 'Editar Rateio MKM' : 'Novo Rateio MKM'}
              </h2>
              <button
                onClick={closeForm}
                className="text-neutral-400 hover:text-neutral-600"
                disabled={saving}
              >
                Fechar
              </button>
            </div>
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 flex-1">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="flex items-center gap-3">
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
              </div>

              <div className="w-full">
                <table className="w-full table-fixed text-[11px] sm:text-xs">
                  <thead>
                    <tr className="text-left text-neutral-500 border-b border-neutral-200">
                      <th className="py-2 pr-2 sm:pr-4 w-[26%]">Centro de custo</th>
                      <th className="py-2 pr-2 sm:pr-4 w-[22%] whitespace-normal break-words">
                        QTD SMS
                      </th>
                      <th className="py-2 pr-2 sm:pr-4 w-[26%] whitespace-normal break-words">
                        CUSTOS SMS (R$ 0,45)
                      </th>
                      <th className="py-2">OBS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formRows.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-100 last:border-b-0">
                        <td className="py-1 pr-2 sm:pr-4 font-medium text-neutral-900">{row.nome}</td>
                        <td className="py-1 pr-2 sm:pr-4">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatQtdInput(row.qtd)}
                            onChange={(event) => handleRowChange(row.id, 'qtd', event.target.value)}
                            className="w-full px-2 py-0.5 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          />
                        </td>
                        <td className="py-1 pr-2 sm:pr-4">
                          <div className="px-2 py-0.5 rounded-md bg-neutral-50 border border-neutral-200 text-neutral-700">
                            {formatCusto(calcCusto(row.qtd))}
                          </div>
                        </td>
                        <td className="py-1">
                          <input
                            type="text"
                            value={row.obs}
                            onChange={(event) => handleRowChange(row.id, 'obs', event.target.value)}
                            className="w-full px-2 py-0.5 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={saving}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-neutral-200 font-semibold bg-neutral-50">
                      <td className="py-1 pr-2 sm:pr-4">TOTAL</td>
                      <td className="py-1 pr-2 sm:pr-4">{formatQtd(formTotals.qtd)}</td>
                      <td className="py-1 pr-2 sm:pr-4">{formatCusto(Number(formTotals.custo.toFixed(3)))}</td>
                      <td className="py-1"></td>
                    </tr>
                  </tfoot>
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
                {saving ? 'Salvando...' : formMode === 'edit' ? 'Salvar edicao' : 'Salvar rateio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RateioMkm;
