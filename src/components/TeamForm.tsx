import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { hashPassword, isPasswordHashed } from '../utils/encryption';

interface TeamFormProps {
  team?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const TeamForm: React.FC<TeamFormProps> = ({ team, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    login: '',
    senha: '',
    usuario: '',
    observacao: '',
    departamento: '',
  });

  useEffect(() => {
    if (team) {
      setFormData({
        login: team.login || '',
        senha: team.senha || '',
        usuario: team.usuario || '',
        observacao: team.observacao || '',
        departamento: team.departamento || '',
      });
    }
  }, [team]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      let processedPassword = formData.senha;
      
      // Hash password if it's not empty and not already hashed
      if (processedPassword && !isPasswordHashed(processedPassword)) {
        processedPassword = await hashPassword(processedPassword);
      }

      const dataToSave = {
        ...formData,
        senha: processedPassword,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      if (team) {
        const { error } = await supabase.from('teams').update(dataToSave).eq('id', team.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teams').insert([{ 
          ...dataToSave, 
          created_at: new Date().toISOString() 
        }]);
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      console.error('Error saving team:', err);
      setError(err.message || 'Erro ao salvar team');
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
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {team ? 'Editar Team' : 'Novo Team'}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="login" className="block text-sm font-medium text-neutral-700 mb-2">
                Login *
              </label>
              <input
                type="text"
                id="login"
                name="login"
                required
                value={formData.login}
                onChange={handleChange}
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
                name="senha"
                required
                value={formData.senha}
                onChange={handleChange}
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
                name="usuario"
                required
                value={formData.usuario}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="departamento" className="block text-sm font-medium text-neutral-700 mb-2">
                Departamento
              </label>
              <input
                type="text"
                id="departamento"
                name="departamento"
                value={formData.departamento}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="observacao" className="block text-sm font-medium text-neutral-700 mb-2">
                Observação
              </label>
              <textarea
                id="observacao"
                name="observacao"
                rows={3}
                value={formData.observacao}
                onChange={handleChange}
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

export default TeamForm;
