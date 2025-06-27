import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

interface FileUploadProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ParsedData {
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

const FileUpload: React.FC<FileUploadProps> = ({ onSuccess, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<ParsedData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (
        validTypes.includes(selectedFile.type) ||
        selectedFile.name.endsWith('.csv') ||
        selectedFile.name.endsWith('.xlsx') ||
        selectedFile.name.endsWith('.xls')
      ) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Apenas arquivos CSV, XLS ou XLSX são aceitos');
        setFile(null);
      }
    }
  };

  const parseFile = async (file: File): Promise<ParsedData[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

    const data: ParsedData[] = [];

    json.forEach((row) => {
      const cleanKey = (key: string) =>
        key
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');

      const normalizedRow: any = {};
      Object.keys(row).forEach((key) => {
        normalizedRow[cleanKey(key)] = row[key];
      });

      const item: ParsedData = {
        descricao: normalizedRow['descricao'] || '',
        para_que_serve: normalizedRow['paraqueservecomofunciona'] || '',
        ip_url: normalizedRow['ipurl'] || '',
        usuario_login: normalizedRow['usuariologin'] || '',
        senha: normalizedRow['senha'] || '',
        observacao: normalizedRow['observacao'] || '',
        suporte_contato: normalizedRow['suportecontato'] || '',
        email: normalizedRow['email'] || '',
        data_pagamento: normalizedRow['datadepagamento'] || normalizedRow['datapagamento'] || ''
      };

      if (item.descricao) {
        data.push(item);
      }
    });

    return data;
  };

  const handlePreview = async () => {
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const parsedData = await parseFile(file);

      if (parsedData.length === 0) {
        throw new Error('Nenhum dado válido encontrado no arquivo');
      }

      setPreview(parsedData);
      setShowPreview(true);
    } catch (error: any) {
      console.error(error);
      setError(error.message || 'Erro ao processar arquivo');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setLoading(true);
    setError('');

    try {
      const dataToInsert = preview.map(item => ({
        ...item,
        user_id: user?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('acessos').insert(dataToInsert);

      if (error) throw error;

      onSuccess();
    } catch (error: any) {
      console.error('Error importing data:', error);
      setError(error.message || 'Erro ao importar dados');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            Importar Acessos
          </h2>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-600"
          >
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
              <div className="mb-6">
                <h3 className="text-lg font-medium text-neutral-900 mb-2">Formato do Arquivo</h3>
                <p className="text-sm text-neutral-600 mb-4">
                  O arquivo deve conter colunas como: DESCRIÇÃO, PARA QUE SERVE / COMO FUNCIONA, IP / URL,
                  USUÁRIO / LOGIN, SENHA, OBSERVAÇÃO, SUPORTE / CONTATO, EMAIL, DATA DE PAGAMENTO. 
                  (A ordem das colunas não importa)
                </p>
              </div>

              <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-neutral-400 mb-4" />
                <div className="mb-4">
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-lg font-medium text-neutral-900">
                      Clique para selecionar um arquivo
                    </span>
                    <span className="block text-sm text-neutral-500 mt-1">
                      ou arraste e solte aqui
                    </span>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-neutral-500">
                  Formatos aceitos: CSV, XLS, XLSX
                </p>
              </div>

              {file && (
                <div className="mt-6 p-4 bg-primary-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-primary-600" />
                    <div>
                      <p className="font-medium text-primary-900">{file.name}</p>
                      <p className="text-sm text-primary-600">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <h3 className="text-lg font-medium text-neutral-900">
                    Preview dos Dados ({preview.length} registros)
                  </h3>
                </div>
                <div className="bg-neutral-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {preview.slice(0, 5).map((item, index) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <div className="font-medium text-neutral-900">{item.descricao}</div>
                        <div className="text-sm text-neutral-600 grid grid-cols-2 gap-2 mt-1">
                          {item.ip_url && <span>IP/URL: {item.ip_url}</span>}
                          {item.usuario_login && <span>Login: {item.usuario_login}</span>}
                          {item.email && <span>Email: {item.email}</span>}
                        </div>
                      </div>
                    ))}
                    {preview.length > 5 && (
                      <div className="text-center text-sm text-neutral-500 py-2">
                        ... e mais {preview.length - 5} registros
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-neutral-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-neutral-300 text-sm font-medium rounded-lg text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancelar
            </button>

            {!showPreview ? (
              <button
                onClick={handlePreview}
                disabled={!file || loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Visualizar
              </button>
            ) : (
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border border-neutral-300 text-sm font-medium rounded-lg text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-button-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Importar {preview.length} registros
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
