import React, { useState, useEffect } from 'react';
import { Shield, Users, Activity, AlertTriangle, Key, UserCheck, Database, TrendingUp, Phone, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  totalAcessos: number;
  totalTeams: number;
  totalWinUsers: number;
  totalRateioClaro: number;
  totalRateioGoogle: number;
  recentAcessos: any[];
  recentTeams: any[];
  recentWinUsers: any[];
  recentRateioClaro: any[];
  recentRateioGoogle: any[];
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAcessos: 0,
    totalTeams: 0,
    totalWinUsers: 0,
    totalRateioClaro: 0,
    totalRateioGoogle: 0,
    recentAcessos: [],
    recentTeams: [],
    recentWinUsers: [],
    recentRateioClaro: [],
    recentRateioGoogle: []
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch Acessos data
      const { data: acessosData, error: acessosError } = await supabase
        .from('acessos')
        .select('id, descricao, created_at')
        .order('created_at', { ascending: false });

      if (acessosError) throw acessosError;

      // Fetch Teams data
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, login, usuario, created_at')
        .order('created_at', { ascending: false });

      if (teamsError) throw teamsError;

      // Fetch Win Users data
      const { data: winUsersData, error: winUsersError } = await supabase
        .from('win_users')
        .select('id, login, usuario, created_at')
        .order('created_at', { ascending: false });

      if (winUsersError) throw winUsersError;

      // Fetch Rateio Claro data
      const { data: rateioData, error: rateioError } = await supabase
        .from('rateio_claro')
        .select('id, nome, numero_linha, created_at')
        .order('created_at', { ascending: false });

      if (rateioError) throw rateioError;

      // Fetch Rateio Google data
      const { data: rateioGoogleData, error: rateioGoogleError } = await supabase
        .from('rateio_google')
        .select('id, nome_completo, email, created_at')
        .order('created_at', { ascending: false });

      if (rateioGoogleError) throw rateioGoogleError;

      setStats({
        totalAcessos: acessosData?.length || 0,
        totalTeams: teamsData?.length || 0,
        totalWinUsers: winUsersData?.length || 0,
        totalRateioClaro: rateioData?.length || 0,
        totalRateioGoogle: rateioGoogleData?.length || 0,
        recentAcessos: acessosData?.slice(0, 5) || [],
        recentTeams: teamsData?.slice(0, 5) || [],
        recentWinUsers: winUsersData?.slice(0, 5) || [],
        recentRateioClaro: rateioData?.slice(0, 5) || [],
        recentRateioGoogle: rateioGoogleData?.slice(0, 5) || []
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const dashboardCards = [
    {
      name: 'Total de Acessos',
      value: stats.totalAcessos.toString(),
      icon: Key,
      color: 'text-primary-600',
      bgColor: 'bg-primary-100',
      description: 'Sistemas cadastrados'
    },
    {
      name: 'Teams',
      value: stats.totalTeams.toString(),
      icon: UserCheck,
      color: 'text-button-600',
      bgColor: 'bg-button-100',
      description: 'Equipes registradas'
    },
    {
      name: 'Win Users',
      value: stats.totalWinUsers.toString(),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'Usuários Windows'
    },
    {
      name: 'Rateio Claro',
      value: stats.totalRateioClaro.toString(),
      icon: Phone,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: 'Linhas Claro'
    },
    {
      name: 'Rateio Google',
      value: stats.totalRateioGoogle.toString(),
      icon: Globe,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      description: 'Usuários Google'
    },
    {
      name: 'Total Geral',
      value: (stats.totalAcessos + stats.totalTeams + stats.totalWinUsers + stats.totalRateioClaro + stats.totalRateioGoogle).toString(),
      icon: Database,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'Registros totais'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Dashboard</h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-primary-600">
          Visão geral do sistema de gerenciamento
        </p>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
        {dashboardCards.map((card) => (
          <div key={card.name} className="bg-white rounded-xl shadow-md p-4 sm:p-6 transition-transform duration-200 hover:scale-105">
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-2 sm:p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${card.color}`} />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-neutral-600">{card.name}</p>
                <p className="text-xl sm:text-2xl font-bold text-neutral-900">{card.value}</p>
                <p className="text-xs text-neutral-500">{card.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Acessos Recentes */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-neutral-900">Acessos Recentes</h3>
            <Key className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
          </div>
          <div className="space-y-2 sm:space-y-3">
            {stats.recentAcessos.length > 0 ? (
              stats.recentAcessos.map((acesso) => (
                <div key={acesso.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                      {acesso.descricao}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDate(acesso.created_at)}
                    </p>
                  </div>
                  <div className="w-2 h-2 bg-primary-500 rounded-full ml-2"></div>
                </div>
              ))
            ) : (
              <p className="text-xs sm:text-sm text-neutral-500 text-center py-4">
                Nenhum acesso cadastrado
              </p>
            )}
          </div>
        </div>

        {/* Teams Recentes */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-neutral-900">Teams Recentes</h3>
            <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-button-600" />
          </div>
          <div className="space-y-2 sm:space-y-3">
            {stats.recentTeams.length > 0 ? (
              stats.recentTeams.map((team) => (
                <div key={team.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                      {team.usuario}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      Login: {team.login}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDate(team.created_at)}
                    </p>
                  </div>
                  <div className="w-2 h-2 bg-button-500 rounded-full ml-2"></div>
                </div>
              ))
            ) : (
              <p className="text-xs sm:text-sm text-neutral-500 text-center py-4">
                Nenhum team cadastrado
              </p>
            )}
          </div>
        </div>

        {/* Win Users Recentes */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-neutral-900">Win Users Recentes</h3>
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </div>
          <div className="space-y-2 sm:space-y-3">
            {stats.recentWinUsers.length > 0 ? (
              stats.recentWinUsers.map((winUser) => (
                <div key={winUser.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                      {winUser.usuario}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      Login: {winUser.login}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDate(winUser.created_at)}
                    </p>
                  </div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                </div>
              ))
            ) : (
              <p className="text-xs sm:text-sm text-neutral-500 text-center py-4">
                Nenhum usuário Windows cadastrado
              </p>
            )}
          </div>
        </div>

        {/* Rateio Claro Recentes */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-neutral-900">Rateio Claro Recentes</h3>
            <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
          </div>
          <div className="space-y-2 sm:space-y-3">
            {stats.recentRateioClaro.length > 0 ? (
              stats.recentRateioClaro.map((rateio) => (
                <div key={rateio.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                      {rateio.nome}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      Linha: {rateio.numero_linha || 'N/A'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDate(rateio.created_at)}
                    </p>
                  </div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full ml-2"></div>
                </div>
              ))
            ) : (
              <p className="text-xs sm:text-sm text-neutral-500 text-center py-4">
                Nenhum rateio cadastrado
              </p>
            )}
          </div>
        </div>

        {/* Rateio Google Recentes */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-neutral-900">Rateio Google Recentes</h3>
            <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
          </div>
          <div className="space-y-2 sm:space-y-3">
            {stats.recentRateioGoogle.length > 0 ? (
              stats.recentRateioGoogle.map((rateio) => (
                <div key={rateio.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                      {rateio.nome_completo}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      Email: {rateio.email || 'N/A'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDate(rateio.created_at)}
                    </p>
                  </div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full ml-2"></div>
                </div>
              ))
            ) : (
              <p className="text-xs sm:text-sm text-neutral-500 text-center py-4">
                Nenhum usuário Google cadastrado
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Resumo do Sistema */}
      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-neutral-900">Status do Sistema</h3>
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <div className="flex items-center justify-between p-3 sm:p-4 bg-primary-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-primary-900">Módulo Acessos</p>
              <p className="text-xs text-primary-600">Sistema de credenciais</p>
            </div>
            <span className="px-2 sm:px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full whitespace-nowrap ml-2">Ativo</span>
          </div>
          <div className="flex items-center justify-between p-3 sm:p-4 bg-button-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-button-900">Módulo Teams</p>
              <p className="text-xs text-button-600">Gerenciamento de equipes</p>
            </div>
            <span className="px-2 sm:px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full whitespace-nowrap ml-2">Ativo</span>
          </div>
          <div className="flex items-center justify-between p-3 sm:p-4 bg-blue-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-blue-900">Módulo Win Users</p>
              <p className="text-xs text-blue-600">Usuários Windows</p>
            </div>
            <span className="px-2 sm:px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full whitespace-nowrap ml-2">Ativo</span>
          </div>
          <div className="flex items-center justify-between p-3 sm:p-4 bg-purple-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-purple-900">Módulo Rateio Claro</p>
              <p className="text-xs text-purple-600">Linhas telefônicas</p>
            </div>
            <span className="px-2 sm:px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full whitespace-nowrap ml-2">Ativo</span>
          </div>
          <div className="flex items-center justify-between p-3 sm:p-4 bg-indigo-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-indigo-900">Módulo Rateio Google</p>
              <p className="text-xs text-indigo-600">Usuários Google</p>
            </div>
            <span className="px-2 sm:px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full whitespace-nowrap ml-2">Ativo</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;