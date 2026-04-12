import SearchBar from '../components/SearchBar';
import { Radio, Users, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../services/api';

const API = '/api';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch(`${API}/stats`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const STATS = [
    { label: 'APs Online', value: stats?.onlineDevices ?? '...', icon: Radio, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Total Clientes', value: stats?.macCacheSize ?? '...', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Alertas Ativos', value: stats?.offlineDevices ?? '0', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Status Sistema', value: stats?.offlineDevices > 0 ? 'Atenção' : 'Estável', icon: ShieldCheck, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  ];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
            Bem-vindo de volta
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Monitore o desempenho da sua rede wireless em tempo real.
          </p>
        </div>
        <div className="w-full md:w-auto">
          <SearchBar />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300">
              <div className="flex items-center space-x-4">
                <div className={`${stat.bg} p-3 rounded-2xl`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="bg-blue-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-blue-200 dark:shadow-none">
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-3xl font-bold mb-4">Gerenciamento Centralizado</h2>
          <p className="text-blue-100 text-lg mb-8 leading-relaxed">
            Correlacione dados do IXC Soft com o sinal real dos seus rádios. 
            Busque por MAC ou Login para ver o diagnóstico completo do cliente.
          </p>
          <div className="flex space-x-4">
            <button className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-bold hover:bg-blue-50 transition-colors">
              Explorar Antenas
            </button>
            <button className="bg-blue-500/30 border border-blue-400/30 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-500/50 transition-colors">
              Ver Relatórios
            </button>
          </div>
        </div>
        {/* Abstract background shapes */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[500px] h-[500px] bg-blue-500 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-blue-300 rounded-full opacity-10 blur-2xl"></div>
      </div>
    </div>
  );
}
