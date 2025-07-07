import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'financeiro' | 'usuario';
  modules: string[];
  is_active: boolean;
}

interface UserFormProps {
  user?: User | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ user, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'usuario' as 'admin' | 'financeiro' | 'usuario',
    is_active: true,
    pass: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getModulesByRole = (role: string): string[] => {
    switch (role) {
      case 'admin':
        return ['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google'];
      case 'financeiro':
        return ['rateio_claro', 'rateio_google'];
      case 'usuario':
        return ['acessos', 'teams', 'win_users'];
      default:
        return [];
    }
  };

  const roleLabels = {
    admin: 'Administrador',
    financeiro: 'Financeiro',
    usuario: 'Usuário',
  };

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        name: user.name || '',
        role: user.role || 'usuario',
        is_active: user.is_active ?? true,
        pass: '',
      });
    } else {
      setFormData({
        email: '',
        name: '',
        role: 'usuario',
        is_active: true,
        pass: '',
      });
    }
    setError('');
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (user) {
        // Atualizar usuário existente
        const { error } = await supabase
          .from('users')
          .update({
            email: formData.email,
            name: formData.name,
            role: formData.role,
            modules: getModulesByRole(formData.role),
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (error) throw error;
      } else {
        // Chamada para backend (Express) que cria o usuário no Supabase
        const response = await fetch('http://localhost:3001/api/create-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.pass,
            name: formData.name,
            role: formData.role,
            is_active: formData.is_active,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao criar usuário');
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      setError(err.message || 'Erro ao salvar usuário');
    } finally {
      setLoading(false);
    }
  };

  const currentModules = getModulesByRole(formData.role);

  return (
    // ... permanece igual até o final do componente
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {user ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-600"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* ...continua igual até o final do componente... */}
      </div>
    </div>
  );
};

export default UserForm;