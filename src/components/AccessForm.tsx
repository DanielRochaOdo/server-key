import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Access {
  id?: string;
  descricao: string;
  para_que_serve?: string;
  ip_url?: string;
  usuario_login?: string;
  senha?: string;
  observacao?: string;
  suporte_contato?: string;
  email?: string;
  data_pagamento?: string;
}

interface AccessFormProps {
  access?: Access | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const AccessForm: React.FC<AccessFormProps> = ({ access, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<Access>({
    descricao: '',
    para_que_serve: '',
    ip_url: '',
    usuario_login: '',
    senha: '',
    observacao: '',
    suporte_contato: '',
    email: '',
    data_pagamento: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (access) {
      setFormData({
        ...access,
        data_pagamento: access.data_pagamento ? access.data_pagamento.split('T')[0] : '',
      });
    }
  }, [access]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.descricao.trim()) {
      setError('Descrição é obrigatória');
      setLoading(false);
      return;
    }

    try {
      const dataToSave = {
        ...formData,
        user_id: user?.id,
        updated_at: new Date().toISOString(),
      };

      if (access?.id) {
        // Update existing
        const { error } = await supabase
          .from('acessos')
          .update(dataToSave)
          .eq('id', access.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('acessos')
          .insert([dataToSave]);

        if (error) throw error;
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving access:', error);
      setError(error.message || 'Erro ao salvar acesso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {access ? 'Editar Acesso' : 'Novo Acesso'}
          </h2>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-600"
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
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ex: Sistema de vendas, Servidor de email..."
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="para_que_serve" className="block text-sm font-medium text-neutral-700 mb-2">
                Para que serve? / Como funciona?
              </label>
              <textarea
                id="para_que_serve"
                name="para_que_serve"
                rows={3}
                value={formData.para_que_serve}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Descreva a funcionalidade e como utilizar..."
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
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="192.168.1.100 ou https://sistema.empresa.com"
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
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="admin, usuario@empresa.com..."
              />
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-neutral-700 mb-2">
                Senha
              </label>
              <input
                type="password"
                id="senha"
                name="senha"
                value={formData.senha}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="••••••••"
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
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="contato@empresa.com"
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
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="(11) 99999-9999, suporte@empresa.com..."
              />
            </div>

            <div>
              <label htmlFor="data_pagamento" className="block text-sm font-medium text-neutral-700 mb-2">
                Data de Pagamento
              </label>
              <input
                type="date"
                id="data_pagamento"
                name="data_pagamento"
                value={formData.data_pagamento}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
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
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Informações adicionais, notas importantes..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-neutral-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-neutral-300 text-sm font-medium rounded-lg text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-button-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {access ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccessForm;