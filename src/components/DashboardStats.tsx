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
}

interface DashboardStatsProps {
  stats: StatCardProps[];
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  bgColor, 
  description,
  onClick 
}) => (
  <div 
    className={`bg-white rounded-xl shadow-md p-4 sm:p-6 transition-all duration-200 hover:scale-105 ${
      onClick ? 'cursor-pointer hover:shadow-lg' : ''
    }`}
    onClick={onClick}
  >
    <div className="flex items-center">
      <div className={`flex-shrink-0 p-2 sm:p-3 rounded-lg ${bgColor}`}>
        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${color}`} />
      </div>
      <div className="ml-3 sm:ml-4 flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium text-neutral-600 truncate">{title}</p>
        <p className="text-xl sm:text-2xl font-bold text-neutral-900">{value}</p>
        {description && (
          <p className="text-xs text-neutral-500 truncate">{description}</p>
        )}
      </div>
    </div>
  </div>
);

const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-6">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};

export default DashboardStats;