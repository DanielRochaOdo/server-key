import React, { useState, useEffect, useRef } from 'react';
import { Plus, Upload, Download, Search, Edit, Trash2, Eye, EyeOff, UserCheck, Users, Copy } from 'lucide-react';
import WinUserForm from '../components/WinUserForm';
import WinUserFileUpload from '../components/WinUserFileUpload';
import DashboardStats from '../components/DashboardStats';
import PasswordVerificationModal from '../components/PasswordVerificationModal';
import ModuleHeader from '../components/ModuleHeader';
import { supabase } from '../lib/supabase';
import { usePersistence } from '../contexts/PersistenceContext';
import * as XLSX from 'xlsx';
import { decryptPassword } from '../utils/encryption';

interface WinUser {
  id: string;
  login: string;
  senha: string;
  usuario: string;
  created_at: string;
}

const WinUsers: React.FC = () => {
  const [winUsers, setWinUsers] = useState<WinUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { getState, setState, clearState } = usePersistence();
  
  const [showForm, setShowForm] = useState(() => getState('winusers_showForm') || false);
  const [showUpload, setShowUpload] = useState(() => getState('winusers_showUpload') || false);
  const [editingUser, setEditingUser] = useState<WinUser | null>(() => getState('winusers_editingUser') || null);
  const [searchTerm, setSearchTerm] = useState(() => getState('winusers_searchTerm') || '');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingUser, setViewingUser] = useState<WinUser | null>(() => getState('winusers_viewingUser') || null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingPasswordReveal, setPendingPasswordReveal] = useState<string | null>(null);
  const [showActionPasswordModal, setShowActionPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [pendingActionUser, setPendingActionUser] = useState<WinUser | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchWinUsers();
  }, []);

  // Persist form states
  useEffect(() => {
    setState('winusers_showForm', showForm);
  }, [showForm, setState]);

  useEffect(() => {
    setState('winusers_showUpload', showUpload);
  }, [showUpload, setState]);

  useEffect(() => {
    setState('winusers_editingUser', editingUser);
  }, [editingUser, setState]);

  useEffect(() => {
    setState('winusers_viewingUser', viewingUser);
  }, [viewingUser, setState]);

  useEffect(() => {
    setState('winusers_searchTerm', searchTerm);
  }, [searchTerm, setState]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchWinUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('win_users')
        .select('id, login, senha, usuario, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWinUsers(data || []);
    } catch (error) {
      console.error('Error fetching Usuários Windows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este Usuário Windows?')) return;

    try {
      const { error } = await supabase.from('win_users').delete().eq('id', id);
      if (error) throw error;
      setWinUsers((prev) => prev.filter((user) => user.id !== id));
    } catch (error) {
      console.error('Error deleting Usuário Windows:', error);
      alert('Erro ao excluir Usuário Windows');
    }
  };

  const togglePasswordVisibility = (id: string) => {
    if (visiblePasswords.has(id)) {
      // Hide password
      const newVisible = new Set(visiblePasswords);
      newVisible.delete(id);
      setVisiblePasswords(newVisible);
    } else {
      // Show password - require authentication
      setPendingPasswordReveal(id);
      setShowPasswordModal(true);
    }
  };

  const copyText = React.useCallback(async (value?: string, key?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }
    if (!key) return;
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    setCopiedKey(key);
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 800);
  }, []);

  const handlePasswordVerified = () => {
    if (pendingPasswordReveal) {
      const newVisible = new Set(visiblePasswords);
      newVisible.add(pendingPasswordReveal);
      setVisiblePasswords(newVisible);
      setPendingPasswordReveal(null);
    }
  };

  const requestActionVerification = (action: 'view' | 'edit' | 'delete', user: WinUser) => {
    setPendingAction(action);
    setPendingActionUser(user);
    setShowActionPasswordModal(true);
  };

  const handleActionPasswordVerified = async () => {
    if (!pendingAction || !pendingActionUser) return;
    const action = pendingAction;
    const targetUser = pendingActionUser;

    setShowActionPasswordModal(false);
    setPendingAction(null);
    setPendingActionUser(null);

    if (action === 'view') {
      setViewingUser(targetUser);
      return;
    }

    if (action === 'edit') {
      setEditingUser(targetUser);
      setShowForm(true);
      return;
    }

    await handleDelete(targetUser.id);
  };
  const filteredUsers = React.useMemo(() => {
    return winUsers.filter(
      (user) =>
        user.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.usuario.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [winUsers, searchTerm]);

  const exportData = (format: 'csv' | 'xlsx' | 'template') => {
    if (format === 'template') {
      // Create template with headers only
      const templateData = [{
        login: '',
        senha: '',
        usuario: ''
      }];
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, 'template_usuarios_windows.xlsx', { bookType: 'xlsx' });
    } else {
      // Usar dados filtrados em vez de todos os dados
      const dataToExport = filteredUsers.map(({ id, created_at, ...rest }) => rest);
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'UsuariosWindows');
      
      // Incluir informações sobre filtros no nome do arquivo
      const filterInfo = searchTerm ? `_filtrado` : '';
      const filename = `usuarios_windows${filterInfo}_${new Date().toISOString().slice(0,10)}.${format}`;
      
      if (format === 'csv') {
        XLSX.writeFile(wb, filename, { bookType: 'csv' });
      } else {
        XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
      }
    }
    setShowExportMenu(false);
  };

  const currentItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));

  // Dashboard stats based on filtered data
  const dashboardStats = React.useMemo(() => {
    return [{
      title: 'Total de Usuários',
      value: filteredUsers.length,
      icon: Users,
      color: 'text-primary-600',
      bgColor: 'bg-primary-100',
      description: `${filteredUsers.length} usuário${filteredUsers.length !== 1 ? 's' : ''} cadastrado${filteredUsers.length !== 1 ? 's' : ''}`
    }];
  }, [filteredUsers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <ModuleHeader
        sectionLabel="Acessos"
        title="Usuários Windows"
        subtitle="Gerenciamento de usuários Windows"
        actions={(
          <>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-button bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-button transition-colors hover:bg-button-50 sm:w-auto"
            >
                <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
              Importar
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-button bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-button transition-colors hover:bg-button-50 sm:w-auto"
              >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                Exportar ({filteredUsers.length})
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border border-neutral-200">
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs text-neutral-500 border-b border-neutral-100">
                      {searchTerm ? `Exportando ${filteredUsers.length} registros filtrados` : `Exportando todos os ${filteredUsers.length} registros`}
                    </div>
                    <button
                      onClick={() => exportData('csv')}
                      className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                    >
                      Exportar como CSV
                    </button>
                    <button
                      onClick={() => exportData('xlsx')}
                      className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                    >
                      Exportar como XLSX
                    </button>
                    <button
                      onClick={() => exportData('template')}
                      className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 border-t border-neutral-200"
                    >
                      Baixar Modelo
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-transparent bg-button px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-button-hover sm:w-auto"
            >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
              Novo Usuário
            </button>
          </>
        )}
      />

      {showForm && (
        <WinUserForm
          user={editingUser}
          onSuccess={() => {
            fetchWinUsers();
            setShowForm(false);
            setEditingUser(null);
            clearState('winusers_showForm');
            clearState('winusers_editingUser');
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingUser(null);
            clearState('winusers_showForm');
            clearState('winusers_editingUser');
          }}
        />
      )}

      {showUpload && (
        <WinUserFileUpload
          onSuccess={() => {
            fetchWinUsers();
            setShowUpload(false);
            clearState('winusers_showUpload');
          }}
          onCancel={() => {
            setShowUpload(false);
            clearState('winusers_showUpload');
          }}
        />
      )}

      {/* Dashboard Stats */}
      <DashboardStats stats={dashboardStats} />

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-neutral-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
              />
            </div>
            <div className="flex items-center space-x-2">
              <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
              <span className="text-xs sm:text-sm text-neutral-600">{filteredUsers.length} usuários</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Login</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Senha</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Usuário</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {currentItems.map((user) => (
                <tr key={user.id} className="hover:bg-neutral-50">
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-neutral-900">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate max-w-[100px] sm:max-w-none">{user.login}</span>
                      <button
                        type="button"
                        onClick={() => copyText(user.login, `winusers-login-${user.id}`)}
                        className={`text-neutral-400 hover:text-neutral-600 transition-transform ${
                          copiedKey === `winusers-login-${user.id}` ? 'text-emerald-500 scale-110 animate-pulse' : ''
                        }`}
                        title="Copiar login"
                      >
                        <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-neutral-600">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <span className="font-mono text-xs sm:text-sm">
                        {visiblePasswords.has(user.id) ? decryptPassword(user.senha) : '••••••••'}
                      </span>
                      {visiblePasswords.has(user.id) && (
                        <button
                          type="button"
                          onClick={() => copyText(decryptPassword(user.senha), `winusers-pass-${user.id}`)}
                          className={`text-neutral-400 hover:text-neutral-600 transition-transform ${
                            copiedKey === `winusers-pass-${user.id}` ? 'text-emerald-500 scale-110 animate-pulse' : ''
                          }`}
                          title="Copiar senha"
                        >
                          <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => togglePasswordVisibility(user.id)}
                        className="text-neutral-400 hover:text-neutral-600"
                      >
                        {visiblePasswords.has(user.id) ? (
                          <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" />
                        ) : (
                          <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-neutral-600">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate max-w-[100px] sm:max-w-none">{user.usuario}</span>
                      <button
                        type="button"
                        onClick={() => copyText(user.usuario, `winusers-user-${user.id}`)}
                        className={`text-neutral-400 hover:text-neutral-600 transition-transform ${
                          copiedKey === `winusers-user-${user.id}` ? 'text-emerald-500 scale-110 animate-pulse' : ''
                        }`}
                        title="Copiar usuario"
                      >
                        <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button
                        onClick={() => requestActionVerification('view', user)}
                        className="text-neutral-600 hover:text-neutral-900"
                      >
                        <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        onClick={() => {
                          requestActionVerification('edit', user);
                        }}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        onClick={() => requestActionVerification('delete', user)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center p-3 sm:p-4">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                currentPage === 1 ? 'bg-neutral-200 text-neutral-400' : 'bg-primary-600 text-white'
              }`}
            >
              ← Anterior
            </button>
            <span className="text-xs sm:text-sm text-neutral-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                currentPage === totalPages ? 'bg-neutral-200 text-neutral-400' : 'bg-primary-600 text-white'
              }`}
            >
              Próxima →
            </button>
          </div>
        </div>
      </div>

      {viewingUser && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Detalhes do Usuário Windows</h2>
            <div className="space-y-2 text-xs sm:text-sm text-neutral-700">
              <div>
                <strong>Login:</strong> {viewingUser.login}
              </div>
              <div>
                <strong>Senha:</strong> {decryptPassword(viewingUser.senha)}
              </div>
              <div>
                <strong>Usuário:</strong> {viewingUser.usuario}
              </div>
            </div>
            <div className="mt-4 sm:mt-6 text-right">
              <button
                onClick={() => {
                  setViewingUser(null);
                  clearState('winusers_viewingUser');
                }}
                className="px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-xs sm:text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <PasswordVerificationModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingPasswordReveal(null);
        }}
        onSuccess={handlePasswordVerified}
        title="Verificação de Senha"
        message="Digite sua senha para visualizar a senha do usuário:"
      />

      <PasswordVerificationModal
        isOpen={showActionPasswordModal}
        onClose={() => {
          setShowActionPasswordModal(false);
          setPendingAction(null);
          setPendingActionUser(null);
        }}
        onSuccess={handleActionPasswordVerified}
        title="Verificacao de Senha"
        message={
          pendingAction === 'edit'
            ? "Digite sua senha para editar este usuario:"
            : pendingAction === 'delete'
              ? "Digite sua senha para excluir este usuario:"
              : "Digite sua senha para visualizar os detalhes do usuario:"
        }
      />
      {/* Overlay para fechar menu de exportação */}
      {showExportMenu && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
};

export default WinUsers;


