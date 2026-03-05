import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  description?: string;
  onClick?: () => void;
  className?: string;
  titleClassName?: string;
  valueClassName?: string;
  descriptionClassName?: string;
}

interface DashboardStatsProps {
  stats: StatCardProps[];
  className?: string;
  cardClassName?: string;
  layout?: 'grid' | 'row';
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  bgColor, 
  description,
  onClick,
  className,
  titleClassName,
  valueClassName,
  descriptionClassName
}) => (
  <div 
    className={`surface-soft min-w-0 p-4 sm:p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-card ${
      onClick ? 'cursor-pointer' : ''
    } ${className || ''}`}
    onClick={onClick}
  >
    <div className="flex items-center">
      <div className={`flex-shrink-0 p-2 sm:p-3 rounded-xl ${bgColor} bg-opacity-70`}>
        <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${color}`} />
      </div>
      <div className="ml-3 sm:ml-4 flex-1 min-w-0">
        <p className={`text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.22em] text-neutral-500 break-words ${titleClassName || ''}`}>
          {title}
        </p>
        <p className={`text-[clamp(0.6rem,0.95vw,0.82rem)] font-semibold text-neutral-900 leading-tight tracking-tight break-words ${valueClassName || ''}`}>
          {value}
        </p>
        {description && (
          <p className={`text-[8px] sm:text-[9px] text-neutral-500 break-words ${descriptionClassName || ''}`}>{description}</p>
        )}
      </div>
    </div>
  </div>
);

const DashboardStats: React.FC<DashboardStatsProps> = ({ stats, className, cardClassName, layout = 'grid' }) => {
  const containerClass =
    layout === 'row'
    ? 'flex flex-nowrap gap-4 overflow-x-auto pb-2 mb-6'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-6';

  return (
    <div className={`${containerClass} ${className || ''}`}>
      {stats.map((stat, index) => {
        const mergedClassName = [stat.className, cardClassName].filter(Boolean).join(' ');
        return <StatCard key={index} {...stat} className={mergedClassName} />;
      })}
    </div>
  );
};

export default DashboardStats;
