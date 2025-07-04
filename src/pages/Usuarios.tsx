import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, UserPlus, Search, Edit, Trash2, Eye, Shield } from 'lucide-react';
import UserForm from '../components/UserForm';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  permissions: {
    acessos: { view: boolean; edit: boolean };
    teams: { view: boolean; edit: boolean };
    win_users: { view: boolean; edit: boolean };
    rateio_claro: { view: boolean; edit: boolean };
    rateio_google: { view: boolean; edit: boolean };
  };
  is_active: boolean;
  created_at: string;
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
  const { user: currentUser } = useAuth();

  const itemsPerPage = 10;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, role, permissions, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel('public:users')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Erro ao excluir usuário');
    }
  }, [fetchUsers]);

  const toggleUserStatus = useCallback(async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Erro ao alterar status do usuário');
    }
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = selectedRole === '' || user.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, selectedRole]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const handleFormSuccess = useCallback(() => {
    fetchUsers();
    setShowForm(false);
    setEditingUser(null);
  }, [fetchUsers]);

  const handleEdit = useCallback((user: User) => {
    setEditingUser(user);
    setShowForm(true);
  }, []);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingUser(null);
  }, []);

  const handleView = useCallback((user: User) => {
    setViewingUser(user);
  }, []);

  const handleCloseView = useCallback(() => {
    setViewingUser(null);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPermissionsSummary = (permissions: User['permissions']) => {
    const modules = Object.keys(permissions);
    const viewCount = modules.filter(module => permissions[module as keyof typeof permissions]?.view).length;
    const editCount = modules.filter(module => permissions[module as keyof typeof permissions]?.edit).length;
    return `${viewCount} visualizar, ${editCount} editar`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Usuários</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-primary-600">
            Gerenciamento de usuários do sistema
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover"
        >
          <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          Novo Usuário
        </button>
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
                <option value="user">Usuário</option>
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
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Função
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="hidden lg:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Permissões
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {currentItems.map((user) => (
                <tr key={user.id} className="hover:bg-neutral-50 transition-colors duration-150">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-xs sm:text-sm font-medium text-primary-600">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-3 sm:ml-4">
                        <div className="text-xs sm:text-sm font-medium text-neutral-900 truncate max-w-[120px] sm:max-w-none">
                          {user.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600 truncate max-w-[150px] sm:max-w-none">
                    {user.email}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">
                    <div className="flex items-center">
                      {user.role === 'admin' && <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-button-600 mr-1" />}
                      {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="hidden lg:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-600">
                    {getPermissionsSummary(user.permissions)}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button 
                        onClick={() => handleView(user)}
                        className="text-neutral-600 hover:text-neutral-900"
                        title="Visualizar"
                      >
                        <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(user)} 
                        className="text-primary-600 hover:text-primary-900"
                        title="Editar"
                      >
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button 
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        className={`${user.is_active ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}
                        title={user.is_active ? 'Desativar' : 'Ativar'}
                      >
                        {user.is_active ? '⏸' : '▶'}
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id)} 
                        className="text-red-600 hover:text-red-900"
                        title="Excluir"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 sm:py-12">
              <Users className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-neutral-400" />
              <h3 className="mt-2 text-sm font-medium text-neutral-900">Nenhum usuário encontrado</h3>
              <p className="mt-1 text-xs sm:text-sm text-neutral-500">
                {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando um novo usuário'}
              </p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center p-3 sm:p-4 border-t border-neutral-200">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-2 sm:px-3 py-1 rounded transition-colors text-xs sm:text-sm ${
                currentPage === 1 
                  ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' 
                  : 'bg-primary-600 text-white hover:bg-primary-700'
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
              className={`px-2 sm:px-3 py-1 rounded transition-colors text-xs sm:text-sm ${
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

      {showForm && (
        <UserForm
          user={editingUser}
          onSuccess={handleFormSuccess}
          onCancel={handleCancelForm}
        />
      )}

      {viewingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-2xl w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Detalhes do Usuário</h2>
            <div className="space-y-3 text-xs sm:text-sm text-neutral-700">
              <div><strong>Nome:</strong> {viewingUser.name}</div>
              <div><strong>Email:</strong> {viewingUser.email}</div>
              <div><strong>Função:</strong> {viewingUser.role === 'admin' ? 'Administrador' : 'Usuário'}</div>
              <div><strong>Status:</strong> {viewingUser.is_active ? 'Ativo' : 'Inativo'}</div>
              <div><strong>Criado em:</strong> {formatDate(viewingUser.created_at)}</div>
              <div className="mt-4">
                <strong>Permissões por Módulo:</strong>
                <div className="mt-2 space-y-2">
                  {Object.entries(viewingUser.permissions).map(([module, perms]) => (
                    <div key={module} className="bg-neutral-50 p-3 rounded">
                      <div className="font-medium text-neutral-900 capitalize mb-1">
                        {module.replace('_', ' ')}
                      </div>
                      <div className="text-xs text-neutral-600">
                        Visualizar: {perms.view ? '✅' : '❌'} | 
                        Editar: {perms.edit ? '✅' : '❌'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 sm:mt-6 text-right">
              <button
               
