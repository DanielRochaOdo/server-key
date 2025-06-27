import React, { useState, useEffect } from 'react';
import { Key, Plus, Upload, Search, Filter, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
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

  useEffect(() => {
    fetchAcessos();
  }, []);

  const toggleSortOrder = () => {
    setSortOrder((prev) => {
      if (prev === 'asc') return 'desc';
      if (prev === 'desc') return null;
      return 'asc';
    });
  };

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
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary-900">Acessos</h1>
            <p className="mt-2 text-primary-600">
              Gerenciamento de acessos aos sistemas da empresa
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center px-4 py-2 border border-button text-sm font-medium rounded-lg text-button bg-white hover:bg-button-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-button-500 transition-colors duration-200"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-button-500 transition-colors duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Acesso
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <AccessForm
          access={editingAccess}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingAccess(null);
          }}
        />
      )}

      {showUpload && (
        <FileUpload
          onSuccess={handleUploadSuccess}
          onCancel={() => setShowUpload(false)}
        />
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-neutral-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar acessos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
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
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer select-none flex items-center"
                title="Ordenar por descrição">
                Descrição
                <span className="ml-2">
                  {sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '⇅'}
                </span>
              </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  IP/URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Senha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Data Pagamento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {filteredAcessosSorted.map((acesso) => (
                <tr key={acesso.id} className="hover:bg-neutral-50 transition-colors duration-150">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-neutral-900">{acesso.descricao}</div>
                    {acesso.para_que_serve && (
                      <div className="text-sm text-neutral-500 truncate max-w-xs">
                        {acesso.para_que_serve}
                      </div>
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
                        {/* Ícone olho do lucide-react */}
                        <Eye className="h-5 w-5" />
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {acesso.usuario_login}
                  </td>
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
                          {visiblePasswords.has(acesso.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {acesso.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {acesso.data_pagamento && new Date(acesso.data_pagamento).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        setEditingAccess(acesso);
                        setShowForm(true);
                      }}
                      className="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(acesso.id)}
                      className="text-red-600 hover:text-red-900"
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
      </div>
    </div>
  );
};

export default Acessos;