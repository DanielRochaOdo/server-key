import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { HiOutlineLightBulb as LightbulbIcon } from 'react-icons/hi2';

interface TutorialStartOptions {
  moduleId: string;
  moduleTitle: string;
  rootElement?: HTMLElement | null;
}

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  element: HTMLElement;
}

interface TutorialSession {
  isActive: boolean;
  moduleId: string;
  moduleTitle: string;
  steps: TutorialStep[];
  currentIndex: number;
  showExitConfirm: boolean;
}

interface TutorialContextData {
  startTutorial: (options: TutorialStartOptions) => void;
  isActive: boolean;
}

const tutorialFallbackContext: TutorialContextData = {
  startTutorial: () => undefined,
  isActive: false,
};

const TutorialContext = createContext<TutorialContextData>(tutorialFallbackContext);

const MAX_TUTORIAL_STEPS = 30;
const OVERLAY_PADDING = 10;
const TARGET_SELECTOR = [
  '[data-tutorial-title]',
  'button:not([disabled])',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="tab"]:not([aria-disabled="true"])',
  'a[href]',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'table',
].join(', ');

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();
const ACTION_HINTS = [
  'novo',
  'adicionar',
  'importar',
  'exportar',
  'sincronizar',
  'editar',
  'excluir',
  'visualizar',
  'detalhes',
  'buscar',
  'pesquisar',
  'filtrar',
  'filtro',
  'salvar',
  'aplicar',
  'limpar',
  'periodo',
  'data',
  'mes',
  'ano',
  'proxima',
  'anterior',
];
const MONTH_NAMES_PATTERN =
  /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i;

const hasActionHint = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return ACTION_HINTS.some((hint) => normalized.includes(hint));
};

const getElementIdentity = (element: HTMLElement): string => {
  const pieces = [
    element.id,
    element.getAttribute('name') ?? '',
    element.getAttribute('placeholder') ?? '',
    element.getAttribute('aria-label') ?? '',
    element.getAttribute('title') ?? '',
    element.className,
  ];
  return normalizeText(pieces.join(' ').toLowerCase());
};

const isDateLikeControl = (element: HTMLElement, label?: string): boolean => {
  const tagName = element.tagName.toLowerCase();
  const identity = getElementIdentity(element);
  const normalizedLabel = (label ?? '').toLowerCase();

  if (tagName === 'input') {
    const inputType = (element as HTMLInputElement).type;
    if (['date', 'month', 'datetime-local', 'week', 'time'].includes(inputType)) {
      return true;
    }
  }

  const haystack = `${identity} ${normalizedLabel}`;
  if (
    haystack.includes('data') ||
    haystack.includes('periodo') ||
    haystack.includes('mes') ||
    haystack.includes('ano') ||
    haystack.includes('calendar') ||
    MONTH_NAMES_PATTERN.test(haystack)
  ) {
    return true;
  }

  return false;
};

const getAssociatedFieldLabel = (element: HTMLElement): string | null => {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ids = labelledBy.split(' ').map((part) => part.trim()).filter(Boolean);
    const labelledText = normalizeText(
      ids
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
    );
    if (labelledText) return labelledText;
  }

  const closestLabel = element.closest('label');
  if (closestLabel) {
    const text = normalizeText(closestLabel.textContent ?? '');
    if (text) return text;
  }

  const elementId = element.id;
  if (elementId) {
    const externalLabel = Array.from(document.querySelectorAll('label[for]')).find(
      (label) => label.getAttribute('for') === elementId
    );
    if (externalLabel) {
      const text = normalizeText(externalLabel.textContent ?? '');
      if (text) return text;
    }
  }

  return null;
};

const inferSelectLabelByIdentity = (element: HTMLSelectElement): string | null => {
  const identity = `${element.name} ${element.id}`.toLowerCase();
  if (identity.includes('ano') || identity.includes('year')) return 'Filtro de ano';
  if (identity.includes('mes') || identity.includes('month')) return 'Filtro de mes';
  if (identity.includes('data') || identity.includes('periodo')) return 'Filtro de periodo';
  if (identity.includes('setor')) return 'Filtro de setor';
  return null;
};

