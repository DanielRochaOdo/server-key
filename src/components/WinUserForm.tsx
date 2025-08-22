import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { hashPassword, isPasswordHashed } from '../utils/encryption';

interface WinUserFormProps {
  user: { id: string; login: string; senha: string; usuario: string } | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const WinUserForm: React.FC<WinUserFormProps> = ({ user, onSuccess, onCancel }) => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [usuario, setUsuario] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setLogin(user.login);
      setSenha(user.senha);
      setUsuario(user.usuario);
    } else {
      setLogin('');
      setSenha('');
      setUsuario('');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let processedPassword = senha;
      
      // Hash password if it's not empty and not already hashed
      if (processedPassword && !isPasswordHashed(processedPassword)) {
        processedPassword = await hashPassword(processedPassword);
      }

      const dataToSave = {
        login,
        senha: processedPassword,
        usuario
      };

      if (user) {
        // Atualizar
        const { error } = await supabase
          .from('win_users')
          .update(dataToSave)
          .eq('id', user.id);
        if (error) throw error;
      } else {
        // Criar novo
        const { error } = await supabase.from('win_users').insert([dataToSave]);
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      console.error('Error saving win user:', err);
      setError(err.message || 'Erro ao salvar usuário Windows');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setError('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {user ? 'Editar' : 'Novo'} Usuário Windows
          </h2>
          <button
            onClick={handleCancel}
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

          <div className="space-y-4">
            <div>
              <label htmlFor="login" className="block text-sm font-medium text-neutral-700 mb-2">
                Login *
              </label>
              <input
                type="text"
                id="login"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-neutral-700 mb-2">
                Senha *
              </label>
              <input
                type="text"
                id="senha"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
              <p className="text-xs text-neutral-500 mt-1">A senha será automaticamente criptografada</p>
            </div>

            <div>
              <label htmlFor="usuario" className="block text-sm font-medium text-neutral-700 mb-2">
                Usuário *
              </label>
              <input
                type="text"
                id="usuario"
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-neutral-200">
            <button
              type="button"
              onClick={handleCancel}
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

export default WinUserForm;
