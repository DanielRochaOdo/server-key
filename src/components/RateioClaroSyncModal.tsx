import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  X,
  Database,
  Table,
  ArrowRight,
  ArrowLeft,
  PlusCircle,
  Trash2,
  Pencil,
} from 'lucide-react';
import {
  applyRateioClaroSync,
  previewRateioClaroSync,
  RateioClaroSyncDiff,
  RateioClaroSyncError,
  RateioClaroSyncPreview,
} from '../services/rateioClaroSync';
import { useAuth } from '../contexts/AuthContext';

interface RateioClaroSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ValidationState = {
  duplicates: { numero: string; lines: number[] }[];
  invalid: { line: number; value: string }[];
  emptyNames: { line: number; numero: string }[];
};

type DiffView = RateioClaroSyncDiff;

type Summary = { criar: number; atualizar: number; ausentes: number };

const RateioClaroSyncModal: React.FC<RateioClaroSyncModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { isAdmin } = useAuth();
  const canEdit = isAdmin();
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [preview, setPreview] = useState<RateioClaroSyncPreview | null>(null);
  const [diffsView, setDiffsView] = useState<DiffView[]>([]);
  const [analysisError, setAnalysisError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [selectionMap, setSelectionMap] = useState<Record<string, 'PLANILHA' | 'HUB'>>({});
  const onMissingOption: 'INACTIVATE' = 'INACTIVATE';

  const resetState = () => {
    setValidation(null);
    setPreview(null);
    setDiffsView([]);
    setAnalysisError('');
    setLoadingPreview(false);
    setLoadingApply(false);
    setSelectionMap({});
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleAnalyze = useCallback(async () => {
    setAnalysisError('');
    setValidation(null);
    setPreview(null);
    setDiffsView([]);

    try {
      setLoadingPreview(true);
      const data = await previewRateioClaroSync();
      setPreview(data);
      setDiffsView(data.diffs);
      if (data.warnings?.nomesVazios?.length) {
        setValidation({
          duplicates: [],
          invalid: [],
          emptyNames: data.warnings.nomesVazios.map((item) => ({
            line: item.line ?? 0,
            numero: item.numero_da_linha,
          })),
        });
      }
    } catch (error: any) {
      if (error instanceof RateioClaroSyncError && error.details) {
        setValidation({
          duplicates: error.details.duplicates || [],
          invalid: error.details.invalidRows || [],
          emptyNames: (error.details.emptyNames || []).map((item) => ({
            line: item.line,
            numero: item.numero_da_linha,
          })),
        });
        if ((error.details.invalidRows?.length || 0) > 0 || (error.details.duplicates?.length || 0) > 0) {
          setAnalysisError('Corrija as linhas com erro na planilha antes de sincronizar.');
        } else {
          setAnalysisError(error.message || 'Falha ao analisar a planilha.');
        }
      } else {
        setAnalysisError(error?.message || 'Falha ao analisar a planilha.');
      }
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      handleAnalyze();
    }
  }, [isOpen, handleAnalyze]);

  const handleKeepHub = (diff: DiffView) => {
    setSelectionMap((prev) => ({ ...prev, [diff.numero_da_linha]: 'HUB' }));
  };

  const handleApplyRow = (diff: DiffView) => {
    setSelectionMap((prev) => ({ ...prev, [diff.numero_da_linha]: 'PLANILHA' }));
  };

  const summaryCards = useMemo(() => {
    if (!preview) return null;
    return [
      { label: 'Criar', value: preview.summary.criar, color: 'bg-emerald-50 text-emerald-700' },
      { label: 'Atualizar', value: preview.summary.atualizar, color: 'bg-amber-50 text-amber-700' },
      { label: 'Ausentes', value: preview.summary.ausentes, color: 'bg-rose-50 text-rose-700' },
    ];
  }, [preview]);

  const actionMeta = useMemo(
    () => ({
      CRIAR: { label: 'Adicionar', icon: PlusCircle, color: 'text-emerald-600' },
      ATUALIZAR: { label: 'Atualizar', icon: Pencil, color: 'text-amber-600' },
      AUSENTE_NA_PLANILHA: { label: 'Remover', icon: Trash2, color: 'text-rose-600' },
    }),
    []
  );

  useEffect(() => {
    if (!diffsView.length) {
      setSelectionMap({});
      return;
    }
    setSelectionMap({});
  }, [diffsView]);

  const selectedSummary = useMemo(() => {
    const summary: Summary = { criar: 0, atualizar: 0, ausentes: 0 };
    diffsView.forEach((diff) => {
      if (selectionMap[diff.numero_da_linha] !== 'PLANILHA') return;
      if (diff.tipo === 'CRIAR') summary.criar += 1;
      if (diff.tipo === 'ATUALIZAR') summary.atualizar += 1;
      if (diff.tipo === 'AUSENTE_NA_PLANILHA') summary.ausentes += 1;
    });
    return summary;
  }, [diffsView, selectionMap]);

  const visibleDiffs = useMemo(
    () => diffsView.filter((diff) => selectionMap[diff.numero_da_linha] !== 'HUB'),
    [diffsView, selectionMap]
  );

  const handleSave = async () => {
    if (loadingApply) return;
    setAnalysisError('');

    const selection = {
      criar: [] as string[],
      atualizar: [] as string[],
      ausentes: [] as string[],
      manter: [] as string[],
    };

    diffsView.forEach((diff) => {
      const choice = selectionMap[diff.numero_da_linha];
      if (!choice) return;
      if (choice === 'PLANILHA') {
        if (diff.tipo === 'CRIAR') selection.criar.push(diff.numero_da_linha);
        if (diff.tipo === 'ATUALIZAR') selection.atualizar.push(diff.numero_da_linha);
        if (diff.tipo === 'AUSENTE_NA_PLANILHA') selection.ausentes.push(diff.numero_da_linha);
      } else if (choice === 'HUB') {
        selection.manter.push(diff.numero_da_linha);
      }
    });

    if (
      !selection.criar.length &&
      !selection.atualizar.length &&
      !selection.ausentes.length &&
      !selection.manter.length
    ) {
      setAnalysisError('Selecione pelo menos uma acao para salvar.');
      return;
    }

    try {
      setLoadingApply(true);
      await applyRateioClaroSync(undefined, { onMissingInSheet: onMissingOption }, selection);
      await Promise.resolve(onSuccess());
      handleClose();
    } catch (error: any) {
      setAnalysisError(error?.message || 'Erro ao salvar a sincronizacao.');
    } finally {
      setLoadingApply(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm z-50">
      <div className="bg-white w-full h-full overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Sincronizar com Google Sheets</h2>
            <p className="text-xs text-neutral-500">Dados lidos direto da planilha configurada no servidor.</p>
          </div>
          <button onClick={handleClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-xs text-neutral-500">
              Clique em recarregar para buscar a planilha novamente.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleAnalyze}
                disabled={loadingPreview}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
              >
                <RefreshCw className="h-3 w-3" />
                {loadingPreview ? 'Carregando...' : 'Recarregar planilha'}
              </button>
              {canEdit && (
                <button
                  onClick={handleSave}
                  disabled={loadingApply}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {loadingApply ? 'Salvando...' : 'Salvar'}
                </button>
              )}
            </div>
          </div>

          {analysisError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>{analysisError}</span>
            </div>
          )}

          {validation?.invalid.length ? (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700">
              <div className="font-semibold">Linhas com numero da linha invalido</div>
              {validation.invalid.slice(0, 6).map((item) => (
                <div key={`${item.line}-${item.value}`}>Linha {item.line}: "{item.value || '-'}"</div>
              ))}
              {validation.invalid.length > 6 && (
                <div>+ {validation.invalid.length - 6} linhas com erro</div>
              )}
            </div>
          ) : null}

          {validation?.duplicates.length ? (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700">
              <div className="font-semibold">Duplicidade de numero da linha</div>
              {validation.duplicates.slice(0, 6).map((item) => (
                <div key={item.numero}>Numero {item.numero} nas linhas {item.lines.join(', ')}</div>
              ))}
              {validation.duplicates.length > 6 && (
                <div>+ {validation.duplicates.length - 6} numeros duplicados</div>
              )}
            </div>
          ) : null}

          {validation?.emptyNames.length ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
              <div className="font-semibold">Nomes vazios encontrados</div>
              <div>{validation.emptyNames.length} linha(s) com nome vazio. A sincronizacao ainda e permitida.</div>
            </div>
          ) : null}

          {!preview && loadingPreview && (
            <div className="text-center text-sm text-neutral-500 py-6">
              Carregando dados da planilha...
            </div>
          )}

          {summaryCards && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {summaryCards.map((card) => (
                <div key={card.label} className={`rounded-lg px-4 py-3 ${card.color}`}>
                  <div className="text-xs uppercase tracking-wide">{card.label}</div>
                  <div className="text-xl font-semibold">{card.value}</div>
                </div>
              ))}
            </div>
          )}

          {preview && (
            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-neutral-50 text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Diferencas encontradas ({visibleDiffs.length})
              </div>
              <div className="max-h-[360px] overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-white sticky top-0 shadow-sm">
                    <tr className="text-left text-neutral-500 border-b border-neutral-200">
                      <th className="px-4 py-2">Numero</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2">Planilha (Portal)</th>
                      <th className="px-4 py-2">HUB</th>
                      {canEdit && <th className="px-4 py-2">Acoes</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDiffs.map((diff) => (
                      <tr key={`${diff.tipo}-${diff.numero_da_linha}`} className="border-b border-neutral-100 last:border-b-0">
                        <td className="px-4 py-2 font-medium text-neutral-900">
                          {diff.numero_da_linha}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                              diff.tipo === 'CRIAR'
                                ? 'bg-emerald-100 text-emerald-700'
                                : diff.tipo === 'ATUALIZAR'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {diff.tipo.replace('_NA_PLANILHA', '').replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-neutral-700">
                          {diff.planilha?.nome ?? '-'}
                        </td>
                        <td className="px-4 py-2 text-neutral-700">
                          {diff.hub?.nome_completo ?? '-'}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-2 text-neutral-500">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => handleApplyRow(diff)}
                                aria-pressed={selectionMap[diff.numero_da_linha] === 'PLANILHA'}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-neutral-600 hover:bg-neutral-200 ${
                                  selectionMap[diff.numero_da_linha] === 'PLANILHA'
                                    ? 'bg-neutral-900 text-white shadow-sm'
                                    : 'bg-neutral-100'
                                }`}
                                title="Usar dados da planilha para substituir o HUB"
                              >
                                {selectionMap[diff.numero_da_linha] === 'PLANILHA' && (
                                  <CheckCircle className="h-3 w-3 text-white" />
                                )}
                                {React.createElement(actionMeta[diff.tipo].icon, {
                                  className: `h-3 w-3 ${actionMeta[diff.tipo].color}`,
                                })}
                                <Table className="h-3 w-3" />
                                <ArrowRight className="h-3 w-3" />
                                <Database className="h-3 w-3" />
                                <span>Planilha</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleKeepHub(diff)}
                                aria-pressed={selectionMap[diff.numero_da_linha] === 'HUB'}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-neutral-600 hover:bg-neutral-200 ${
                                  selectionMap[diff.numero_da_linha] === 'HUB'
                                    ? 'bg-neutral-900 text-white shadow-sm'
                                    : 'bg-neutral-100'
                                }`}
                                title="Manter dados do HUB (ignorar planilha)"
                              >
                                {selectionMap[diff.numero_da_linha] === 'HUB' && (
                                  <CheckCircle className="h-3 w-3 text-white" />
                                )}
                                <Database className="h-3 w-3" />
                                <ArrowLeft className="h-3 w-3" />
                                <Table className="h-3 w-3" />
                                <span>HUB</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview && (
            <div className="text-xs text-neutral-500">
              Acoes da planilha selecionadas: criar {selectedSummary.criar}, atualizar {selectedSummary.atualizar}, ausentes {selectedSummary.ausentes}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RateioClaroSyncModal;
