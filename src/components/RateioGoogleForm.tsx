import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface RateioGoogle {
  id: string;
  nome_completo: string;
  email?: string;
  status?: string;
  ultimo_login?: string;
  armazenamento?: string;
  situacao?: string;
}

interface RateioGoogleFormProps {
  rateio?: RateioGoogle | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const RateioGoogleForm: React.FC<RateioGoogleFormProps> = ({ rateio, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    nome_completo: '',
    email: '',
    status: '',
    ultimo_login: '',
    armazenamento: '',
    situacao: '',
  });
  const [emailSuggestions, setEmailSuggestions] = useState<{ primary_email: string; full_name: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  
  // Persistência de dados do formulário
  const persistenceKey = rateio ? `rateioGoogleForm_edit_${rateio.id}` : 'rateioGoogleForm_new';
  
  // Carregar dados persistidos
  useEffect(() => {
    const savedData = localStorage.getItem(persistenceKey);
    if (savedData && savedData !== 'undefined') {
      try {
        const parsedData = JSON.parse(savedData);
        // Só usar dados salvos se não estiver vazio
        if (parsedData && Object.keys(parsedData).length > 0) {
          setFormData(prev => ({ ...prev, ...parsedData }));
        }
        return;
      } catch (error) {
        console.error('Error loading saved form data:', error);
      }
    }
    
    // Só definir dados iniciais se não há dados salvos
    setFormData(prev => {
      if (rateio) {
        return {
          nome_completo: rateio.nome_completo || '',
          email: rateio.email || '',
          status: rateio.status || '',
          ultimo_login: rateio.ultimo_login || '',
          armazenamento: rateio.armazenamento || '',
          situacao: rateio.situacao || '',
        };
      } else {
        return {
          nome_completo: '',
          email: '',
          status: '',
          ultimo_login: '',
          armazenamento: '',
          situacao: '',
        };
      }
    });
    setError('');
  }, [rateio?.id, persistenceKey]); // Usar rateio.id em vez de rateio completo
  
  // Salvar dados quando formData muda
  useEffect(() => {
    // Só salvar se formData não estiver vazio
    if (formData.nome_completo) {
      localStorage.setItem(persistenceKey, JSON.stringify(formData));
    }
  }, [formData, persistenceKey]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const q = String(formData.email || '').trim().toLowerCase();
    if (q.length < 3) {
      setEmailSuggestions([]);
      return;
    }

    const t = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from('google_workspace_accounts')
        .select('primary_email, full_name')
        .eq('deleted', false)
        .eq('suspended', false)
        .in('domain', ['odontoart.com', 'odontoartonline.com.br'])
        .ilike('primary_email', `%${q}%`)
        .limit(20);

      if (!error) {
        setEmailSuggestions(
          ((data as any[]) || []).map((d) => ({
            primary_email: String(d.primary_email || ''),
            full_name: d.full_name ? String(d.full_name) : null,
          }))
        );
      }
    }, 250);

