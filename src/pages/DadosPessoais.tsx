import React, { useState, useEffect } from 'react';
import { User, Save, AlertCircle, Lock, Phone, Mail, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { normalizeRole, getRoleLabel } from '../utils/roles';
import PasswordVerificationModal from '../components/PasswordVerificationModal';

interface UserProfileData {
  id: string;
  email: string;
  name: string;
  nome?: string;
  telefone?: string;
  role: string;
}

const DadosPessoais: React.FC = () => {
  const { user, userProfile } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form states
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'profile' | 'password' | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    fetchUserProfile();
  }, [user]);

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
      
      setProfileData(data);
      setFormData(prev => ({
        ...prev,
        nome: data.nome || data.name || '',
        telefone: data.telefone || ''
      }));
    } catch (error) {
      console.error('Error fetching user profile:', error);
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

  const handleProfileUpdate = () => {
    // Check if any profile fields changed
    const nomeChanged = formData.nome !== (profileData?.nome || profileData?.name || '');
    const telefoneChanged = formData.telefone !== (profileData?.telefone || '');
    
    if (!nomeChanged && !telefoneChanged) {
      setError('Nenhuma alteração detectada nos dados do perfil');
      return;
    }
    
    setPendingAction('profile');
    setShowPasswordModal(true);
  };

  const handlePasswordUpdate = () => {
    if (!formData.newPassword || !formData.confirmPassword) {
      setError('Por favor, preencha a nova senha e confirmação');
      return;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Nova senha e confirmação não coincidem');
      return;
    }
    
    if (formData.newPassword.length < 6) {
      setError('Nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    setPendingAction('password');
    setShowPasswordModal(true);
  };

  const handlePasswordVerified = async () => {
    if (!user || !pendingAction) return;
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      if (pendingAction === 'profile') {
        // Update profile data
        const { error } = await supabase
          .from('users')
          .update({
            nome: formData.nome || null,
            telefone: formData.telefone || null,
            updated_at: new Date().toISOString()
          })
          .eq('auth_uid', user.id);

        if (error) throw error;
        
        setSuccess('Dados do perfil atualizados com sucesso!');
        await fetchUserProfile(); // Refresh data
        
      } else if (pendingAction === 'password') {
        // Update password using Supabase Auth
        const { error } = await supabase.auth.updateUser({
          password: formData.newPassword
        });

        if (error) throw error;
        
        setSuccess('Senha atualizada com sucesso!');
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
      }
    } catch (error: any) {
      console.error('Error updating user data:', error);
      setError(error.message || 'Erro ao atualizar dados');
    } finally {
      setSaving(false);
      setPendingAction(null);
    }
  };

  const getRoleBadge = (role: string) => {
    const normalized = normalizeRole(role);
    const badges = {
      admin: { label: 'Administrador', color: 'bg-red-100 text-red-800' },
      financeiro: { label: 'Financeiro', color: 'bg-blue-100 text-blue-800' },
      usuario: { label: 'Usuario', color: 'bg-green-100 text-green-800' },
    };

    return badges[normalized as keyof typeof badges] || {
      label: getRoleLabel(role) || 'Usuario',
      color: 'bg-green-100 text-green-800',
    };
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
        <p className="text-neutral-600">Não foi possível carregar os dados do seu perfil.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Dados Pessoais</h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-primary-600">
          Gerencie suas informações pessoais e configurações de conta
        </p>
      </div>

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
        {/* Informações do Perfil */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-6">
            <User className="h-6 w-6 text-primary-600 mr-3" />
            <h2 className="text-xl font-semibold text-neutral-900">Informações do Perfil</h2>
          </div>

          <div className="space-y-4">
            {/* Email (não editável) */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                <Mail className="h-4 w-4 inline mr-1" />
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-500 cursor-not-allowed"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <Lock className="h-4 w-4 text-neutral-400" />
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-1">O email não pode ser alterado</p>
            </div>

            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Nome Completo
                <span className="text-neutral-500 font-normal ml-1">(opcional)</span>
              </label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Digite seu nome completo"
              />
              <p className="text-xs text-neutral-500 mt-1">
                <Lock className="h-3 w-3 inline mr-1" />
                Requer confirmação de senha para alterar
              </p>
            </div>

            {/* Telefone */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                <Phone className="h-4 w-4 inline mr-1" />
                Telefone
                <span className="text-neutral-500 font-normal ml-1">(opcional)</span>
              </label>
              <input
                type="tel"
                name="telefone"
                value={formData.telefone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="(11) 99999-9999"
              />
              <p className="text-xs text-neutral-500 mt-1">
                <Lock className="h-3 w-3 inline mr-1" />
                Requer confirmação de senha para alterar
              </p>
            </div>

            {/* Função */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Função no Sistema
              </label>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 text-sm rounded-full ${getRoleBadge(profileData.role).color}`}>
                  {getRoleBadge(profileData.role).label}
                </span>
                <Lock className="h-4 w-4 text-neutral-400" />
              </div>
              <p className="text-xs text-neutral-500 mt-1">A função é definida pelo administrador</p>
            </div>

            <button
              onClick={handleProfileUpdate}
              disabled={saving}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-button text-white rounded-lg hover:bg-button-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* Alteração de Senha */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-6">
            <Lock className="h-6 w-6 text-primary-600 mr-3" />
            <h2 className="text-xl font-semibold text-neutral-900">Alterar Senha</h2>
          </div>

          <div className="space-y-4">
            {/* Senha Atual */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Senha Atual
              </label>
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

            {/* Nova Senha */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Nova Senha
              </label>
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
              <p className="text-xs text-neutral-500 mt-1">Mínimo de 6 caracteres</p>
            </div>

            {/* Confirmar Nova Senha */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Confirmar Nova Senha
              </label>
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
              onClick={handlePasswordUpdate}
              disabled={saving}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </div>
      </div>

      {/* Informações da Conta */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Informações da Conta</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-neutral-50 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-700">Função</p>
            <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${getRoleBadge(profileData.role).color}`}>
              {getRoleBadge(profileData.role).label}
            </span>
          </div>
          <div className="bg-neutral-50 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-700">Status</p>
            <span className="inline-block mt-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
              Ativo
            </span>
          </div>
          <div className="bg-neutral-50 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-700">Módulos Disponíveis</p>
            <p className="text-xs text-neutral-600 mt-1">
              {userProfile?.modules?.length || 0} módulo{(userProfile?.modules?.length || 0) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      <PasswordVerificationModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingAction(null);
        }}
        onSuccess={handlePasswordVerified}
        title="Verificação de Senha"
        message={
          pendingAction === 'profile' 
            ? "Digite sua senha atual para confirmar as alterações no perfil:"
            : "Digite sua senha atual para confirmar a alteração de senha:"
        }
      />
    </div>
  );
};

export default DadosPessoais;