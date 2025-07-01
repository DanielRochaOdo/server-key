import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Key, Plus, Upload, Download, Search, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import AccessForm from '../components/AccessForm';
import FileUpload from '../components/FileUpload';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

interface Access {
  id: string;
  descricao: string;
  para_que_serve?: string;
  ip_url?: string;
  usuario_login?: string;
  senha?: string;
  observacao?: string;
  suporte_contato?: string;
  email?: string;
  data_pagamento?: string;
  created_at: string;
}

const Acessos: React.FC = () => {
  const [acessos, setAcessos] = useState<Access[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingAccess, setEditingAccess] = useState<Access | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingAccess, setViewingAccess] = useState<Access | null>(null);
  const { user } = useAuth();

  const itemsPerPage = 10;

  const fetchAcessos = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('acessos')
        .select('id, descricao, para_que_serve, ip_url, usuario_login, senha, observacao, suporte_contato, email, data_pagamento, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAcessos(data || []);
    } catch (error) {
      console.error('Error fetching acessos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAcessos();
  }, [fetchAcessos]);

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
    if (!confirm('Tem certeza que deseja excluir este acesso?')) return;

    try {
      const { error } = await supabase.from('acessos').delete().eq('id', id);
      if (error) throw error;
      setAcessos(prev => prev.filter((acesso) => acesso.id !== id));
    } catch (error) {
      console.error('Error deleting access:', error);
      alert('Erro ao excluir acesso');
    }
  }, []);

  const togglePasswordVisibility = useCallback((id: string) => {
    setVisiblePasswords(prev => {
      const newVisible = new Set(prev);
      if (newVisible.has(id)) {
        newVisible.delete(id);
      } else {
        newVisible.add(id);
      }
      return newVisible;
    });
  }, []);

  const exportData = useCallback((format: 'csv' | 'xlsx') => {
    const exportData = acessos.map(({ id, created_at, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Acessos');
    const filename = `acessos_${new Date().toISOString().slice(0,10)}.${format}`;
    
    if (format === 'csv') {
      XLSX.writeFile(wb, filename, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
    }
  }, [acessos]);


  const exportData = useCallback((format: 'csv' | 'xlsx') => {
    const exportData = acessos.map(({ id, created_at, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Acessos');
    const filename = `acessos_${new Date().toISOString().slice(0,10)}.${format}`;
    if (format === 'csv') {
      XLSX.writeFile(wb, filename, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
    }
  }, [acessos]);

  const filteredAcessosSorted = useMemo(() => {
    let filtered = acessos.filter((acesso) =>
      acesso.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acesso.ip_url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acesso.usuario_login?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortOrder === 'asc') {
      filtered.sort((a, b) => a.descricao.localeCompare(b.descricao));
    } else if (sortOrder === 'desc') {
      filtered.sort((a, b) => b.descricao.localeCompare(a.descricao));
    }

    return filtered;
  }, [acessos, searchTerm, sortOrder]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAcessosSorted.slice(start, start + itemsPerPage);
  }, [filteredAcessosSorted, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAcessosSorted.length / itemsPerPage);

  const handleFormSuccess = useCallback(() => {
    fetchAcessos();
    setShowForm(false);
    setEditingAccess(null);
  }, [fetchAcessos]);

  const handleUploadSuccess = useCallback(() => {
    fetchAcessos();
    setShowUpload(false);
  }, [fetchAcessos]);

  const handleEdit = useCallback((acesso: Access) => {
    setEditingAccess(acesso);
    setShowForm(true);
  }, []);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingAccess(null);
  }, []);

  const handleCancelUpload = useCallback(() => {
    setShowUpload(false);
  }, []);

  const handleView = useCallback((acesso: Access) => {
    setViewingAccess(acesso);
  }, []);

  const handleCloseView = useCallback(() => {
    setViewingAccess(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary-900">Acessos</h1>
            <p className="mt-2 text-primary-600">Gerenciamento de acessos aos sistemas da empresa</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center px-4 py-2 border border-button text-sm font-medium rounded-lg text-button bg-white hover:bg-button-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </button>
            <button
              onClick={() => {
                const format = prompt('Digite "csv" ou "xlsx" para exportar os dados:');
                if (format === 'csv' || format === 'xlsx') {
                  exportData(format);
                } else if (format) {
                  alert('Formato inválido. Use csv ou xlsx.');
                }
              }}
              className="inline-flex items-center px-4 py-2 border border-button text-sm font-medium rounded-lg text-button bg-white hover:bg-button-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Acesso
            </button>
          </div>
        </div>
      </div>

<div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-neutral-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar acessos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Key className="h-5 w-5 text-neutral-400" />
              <span className="text-sm text-neutral-600">{filteredAcessosSorted.length} acessos</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th 
                  onClick={toggleSortOrder} 
                  className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer select-none"
                >
                  <div className="flex items-center">
                    Descrição
                    <span className="ml-2">
                      {sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">IP/URL</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Senha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Data Pagamento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {currentItems.map((acesso) => (
                <tr key={acesso.id} className="hover:bg-neutral-50 transition-colors duration-150">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-neutral-900">{acesso.descricao}</div>
                    {acesso.para_que_serve && (
                      <div className="text-sm text-neutral-500 truncate max-w-xs">{acesso.para_que_serve}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {acesso.ip_url ? (
                      <a 
                        href={acesso.ip_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        title="Abrir link" 
                        className="inline-flex items-center text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="h-5 w-5" />
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">{acesso.usuario_login || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {acesso.senha && (
                      <div className="flex items-center space-x-2">
                        <span className="font-mono">
                          {visiblePasswords.has(acesso.id) ? acesso.senha : '••••••••'}
                        </span>
                        <button 
                          onClick={() => togglePasswordVisibility(acesso.id)} 
                          className="text-neutral-400 hover:text-neutral-600"
                        >
                          {visiblePasswords.has(acesso.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">{acesso.email || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {acesso.data_pagamento && new Date(acesso.data_pagamento).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => handleView(acesso)}
                      className="text-neutral-600 hover:text-neutral-900 mr-2"
                      title="Visualizar"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleEdit(acesso)} 
                      className="text-primary-600 hover:text-primary-900 mr-2"
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(acesso.id)} 
                      className="text-red-600 hover:text-red-900"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAcessosSorted.length === 0 && (
            <div className="text-center py-12">
              <Key className="mx-auto h-12 w-12 text-neutral-400" />
              <h3 className="mt-2 text-sm font-medium text-neutral-900">Nenhum acesso encontrado</h3>
              <p className="mt-1 text-sm text-neutral-500">
                {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando um novo acesso'}
              </p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center p-4 border-t border-neutral-200">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded transition-colors ${
                currentPage === 1 
                  ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' 
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              ← Anterior
            </button>
            <span className="text-sm text-neutral-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded transition-colors ${
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
        <AccessForm
          access={editingAccess}
          onSuccess={handleFormSuccess}
          onCancel={handleCancelForm}
        />
      )}

      {showUpload && (
        <FileUpload
          onSuccess={handleUploadSuccess}
          onCancel={handleCancelUpload}
        />
      )}

      {viewingAccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-lg mx-4">
            <h2 className="text-xl font-bold mb-4">Detalhes do Acesso</h2>
            <div className="space-y-3 text-sm text-neutral-700">
              <div><strong>Descrição:</strong> {viewingAccess.descricao}</div>
              <div><strong>Para que serve:</strong> {viewingAccess.para_que_serve || '-'}</div>
              <div><strong>IP/URL:</strong> {viewingAccess.ip_url || '-'}</div>
              <div><strong>Usuário:</strong> {viewingAccess.usuario_login || '-'}</div>
              <div><strong>Senha:</strong> {viewingAccess.senha || '-'}</div>
              <div><strong>Email:</strong> {viewingAccess.email || '-'}</div>
              <div><strong>Data pagamento:</strong> {viewingAccess.data_pagamento ? new Date(viewingAccess.data_pagamento).toLocaleDateString('pt-BR') : '-'}</div>
              <div><strong>Observação:</strong> {viewingAccess.observacao || '-'}</div>
              <div><strong>Suporte contato:</strong> {viewingAccess.suporte_contato || '-'}</div>
            </div>
            <div className="mt-6 text-right">
              <button
                onClick={handleCloseView}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
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

export default Acessos;
