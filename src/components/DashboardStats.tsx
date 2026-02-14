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
  className
}) => (
  <div 
    className={`bg-white rounded-xl shadow-md p-4 sm:p-6 transition-all duration-200 hover:scale-105 min-w-0 ${
      onClick ? 'cursor-pointer hover:shadow-lg' : ''
    } ${className || ''}`}
    onClick={onClick}
  >
    <div className="flex items-center">
      <div className={`flex-shrink-0 p-2 sm:p-3 rounded-lg ${bgColor}`}>
        <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${color}`} />
      </div>
      <div className="ml-3 sm:ml-4 flex-1 min-w-0">
        <p className="text-[7px] sm:text-[8px] font-medium text-neutral-600 break-words">{title}</p>
        <p className="text-[clamp(0.55rem,0.88vw,0.77rem)] font-bold text-neutral-900 leading-tight tracking-tight break-words">
          {value}
        </p>
        {description && (
          <p className="text-[7px] sm:text-[8px] text-neutral-500 break-words">{description}</p>
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
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} className={cardClassName} />
      ))}
    </div>
  );
};

export default DashboardStats;
