import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

interface RateioGoogleFileUploadProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ParsedRow {
  nome_completo?: string;
  email?: string;
  status?: string;
  ultimo_login?: string; // já formatado para exibição
  armazenamento?: string;
  situacao?: string;
}

const RateioGoogleFileUpload: React.FC<RateioGoogleFileUploadProps> = ({ onSuccess, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { user } = useAuth();

  const excelDateToISO = (val: any): string => {
    const num = Number(val);
    if (!isNaN(num)) {
      const excelEpoch = new Date(1900, 0, 0);
      excelEpoch.setDate(excelEpoch.getDate() + num - 1);
      return excelEpoch.toISOString().split('T')[0]; // aaaa-mm-dd
    }
    return '';
  };

  const isoToDisplayDate = (isoDate: string): string => {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
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

      const rows: ParsedRow[] = [];

      for (let i = 1; i < json.length; i++) {
        const rowArray = json[i] as any[];

        let isoDate = excelDateToISO(rowArray[3]);
        let displayDate = isoToDisplayDate(isoDate);

        const row: ParsedRow = {
          nome_completo: rowArray[0]?.toString().trim() || '',
          email: rowArray[1]?.toString().trim() || '',
          status: rowArray[2]?.toString().trim() || '',
          ultimo_login: displayDate || '',
          armazenamento: rowArray[4]?.toString().trim() || '',
          situacao: rowArray[5]?.toString().trim() || '',
        };

        if (row.nome_completo) rows.push(row);
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

      const rows: any[] = [];

      for (let i = 1; i < json.length; i++) {
        const rowArray = json[i] as any[];

        const row = {
          nome_completo: rowArray[0]?.toString().trim() || '',
          email: rowArray[1]?.toString().trim() || '',
          status: rowArray[2]?.toString().trim() || '',
          ultimo_login: excelDateToISO(rowArray[3]),
          armazenamento: rowArray[4]?.toString().trim() || '',
          situacao: rowArray[5]?.toString().trim() || '',
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (row.nome_completo) rows.push(row);
      }

      if (!rows.length) throw new Error('Nenhum dado válido para importar');

      const { error } = await supabase.from('rateio_google').insert(rows);
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
          <h2 className="text-xl font-semibold text-neutral-900">Importar Rateio Google</h2>
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
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Nome Completo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Último Login</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Armazenamento</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {preview.map((row, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-neutral-900 max-w-xs truncate">{row.nome_completo}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.email || '-'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.status || '-'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.ultimo_login || '-'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.armazenamento || '-'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{row.situacao || '-'}</td>
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

export default RateioGoogleFileUpload;
