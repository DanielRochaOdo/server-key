import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { encryptPassword } from '../utils/encryption';
import * as XLSX from 'xlsx';

interface TeamFileUploadProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface PreviewTeam {
  login: string;
  senha: string;
  usuario: string;
  observacao?: string;
  departamento?: string;
}

const TeamFileUpload: React.FC<TeamFileUploadProps> = ({ onSuccess, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!validTypes.includes(selectedFile.type) &&
        !selectedFile.name.toLowerCase().endsWith('.csv') &&
        !selectedFile.name.toLowerCase().endsWith('.xlsx') &&
        !selectedFile.name.toLowerCase().endsWith('.xls')) {
      setError('Formato de arquivo inválido. Use CSV, XLS ou XLSX.');
      return;
    }

    setFile(selectedFile);
    setError('');
    processFile(selectedFile);
  };

  const processFile = async (file: File) => {
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

      if (jsonData.length < 2) {
        setError('O arquivo deve conter pelo menos uma linha de cabeçalho e uma linha de dados.');
        return;
      }

      const headers = jsonData[0].map(h => h?.toString().toLowerCase().trim());
      const rows = jsonData.slice(1);

      const columnMap: Record<string, number> = {};

      // login
      const loginIndex = headers.findIndex(h =>
        h.includes('login') || h.includes('user') || h.includes('usuario')
      );
      if (loginIndex === -1) {
        setError('Coluna "login" não encontrada. Certifique-se de que existe uma coluna com "login", "user" ou "usuario".');
        return;
      }
      columnMap.login = loginIndex;

      // senha
      const senhaIndex = headers.findIndex(h =>
        h.includes('senha') || h.includes('password') || h.includes('pass')
      );
      if (senhaIndex === -1) {
        setError('Coluna "senha" não encontrada. Certifique-se de que existe uma coluna com "senha", "password" ou "pass".');
        return;
      }
      columnMap.senha = senhaIndex;

      // usuario
      const usuarioIndex = headers.findIndex(h =>
        h.includes('usuario') || h.includes('nome') || h.includes('name') || h.includes('member')
      );
      if (usuarioIndex === -1) {
        setError('Coluna "usuario" não encontrada. Certifique-se de que existe uma coluna com "usuario", "nome", "name" ou "member".');
        return;
      }
      columnMap.usuario = usuarioIndex;

      // observacao (opcional)
      const observacaoIndex = headers.findIndex(h =>
        h.includes('observacao') || h.includes('obs') || h.includes('note') || h.includes('comment')
      );
      if (observacaoIndex !== -1) {
        columnMap.observacao = observacaoIndex;
      }

      // departamento (opcional)
      const departamentoIndex = headers.findIndex(h =>
        h.includes('departamento') || h.includes('department')
      );
      if (departamentoIndex !== -1) {
        columnMap.departamento = departamentoIndex;
      }

      const processedData: PreviewTeam[] = [];
      const errors: string[] = [];

      rows.forEach((row, index) => {
        const login = row[columnMap.login]?.toString().trim();
        const senha = row[columnMap.senha]?.toString().trim();
        const usuario = row[columnMap.usuario]?.toString().trim();
        const observacao = columnMap.observacao !== undefined ?
          row[columnMap.observacao]?.toString().trim() : '';
        const departamento = columnMap.departamento !== undefined ?
          row[columnMap.departamento]?.toString().trim() : '';

        if (!login || !senha || !usuario) {
          errors.push(`Linha ${index + 2}: Login, senha e usuário são obrigatórios`);
          return;
        }

        processedData.push({
          login,
          senha,
          usuario,
          observacao: observacao || undefined,
          departamento: departamento || undefined
        });
      });

      if (errors.length > 0) {
        setError(`Erros encontrados:\n${errors.join('\n')}`);
        return;
      }

      if (processedData.length === 0) {
        setError('Nenhum dado válido encontrado no arquivo.');
        return;
      }

      setPreview(processedData.slice(0, 5));
      setError('');
    } catch (err) {
      console.error('Error processing file:', err);
      setError('Erro ao processar arquivo. Verifique se o formato está correto.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || preview.length === 0) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

      const headers = jsonData[0].map(h => h?.toString().toLowerCase().trim());
      const rows = jsonData.slice(1);

      const columnMap: Record<string, number> = {};
      columnMap.login = headers.findIndex(h => h.includes('login') || h.includes('user') || h.includes('usuario'));
      columnMap.senha = headers.findIndex(h => h.includes('senha') || h.includes('password') || h.includes('pass'));
      columnMap.usuario = headers.findIndex(h => h.includes('usuario') || h.includes('nome') || h.includes('name') || h.includes('member'));
      const observacaoIndex = headers.findIndex(h => h.includes('observacao') || h.includes('obs') || h.includes('note') || h.includes('comment'));
      if (observacaoIndex !== -1) columnMap.observacao = observacaoIndex;
      const departamentoIndex = headers.findIndex(h => h.includes('departamento') || h.includes('department'));
      if (departamentoIndex !== -1) columnMap.departamento = departamentoIndex;

      const teamsData = rows
        .map(row => {
          const login = row[columnMap.login]?.toString().trim();
          const senha = row[columnMap.senha]?.toString().trim();
          const usuario = row[columnMap.usuario]?.toString().trim();
          const observacao = columnMap.observacao !== undefined ?
            row[columnMap.observacao]?.toString().trim() : null;
          const departamento = columnMap.departamento !== undefined ?
            row[columnMap.departamento]?.toString().trim() : null;

          if (!login || !senha || !usuario) return null;

          // Encrypt password for storage
          const encryptedPassword = encryptPassword(senha);

          return {
            login,
            senha: encryptedPassword,
            usuario,
            observacao: observacao || null,
            departamento,
            user_id: user?.id
          };
        })
        .filter(Boolean);

      if (teamsData.length === 0) {
        setError('Nenhum dado válido para importar.');
        return;
      }

      const { error } = await supabase.from('teams').insert(teamsData);
      if (error) throw error;

      setSuccess(`${teamsData.length} Contas Teams importadas com sucesso!`);
      setTimeout(() => onSuccess(), 2000);
    } catch (error) {
      console.error('Error importing Contas Teams:', error);
      setError('Erro ao importar Contas Teams. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">Importar Contas Teams</h2>
          <button onClick={onCancel} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {!file && (
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
          )}

          {file && !preview.length && !error && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-sm text-neutral-600">Processando arquivo...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Erro</h3>
                  <div className="mt-2 text-sm text-red-700 whitespace-pre-line">{error}</div>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Sucesso</h3>
                  <div className="mt-2 text-sm text-green-700">{success}</div>
                </div>
              </div>
            </div>
          )}

          {preview.length > 0 && (
            <div>
              <div className="flex items-center mb-4">
                <FileText className="h-5 w-5 text-neutral-400 mr-2" />
                <span className="text-sm font-medium text-neutral-900">
                  Preview dos dados (primeiros 5 registros)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200 border border-neutral-200 rounded-lg">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Login</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Senha</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Usuário</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Observação</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Departamento</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {preview.map((team, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-neutral-900">{team.login}</td>
                        <td className="px-4 py-2 text-sm text-neutral-900 font-mono">••••••••</td>
                        <td className="px-4 py-2 text-sm text-neutral-900">{team.usuario}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{team.observacao || '-'}</td>
                        <td className="px-4 py-2 text-sm text-neutral-600">{team.departamento || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>Colunas obrigatórias encontradas:</strong> Login, Senha, Usuário
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Pronto para importar os dados!
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
            >
              Cancelar
            </button>
            {file && (
              <button
                onClick={() => {
                  setFile(null);
                  setPreview([]);
                  setError('');
                  setSuccess('');
                }}
                className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
              >
                Escolher Outro Arquivo
              </button>
            )}
            {preview.length > 0 && !success && (
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-4 py-2 bg-button text-white rounded-lg hover:bg-button-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Importando...' : 'Importar Contas Teams'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamFileUpload;
