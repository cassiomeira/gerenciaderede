import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ne8000, type NE8000DashboardData, type NE8000Interface, type NE8000BgpPeer, type TrafficPoint } from '../services/ne8000Api';
import { Server, Cpu, HardDrive, Users, Activity, Wifi, ArrowDown, ArrowUp, RefreshCw, ChevronDown, Circle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// ============================================================
// HELPERS
// ============================================================
function formatBps(bps: number): string {
  if (bps >= 1e9) return (bps / 1e9).toFixed(2) + ' Gbps';
  if (bps >= 1e6) return (bps / 1e6).toFixed(2) + ' Mbps';
  if (bps >= 1e3) return (bps / 1e3).toFixed(1) + ' Kbps';
  return bps.toFixed(0) + ' bps';
}

function formatKBytes(kb: number): string {
  if (kb >= 1e6) return (kb / 1e6).toFixed(1) + ' GB';
  if (kb >= 1e3) return (kb / 1e3).toFixed(1) + ' MB';
  return kb + ' KB';
}

function cpuColor(pct: number): string {
  if (pct >= 90) return 'text-red-400';
  if (pct >= 70) return 'text-amber-400';
  return 'text-emerald-400';
}

function cpuBarColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function statusColor(state: string): string {
  if (state === 'Established') return 'bg-emerald-500';
  if (state === 'Active' || state === 'Connect') return 'bg-amber-500';
  return 'bg-red-500';
}

function portStatusColor(phy: string, proto: string): string {
  if (phy.includes('down')) return 'border-red-500/50 bg-red-500/10';
  if (proto === 'down') return 'border-amber-500/50 bg-amber-500/10';
  return 'border-emerald-500/50 bg-emerald-500/10';
}

function portDotColor(phy: string, proto: string): string {
  if (phy.includes('down')) return 'bg-red-500';
  if (proto === 'down') return 'bg-amber-500';
  return 'bg-emerald-500';
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function NE8000Dashboard() {
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [trafficHours, setTrafficHours] = useState(2);

  // Queries
  const { data: dashboard, isLoading } = useQuery<NE8000DashboardData>({
    queryKey: ['ne8000-dashboard'],
    queryFn: ne8000.getDashboard,
    refetchInterval: 15000,
  });

  const { data: allInterfaces } = useQuery<NE8000Interface[]>({
    queryKey: ['ne8000-interfaces'],
    queryFn: ne8000.getInterfaces,
    refetchInterval: 15000,
  });

  const { data: bgpPeers } = useQuery<NE8000BgpPeer[]>({
    queryKey: ['ne8000-bgp'],
    queryFn: ne8000.getBgpPeers,
    refetchInterval: 30000,
  });

  const { data: mainPorts } = useQuery<NE8000Interface[]>({
    queryKey: ['ne8000-ports'],
    queryFn: ne8000.getMainPorts,
    refetchInterval: 15000,
  });

  const { data: trafficData } = useQuery<TrafficPoint[]>({
    queryKey: ['ne8000-traffic', selectedInterface, trafficHours],
    queryFn: () => ne8000.getInterfaceTraffic(selectedInterface, trafficHours),
    refetchInterval: 15000,
    enabled: !!selectedInterface,
  });

  // Set default interface
  useEffect(() => {
    if (!selectedInterface && dashboard?.topInterfaces?.length) {
      setSelectedInterface(dashboard.topInterfaces[0].name);
    }
  }, [dashboard, selectedInterface]);

  const chartData = (trafficData || []).map(p => ({
    time: new Date(p.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    download: p.inBps,
    upload: p.outBps,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-gray-400 text-lg">Coletando dados do NE8000...</span>
        </div>
      </div>
    );
  }

  const sys = dashboard?.system;
  const pppoe = dashboard?.pppoe;

  return (
    <div className="min-h-full bg-gray-900">
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-600/20 p-3 rounded-2xl border border-cyan-500/30">
            <Server className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              NE8000 M8
              <span className="text-cyan-400 ml-2 text-lg font-normal">NETCAR.BNG</span>
            </h1>
            <p className="text-gray-400 text-sm">
              {sys?.version} • Uptime: <span className="text-gray-300">{sys?.uptime || 'N/A'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {dashboard?.lastError ? (
            <span className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium border border-red-500/30">
              Erro: {dashboard.lastError}
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Online
            </span>
          )}
          {dashboard?.lastCollect && (
            <span className="text-gray-500 text-xs">
              Atualizado: {new Date(dashboard.lastCollect).toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {/* ============ STATS CARDS ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PPPoE */}
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50 hover:border-cyan-500/30 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-cyan-500/15 p-2.5 rounded-xl group-hover:bg-cyan-500/25 transition-colors">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-gray-400 text-sm font-medium">PPPoE Ativos</span>
          </div>
          <p className="text-3xl font-bold text-white">{pppoe?.total?.toLocaleString() || 0}</p>
          <p className="text-gray-500 text-xs mt-1">
            RADIUS: {pppoe?.radius?.toLocaleString()} • Local: {pppoe?.local}
          </p>
        </div>

        {/* CPU */}
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50 hover:border-cyan-500/30 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-amber-500/15 p-2.5 rounded-xl group-hover:bg-amber-500/25 transition-colors">
              <Cpu className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-gray-400 text-sm font-medium">CPU</span>
          </div>
          <p className={`text-3xl font-bold ${cpuColor(sys?.cpu || 0)}`}>
            {sys?.cpu || 0}%
          </p>
          <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all duration-500 ${cpuBarColor(sys?.cpu || 0)}`}
                 style={{ width: `${Math.min(sys?.cpu || 0, 100)}%` }} />
          </div>
        </div>

        {/* Memory */}
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50 hover:border-cyan-500/30 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-purple-500/15 p-2.5 rounded-xl group-hover:bg-purple-500/25 transition-colors">
              <HardDrive className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-gray-400 text-sm font-medium">Memória</span>
          </div>
          <p className={`text-3xl font-bold ${cpuColor(sys?.memoryPercent || 0)}`}>
            {sys?.memoryPercent || 0}%
          </p>
          <p className="text-gray-500 text-xs mt-1">
            {formatKBytes(sys?.memoryUsed || 0)} / {formatKBytes(sys?.memoryTotal || 0)}
          </p>
        </div>

        {/* Traffic */}
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50 hover:border-cyan-500/30 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-emerald-500/15 p-2.5 rounded-xl group-hover:bg-emerald-500/25 transition-colors">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-gray-400 text-sm font-medium">Tráfego Total</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowDown className="w-4 h-4 text-emerald-400" />
            <span className="text-lg font-bold text-emerald-400">{formatBps(dashboard?.totalTraffic?.inBps || 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUp className="w-4 h-4 text-blue-400" />
            <span className="text-lg font-bold text-blue-400">{formatBps(dashboard?.totalTraffic?.outBps || 0)}</span>
          </div>
        </div>
      </div>

      {/* ============ TRAFFIC CHART + PORT MAP ============ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Traffic Chart */}
        <div className="xl:col-span-2 bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Tráfego em Tempo Real
            </h2>
            <div className="flex items-center gap-3">
              <select
                className="bg-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:border-cyan-500 outline-none"
                value={selectedInterface}
                onChange={e => setSelectedInterface(e.target.value)}
              >
                {(dashboard?.topInterfaces || []).map(i => (
                  <option key={i.name} value={i.name}>
                    {i.name.replace('GigabitEthernet', 'GE')} {i.description ? `(${i.description})` : ''}
                  </option>
                ))}
              </select>
              <select
                className="bg-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:border-cyan-500 outline-none"
                value={trafficHours}
                onChange={e => setTrafficHours(parseInt(e.target.value))}
              >
                <option value={1}>1h</option>
                <option value={2}>2h</option>
                <option value={6}>6h</option>
                <option value={24}>24h</option>
              </select>
            </div>
          </div>

          <div className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="downloadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => formatBps(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(value: number, name: string) => [formatBps(value), name === 'download' ? '↓ Download' : '↑ Upload']}
                  />
                  <Legend formatter={(value) => value === 'download' ? '↓ Download' : '↑ Upload'} />
                  <Area type="monotone" dataKey="download" stroke="#10b981" fill="url(#downloadGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="upload" stroke="#3b82f6" fill="url(#uploadGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Coletando dados de tráfego...</p>
                  <p className="text-xs mt-1">Os gráficos aparecerão em ~30 segundos</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Port Map */}
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-cyan-400" />
            Portas Slot 0/7
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {(mainPorts || []).map(port => (
              <button
                key={port.name}
                onClick={() => setSelectedInterface(port.name)}
                className={`relative p-3 rounded-xl border-2 transition-all duration-300 hover:scale-[1.03] cursor-pointer
                  ${selectedInterface === port.name ? 'ring-2 ring-cyan-500/50' : ''}
                  ${portStatusColor(port.phyStatus, port.protocol)}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${portDotColor(port.phyStatus, port.protocol)} ${port.phyStatus === 'up' && port.protocol === 'up' ? 'animate-pulse' : ''}`} />
                  <span className="text-white text-xs font-bold">
                    {port.name.replace('GigabitEthernet0/7/', '')}
                  </span>
                </div>
                <p className="text-gray-400 text-[10px] truncate leading-tight">
                  {port.description || 'Sem descrição'}
                </p>
                {port.inBps > 0 || port.outBps > 0 ? (
                  <div className="mt-1.5 text-[10px]">
                    <span className="text-emerald-400">↓{formatBps(port.inBps).split(' ')[0]}</span>
                    <span className="text-gray-600 mx-0.5">/</span>
                    <span className="text-blue-400">↑{formatBps(port.outBps).split(' ')[0]}</span>
                  </div>
                ) : null}
              </button>
            ))}
          </div>

          {/* CPU Cores */}
          {sys?.cpuCores && sys.cpuCores.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-700/50">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">CPU Cores</h3>
              <div className="space-y-2">
                {sys.cpuCores.map(core => (
                  <div key={core.name} className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs w-10">{core.name}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${cpuBarColor(core.current)}`}
                        style={{ width: `${Math.min(core.current, 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono w-8 text-right ${cpuColor(core.current)}`}>{core.current}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ INTERFACES TABLE ============ */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          Interfaces
          <span className="text-gray-500 text-sm font-normal ml-2">
            ({(allInterfaces || []).filter(i => i.phyStatus === 'up').length} UP / {allInterfaces?.length || 0} total)
          </span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-3 pr-4">Interface</th>
                <th className="pb-3 pr-4">Descrição</th>
                <th className="pb-3 pr-2 text-center">Status</th>
                <th className="pb-3 pr-4 text-right">In</th>
                <th className="pb-3 pr-4 text-right">Out</th>
                <th className="pb-3 pr-4 text-right">InUtil</th>
                <th className="pb-3 pr-4 text-right">OutUtil</th>
                <th className="pb-3 text-right">Erros</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {(allInterfaces || [])
                .filter(i => i.name.startsWith('GigabitEthernet') || i.name.startsWith('Eth-Trunk'))
                .slice(0, 50)
                .map(iface => (
                <tr key={iface.name} className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors">
                  <td className="py-2.5 pr-4 font-mono text-xs text-cyan-300">
                    {iface.name.replace('GigabitEthernet', 'GE')}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-400 text-xs max-w-[200px] truncate">
                    {iface.description || '-'}
                  </td>
                  <td className="py-2.5 pr-2 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                      ${iface.phyStatus === 'up' && iface.protocol === 'up' 
                        ? 'bg-emerald-500/15 text-emerald-400' 
                        : iface.phyStatus === 'up' 
                          ? 'bg-amber-500/15 text-amber-400' 
                          : 'bg-red-500/15 text-red-400'}`}>
                      <Circle className="w-1.5 h-1.5 fill-current" />
                      {iface.phyStatus}/{iface.protocol}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-emerald-400 font-mono text-xs">
                    {iface.inBps > 0 ? formatBps(iface.inBps) : '-'}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-blue-400 font-mono text-xs">
                    {iface.outBps > 0 ? formatBps(iface.outBps) : '-'}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-xs">{iface.inUtil}</td>
                  <td className="py-2.5 pr-4 text-right text-xs">{iface.outUtil}</td>
                  <td className="py-2.5 text-right text-xs">
                    {iface.inErrors + iface.outErrors > 0 
                      ? <span className="text-red-400">{iface.inErrors + iface.outErrors}</span>
                      : <span className="text-gray-600">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ BGP PEERS ============ */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Wifi className="w-5 h-5 text-cyan-400" />
          BGP Peers
          <span className="text-gray-500 text-sm font-normal ml-2">
            {dashboard?.bgpSummary?.established || 0}/{dashboard?.bgpSummary?.total || 0} Established
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(bgpPeers || []).map(peer => (
            <div key={peer.peer} className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/30 hover:border-cyan-500/20 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white font-bold text-sm">{peer.description || peer.peer}</p>
                  <p className="text-gray-500 text-xs font-mono">{peer.peer}</p>
                </div>
                <span className={`w-3 h-3 rounded-full ${statusColor(peer.state)}`} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">AS:</span>
                  <span className="text-gray-300 ml-1">{peer.as}</span>
                </div>
                <div>
                  <span className="text-gray-500">Estado:</span>
                  <span className={`ml-1 ${peer.state === 'Established' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {peer.state}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Prefixos:</span>
                  <span className="text-cyan-400 ml-1 font-bold">{peer.prefixesReceived?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Uptime:</span>
                  <span className="text-gray-300 ml-1">{peer.uptime}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
