import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface EditPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleLabel?: string;
}

const EditPermissionModal: React.FC<EditPermissionModalProps> = ({
  isOpen,
  onClose,
  moduleLabel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-neutral-200 rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Permissao de edicao
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-neutral-700">
            Voce nao tem permissao para editar neste modulo.
          </p>
          {moduleLabel && (
            <p className="text-xs text-neutral-500">
              Modulo: <strong>{moduleLabel}</strong>
            </p>
          )}
          <p className="text-xs text-neutral-500">
            Solicite ao administrador a permissao de edicao em Configuracoes {'>'} Usuarios.
          </p>
          <div className="pt-2 text-right">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPermissionModal;

