import React, { useEffect, useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ContaAPagar {
  id: string;
  tipo_pagto: string;
  status_documento: string;
  fornecedor: string;
  link?: string | null;
  descricao: string;
  valor: string | number;
  vencimento?: number | null;
  observacoes?: string | null;
  tipo_conta?: 'fixa' | 'avulsa' | 'ressarcimento' | null;
}
type ContaTipo = 'fixa' | 'avulsa' | 'ressarcimento';
interface ContasAPagarFormProps {
  conta?: ContaAPagar | null;
  tipoConta?: ContaTipo;
  onSuccess: () => void;
  onCancel: () => void;
}

const STATUS_OPTIONS = [
  'Nao emitido',
  'Emitido pendente assinatura',
  'Enviado financeiro'
];

const PAGTO_OPTIONS = [
  'BOLETO',
  'CARTAO',
  'PIX',
  'TRANSFERENCIA',
];

const ContasAPagarForm: React.FC<ContasAPagarFormProps> = ({ conta, tipoConta, onSuccess, onCancel }) => {
  const defaultTipoConta: ContaTipo = conta?.tipo_conta === 'avulsa'
    ? 'avulsa'
    : conta?.tipo_conta === 'ressarcimento'
      ? 'ressarcimento'
      : (tipoConta ?? 'fixa');
  const [formData, setFormData] = useState({
    status_documento: STATUS_OPTIONS[0],
    fornecedor: '',
    tipo_pagto: PAGTO_OPTIONS[0],
    link: '',
    descricao: '',
    valor: '',
    vencimento: '',
    observacoes: '',
    tipo_conta: defaultTipoConta
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const persistenceKey = conta ? `contasAPagarForm_edit_${conta.id}` : `contasAPagarForm_new_${defaultTipoConta}`;

  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatBRLFromInput = (input: string) => {
    const digits = input.replace(/\D/g, '');
    if (!digits) return '';
    const numberValue = Number(digits) / 100;
    return formatBRL(numberValue);
  };

  const parseBRLToNumber = (input: string | number) => {
    if (typeof input === 'number') return input;
    const cleaned = input.replace(/[^\d,.-]/g, '');
    if (!cleaned) return Number.NaN;

    const hasComma = cleaned.includes(',');
    const normalized = hasComma
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned;
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const digits = cleaned.replace(/\D/g, '');
    if (!digits) return Number.NaN;
    return Number(digits) / 100;
  };

  useEffect(() => {
    const savedData = localStorage.getItem(persistenceKey);
    if (savedData && savedData !== 'undefined') {
      try {
        const parsedData = JSON.parse(savedData);
        if (parsedData && Object.keys(parsedData).length > 0) {
          setFormData(prev => ({ ...prev, ...parsedData }));
        }
        return;
      } catch (error) {
        console.error('Error loading saved form data:', error);
      }
    }

    if (conta) {
      const parsedValor = parseBRLToNumber(String(conta.valor));
      const storedTipo = (conta.tipo_pagto || '').trim().toUpperCase();
      const normalizedTipoPagto = PAGTO_OPTIONS.includes(storedTipo as any) ? storedTipo : PAGTO_OPTIONS[0];
      const contaTipo: ContaTipo = conta.tipo_conta === 'avulsa'
        ? 'avulsa'
        : conta.tipo_conta === 'ressarcimento'
          ? 'ressarcimento'
          : 'fixa';
      setFormData({
        status_documento: conta.status_documento || STATUS_OPTIONS[0],
        fornecedor: conta.fornecedor || '',
        tipo_pagto: normalizedTipoPagto,
        link: conta.link || '',
        descricao: conta.descricao || '',
        valor: Number.isFinite(parsedValor) ? formatBRL(parsedValor) : '',
        vencimento: conta.vencimento !== null && conta.vencimento !== undefined ? String(conta.vencimento) : '',
        observacoes: conta.observacoes || '',
        tipo_conta: contaTipo
      });
    } else {
      setFormData({
        status_documento: STATUS_OPTIONS[0],
        fornecedor: '',
        tipo_pagto: PAGTO_OPTIONS[0],
        link: '',
        descricao: '',
        valor: '',
        vencimento: '',
        observacoes: '',
        tipo_conta: defaultTipoConta
      });
    }
    setError('');
  }, [conta?.id, defaultTipoConta, persistenceKey]);

  useEffect(() => {
    if (formData.fornecedor || formData.descricao) {
      localStorage.setItem(persistenceKey, JSON.stringify(formData));
    }
  }, [formData, persistenceKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'valor') {
      setFormData(prev => ({ ...prev, valor: formatBRLFromInput(value) }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const parsedValor = parseBRLToNumber(formData.valor);
      if (!Number.isFinite(parsedValor)) {
        setError('Valor invalido');
        return;
      }

      let normalizedVencimento: number | null = null;
      if (formData.vencimento) {
        const rawDay = formData.vencimento.trim();
        const parsedDay = Number(rawDay);
        if (!Number.isFinite(parsedDay) || parsedDay < 1 || parsedDay > 31) {
          setError('Vencimento deve ser um dia entre 1 e 31');
          return;
        }
        normalizedVencimento = Math.trunc(parsedDay);
      }

      const normalizedLink = formData.link ? formData.link.trim() : '';

      const tipoPagto = (formData.tipo_pagto || '').trim().toUpperCase();
      if (!PAGTO_OPTIONS.includes(tipoPagto as any)) {
        setError('Tipo de pagamento inválido');
        return;
      }

      const dataToSave = {
        ...formData,
        valor: parsedValor,
        tipo_pagto: tipoPagto,
        vencimento: normalizedVencimento,
        link: normalizedLink ? normalizedLink : null,
        observacoes: formData.observacoes || null,
        tipo_conta: formData.tipo_conta,
        user_id: user.id,
        updated_at: new Date().toISOString()
      };

      if (conta) {
        const { error } = await supabase
          .from('contas_a_pagar')
          .update(dataToSave)
          .eq('id', conta.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contas_a_pagar')
          .insert([{ ...dataToSave, created_at: new Date().toISOString() }]);
        if (error) throw error;
      }

      localStorage.removeItem(persistenceKey);
      onSuccess();
    } catch (err: any) {
      console.error('Error saving contas a pagar:', err);
      setError(err.message || 'Erro ao salvar conta');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    localStorage.removeItem(persistenceKey);
    setError('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {conta ? 'Editar Conta a Pagar' : `Nova Conta ${formData.tipo_conta === 'avulsa'
              ? 'Avulsa'
              : formData.tipo_conta === 'ressarcimento'
                ? 'Ressarcimento'
                : 'Fixa'}`}
          </h2>
          <button
            onClick={handleCancel}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="tipo_conta" className="block text-sm font-medium text-neutral-700 mb-2">
                  Tipo de Conta *
                </label>
                <select
                  id="tipo_conta"
                  name="tipo_conta"
                  value={formData.tipo_conta}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                  required
                >
                  <option value="fixa">Fixa</option>
                  <option value="avulsa">Avulsa</option>
                  <option value="ressarcimento">Ressarcimento</option>
                </select>
              </div>
              <div>
                <label htmlFor="tipo_pagto" className="block text-sm font-medium text-neutral-700 mb-2">
                  Tipo de Pagamento *
                </label>
                <select
                  id="tipo_pagto"
                  name="tipo_pagto"
                  value={formData.tipo_pagto}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                  required
                >
                  {PAGTO_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="status_documento" className="block text-sm font-medium text-neutral-700 mb-2">
                  Status da Conta *
                </label>
                <select
                  id="status_documento"
                  name="status_documento"
                  value={formData.status_documento}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="fornecedor" className="block text-sm font-medium text-neutral-700 mb-2">
                  Fornecedor *
                </label>
                <input
                  type="text"
                  id="fornecedor"
                  name="fornecedor"
                  required
                  value={formData.fornecedor}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="valor" className="block text-sm font-medium text-neutral-700 mb-2">
                  Valor *
                </label>
                <input
                  type="text"
                  id="valor"
                  name="valor"
                  required
                  value={formData.valor}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="link" className="block text-sm font-medium text-neutral-700 mb-2">
                  Link
                </label>
                <input
                  type="text"
                  id="link"
                  name="link"
                  value={formData.link}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="descricao" className="block text-sm font-medium text-neutral-700 mb-2">
                  Descricao *
                </label>
                <input
                  type="text"
                  id="descricao"
                  name="descricao"
                  required
                  value={formData.descricao}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="vencimento" className="block text-sm font-medium text-neutral-700 mb-2">
                  Vencimento (Dia)
                </label>
                <input
                  type="number"
                  id="vencimento"
                  name="vencimento"
                  min={1}
                  max={31}
                  value={formData.vencimento}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                  placeholder="1-31"
                  inputMode="numeric"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="observacoes" className="block text-sm font-medium text-neutral-700 mb-2">
                  Observacoes
                </label>
                <textarea
                  id="observacoes"
                  name="observacoes"
                  rows={3}
                  value={formData.observacoes}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 px-6 pb-6 pt-4 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-xl hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-button text-white rounded-xl hover:bg-button-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

export default ContasAPagarForm;
