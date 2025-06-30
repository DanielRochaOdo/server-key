import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Team {
  id: string;
  login: string;
  senha: string;
  usuario: string;
  departamento?: string;  // Adiciona o campo departamento
  observacao?: string;
  created_at: string;
  updated_at: string;
}

interface TeamFormProps {
  team: Team | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const TeamForm: React.FC<TeamFormProps> = ({ team, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    login: '',
    senha: '',
    usuario: '',
    observacao: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { user } = useAuth();

  useEffect(() => {
    if (team) {
      setFormData({
        login: team.login || '',
        senha: team.senha || '',
        usuario: team.usuario || '',
        observacao: team.observacao || ''
      });
    }
  }, [team]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.login.trim()) {
      newErrors.login = 'Login é obrigatório';
    }
    if (!formData.senha.trim()) {
      newErrors.senha = 'Senha é obrigatória';
    }
    if (!formData.usuario.trim()) {
      newErrors.usuario = 'Usuário é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      const teamData = {
        login: formData.login.trim(),
        senha: formData.senha.trim(),
        usuario: formData.usuario.trim(),
        observacao: formData.observacao.trim() || null,
        user_id: user?.id
      };

      if (team) {
        const { error } = await supabase
          .from('teams')
          .update(teamData)
          .eq('id', team.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('teams')
          .insert([teamData]);

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving team:', error);
      alert('Erro ao salvar team. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">
            {team ? 'Editar Team' : 'Novo Team'}
          </h2>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="login" className="block text-sm font-medium text-neutral-700 mb-1">
              Login *
            </label>
            <input
              type="text"
              id="login"
              name="login"
              value={formData.login}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.login ? 'border-red-300' : 'border-neutral-300'
              }`}
              placeholder="Digite o login"
            />
            {errors.login && <p className="mt-1 text-sm text-red-600">{errors.login}</p>}
          </div>

          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-neutral-700 mb-1">
              Senha *
            </label>
            <input
              type="password"
              id="senha"
              name="senha"
              value={formData.senha}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.senha ? 'border-red-300' : 'border-neutral-300'
              }`}
              placeholder="Digite a senha"
            />
            {errors.senha && <p className="mt-1 text-sm text-red-600">{errors.senha}</p>}
          </div>

          <div>
            <label htmlFor="usuario" className="block text-sm font-medium text-neutral-700 mb-1">
              Usuário *
            </label>
            <input
              type="text"
              id="usuario"
              name="usuario"
              value={formData.usuario}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.usuario ? 'border-red-300' : 'border-neutral-300'
              }`}
              placeholder="Digite o nome do usuário"
            />
            {errors.usuario && <p className="mt-1 text-sm text-red-600">{errors.usuario}</p>}
          </div>

          <div>
            <label htmlFor="observacao" className="block text-sm font-medium text-neutral-700 mb-1">
              Observação
            </label>
            <textarea
              id="observacao"
              name="observacao"
              value={formData.observacao}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Observações adicionais (opcional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Departamento</label>
            <input
              type="text"
              value={team.departamento || ''}
              onChange={(e) => setTeam({ ...team, departamento: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />          
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-button text-white rounded-lg hover:bg-button-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeamForm;