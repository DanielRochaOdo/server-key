import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Plus, Upload, Download, Search, Edit, Trash2, Eye, EyeOff, Database, Copy } from 'lucide-react';
import PessoalForm from '../components/PessoalForm';
import PessoalFileUpload from '../components/PessoalFileUpload';
import DashboardStats from '../components/DashboardStats';
import PasswordVerificationModal from '../components/PasswordVerificationModal';
import ModuleHeader from '../components/ModuleHeader';
import { supabase } from '../lib/supabase';
import { usePersistence } from '../contexts/PersistenceContext';
import { useClipboardCopy } from '../hooks/useClipboardCopy';
import { useProtectedVisibility } from '../hooks/useProtectedVisibility';
import { decryptPassword } from '../utils/encryption';
import { writeExportFile, writeTemplateFile } from '../utils/xlsxExport';

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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingPessoal, setViewingPessoal] = useState<Pessoal | null>(() => getState('pessoal_viewingPessoal') || null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showActionPasswordModal, setShowActionPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [pendingActionPessoal, setPendingActionPessoal] = useState<Pessoal | null>(null);
  const { copiedKey, copyText } = useClipboardCopy();
  const {
    visibleIds,
    showPasswordModal,
    toggleVisibility,
    handlePasswordVerified,
    closePasswordModal,
  } = useProtectedVisibility();
  const userId = user?.id || null;

  const itemsPerPage = 10;

  const fetchPessoais = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pessoal')
        .select('id, descricao, para_que_serve, ip_url, usuario_login, senha, observacao, suporte_contato, email, dia_pagamento, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPessoais(data || []);
    } catch (error) {
      console.error('Error fetching pessoal:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
    const filtered = pessoais.filter((pessoal) =>
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

  const exportData = useCallback(async (format: 'csv' | 'xlsx' | 'template') => {
    try {
      if (format === 'template') {
        await writeTemplateFile(
          [
            {
              descricao: '',
              para_que_serve: '',
              ip_url: '',
              usuario_login: '',
              senha: '',
              observacao: '',
              suporte_contato: '',
              email: '',
              dia_pagamento: '',
            },
          ],
          'Template',
          'template_pessoal.xlsx'
        );
      } else {
        const dataToExport = filteredPessoaisSorted.map((pessoal) => {
          const exportable = { ...pessoal } as Partial<Pessoal>;
          delete exportable.id;
          delete exportable.created_at;
          return exportable as Record<string, unknown>;
        });
        const filterInfo = searchTerm ? '_filtrado' : '';
        const filename = `pessoal${filterInfo}_${new Date().toISOString().slice(0, 10)}.${format}`;
        await writeExportFile(dataToExport, 'Pessoal', filename, format);
      }
      setShowExportMenu(false);
    } catch (error) {
      console.error('Erro ao exportar dados de pessoal:', error);
      alert('Nao foi possivel exportar agora. Tente novamente.');
    }
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
  }, [clearState, fetchPessoais]);

  const handleUploadSuccess = useCallback(() => {
    fetchPessoais();
    setShowUpload(false);
    clearState('pessoal_showUpload');
  }, [clearState, fetchPessoais]);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingPessoal(null);
    clearState('pessoal_showForm');
    clearState('pessoal_editingPessoal');
  }, [clearState]);

  const handleCancelUpload = useCallback(() => {
    setShowUpload(false);
    clearState('pessoal_showUpload');
  }, [clearState]);

  const handleCloseView = useCallback(() => {
    setViewingPessoal(null);
    clearState('pessoal_viewingPessoal');
  }, [clearState]);

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
      <ModuleHeader
        sectionLabel="Acessos"
        title="Pessoal"
        subtitle="Seus dados pessoais e privados"
        actions={(
          <>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-button bg-neutral-200 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-button transition-colors hover:bg-button-50 sm:w-auto"
            >
              <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
              Importar
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-button bg-neutral-200 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-button transition-colors hover:bg-button-50 sm:w-auto"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                Exportar ({filteredPessoaisSorted.length})
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-neutral-200 rounded-md shadow-lg z-50 border border-neutral-200">
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs text-neutral-500 border-b border-neutral-100">
                      {searchTerm ? `Exportando ${filteredPessoaisSorted.length} registros filtrados` : `Exportando todos os ${filteredPessoaisSorted.length} registros`}
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
                    <button
                      onClick={() => exportData('template')}
                      className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-200 border-t border-neutral-200"
                    >
                      Baixar Modelo
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-transparent bg-button px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-button-hover sm:w-auto"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
              Novo Item
            </button>
          </>
        )}
      />

      {/* Dashboard Stats */}
      <DashboardStats stats={dashboardStats} />

      <div className="bg-neutral-200 rounded-xl shadow-md overflow-hidden">
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
            <thead className="bg-neutral-200">
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
            <tbody className="bg-neutral-200 divide-y divide-neutral-200">
              {currentItems.map((pessoal) => (
                <tr key={pessoal.id} className="hover:bg-neutral-200 transition-colors duration-150">
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
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate max-w-[100px] sm:max-w-none">
                        {pessoal.usuario_login || '-'}
                      </span>
                        {pessoal.usuario_login && (
                          <button
                            type="button"
                            onClick={() => copyText(pessoal.usuario_login, `pessoal-user-${pessoal.id}`)}
                            className={`text-neutral-400 hover:text-neutral-600 transition-transform ${
                              copiedKey === `pessoal-user-${pessoal.id}` ? 'text-emerald-500 scale-110 animate-pulse' : ''
                            }`}
                            title="Copiar usuario"
                          >
                            <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">
                    {pessoal.senha ? (
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        {visibleIds.has(pessoal.id) ? (
                          <span className="font-mono text-xs sm:text-sm text-green-600">
                            {decryptPassword(pessoal.senha || '')}
                          </span>
                        ) : (
                          <span className="font-mono text-xs sm:text-sm">••••••••</span>
                        )}
                        {visibleIds.has(pessoal.id) && (
                          <button
                            type="button"
                            onClick={() => copyText(decryptPassword(pessoal.senha || ''), `pessoal-pass-${pessoal.id}`)}
                            className={`text-neutral-400 hover:text-neutral-600 transition-transform ${
                              copiedKey === `pessoal-pass-${pessoal.id}` ? 'text-emerald-500 scale-110 animate-pulse' : ''
                            }`}
                            title="Copiar senha"
                          >
                            <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleVisibility(pessoal.id)} 
                          className="text-neutral-400 hover:text-neutral-600"
                        >
                          {visibleIds.has(pessoal.id) ? (
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
          <div className="bg-neutral-200 rounded-2xl border border-neutral-200 p-4 sm:p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
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
        onClose={closePasswordModal}
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
          className="fixed inset-0 z-40" 
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
};

export default Pessoal;

