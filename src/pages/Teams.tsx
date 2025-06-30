import React, { useState, useEffect } from 'react';
import { Plus, Upload, Search, Edit, Trash2, Eye, EyeOff, UserCheck } from 'lucide-react';
import TeamForm from '../components/TeamForm';
import TeamFileUpload from '../components/TeamFileUpload';
import { supabase } from '../lib/supabase';

interface Team {
  id: string;
  login: string;
  senha: string;
  usuario: string;
  departamento?: string;
  observacao?: string;
  created_at: string;
}

const Teams: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);
  const itemsPerPage = 10;
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

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
        .select('id, login, senha, usuario, departamento, observacao, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

    const departments = React.useMemo(() => {
    const deps = teams
      .map(team => team.departamento?.trim() || '')
      .filter(dep => dep !== '');
    // retorna só os únicos
    return Array.from(new Set(deps)).sort();

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este team?')) return;
  
    try {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
  
      // Recarrega lista do banco para garantir sincronização
      await fetchTeams();
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

  const filteredTeams = React.useMemo(() => {
    return teams.filter(
      (team) =>
        team.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.usuario.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teams, searchTerm]);

  const currentItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTeams.slice(start, start + itemsPerPage);
  }, [filteredTeams, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredTeams.length / itemsPerPage));

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
            <p className="mt-2 text-primary-600">Gerenciamento de equipes</p>
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
          onSuccess={() => {
            fetchTeams();
            setShowForm(false);
            setEditingTeam(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingTeam(null);
          }}
        />
      )}

      {showUpload && (
        <TeamFileUpload
          onSuccess={() => {
            fetchTeams();
            setShowUpload(false);
          }}
          onCancel={() => setShowUpload(false)}
        />
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-neutral-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <UserCheck className="h-5 w-5 text-neutral-400" />
              <span className="text-sm text-neutral-600">{filteredTeams.length} teams</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Senha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Departamento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {currentItems.map((team) => (
                <tr key={team.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm text-neutral-900">{team.login}</td>
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

          <div className="flex justify-between items-center p-4">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-neutral-200 text-neutral-400' : 'bg-primary-600 text-white'}`}
            >
              ← Anterior
            </button>
            <span className="text-sm text-neutral-600">Página {currentPage} de {totalPages}</span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded ${currentPage === totalPages ? 'bg-neutral-200 text-neutral-400' : 'bg-primary-600 text-white'}`}
            >
              Próxima →
            </button>
          </div>
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
              <div><strong>Departamento:</strong> {viewingTeam.departamento || '-'}</div>
              <div><strong>Observação:</strong> {viewingTeam.observacao || '-'}</div>
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
