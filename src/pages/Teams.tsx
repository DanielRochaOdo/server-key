import React, { useState, useEffect } from 'react';
import { Plus, Upload, Download, Search, Edit, Trash2, Eye, EyeOff, UserCheck } from 'lucide-react';
import TeamForm from '../components/TeamForm';
import TeamFileUpload from '../components/TeamFileUpload';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

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
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDepartment]);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este team?')) return;

    try {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
      setTeams((prev) => prev.filter((team) => team.id !== id));
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

  const departments = React.useMemo(() => {
    const deps = teams
      .map((team) => team.departamento?.trim() || '')
      .filter((dep) => dep !== '');
    return Array.from(new Set(deps)).sort();
  }, [teams]);

  const filteredTeams = React.useMemo(() => {
    return teams.filter((team) => {
      const matchesSearch =
        team.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.usuario.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDepartment = selectedDepartment === '' || team.departamento === selectedDepartment;

      return matchesSearch && matchesDepartment;
    });
  }, [teams, searchTerm, selectedDepartment]);

  const exportData = (format: 'csv' | 'xlsx') => {
    // Usar dados filtrados em vez de todos os dados
    const dataToExport = filteredTeams.map(({ id, created_at, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teams');
    
    // Incluir informações sobre filtros no nome do arquivo
    const filterInfo = (searchTerm || selectedDepartment) ? `_filtrado` : '';
    const filename = `teams${filterInfo}_${new Date().toISOString().slice(0,10)}.${format}`;
    
    if (format === 'csv') {
      XLSX.writeFile(wb, filename, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
    }
    setShowExportMenu(false);
  };

  const currentItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTeams.slice(start, start + itemsPerPage);
  }, [filteredTeams, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredTeams.length / itemsPerPage));

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
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Teams</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-primary-600">Gerenciamento de equipes</p>
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
                Exportar ({filteredTeams.length})
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border border-neutral-200">
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs text-neutral-500 border-b border-neutral-100">
                      {(searchTerm || selectedDepartment) ? `Exportando ${filteredTeams.length} registros filtrados` : `Exportando todos os ${filteredTeams.length} registros`}
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
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
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
        <div className="p-4 sm:p-6 border-b border-neutral-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0 lg:space-x-4">
            {/* Campo de busca */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
              />
            </div>

            {/* Filtro por departamento */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
              <label htmlFor="filter-department" className="text-xs sm:text-sm font-medium text-neutral-700 whitespace-nowrap">
                Departamento:
              </label>
              <select
                id="filter-department"
                className="border border-neutral-300 rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="">Todos</option>
                {departments.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </div>

            {/* Contagem de items */}
            <div className="flex items-center space-x-2">
              <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
              <span className="text-xs sm:text-sm text-neutral-600">{filteredTeams.length} teams</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Login</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Senha</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Usuário</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Departamento</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {currentItems.map((team) => (
                <tr key={team.id} className="hover:bg-neutral-50">
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-neutral-900 truncate max-w-[100px] sm:max-w-none">{team.login}</td>
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-neutral-600">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <span className="font-mono text-xs sm:text-sm">{visiblePasswords.has(team.id) ? team.senha : '••••••••'}</span>
                      <button onClick={() => togglePasswordVisibility(team.id)} className="text-neutral-400 hover:text-neutral-600">
                        {visiblePasswords.has(team.id) ? <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" /> : <Eye className="h-3 w-3 sm:h-4 sm:w-4" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-neutral-600 truncate max-w-[100px] sm:max-w-none">{team.usuario}</td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-4 text-xs sm:text-sm text-neutral-600 truncate max-w-[150px]">{team.departamento || '-'}</td>
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button
                        onClick={() => setViewingTeam(team)}
                        className="text-neutral-600 hover:text-neutral-900"
                      >
                        <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTeam(team);
                          setShowForm(true);
                        }}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(team.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center p-3 sm:p-4">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                currentPage === 1 ? 'bg-neutral-200 text-neutral-400' : 'bg-primary-600 text-white'
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
              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                currentPage === totalPages ? 'bg-neutral-200 text-neutral-400' : 'bg-primary-600 text-white'
              }`}
            >
              Próxima →
            </button>
          </div>
        </div>
      </div>

      {viewingTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-lg w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Detalhes do Team</h2>
            <div className="space-y-2 text-xs sm:text-sm text-neutral-700">
              <div>
                <strong>Login:</strong> {viewingTeam.login}
              </div>
              <div>
                <strong>Senha:</strong> {viewingTeam.senha}
              </div>
              <div>
                <strong>Usuário:</strong> {viewingTeam.usuario}
              </div>
              <div>
                <strong>Departamento:</strong> {viewingTeam.departamento || '-'}
              </div>
              <div>
                <strong>Observação:</strong> {viewingTeam.observacao || '-'}
              </div>
            </div>
            <div className="mt-4 sm:mt-6 text-right">
              <button
                onClick={() => setViewingTeam(null)}
                className="px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-xs sm:text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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

export default Teams;