import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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

    try {
      if (user) {
        // Atualizar
        const { error } = await supabase
          .from('win_users')
          .update({ login, senha, usuario })
          .eq('id', user.id);
        if (error) throw error;
      } else {
        // Criar novo
        const { error } = await supabase.from('win_users').insert([{ login, senha, usuario }]);
        if (error) throw error;
      }
      onSuccess();
    } catch (error) {
      alert('Erro ao salvar usuário');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg"
      >
        <h2 className="text-xl font-bold mb-4">{user ? 'Editar' : 'Novo'} Usuário Windows</h2>

        <label className="block mb-2 text-sm font-medium text-gray-700">Login</label>
        <input
          type="text"
          required
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
        />

        <label className="block mb-2 text-sm font-medium text-gray-700">Senha</label>
        <input
          type="text"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
        />

        <label className="block mb-2 text-sm font-medium text-gray-700">Usuário</label>
        <input
          type="text"
          required
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
        />

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default WinUserForm;
