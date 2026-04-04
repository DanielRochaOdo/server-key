import { useEffect } from 'react';

const SKIP_INPUT_TYPES = new Set([
  'password',
  'email',
  'search',
  'number',
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
  'file',
  'color',
  'range',
  'checkbox',
  'radio',
  'hidden',
]);

const hasUppercaseOptOut = (element: HTMLElement) =>
  element.dataset.uppercase === 'off' || Boolean(element.closest('[data-uppercase="off"]'));

const shouldSkipUppercase = (element: HTMLInputElement | HTMLTextAreaElement) => {
  if (hasUppercaseOptOut(element)) return true;

  if (element instanceof HTMLInputElement) {
    if (SKIP_INPUT_TYPES.has(element.type.toLowerCase())) return true;

    const semanticHints = [
      element.name,
      element.id,
      element.getAttribute('autocomplete'),
      element.getAttribute('inputmode'),
      element.getAttribute('placeholder'),
      element.getAttribute('aria-label'),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (
      semanticHints.includes('email') ||
      semanticHints.includes('senha') ||
      semanticHints.includes('password') ||
      semanticHints.includes('search') ||
      semanticHints.includes('busca') ||
      semanticHints.includes('buscar') ||
      semanticHints.includes('pesquisa')
    ) {
      return true;
    }
  }

  return false;
};

export const useGlobalUppercaseInput = () => {
  useEffect(() => {
    const onInputCapture = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (shouldSkipUppercase(target)) return;

      const nextValue = target.value.toUpperCase();
      if (nextValue === target.value) return;

      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;

      target.value = nextValue;

      if (selectionStart !== null && selectionEnd !== null) {
        target.setSelectionRange(selectionStart, selectionEnd);
      }
    };

    document.addEventListener('input', onInputCapture, true);
    return () => document.removeEventListener('input', onInputCapture, true);
  }, []);
};
