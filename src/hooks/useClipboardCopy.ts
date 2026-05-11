import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../utils/clipboard';

export const useClipboardCopy = (resetDelayMs = 800) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copyText = useCallback(
    async (value?: string, key?: string) => {
      if (!value) return;

      await copyToClipboard(value);

      if (!key) return;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setCopiedKey(key);
      timeoutRef.current = setTimeout(() => {
        setCopiedKey((previous) => (previous === key ? null : previous));
      }, resetDelayMs);
    },
    [resetDelayMs]
  );

  return { copiedKey, copyText };
};
