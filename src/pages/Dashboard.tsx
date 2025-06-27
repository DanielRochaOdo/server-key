import React from 'react';
import { Shield, Users, Activity, AlertTriangle } from 'lucide-react';

const Dashboard: React.FC = () => {
  const stats = [
    {
      name: 'Usuários Ativos',
      value: '12',
      icon: Users,
      color: 'text-primary-600',
      bgColor: 'bg-primary-100'
    },
    {
      name: 'Eventos de Segurança',
      value: '24',
      icon: Shield,
      color: 'text-button-600',
      bgColor: 'bg-button-100'
    },
    {
      name: 'Monitoramento',
      value: 'Ativo',
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      name: 'Alertas',
      value: '3',
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    }
  ];

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary-900">Dashboard</h1>
        <p className="mt-2 text-primary-600">
          Visão geral do sistema de segurança
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl shadow-md p-6 transition-transform duration-200 hover:scale-105">
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-neutral-600">{stat.name}</p>
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Atividades Recentes</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-neutral-600">Login realizado por admin@serverkey.com</span>
              <span className="text-xs text-neutral-400">2 min atrás</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-sm text-neutral-600">Tentativa de acesso não autorizado detectada</span>
              <span className="text-xs text-neutral-400">15 min atrás</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-neutral-600">Backup de segurança concluído</span>
              <span className="text-xs text-neutral-400">1 hora atrás</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Status do Sistema</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">Firewall</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">Ativo</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">Monitoramento</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">Ativo</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">Backup</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">Ativo</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">Atualizações</span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Pendente</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;