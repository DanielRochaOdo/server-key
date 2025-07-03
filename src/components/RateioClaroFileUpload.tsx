import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

interface RateioClaroFileUploadProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ParsedRow {
  completo?: string;
  numero_linha?: string;
  responsavel_atual?: string;
  setor?: string;
}

const RateioClaroFileUpload: React.FC<RateioClaroFileUploadProps> = ({ onSuccess, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { user } = useAuth();

  const normalize = (text: string) =>
    text.toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, ' ')
      .trim();

  const mapHeader = (header: string): string | null => {
    const norm = normalize(header);
    
    if (norm.includes('completo') || norm.includes('complete')) return 'completo';
    if (norm.includes('numero') && norm.includes('linha') || norm.includes('line') || norm.includes('phone')) return 'numero_linha';
    if (norm.includes('responsavel') || norm.includes('responsible') || norm.includes('atual')) return 'responsavel_atual';
    if (norm.includes('setor') || norm.includes('department') || norm.includes('sector')) return 'setor';
    
    return null;
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
        (json[i] as string[]).forEach((val, idx) => {
          const key = mapHeader(headers[idx]);
          if (key) row[key as keyof ParsedRow] = val?.toString().trim() || '';
        });
        
        if (row.completo) rows.push(row);
      }

      if (!rows.length) throw new Error('Nenhum dado válido encontrado no arquivo');
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
      const rows: ParsedRow[] = [];

      for (let i = 1; i < json.length; i++) {
        const row: ParsedRow = {};
        (json[i] as string[]).forEach((val, idx) => {
          const key = mapHeader(headers[idx]);
          if (key) row[key as keyof ParsedRow] = val?.toString().trim() || '';
        });
        
        if (row.completo) {
          rows.push({
            ...row,
            user_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any);
        }
      }

      if (!rows.length) throw new Error('Nenhum dado válido para importar');

      const { error } = await supabase.from('rateio_claro').insert(rows);
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
          <h2 className="text-xl font-semibold text-neutral-900">Importar Rateio Claro</h2>
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
                      CSV, XLS ou XLSX até 10MB
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
                <span className="text-sm">{preview.length} registros prontos para importação</span>
              </div>
              
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full divide-y divide-neutral-200 border border-neutral-200 rounded-lg">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Completo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Número da Linha</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Responsável</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Setor</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {preview.map((row, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-neutral-900 max-w-xs truncate">{row.completo}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.numero_linha || '-'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.responsavel_atual || '-'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.setor || '-'}</td>
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

export default RateioClaroFileUpload;
