import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { normalizeRole } from '../utils/roles';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'financeiro' | 'usuario';
  modules: string[];
  is_active: boolean;
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
    role: 'usuario' as 'admin' | 'financeiro' | 'usuario',
    is_active: true,
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Persistência de dados do formulário
  const persistenceKey = user ? `userForm_edit_${user.id}` : 'userForm_new';
  
  // Carregar dados persistidos
  useEffect(() => {
    const savedData = localStorage.getItem(persistenceKey);
    if (savedData && savedData !== 'undefined') {
      try {
        const parsedData = JSON.parse(savedData);
        // Só usar dados salvos se não estiver vazio
        if (parsedData && Object.keys(parsedData).length > 0) {
          setFormData(prev => ({ ...prev, ...parsedData }));
        }
        return;
      } catch (error) {
        console.error('Error loading saved form data:', error);
      }
    }
    
    // Só definir dados iniciais se não há dados salvos
    setFormData(prev => {
      if (user) {
        return {
          email: user.email || '',
          name: user.name || '',
          role: (normalizeRole(user.role) || 'usuario') as 'admin' | 'financeiro' | 'usuario',
          is_active: user.is_active ?? true,
          password: '', // Never pre-fill password for security
        };
      } else {
        return {
          email: '',
          name: '',
          role: 'usuario',
          is_active: true,
          password: '',
        };
      }
    });
    setError('');
  }, [user?.id, persistenceKey]); // Usar user.id em vez de user completo
  
  // Salvar dados quando formData muda
  useEffect(() => {
    // Só salvar se formData não estiver vazio
    if (formData.email || formData.name) {
      localStorage.setItem(persistenceKey, JSON.stringify(formData));
    }
  }, [formData, persistenceKey]);

  const getModulesByRole = (role: string): string[] => {
    switch (normalizeRole(role)) {
      case 'admin':
        return ['usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm', 'controle_empresas', 'controle_uber'];
      case 'financeiro':
        return ['rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas'];
      case 'usuario':
        return ['acessos', 'pessoal', 'teams', 'win_users'];
      default:
        return [];
    }
  };

  const roleLabels = {
    admin: 'Administrador',
    financeiro: 'Financeiro',
    usuario: 'Usuario',
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const normalizedRole = normalizeRole(formData.role);

    try {
      if (user) {
        // For updates, use direct Supabase call to update public.users only
        const { error } = await supabase
          .from('users')
          .update({
            email: formData.email,
            name: formData.name,
            role: normalizedRole || 'usuario',
            modules: getModulesByRole(normalizedRole || 'usuario'),
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (error) throw error;
      } else {
        // For new users, use the Edge Function
        if (!formData.password) {
          throw new Error('Password is required for new users');
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            role: normalizedRole || 'usuario',
            is_active: formData.is_active,
          }),
        });

        const responseData = await response.json();
        
        if (!response.ok) {
          // Handle specific error cases
          if (response.status === 409) {
            throw new Error('Usuário com este email já existe no sistema');
          } else if (response.status === 400) {
            throw new Error(responseData.error || 'Dados inválidos fornecidos');
          } else {
            const details = responseData?.details ? ` (${responseData.details})` : '';
            throw new Error(`${responseData.error || 'Erro interno do servidor'}${details}`);
          }
        }
        
        if (!responseData.success) {
          throw new Error(responseData.error || 'Falha ao criar usuário');
        }
      }

      // Limpar dados persistidos após sucesso
      localStorage.removeItem(persistenceKey);
      onSuccess();
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      setError(err.message || 'Erro ao salvar usuário');
    } finally {
      setLoading(false);
    }
  };

  const currentModules = getModulesByRole(formData.role);
  
  const handleCancel = () => {
    // Limpar dados persistidos ao cancelar
    localStorage.removeItem(persistenceKey);
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {user ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <button
            onClick={handleCancel}
            className="text-neutral-400 hover:text-neutral-600"
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
              <label className="block text-sm font-medium text-neutral-700 mb-2">Nome *</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Email *</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            {!user && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Senha *</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Função *</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              >
                <option value="usuario">Usuário</option>
                <option value="financeiro">Financeiro</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="flex items-center mt-2 md:mt-0">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 border-neutral-300 rounded"
                disabled={loading}
              />
              <label className="ml-2 block text-sm text-neutral-700">Usuário ativo</label>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              Módulos Permitidos para {roleLabels[formData.role]}
            </h3>
            <div className="bg-neutral-50 p-3 rounded-lg grid grid-cols-2 md:grid-cols-3 gap-2">
              {currentModules.map(module => (
                <div key={module} className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-neutral-700">{module}</span>
                </div>
              ))}
              {currentModules.length === 0 && (
                <p className="text-sm text-neutral-500">Nenhum módulo permitido.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
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