const toReadableLabel = (element: HTMLElement): string => {
  const explicit = element.dataset.tutorialTitle;
  if (explicit) return normalizeText(explicit);

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return normalizeText(ariaLabel);

  const title = element.getAttribute('title');
  if (title) return normalizeText(title);

  const placeholder = element.getAttribute('placeholder');
  if (placeholder) return normalizeText(placeholder);

  const tagName = element.tagName.toLowerCase();

  if (tagName === 'button' || tagName === 'a') {
    const text = normalizeText(element.textContent ?? '');
    if (isDateLikeControl(element, text)) return 'Filtro de periodo';
    if (text) return text.length > 70 ? `${text.slice(0, 67)}...` : text;
    return tagName === 'button' ? 'Botao de acao' : 'Link de apoio';
  }

  if (tagName === 'table') return 'Tabela de registros';

  const associatedLabel = getAssociatedFieldLabel(element);
  if (associatedLabel) return associatedLabel;

  if (tagName === 'select') {
    if (isDateLikeControl(element)) return 'Filtro de periodo';
    const selectLabel = inferSelectLabelByIdentity(element as HTMLSelectElement);
    if (selectLabel) return selectLabel;
    return 'Seletor de opcoes';
  }

  if (tagName === 'input') {
    const input = element as HTMLInputElement;
    if (isDateLikeControl(element)) return 'Filtro de data';
    if (input.type === 'search') return 'Campo de busca';
    return 'Campo de preenchimento';
  }

  if (tagName === 'textarea') return 'Campo de preenchimento';

  const text = normalizeText(element.textContent ?? '');
  if (text) return text.length > 70 ? `${text.slice(0, 67)}...` : text;

  return 'Acao do modulo';
};

const inferDescription = (label: string, element: HTMLElement): string => {
  const explicit = element.dataset.tutorialDesc;
  if (explicit) return normalizeText(explicit);

  const normalizedLabel = label.toLowerCase();
  const tagName = element.tagName.toLowerCase();
  const inputType = tagName === 'input' ? (element as HTMLInputElement).type : '';
  const elementIdentity = getElementIdentity(element);

  if (
    isDateLikeControl(element, label) ||
    normalizedLabel.includes('filtro de data') ||
    normalizedLabel.includes('filtro de periodo')
  ) {
    if (elementIdentity.includes('ano') || normalizedLabel.includes('ano')) {
      return 'Escolha o ano para ver os dados desse ano na tela.';
    }
    if (elementIdentity.includes('mes') || normalizedLabel.includes('mes') || inputType === 'month') {
      return 'Escolha o mes para ver os dados desse periodo na tela.';
    }
    return 'Escolha o periodo para ver os dados correspondentes nesta tela.';
  }

  if (normalizedLabel.includes('novo') || normalizedLabel.includes('adicionar')) {
    return 'Clique aqui para adicionar um novo item.';
  }
  if (normalizedLabel.includes('importar')) {
    return 'Aqui voce envia uma planilha para preencher varios dados de uma vez.';
  }
  if (normalizedLabel.includes('exportar') || normalizedLabel.includes('baixar')) {
    return 'Aqui voce baixa os dados que estao na tela.';
  }
  if (normalizedLabel.includes('sincronizar')) {
    return 'Clique para atualizar os dados mais recentes.';
  }
  if (normalizedLabel.includes('editar')) {
    return 'Clique para alterar este item.';
  }
  if (normalizedLabel.includes('excluir')) {
    return 'Clique para remover este item.';
  }
  if (normalizedLabel.includes('visualizar') || normalizedLabel.includes('detalhes')) {
    return 'Clique para ver mais detalhes.';
  }
  if (normalizedLabel.includes('buscar') || inputType === 'search') {
    return 'Digite aqui para encontrar itens mais rapido.';
  }
  if (tagName === 'input' || tagName === 'textarea') {
    return 'Preencha este campo para informar dados.';
  }
  if (tagName === 'select') {
    return 'Escolha uma opcao para filtrar os dados da tela.';
  }
  if (tagName === 'table') {
    return 'Aqui voce ve a lista de itens e as acoes de cada linha.';
  }
  if (tagName === 'a') {
    return 'Este link abre uma pagina relacionada.';
  }
  return 'Este item faz parte da parte principal desta tela.';
};

