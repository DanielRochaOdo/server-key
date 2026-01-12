import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Plus, Upload, Download, Search, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle } from 'lucide-react';
import ContasAPagarForm from '../components/ContasAPagarForm';
import ContasAPagarFileUpload from '../components/ContasAPagarFileUpload';
import DashboardStats from '../components/DashboardStats';
import PasswordVerificationModal from '../components/PasswordVerificationModal';
import { supabase } from '../lib/supabase';
import { usePersistence } from '../contexts/PersistenceContext';
import * as XLSX from 'xlsx';

interface ContaAPagar {
  id: string;
  status_documento: string | null;
  fornecedor: string | null;
  descricao: string | null;
  valor: string | number | null;
  vencimento?: number | null;
  observacoes?: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  'Nao emitido',
  'Emitido pendente assinatura',
  'Enviado financeiro'
];

const ContasAPagar: React.FC = () => {
  const [contas, setContas] = useState<ContaAPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const { getState, setState, clearState } = usePersistence();

  const [showForm, setShowForm] = useState(() => getState('contasAPagar_showForm') || false);
  const [showUpload, setShowUpload] = useState(() => getState('contasAPagar_showUpload') || false);
  const [editingConta, setEditingConta] = useState<ContaAPagar | null>(() => getState('contasAPagar_editingConta') || null);
  const [searchTerm, setSearchTerm] = useState(() => getState('contasAPagar_searchTerm') || '');
  const [sortConfig, setSortConfig] = useState<{
    key: 'fornecedor' | 'status_documento' | 'valor' | 'vencimento' | null;
    direction: 'asc' | 'desc';
  }>({ key: 'vencimento', direction: 'asc' });
  const [viewingConta, setViewingConta] = useState<ContaAPagar | null>(() => getState('contasAPagar_viewingConta') || null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showActionPasswordModal, setShowActionPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [pendingActionConta, setPendingActionConta] = useState<ContaAPagar | null>(null);
  const [updatingStatusIds, setUpdatingStatusIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showNextWeekModal, setShowNextWeekModal] = useState(false);

  const fetchContas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contas_a_pagar')
        .select('id, status_documento, fornecedor, descricao, valor, vencimento, observacoes, created_at')
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
    if (!contas.length) return [];
    const now = new Date();
    const nextWeekStart = startOfWeekSunday(addDays(startOfDay(now), 7));
    const nextWeekEnd = addDays(nextWeekStart, 6);

    return contas.filter((conta) => {
      const day = getDayValue(conta.vencimento ?? null);
      if (!day) return false;
      const dueDate = getNextDueDate(day, now);
      return dueDate >= nextWeekStart && dueDate <= nextWeekEnd;
    });
  }, [contas]);

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
    let filtered = contas.filter((conta) =>
      (conta.fornecedor || '').toLowerCase().includes(term) ||
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
  }, [contas, searchTerm, sortConfig, statusFilter]);

  const exportData = useCallback((format: 'csv' | 'xlsx' | 'template') => {
    if (format === 'template') {
      const templateData = [{
        'STATUS DO DOCUMENTO': STATUS_OPTIONS[0],
        'FORNECEDOR': '',
        'Descricao': '',
        'Valor': '',
        'Vencimento': '',
        'Observacoes': ''
      }];
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, 'template_contas_a_pagar.xlsx', { bookType: 'xlsx' });
    } else {
      const dataToExport = filteredContasSorted.map((conta) => ({
        'STATUS DO DOCUMENTO': conta.status_documento || '',
        'FORNECEDOR': conta.fornecedor || '',
        'Descricao': conta.descricao || '',
        'Valor': conta.valor ?? '',
        'Vencimento': conta.vencimento ?? '',
        'Observacoes': conta.observacoes ?? ''
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ContasAPagar');

      const filterInfo = searchTerm ? '_filtrado' : '';
      const filename = `contas_a_pagar${filterInfo}_${new Date().toISOString().slice(0, 10)}.${format}`;

      if (format === 'csv') {
        XLSX.writeFile(wb, filename, { bookType: 'csv' });
      } else {
        XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
      }
    }
    setShowExportMenu(false);
  }, [filteredContasSorted, searchTerm]);

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
    const totalCount = contas.length;
    const naoEmitidoCount = contas.filter((conta) => conta.status_documento === 'Nao emitido').length;
    const pendenteCount = contas.filter((conta) => conta.status_documento === 'Emitido pendente assinatura').length;
    const enviadoCount = contas.filter((conta) => conta.status_documento === 'Enviado financeiro').length;
    const proximosCount = nextWeekEntries.length;

    return [
      {
        title: 'Total de Contas',
        value: totalCount,
        icon: FileText,
        color: 'text-primary-600',
        bgColor: 'bg-primary-100',
        description: `${totalCount} conta${totalCount !== 1 ? 's' : ''} cadastrada${totalCount !== 1 ? 's' : ''}`,
        onClick: () => setStatusFilter(null),
      },
      {
        title: 'Nao emitido',
        value: naoEmitidoCount,
        icon: FileText,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        description: `${naoEmitidoCount} pendente${naoEmitidoCount !== 1 ? 's' : ''}`,
        onClick: () => setStatusFilter('Nao emitido'),
      },
      {
        title: 'Pendente assinatura',
        value: pendenteCount,
        icon: FileText,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        description: `${pendenteCount} aguardando`,
        onClick: () => setStatusFilter('Emitido pendente assinatura'),
      },
      {
        title: 'Enviado financeiro',
        value: enviadoCount,
        icon: FileText,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        description: `${enviadoCount} enviado${enviadoCount !== 1 ? 's' : ''}`,
        onClick: () => setStatusFilter('Enviado financeiro'),
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
  }, [contas, nextWeekEntries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Contas a Pagar</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-primary-600">Controle de contas e documentos financeiros</p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-button text-xs sm:text-sm font-medium rounded-lg text-button bg-white hover:bg-button-50"
            >
              <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Importar
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
                      onClick={() => exportData('csv')}
                      className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                    >
                      Exportar como CSV
                    </button>
                    <button
                      onClick={() => exportData('xlsx')}
                      className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                    >
                      Exportar como XLSX
                    </button>
                    <button
                      onClick={() => exportData('template')}
                      className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 border-t border-neutral-200"
                    >
                      Baixar Modelo
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Nova Conta
            </button>
          </div>
        </div>
      </div>

      <DashboardStats
        stats={dashboardStats}
        layout="row"
        className="no-scrollbar"
        cardClassName="min-w-[220px]"
      />

      <div className="bg-white rounded-xl shadow-md overflow-hidden hide-scrollbar">
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
                <th
                  onClick={() => toggleSort('status_documento')}
                  className="px-2 py-2 text-left font-medium text-neutral-500 uppercase tracking-wider cursor-pointer select-none w-28"
                >
                  <div className="flex items-center">
                    Status
                    {getSortIcon('status_documento')}
                  </div>
                </th>
                <th className="px-2 py-2 text-left font-medium text-neutral-500 uppercase tracking-wider">Descricao</th>
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
                  className="hidden sm:table-cell px-2 py-2 text-left font-medium text-neutral-500 uppercase tracking-wider cursor-pointer select-none w-20"
                >
                  <div className="flex items-center">
                    Vencimento
                    {getSortIcon('vencimento')}
                  </div>
                </th>
                <th className="px-2 py-2 text-left font-medium text-neutral-500 uppercase tracking-wider w-28">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {currentItems.map((conta) => (
                <tr key={conta.id} className="group hover:bg-neutral-50 transition-colors duration-150">
                  <td className="px-2 py-2">
                    <div className="font-medium text-neutral-900 truncate max-w-[140px] sm:max-w-none">{conta.fornecedor || '-'}</div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-neutral-600">
                    <select
                      value={conta.status_documento || 'Nao emitido'}
                      onChange={(e) => handleStatusChange(conta.id, e.target.value)}
                      disabled={updatingStatusIds.has(conta.id)}
                      className={`border rounded-lg px-2 py-1 w-28 disabled:opacity-60 ${getStatusColorClasses(conta.status_documento || 'Nao emitido')}`}
                      aria-label="Status do documento"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <div className="text-neutral-600 truncate max-w-[160px] sm:max-w-none">{conta.descricao || '-'}</div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-neutral-600">{formatCurrency(conta.valor)}</td>
                  <td className="hidden sm:table-cell px-2 py-2 whitespace-nowrap text-neutral-600 w-20">
                    {formatDay(conta.vencimento)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap font-medium w-28">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button
                        onClick={() => requestActionVerification('view', conta)}
                        className="text-neutral-600 hover:text-neutral-900"
                        title="Visualizar"
                      >
                        <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        onClick={() => requestActionVerification('edit', conta)}
                        className="text-primary-600 hover:text-primary-900"
                        title="Editar"
                      >
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        onClick={() => requestActionVerification('delete', conta)}
                        className="text-red-600 hover:text-red-900"
                        title="Excluir"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
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

      </div>

      {showForm && (
        <ContasAPagarForm
          conta={editingConta}
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
              <div><strong>Fornecedor:</strong> {viewingConta.fornecedor || '-'}</div>
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
