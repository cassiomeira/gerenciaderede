import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { networkApi, type Transmitter } from '../services/api';
import { 
  Radio, MapPin, Cpu, Link as LinkIcon, Loader2, AlertCircle, 
  Users, Activity, X, Signal, Shield, Key, Hash, Save, 
  Thermometer, Zap, BarChart3, Clock, Wifi, HardDrive, Search, Filter, RefreshCw
} from 'lucide-react';

export default function APManagement() {
  const queryClient = useQueryClient();
  const [selectedAp, setSelectedAp] = useState<Transmitter | null>(null);
  const [editingCreds, setEditingCreds] = useState<string | null>(null);
  const [tunnelInfo, setTunnelInfo] = useState<any>(null);
  const [isRequestingTunnel, setIsRequestingTunnel] = useState(false);
  
  // Estados para Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [sshFilter, setSshFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED' | 'NOT_CONFIGURED' | 'PENDING'>('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [telemetryFilter, setTelemetryFilter] = useState<'ALL' | 'HAS_TELEMETRY' | 'NO_TELEMETRY'>('ALL');

  const { data: transmitters, isLoading, isError } = useQuery({
    queryKey: ['transmitters'],
    queryFn: () => networkApi.getTransmitters(),
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['network-stats'],
    queryFn: () => networkApi.getStats(),
    refetchInterval: 10000,
  });

  const { data: telemetry, isLoading: isLoadingTelemetry } = useQuery({
    queryKey: ['ap-telemetry', selectedAp?.ip],
    queryFn: async () => {
      if (!selectedAp) return null;
      return networkApi.getTelemetry(selectedAp.ip);
    },
    enabled: !!selectedAp,
    staleTime: 60000,
  });

  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => networkApi.getCompanySettings(),
    staleTime: 300000,
  });

  // Lógica de Filtragem
  const filteredTransmitters = useMemo(() => {
    if (!transmitters) return [];
    
    return transmitters.filter(ap => {
      const desc = ap.descricao || '';
      const ip = ap.ip || '';
      const matchesSearch = desc.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           ip.includes(searchTerm);
      
      const matchesStatus = statusFilter === 'ALL' || ap.status === statusFilter;
      
      const apSshStatus = ap.config?.lastSshStatus || 'NOT_CONFIGURED';
      const matchesSsh = sshFilter === 'ALL' || 
                         (sshFilter === 'PENDING' ? apSshStatus !== 'SUCCESS' : apSshStatus === sshFilter);

      const apMode = ap.mode || 'UNKNOWN';
      const matchesMode = modeFilter === 'ALL' || apMode.toLowerCase().includes(modeFilter.toLowerCase());

      const hasTel = !!(ap as any).hasTelemetry;
      const matchesTelemetry = telemetryFilter === 'ALL' ||
                               (telemetryFilter === 'HAS_TELEMETRY' ? hasTel : !hasTel);

      return matchesSearch && matchesStatus && matchesSsh && matchesMode && matchesTelemetry;
    });
  }, [transmitters, searchTerm, statusFilter, sshFilter, modeFilter, telemetryFilter]);

  const mutation = useMutation({
    mutationFn: (vars: { id: string, ip: string, user: string, pass: string, port: number, equipmentType?: string }) => 
      networkApi.updateCredentials(vars.id, vars.ip, vars.user, vars.pass, vars.port, vars.equipmentType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transmitters'] });
      setEditingCreds(null);
    }
  });

  const forceCollectMutation = useMutation({
    mutationFn: (ip: string) => networkApi.collectTelemetry(ip),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-telemetry', selectedAp?.ip] });
    }
  });

  const [isCollectingAll, setIsCollectingAll] = useState(false);
  const triggerFullCollection = async () => {
    setIsCollectingAll(true);
    try {
      await networkApi.triggerFullTelemetry();
    } catch {}
    // A coleta roda em background, então em 5s desmarcamos o loading
    setTimeout(() => setIsCollectingAll(false), 5000);
  };

  const handleRequestTunnel = async () => {
    if (!selectedAp) return;
    setIsRequestingTunnel(true);
    setTunnelInfo(null);
    try {
      const res = await networkApi.requestWinboxTunnel(selectedAp.ip, 8291);
      // Wait, apiPost usually returns the data wrapper, assume res has port
      setTunnelInfo(res as any);
    } catch (err: any) {
      alert('Erro ao solicitar túnel seguro: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsRequestingTunnel(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Carregando infraestrutura...</p>
      </div>
    );
  }

  const getTelemetryTag = () => {
    const mode = companySettings?.telemetryMode || 'CENTRAL';
    if (mode === 'EDGE_AGENT') return { text: 'Real-time (Edge)', color: 'bg-purple-100 text-purple-700' };
    if (mode === 'MIKROTIK_SCRIPT') return { text: 'Periódico (Script)', color: 'bg-emerald-100 text-emerald-700' };
    return { text: 'Atrasado (Central)', color: 'bg-yellow-100 text-yellow-700' };
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
            Monitoramento de Transmissores
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Diagnósticos avançados e gestão de credenciais SSH por antena.
          </p>
        </div>

        {/* Barra de Busca e Filtros */}
        <div className="flex flex-wrap items-center gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-3xl border border-gray-200 dark:border-gray-700 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por Nome ou IP..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border-none bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select 
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-gray-800 border-none rounded-xl py-2 px-3 focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="ALL">Todos Status</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
            </select>

            <select 
              value={sshFilter}
              onChange={(e: any) => setSshFilter(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-gray-800 border-none rounded-xl py-2 px-3 focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="ALL">Todos SSH</option>
              <option value="PENDING">Pendências (Não OK)</option>
              <option value="SUCCESS">Acesso OK</option>
              <option value="FAILED">Falha/Erro</option>
              <option value="NOT_CONFIGURED">Não Config.</option>
            </select>

            <select 
              value={modeFilter}
              onChange={(e: any) => setModeFilter(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-gray-800 border-none rounded-xl py-2 px-3 focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="ALL">Todos os Modos</option>
              <option value="ap-bridge">Somente AP-Bridge</option>
              <option value="station">Somente Station</option>
              <option value="bridge">Somente Bridge</option>
            </select>

            <select 
              value={telemetryFilter}
              onChange={(e: any) => setTelemetryFilter(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-gray-800 border-none rounded-xl py-2 px-3 focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="ALL">Toda Telemetria</option>
              <option value="HAS_TELEMETRY">Com Telemetria</option>
              <option value="NO_TELEMETRY">Sem Telemetria</option>
            </select>
          </div>

          <button
            onClick={triggerFullCollection}
            disabled={isCollectingAll}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm ${
              isCollectingAll 
                ? 'bg-green-100 text-green-600 cursor-wait' 
                : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 active:scale-95'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isCollectingAll ? 'animate-spin' : ''}`} />
            <span>{isCollectingAll ? 'Coletando...' : 'Forçar Coleta Geral'}</span>
          </button>
        </div>
      </div>

      {/* Dashboard Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
          label="Total Antenas" 
          value={stats?.totalDevices || 0} 
          icon={<Radio className="w-6 h-6" />} 
          color="blue"
          description="Limpar filtros"
          onClick={() => {
            setStatusFilter('ALL');
            setSshFilter('ALL');
            setModeFilter('ALL');
            setTelemetryFilter('ALL');
            setSearchTerm('');
          }}
        />
        <StatCard 
          label="Online Agora" 
          value={stats?.onlineDevices || 0} 
          icon={<Activity className="w-6 h-6" />} 
          color="green"
          description={`Clique para ver ${stats?.onlineDevices || 0} Online`}
          onClick={() => setStatusFilter('ONLINE')}
        />
        <StatCard 
          label="SSH Acesso OK" 
          value={stats?.sshStats?.success || 0} 
          icon={<Shield className="w-6 h-6" />} 
          color="emerald"
          description="Clique para ver Acesso OK"
          onClick={() => setSshFilter('SUCCESS')}
        />
        <StatCard 
          label="Pendências SSH" 
          value={stats?.sshStats?.pending || 0} 
          icon={<Key className="w-6 h-6" />} 
          color="orange"
          description="Clique para ver falhas"
          onClick={() => setSshFilter('PENDING')}
        />
      </div>

      {isError ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-center space-x-4">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <p className="text-red-700 font-medium">Erro ao carregar os transmissores.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Exibindo {filteredTransmitters.length} de {transmitters?.length || 0} equipamentos
            </div>
            {companySettings && (
              <div className={`text-xs font-bold px-3 py-1 rounded-full border border-current flex items-center shadow-sm ${getTelemetryTag().color}`}>
               <Activity className="w-3 h-3 mr-1" />
               Ping Mestre: {getTelemetryTag().text}
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredTransmitters.map((ap) => (
              <div 
                key={ap.id} 
                className={`bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border transition-all duration-300 ${
                  ap.status === 'ONLINE' 
                    ? 'border-green-100 dark:border-green-900/30' 
                    : 'border-gray-100 dark:border-gray-700'
                } hover:shadow-xl relative overflow-hidden group`}
              >
                {/* Indicador de Status SSH Vertical mais largo */}
                <div className={`absolute top-0 right-0 w-2 h-full shadow-inner ${
                  ap.config?.lastSshStatus === 'SUCCESS' ? 'bg-green-500 shadow-green-600/50' : 
                  ap.config?.lastSshStatus === 'FAILED' ? 'bg-red-500 shadow-red-600/50' : 'bg-gray-300'
                }`} title={`SSH: ${ap.config?.lastSshStatus || 'Não testado'}`} />

                <div className="flex items-start justify-between mb-4">
                  <div className={`p-4 rounded-2xl ${
                    ap.status === 'ONLINE' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'
                  }`}>
                    <Radio className={`w-8 h-8 ${ap.status === 'ONLINE' ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
                      ap.status === 'ONLINE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {ap.status}
                    </span>
                    {ap.latency !== undefined && (
                      <div className="flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                        <Activity className="w-3 h-3 mr-1" />
                        {ap.latency.toFixed(1)}ms
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2 mb-2">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                    {ap.descricao}
                  </h3>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                    ap.equipmentType?.toLowerCase().includes('mikrotik') ? 'bg-blue-100 text-blue-700' :
                    ap.equipmentType?.toLowerCase().includes('intelbras') ? 'bg-green-100 text-green-700' :
                    ap.equipmentType?.toLowerCase().includes('ubiquiti') ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {ap.equipmentType || 'Mikrotik'}
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <MapPin className="w-3.5 h-3.5 mr-2 text-gray-400" />
                    <span className="text-xs font-medium italic">{ap.ip}</span>
                  </div>
                  
                  <div className="flex items-center text-gray-600 dark:text-gray-400 mt-1 pb-2 border-b border-gray-100 dark:border-gray-700/50 justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <Wifi className="w-3.5 h-3.5 mr-2 text-indigo-400" />
                        <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                          {(ap as any).ssid || 'N/A'} ({(ap as any).frequency || '---'})
                        </span>
                      </div>
                      <div className="flex items-center mt-1">
                        <Signal className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                          Sinal: {(ap as any).signal || 'N/A'} | Noise: {(ap as any).noiseFloor || 'N/A'}
                        </span>
                      </div>
                    </div>
                    {!(ap as any).hasTelemetry && (
                      <span className="text-[9px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center shadow-sm border border-red-200">
                        <AlertCircle className="w-3 h-3 mr-1" /> Sem Telemetria
                      </span>
                    )}
                  </div>
                  
                  {/* Gestão de Credenciais SSH */}
                  <div className={`p-3 rounded-xl border transition-colors ${
                    ap.config?.lastSshStatus === 'SUCCESS' 
                      ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-800/20' 
                      : ap.config?.lastSshStatus === 'FAILED'
                        ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-800/20'
                        : 'bg-gray-50 dark:bg-gray-900/40 border-gray-100 dark:border-gray-700'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                        <Shield className={`w-3 h-3 mr-1 ${
                          ap.config?.lastSshStatus === 'SUCCESS' ? 'text-green-600' : 
                          ap.config?.lastSshStatus === 'FAILED' ? 'text-red-600' : ''
                        }`} /> 
                        Acesso SSH
                      </span>
                      <button 
                        onClick={() => setEditingCreds(editingCreds === ap.id ? null : ap.id)}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        {editingCreds === ap.id ? 'Cancelar' : (ap.config?.hasPass ? 'Editar' : 'Configurar')}
                      </button>
                    </div>

                    {editingCreds === ap.id ? (
                      <form 
                        onSubmit={(e: any) => {
                          e.preventDefault();
                          const formData = new FormData(e.target);
                          mutation.mutate({
                            id: ap.id,
                            ip: ap.ip,
                            user: formData.get('user') as string,
                            pass: formData.get('pass') as string,
                            port: parseInt(formData.get('port') as string),
                            equipmentType: formData.get('equipmentType') as string
                          });
                        }}
                        className="space-y-2"
                      >
                        <div className="flex space-x-2">
                          <input name="user" placeholder="User" defaultValue={ap.config?.user || 'admin'} className="w-1/2 text-[10px] p-1.5 border rounded-lg bg-white dark:bg-gray-800 dark:text-gray-200" required />
                          <input name="port" type="number" defaultValue={ap.config?.port || 22} className="w-1/4 text-[10px] p-1.5 border rounded-lg bg-white dark:bg-gray-800 dark:text-gray-200" required />
                        </div>
                        <select name="equipmentType" defaultValue={ap.equipmentType || 'Mikrotik'} className="w-full text-[10px] p-1.5 border rounded-lg bg-white dark:bg-gray-800 dark:text-gray-200" required>
                          <option value="Mikrotik">Mikrotik</option>
                          <option value="Intelbras">Intelbras</option>
                          <option value="Ubiquiti">Ubiquiti</option>
                          <option value="Generic">Genérico (SNMP Only)</option>
                        </select>
                        <input name="pass" type="password" placeholder="Senha SSH" className="w-full text-[10px] p-1.5 border rounded-lg bg-white dark:bg-gray-800 dark:text-gray-200" required />
                        <button 
                          disabled={mutation.isPending}
                          type="submit" 
                          className="w-full bg-blue-600 text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center"
                        >
                          {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />} 
                          Salvar Acesso
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-[10px] text-gray-500 font-medium space-x-4">
                          <div className="flex items-center"><Key className="w-3 h-3 mr-1" /> {ap.config?.user || '---'}</div>
                          <div className="flex items-center"><Hash className="w-3 h-3 mr-1" /> {ap.config?.port || 22}</div>
                        </div>
                        <div className={`text-[10px] font-bold italic ${
                          ap.config?.lastSshStatus === 'SUCCESS' ? 'text-green-600' : 
                          ap.config?.lastSshStatus === 'FAILED' ? 'text-red-500 px-2 py-0.5 bg-red-100 rounded' : 'text-gray-400'
                        }`}>
                          {ap.config?.lastSshStatus === 'SUCCESS' ? 'Acesso OK' : 
                           ap.config?.lastSshStatus === 'FAILED' ? 'Falha' : 'Não Testado'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                  <button 
                    onClick={() => setSelectedAp(ap)}
                    className={`w-full flex items-center justify-center space-x-2 py-3 rounded-2xl font-bold transition-all duration-300 ${
                      ap.status === 'ONLINE'
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 px-4'
                        : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-500/20 px-4 pulse-slow'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>{ap.status === 'ONLINE' ? 'Diagnóstico Real' : 'Ver Última Telemetria'}</span>
                    <Activity className="w-4 h-4 ml-1 opacity-70" />
                  </button>
              </div>
            ))}
          </div>
          
          {filteredTransmitters.length === 0 && (
            <div className="py-20 text-center">
              <AlertCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-bold text-lg">Nenhum transmissor encontrado com esses filtros.</p>
            </div>
          )}
        </>
      )}

      {/* Modal de Detalhes Avançados */}
      {selectedAp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 w-full max-w-5xl h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/10">
            {/* Header */}
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
              <div>
                <h2 className="text-3xl font-black flex items-center tracking-tight">
                  <Activity className="w-8 h-8 mr-4 animate-pulse" />
                  {selectedAp.descricao}
                </h2>
                <div className="flex items-center space-x-6 mt-2 opacity-90 font-medium">
                  <span className="flex items-center text-sm"><MapPin className="w-4 h-4 mr-1" /> {selectedAp.ip}</span>
                  <span className="flex items-center text-sm"><Cpu className="w-4 h-4 mr-1" /> {selectedAp.mode}</span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {selectedAp?.equipmentType?.toLowerCase().includes('mikrotik') && companySettings?.telemetryMode === 'EDGE_AGENT' && (
                  <button 
                    onClick={handleRequestTunnel}
                    disabled={isRequestingTunnel || Boolean(tunnelInfo)}
                    className={`p-3 rounded-2xl transition-all flex items-center space-x-2 text-sm font-bold shadow-sm ${
                      tunnelInfo 
                        ? 'bg-green-600 hover:bg-green-500' 
                        : 'bg-teal-600 hover:bg-teal-500'
                    }`}
                    title="Abre um túnel reverso seguro via Edge Agent"
                  >
                    {isRequestingTunnel ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /><span className="hidden sm:inline">Conectando...</span></>
                    ) : tunnelInfo ? (
                      <><Shield className="w-5 h-5" /><span className="hidden sm:inline">Porta: {tunnelInfo.port}</span></>
                    ) : (
                      <><LinkIcon className="w-5 h-5" /><span className="hidden sm:inline">Acessar Winbox</span></>
                    )}
                  </button>
                )}
                <button 
                  onClick={() => selectedAp && forceCollectMutation.mutate(selectedAp.ip)}
                  disabled={forceCollectMutation.isPending}
                  className="p-3 bg-indigo-800/50 hover:bg-indigo-700 rounded-2xl transition-all flex items-center space-x-2 text-sm font-bold shadow-sm"
                  title="Forçar atualização da telemetria agora"
                >
                  <RefreshCw className={`w-5 h-5 ${forceCollectMutation.isPending ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{forceCollectMutation.isPending ? 'Coletando...' : 'Forçar Atualização'}</span>
                </button>
                <button 
                  onClick={() => { setSelectedAp(null); setTunnelInfo(null); }}
                  className="p-3 bg-white/20 hover:bg-white/30 rounded-2xl transition-all"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              
              {tunnelInfo && (
                <div className="mb-8 p-6 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/30 dark:to-emerald-900/30 border border-teal-200 dark:border-teal-800/50 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-teal-500 text-white rounded-2xl shadow-sm">
                      <Shield className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-black text-teal-900 dark:text-teal-400 tracking-tight mb-2">
                        Túnel Reverso Estabelecido!
                      </h4>
                      <p className="text-teal-800 dark:text-teal-300 text-sm mb-4 font-medium">
                        O tráfego está sendo roteado com segurança pelo seu Edge Agent direto para o equipamento {selectedAp?.ip}. 
                        Esta porta TCP expirará em 2 minutos se não for criada uma conexão através de seu Winbox.
                      </p>
                      
                      <div className="bg-white dark:bg-gray-900 border border-teal-100 dark:border-teal-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Como acessar</p>
                          <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                            Abra o Winbox no seu PC, digite o endereço abaixo no campo <strong className="font-bold">Connect To</strong> e coloque o usuário e senha do Rádio:
                          </p>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center shadow-inner select-all cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                          <code className="text-xl font-black text-gray-900 dark:text-white tracking-wider font-mono">
                            {window.location.hostname}:{tunnelInfo.port}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Banner de Status Offline */}
              {selectedAp?.status === 'OFFLINE' && (
                <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl flex items-center space-x-4 text-amber-800 dark:text-amber-400 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="p-3 bg-amber-200 dark:bg-amber-800 rounded-2xl">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-black uppercase tracking-widest text-xs">Equipamento Offline</h5>
                    <p className="text-sm font-medium opacity-90">
                      Este rádio não está respondendo. As informações abaixo representam o <strong>último diagnóstico salvo com sucesso</strong>.
                    </p>
                  </div>
                </div>
              )}

              {isLoadingTelemetry ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                  <p className="text-gray-500 font-bold animate-pulse text-lg tracking-widest uppercase">Carregando Telemetria...</p>
                </div>
              ) : telemetry ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* Coluna Lateral: Info do Equipamento */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* Identificação */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-3xl border border-purple-100 dark:border-purple-800">
                      <h4 className="text-xs font-black text-purple-400 uppercase tracking-[0.2em] mb-4 flex items-center">
                        <HardDrive className="w-4 h-4 mr-2" /> Identificação
                      </h4>
                      <div className="space-y-4">
                        <StatRow label="Identity" value={telemetry.identity || 'N/A'} icon={<Radio className="w-3 h-3" />} color="text-purple-600" />
                        <StatRow label="Modelo" value={telemetry.model || 'N/A'} icon={<HardDrive className="w-3 h-3" />} color="text-purple-600" />
                        <StatRow label="Firmware" value={telemetry.firmware || 'N/A'} icon={<Cpu className="w-3 h-3" />} color="text-purple-600" />
                      </div>
                    </div>

                    {/* Recursos */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center">
                        <Cpu className="w-4 h-4 mr-2" /> Recursos do Sistema
                      </h4>
                      <div className="space-y-4">
                        <StatRow label="CPU Load" value={telemetry.cpuLoad || 'N/A'} icon={<Cpu className="w-3 h-3" />} />
                        <StatRow label="Uptime" value={telemetry.uptime || 'N/A'} icon={<Clock className="w-3 h-3" />} />
                        <StatRow label="Memória Livre" value={telemetry.freeMemory || 'N/A'} icon={<Zap className="w-3 h-3" />} />
                        <StatRow label="Memória Total" value={telemetry.totalMemory || 'N/A'} icon={<Zap className="w-3 h-3" />} />
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                          <StatRow label="Temperatura" value={telemetry.temperature || 'N/A'} icon={<Thermometer className="w-3 h-3" />} highlight={parseInt(telemetry.temperature) > 60} />
                          <StatRow label="Voltagem" value={telemetry.voltage || 'N/A'} icon={<Zap className="w-3 h-3" />} />
                        </div>
                      </div>
                    </div>

                    {/* Wireless */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800">
                      <h4 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-6 flex items-center">
                        <Wifi className="w-4 h-4 mr-2" /> Wireless
                      </h4>
                      <div className="space-y-4">
                        <StatRow label="SSID" value={telemetry.ssid || 'N/A'} icon={<Wifi className="w-3 h-3" />} color="text-indigo-600" />
                        <StatRow label="Sinal (AP)" value={telemetry.signal || 'N/A'} icon={<Signal className="w-3 h-3" />} color="text-emerald-600" highlight={parseInt(telemetry.signal) < -70} />
                        <StatRow label="Frequência" value={telemetry.frequency || 'N/A'} icon={<Hash className="w-3 h-3" />} color="text-indigo-600" />
                        <StatRow label="Modo" value={telemetry.wirelessMode || 'N/A'} icon={<Radio className="w-3 h-3" />} color="text-indigo-600" />
                        <StatRow label="Banda" value={telemetry.band || 'N/A'} icon={<Activity className="w-3 h-3" />} color="text-indigo-600" />
                        <StatRow label="Channel Width" value={telemetry.channelWidth || 'N/A'} icon={<Signal className="w-3 h-3" />} color="text-indigo-600" />
                        <StatRow label="Scan List" value={telemetry.scanList || 'N/A'} icon={<Search className="w-3 h-3" />} color="text-indigo-600" />
                        <StatRow label="Noise Floor" value={telemetry.noiseFloor || 'N/A'} icon={<Activity className="w-3 h-3" />} color="text-indigo-600" />
                        <StatRow label="TX Power" value={telemetry.txPower || 'N/A'} icon={<Zap className="w-3 h-3" />} color="text-indigo-600" />
                      </div>
                    </div>
                  </div>

                  {/* Coluna Principal: Interfaces de Rede + Clientes */}
                  <div className="lg:col-span-8 space-y-8">
                    {/* Interfaces de Rede */}
                    <div>
                      <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight mb-4 flex items-center">
                        <LinkIcon className="w-5 h-5 mr-3 text-green-600" />
                        Interfaces de Rede ({telemetry.interfaces?.length || 0})
                      </h4>
                      <div className="space-y-2">
                        {(telemetry.interfaces || []).map((iface: any, idx: number) => (
                          <div key={idx} className={`rounded-2xl p-4 border flex items-center justify-between ${
                            iface.speedClass?.includes('❌') ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' :
                            iface.speedClass?.includes('⚠️') ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800' :
                            iface.speedClass?.includes('✅') ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' :
                            'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                          }`}>
                            <div className="flex items-center space-x-4">
                              <div className={`w-3 h-3 rounded-full ${iface.running ? 'bg-green-500' : 'bg-gray-300'}`} />
                              <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{iface.name}</p>
                                <p className="text-[10px] text-gray-400">{iface.type}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-black ${
                                iface.speedClass?.includes('❌') ? 'text-red-600' :
                                iface.speedClass?.includes('⚠️') ? 'text-orange-600' :
                                iface.speedClass?.includes('✅') ? 'text-green-600' :
                                'text-gray-500'
                              }`}>{iface.speedClass || iface.speed}</p>
                              <p className="text-[9px] text-gray-400">{iface.running ? 'ATIVO' : 'INATIVO'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Info de Clientes */}
                    <div>
                      <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight mb-4 flex items-center">
                        <Users className="w-5 h-5 mr-3 text-blue-600" /> 
                        Clientes Conectados ({telemetry.clientCount || 0})
                      </h4>
                      {telemetry.clientsJson ? (() => {
                        try {
                          const clients = JSON.parse(telemetry.clientsJson);
                          if (!Array.isArray(clients) || clients.length === 0) {
                            return (
                              <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-800 text-center">
                                <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Nenhum cliente conectado no momento.</span>
                              </div>
                            );
                          }
                          return (
                            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                              {clients.map((c: any, idx: number) => {
                                const sigNum = parseInt(c.signal || '0');
                                const isGood = sigNum >= -69;
                                const isWarn = sigNum < -69 && sigNum >= -79;
                                
                                return (
                                  <div key={idx} className={`rounded-xl p-3 border flex items-center justify-between ${
                                    isWarn ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800' :
                                    !isGood ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' :
                                    'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                                  }`}>
                                    <div className="flex items-center space-x-3">
                                      <Wifi className={`w-4 h-4 ${isWarn ? 'text-orange-500' : !isGood ? 'text-red-500' : 'text-green-500'}`} />
                                      <div>
                                        <p className="font-bold text-sm text-gray-900 dark:text-white font-mono">{c.mac}</p>
                                        <p className="text-[10px] text-gray-400">TX Rate: {c.txRate}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-base font-black ${isWarn ? 'text-orange-600' : !isGood ? 'text-red-600' : 'text-green-600'}`}>
                                        {c.signal}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        } catch (e) {
                          return null;
                        }
                      })() : (
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-800 text-center">
                          <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Aguardando telemetria de sinal...</span>
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-right text-[10px] text-gray-400">
                      <p>Última coleta: {telemetry.collectedAt ? new Date(telemetry.collectedAt).toLocaleString('pt-BR') : 'Nunca'}</p>
                      <p className="mt-1">As informações são atualizadas <strong>automaticamente a cada 1 hora</strong>.</p>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-orange-500">
                  <AlertCircle className="w-16 h-16 mb-4" />
                  <p className="text-xl font-bold">Telemetria ainda não coletada.</p>
                  <p className="text-sm opacity-70 mt-2">A primeira coleta ocorrerá automaticamente em até 1 hora.</p>
                  
                  <button 
                    onClick={() => selectedAp && forceCollectMutation.mutate(selectedAp.ip)}
                    disabled={forceCollectMutation.isPending}
                    className="mt-8 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold shadow-lg transition-all flex items-center space-x-2"
                  >
                    <RefreshCw className={`w-5 h-5 ${forceCollectMutation.isPending ? 'animate-spin' : ''}`} />
                    <span>{forceCollectMutation.isPending ? 'Conectando ao rádio...' : 'Forçar Coleta Agora'}</span>
                  </button>

                  <p className="text-xs opacity-50 mt-4 text-center max-w-sm">
                    Certifique-se de que o script de segurança já foi executado neste equipamento ou o acesso SSH pode falhar.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-right">
              <button 
                onClick={() => setSelectedAp(null)}
                className="px-10 py-4 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-xl"
              >
                Voltar ao Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, description, onClick }: any) {
  const colorMap: any = {
    blue: 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700',
    green: 'from-green-500 to-green-600 dark:from-green-600 dark:to-green-700',
    emerald: 'from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700',
    orange: 'from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700',
    red: 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700',
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-5 transition-all hover:shadow-xl hover:-translate-y-1 group ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
    >
      <div className={`p-4 rounded-2xl bg-gradient-to-br ${colorMap[color]} text-white shadow-lg`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</p>
        <h4 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{value}</h4>
        <p className="text-[10px] font-medium text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function StatRow({ label, value, icon, color = 'text-gray-900 dark:text-white', highlight = false }: any) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center text-gray-500 text-sm font-medium">
        <span className="p-1.5 bg-white dark:bg-gray-800 rounded-lg mr-2 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center">
          {icon}
        </span>
        {label}
      </div>
      <span className={`text-sm font-black ${highlight ? 'text-red-600 animate-pulse' : color}`}>
        {value}
      </span>
    </div>
  );
}
