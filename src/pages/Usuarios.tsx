import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import UserForm from '../components/UserForm';
import { usePersistence } from '../contexts/PersistenceContext';
import { getRoleLabel, normalizeRole } from '../utils/roles';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'financeiro' | 'usuario';
  is_active: boolean;
  modules: string[]; // ajustado para módulos como string[]
}

const Usuarios: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { getState, setState, clearState } = usePersistence();
  
  const [showForm, setShowForm] = useState(() => getState('usuarios_showForm') || false);
  const [selectedUser, setSelectedUser] = useState<User | null>(() => getState('usuarios_selectedUser') || null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Erro ao buscar usuários:', error);
      setUsers([]);
    } else {
      setUsers(data as User[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Persist form state
  useEffect(() => {
    setState('usuarios_showForm', showForm);
  }, [showForm, setState]);

  useEffect(() => {
    setState('usuarios_selectedUser', selectedUser);
  }, [selectedUser, setState]);
  const handleNew = () => {
    setSelectedUser(null); // limpa usuário selecionado
    setShowForm(true); // abre o formulário
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user); // seta usuário para edição
    setShowForm(true); // abre o formulário
  };

  const handleSuccess = () => {
    setShowForm(false);
    setSelectedUser(null);
    clearState('usuarios_showForm');
    clearState('usuarios_selectedUser');
    fetchUsers(); // atualiza a lista
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedUser(null);
    clearState('usuarios_showForm');
    clearState('usuarios_selectedUser');
  };
  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Usuários</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-primary-600">Gerenciamento de usuários do sistema</p>
          </div>
          <div className="flex">
            <button
              onClick={handleNew}
              className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover transition-colors"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> Novo Usuário
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-64">
          <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Nome</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Funcao</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ativo</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Acoes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50 transition-colors duration-150">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-900">{user.name}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-700">{user.email}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-neutral-700">
                      {getRoleLabel(normalizeRole(user.role))}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                      <button
                        onClick={() => handleEdit(user)}
                        className="inline-flex items-center px-2 py-1 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <UserForm
          user={selectedUser}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};

export default Usuarios;

