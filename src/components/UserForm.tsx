import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { normalizeRole } from '../utils/roles';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'owner' | 'financeiro' | 'usuario';
  modules: string[];
  is_active: boolean;
  auth_uid?: string | null;
}

interface UserFormProps {
  user?: User | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ user, onSuccess, onCancel }) => {
  const { isOwner } = useAuth();
  const moduleOptions = useMemo(
    () => [
      { value: 'usuarios', label: 'Usuarios' },
      { value: 'acessos', label: 'Acessos' },
      { value: 'pessoal', label: 'Senhas Pessoais' },
      { value: 'teams', label: 'Contas Teams' },
      { value: 'win_users', label: 'Usuarios Windows' },
      { value: 'rateio_claro', label: 'Rateio Claro' },
      { value: 'rateio_google', label: 'Rateio Google' },
      { value: 'rateio_mkm', label: 'Rateio Fatura MKM' },
      { value: 'contas_a_pagar', label: 'Contas a Pagar' },
      { value: 'controle_empresas', label: 'Controle Empresas' },
      { value: 'controle_uber', label: 'Controle Uber' },
      { value: 'visitas_clinicas', label: 'Visitas as Clinicas' },
      { value: 'pedidos_de_compra', label: 'Pedidos de Compra' },
    ],
    []
  );
  const allModules = useMemo(() => moduleOptions.map((option) => option.value), [moduleOptions]);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'usuario' as 'admin' | 'owner' | 'financeiro' | 'usuario',
    is_active: true,
    password: '',
    resetPassword: '',
    modules: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const persistenceKey = user ? `userForm_edit_${user.id}` : 'userForm_new';

  const getModulesByRole = (role: string): string[] => {
    switch (normalizeRole(role)) {
      case 'owner':
        return allModules;
      case 'admin':
<<<<<<< HEAD
        return ['usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm', 'controle_empresas', 'controle_uber', 'visitas_clinicas'];
=======
        return [
          'usuarios',
          'acessos',
          'pessoal',
          'teams',
          'win_users',
          'rateio_claro',
          'rateio_google',
          'contas_a_pagar',
          'rateio_mkm',
          'controle_empresas',
          'controle_uber',
          'visitas_clinicas',
        ];
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
      case 'financeiro':
        return ['rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas', 'visitas_clinicas'];
      case 'usuario':
        return ['acessos', 'pessoal', 'teams', 'win_users'];
      default:
        return [];
    }
  };

  const roleLabels = {
    admin: 'Administrador',
    owner: 'Owner',
    financeiro: 'Financeiro',
    usuario: 'Usuario',
  };

  useEffect(() => {
    const savedData = localStorage.getItem(persistenceKey);
    if (savedData && savedData !== 'undefined') {
      try {
        const parsedData = JSON.parse(savedData);
        if (parsedData && Object.keys(parsedData).length > 0) {
          setFormData((prev) => ({ ...prev, ...parsedData }));
        }
        return;
      } catch (err) {
        console.error('Error loading saved form data:', err);
      }
    }

    setFormData(() => {
      if (user) {
        const resolvedRole = (normalizeRole(user.role) || 'usuario') as
          | 'admin'
          | 'owner'
          | 'financeiro'
          | 'usuario';
        return {
          email: user.email || '',
          name: user.name || '',
          role: resolvedRole,
          is_active: user.is_active ?? true,
          password: '',
          resetPassword: '',
          modules: user.modules?.length ? user.modules : getModulesByRole(resolvedRole),
        };
      }

      return {
        email: '',
        name: '',
        role: 'usuario',
        is_active: true,
        password: '',
        resetPassword: '',
        modules: getModulesByRole('usuario'),
      };
    });
    setError('');
  }, [user?.id, persistenceKey]);

  useEffect(() => {
    if (formData.email || formData.name) {
      localStorage.setItem(persistenceKey, JSON.stringify(formData));
    }
  }, [formData, persistenceKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
      return;
    }
    if (name === 'role') {
      setFormData((prev) => ({
        ...prev,
        role: value as 'admin' | 'owner' | 'financeiro' | 'usuario',
        modules: isOwner() ? getModulesByRole(value) : prev.modules,
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleModule = (moduleKey: string) => {
    setFormData((prev) => {
      if (prev.modules.includes(moduleKey)) {
        return { ...prev, modules: prev.modules.filter((module) => module !== moduleKey) };
      }
      return { ...prev, modules: [...prev.modules, moduleKey] };
    });
  };

  const normalizeModules = (modules: string[]) => {
    const unique = Array.from(new Set(modules));
    return unique.sort();
  };

  const getAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    let session = data.session;
    const now = Math.floor(Date.now() / 1000);
    if (!session || (session.expires_at && session.expires_at < now + 30)) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      session = refreshData.session;
    }

    const token = session?.access_token;
    if (!token) {
      throw new Error('Sessao expirada. Faça login novamente.');
    }
    return token;
  };

  const updateUserAsOwner = async (payload: {
    user_id: string;
    email?: string;
    name?: string;
    role?: string;
    modules?: string[];
    is_active?: boolean;
    password?: string;
  }) => {
    const token = await getAccessToken();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/owner-update-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': `${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(responseData?.error || 'Erro ao atualizar usuario.');
    }
    if (!responseData.success) {
      throw new Error(responseData?.error || 'Falha ao atualizar usuario.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const normalizedRole = normalizeRole(formData.role);
    const modulesToSave = isOwner()
      ? normalizeModules(formData.modules)
      : getModulesByRole(normalizedRole || 'usuario');
    const existingRole = user ? normalizeRole(user.role) : '';
    const roleToSend = normalizedRole && normalizedRole !== existingRole ? normalizedRole : undefined;

    if (normalizedRole === 'owner' && !user) {
      setError('Role owner deve ser definido apenas via banco.');
      setLoading(false);
      return;
    }

    if (roleToSend === 'owner' && existingRole !== 'owner') {
      setError('Role owner deve ser definido apenas via banco.');
      setLoading(false);
      return;
    }

    try {
      if (user) {
        if (isOwner()) {
          await updateUserAsOwner({
            user_id: user.id,
            email: formData.email,
            name: formData.name,
            role: roleToSend,
            modules: modulesToSave,
            is_active: formData.is_active,
            password: formData.resetPassword?.trim() || undefined,
          });
        } else {
          const { error: updateError } = await supabase
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

          if (updateError) throw updateError;
        }
      } else {
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
          if (response.status === 409) {
            throw new Error('Usuario com este email ja existe no sistema');
          }
          if (response.status === 400) {
            throw new Error(responseData.error || 'Dados invalidos fornecidos');
          }
          const details = responseData?.details ? ` (${responseData.details})` : '';
          throw new Error(`${responseData.error || 'Erro interno do servidor'}${details}`);
        }

        if (!responseData.success) {
          throw new Error(responseData.error || 'Falha ao criar usuario');
        }

        if (isOwner() && responseData?.user?.id) {
          const defaultModules = normalizeModules(getModulesByRole(normalizedRole || 'usuario'));
          if (JSON.stringify(modulesToSave) !== JSON.stringify(defaultModules)) {
            await updateUserAsOwner({
              user_id: responseData.user.id,
              modules: modulesToSave,
            });
          }
        }
      }

      localStorage.removeItem(persistenceKey);
      onSuccess();
    } catch (err: any) {
      console.error('Erro ao salvar usuario:', err);
      setError(err.message || 'Erro ao salvar usuario');
    } finally {
      setLoading(false);
    }
  };

  const currentModules = getModulesByRole(formData.role);
  const isEditingOwner = user ? normalizeRole(user.role) === 'owner' : false;

  const handleCancel = () => {
    localStorage.removeItem(persistenceKey);
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {user ? 'Editar Usuario' : 'Novo Usuario'}
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
                disabled={loading || (!!user && !isOwner())}
              />
              {!!user && !isOwner() && (
                <p className="text-xs text-neutral-500 mt-1">Apenas Owner pode editar o email.</p>
              )}
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
                  placeholder="Minimo 6 caracteres"
                />
              </div>
            )}

            {user && isOwner() && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Resetar Senha</label>
                <input
                  type="password"
                  name="resetPassword"
                  value={formData.resetPassword}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                  minLength={6}
                  placeholder="Nova senha para o usuario"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Informe apenas se quiser redefinir a senha.
                </p>
              </div>
            )}

            {isEditingOwner ? (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Funcao *</label>
                <input
                  type="text"
                  value="Owner (apenas via banco)"
                  disabled
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Funcao *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                >
                  <option value="usuario">Usuario</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="admin">Administrador</option>
                </select>
                <p className="text-xs text-neutral-500 mt-1">Owner apenas via banco.</p>
              </div>
            )}

            <div className="flex items-center mt-2 md:mt-0">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 border-neutral-300 rounded"
                disabled={loading}
              />
              <label className="ml-2 block text-sm text-neutral-700">Usuario ativo</label>
            </div>
          </div>

          <div className="mt-6">
            {isOwner() ? (
              <>
                <h3 className="text-lg font-medium text-neutral-900 mb-2">
                  Modulos permitidos (personalizado)
                </h3>
                <div className="bg-neutral-50 p-3 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-2">
                  {moduleOptions.map((module) => (
                    <label key={module.value} className="flex items-center space-x-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={formData.modules.includes(module.value)}
                        onChange={() => toggleModule(module.value)}
                        className="h-4 w-4 text-primary-600 border-neutral-300 rounded"
                        disabled={loading}
                      />
                      <span>{module.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  Owner pode definir os modulos independente da funcao.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-neutral-900 mb-2">
                  Modulos Permitidos para {roleLabels[formData.role]}
                </h3>
                <div className="bg-neutral-50 p-3 rounded-lg grid grid-cols-2 md:grid-cols-3 gap-2">
                  {currentModules.map((module) => (
                    <div key={module} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-neutral-700">{module}</span>
                    </div>
                  ))}
                  {currentModules.length === 0 && (
                    <p className="text-sm text-neutral-500">Nenhum modulo permitido.</p>
                  )}
                </div>
              </>
            )}
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
