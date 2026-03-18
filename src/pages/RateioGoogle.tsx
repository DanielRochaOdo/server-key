import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Globe, Download, Search, Users, Copy } from 'lucide-react';
import DashboardStats from '../components/DashboardStats';
import PasswordVerificationModal from '../components/PasswordVerificationModal';
import ModuleHeader from '../components/ModuleHeader';
import { supabase } from '../lib/supabase';
import { usePersistence } from '../contexts/PersistenceContext';

interface RateioGoogle {
  id: string;
  nome_completo: string;
  email?: string;
  status?: string;
  ultimo_login?: string;
  created_at: string;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const RateioGoogle: React.FC = () => {
  const [rateios, setRateios] = useState<RateioGoogle[]>([]);
  const [loading, setLoading] = useState(true);
  const { getState, setState, clearState } = usePersistence();

  const [searchTerm, setSearchTerm] = useState(() => getState('rateioGoogle_searchTerm') || '');
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'odontoart' | 'odontoartonline'>(
    () => getState('rateioGoogle_selectedMetric') || 'all'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingRateio, setViewingRateio] = useState<RateioGoogle | null>(() => getState('rateioGoogle_viewingRateio') || null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');
  const exportStartRef = useRef<number | null>(null);
  const exportHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showActionPasswordModal, setShowActionPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'view' | null>(null);
  const [pendingActionRateio, setPendingActionRateio] = useState<RateioGoogle | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsPerPage = 10;

  const fetchRateios = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('google_workspace_accounts')
        .select('id, full_name, primary_email, suspended, deleted, last_login_at, created_at')
        .order('primary_email', { ascending: true });

      if (error) throw error;
      const mapped = (data || []).map((row: any) => {
        const isDeleted = Boolean(row.deleted);
        const isSuspended = Boolean(row.suspended);
        const status = isDeleted ? 'Excluído' : isSuspended ? 'Suspenso' : 'Ativo';
        return {
          id: row.id,
          nome_completo: row.full_name || '-',
          email: row.primary_email || '-',
          status,
          ultimo_login: formatDateTime(row.last_login_at),
          created_at: row.created_at || new Date().toISOString(),
        } as RateioGoogle;
      });
      setRateios(mapped);
    } catch (error) {
      console.error('Error fetching rateio google:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRateios();
  }, [fetchRateios]);

  useEffect(() => {
    setState('rateioGoogle_viewingRateio', viewingRateio);
  }, [viewingRateio, setState]);

  useEffect(() => {
    setState('rateioGoogle_searchTerm', searchTerm);
  }, [searchTerm, setState]);

  useEffect(() => {
    setState('rateioGoogle_selectedMetric', selectedMetric);
  }, [selectedMetric, setState]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMetric]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => {
      if (prev === 'asc') return 'desc';
      if (prev === 'desc') return null;
      return 'asc';
    });
  }, []);

  const requestActionVerification = useCallback((action: 'view', rateio: RateioGoogle) => {
    setPendingAction(action);
    setPendingActionRateio(rateio);
    setShowActionPasswordModal(true);
  }, []);

  const copyText = useCallback(async (value?: string, key?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }
    if (!key) return;
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    setCopiedKey(key);
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 800);
  }, []);

  const handleActionPasswordVerified = useCallback(async () => {
    if (!pendingAction || !pendingActionRateio) return;
    const action = pendingAction;
    const rateio = pendingActionRateio;

    setShowActionPasswordModal(false);
    setPendingAction(null);
    setPendingActionRateio(null);

    if (action === 'view') {
      setViewingRateio(rateio);
      return;
    }

  }, [pendingAction, pendingActionRateio]);

  const filteredRateiosSorted = useMemo(() => {
    let filtered = rateios.filter((rateio) => {
      const matchesSearch =
        rateio.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rateio.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        false;
      const email = (rateio.email || '').toLowerCase();
      const matchesMetric =
        selectedMetric === 'all' ||
        (selectedMetric === 'odontoart' && email.endsWith('@odontoart.com')) ||
        (selectedMetric === 'odontoartonline' && email.endsWith('@odontoartonline.com.br'));
      return matchesSearch && matchesMetric;
    });

    if (sortOrder === 'asc') {
      filtered.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    } else if (sortOrder === 'desc') {
      filtered.sort((a, b) => b.nome_completo.localeCompare(a.nome_completo));
    }

    return filtered;
  }, [rateios, searchTerm, selectedMetric, sortOrder]);

  const exportData = useCallback(async (format: 'csv' | 'xlsx') => {
    try {
      if (exporting) return;
      const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (exportHideTimeoutRef.current) {
        clearTimeout(exportHideTimeoutRef.current);
        exportHideTimeoutRef.current = null;
      }
      setExporting(true);
      setExportProgress(0);
      setExportStage('Iniciando exportacao...');
      exportStartRef.current = Date.now();
      setShowExportMenu(false);
      await yieldToUi();

      const XLSXModule: any = await import('xlsx');
      const candidates = [
        XLSXModule,
        XLSXModule?.default,
        XLSXModule?.XLSX,
        XLSXModule?.default?.XLSX,
        (globalThis as any)?.XLSX,
      ];
      const XLSX = candidates.find(
        (candidate) =>
          candidate?.utils?.json_to_sheet &&
          candidate?.utils?.book_new &&
          candidate?.utils?.book_append_sheet &&
          candidate?.writeFile
      );

      setExportProgress(20);
      setExportStage('Carregando biblioteca...');
      await yieldToUi();

      const tryExport = async (XLSXInstance: any) => {
        if (!XLSXInstance) {
          console.error('XLSX module shape:', {
            bundleKeys: XLSXModule ? Object.keys(XLSXModule) : null,
            hasGlobalXLSX: Boolean((globalThis as any)?.XLSX),
          });
          throw new Error('Biblioteca de exportacao indisponivel.');
        }

        setExportProgress(45);
        setExportStage('Preparando dados...');
        await yieldToUi();

        const dataToExport = filteredRateiosSorted.map(({ id, created_at, ...rest }) => rest);
        const ws = XLSXInstance.utils.json_to_sheet(dataToExport);
        const wb = XLSXInstance.utils.book_new();
        XLSXInstance.utils.book_append_sheet(wb, ws, 'RateioGoogle');

        setExportProgress(75);
        setExportStage('Gerando planilha...');
        await yieldToUi();

        const filterInfo = (searchTerm || selectedMetric !== 'all') ? `_filtrado` : '';
        const filename = `rateio_google${filterInfo}_${new Date().toISOString().slice(0, 10)}.${format}`;

        setExportProgress(90);
        setExportStage('Salvando arquivo...');
        await yieldToUi();

        if (format === 'csv') {
          XLSXInstance.writeFile(wb, filename, { bookType: 'csv' });
        } else {
          XLSXInstance.writeFile(wb, filename, { bookType: 'xlsx' });
        }
      };

      await tryExport(XLSX);

      setExportProgress(100);
      setExportStage('Concluido.');
      const startedAt = exportStartRef.current ?? Date.now();
      const elapsed = Date.now() - startedAt;
      const minVisibleMs = 1500;
      const remaining = Math.max(minVisibleMs - elapsed, 300);
      exportHideTimeoutRef.current = setTimeout(() => {
        setExporting(false);
        setExportProgress(0);
        setExportStage('');
        exportStartRef.current = null;
        exportHideTimeoutRef.current = null;
      }, remaining);
    } catch (error) {
      console.error('Erro ao exportar rateio google:', error);
      alert('Nao foi possivel exportar agora. Tente novamente.');
      setExportStage('Falha ao exportar.');
      setExportProgress(0);
      const startedAt = exportStartRef.current ?? Date.now();
      const elapsed = Date.now() - startedAt;
      const minVisibleMs = 1500;
      const remaining = Math.max(minVisibleMs - elapsed, 300);
      exportHideTimeoutRef.current = setTimeout(() => {
        setExporting(false);
        setExportProgress(0);
        setExportStage('');
        exportStartRef.current = null;
        exportHideTimeoutRef.current = null;
      }, remaining);
    }
  }, [exporting, filteredRateiosSorted, searchTerm, selectedMetric]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRateiosSorted.slice(start, start + itemsPerPage);
  }, [filteredRateiosSorted, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRateiosSorted.length / itemsPerPage);

  const handleCloseView = useCallback(() => {
    setViewingRateio(null);
    clearState('rateioGoogle_viewingRateio');
  }, []);

  const searchedRateios = useMemo(() => {
    return rateios.filter((rateio) => (
      rateio.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rateio.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false
    ));
  }, [rateios, searchTerm]);

  // Dashboard stats based on searched data
  const dashboardStats = useMemo(() => {
    const domainStats = searchedRateios.reduce((acc, rateio) => {
      if (rateio.email) {
        const domain = rateio.email.split('@')[1]?.toLowerCase();
        if (domain === 'odontoart.com') {
          acc.odontoart++;
        } else if (domain === 'odontoartonline.com.br') {
          acc.odontoartonline++;
        }
      }
      return acc;
    }, { odontoart: 0, odontoartonline: 0 });

    const totalCostOdontoart = domainStats.odontoart * 7.587096774193548;
    const totalCostOdontoartonline = domainStats.odontoartonline * 42.46666666666667;
    const totalCostOdontoartFormatado = totalCostOdontoart.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
    const totalCostOdontoartonlineFormatado = totalCostOdontoartonline.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    const totalEmails = searchedRateios.length;

    return [
      {
        title: '@odontoart.com',
        value: domainStats.odontoart,
        icon: Globe,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        description: `Custo: ${totalCostOdontoartFormatado}`,
        onClick: () => setSelectedMetric((prev) => (prev === 'odontoart' ? 'all' : 'odontoart')),
        className: selectedMetric === 'odontoart' ? 'ring-2 ring-blue-300' : undefined,
      },
      {
        title: '@odontoartonline.com.br',
        value: domainStats.odontoartonline,
        icon: Globe,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        description: `Custo: ${totalCostOdontoartonlineFormatado}`,
        titleClassName: 'text-[7px] sm:text-[8px] tracking-[0.14em] whitespace-nowrap pr-2 sm:pr-3',
        onClick: () => setSelectedMetric((prev) => (prev === 'odontoartonline' ? 'all' : 'odontoartonline')),
        className: selectedMetric === 'odontoartonline' ? 'ring-2 ring-green-300' : undefined,
      },
      {
        title: 'Todos',
        value: totalEmails,
        icon: Users,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        description: `${totalEmails} usuario${totalEmails !== 1 ? 's' : ''}`,
        onClick: () => setSelectedMetric('all'),
        className: selectedMetric === 'all' ? 'ring-2 ring-purple-300' : undefined,
      }
    ];
  }, [searchedRateios, selectedMetric]);

  const getStatusBadge = (status?: string) => {
    if (!status) return null;

    const statusColors: Record<string, string> = {
      'Ativo': 'bg-green-100 text-green-800',
      'Suspenso': 'bg-yellow-100 text-yellow-800',
      'Excluído': 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <ModuleHeader
        sectionLabel="Financeiro"
        title="Rateio Google"
        subtitle="Gerenciamento de usuários Google Workspace"
        actions={(
          <div className="flex flex-wrap items-start gap-2">
            <div className="relative flex flex-col items-start">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exporting}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors sm:w-auto ${
                  exporting
                    ? 'cursor-not-allowed border-neutral-300 bg-neutral-200 text-neutral-500'
                    : 'border-button bg-neutral-200 text-button hover:bg-button-50'
                }`}
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                {exporting ? 'Exportando...' : `Exportar (${filteredRateiosSorted.length})`}
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-neutral-200 rounded-md shadow-lg z-10 border border-neutral-200">
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs text-neutral-500 border-b border-neutral-100">
                      {(searchTerm || selectedMetric !== 'all') ? `Exportando ${filteredRateiosSorted.length} registros filtrados` : `Exportando todos os ${filteredRateiosSorted.length} registros`}
                    </div>
                    <button
                      onClick={() => exportData('csv')}
                      className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-200"
                    >
                      Exportar como CSV
                    </button>
                    <button
                      onClick={() => exportData('xlsx')}
                      className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-200"
                    >
                      Exportar como XLSX
                    </button>
                  </div>
                </div>
              )}
              {exporting && (
                <div className="mt-2 w-full min-w-[180px] rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span>{exportStage || 'Exportando...'}</span>
                    <span>{exportProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-blue-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      />

      {/* Dashboard Stats */}
      <DashboardStats stats={dashboardStats} />

      <div className="bg-neutral-200 rounded-xl shadow-md overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-neutral-200">
          <div className="flex flex-col space-y-4">
            {/* Linha 1: Busca */}
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar usuários..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
                <span className="text-xs sm:text-sm text-neutral-600">{filteredRateiosSorted.length} usuários</span>
              </div>
            </div>

            <div className="text-xs text-neutral-500">
              Clique em um bloco acima para filtrar os e-mails contabilizados.
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-200">
              <tr>
                <th
                  onClick={toggleSortOrder}
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer select-none"
                >
                  <div className="flex items-center">
                    Nome Completo
                    <span className="ml-1 sm:ml-2">
                      {sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Email</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="hidden lg:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Último Login</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-neutral-200 divide-y divide-neutral-200">
              {currentItems.map((rateio) => (
                <tr key={rateio.id} className="hover:bg-neutral-200 transition-colors duration-150">
                  <td className="px-3 sm:px-6 py-4">
                    <div className="text-xs sm:text-sm font-medium text-neutral-900 truncate max-w-[150px] sm:max-w-none">{rateio.nome_completo}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate max-w-[120px] sm:max-w-none">{rateio.email || '-'}</span>
                      {rateio.email && rateio.email !== '-' && (
                        <button
                          type="button"
                          onClick={() => copyText(rateio.email, `rateio-google-email-${rateio.id}`)}
                          className={`text-neutral-400 hover:text-neutral-600 transition-transform ${
                            copiedKey === `rateio-google-email-${rateio.id}` ? 'text-emerald-500 scale-110 animate-pulse' : ''
                          }`}
                          title="Copiar email"
                        >
                          <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">
                    {getStatusBadge(rateio.status) || '-'}
                  </td>
                  <td className="hidden lg:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">{rateio.ultimo_login || '-'}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button
                        onClick={() => requestActionVerification('view', rateio)}
                        className="text-neutral-600 hover:text-neutral-900"
                        title="Visualizar"
                      >
                        <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRateiosSorted.length === 0 && (
            <div className="text-center py-8 sm:py-12">
              <Globe className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-neutral-400" />
              <h3 className="mt-2 text-sm font-medium text-neutral-900">Nenhum usuário encontrado</h3>
              <p className="mt-1 text-xs sm:text-sm text-neutral-500">
                {searchTerm ? 'Tente ajustar sua busca' : 'Nenhum usuário sincronizado no momento'}
              </p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center p-3 sm:p-4 border-t border-neutral-200">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-2 sm:px-3 py-1 rounded transition-colors text-xs sm:text-sm ${currentPage === 1
                  ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
            >
              ← Anterior
            </button>
            <span className="text-xs sm:text-sm text-neutral-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-2 sm:px-3 py-1 rounded transition-colors text-xs sm:text-sm ${currentPage === totalPages
                  ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
            >
              Próxima →
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {viewingRateio && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-200 rounded-2xl border border-neutral-200 p-4 sm:p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Detalhes do Usuário Google</h2>
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-neutral-700">
              <div><strong>Nome Completo:</strong> {viewingRateio.nome_completo}</div>
              <div><strong>Email:</strong> {viewingRateio.email || '-'}</div>
              <div><strong>Status:</strong> {viewingRateio.status || '-'}</div>
              <div><strong>Último Login:</strong> {viewingRateio.ultimo_login || '-'}</div>
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
          setPendingActionRateio(null);
        }}
        onSuccess={handleActionPasswordVerified}
        title="Verificacao de Senha"
        message="Digite sua senha para visualizar os detalhes do usuario:"
      />

      {/* Overlay para fechar menu de exportação */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
};

export default RateioGoogle;


