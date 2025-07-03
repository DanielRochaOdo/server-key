import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Globe } from 'lucide-react';

interface RateioGoogle {
  id: string;
  nome_completo: string;
  email?: string;
  status?: string;
  ultimo_login?: string;
  armazenamento?: string;
  situacao?: string;
  created_at?: string;
}

const RateioGoogleList: React.FC = () => {
  const [data, setData] = useState<RateioGoogle[]>([]);
  const [loading, setLoading] = useState(false);
  const [dominio, setDominio] = useState('');

  useEffect(() => {
    fetchData();
  }, [dominio]);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('rateio_google')
      .select('id, nome_completo, email, status, ultimo_login, armazenamento, situacao, created_at')
      .order('created_at', { ascending: false });

    if (dominio) {
      query = query.ilike('email', `%@${dominio}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar dados:', error);
      setData([]);
    } else {
      setData(data || []);
    }

    setLoading(false);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Rateio Google</h1>
        <Globe className="h-5 w-5 text-indigo-600" />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Filtrar por domínio (ex: gmail.com)"
          value={dominio}
          onChange={(e) => setDominio(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-64"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow">
          <table className="min-w-full text-sm divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-neutral-700">Nome</th>
                <th className="px-4 py-2 text-left font-semibold text-neutral-700">Email</th>
                <th className="px-4 py-2 text-left font-semibold text-neutral-700">Status</th>
                <th className="px-4 py-2 text-left font-semibold text-neutral-700">Situação</th>
                <th className="px-4 py-2 text-left font-semibold text-neutral-700">Último Login</th>
                <th className="px-4 py-2 text-left font-semibold text-neutral-700">Armazenamento</th>
                <th className="px-4 py-2 text-left font-semibold text-neutral-700">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.length > 0 ? (
                data.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">{item.nome_completo}</td>
                    <td className="px-4 py-2">{item.email}</td>
                    <td className="px-4 py-2">{item.status}</td>
                    <td className="px-4 py-2">{item.situacao}</td>
                    <td className="px-4 py-2">{item.ultimo_login}</td>
                    <td className="px-4 py-2">{item.armazenamento}</td>
                    <td className="px-4 py-2">{formatDate(item.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-neutral-500">
                    Nenhum registro encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RateioGoogleList;
