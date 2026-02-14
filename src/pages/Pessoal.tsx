import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Plus, Upload, Download, Search, Edit, Trash2, Eye, EyeOff, Database } from 'lucide-react';
import PessoalForm from '../components/PessoalForm';
import PessoalFileUpload from '../components/PessoalFileUpload';
import DashboardStats from '../components/DashboardStats';
import PasswordVerificationModal from '../components/PasswordVerificationModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePersistence } from '../contexts/PersistenceContext';
import * as XLSX from 'xlsx';
import { decryptPassword } from '../utils/encryption';

interface Pessoal {
  id: string;
  descricao: string;
  para_que_serve?: string;
  ip_url?: string;
  usuario_login?: string;
  senha?: string;
  observacao?: string;
  suporte_contato?: string;
  email?: string;
  dia_pagamento?: number;
  created_at: string;
}

const Pessoal: React.FC = () => {
  const [pessoais, setPessoais] = useState<Pessoal[]>([]);
  const [loading, setLoading] = useState(true);
  const { getState, setState, clearState } = usePersistence();
  
  const [showForm, setShowForm] = useState(() => getState('pessoal_showForm') || false);
  const [showUpload, setShowUpload] = useState(() => getState('pessoal_showUpload') || false);
  const [editingPessoal, setEditingPessoal] = useState<Pessoal | null>(() => getState('pessoal_editingPessoal') || null);
  const [searchTerm, setSearchTerm] = useState(() => getState('pessoal_searchTerm') || '');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingPessoal, setViewingPessoal] = useState<Pessoal | null>(() => getState('pessoal_viewingPessoal') || null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingPasswordReveal, setPendingPasswordReveal] = useState<string | null>(null);
  const [showActionPasswordModal, setShowActionPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [pendingActionPessoal, setPendingActionPessoal] = useState<Pessoal | null>(null);
  const { user } = useAuth();

  const itemsPerPage = 10;

  const fetchPessoais = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pessoal')
        .select('id, descricao, para_que_serve, ip_url, usuario_login, senha, observacao, suporte_contato, email, dia_pagamento, created_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPessoais(data || []);
    } catch (error) {
      console.error('Error fetching pessoal:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPessoais();
  }, [fetchPessoais]);

  // Persist form states
  useEffect(() => {
    setState('pessoal_showForm', showForm);
  }, [showForm, setState]);

  useEffect(() => {
    setState('pessoal_showUpload', showUpload);
  }, [showUpload, setState]);

  useEffect(() => {
    setState('pessoal_editingPessoal', editingPessoal);
  }, [editingPessoal, setState]);

  useEffect(() => {
    setState('pessoal_viewingPessoal', viewingPessoal);
  }, [viewingPessoal, setState]);

  useEffect(() => {
    setState('pessoal_searchTerm', searchTerm);
  }, [searchTerm, setState]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => {
      if (prev === 'asc') return 'desc';
      if (prev === 'desc') return null;
      return 'asc';
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item pessoal?')) return;

    try {
      const { error } = await supabase.from('pessoal').delete().eq('id', id);
      if (error) throw error;
      setPessoais(prev => prev.filter((pessoal) => pessoal.id !== id));
    } catch (error) {
      console.error('Error deleting pessoal:', error);
      alert('Erro ao excluir item pessoal');
    }
  }, []);

  const togglePasswordVisibility = useCallback((id: string) => {
    if (visiblePasswords.has(id)) {
      // Hide password - no authentication needed
      const newVisible = new Set(visiblePasswords);
      newVisible.delete(id);
      setVisiblePasswords(newVisible);
    } else {
      // Show password - require authentication
      setPendingPasswordReveal(id);
      setShowPasswordModal(true);
    }
  }, [visiblePasswords]);

  const handlePasswordVerified = () => {
    if (pendingPasswordReveal) {
      const newVisible = new Set(visiblePasswords);
      newVisible.add(pendingPasswordReveal);
      setVisiblePasswords(newVisible);
      setPendingPasswordReveal(null);
    }
  };

  const requestActionVerification = useCallback((action: 'view' | 'edit' | 'delete', pessoal: Pessoal) => {
    setPendingAction(action);
    setPendingActionPessoal(pessoal);
    setShowActionPasswordModal(true);
  }, []);

  const handleActionPasswordVerified = useCallback(async () => {
    if (!pendingAction || !pendingActionPessoal) return;
    const action = pendingAction;
    const pessoal = pendingActionPessoal;

    setShowActionPasswordModal(false);
    setPendingAction(null);
    setPendingActionPessoal(null);

    if (action === 'view') {
      setViewingPessoal(pessoal);
      return;
    }

    if (action === 'edit') {
      setEditingPessoal(pessoal);
      setShowForm(true);
      return;
    }

    await handleDelete(pessoal.id);
  }, [pendingAction, pendingActionPessoal, handleDelete]);

  const filteredPessoaisSorted = useMemo(() => {
    let filtered = pessoais.filter((pessoal) =>
      pessoal.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pessoal.ip_url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pessoal.usuario_login?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortOrder === 'asc') {
      filtered.sort((a, b) => a.descricao.localeCompare(b.descricao));
    } else if (sortOrder === 'desc') {
      filtered.sort((a, b) => b.descricao.localeCompare(a.descricao));
    }

    return filtered;
  }, [pessoais, searchTerm, sortOrder]);

  const exportData = useCallback((format: 'csv' | 'xlsx' | 'template') => {
    if (format === 'template') {
      const templateData = [{
        descricao: '',
        para_que_serve: '',
        ip_url: '',
        usuario_login: '',
        senha: '',
        observacao: '',
        suporte_contato: '',
        email: '',
        dia_pagamento: ''
      }];
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, 'template_pessoal.xlsx', { bookType: 'xlsx' });
    } else {
      const dataToExport = filteredPessoaisSorted.map(({ id, created_at, ...rest }) => rest);
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pessoal');
      
      const filterInfo = searchTerm ? `_filtrado` : '';
      const filename = `pessoal${filterInfo}_${new Date().toISOString().slice(0,10)}.${format}`;
      
      if (format === 'csv') {
        XLSX.writeFile(wb, filename, { bookType: 'csv' });
      } else {
        XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
      }
    }
    setShowExportMenu(false);
  }, [filteredPessoaisSorted, searchTerm]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPessoaisSorted.slice(start, start + itemsPerPage);
  }, [filteredPessoaisSorted, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPessoaisSorted.length / itemsPerPage);

  const handleFormSuccess = useCallback(() => {
    fetchPessoais();
    setShowForm(false);
    setEditingPessoal(null);
    clearState('pessoal_showForm');
    clearState('pessoal_editingPessoal');
  }, [fetchPessoais]);

  const handleUploadSuccess = useCallback(() => {
    fetchPessoais();
    setShowUpload(false);
    clearState('pessoal_showUpload');
  }, [fetchPessoais]);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingPessoal(null);
    clearState('pessoal_showForm');
    clearState('pessoal_editingPessoal');
  }, []);

  const handleCancelUpload = useCallback(() => {
    setShowUpload(false);
    clearState('pessoal_showUpload');
  }, []);

  const handleCloseView = useCallback(() => {
    setViewingPessoal(null);
    clearState('pessoal_viewingPessoal');
  }, []);

  // Dashboard stats based on filtered data
  const dashboardStats = useMemo(() => {
    return [{
      title: 'Total Pessoal',
      value: filteredPessoaisSorted.length,
      icon: Database,
      color: 'text-primary-600',
      bgColor: 'bg-primary-100',
      description: `${filteredPessoaisSorted.length} item${filteredPessoaisSorted.length !== 1 ? 's' : ''} pessoal${filteredPessoaisSorted.length !== 1 ? 'is' : ''}`
    }];
  }, [filteredPessoaisSorted]);

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
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Pessoal</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-primary-600">Seus dados pessoais e privados</p>
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
                Exportar ({filteredPessoaisSorted.length})
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border border-neutral-200">
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs text-neutral-500 border-b border-neutral-100">
                      {searchTerm ? `Exportando ${filteredPessoaisSorted.length} registros filtrados` : `Exportando todos os ${filteredPessoaisSorted.length} registros`}
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
              Novo Item
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Stats */}
      <DashboardStats stats={dashboardStats} />

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-neutral-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar itens pessoais..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
              />
            </div>
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
              <span className="text-xs sm:text-sm text-neutral-600">{filteredPessoaisSorted.length} itens</span>
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
                    Descrição
                    <span className="ml-1 sm:ml-2">
                      {sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">IP/URL</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Usuário</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Senha</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Email</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {currentItems.map((pessoal) => (
                <tr key={pessoal.id} className="hover:bg-neutral-50 transition-colors duration-150">
                  <td className="px-3 sm:px-6 py-4">
                    <div className="text-xs sm:text-sm font-medium text-neutral-900 truncate max-w-[150px] sm:max-w-none">{pessoal.descricao}</div>
                    {pessoal.para_que_serve && (
                      <div className="text-xs text-neutral-500 truncate max-w-[150px] sm:max-w-xs">{pessoal.para_que_serve}</div>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">
                    {pessoal.ip_url ? (
                      <a 
                        href={pessoal.ip_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        title="Abrir link" 
                        className="inline-flex items-center text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600 truncate max-w-[100px] sm:max-w-none">{pessoal.usuario_login || '-'}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">
                    {pessoal.senha ? (
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        {visiblePasswords.has(pessoal.id) ? (
                          <span className="font-mono text-xs sm:text-sm text-green-600">
                            {decryptPassword(pessoal.senha || '')}
                          </span>
                        ) : (
                          <span className="font-mono text-xs sm:text-sm">••••••••</span>
                        )}
                        <button 
                          onClick={() => togglePasswordVisibility(pessoal.id)} 
                          className="text-neutral-400 hover:text-neutral-600"
                        >
                          {visiblePasswords.has(pessoal.id) ? (
                            <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" />
                          ) : (
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400 italic">Sem senha</span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600 truncate max-w-[150px]">{pessoal.email || '-'}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button
                        onClick={() => requestActionVerification('view', pessoal)}
                        className="text-neutral-600 hover:text-neutral-900"
                        title="Visualizar"
                      >
                        <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button 
                        onClick={() => requestActionVerification('edit', pessoal)} 
                        className="text-primary-600 hover:text-primary-900"
                        title="Editar"
                      >
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button 
                        onClick={() => requestActionVerification('delete', pessoal)} 
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

          {filteredPessoaisSorted.length === 0 && (
            <div className="text-center py-8 sm:py-12">
              <User className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-neutral-400" />
              <h3 className="mt-2 text-sm font-medium text-neutral-900">Nenhum item pessoal encontrado</h3>
              <p className="mt-1 text-xs sm:text-sm text-neutral-500">
                {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando um novo item pessoal'}
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
        <PessoalForm
          pessoal={editingPessoal}
          onSuccess={handleFormSuccess}
          onCancel={handleCancelForm}
        />
      )}

      {showUpload && (
        <PessoalFileUpload
          onSuccess={handleUploadSuccess}
          onCancel={handleCancelUpload}
        />
      )}

      {viewingPessoal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Detalhes do Item Pessoal</h2>
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-neutral-700">
              <div><strong>Descrição:</strong> {viewingPessoal.descricao}</div>
              <div><strong>Para que serve:</strong> {viewingPessoal.para_que_serve || '-'}</div>
              <div><strong>IP/URL:</strong> {viewingPessoal.ip_url || '-'}</div>
              <div><strong>Usuário:</strong> {viewingPessoal.usuario_login || '-'}</div>
              <div><strong>Senha:</strong> {viewingPessoal.senha ? decryptPassword(viewingPessoal.senha || '') : '-'}</div>
              <div><strong>Email:</strong> {viewingPessoal.email || '-'}</div>
              <div><strong>Dia de Pagamento:</strong> {viewingPessoal.dia_pagamento ? `Dia ${viewingPessoal.dia_pagamento}` : '-'}</div>
              <div><strong>Observação:</strong> {viewingPessoal.observacao || '-'}</div>
              <div><strong>Suporte contato:</strong> {viewingPessoal.suporte_contato || '-'}</div>
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
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingPasswordReveal(null);
        }}
        onSuccess={handlePasswordVerified}
        title="Verificação de Senha"
        message="Digite sua senha para visualizar a senha do item:"
      />

      <PasswordVerificationModal
        isOpen={showActionPasswordModal}
        onClose={() => {
          setShowActionPasswordModal(false);
          setPendingAction(null);
          setPendingActionPessoal(null);
        }}
        onSuccess={handleActionPasswordVerified}
        title="Verificacao de Senha"
        message={
          pendingAction === 'edit'
            ? "Digite sua senha para editar este item pessoal:"
            : pendingAction === 'delete'
              ? "Digite sua senha para excluir este item pessoal:"
              : "Digite sua senha para visualizar os detalhes do item:"
        }
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

export default Pessoal;


