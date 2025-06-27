import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TeamFormProps {
  team: any | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const TeamForm: React.FC<TeamFormProps> = ({ team, onSuccess, onCancel }) => {
  const [login, setLogin] = useState(team?.login || '');
  const [senha, setSenha] = useState(team?.senha || '');
  const [usuario, setUsuario] = useState(team?.usuario || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (team) {
        const { error } = await supabase
          .from('teams')
          .update({ login, senha, usuario })
          .eq('id', team.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('teams')
          .insert([{ login, senha, usuario }]);
        if (error) throw error;
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-xl font-bold mb-4">{team ? 'Editar Team' : 'Novo Team'}</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Login</label>
          <input
            required
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Senha</label>
          <input
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Usuário</label>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button type="button" onClick={onCancel} className="px-3 py-2 bg-neutral-300 rounded">Cancelar</button>
          <button type="submit" disabled={saving} className="px-3 py-2 bg-primary-600 text-white rounded">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeamForm;
