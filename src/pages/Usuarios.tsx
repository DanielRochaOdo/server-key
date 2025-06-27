import React from 'react';
import { Users, UserPlus, Search, Filter } from 'lucide-react';

const Usuarios: React.FC = () => {
  const mockUsers = [
    {
      id: 1,
      name: 'Administrador',
      email: 'admin@serverkey.com',
      role: 'Admin',
      status: 'Ativo',
      lastLogin: '2024-01-15 10:30'
    },
    {
      id: 2,
      name: 'João Silva',
      email: 'joao@empresa.com',
      role: 'Usuário',
      status: 'Ativo',
      lastLogin: '2024-01-14 16:45'
    },
    {
      id: 3,
      name: 'Maria Santos',
      email: 'maria@empresa.com',
      role: 'Moderador',
      status: 'Inativo',
      lastLogin: '2024-01-10 09:15'
    }
  ];

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary-900">Usuários</h1>
            <p className="mt-2 text-primary-600">
              Gerenciamento de usuários do sistema
            </p>
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-button-500 transition-colors duration-200">
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Usuário
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-neutral-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar usuários..."
                  className="pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <button className="inline-flex items-center px-3 py-2 border border-neutral-300 text-sm font-medium rounded-lg text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                <Filter className="h-4 w-4 mr-2" />
                Filtrar
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-neutral-400" />
              <span className="text-sm text-neutral-600">{mockUsers.length} usuários</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Função
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Último Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {mockUsers.map((user) => (
                <tr key={user.id} className="hover:bg-neutral-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-600">
                          {user.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-neutral-900">{user.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {user.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.status === 'Ativo' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {user.lastLogin}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-900 mr-4">
                      Editar
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      Desativar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Usuarios;