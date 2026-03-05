import React from 'react';

interface ModuleHeaderProps {
  sectionLabel?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const ModuleHeader: React.FC<ModuleHeaderProps> = ({ sectionLabel, title, subtitle, actions }) => {
  return (
    <div className="surface-card module-header-light relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 right-0 h-44 w-44 rounded-full bg-primary-100/70 blur-3xl dark:bg-primary-900/40" />
      <div className="pointer-events-none absolute -bottom-28 left-0 h-52 w-52 rounded-full bg-button-100/70 blur-3xl dark:bg-button-900/30" />
      <div className="relative flex flex-col gap-3 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {sectionLabel && (
              <span className="pill">{sectionLabel}</span>
            )}
            <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              {title}
            </h1>
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
