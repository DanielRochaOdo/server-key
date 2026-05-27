import React, { useEffect, useRef, useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { getSupabaseDebugMeta, supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getLocalDateKey, getUsdBrlRate } from '../utils/usdBrlRate';

interface ContaAPagar {
  id: string;
  tipo_pagto: string;
  status_documento: string;
  fornecedor: string;
  link?: string | null;
  descricao: string;
  valor: string | number;
  valor_moeda?: string | number | null;
  moeda?: 'BRL' | 'USD' | null;
  cotacao_usd_brl?: number | string | null;
  cotacao_atualizada_em?: string | null;
  vencimento?: number | null;
  observacoes?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  tipo_de_conta?: string | null;
  cpf_cnpj?: string | null;
  tipo_conta?: 'fixa' | 'avulsa' | 'ressarcimento' | null;
  data_envio_financeiro?: string | null;
}
type ContaTipo = 'fixa' | 'avulsa' | 'ressarcimento';
interface ContasAPagarFormProps {
  conta?: ContaAPagar | null;
  tipoConta?: ContaTipo;
  onSuccess: (updatedConta?: Partial<ContaAPagar> & { id: string }) => void;
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

const requiresBankDetails = (value?: string | null) => {
  const normalized = (value || '').trim().toUpperCase();
  return normalized === 'TRANSFERENCIA' || normalized === 'PIX';
};

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
    banco: '',
    agencia: '',
    conta: '',
    tipo_de_conta: '',
    cpf_cnpj: '',
    link: '',
    descricao: '',
    valor: '',
    vencimento: '',
    observacoes: '',
    tipo_conta: defaultTipoConta
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const linkInputRef = useRef<HTMLInputElement | null>(null);
  const { user, hasModuleEditAccess } = useAuth();
  const [isUsd, setIsUsd] = useState(false);

  const persistenceKey = conta ? `contasAPagarForm_edit_${conta.id}` : `contasAPagarForm_new_${defaultTipoConta}`;

  const formatCurrency = (value: number, currency: 'BRL' | 'USD') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency
    }).format(value);
  };

  const formatCurrencyFromInput = (input: string, currency: 'BRL' | 'USD') => {
    const digits = input.replace(/\D/g, '');
    if (!digits) return '';
    const numberValue = Number(digits) / 100;
    return formatCurrency(numberValue, currency);
  };

  const parseCurrencyToNumber = (input: string | number) => {
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
    if (conta) {
      const savedData = localStorage.getItem(persistenceKey);
      if (savedData && savedData !== 'undefined') {
        console.log('[ContasAPagarForm] edit:ignoringPersistedDraft', {
          contaId: conta.id,
          persistenceKey,
        });
      }
      const moedaConta = (conta.moeda || 'BRL').toUpperCase() === 'USD' ? 'USD' : 'BRL';
      setIsUsd(moedaConta === 'USD');
      const baseValor = moedaConta === 'USD'
        ? (conta.valor_moeda ?? conta.valor)
        : conta.valor;
      const parsedValor = parseCurrencyToNumber(String(baseValor));
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
        banco: conta.banco || '',
        agencia: conta.agencia || '',
        conta: conta.conta || '',
        tipo_de_conta: conta.tipo_de_conta || '',
        cpf_cnpj: conta.cpf_cnpj || '',
        link: conta.link || '',
        descricao: conta.descricao || '',
        valor: Number.isFinite(parsedValor) ? formatCurrency(parsedValor, moedaConta) : '',
        vencimento: conta.vencimento !== null && conta.vencimento !== undefined ? String(conta.vencimento) : '',
        observacoes: conta.observacoes || '',
        tipo_conta: contaTipo
      });
      console.log('[ContasAPagarForm] edit:loadContaIntoForm', {
        contaId: conta.id,
        linkFromConta: conta.link || '',
      });
    } else {
      const savedData = localStorage.getItem(persistenceKey);
      if (savedData && savedData !== 'undefined') {
        try {
          const parsedData = JSON.parse(savedData);
          if (parsedData && Object.keys(parsedData).length > 0) {
            const savedMoeda = (parsedData.moeda || 'BRL').toUpperCase();
            setIsUsd(savedMoeda === 'USD');
            const rest = { ...parsedData };
            delete rest.moeda;
            setFormData(prev => ({ ...prev, ...rest }));
            setError('');
            return;
          }
        } catch (error) {
          console.error('Error loading saved form data:', error);
        }
      }
      setIsUsd(false);
      setFormData({
        status_documento: STATUS_OPTIONS[0],
        fornecedor: '',
        tipo_pagto: PAGTO_OPTIONS[0],
        banco: '',
        agencia: '',
        conta: '',
        tipo_de_conta: '',
        cpf_cnpj: '',
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
    if (!conta && (formData.fornecedor || formData.descricao)) {
      localStorage.setItem(
        persistenceKey,
        JSON.stringify({
          ...formData,
          moeda: isUsd ? 'USD' : 'BRL',
        })
      );
    }
  }, [formData, isUsd, persistenceKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'link') {
      console.log('[ContasAPagarForm] link:onChange', {
        contaId: conta?.id || null,
        rawValue: value,
      });
    }
    if (name === 'valor') {
      setFormData(prev => ({
        ...prev,
        valor: formatCurrencyFromInput(value, isUsd ? 'USD' : 'BRL')
      }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    console.log('[ContasAPagarForm] link:onChange', {
      contaId: conta?.id || null,
      rawValue: value,
    });
    setFormData((prev) => ({ ...prev, link: value }));
  };

  const handleToggleUsd = () => {
    setIsUsd((prev) => {
      const next = !prev;
      const parsedValor = parseCurrencyToNumber(formData.valor);
      if (Number.isFinite(parsedValor)) {
        setFormData((current) => ({
          ...current,
          valor: formatCurrency(parsedValor, next ? 'USD' : 'BRL'),
        }));
      }
      return next;
    });
  };

  const showTransferFields = requiresBankDetails(formData.tipo_pagto);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!hasModuleEditAccess('contas_a_pagar')) {
      setError('Voce nao tem permissao para editar este modulo.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const parsedValor = parseCurrencyToNumber(formData.valor);
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

      const rawLinkInput = formData.link ? formData.link.trim() : '';
      const rawLinkFromRef = linkInputRef.current?.value?.trim() || '';
      const effectiveRawLink = rawLinkInput || rawLinkFromRef;
      if (rawLinkFromRef && rawLinkInput !== rawLinkFromRef) {
        console.warn('[ContasAPagarForm] link:stateRefMismatch', {
          contaId: conta?.id || null,
          rawLinkInput,
          rawLinkFromRef,
        });
      }
      const normalizedLink = effectiveRawLink;

      const tipoPagto = (formData.tipo_pagto || '').trim().toUpperCase();
      if (!PAGTO_OPTIONS.includes(tipoPagto as any)) {
        setError('Tipo de pagamento inválido');
        return;
      }

      if (requiresBankDetails(tipoPagto)) {
        const requiredTransferFields = [
          formData.banco,
          formData.agencia,
          formData.conta,
          formData.tipo_de_conta,
          formData.cpf_cnpj,
        ].map((value) => (value || '').trim());
        const hasAnyTransferField = requiredTransferFields.some((value) => value.length > 0);
        const hasAllTransferFields = requiredTransferFields.every((value) => value.length > 0);

        // Em edição, preserva compatibilidade com registros legados incompletos:
        // só exige todos os campos se o usuário começou a preencher dados bancários.
        if ((!conta || hasAnyTransferField) && !hasAllTransferFields) {
          setError('Preencha Nome do Banco, Agencia, Conta, Tipo de Conta e CPF/CNPJ/Chave PIX para PIX ou Transferencia.');
          return;
        }
      }

      let valorFinal = parsedValor;
      let cotacaoUsd: number | null = null;
      let cotacaoDate: string | null = null;
      const moeda = isUsd ? 'USD' : 'BRL';

      if (isUsd) {
        try {
          const rate = await getUsdBrlRate({ forceRefresh: true });
          cotacaoUsd = rate;
          cotacaoDate = getLocalDateKey();
          valorFinal = Math.round(parsedValor * rate * 100) / 100;
        } catch (rateError) {
          console.error('Erro ao obter cotacao USD/BRL:', rateError);
          setError('Falha ao obter a cotacao do dolar.');
          return;
        }
      }

      const baseDataToSave = {
        data_envio_financeiro: (() => {
          const previousStatus = conta?.status_documento || null;
          const previousSendDate = conta?.data_envio_financeiro || null;
          const currentStatus = formData.status_documento || null;
          if (currentStatus === STATUS_OPTIONS[2]) {
            if (previousStatus === STATUS_OPTIONS[2] && previousSendDate) {
              return previousSendDate;
            }
            return new Date().toISOString();
          }
          return null;
        })(),
        ...formData,
        valor: valorFinal,
        valor_moeda: parsedValor,
        moeda,
        cotacao_usd_brl: cotacaoUsd,
        cotacao_atualizada_em: cotacaoDate,
        tipo_pagto: tipoPagto,
        vencimento: normalizedVencimento,
        link: normalizedLink ? normalizedLink : null,
        observacoes: formData.observacoes || null,
        banco: formData.banco.trim() || null,
        agencia: formData.agencia.trim() || null,
        conta: formData.conta.trim() || null,
        tipo_de_conta: formData.tipo_de_conta.trim() || null,
        cpf_cnpj: formData.cpf_cnpj.trim() || null,
        tipo_conta: formData.tipo_conta,
        updated_at: new Date().toISOString()
      };
      const updateDataToSave = {
        status_documento: baseDataToSave.status_documento,
        fornecedor: baseDataToSave.fornecedor,
        tipo_pagto: baseDataToSave.tipo_pagto,
        banco: baseDataToSave.banco,
        agencia: baseDataToSave.agencia,
        conta: baseDataToSave.conta,
        tipo_de_conta: baseDataToSave.tipo_de_conta,
        cpf_cnpj: baseDataToSave.cpf_cnpj,
        link: baseDataToSave.link,
        descricao: baseDataToSave.descricao,
        valor: baseDataToSave.valor,
        valor_moeda: baseDataToSave.valor_moeda,
        moeda: baseDataToSave.moeda,
        cotacao_usd_brl: baseDataToSave.cotacao_usd_brl,
        cotacao_atualizada_em: baseDataToSave.cotacao_atualizada_em,
        vencimento: baseDataToSave.vencimento,
        observacoes: baseDataToSave.observacoes,
        tipo_conta: baseDataToSave.tipo_conta,
        data_envio_financeiro: baseDataToSave.data_envio_financeiro,
        updated_at: baseDataToSave.updated_at,
      };
      console.log('[ContasAPagarForm] link:beforeUpdate', JSON.stringify({
        contaId: conta?.id || null,
        rawLinkInput: formData.link,
        rawLinkFromRef,
        effectiveRawLink,
        normalizedLink,
        payloadLink: updateDataToSave.link,
      }, null, 2));

      let updatedContaForUi: (Partial<ContaAPagar> & { id: string }) | undefined;

      if (conta) {
        console.log('[ContasAPagarForm] update:start', {
          source: { schema: 'public', table: 'contas_a_pagar', eqField: 'id' },
          supabase: getSupabaseDebugMeta(),
          contaId: conta.id,
          payload: updateDataToSave,
        });
        const { data, error } = await supabase
          .from('contas_a_pagar')
          .update(updateDataToSave)
          .eq('id', conta.id)
          .select('id, link')
          .single();
        console.log('[ContasAPagarForm] update:result', { data, error });
        if (error) throw error;
        if (!data || !(data as any).id) {
          throw new Error('Nenhum registro foi atualizado. Seu usuário pode estar sem permissão de edição para esta conta.');
        }
        const { data: persistedConta, error: persistedContaError } = await supabase
          .from('contas_a_pagar')
          .select(`
            id,
            tipo_pagto,
            status_documento,
            fornecedor,
            link,
            descricao,
            valor,
            valor_moeda,
            moeda,
            cotacao_usd_brl,
            cotacao_atualizada_em,
            vencimento,
            observacoes,
            banco,
            agencia,
            conta,
            tipo_de_conta,
            cpf_cnpj,
            tipo_conta,
            data_envio_financeiro,
            updated_at
          `)
          .eq('id', conta.id)
          .single();
        console.log('[ContasAPagarForm] update:readback', {
          source: { schema: 'public', table: 'contas_a_pagar', eqField: 'id' },
          contaId: conta.id,
          persistedConta,
          persistedContaError,
        });
        if (persistedContaError) throw persistedContaError;
        if (!persistedConta) {
          throw new Error('Falha ao validar persistencia da conta apos salvar.');
        }

        const expectedLink = updateDataToSave.link || null;
        const persistedLink = persistedConta.link || null;
        const expectedDescricao = updateDataToSave.descricao || null;
        const persistedDescricao = persistedConta.descricao || null;
        const expectedStatus = updateDataToSave.status_documento || null;
        const persistedStatus = persistedConta.status_documento || null;

        if (
          expectedLink !== persistedLink ||
          expectedDescricao !== persistedDescricao ||
          expectedStatus !== persistedStatus
        ) {
          console.error('Persistencia divergente em contas_a_pagar', {
            contaId: conta.id,
            expected: {
              link: expectedLink,
              descricao: expectedDescricao,
              status_documento: expectedStatus,
            },
            persisted: {
              link: persistedLink,
              descricao: persistedDescricao,
              status_documento: persistedStatus,
            },
          });
          throw new Error('Os dados nao foram persistidos no banco como esperado. Tente novamente.');
        }
        console.log('[ContasAPagarForm] update:validated', {
          contaId: conta.id,
          expected: { link: expectedLink, descricao: expectedDescricao, status_documento: expectedStatus },
          persisted: { link: persistedLink, descricao: persistedDescricao, status_documento: persistedStatus },
        });
        updatedContaForUi = {
          id: persistedConta.id as any,
          tipo_pagto: persistedConta.tipo_pagto as any,
          status_documento: persistedConta.status_documento as any,
          fornecedor: persistedConta.fornecedor as any,
          link: persistedConta.link as any,
          descricao: persistedConta.descricao as any,
          valor: persistedConta.valor as any,
          valor_moeda: persistedConta.valor_moeda as any,
          moeda: persistedConta.moeda as any,
          cotacao_usd_brl: persistedConta.cotacao_usd_brl as any,
          cotacao_atualizada_em: persistedConta.cotacao_atualizada_em as any,
          vencimento: persistedConta.vencimento as any,
          observacoes: persistedConta.observacoes as any,
          banco: persistedConta.banco as any,
          agencia: persistedConta.agencia as any,
          conta: persistedConta.conta as any,
          tipo_de_conta: persistedConta.tipo_de_conta as any,
          cpf_cnpj: persistedConta.cpf_cnpj as any,
          tipo_conta: persistedConta.tipo_conta as any,
          data_envio_financeiro: persistedConta.data_envio_financeiro as any,
          updated_at: (persistedConta.updated_at as any) || updateDataToSave.updated_at,
        };
      } else {
        const { error } = await supabase
          .from('contas_a_pagar')
          .insert([{
            ...baseDataToSave,
            user_id: user.id,
            created_at: new Date().toISOString()
          }]);
        if (error) throw error;
      }

      localStorage.removeItem(persistenceKey);
      console.log('[ContasAPagarForm] save:success -> onSuccess()');
      onSuccess(updatedContaForUi);
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

  useEffect(() => {
    if (!error) return;
    const node = scrollContainerRef.current;
    if (!node) return;
    node.scrollTo({ top: 0, behavior: 'smooth' });
  }, [error]);

  return (
    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-200 rounded-2xl border border-neutral-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-6">
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
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
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
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                  required
                >
                  {PAGTO_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {showTransferFields && (
                <>
                  <div>
                    <label htmlFor="banco" className="block text-sm font-medium text-neutral-700 mb-2">
                      Nome do Banco *
                    </label>
                    <input
                      type="text"
                      id="banco"
                      name="banco"
                      value={formData.banco}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                      disabled={loading}
                      required={showTransferFields}
                    />
                  </div>
                  <div>
                    <label htmlFor="agencia" className="block text-sm font-medium text-neutral-700 mb-2">
                      Agencia *
                    </label>
                    <input
                      type="text"
                      id="agencia"
                      name="agencia"
                      value={formData.agencia}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                      disabled={loading}
                      required={showTransferFields}
                    />
                  </div>
                  <div>
                    <label htmlFor="conta" className="block text-sm font-medium text-neutral-700 mb-2">
                      Conta *
                    </label>
                    <input
                      type="text"
                      id="conta"
                      name="conta"
                      value={formData.conta}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                      disabled={loading}
                      required={showTransferFields}
                    />
                  </div>
                  <div>
                    <label htmlFor="tipo_de_conta" className="block text-sm font-medium text-neutral-700 mb-2">
                      Tipo de Conta *
                    </label>
                    <input
                      type="text"
                      id="tipo_de_conta"
                      name="tipo_de_conta"
                      value={formData.tipo_de_conta}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                      disabled={loading}
                      required={showTransferFields}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="cpf_cnpj" className="block text-sm font-medium text-neutral-700 mb-2">
                      CPF/CNPJ/Chave PIX *
                    </label>
                    <input
                      type="text"
                      id="cpf_cnpj"
                      name="cpf_cnpj"
                      value={formData.cpf_cnpj}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                      disabled={loading}
                      required={showTransferFields}
                    />
                  </div>
                </>
              )}
              <div className="md:col-span-2">
                <label htmlFor="status_documento" className="block text-sm font-medium text-neutral-700 mb-2">
                  Status da Conta *
                </label>
                <select
                  id="status_documento"
                  name="status_documento"
                  value={formData.status_documento}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
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
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="valor" className="block text-sm font-medium text-neutral-700 mb-2">
                  Valor *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    id="valor"
                    name="valor"
                    required
                    value={formData.valor}
                    onChange={handleChange}
                    className="flex-1 rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                    disabled={loading}
                    inputMode="numeric"
                    placeholder={isUsd ? 'US$ 0,00' : 'R$ 0,00'}
                  />
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700">
                    <input
                      type="checkbox"
                      checked={isUsd}
                      onChange={handleToggleUsd}
                      disabled={loading}
                      className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-200"
                    />
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-sm font-semibold text-neutral-700">
                      $
                    </span>
                  </label>
                </div>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="link" className="block text-sm font-medium text-neutral-700 mb-2">
                  Link
                </label>
                <input
                  type="text"
                  id="link"
                  name="link"
                  ref={linkInputRef}
                  value={formData.link}
                  onChange={handleLinkChange}
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
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
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
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
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
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
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-200 px-3 py-2 uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-4 border-t border-neutral-200 bg-neutral-200/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-xl hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContasAPagarForm;