const isMostlyNumeric = (value: string): boolean => {
  const compact = value.replace(/\s/g, '');
  if (!compact) return false;
  const nonNumeric = compact.replace(/[0-9.,:/\-R$]/g, '');
  return nonNumeric.length <= Math.ceil(compact.length * 0.2);
};

const shouldIncludeCandidate = (element: HTMLElement, label: string): boolean => {
  if (element.dataset.tutorialTitle !== undefined) return true;

  const tagName = element.tagName.toLowerCase();
  const role = (element.getAttribute('role') ?? '').toLowerCase();

  if (['button', 'input', 'select', 'textarea', 'table'].includes(tagName)) {
    return true;
  }

  if (['button', 'tab', 'menuitem', 'switch', 'checkbox', 'radio'].includes(role)) {
    return true;
  }

  if (tagName === 'a') {
    if (element.getAttribute('aria-label') || element.getAttribute('title')) return true;
    if (hasActionHint(label)) return true;
    if (label.length <= 32 && label.split(' ').length <= 4 && !isMostlyNumeric(label)) return true;
    return false;
  }

  return false;
};

const isVisible = (element: HTMLElement): boolean => {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }

  if (element.closest('[aria-hidden="true"]')) {
    return false;
  }

  return element.getClientRects().length > 0;
};

