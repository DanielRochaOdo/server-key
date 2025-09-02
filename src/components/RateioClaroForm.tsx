import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface RateioClaro {
  id: string;
  nome: string;
  numero_linha?: string;
  responsavel_atual?: string;
  setor?: string;
}

interface RateioClaroFormProps {
  rateio?: RateioClaro | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const RateioClaroForm: React.FC<RateioClaroFormProps> = ({ rateio, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    nome: '',
    numero_linha: '',
    responsavel_atual: '',
    setor: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  
  // Persistência de dados do formulário
  const persistenceKey = rateio ? `rateioClaroForm_edit_${rateio.id}` : 'rateioClaroForm_new';
  
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
          nome: rateio.nome || '',
          numero_linha: rateio.numero_linha || '',
          responsavel_atual: rateio.responsavel_atual || '',
          setor: rateio.setor || '',
        };
      } else {
        return {
          nome: '',
          numero_linha: '',
          responsavel_atual: '',
          setor: '',
        };
      }
    });
    setError('');
  }, [rateio?.id, persistenceKey]); // Usar rateio.id em vez de rateio completo
  
  // Salvar dados quando formData muda
  useEffect(() => {
    // Só salvar se formData não estiver vazio
    if (formData.nome) {
      localStorage.setItem(persistenceKey, JSON.stringify(formData));
    }
  }, [formData, persistenceKey]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const dataToSave = {
        ...formData,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      if (rateio) {
        const { error } = await supabase
          .from('rateio_claro')
          .update(dataToSave)
          .eq('id', rateio.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rateio_claro')
          .insert([{ ...dataToSave, created_at: new Date().toISOString() }]);
        if (error) throw error;
      }

      // Limpar dados persistidos após sucesso
      localStorage.removeItem(persistenceKey);
      onSuccess();
    } catch (err: any) {
      console.error('Error saving rateio claro:', err);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {rateio ? 'Editar Rateio Claro' : 'Novo Rateio Claro'}
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
              <label htmlFor="nome" className="block text-sm font-medium text-neutral-700 mb-2">
                Nome
              </label>
              <input
                type="text"
                id="nome"
                name="nome"
                required
                value={formData.nome}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
                placeholder="Nome completo"
              />
            </div>

            <div>
              <label htmlFor="numero_linha" className="block text-sm font-medium text-neutral-700 mb-2">
                Número da Linha
              </label>
              <input
                type="text"
                id="numero_linha"
                name="numero_linha"
                value={formData.numero_linha}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
                placeholder="Ex: (11) 99999-9999"
              />
            </div>

            <div>
              <label htmlFor="responsavel_atual" className="block text-sm font-medium text-neutral-700 mb-2">
                Responsável Atual
              </label>
              <input
                type="text"
                id="responsavel_atual"
                name="responsavel_atual"
                value={formData.responsavel_atual}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
                placeholder="Nome do responsável"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="setor" className="block text-sm font-medium text-neutral-700 mb-2">
                Setor
              </label>
              <input
                type="text"
                id="setor"
                name="setor"
                value={formData.setor}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
                placeholder="Departamento ou setor"
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

export default RateioClaroForm;
