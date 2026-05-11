import { useCallback, useState } from 'react';

export const useProtectedVisibility = () => {
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const toggleVisibility = useCallback(
    (id: string) => {
      if (visibleIds.has(id)) {
        setVisibleIds((previous) => {
          const next = new Set(previous);
          next.delete(id);
          return next;
        });
        return;
      }

      setPendingRevealId(id);
      setShowPasswordModal(true);
    },
    [visibleIds]
  );

  const handlePasswordVerified = useCallback(() => {
    if (!pendingRevealId) return;

    setVisibleIds((previous) => {
      const next = new Set(previous);
      next.add(pendingRevealId);
      return next;
    });
    setPendingRevealId(null);
  }, [pendingRevealId]);

  const closePasswordModal = useCallback(() => {
    setShowPasswordModal(false);
    setPendingRevealId(null);
  }, []);

  return {
    visibleIds,
    pendingRevealId,
    showPasswordModal,
    toggleVisibility,
    handlePasswordVerified,
    closePasswordModal,
  };
};
