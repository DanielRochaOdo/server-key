import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface FileUploadProps {
  onSuccess: () => void;
  onCancel: () => void;
  table: string;
  columnsMap: Record<string, string>;
}

interface ParsedRow {
  [key: string]: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onSuccess, onCancel, table, columnsMap }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const normalize = (text: string) =>
    text.toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, ' ')
      .trim();

  const mapHeader = (header: string): string | null => {
    const norm = normalize(header);
    if (norm.includes('login')) return columnsMap.login;
    if (norm.includes('senha')) return columnsMap.senha;
    if (['usuario', 'nome', 'name', 'member'].some(k => norm.includes(k))) return columnsMap.usuario;
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
          if (key) row[key] = val?.toString().trim() || '';
        });
        if (row[columnsMap.login]) rows.push(row);
      }

      if (!rows.length) throw new Error('Nenhum dado válido encontrado no arquivo');
      setPreview(rows);
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar arquivo');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.from(table).insert(preview);
      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao importar dados');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">Importar {table}</h2>
          <button onClick={onCancel} className="text-neutral-400 hover:text-neutral-600">
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
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
              {file && (
                <button onClick={parseFile} disabled={loading} className="ml-2 bg-primary-600 text-white px-3 py-1 rounded">
                  {loading ? 'Processando...' : 'Visualizar'}
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm">{preview.length} registros prontos para importação</span>
              </div>
              <button onClick={handleImport} disabled={loading} className="bg-button text-white px-3 py-1 rounded">
                {loading ? 'Importando...' : `Importar ${preview.length} registros`}
              </button>
              <button onClick={() => setShowPreview(false)} className="ml-2 bg-neutral-200 px-3 py-1 rounded">Voltar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
