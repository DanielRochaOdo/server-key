import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { hashPassword, isPasswordHashed } from '../utils/encryption';

interface Pessoal {
  id: string;
  descricao: string;
  para_que_serve?: string;
  ip_url?: string;
  usuario_login?: string;
  senha?: string;
  observacao?: string;
  suporte_contato?: string;
  email?: string;
  dia_pagamento?: number;
}

interface PessoalFormProps {
  pessoal?: Pessoal | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const PessoalForm: React.FC<PessoalFormProps> = ({ pessoal, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    descricao: '',
    para_que_serve: '',
    ip_url: '',
    usuario_login: '',
    senha: '',
    observacao: '',
    suporte_contato: '',
    email: '',
    dia_pagamento: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (pessoal) {
      setFormData({
        descricao: pessoal.descricao || '',
        para_que_serve: pessoal.para_que_serve || '',
        ip_url: pessoal.ip_url || '',
        usuario_login: pessoal.usuario_login || '',
        senha: pessoal.senha || '',
        observacao: pessoal.observacao || '',
        suporte_contato: pessoal.suporte_contato || '',
        email: pessoal.email || '',
        dia_pagamento: pessoal.dia_pagamento || 0,
      });
    } else {
      setFormData({
        descricao: '',
        para_que_serve: '',
        ip_url: '',
        usuario_login: '',
        senha: '',
        observacao: '',
        suporte_contato: '',
        email: '',
        dia_pagamento: 0,
      });
    }
    setError('');
  }, [pessoal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'number' ? parseInt(value) || 0 : value 
    }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: parseInt(value) || 0 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Usuário não autenticado');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('💾 Saving pessoal data for user:', user.id);
      let processedPassword = formData.senha;
      
      // Hash password if it's not empty and not already hashed
      if (processedPassword && !isPasswordHashed(processedPassword)) {
        processedPassword = await hashPassword(processedPassword);
      }

      const dataToSave = {
        ...formData,
        senha: processedPassword || null,
        dia_pagamento: formData.dia_pagamento || null,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      if (pessoal) {
        console.log('📝 Updating existing pessoal record');
        const { error } = await supabase
          .from('pessoal')
          .update(dataToSave)
          .eq('id', pessoal.id)
          .eq('user_id', user.id); // Garantir que só atualiza próprios dados
        if (error) throw error;
      } else {
        console.log('➕ Creating new pessoal record');
        const { error } = await supabase
          .from('pessoal')
          .insert([{ ...dataToSave, created_at: new Date().toISOString() }]);
        if (error) throw error;
      }

      console.log('✅ Pessoal data saved successfully');
      onSuccess();
    } catch (err: any) {
      console.error('Error saving pessoal:', err);
      setError(err.message || 'Erro ao salvar item pessoal');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setError('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {pessoal ? 'Editar Item Pessoal' : 'Novo Item Pessoal'}
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
              <label htmlFor="descricao" className="block text-sm font-medium text-neutral-700 mb-2">
                Descrição *
              </label>
              <input
                type="text"
                id="descricao"
                name="descricao"
                required
                value={formData.descricao}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="para_que_serve" className="block text-sm font-medium text-neutral-700 mb-2">
                Para que serve / Como funciona?
              </label>
              <textarea
                id="para_que_serve"
                name="para_que_serve"
                rows={3}
                value={formData.para_que_serve}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="ip_url" className="block text-sm font-medium text-neutral-700 mb-2">
                IP / URL
              </label>
              <input
                type="text"
                id="ip_url"
                name="ip_url"
                value={formData.ip_url}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="usuario_login" className="block text-sm font-medium text-neutral-700 mb-2">
                Usuário / Login
              </label>
              <input
                type="text"
                id="usuario_login"
                name="usuario_login"
                value={formData.usuario_login}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-neutral-700 mb-2">
                Senha
              </label>
              <input
                type="text"
                id="senha"
                name="senha"
                value={formData.senha}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
              <p className="text-xs text-neutral-500 mt-1">A senha será automaticamente criptografada</p>
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
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="suporte_contato" className="block text-sm font-medium text-neutral-700 mb-2">
                Suporte / Contato
              </label>
              <input
                type="text"
                id="suporte_contato"
                name="suporte_contato"
                value={formData.suporte_contato}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="dia_pagamento" className="block text-sm font-medium text-neutral-700 mb-2">
                Dia de Pagamento
              </label>
              <select
                id="dia_pagamento"
                name="dia_pagamento"
                value={formData.dia_pagamento}
                onChange={handleSelectChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              >
                <option value={0}>Selecione o dia</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>
                    Dia {day}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="observacao" className="block text-sm font-medium text-neutral-700 mb-2">
                Observação
              </label>
              <textarea
                id="observacao"
                name="observacao"
                rows={3}
                value={formData.observacao}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
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
              disabled={loading}
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

export default PessoalForm;