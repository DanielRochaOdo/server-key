import React, { useState, useEffect } from 'react';
import { Plus, Upload, Search, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import TeamForm from '../components/TeamForm';
import FileUpload from '../components/FileUpload';

const Teams: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [viewingTeam, setViewingTeam] = useState<any | null>(null);

  useEffect(() => { fetchTeams(); }, []);

  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
    if (!error) setTeams(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este team?')) return;
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (!error) setTeams(teams.filter(t => t.id !== id));
  };

  const filteredTeams = teams.filter(t =>
    t.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.usuario?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentItems = filteredTeams.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Teams</h1>
        <div className="space-x-2">
          <button onClick={() => setShowUpload(true)} className="bg-white border px-3 py-1 rounded">Importar</button>
          <button onClick={() => setShowForm(true)} className="bg-primary-600 text-white px-3 py-1 rounded">Novo</button>
        </div>
      </div>

      <input
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Buscar..."
        className="border rounded px-3 py-1 mb-3 w-full"
      />

      <table className="w-full border">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border px-2">Login</th>
            <th className="border px-2">Senha</th>
            <th className="border px-2">Usuário</th>
            <th className="border px-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {currentItems.map(t => (
            <tr key={t.id}>
              <td className="border px-2">{t.login}</td>
              <td className="border px-2">{t.senha ? '••••••' : '-'}</td>
              <td className="border px-2">{t.usuario || '-'}</td>
              <td className="border px-2">
                <button onClick={() => setViewingTeam(t)} className="mr-2 text-neutral-600"><Search className="h-4 w-4" /></button>
                <button onClick={() => { setEditingTeam(t); setShowForm(true); }} className="mr-2 text-primary-600"><Edit className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(t.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <TeamForm
          team={editingTeam}
          onSuccess={() => { fetchTeams(); setShowForm(false); setEditingTeam(null); }}
          onCancel={() => { setShowForm(false); setEditingTeam(null); }}
        />
      )}

      {showUpload && (
        <FileUpload
          table="teams"
          columnsMap={{ login: 'login', senha: 'senha', usuario: 'usuario' }}
          onSuccess={() => { fetchTeams(); setShowUpload(false); }}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {viewingTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded p-4">
            <h2 className="text-lg font-bold mb-2">Detalhes</h2>
            <p><strong>Login:</strong> {viewingTeam.login}</p>
            <p><strong>Senha:</strong> {viewingTeam.senha || '-'}</p>
            <p><strong>Usuário:</strong> {viewingTeam.usuario || '-'}</p>
            <button onClick={() => setViewingTeam(null)} className="mt-3 bg-primary-600 text-white px-3 py-1 rounded">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teams;
