import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TeamFormProps {
  team?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const TeamForm: React.FC<TeamFormProps> = ({ team, onSuccess, onCancel }) => {
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
    try {
      if (team) {
        const { error } = await supabase.from('teams').update({
          ...formData,
          updated_at: new Date().toISOString(),
        }).eq('id', team.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teams').insert({
          ...formData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      onSuccess();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar o registro.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-lg">
        <h2 className="text-xl font-bold mb-4">{team ? 'Editar Team' : 'Novo Team'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Login</label>
            <input
              name="login"
              value={formData.login}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Senha</label>
            <input
              name="senha"
              value={formData.senha}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Usuário</label>
            <input
              name="usuario"
              value={formData.usuario}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Observação</label>
            <textarea
              name="observacao"
              value={formData.observacao}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Departamento</label>
            <input
              name="departamento"
              value={formData.departamento}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 bg-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-400">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeamForm;
