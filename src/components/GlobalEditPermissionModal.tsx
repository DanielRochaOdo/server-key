import React, { useEffect, useState } from 'react';
import EditPermissionModal from './EditPermissionModal';

type EditDeniedDetail = {
  moduleLabel?: string;
};

const EVENT_NAME = 'serverkey:edit-permission-denied';

const GlobalEditPermissionModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [moduleLabel, setModuleLabel] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<EditDeniedDetail>;
      setModuleLabel(customEvent?.detail?.moduleLabel);
      setIsOpen(true);
    };

    window.addEventListener(EVENT_NAME, handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
    };
  }, []);

  return (
    <EditPermissionModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      moduleLabel={moduleLabel}
    />
  );
};

export default GlobalEditPermissionModal;

