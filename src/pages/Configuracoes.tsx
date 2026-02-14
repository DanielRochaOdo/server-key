import React, { useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Lock, Mail, Phone, Save, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { normalizeRole, getRoleLabel as getRoleLabelText } from '../utils/roles';
import ModuleHeader from '../components/ModuleHeader';

interface UserProfileData {
  id: string;
  email: string;
  name: string;
  nome?: string;
  telefone?: string;
  role: string;
}

const Configuracoes: React.FC = () => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    fetchUserProfile();
  }, [user?.id]);

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, nome, telefone, role')
        .eq('auth_uid', user.id)
        .single();

      if (error) throw error;

      const email = data.email || user.email || '';
      setProfileData({ ...data, email });
      setFormData(prev => ({
        ...prev,
        nome: data.nome || data.name || '',
        telefone: data.telefone || ''
      }));
    } catch (err) {
      console.error('Error fetching profile data:', err);
      setError('Erro ao carregar dados do perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
  };

  const getRoleLabel = (role: string) => getRoleLabelText(role);

  const getRoleBadgeClass = (role: string) => {
    const normalized = normalizeRole(role);
    if (normalized === 'admin') return 'bg-red-100 text-red-800';
    if (normalized === 'owner') return 'bg-amber-100 text-amber-800';
    if (normalized === 'financeiro') return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  const handleProfileSave = async () => {
    if (!user || !profileData) return;

    const nomeOriginal = profileData.nome || profileData.name || '';
    const telefoneOriginal = profileData.telefone || '';
    const nomeChanged = formData.nome !== nomeOriginal;
    const telefoneChanged = formData.telefone !== telefoneOriginal;

    if (!nomeChanged && !telefoneChanged) {
      setError('Nenhuma alteracao detectada');
      return;
    }

    try {
      setSavingProfile(true);
      setError('');
      setSuccess('');

      const { error } = await supabase
        .from('users')
        .update({
          nome: formData.nome || null,
          telefone: formData.telefone || null,
          updated_at: new Date().toISOString()
        })
        .eq('auth_uid', user.id);

      if (error) throw error;

      setSuccess('Dados atualizados com sucesso!');
      await fetchUserProfile();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Erro ao atualizar dados');
    } finally {
      setSavingProfile(false);
    }
  };

  const updatePasswordWithReauth = async (email: string, currentPassword: string, newPassword: string) => {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const tempClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      }
    });

    const { data, error } = await tempClient.auth.signInWithPassword({
      email,
      password: currentPassword
    });

    if (error || !data.user) {
      await tempClient.auth.signOut();
      return { ok: false, message: 'Senha atual incorreta' };
    }

    const { error: updateError } = await tempClient.auth.updateUser({
      password: newPassword
    });

    await tempClient.auth.signOut();

    if (updateError) {
      return { ok: false, message: updateError.message || 'Erro ao atualizar senha' };
    }

    return { ok: true };
  };

  const handlePasswordSave = async () => {
    if (!user || !profileData) return;

    if (!formData.currentPassword) {
      setError('Informe sua senha atual');
      return;
    }

    if (!formData.newPassword || !formData.confirmPassword) {
      setError('Informe a nova senha e a confirmacao');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Nova senha e confirmacao nao coincidem');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('Nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      setSavingPassword(true);
      setError('');
      setSuccess('');

      const email = profileData.email || user.email || '';
      const result = await updatePasswordWithReauth(
        email,
        formData.currentPassword,
        formData.newPassword
      );

      if (!result.ok) {
        setError(result.message || 'Erro ao atualizar senha');
        return;
      }

      setSuccess('Senha atualizada com sucesso!');
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (err: any) {
      console.error('Error updating password:', err);
      setError(err.message || 'Erro ao atualizar senha');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-neutral-900 mb-2">Erro ao carregar perfil</h3>
        <p className="text-neutral-600">Nao foi possivel carregar seus dados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <ModuleHeader
        sectionLabel="Configuracoes"
        title="Configuracoes"
        subtitle="Gerencie seus dados e credenciais"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-2">
          <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <div className="h-2 w-2 bg-white rounded-full"></div>
          </div>
          <span className="text-sm text-green-700">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-6">
            <Settings className="h-6 w-6 text-primary-600 mr-3" />
            <h2 className="text-xl font-semibold text-neutral-900">Dados do Usuario</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                <Mail className="h-4 w-4 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={profileData.email}
                disabled
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Nome</label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Digite seu nome"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                <Phone className="h-4 w-4 inline mr-1" />
                Telefone
              </label>
              <input
                type="tel"
                name="telefone"
                value={formData.telefone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Role</label>
              <span className={`inline-flex items-center px-3 py-1 text-sm rounded-full ${getRoleBadgeClass(profileData.role)}`}>
                {getRoleLabel(profileData.role)}
              </span>
              <Lock className="h-4 w-4 text-neutral-400 inline ml-2" />
            </div>

            <button
              onClick={handleProfileSave}
              disabled={savingProfile || savingPassword}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-button text-white rounded-lg hover:bg-button-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingProfile ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {savingProfile ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-6">
            <Lock className="h-6 w-6 text-primary-600 mr-3" />
            <h2 className="text-xl font-semibold text-neutral-900">Alterar Senha</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Senha atual</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Digite sua senha atual"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Nova senha</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Digite a nova senha"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Confirmar nova senha</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Confirme a nova senha"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={handlePasswordSave}
              disabled={savingPassword || savingProfile}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingPassword ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              {savingPassword ? 'Alterando...' : 'Alterar senha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
