import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import UserForm from '../components/UserForm';

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
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*');
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
    fetchUsers(); // atualiza a lista
  };

  const handleCancel = () => {
    setShowForm(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Usuários</h1>
        <button
          onClick={handleNew}
          className="inline-flex items-center px-4 py-2 bg-button text-white rounded-lg hover:bg-button-hover transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" /> Novo Usuário
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 rounded-lg">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Função</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ativo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-900">{user.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">{user.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                    {user.role === 'admin' ? 'Administrador' : user.role === 'financeiro' ? 'Financeiro' : 'Usuário'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
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
