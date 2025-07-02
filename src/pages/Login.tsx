import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError('Credenciais inválidas. Verifique seus dados e tente novamente.');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <Shield className="h-10 w-10 sm:h-12 sm:w-12 text-primary-600" />
          </div>
          <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-bold text-primary-900">
            ServerKey
          </h2>
          <p className="mt-1 sm:mt-2 text-sm text-primary-600">
            Sistema de Gerenciamento de Segurança
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
          <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 sm:p-4 flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mt-0.5" />
                <span className="text-xs sm:text-sm text-red-700">{error}</span>
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1 sm:mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm sm:text-base"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1 sm:mb-2">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm sm:text-base"
                  placeholder="Sua senha"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 sm:py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-button-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                ) : (
                  'Entrar'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;