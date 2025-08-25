import React, { useState } from 'react';
import * as XLSX from 'xlsx';
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

const WinUserFileUpload: React.FC<WinUserFileUploadProps> = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (evt) => {
      const data = evt.target?.result;
      if (!data) return;

      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: ParsedRow[] = XLSX.utils.sheet_to_json(worksheet);

      // Validação simples
      const validRows = jsonData
        .filter(row => row.login && row.senha && row.usuario)
        .map(row => ({
          ...row,
          senha: encryptPassword(row.senha), // Encrypt password for storage
          user_id: user?.id
        }));

      if (validRows.length === 0) {
        setFileError('Arquivo inválido ou sem dados válidos');
        return;
      }

      setLoading(true);
      setFileError(null);

      try {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Importar Usuários Windows</h2>
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
