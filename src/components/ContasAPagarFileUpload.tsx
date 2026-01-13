import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

interface ContasAPagarFileUploadProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ParsedRow {
  status_documento?: string | null;
  tipo_pagto?: string | null;
  fornecedor?: string | null;
  link?: string | null;
  descricao?: string | null;
  valor?: string | null;
  vencimento?: number | null;
  observacoes?: string | null;
}

const STATUS_OPTIONS = [
  'Nao emitido',
  'Emitido pendente assinatura',
  'Enviado financeiro'
];

const PAGTO_OPTIONS = ['Boleto', 'CARTAO'] as const;

const normalizePagto = (value: string): (typeof PAGTO_OPTIONS)[number] => {
  const norm = normalize(value);
  if (norm.includes('cart')) return 'CARTAO';
  if (norm.includes('boleto') || norm.includes('bol')) return 'Boleto';
  return 'Boleto';
};


const ContasAPagarFileUpload: React.FC<ContasAPagarFileUploadProps> = ({ onSuccess, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { user } = useAuth();

  const normalize = (text: string) =>
    text.toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  const mapHeader = (header: string): string | null => {
    const norm = normalize(header);

    if (norm.includes('status') && norm.includes('documento')) return 'status_documento';
    if (norm.includes('pagamento') || norm.includes('tipo') && norm.includes('pag')) return 'tipo_pagto';
    if (norm.includes('tipo_pagto')) return 'tipo_pagto';
    if (norm.includes('fornecedor') || norm.includes('supplier')) return 'fornecedor';
    if (norm.includes('link') || norm.includes('url')) return 'link';
    if (norm.includes('descricao') || norm.includes('description')) return 'descricao';
    if (norm.includes('valor') || norm.includes('value') || norm.includes('amount')) return 'valor';
    if (norm.includes('vencimento') || norm.includes('due')) return 'vencimento';
    if (norm.includes('observacao') || norm.includes('obs') || norm.includes('notes')) return 'observacoes';

    return null;
  };

  const normalizeStatus = (value: string): string | null => {
    const norm = normalize(value);
    if (norm.includes('nao') && norm.includes('emitido')) return STATUS_OPTIONS[0];
    if (norm.includes('emitido') && norm.includes('pendente')) return STATUS_OPTIONS[1];
    if (norm.includes('enviado') && norm.includes('financeiro')) return STATUS_OPTIONS[2];
    return STATUS_OPTIONS[0];
  };

  const normalizeDay = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    const raw = value.toString().trim();
    if (!raw) return null;

    const numeric = Number(raw);
    if (!Number.isNaN(numeric)) {
      const day = Math.trunc(numeric);
      return day >= 1 && day <= 31 ? day : null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const day = Number(raw.split('-')[2]);
      return day >= 1 && day <= 31 ? day : null;
    }

    const parts = raw.split('/');
    if (parts.length >= 2) {
      const day = Number(parts[0]);
      return day >= 1 && day <= 31 ? day : null;
    }

    return null;
  };

  const normalizeValor = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value.toString();
    const raw = value.toString().trim();
    if (!raw) return '';
    const sanitized = raw.replace(/[^\d,.-]/g, '');
    if (!sanitized) return '';
    const hasComma = sanitized.includes(',');
    const hasDot = sanitized.includes('.');
    if (hasComma && hasDot) {
      return sanitized.replace(/\./g, '').replace(',', '.');
    }
    if (hasComma) {
      return sanitized.replace(',', '.');
    }
    return sanitized;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setError('');
    setShowPreview(false);
    setPreview([]);
  };

  const parseFile = async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      if (json.length < 2) throw new Error('Arquivo vazio ou sem dados.');

      const headers = (json[0] as string[]).map(h => (h || '').toString());
      const rows: ParsedRow[] = [];

      for (let i = 1; i < json.length; i++) {
        const row: ParsedRow = {};
        (json[i] as any[]).forEach((val, idx) => {
          const key = mapHeader(headers[idx]);
          if (key === 'status_documento') {
            const raw = val?.toString().trim() || '';
            row.status_documento = raw ? normalizeStatus(raw) : STATUS_OPTIONS[0];
          } else if (key === 'valor') {
            row.valor = normalizeValor(val);
          } else if (key === 'vencimento') {
            row.vencimento = normalizeDay(val);
          } else if (key) {
            row[key as keyof ParsedRow] = val?.toString().trim() || '';
          } else if (key === 'tipo_pagto') {
            const raw = val?.toString().trim() || '';
            row.tipo_pagto = raw ? normalizePagto(raw) : 'Boleto';
          }
        });

        const hasAnyValue = Object.values(row).some((value) => {
          if (value === null || value === undefined) return false;
          if (typeof value === 'string') return value.trim() !== '';
          return true;
        });

        if (hasAnyValue) {
          rows.push(row);
        }
      }

      if (!rows.length) throw new Error('Nenhum dado valido encontrado no arquivo');
      setPreview(rows.slice(0, 5));
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar arquivo');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !user) return;
    setLoading(true);
    setError('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      const headers = (json[0] as string[]).map(h => (h || '').toString());
      const rows: any[] = [];

      for (let i = 1; i < json.length; i++) {
        const row: ParsedRow = {};
        (json[i] as any[]).forEach((val, idx) => {
          const key = mapHeader(headers[idx]);
          if (key === 'status_documento') {
            const raw = val?.toString().trim() || '';
            row.status_documento = raw ? normalizeStatus(raw) : STATUS_OPTIONS[0];
          } else if (key === 'valor') {
            row.valor = normalizeValor(val);
          } else if (key === 'vencimento') {
            row.vencimento = normalizeDay(val);
          } else if (key) {
            row[key as keyof ParsedRow] = val?.toString().trim() || '';
          } else if (key === 'tipo_pagto') {
            const raw = val?.toString().trim() || '';
            row.tipo_pagto = raw ? normalizePagto(raw) : 'Boleto';
          }
        });

        const hasAnyValue = Object.values(row).some((value) => {
          if (value === null || value === undefined) return false;
          if (typeof value === 'string') return value.trim() !== '';
          return true;
        });

        if (hasAnyValue) {
          const parsedValor = row.valor ? Number(row.valor) : Number.NaN;
          rows.push({
            status_documento: row.status_documento || STATUS_OPTIONS[0],
            fornecedor: row.fornecedor || null,
            tipo_pagto: row.tipo_pagto || 'Boleto',
            link: row.link || null,
            descricao: row.descricao || null,
            valor: Number.isFinite(parsedValor) ? parsedValor : null,
            vencimento: row.vencimento ?? null,
            observacoes: row.observacoes || null,
            user_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      if (!rows.length) throw new Error('Nenhum dado valido para importar');

      const { error } = await supabase.from('contas_a_pagar').insert(rows);
      if (error) throw error;

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao importar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setPreview([]);
    setError('');
    setShowPreview(false);
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">Importar Contas a Pagar</h2>
          <button onClick={handleCancel} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {!showPreview ? (
            <div>
              <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-neutral-400" />
                <div className="mt-4">
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-neutral-900">
                      Clique para selecionar um arquivo
                    </span>
                    <span className="mt-1 block text-sm text-neutral-500">
                      CSV, XLS ou XLSX ate 10MB
                    </span>
                  </label>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".csv,.xls,.xlsx"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {file && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-neutral-400" />
                    <span className="text-sm text-neutral-600">{file.name}</span>
                  </div>
                  <button
                    onClick={parseFile}
                    disabled={loading}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {loading ? 'Processando...' : 'Visualizar'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm">{preview.length} registros prontos para importacao</span>
              </div>

              <div className="overflow-x-auto mb-4">
                <table className="min-w-full divide-y divide-neutral-200 border border-neutral-200 rounded-lg">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Status do Documento</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Pagamento</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Fornecedor</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Descricao</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Valor</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Vencimento</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {preview.map((row, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-neutral-900">{row.status_documento || '-'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.tipo_pagto || 'Boleto'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.fornecedor || '-'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.descricao || '-'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.valor || '-'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.vencimento ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
                >
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="px-4 py-2 bg-button text-white rounded-lg hover:bg-button-hover disabled:opacity-50"
                >
                  {loading ? 'Importando...' : `Importar ${preview.length} registros`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContasAPagarFileUpload;
