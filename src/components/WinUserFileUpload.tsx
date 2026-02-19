import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { encryptPassword } from '../utils/encryption';

interface WinUserFileUploadProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ParsedRow {
  login?: string;
  senha?: string;
  usuario?: string;
}

const resolveXlsx = async () => {
  const modules = await Promise.allSettled([
    import('xlsx-js-style'),
    import('xlsx')
  ]);
  const candidates: any[] = [];
  for (const result of modules) {
    if (result.status === 'fulfilled') {
      const moduleValue: any = result.value;
      candidates.push(moduleValue, moduleValue?.default, moduleValue?.XLSX, moduleValue?.default?.XLSX);
    }
  }
  candidates.push((globalThis as any).XLSX);

  const xlsx = candidates.find((candidate) =>
    candidate?.read &&
    candidate?.utils?.sheet_to_json
  );

  if (!xlsx) {
    throw new Error('Biblioteca XLSX indisponivel.');
  }

  return xlsx;
};

const WinUserFileUpload: React.FC<WinUserFileUploadProps> = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) return;

        const xlsx = await resolveXlsx();
        const workbook = xlsx.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: ParsedRow[] = xlsx.utils.sheet_to_json(worksheet);

        // Validacao simples
        const validRows = jsonData
          .filter(row => row.login && row.senha && row.usuario)
          .map(row => ({
            ...row,
            senha: encryptPassword(row.senha),
            user_id: user?.id
          }));

        if (validRows.length === 0) {
          setFileError('Arquivo invalido ou sem dados validos');
          return;
        }

        setLoading(true);
        setFileError(null);

        const { error } = await supabase.from('win_users').insert(validRows);
        if (error) throw error;
        onSuccess();
      } catch (error) {
        console.error(error);
        setFileError('Erro ao importar dados');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-neutral-200 p-6 rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Importar Usuarios Windows</h2>
        <input type="file" accept=".xls,.xlsx,.csv" onChange={handleFile} disabled={loading} />
        {fileError && <p className="mt-2 text-red-600">{fileError}</p>}
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Cancelar
          </button>
          {loading && <span className="text-sm text-gray-600">Importando...</span>}
        </div>
      </div>
    </div>
  );
};

export default WinUserFileUpload;

