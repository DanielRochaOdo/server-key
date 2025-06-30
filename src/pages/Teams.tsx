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
  observacao?: string;
  created_at: string;
  updated_at: string;
}

const [departments, setDepartments] = useState<string[]>([]);
const [selectedDepartment, setSelectedDepartment] = useState<string>('');

useEffect(() => {
  fetchDepartments();
}, [teams]);

const fetchDepartments = () => {
  const uniqueDepartments = Array.from(
    new Set(teams.map(team => team.departamento).filter(Boolean))
  );
  setDepartments(uniqueDepartments);
};

const Teams: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, login, senha, usuario, departamento, observacao, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este team?')) return;

    try {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
      setTeams(teams.filter((team) => team.id !== id));
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Erro ao excluir team');
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

  const toggleSortOrder = () => {
    setSortOrder((prev) => {
      if (prev === 'asc') return 'desc';
      if (prev === 'desc') return null;
      return 'asc';
    });
  };

  const filteredTeamsSorted = React.useMemo(() => {
    let filtered = teams.filter((team) =>
      team.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.observacao?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortOrder === 'asc') {
      filtered.sort((a, b) => a.login.localeCompare(b.login));
    } else if (sortOrder === 'desc') {
      filtered.sort((a, b) => b.login.localeCompare(a.login));
    }

    return filtered;
  }, [teams, searchTerm, sortOrder]);

  const currentItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTeamsSorted.slice(start, start + itemsPerPage);
  }, [filteredTeamsSorted, currentPage]);

  const totalPages = Math.ceil(filteredTeamsSorted.length / itemsPerPage);

  const handleFormSuccess = () => {
    fetchTeams();
    setShowForm(false);
    setEditingTeam(null);
  };

  const handleUploadSuccess = () => {
    fetchTeams();
    setShowUpload(false);
  };

  const exportToCSV = () => {
    const csvData = teams.map(team => ({
      Login: team.login,
      Senha: team.senha,
      Usuario: team.usuario,
      Observacao: team.observacao || '',
      'Data Criacao': new Date(team.created_at).toLocaleDateString('pt-BR'),
      'Ultima Atualizacao': new Date(team.updated_at).toLocaleDateString('pt-BR')
    }));

    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teams');
    XLSX.writeFile(wb, `teams_${new Date().toISOString().split('T')[0]}.csv`);
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
            <h1 className="text-3xl font-bold text-primary-900">Teams</h1>
            <p className="mt-2 text-primary-600">Gerenciamento de equipes e membros</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-4 py-2 border border-button text-sm font-medium rounded-lg text-button bg-white hover:bg-button-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center px-4 py-2 border border-button text-sm font-medium rounded-lg text-button bg-white hover:bg-button-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Team
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <TeamForm
          team={editingTeam}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingTeam(null);
          }}
        />
      )}

      {showUpload && (
        <TeamFileUpload
          onSuccess={handleUploadSuccess}
          onCancel={() => setShowUpload(false)}
        />
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-neutral-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5 text-neutral-400" />
              <span className="text-sm text-neutral-600">{filteredTeamsSorted.length} teams</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th onClick={toggleSortOrder} className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer">
                  Login {sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '⇅'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Senha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Departamento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Observação</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-neutral-200">
              {currentItems.map((team) => (
                <tr key={team.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm font-medium text-neutral-900">{team.login}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono">{visiblePasswords.has(team.id) ? team.senha : '••••••••'}</span>
                      <button onClick={() => togglePasswordVisibility(team.id)} className="text-neutral-400 hover:text-neutral-600">
                        {visiblePasswords.has(team.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{team.usuario}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{team.departamento || '-'}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {team.observacao ? (
                      <span className="truncate max-w-xs block" title={team.observacao}>
                        {team.observacao}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <button
                      onClick={() => setViewingTeam(team)}
                      className="text-neutral-600 hover:text-neutral-900 mr-2"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setEditingTeam(team); setShowForm(true); }}
                      className="text-primary-600 hover:text-primary-900 mr-2"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(team.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTeamsSorted.length === 0 && (
            <div className="text-center py-12">
              <UserCheck className="mx-auto h-12 w-12 text-neutral-400" />
              <h3 className="mt-2 text-sm font-medium text-neutral-900">Nenhum team encontrado</h3>
              <p className="mt-1 text-sm text-neutral-500">
                {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando um novo team'}
              </p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`inline-flex items-center px-3 py-1 border border-neutral-300 rounded hover:bg-neutral-100 ${
                  currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </button>
              <span className="text-sm text-neutral-600">Página {currentPage} de {totalPages}</span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`inline-flex items-center px-3 py-1 border border-neutral-300 rounded hover:bg-neutral-100 ${
                  currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Próxima <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          )}
        </div>
      </div>

      {viewingTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-lg">
            <h2 className="text-xl font-bold mb-4">Detalhes do Team</h2>
            <div className="space-y-2 text-sm text-neutral-700">
              <div><strong>Login:</strong> {viewingTeam.login}</div>
              <div><strong>Senha:</strong> {viewingTeam.senha}</div>
              <div><strong>Usuário:</strong> {viewingTeam.usuario}</div>
              <div><strong>Observação:</strong> {viewingTeam.observacao || '-'}</div>
              <div><strong>Criado em:</strong> {new Date(viewingTeam.created_at).toLocaleString('pt-BR')}</div>
              <div><strong>Atualizado em:</strong> {new Date(viewingTeam.updated_at).toLocaleString('pt-BR')}</div>
            </div>
            <div className="mt-4 text-right">
              <button
                onClick={() => setViewingTeam(null)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
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

export default Teams;