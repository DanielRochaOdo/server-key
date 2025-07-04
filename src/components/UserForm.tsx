import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  pass?: string; // senha armazenada (não recomendado, só se for seu caso)
}

interface UserFormProps {
  user?: User | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ user, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'user' as 'admin' | 'user',
    is_active: true,
    pass: '',
    permissions: {
      acessos: { view: false, edit: false },
      teams: { view: false, edit: false },
      win_users: { view: false, edit: false },
      rateio_claro: { view: false, edit: false },
      rateio_google: { view: false, edit: false },
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        name: user.name || '',
        role: user.role || 'user',
        is_active: user.is_active ?? true,
        pass: '', // senha não carregamos para edição
        permissions: user.permissions || {
          acessos: { view: false, edit: false },
          teams: { view: false, edit: false },
          win_users: { view: false, edit: false },
          rateio_claro: { view: false, edit: false },
          rateio_google: { view: false, edit: false },
        }
      });
    } else {
      setFormData({
        email: '',
        name: '',
        role: 'user',
        is_active: true,
        pass: '',
        permissions: {
          acessos: { view: false, edit: false },
          teams: { view: false, edit: false },
          win_users: { view: false, edit: false },
          rateio_claro: { view: false, edit: false },
          rateio_google: { view: false, edit: false },
        }
      });
    }
    setError('');
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePermissionChange = (module: string, permission: 'view' | 'edit', checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: {
          ...prev.permissions[module as keyof typeof prev.permissions],
          [permission]: checked
        }
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (user) {
        // Atualiza usuário existente (não altera senha aqui)
        const { error } = await supabase
          .from('users')
          .update({
            email: formData.email,
            name: formData.name,
            role: formData.role,
            permissions: formData.permissions,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (error) throw error;
      } else {
        // Cria usuário no Auth Supabase (admin)
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.pass,
          email_confirm: true,
        });

        if (authError) throw authError;

        // Cria registro na tabela users
        const { error: dbError } = await supabase
          .from('users')
          .insert([{
            auth_uid: authUser.user.id,
            email: formData.email,
            name: formData.name,
            role: formData.role,
            permissions: formData.permissions,
            is_active: formData.is_active,
            pass: formData.pass,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);

        if (dbError) throw dbError;
      }

      onSuccess();
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      setError(err.message || 'Erro ao salvar usuário');
    } finally {
      setLoading(false);
    }
  };

  const modules = [
    { key: 'acessos', label: 'Acessos' },
    { key: 'teams', label: 'Teams' },
    { key: 'win_users', label: 'Win Users' },
    { key: 'rateio_claro', label: 'Rateio Claro' },
    { key: 'rateio_google', label: 'Rateio Google' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {user ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-2">
                Nome *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            {!user && (
              <div>
                <label htmlFor="pass" className="block text-sm font-medium text-neutral-700 mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  id="pass"
                  name="pass"
                  required
                  value={formData.pass}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                />
              </div>
            )}

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-neutral-700 mb-2">
                Função
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              >
                <option value="user">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
                disabled={loading}
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-neutral-700">
                Usuário ativo
              </label>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium text-neutral-900 mb-4">Permissões por Módulo</h3>
            <div className="space-y-4">
              {modules.map((module) => (
                <div key={module.key} className="bg-neutral-50 p-4 rounded-lg">
                  <h4 className="font-medium text-neutral-900 mb-3">{module.label}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`${module.key}_view`}
                        checked={formData.permissions[module.key as keyof typeof formData.permissions]?.view || false}
                        onChange={(e) => handlePermissionChange(module.key, 'view', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
                        disabled={loading}
                      />
                      <label htmlFor={`${module.key}_view`} className="ml-2 block text-sm text-neutral-700">
                        Visualizar e Exportar
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`${module.key}_edit`}
                        checked={formData.permissions[module.key as keyof typeof formData.permissions]?.edit || false}
                        onChange={(e) => handlePermissionChange(module.key, 'edit', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
                        disabled={loading}
                      />
                      <label htmlFor={`${module.key}_edit`} className="ml-2 block text-sm text-neutral-700">
                        Importar e Editar
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-neutral-200">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-button text-white rounded-lg hover:bg-button-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;
