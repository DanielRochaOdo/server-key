import React from 'react';

interface ModuleHeaderProps {
  sectionLabel?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const ModuleHeader: React.FC<ModuleHeaderProps> = ({ sectionLabel, title, subtitle, actions }) => {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {sectionLabel && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-neutral-400 dark:text-neutral-500">
                {sectionLabel}
              </p>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-primary-900 dark:text-primary-100">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-xs sm:text-sm text-primary-600 dark:text-neutral-300">
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
