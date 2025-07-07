import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, UserPlus, Search, Edit, Shield, Eye, AlertTriangle } from 'lucide-react';
import UserForm from '../components/UserForm';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  auth_uid: string;
  email: string;
  name: string;
  role: 'admin' | 'financeiro' | 'usuario';
  modules: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const Usuarios: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const { isAdmin, refreshUserProfile } = useAuth();

  const itemsPerPage = 10;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = selectedRole === '' || user.role === selectedRole;

      return matchSearch && matchRole;
    });
  }, [users, searchTerm, selectedRole]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleNewUser = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const handleFormSuccess = async () => {
    await fetchUsers();
    await refreshUserProfile(); // Refresh current user profile in case it was updated
    handleCloseForm();
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    if (!confirm(`Tem certeza que deseja ${currentStatus ? 'desativar' : 'ativar'} este usuário?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_active: !currentStatus } : u))
      );
    } catch (error) {
      console.error('Erro ao alterar status do usuário:', error);
      alert('Erro ao alterar status do usuário');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { label: 'Admin', color: 'bg-red-100 text-red-800' },
      financeiro: { label: 'Financeiro', color: 'bg-blue-100 text-blue-800' },
      usuario: { label: 'Usuário', color: 'bg-green-100 text-green-800' },
    };

    return badges[role as keyof typeof badges] || badges.usuario;
  };

  const moduleLabels = {
    usuarios: 'Usuários',
    acessos: 'Acessos',
    teams: 'Teams',
    win_users: 'Win Users',
    rateio_claro: 'Rateio Claro',
    rateio_google: 'Rateio Google',
  };

  if (!isAdmin()) {
    return (
      <div className="min-h-64 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Acesso Negado</h2>
          <p className="text-neutral-600">Apenas administradores podem gerenciar usuários.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* restante do layout da página */}

      {/* Modal Formulário */}
      {showForm && (
        <UserForm
          user={editingUser}
          onCancel={handleCloseForm}
          onSuccess={handleFormSuccess}
          apiUrl="http://localhost:3001/api/create-user"
        />
      )}

      {/* Modal Visualização */}
      {/* ... já implementado */}
    </div>
  );
};

export default Usuarios;