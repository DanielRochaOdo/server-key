import React, { useState } from 'react';
import { X, Eye, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PasswordVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  message?: string;
}

const PasswordVerificationModal: React.FC<PasswordVerificationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = "Verificação de Senha",
  message = "Digite sua senha para visualizar esta informação:"
}) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !password) return;

    setLoading(true);
    setError('');

    try {
      // Create a new Supabase client instance for verification only
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

      // Verify password with temporary client
      const { data, error } = await tempClient.auth.signInWithPassword({
        email: user.email!,
        password: password
      });

      if (error) {
        console.error('Password verification failed:', error);
        setError('Senha incorreta');
      } else if (data.user) {
        // Immediately sign out from the temporary client to avoid session conflicts
        await tempClient.auth.signOut();
        
        // Password is correct, call success callback
        onSuccess();
        handleClose();
      } else {
        setError('Erro na verificação da senha');
      }
    } catch (err) {
      console.error('Error during password verification:', err);
      setError('Erro ao verificar senha');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900 flex items-center">
            <Lock className="h-5 w-5 mr-2 text-primary-600" />
            {title}
          </h2>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-neutral-600"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <p className="text-sm text-neutral-600 mb-4">{message}</p>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
              Sua senha de login
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Digite sua senha de login"
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordVerificationModal;


