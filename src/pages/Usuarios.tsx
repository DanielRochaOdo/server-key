import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, UserPlus, Search, Edit, Shield, Eye, AlertTriangle } from 'lucide-react';
import UserForm from '../components/UserForm';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  auth_uid: string;
  email: string;
  name: string;
  role: 'admin' | 'financeiro' | 'usuario';
  modules: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const Usuarios: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const { isAdmin, refreshUserProfile } = useAuth();

  const itemsPerPage = 10;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = selectedRole === '' || user.role === selectedRole;

      return matchSearch && matchRole;
    });
  }, [users, searchTerm, selectedRole]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleNewUser = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const handleFormSuccess = async () => {
    await fetchUsers();
    await refreshUserProfile(); // Atualiza perfil atual se necessário
    handleCloseForm();
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    if (!confirm(`Tem certeza que deseja ${currentStatus ? 'desativar' : 'ativar'} este usuário?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_active: !currentStatus } : u))
      );
    } catch (error) {
      console.error('Erro ao alterar status do usuário:', error);
      alert('Erro ao alterar status do usuário');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { label: 'Admin', color: 'bg-red-100 text-red-800' },
      financeiro: { label: 'Financeiro', color: 'bg-blue-100 text-blue-800' },
      usuario: { label: 'Usuário', color: 'bg-green-100 text-green-800' },
    };
    
    return badges[role as keyof typeof badges] || badges.usuario;
  };

  const moduleLabels = {
    usuarios: 'Usuários',
    acessos: 'Acessos',
    teams: 'Teams',
    win_users: 'Win Users',
    rateio_claro: 'Rateio Claro',
    rateio_google: 'Rateio Google',
  };

  if (!isAdmin()) {
    return (
      <div className="min-h-64 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Acesso Negado</h2>
          <p className="text-neutral-600">Apenas administradores podem gerenciar usuários.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Usuários</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-primary-600">
              Gerenciamento de usuários e permissões do sistema
            </p>
          </div>
          <button
            onClick={handleNewUser}
            className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover"
          >
            <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Novo Usuário
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-neutral-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0 lg:space-x-4">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
              <label htmlFor="filter-role" className="text-xs sm:text-sm font-medium text-neutral-700 whitespace-nowrap">
                Função:
              </label>
              <select
                id="filter-role"
                className="border border-neutral-300 rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="admin">Administrador</option>
                <option value="financeiro">Financeiro</option>
                <option value="usuario">Usuário</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
              <span className="text-xs sm:text-sm text-neutral-600">{filteredUsers.length} usuários</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Usuário</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Email</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Função</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 sm:py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 sm:py-12 text-neutral-600">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                currentItems.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50 transition-colors duration-150">
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-xs sm:text-sm font-medium text-primary-600">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="ml-3 sm:ml-4">
                          <div className="text-xs sm:text-sm font-medium text-neutral-900 truncate max-w-[120px] sm:max-w-none">{user.name}</div>
                          <div className="text-xs text-neutral-500">{user.modules.length} módulos</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600 truncate max-w-[150px] sm:max-w-none">{user.email}</td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">
                      <div className="flex items-center">
                        {user.role === 'admin' && <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 mr-1" />}
                        <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadge(user.role).color}`}>{getRoleBadge(user.role).label}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <button onClick={() => setViewingUser(user)} className="text-neutral-600 hover:text-neutral-900" title="Visualizar">
                          <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                        <button onClick={() => handleEdit(user)} className="text-primary-600 hover:text-primary-900" title="Editar">
                          <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          className={`${user.is_active ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}
                          title={user.is_active ? 'Desativar' : 'Ativar'}
                        >
                          {user.is_active ? '⏸' : '▶'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center p-3 sm:p-4 border-t border-neutral-200">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-2 sm:px-3 py-1 rounded transition-colors text-xs sm:text-sm ${currentPage === 1 ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
            >
              ← Anterior
            </button>
            <span className="text-xs sm:text-sm text-neutral-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-2 sm:px-3 py-1 rounded transition-colors text-xs sm:text-sm ${currentPage === totalPages ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
            >
              Próxima →
            </button>
          </div>
        )}
      </div>

      {/* Modal Formulário só aparece quando showForm === true */}
      {showForm && (
        <UserForm user={editingUser} onCancel={handleCloseForm} onSuccess={handleFormSuccess} />
      )}

      {/* Modal Visualizar Usuário (pode ser implementado) */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setViewingUser(null)}
              className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-600"
              title="Fechar"
            >
              <X className="h-6 w-6" />
            </button>
            <h2 className="text-xl font-semibold mb-4">Detalhes do Usuário</h2>
            <p><strong>Nome:</strong> {viewingUser.name}</p>
            <p><strong>Email:</strong> {viewingUser.email}</p>
            <p><strong>Função:</strong> {getRoleBadge(viewingUser.role).label}</p>
            <p><strong>Status:</strong> {viewingUser.is_active ? 'Ativo' : 'Inativo'}</p>
            <p><strong>Módulos:</strong> {viewingUser.modules.map(m => moduleLabels[m] || m).join(', ')}</p>
            <p><strong>Criado em:</strong> {formatDate(viewingUser.created_at)}</p>
            <p><strong>Última atualização:</strong> {formatDate(viewingUser.updated_at)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;
