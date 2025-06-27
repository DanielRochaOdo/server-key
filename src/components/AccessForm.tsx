import React, { useState, useEffect } from 'react';
import { Key, Plus, Upload, Search, Edit, Trash2, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import AccessForm from '../components/AccessForm';
import FileUpload from '../components/FileUpload';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  const { user } = useAuth();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  // PAGINAÇÃO
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchAcessos();
  }, []);

  const fetchAcessos = async () => {
    try {
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
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => {
      if (prev === 'asc') return 'desc';
      if (prev === 'desc') return null;
      return 'asc';
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este acesso?')) return;

    try {
      const { error } = await supabase
        .from('acessos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAcessos(acessos.filter(acesso => acesso.id !== id));
    } catch (error) {
      console.error('Error deleting access:', error);
      alert('Erro ao excluir acesso');
    }
  };

  const togglePasswordVisibility = (id: string) => {
    const newVisible = new Set(visiblePasswords);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisiblePasswords(newVisible);
  };

  const filteredAcessosSorted = React.useMemo(() => {
    let filtered = acessos.filter(acesso =>
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

  // PAGINAÇÃO: calcula os itens da página atual
  const totalPages = Math.ceil(filteredAcessosSorted.length / itemsPerPage);
  const currentItems = filteredAcessosSorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleFormSuccess = () => {
    fetchAcessos();
    setShowForm(false);
    setEditingAccess(null);
  };

  const handleUploadSuccess = () => {
    fetchAcessos();
    setShowUpload(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      {/* Cabeçalho, botões e filtros já existentes */}
      {/* ... (seu código permanece igual até a tabela) */}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th
                onClick={toggleSortOrder}
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer select-none flex items-center"
                title="Ordenar por descrição"
              >
                Descrição
                <span className="ml-2">
                  {sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '⇅'}
                </span>
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
            {currentItems.map(acesso => (
              <tr key={acesso.id} className="hover:bg-neutral-50 transition-colors duration-150">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-neutral-900">{acesso.descricao}</div>
                  {acesso.para_que_serve && (
                    <div className="text-sm text-neutral-500 truncate max-w-xs">{acesso.para_que_serve}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                  {acesso.ip_url ? (
                    <a href={acesso.ip_url} target="_blank" rel="noopener noreferrer" title="Abrir link" className="inline-flex items-center text-blue-600 hover:text-blue-800">
                      <Eye className="h-5 w-5" />
                    </a>
                  ) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">{acesso.usuario_login}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                  {acesso.senha && (
                    <div className="flex items-center space-x-2">
                      <span className="font-mono">
                        {visiblePasswords.has(acesso.id) ? acesso.senha : '••••••••'}
                      </span>
                      <button onClick={() => togglePasswordVisibility(acesso.id)} className="text-neutral-400 hover:text-neutral-600">
                        {visiblePasswords.has(acesso.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">{acesso.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                  {acesso.data_pagamento && new Date(acesso.data_pagamento).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button onClick={() => { setEditingAccess(acesso); setShowForm(true); }} className="text-primary-600 hover:text-primary-900 mr-4">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(acesso.id)} className="text-red-600 hover:text-red-900">
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

      {/* CONTROLES DE PAGINAÇÃO */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-4">
          {currentPage > 1 && (
            <button
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="inline-flex items-center px-3 py-1 border border-neutral-300 rounded hover:bg-neutral-100"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
          )}
          <span className="text-sm text-neutral-600">Página {currentPage} de {totalPages}</span>
          {currentPage < totalPages && (
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="inline-flex items-center px-3 py-1 border border-neutral-300 rounded hover:bg-neutral-100"
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Acessos;
