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

  const statusOptions = useMemo(() => {
    const list = rateios.map(r => r.status?.trim() || '').filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [rateios]);

  const situacaoOptions = useMemo(() => {
    const list = rateios.map(r => r.situacao?.trim() || '').filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [rateios]);

  const dominioOptions = useMemo(() => {
    const list = rateios
      .map(r => r.email?.split('@')[1] || '')
      .filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [rateios]);

  const toggleSortOrder = () => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
  };

  const filteredRateiosSorted = useMemo(() => {
    let filtered = rateios.filter(r => {
      const matchesSearch = 
        r.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.armazenamento?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = !selectedStatus || r.status === selectedStatus;
      const matchesSituacao = !selectedSituacao || r.situacao === selectedSituacao;
      const matchesDominio = !selectedDominio || (r.email && r.email.includes(`@${selectedDominio}`));

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
    <div>
      <div className="p-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="border px-2 py-1 rounded">
          <option value="">Status: Todos</option>
          {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select value={selectedSituacao} onChange={e => setSelectedSituacao(e.target.value)} className="border px-2 py-1 rounded">
          <option value="">Situação: Todas</option>
          {situacaoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select value={selectedDominio} onChange={e => setSelectedDominio(e.target.value)} className="border px-2 py-1 rounded">
          <option value="">Domínio: Todos</option>
          {dominioOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
      <table className="min-w-full border">
        <thead>
          <tr>
            <th onClick={toggleSortOrder} className="cursor-pointer border p-2">
              Nome Completo {sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '⇅'}
            </th>
            <th className="border p-2">Email</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Situação</th>
          </tr>
        </thead>
        <tbody>
          {currentItems.map(r => (
            <tr key={r.id}>
              <td className="border p-2">{r.nome_completo}</td>
              <td className="border p-2">{r.email}</td>
              <td className="border p-2">{r.status}</td>
              <td className="border p-2">{r.situacao}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2">
        Página {currentPage} de {totalPages}
        <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="ml-2">Anterior</button>
        <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="ml-2">Próxima</button>
      </div>
    </div>
  );
};

export default RateioGoogle;
