import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Globe, Plus, Upload, Download, Search, Edit, Trash2, DollarSign, Users, CheckCircle, XCircle } from 'lucide-react';
import RateioGoogleForm from '../components/RateioGoogleForm';
import RateioGoogleFileUpload from '../components/RateioGoogleFileUpload';
import DashboardStats from '../components/DashboardStats';
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

  const statusOptions = useMemo(() => {
    const statusList = rateios
      .map((rateio) => rateio.status?.trim() || '')
      .filter((status) => status !== '');
    return Array.from(new Set(statusList)).sort();
  }, [rateios]);

  const situacaoOptions = useMemo(() => {
    const situacaoList = rateios
      .map((rateio) => rateio.situacao?.trim() || '')
      .filter((situacao) => situacao !== '');
    return Array.from(new Set(situacaoList)).sort();
  }, [rateios]);

  const dominioOptions = useMemo(() => {
    const dominioList = rateios
      .map((rateio) => {
        if (!rateio.email) return '';
        const emailParts = rateio.email.split('@');
        return emailParts.length > 1 ? emailParts[1].trim() : '';
      })
      .filter((dominio) => dominio !== '');
    return Array.from(new Set(dominioList)).sort();
  }, [rateios]);

  const filteredRateiosSorted = useMemo(() => {
    let filtered = rateios.filter((rateio) => {
      const matchesSearch =
        rateio.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rateio.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rateio.armazenamento?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = selectedStatus === '' || rateio.status === selectedStatus;
      const matchesSituacao = selectedSituacao === '' || rateio.situacao === selectedSituacao;
      
      const matchesDominio = selectedDominio === '' || (rateio.email && rateio.email.includes(`@${selectedDominio}`));

      return matchesSearch && matchesStatus && matchesSituacao && matchesDominio;
    });

    if (sortOrder === 'asc') {
      filtered.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    } else if (sortOrder === 'desc') {
      filtered.sort((a, b) => b.nome_completo.localeCompare(a.nome_completo));
    }

    return filtered;
  }, [rateios, searchTerm, selectedStatus, selectedSituacao, selectedDominio, sortOrder]);

  const exportData = useCallback((format: 'csv' | 'xlsx') => {
    if (format === 'template') {
      // Create template with headers only
      const templateData = [{
        nome_completo: '',
        email: '',
        status: '',
        ultimo_login: '',
        armazenamento: '',
        situacao: ''
      }];
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, 'template_rateio_google.xlsx', { bookType: 'xlsx' });
    } else {
      // Usar dados filtrados em vez de todos os dados
      const dataToExport = filteredRateiosSorted.map(({ id, created_at, ...rest }) => rest);
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'RateioGoogle');
      
      // Incluir informações sobre filtros no nome do arquivo
      const filterInfo = (searchTerm || selectedStatus || selectedSituacao || selectedDominio) ? `_filtrado` : '';
      const filename = `rateio_google${filterInfo}_${new Date().toISOString().slice(0,10)}.${format}`;
      
      if (format === 'csv') {
        XLSX.writeFile(wb, filename, { bookType: 'csv' });
      } else {
        XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
      }
    }
    setShowExportMenu(false);
  }, [filteredRateiosSorted, searchTerm, selectedStatus, selectedSituacao, selectedDominio]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRateiosSorted.slice(start, start + itemsPerPage);
  }, [filteredRateiosSorted, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRateiosSorted.length / itemsPerPage);

  const handleFormSuccess = useCallback(() => {
    fetchRateios();
    setShowForm(false);
    setEditingRateio(null);
  }, [fetchRateios]);

  const handleUploadSuccess = useCallback(() => {
    fetchRateios();
    setShowUpload(false);
  }, [fetchRateios]);

  const handleEdit = useCallback((rateio: RateioGoogle) => {
    setEditingRateio(rateio);
    setShowForm(true);
  }, []);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingRateio(null);
  }, []);

  const handleCancelUpload = useCallback(() => {
    setShowUpload(false);
  }, []);

  const handleView = useCallback((rateio: RateioGoogle) => {
    setViewingRateio(rateio);
  }, []);

  const handleCloseView = useCallback(() => {
    setViewingRateio(null);
  }, []);

  // Dashboard stats based on filtered data
  const dashboardStats = useMemo(() => {
    const domainStats = filteredRateiosSorted.reduce((acc, rateio) => {
      if (rateio.email) {
        const domain = rateio.email.split('@')[1];
        if (domain === 'odontoart.com') {
          acc.odontoart++;
        } else if (domain === 'odontoartonline.com.br') {
          acc.odontoartonline++;
        }
      }
      return acc;
    }, { odontoart: 0, odontoartonline: 0 });

    const situacaoStats = filteredRateiosSorted.reduce((acc, rateio) => {
      const situacao = rateio.situacao || 'Não definida';
      acc[situacao] = (acc[situacao] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalCostOdontoart = domainStats.odontoart * 7.587096774193548; // Valores aproximados em USD
    const totalCostOdontoartonline = domainStats.odontoartonline * 49; // R$49 BRL

    // Bloco baseado no filtro de situação selecionado
    const situacaoBlockTitle = selectedSituacao === '' ? 'Todos' : selectedSituacao;
    const situacaoBlockValue = selectedSituacao === '' 
      ? filteredRateiosSorted.length 
      : filteredRateiosSorted.filter(r => r.situacao === selectedSituacao).length;
    return [
      {
        title: 'E-mails @odontoart.com',
        value: domainStats.odontoart,
        icon: Globe,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        description: `Custo: $${totalCostOdontoart} USD`
      },
      {
        title: 'E-mails @odontoartonline.com.br',
        value: domainStats.odontoartonline,
        icon: Globe,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        description: `Custo: R$${totalCostOdontoartonline} BRL`
      },
      {
        title: situacaoBlockTitle,
        value: situacaoBlockValue,
        icon: Users,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        description: `${situacaoBlockValue} usuário${situacaoBlockValue !== 1 ? 's' : ''}`
      }
    ];
  }, [filteredRateiosSorted]);

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const statusColors: Record<string, string> = {
      'Ativo': 'bg-green-100 text-green-800',
      'Inativo': 'bg-red-100 text-red-800',
      'Suspenso': 'bg-yellow-100 text-yellow-800',
      'Bloqueado': 'bg-red-100 text-red-800',
      'Pendente': 'bg-blue-100 text-blue-800'
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
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Rateio Google</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-primary-600">Gerenciamento de usuários Google Workspace</p>
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
                Exportar ({filteredRateiosSorted.length})
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border border-neutral-200">
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs text-neutral-500 border-b border-neutral-100">
                      {(searchTerm || selectedStatus || selectedSituacao || selectedDominio) ? `Exportando ${filteredRateiosSorted.length} registros filtrados` : `Exportando todos os ${filteredRateiosSorted.length} registros`}
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
              Novo Usuário
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Stats */}
      <DashboardStats stats={dashboardStats} />

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
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

            {/* Linha 2: Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col space-y-1">
                <label htmlFor="filter-dominio" className="text-xs sm:text-sm font-medium text-neutral-700">
                  Domínio:
                </label>
                <select
                  id="filter-dominio"
                  className="border border-neutral-300 rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm"
                  value={selectedDominio}
                  onChange={(e) => setSelectedDominio(e.target.value)}
                >
                  <option value="">Todos</option>
                  {dominioOptions.map((dominio) => (
                    <option key={dominio} value={dominio}>
                      {dominio}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label htmlFor="filter-status" className="text-xs sm:text-sm font-medium text-neutral-700">
                  Status:
                </label>
                <select
                  id="filter-status"
                  className="border border-neutral-300 rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">Todos</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label htmlFor="filter-situacao" className="text-xs sm:text-sm font-medium text-neutral-700">
                  Situação:
                </label>
                <select
                  id="filter-situacao"
                  className="border border-neutral-300 rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm"
                  value={selectedSituacao}
                  onChange={(e) => setSelectedSituacao(e.target.value)}
                >
                  <option value="">Todas</option>
                  {situacaoOptions.map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {situacao}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
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
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Armazenamento</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {currentItems.map((rateio) => (
                <tr key={rateio.id} className="hover:bg-neutral-50 transition-colors duration-150">
                  <td className="px-3 sm:px-6 py-4">
                    <div className="text-xs sm:text-sm font-medium text-neutral-900 truncate max-w-[150px] sm:max-w-none">{rateio.nome_completo}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600 truncate max-w-[120px] sm:max-w-none">{rateio.email || '-'}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">
                    {getStatusBadge(rateio.status) || '-'}
                  </td>
                  <td className="hidden lg:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">{rateio.ultimo_login || '-'}</td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600 truncate max-w-[100px]">{rateio.armazenamento || '-'}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button 
                        onClick={() => handleView(rateio)}
                        className="text-neutral-600 hover:text-neutral-900"
                        title="Visualizar"
                      >
                        <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(rateio)} 
                        className="text-primary-600 hover:text-primary-900"
                        title="Editar"
                      >
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(rateio.id)} 
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

          {filteredRateiosSorted.length === 0 && (
            <div className="text-center py-8 sm:py-12">
              <Globe className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-neutral-400" />
              <h3 className="mt-2 text-sm font-medium text-neutral-900">Nenhum usuário encontrado</h3>
              <p className="mt-1 text-xs sm:text-sm text-neutral-500">
                {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando um novo usuário'}
              </p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center p-3 sm:p-4 border-t border-neutral-200">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-2 sm:px-3 py-1 rounded transition-colors text-xs sm:text-sm ${
                currentPage === 1 
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
              className={`px-2 sm:px-3 py-1 rounded transition-colors text-xs sm:text-sm ${
                currentPage === totalPages 
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
      {showForm && (
        <RateioGoogleForm
          rateio={editingRateio}
          onSuccess={handleFormSuccess}
          onCancel={handleCancelForm}
        />
      )}

      {showUpload && (
        <RateioGoogleFileUpload
          onSuccess={handleUploadSuccess}
          onCancel={handleCancelUpload}
        />
      )}

      {viewingRateio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-lg w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Detalhes do Usuário Google</h2>
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-neutral-700">
              <div><strong>Nome Completo:</strong> {viewingRateio.nome_completo}</div>
              <div><strong>Email:</strong> {viewingRateio.email || '-'}</div>
              <div><strong>Status:</strong> {viewingRateio.status || '-'}</div>
              <div><strong>Último Login:</strong> {viewingRateio.ultimo_login || '-'}</div>
              <div><strong>Armazenamento:</strong> {viewingRateio.armazenamento || '-'}</div>
              <div><strong>Situação:</strong> {viewingRateio.situacao || '-'}</div>
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
