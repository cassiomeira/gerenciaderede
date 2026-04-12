import { Outlet, Link, useLocation } from 'react-router-dom';
import { Activity, Users, Radio, ShieldAlert, Terminal, Map, TrendingDown, Cloud, Bell, LogOut, Building2, Server } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from './AuthContext';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const SIDEBAR_ITEMS = [
  { icon: Activity, label: 'Dashboard', path: '/' },
  { icon: Radio, label: 'Gerenciar APs', path: '/ap-management' },
  { icon: Server, label: 'NE8000 BNG', path: '/ne8000' },
  { icon: TrendingDown, label: 'Relatório de Sinais', path: '/bad-signals' },
  { icon: Map, label: 'Mapa de Rede', path: '/network-map' },
  { icon: Users, label: 'Fila de O.S.', path: '/os-queue' },
  { icon: Terminal, label: 'Scripts em Massa', path: '/scripts' },
  { icon: Cloud, label: 'Backups Google', path: '/backups' },
  { icon: Bell, label: 'Alertas', path: '/alerts' },
  { icon: ShieldAlert, label: 'Configurações', path: '/settings' },
];

export default function Layout() {
  const location = useLocation();
  const { user, company, logout } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="p-6 flex items-center space-x-3 border-b border-gray-100 dark:border-gray-700">
          <ShieldAlert className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">NetMonitor</span>
        </div>

        {/* Company Badge */}
        {company && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 truncate">{company.name}</span>
            </div>
          </div>
        )}
        
        <nav className="flex-1 p-4 space-y-2">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold" 
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-blue-600 dark:text-blue-400" : "group-hover:text-blue-600 dark:group-hover:text-blue-400")} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User/Logout Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
