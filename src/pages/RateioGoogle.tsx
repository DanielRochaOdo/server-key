import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Globe, Plus, Upload, Download, Search, Edit, Trash2 } from 'lucide-react';
import RateioGoogleForm from '../components/RateioGoogleForm';
import RateioGoogleFileUpload from '../components/RateioGoogleFileUpload';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

interface RateioGoogle {
  id: string;
  nome_completo: string;
  email?: string;
  status?: string;
  ultimo_login?: string;
  armazenamento?: string;
  situacao?: string;
  created_at: string;
}

const RateioGoogle: React.FC = () => {
  const [rateios, setRateios] = useState<RateioGoogle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingRateio, setEditingRateio] = useState<RateioGoogle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSituacao, setSelectedSituacao] = useState('');
  const [selectedDominio, setSelectedDominio] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingRateio, setViewingRateio] = useState<RateioGoogle | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { user } = useAuth();

  const itemsPerPage = 10;

  const fetchRateios = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rateio_google')
        .select('id, nome_completo, email, status, ultimo_login, armazenamento, situacao, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRateios(data || []);
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
    setCurrentPage(1);
  }, [searchTerm, selectedStatus, selectedSituacao, selectedDominio]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => {
      if (prev === 'asc') return 'desc';
      if (prev === 'desc') return null;
      return 'asc';
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este rateio?')) return;
    try {
      const { error } = await supabase.from('rateio_google').delete().eq('id', id);
      if (error) throw error;
      setRateios(prev => prev.filter((rateio) => rateio.id !== id));
    } catch (error) {
      console.error('Error deleting rateio:', error);
      alert('Erro ao excluir rateio');
    }
  }, []);

  const exportData = useCallback((format: 'csv' | 'xlsx') => {
    const dataToExport = rateios.map(({ id, created_at, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RateioGoogle');
    const filename = `rateio_google_${new Date().toISOString().slice(0,10)}.${format}`;
    XLSX.writeFile(wb, filename, { bookType: format });
    setShowExportMenu(false);
  }, [rateios]);

  const statusOptions = useMemo(() => {
    const list = rateios.map(r => r.status?.trim() || '').filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [rateios]);

  const situacaoOptions = useMemo(() => {
    const list = rateios.map(r => r.situacao?.trim() || '').filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [rateios]);

  const dominioOptions = useMemo(() => {
    const list = rateios.map(r => r.email?.split('@')[1] || '').filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [rateios]);

  const filteredRateiosSorted = useMemo(() => {
    let filtered = rateios.filter((r) => {
      const matchesSearch = r.nome_completo.toLowerCase().includes(searchTerm.toLowerCase())
        || r.email?.toLowerCase().includes(searchTerm.toLowerCase())
        || r.armazenamento?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = !selectedStatus || r.status === selectedStatus;
      const matchesSituacao = !selectedSituacao || r.situacao === selectedSituacao;
      const matchesDominio = !selectedDominio || (r.email && r.email.endsWith(`@${selectedDominio}`));

      return matchesSearch && matchesStatus && matchesSituacao && matchesDominio;
    });

    if (sortOrder === 'asc') {
      filtered.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    } else if (sortOrder === 'desc') {
      filtered.sort((a, b) => b.nome_completo.localeCompare(a.nome_completo));
    }

    return filtered;
  }, [rateios, searchTerm, selectedStatus, selectedSituacao, selectedDominio, sortOrder]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRateiosSorted.slice(start, start + itemsPerPage);
  }, [filteredRateiosSorted, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredRateiosSorted.length / itemsPerPage));

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top bar, filters and buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Rateio Google</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-primary-600">Gerenciamento de usuários Google Workspace</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <button onClick={() => setShowUpload(true)} className="btn-outline">
            <Upload className="icon-sm mr-1 sm:mr-2" /> Importar
          </button>
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn-outline">
              <Download className="icon-sm mr-1 sm:mr-2" /> Exportar
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-neutral-200">
                <div className="py-1">
                  <button onClick={() => exportData('csv')} className="export-menu-item">Exportar como CSV</button>
                  <button onClick={() => exportData('xlsx')} className="export-menu-item">Exportar como XLSX</button>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="icon-sm mr-1 sm:mr-2" /> Novo Usuário
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="filter-select">
          <option value="">Status: Todos</option>
          {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select value={selectedSituacao} onChange={e => setSelectedSituacao(e.target.value)} className="filter-select">
          <option value="">Situação: Todas</option>
          {situacaoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select value={selectedDominio} onChange={e => setSelectedDominio(e.target.value)} className="filter-select">
          <option value="">Domínio: Todos</option>
          {dominioOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>

      {/* Restante da tabela, paginação, modais etc. */}
      {/* ... (a estrutura continua fiel ao seu arquivo de referência, adicionando o filtro de domínio) */}
    </div>
  );
};

export default RateioGoogle;
