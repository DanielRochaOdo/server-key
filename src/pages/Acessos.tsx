import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Key, Plus, Upload, Search, Edit, Trash2, Eye, EyeOff, Download } from 'lucide-react';
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

  const exportData = (format: 'csv' | 'xlsx') => {
    const exportData = filteredAcessosSorted.map(({ id, created_at, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Acessos');
    const fileName = `acessos_export.${format}`;
    if (format === 'csv') {
      XLSX.writeFile(wb, fileName, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, fileName);
    }
  };

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

      {/* resto do seu módulo permanece exatamente igual */}
      {/* ... (tabela, paginação, modais, etc) ... */}
    </div>
  );
};

export default Acessos;
