import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Upload, Search, Edit, Trash2, Eye, EyeOff, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import TeamForm from '../components/TeamForm';
import TeamFileUpload from '../components/TeamFileUpload';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

interface Team {
  id: string;
  login: string;
  senha: string;
  usuario: string;
  departamento: string;
  observacao?: string;
  created_at: string;
  updated_at: string;
}

const Teams: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const itemsPerPage = 10;

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, departmentFilter]);

  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('teams')
      .select('id, login, senha, usuario, departamento, observacao, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (!error) setTeams(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este team?')) return;
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (!error) setTeams(teams.filter((team) => team.id !== id));
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

  const filteredTeamsSorted = React.useMemo(() => {
    let filtered = teams.filter((team) =>
      (team.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.usuario.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (departmentFilter ? team.departamento === departmentFilter : true)
    );
    return filtered;
  }, [teams, searchTerm, departmentFilter]);

  const currentItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTeamsSorted.slice(start, start + itemsPerPage);
  }, [filteredTeamsSorted, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredTeamsSorted.length / itemsPerPage));

  const uniqueDepartments = Array.from(new Set(teams.map(t => t.departamento).filter(Boolean)));

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-neutral-600">Gerenciamento de equipes</p>
        </div>
        <div className="flex space-x-2">
          <button onClick={() => setShowUpload(true)} className="bg-white border px-3 py-1 rounded flex items-center">
            <Upload className="h-4 w-4 mr-1" /> Importar
          </button>
          <button onClick={() => setShowForm(true)} className="bg-primary-600 text-white px-3 py-1 rounded flex items-center">
            <Plus className="h-4 w-4 mr-1" /> Novo Team
          </button>
        </div>
      </div>

      <div className="flex space-x-2 mb-3">
        <div className="relative flex-1">
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar login ou usuário..."
            className="w-full border rounded px-3 py-1 pl-8"
          />
          <Search className="absolute left-2 top-1.5 h-4 w-4 text-neutral-400" />
        </div>
        <select
          value={departmentFilter}
          onChange={e => setDepartmentFilter(e.target.value)}
          className="border rounded px-3 py-1"
        >
          <option value="">Todos departamentos</option>
          {uniqueDepartments.map(dep => (
            <option key={dep} value={dep}>{dep}</option>
          ))}
        </select>
      </div>

      <table className="w-full border">
        <thead className="bg-neutral-100">
          <tr>
            <th className="border px-2 py-1 text-left">Login</th>
            <th className="border px-2 py-1 text-left">Senha</th>
            <th className="border px-2 py-1 text-left">Usuário</th>
            <th className="border px-2 py-1 text-left">Departamento</th>
            <th className="border px-2 py-1 text-left">Ações</th>
          </tr>
        </thead>
        <tbody>
          {currentItems.map(t => (
            <tr key={t.id}>
              <td className="border px-2 py-1">{t.login}</td>
              <td className="border px-2 py-1">
                <div className="flex items-center space-x-2">
                  <span className="font-mono">{visiblePasswords.has(t.id) ? t.senha : '••••••••'}</span>
                  <button onClick={() => togglePasswordVisibility(t.id)} className="text-neutral-400 hover:text-neutral-600">
                    {visiblePasswords.has(t.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </td>
              <td className="border px-2 py-1">{t.usuario}</td>
              <td className="border px-2 py-1">{t.departamento || '-'}</td>
              <td className="border px-2 py-1">
                <button onClick={() => setViewingTeam(t)} className="mr-1 text-neutral-600">
                  <Search className="h-4 w-4" />
                </button>
                <button onClick={() => { setEditingTeam(t); setShowForm(true); }} className="mr-1 text-primary-600">
                  <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(t.id)} className="text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between items-center mt-3">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-neutral-200 text-neutral-400' : 'bg-primary-600 text-white'}`}
        >
          ← Anterior
        </button>
        <span className="text-sm">Página {currentPage} de {totalPages}</span>
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className={`px-3 py-1 rounded ${currentPage === totalPages ? 'bg-neutral-200 text-neutral-400' : 'bg-primary-600 text-white'}`}
        >
          Próxima →
        </button>
      </div>

      {showForm && (
        <TeamForm
          team={editingTeam}
          onSuccess={() => { fetchTeams(); setShowForm(false); setEditingTeam(null); }}
          onCancel={() => { setShowForm(false); setEditingTeam(null); }}
        />
      )}

      {showUpload && (
        <TeamFileUpload
          onSuccess={() => { fetchTeams(); setShowUpload(false); }}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {viewingTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded p-4">
            <h2 className="text-lg font-bold mb-2">Detalhes do Team</h2>
            <p><strong>Login:</strong> {viewingTeam.login}</p>
            <p><strong>Senha:</strong> {viewingTeam.senha}</p>
            <p><strong>Usuário:</strong> {viewingTeam.usuario}</p>
            <p><strong>Departamento:</strong> {viewingTeam.departamento || '-'}</p>
            <p><strong>Observação:</strong> {viewingTeam.observacao || '-'}</p>
            <button onClick={() => setViewingTeam(null)} className="mt-3 bg-primary-600 text-white px-3 py-1 rounded">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teams;