const buildTutorialSteps = (rootElement: HTMLElement, moduleTitle: string): TutorialStep[] => {
  const steps: TutorialStep[] = [];
  const seenSignatures = new Set<string>();
  const moduleTitleElement = rootElement.querySelector<HTMLElement>('[data-module-title]');

  if (moduleTitleElement && isVisible(moduleTitleElement)) {
    steps.push({
      id: 'overview',
      title: `Visao geral: ${moduleTitle}`,
      description: 'Este tutorial mostra, passo a passo, o que voce pode fazer nesta tela.',
      element: moduleTitleElement,
    });
    seenSignatures.add('overview');
  }

  const candidates = Array.from(rootElement.querySelectorAll<HTMLElement>(TARGET_SELECTOR));
  for (const element of candidates) {
    if (steps.length >= MAX_TUTORIAL_STEPS) break;

    if (element.dataset.tutorialIgnore !== undefined || element.dataset.tutorialControl !== undefined) {
      continue;
    }

    if (!isVisible(element)) continue;

    const label = toReadableLabel(element);
    if (!shouldIncludeCandidate(element, label)) continue;

    const kind = element.tagName.toLowerCase();
    const signature = `${kind}:${label.toLowerCase()}`;
    if (seenSignatures.has(signature)) continue;

    seenSignatures.add(signature);
    steps.push({
      id: `${kind}-${steps.length + 1}`,
      title: label,
      description: inferDescription(label, element),
      element,
    });
  }

  if (steps.length > 0) {
    return steps;
  }

  return [
    {
      id: 'fallback',
      title: moduleTitle,
      description: 'Nao encontramos acoes para mostrar no tutorial desta tela agora.',
      element: rootElement,
    },
  ];
};

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<TutorialSession | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const maskId = useId().replaceAll(':', '');

  const currentStep = useMemo(() => {
    if (!session) return null;
    return session.steps[session.currentIndex] ?? null;
  }, [session]);

  const closeTutorial = useCallback(() => {
    setSession(null);
    setTargetRect(null);
  }, []);

  const startTutorial = useCallback((options: TutorialStartOptions) => {
    const fallbackRoot = document.querySelector<HTMLElement>('main');
    const rootElement = options.rootElement ?? fallbackRoot;
    if (!rootElement) return;

    const steps = buildTutorialSteps(rootElement, options.moduleTitle);
    setSession({
      isActive: true,
      moduleId: options.moduleId,
      moduleTitle: options.moduleTitle,
      steps,
      currentIndex: 0,
      showExitConfirm: false,
    });
  }, []);

  const goToNextStep = useCallback(() => {
    setSession((previous) => {
      if (!previous) return previous;
      const nextIndex = Math.min(previous.currentIndex + 1, previous.steps.length - 1);
      return {
        ...previous,
        currentIndex: nextIndex,
      };
    });
  }, []);

  const goToPreviousStep = useCallback(() => {
    setSession((previous) => {
      if (!previous) return previous;
      const previousIndex = Math.max(previous.currentIndex - 1, 0);
      return {
        ...previous,
        currentIndex: previousIndex,
      };
    });
  }, []);

  const askForClose = useCallback(() => {
    setSession((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        showExitConfirm: true,
      };
    });
  }, []);

  const cancelClose = useCallback(() => {
    setSession((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        showExitConfirm: false,
      };
    });
  }, []);

  useEffect(() => {
    if (!session?.isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    let rafId = 0;
    const updateTarget = () => {
      if (!currentStep.element.isConnected || !isVisible(currentStep.element)) {
        setTargetRect(null);
        return;
      }
      const rect = currentStep.element.getBoundingClientRect();
      setTargetRect(rect);
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateTarget);
    };

    currentStep.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);

    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      mutationObserver.disconnect();
    };
  }, [session?.isActive, session?.currentIndex, currentStep]);

  useEffect(() => {
    if (!session?.isActive) return;

    const handleKeyboard = (event: KeyboardEvent) => {
      if (session.showExitConfirm) {
        if (event.key === 'Escape') {
          cancelClose();
        }
        return;
      }

      if (event.key === 'ArrowRight') {
        goToNextStep();
      }
      if (event.key === 'ArrowLeft') {
        goToPreviousStep();
      }
      if (event.key === 'Escape') {
        askForClose();
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [session?.isActive, session?.showExitConfirm, askForClose, cancelClose, goToNextStep, goToPreviousStep]);

  const value = useMemo<TutorialContextData>(
    () => ({
      startTutorial,
      isActive: Boolean(session?.isActive),
    }),
    [startTutorial, session?.isActive]
  );

  const canGoBack = Boolean(session && session.currentIndex > 0);
  const canGoForward = Boolean(session && session.currentIndex < session.steps.length - 1);
  const spotlightStyle = targetRect
    ? {
        top: Math.max(targetRect.top - OVERLAY_PADDING, 0),
        left: Math.max(targetRect.left - OVERLAY_PADDING, 0),
        width: targetRect.width + OVERLAY_PADDING * 2,
        height: targetRect.height + OVERLAY_PADDING * 2,
      }
    : null;

  return (
    <TutorialContext.Provider value={value}>
      {children}

      {session?.isActive && (
        <>
          <svg className="fixed inset-0 z-[120] h-full w-full pointer-events-auto" aria-hidden="true">
            <defs>
              <mask id={maskId}>
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {spotlightStyle && (
                  <rect
                    x={spotlightStyle.left}
                    y={spotlightStyle.top}
                    width={spotlightStyle.width}
                    height={spotlightStyle.height}
                    rx="14"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(15, 23, 42, 0.72)" mask={`url(#${maskId})`} />
          </svg>

          {spotlightStyle && (
            <div
              className="fixed z-[130] rounded-2xl border-2 border-amber-300/90 shadow-[0_0_0_1px_rgba(251,191,36,0.45)] pointer-events-none"
              style={spotlightStyle}
              aria-hidden="true"
            />
          )}

          <div className="fixed bottom-4 left-1/2 z-[140] w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
              <LightbulbIcon className="h-3.5 w-3.5" />
              Modo tutorial
            </div>
            <div className="mt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{currentStep?.title}</div>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">{currentStep?.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Passo {(session.currentIndex + 1).toString()} de {session.steps.length.toString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  disabled={!canGoBack}
                  aria-label="Voltar um passo"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goToNextStep}
                  disabled={!canGoForward}
                  aria-label="Avancar um passo"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={askForClose}
                  aria-label="Encerrar tutorial"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-600 transition-colors hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {session.showExitConfirm && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Encerrar tutorial?</h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                  Tem certeza? O tutorial sera encerrado, mas voce podera iniciar quantas vezes desejar.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelClose}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    Continuar tutorial
                  </button>
                  <button
                    type="button"
                    onClick={closeTutorial}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                  >
                    Encerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </TutorialContext.Provider>
  );
};

export const useTutorial = (): TutorialContextData => {
  return useContext(TutorialContext);
};