    return () => window.clearTimeout(t);
  }, [formData.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Usuário não autenticado');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const emailTrimmed = String(formData.email || '').trim().toLowerCase();
      const oldEmailTrimmed = String(rateio?.email || '').trim().toLowerCase();
      const emailChanged = emailTrimmed !== oldEmailTrimmed;

      if (emailTrimmed) {
        const domain = emailTrimmed.split('@')[1]?.toLowerCase() || '';
        const allowedDomains = ['odontoart.com', 'odontoartonline.com.br'];
        if (!allowedDomains.includes(domain)) {
          throw new Error('E-mail fora dos domínios permitidos (@odontoart.com, @odontoartonline.com.br).');
        }

        if (!rateio || emailChanged) {
          const { data: gw, error: gwError } = await supabase
            .from('google_workspace_accounts')
            .select('primary_email, suspended, deleted')
            .eq('primary_email', emailTrimmed)
            .limit(1)
            .maybeSingle();

          if (gwError) throw gwError;
          if (!gw) throw new Error('E-mail não encontrado no Google Workspace (catálogo sincronizado).');
          if ((gw as any).deleted) throw new Error('Este e-mail está marcado como deletado no Google Workspace.');
          if ((gw as any).suspended) throw new Error('Este e-mail está suspenso no Google Workspace.');
        }
      }

      // Best-effort: vincular por user_id interno (users.auth_uid) para sync automático de email no app
      let linkedUserId: string | null | undefined = undefined;
      if (!emailTrimmed) {
        linkedUserId = null;
      } else {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('auth_uid')
          .ilike('email', emailTrimmed)
          .limit(1);

        if (!usersError) {
          const authUid = (usersData as any[])?.[0]?.auth_uid;
          linkedUserId = authUid ? String(authUid) : null;
        }
      }

      const dataToSave = {
        nome_completo: formData.nome_completo,
        email: emailTrimmed || null,
        status: formData.status || null,
        ultimo_login: formData.ultimo_login || null,
        armazenamento: formData.armazenamento || null,
        situacao: formData.situacao || null,
        user_id: user.id,
        updated_at: new Date().toISOString(),
        ...(linkedUserId !== undefined ? { linked_user_id: linkedUserId } : {}),
      };

      if (rateio) {
        // Atualizar registro existente
        const { error } = await supabase
          .from('rateio_google')
          .update(dataToSave)
          .eq('id', rateio.id);
        
        if (error) {
          console.error('Error updating rateio google:', error);
          throw error;
        }
      } else {
        // Criar novo registro
        const { error } = await supabase
          .from('rateio_google')
          .insert([{ 
            ...dataToSave, 
            created_at: new Date().toISOString() 
          }]);
        
        if (error) {
          console.error('Error creating rateio google:', error);
          throw error;
        }
      }

      // Sucesso - chamar callback
      // Limpar dados persistidos após sucesso
      localStorage.removeItem(persistenceKey);
      onSuccess();
    } catch (err: any) {
      console.error('Error saving rateio google:', err);
      setError(err.message || 'Erro ao salvar rateio');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Limpar dados persistidos ao cancelar
    localStorage.removeItem(persistenceKey);
    setError('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {rateio ? 'Editar Rateio Google' : 'Novo Rateio Google'}
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
            <div className="md:col-span-2">
              <label htmlFor="nome_completo" className="block text-sm font-medium text-neutral-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                id="nome_completo"
                name="nome_completo"
                required
                value={formData.nome_completo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
                placeholder="Nome completo do usuário"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                list="workspace-email-suggestions"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
                placeholder="email@exemplo.com"
              />
              <datalist id="workspace-email-suggestions">
                {emailSuggestions.map((opt) => (
                  <option key={opt.primary_email} value={opt.primary_email}>
                    {opt.full_name ?? ''}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-neutral-700 mb-2">
                Status
              </label>
              <input
                type="text"
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
                placeholder="Ex: Ativo, Inativo"
              />
            </div>

            <div>
              <label htmlFor="ultimo_login" className="block text-sm font-medium text-neutral-700 mb-2">
                Último Login
              </label>
              <input
                type="text"
                id="ultimo_login"
                name="ultimo_login"
                value={formData.ultimo_login}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
                placeholder="Ex: 01/01/2024"
              />
            </div>

            <div>
              <label htmlFor="armazenamento" className="block text-sm font-medium text-neutral-700 mb-2">
                Armazenamento
              </label>
              <input
                type="text"
                id="armazenamento"
                name="armazenamento"
                value={formData.armazenamento}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
                placeholder="Ex: 15GB usado de 30GB"
              />
            </div>

            <div>
              <label htmlFor="situacao" className="block text-sm font-medium text-neutral-700 mb-2">
                Situação
              </label>
              <input
                type="text"
                id="situacao"
                name="situacao"
                value={formData.situacao}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
                placeholder="Situação atual"
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
              disabled={loading || !formData.nome_completo.trim()}
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

export default RateioGoogleForm;


