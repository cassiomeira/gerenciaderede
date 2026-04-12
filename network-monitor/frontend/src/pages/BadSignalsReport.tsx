import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Signal, Copy, Check, Search, 
  MapPin, AlertTriangle, TrendingDown, ArrowUpDown,
  RefreshCw, UserCheck, Users
} from 'lucide-react';
import { clsx } from 'clsx';
import { networkApi } from '../services/api';

interface BadSignal {
  name: string;
  mac: string;
  signal: number;
  ccq: number;
  apName: string;
  apIp: string;
}

export default function BadSignalsReport() {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [signalThreshold, setSignalThreshold] = useState(-70);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResolvingAll, setIsResolvingAll] = useState(false);
  const [resolvingMacs, setResolvingMacs] = useState<Set<string>>(new Set());

  const { data: signals, isLoading, refetch } = useQuery<BadSignal[]>({
    queryKey: ['bad-signals'],
    queryFn: () => networkApi.getBadSignals(),
    refetchInterval: 60000,
  });

  const filteredSignals = (signals || []).filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.mac.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.apName.toLowerCase().includes(searchTerm.toLowerCase());
    const belowThreshold = s.signal <= signalThreshold;
    return matchesSearch && belowThreshold;
  });

  const handleCopy = () => {
    const text = filteredSignals
      .map(s => `${s.name.padEnd(30)} | MAC: ${s.mac} | Sinal: ${s.signal}dBm | CCQ: ${s.ccq}% | AP: ${s.apName}`)
      .join('\n');
    
    navigator.clipboard.writeText(`RELATÓRIO DE SINAIS RUINS (<= ${signalThreshold}dBm)\nData: ${new Date().toLocaleString()}\n\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      const data = await networkApi.triggerFullMacCache();
      alert(data.message || 'Varredura iniciada! Os sinais aparecerão em alguns minutos.');
      // Aguarda um pouco e limpa o estado visual do botão
      setTimeout(() => setIsRefreshing(false), 5000);
    } catch (err: any) {
      if (err.status === 409) {
        alert('Uma varredura já está em andamento.');
      } else {
        alert('Erro ao conectar com o servidor.');
      }
      setIsRefreshing(false);
    }
  };

  const handleResolveName = async (mac: string) => {
    try {
      setResolvingMacs(prev => new Set(prev).add(mac));
      await networkApi.getClientStatus(mac);
      // Força o refetch do relatório para pegar o nome novo que agora está no DB
      await refetch();
    } catch (error) {
      alert('Não foi possível localizar este cliente no IXC pelo MAC.');
    } finally {
      setResolvingMacs(prev => {
        const next = new Set(prev);
        next.delete(mac);
        return next;
      });
    }
  };

  const getSignalColor = (signal: number) => {
    if (signal <= -80) return 'text-red-500';
    if (signal <= -70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const handleResolveAll = async () => {
    const unlinkedMacs = filteredSignals
      .filter(s => s.name.startsWith('Equipamento'))
      .map(s => s.mac);

    if (unlinkedMacs.length === 0) {
      alert('Nenhum equipamento pendente de vínculo encontrado nesta lista.');
      return;
    }

    if (!confirm(`Deseja tentar vincular ${unlinkedMacs.length} equipamentos ao IXC automaticamente? Isso pode levar alguns segundos.`)) {
      return;
    }

    setIsResolvingAll(true);
    let successCount = 0;

    for (let i = 0; i < unlinkedMacs.length; i++) {
      const mac = unlinkedMacs[i];
      setResolvingMacs(prev => new Set(prev).add(mac));
      try {
        await networkApi.getClientStatus(mac, true);
        successCount++;
      } catch (err) {}
      setResolvingMacs(prev => {
        const next = new Set(prev);
        next.delete(mac);
        return next;
      });
      // Pequena pausa para não afogar o backend/IXC
      await new Promise(r => setTimeout(r, 800));
    }

    setIsResolvingAll(false);
    alert(`Processo concluído! ${successCount} de ${unlinkedMacs.length} equipamentos vinculados com sucesso.`);
    await refetch();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingDown className="text-red-500" />
            Relatório de Sinais Wireless
          </h1>
          <p className="text-slate-500 mt-1">Análise de clientes com sinal degradado na rede (Pior para o Melhor)</p>
        </div>
        
        <div className="flex items-center gap-2">
          {filteredSignals.some(s => s.name.startsWith('Equipamento')) && (
            <button
              onClick={handleResolveAll}
              disabled={isResolvingAll}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all shadow-sm",
                isResolvingAll 
                  ? "bg-amber-100 text-amber-500 cursor-wait" 
                  : "bg-amber-500 text-white hover:bg-amber-600"
              )}
              title="Vincular todos os não identificados ao IXC"
            >
              <Users size={18} className={clsx(isResolvingAll && "animate-pulse")} />
              {isResolvingAll ? 'Vinculando...' : 'Vincular Todos'}
            </button>
          )}

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
              isRefreshing ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm"
            )}
            title="Sinais levam cerca de 15min para atualizar sozinhos. Use para forçar."
          >
            <RefreshCw size={18} className={clsx(isRefreshing && "animate-spin")} />
            {isRefreshing ? 'Recarregando...' : 'Atualizar'}
          </button>

          <button
            onClick={handleCopy}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
              copied ? "bg-green-100 text-green-700" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
            )}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por cliente, MAC ou antena..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Limiar: {signalThreshold}dBm</span>
          <input
            type="range"
            min="-90"
            max="-50"
            step="1"
            value={signalThreshold}
            onChange={(e) => setSignalThreshold(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500">Total Afetados</span>
          <span className="text-lg font-bold text-red-600">{filteredSignals.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">MAC</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  Sinal <ArrowUpDown size={14} />
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">CCQ</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">Transmissor</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                       <Signal className="animate-pulse text-indigo-500" />
                       Analisando sinais da rede...
                    </div>
                  </td>
                </tr>
              ) : filteredSignals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                    Nenhum sinal encontrado abaixo de {signalThreshold}dBm com esses filtros.
                  </td>
                </tr>
              ) : (
                filteredSignals.map((s, idx) => (
                  <tr key={s.mac + idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{s.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">{s.mac}</td>
                    <td className="px-6 py-4">
                      <div className={clsx("font-bold text-lg", getSignalColor(s.signal))}>
                        {s.signal} <small className="text-xs font-normal">dBm</small>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={clsx(
                        "inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold",
                        s.ccq >= 90 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      )}>
                        {s.ccq}%
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={14} className="text-slate-400" />
                        <span>{s.apName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 ml-5 font-mono">{s.apIp}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {s.name.startsWith('Equipamento') && (
                          <button 
                            onClick={() => handleResolveName(s.mac)}
                            disabled={resolvingMacs.has(s.mac)}
                            className={clsx(
                              "p-2 rounded-lg transition-all",
                              resolvingMacs.has(s.mac) ? "text-slate-300 animate-pulse" : "text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                            )}
                            title="Tentar identificar nome pelo IXC (MAC)"
                          >
                            <UserCheck size={16} />
                          </button>
                        )}
                        <button 
                           onClick={() => {
                             const text = `${s.name} | MAC: ${s.mac} | Sinal: ${s.signal}dBm | AP: ${s.apName}`;
                             navigator.clipboard.writeText(text);
                           }}
                           className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                           title="Copiar este cliente"
                        >
                           <Copy size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-indigo-50 rounded-2xl p-4 flex items-start gap-4">
        <AlertTriangle className="text-indigo-600 mt-1 shrink-0" size={20} />
        <div className="text-sm text-indigo-700">
          <p className="font-bold">Dica de Manutenção:</p>
          <p>Utilize a lista acima para filtrar os piores sinais e exportar para a equipe de campo. Sinais abaixo de -75dBm costumam apresentar instabilidades constantes.</p>
        </div>
      </div>
    </div>
  );
}
