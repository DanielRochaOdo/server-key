import React from 'react';
import { useLocation } from 'react-router-dom';
import { HiOutlineLightBulb as LightbulbIcon } from 'react-icons/hi2';
import { useTutorial } from '../contexts/TutorialContext';

interface ModuleHeaderProps {
  sectionLabel?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const ModuleHeader: React.FC<ModuleHeaderProps> = ({ sectionLabel, title, subtitle, actions }) => {
  const location = useLocation();
  const { startTutorial, isActive } = useTutorial();
  const headerRef = React.useRef<HTMLDivElement | null>(null);

  const handleStartTutorial = React.useCallback(() => {
    const moduleId = location.pathname.replace(/^\//, '') || 'dashboard';
    const rootElement = headerRef.current?.parentElement ?? null;

    startTutorial({
      moduleId,
      moduleTitle: title,
      rootElement,
    });
  }, [location.pathname, startTutorial, title]);

  return (
    <div ref={headerRef} className="surface-card module-header-light relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute -top-24 right-0 h-44 w-44 rounded-full bg-primary-100/70 blur-3xl dark:bg-primary-900/40" />
        <div className="absolute -bottom-28 left-0 h-52 w-52 rounded-full bg-button-100/70 blur-3xl dark:bg-button-900/30" />
      </div>
      <div className="relative flex flex-col gap-3 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {sectionLabel && (
              <span className="pill">{sectionLabel}</span>
            )}
            <div className="mt-2 flex items-center gap-2">
              <h1
                data-module-title
                className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
              >
                {title}
              </h1>
              <button
                type="button"
                onClick={handleStartTutorial}
                data-tutorial-control="start"
                title="Iniciar tutorial do modulo"
                aria-label="Iniciar tutorial do modulo"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-600 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-900/70 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/45"
                disabled={isActive}
              >
                <LightbulbIcon className="h-4 w-4" />
                <span className="sr-only">Tutorial</span>
              </button>
            </div>
            {subtitle && (
              <p className="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModuleHeader;
