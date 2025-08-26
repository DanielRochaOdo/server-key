import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface UserData {
  id: string;
  nome: string;
  sobrenome: string;
  email: string;
}

const Cadastro: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  // Pega os dados do usuário logado
  useEffect(() => {
    const fetchUser = async () => {
      const { data: sessionUser } = await supabase.auth.getUser();
      if (sessionUser?.user) {
        const { data, error } = await supabase
          .from('users') // substitua pelo nome da tabela de usuários
          .select('id, nome, sobrenome, email')
          .eq('id', sessionUser.user.id)
          .single();
        if (error) {
          toast.error('Erro ao carregar dados do usuário.');
        } else {
          setUser(data);
          setNome(data.nome);
          setSobrenome(data.sobrenome);
        }
      }
    };
    fetchUser();
  }, []);

  const handleUpdate = async () => {
    if (!user) return;
    setLoading(true);

    // Atualiza nome e sobrenome
    const { error: updateError } = await supabase
      .from('users')
      .update({ nome, sobrenome })
      .eq('id', user.id);

    // Atualiza senha se houver
    let passwordError = null;
    if (senha) {
      const { error } = await supabase.auth.updateUser({
        password: senha,
      });
      passwordError = error;
    }

    setLoading(false);

    if (updateError || passwordError) {
      toast.error('Erro ao atualizar dados.');
    } else {
      toast.success('Dados atualizados com sucesso!');
      setSenha(''); // limpa campo de senha
    }
  };

  if (!user) return <p>Carregando...</p>;

  return (
    <div className="p-4 max-w-md mx-auto bg-white shadow rounded">
      <h2 className="text-xl font-semibold mb-4">Meu Cadastro</h2>

      <label className="block mb-2">
        Nome:
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full border rounded px-2 py-1 mt-1"
        />
      </label>

      <label className="block mb-2">
        Sobrenome:
        <input
          type="text"
          value={sobrenome}
          onChange={(e) => setSobrenome(e.target.value)}
          className="w-full border rounded px-2 py-1 mt-1"
        />
      </label>

      <label className="block mb-2">
        E-mail (não editável):
        <input
          type="email"
          value={user.email}
          disabled
          className="w-full border rounded px-2 py-1 mt-1 bg-gray-100"
        />
      </label>

      <label className="block mb-4">
        Senha:
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Digite nova senha"
          className="w-full border rounded px-2 py-1 mt-1"
        />
      </label>

      <button
        onClick={handleUpdate}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        {loading ? 'Atualizando...' : 'Salvar Alterações'}
      </button>
    </div>
  );
};

export default Cadastro;
