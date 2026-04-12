import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useParams } from 'react-router-dom';
import { Plus, Trash2, Map as MapIcon, Radio, Link as LinkIcon, X, Edit2, Check, Wifi, WifiOff, Cable, Zap, Activity, Terminal as TerminalIcon, Maximize2, Cpu, Thermometer, Clock, Users, BarChart2, Search, TrendingUp, History, Loader2, Shield, Tag, Bell, BellOff, Smartphone, Settings, Copy, Save } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { networkApi, apiFetch, API_BASE } from '../services/api';

const API = '/api';
const apiFetchJSON = (path: string, options?: RequestInit) => apiFetch(path, options).then(r => r.json());

// ─── Types ─────────────────────────────────────────────────────────────────
interface NetworkMap { id: string; name: string; alertsEnabled?: boolean; createdAt: string; offlineCount?: number; }
interface MapNode {
  id: string; mapId: string; apIp: string | null; label: string | null;
  x: number; y: number; apStatus: string; apDescription: string;
  pingTime?: string;
  notes?: string | null;
  nickname?: string | null;
  alertsEnabled?: boolean;
  pingEnabled?: boolean;
}
interface MapLink {
  id: string; mapId: string; sourceNodeId: string; targetNodeId: string;
  linkType: string; label: string | null;
}
interface FullMap extends NetworkMap { nodes: MapNode[]; links: MapLink[]; }
interface AP { id: string; ip: string; descricao: string; status: string; }
interface OutageHistory {
  id: string;
  nodeId: string;
  apIp: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────
const NODE_W = 160, NODE_H = 52;
const LINK_TYPES = [
  { key: 'wireless', label: 'Wireless', icon: Wifi },
  { key: 'ethernet', label: 'Ethernet', icon: Cable },
  { key: 'fiber', label: 'Fibra/Gigabit', icon: Zap },
];

// ─── Diagnostic Component ──────────────────────────────────────────────────
function DiagnosticContent({ ip }: { ip: string }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['telemetry-history', ip],
    queryFn: () => networkApi.getTelemetryHistory(ip),
    refetchInterval: 300000 // 5 mins
  });

  if (isLoading) return <div className="h-64 flex items-center justify-center text-slate-500">Carregando histórico...</div>;
  if (history.length === 0) return (
    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/20">
      <History className="w-12 h-12 text-slate-700 mb-4" />
      <p className="text-slate-400 font-medium">Sem histórico disponível para este dispositivo.</p>
      <p className="text-slate-600 text-xs mt-1">Os dados começarão a aparecer após os próximos ciclos de coleta.</p>
    </div>
  );

  // Formatar dados para o gráfico
  const chartData = history.map((h: any) => ({
    time: new Date(h.collectedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    latency: h.latency || 0,
    signal: h.signal ? parseInt(h.signal.replace(/[^0-9-]/g, '')) : null,
    ccq: h.ccq ? parseInt(h.ccq.replace(/[^0-9]/g, '')) : null,
    rawSignal: h.signal,
    rawDate: h.collectedAt
  }));

  return (
    <div className="space-y-12">
      {/* Latency Chart */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
            <h4 className="text-lg font-bold text-white">Latência (Ping)</h4>
          </div>
          <div className="text-xs font-mono text-slate-500">Média: {Math.round(chartData.reduce((acc: number, curr: any) => acc + curr.latency, 0) / chartData.length)}ms</div>
        </div>
        <div className="h-72 w-full bg-slate-950/40 rounded-3xl border border-slate-800 p-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} unit="ms" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                itemStyle={{ color: '#10b981' }}
              />
              <Area type="monotone" dataKey="latency" name="Latência" stroke="#10b981" fillOpacity={1} fill="url(#colorLatency)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Signal / CCQ Chart */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Wifi className="w-5 h-5 text-blue-500" />
            </div>
            <h4 className="text-lg font-bold text-white">Nível de Sinal e CCQ</h4>
          </div>
        </div>
        <div className="h-72 w-full bg-slate-950/40 rounded-3xl border border-slate-800 p-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} unit="dB" domain={['auto', 'auto']} reversed />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
              />
              <Line type="monotone" dataKey="signal" name="Sinal (dBm)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="ccq" name="CCQ (%)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function NetworkMapPage() {
  const qc = useQueryClient();
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const exportMode = searchParams.get('export') === 'true';
  const highlightIp = searchParams.get('highlight');
  const offlineIps = searchParams.get('offline')?.split(',') || [];

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State: which map is selected
  const [selectedMapId, setSelectedMapId] = useState<string | null>(routeId || null);
  const [newMapName, setNewMapName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [showWinboxSetup, setShowWinboxSetup] = useState<{ ip: string } | null>(null);
  const [winboxSetupDone, setWinboxSetupDone] = useState(() => localStorage.getItem('winbox_setup_done') === 'true');
  const [renameVal, setRenameVal] = useState('');

  // If routeId changes, update selectedMapId
  useEffect(() => {
    if (routeId && routeId !== selectedMapId) {
      setSelectedMapId(routeId);
    }
  }, [routeId, selectedMapId]);

  // Canvas state
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<MapLink[]>([]);
  const [dragging, setDragging] = useState<{ nodes: { id: string; startX: number; startY: number }[] } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; origOX: number; origOY: number } | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [selectedLinkType, setSelectedLinkType] = useState<string>('wireless');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [linkContextMenu, setLinkContextMenu] = useState<{ x: number; y: number; linkId: string } | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [addFilter, setAddFilter] = useState('');
  const [customDeviceName, setCustomDeviceName] = useState('');
  const [customDeviceIp, setCustomDeviceIp] = useState('');
  const [showEditDevice, setShowEditDevice] = useState<{ nodeId: string; apIp: string; label: string } | null>(null);
  const [showNicknameEdit, setShowNicknameEdit] = useState<{ nodeIds: string[]; nickname: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  
  // Terminal state
  const [terminalConfig, setTerminalConfig] = useState<{ title: string; ip: string; type: 'ping' | 'traceroute' } | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [telemetryCard, setTelemetryCard] = useState<{ ip: string; label: string; data: any } | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<{ nodeId: string; label: string } | null>(null);

  const triggerAiAnalysis = useMutation({
    mutationFn: async (ip: string) => {
      return networkApi.analyzeTelemetry(ip);
    },
    onSuccess: (data) => {
      setAiAnalysis(data.analysis);
    }
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ nodeId, notes }: { nodeId: string; notes: string }) => {
      await apiFetchJSON(`${API}/maps/${selectedMapId}/nodes/${nodeId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['map', selectedMapId] });
      refetchMap();
    }
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);
  const [pendingNavNode, setPendingNavNode] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ─── Search: debounce fetch across all maps ──────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetchJSON(`${API}/maps/search?q=${encodeURIComponent(q)}`);
        setSearchResults(data);
        setSearchOpen(data.length > 0);
      } catch { setSearchResults([]); }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  function navigateToNode(result: any) {
    setSearchQuery('');
    setSearchOpen(false);
    setSearchResults([]);
    if (result.mapId !== selectedMapId) {
      setSelectedMapId(result.mapId);
      setPendingNavNode({ nodeId: result.nodeId, x: result.x, y: result.y });
    } else {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const targetScale = 1.4;
      setScale(targetScale);
      setOffset({ x: cx - result.x * targetScale - (NODE_W * targetScale) / 2, y: cy - result.y * targetScale - (NODE_H * targetScale) / 2 });
      setSelectedNodeIds([result.nodeId]);
      setHighlightNodeId(result.nodeId);
      setTimeout(() => setHighlightNodeId(null), 2500);
    }
  }

  // ─── Terminal SSE (Ping Contínuo / Traceroute) ────────────────────────────
  useEffect(() => {
    if (!terminalConfig) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }
    setTerminalLines([]);
    const apiType = terminalConfig.type === 'traceroute' ? 'traceroute' : 'ping';
    const token = localStorage.getItem('token');
    const sseUrl = `${API_BASE}/api/tools/${apiType}/${terminalConfig.ip}?token=${token}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        setTerminalLines(prev => [...prev.slice(-200), parsed.line || ev.data]);
      } catch {
        setTerminalLines(prev => [...prev.slice(-200), ev.data]);
      }
    };
    es.onerror = () => {
      setTerminalLines(prev => [...prev, '--- Conexão encerrada ---']);
      es.close();
    };
    return () => { es.close(); };
  }, [terminalConfig]);

  // ─── API Queries ─────────────────────────────────────────────────────────
  const { data: maps = [] } = useQuery<NetworkMap[]>({
    queryKey: ['maps'],
    queryFn: () => networkApi.getMaps()
  });

  const { data: mapData, refetch: refetchMap } = useQuery<FullMap>({
    queryKey: ['map', selectedMapId],
    queryFn: () => apiFetch(`${API}/maps/${selectedMapId}`).then(r => r.json()),
    enabled: !!selectedMapId,
    refetchInterval: 10000
  });

  // Handle Export Mode Auto-Focus (Fit View and Highlight)
  useEffect(() => {
    if (exportMode && mapData && canvasRef.current) {
      const canvas = canvasRef.current;
      const nodes = mapData.nodes;
      
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.width / dpr;
      const cssHeight = canvas.height / dpr;
      
      if (nodes.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodes.forEach(n => {
          if (n.x < minX) minX = n.x;
          if (n.x > maxX) maxX = n.x;
          if (n.y < minY) minY = n.y;
          if (n.y > maxY) maxY = n.y;
        });

        const NODE_W = 60, NODE_H = 40;
        const w = (maxX - minX) + NODE_W;
        const h = (maxY - minY) + NODE_H;
        
        // PADDING DE 100px pra cada lado
        const scaleX = (cssWidth - 200) / (w || 1);
        const scaleY = (cssHeight - 200) / (h || 1);
        
        // Limitar zoom entre 0.3x e 1.2x para exportação
        let fitScale = Math.min(scaleX, scaleY, 1.2);
        if (fitScale < 0.3) fitScale = 0.3;

        const cx = minX + (maxX - minX) / 2 + NODE_W / 2;
        const cy = minY + (maxY - minY) / 2 + NODE_H / 2;
        
        setScale(fitScale);
        setOffset({ 
          x: cssWidth / 2 - cx * fitScale, 
          y: cssHeight / 2 - cy * fitScale 
        });
      }

      if (highlightIp) {
        const targetNode = nodes.find(n => n.apIp === highlightIp);
        if (targetNode) {
          setSelectedNodeIds([targetNode.id]);
          setHighlightNodeId(targetNode.id);
          // Em modo exportação, manter o highlight estático (não dar timeout)
        }
      }
    }
  }, [exportMode, highlightIp, mapData]);

  // When map loads (or changes) and we have a pending navigation node, pan to it
  useEffect(() => {
    if (!pendingNavNode || !mapData) return;
    const { nodeId, x, y } = pendingNavNode;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const targetScale = 1.4;
    setScale(targetScale);
    setOffset({ x: cx - x * targetScale - (NODE_W * targetScale) / 2, y: cy - y * targetScale - (NODE_H * targetScale) / 2 });
    setSelectedNodeIds([nodeId]);
    setHighlightNodeId(nodeId);
    setPendingNavNode(null);
    setTimeout(() => setHighlightNodeId(null), 2500);
  }, [pendingNavNode, mapData]);

  // Real-time ping status — polls every 3 seconds for near real-time latency
  const { data: pingStatus = {} } = useQuery<Record<string, { status: 'ONLINE' | 'OFFLINE', latency?: string }>>({
    queryKey: ['map-ping', selectedMapId],
    queryFn: () => apiFetch(`${API}/maps/${selectedMapId}/ping`).then(r => r.json()),
    enabled: !!selectedMapId,
    refetchInterval: 15000,
    staleTime: 0,
  });

  const { data: allAPs = [] } = useQuery<AP[]>({
    queryKey: ['transmitters'], queryFn: () => apiFetch(`${API}/transmitters`).then(r => r.json()),
    refetchInterval: 30000
  });

  const { data: outageHistory = [], isLoading: loadingHistory } = useQuery<OutageHistory[]>({
    queryKey: ['node-history', showHistory?.nodeId],
    queryFn: async () => {
      const resp = await apiFetch(`${API}/nodes/${showHistory?.nodeId}/history`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!showHistory?.nodeId
  });

  // Sync map data into local canvas state — only when map changes or structure changes
  // Sync map data into local canvas state
  useEffect(() => {
    if (mapData && !dragging) {
      const forcedOfflineIps = new Set(offlineIps);
      setNodes(prevNodes => mapData.nodes.map(mn => {
        const existing = prevNodes.find(n => n.id === mn.id);
        const forcedOffline = forcedOfflineIps.has(mn.apIp!);
        
        const ps = mn.apIp ? pingStatus[mn.apIp] : null;

        return {
          ...mn,
          apStatus: forcedOffline ? 'OFFLINE' : (ps?.status || mn.apStatus || 'UNKNOWN'),
          latency: ps?.latency || mn.pingTime
        };
      }));
      setLinks(mapData.links || []);
    }
  }, [mapData, selectedMapId, pingStatus]); // Included pingStatus for reactive updates

  // Apply live ping status on top of CURRENT local nodes (preserves drag positions)
  useEffect(() => {
    if (Object.keys(pingStatus).length === 0 || dragging) return;
    setNodes(prev => prev.map(n => {
      const ps = n.apIp ? pingStatus[n.apIp] : null;
      const forcedOffline = offlineIps.includes(n.apIp!);
      return {
        ...n,
        apStatus: forcedOffline ? 'OFFLINE' : (ps ? ps.status : n.apStatus),
        pingTime: ps ? ps.latency : n.pingTime
      };
    }));
  }, [pingStatus, dragging]);

  // ─── Mutations ─────────────────────────────────────────────────────────
  const createMap = useMutation({
    mutationFn: async (name: string) => {
      const r = await apiFetch(`${API}/maps`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => { 
      qc.invalidateQueries({ queryKey: ['maps'] }); 
      setNewMapName(''); 
      setSelectedMapId(data.id);
    },
    onError: (e) => alert('Erro ao criar mapa: ' + e.message)
  });

  const deleteMap = useMutation({
    mutationFn: (id: string) => apiFetch(`${API}/maps/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: ['maps'] }); if (selectedMapId === id) setSelectedMapId(null); }
  });

  const renameMap = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiFetch(`${API}/maps/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maps'] }); setRenamingId(null); }
  });

  const addNode = useMutation({
    mutationFn: ({ mapId, apIp, label, x, y }: { mapId: string; apIp?: string; label?: string; x: number; y: number }) =>
      apiFetch(`${API}/maps/${mapId}/nodes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apIp, label, x, y }) }).then(r => {
        if (!r.ok) return r.text().then(t => { throw new Error(t) });
        return r.json();
      }),
    onSuccess: () => { 
      refetchMap(); 
      setShowAddDevice(false); 
      setCustomDeviceName('');
      setCustomDeviceIp('');
    },
    onError: (err: any) => alert('Erro ao adicionar dispositivo: ' + err.message)
  });

  const moveNode = useMutation({
    mutationFn: ({ nodeId, x, y }: { nodeId: string; x: number; y: number }) =>
      apiFetch(`${API}/maps/${selectedMapId}/nodes/${nodeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y }) }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['map', selectedMapId] });
      refetchMap();
    }
  });

  const bulkUpdateNodes = useMutation({
    mutationFn: (updates: { id: string, x: number, y: number }[]) =>
      apiFetch(`${API}/maps/${selectedMapId}/nodes/bulk`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ updates }) 
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['map', selectedMapId] });
      refetchMap();
    }
  });

  const bulkDeleteNodes = useMutation({
    mutationFn: async (ids: string[]) => {
      setNodes(prev => prev.filter(n => !ids.includes(n.id)));
      const r = await apiFetch(`${API}/maps/${selectedMapId}/nodes/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['map', selectedMapId] });
      refetchMap();
    },
    onError: (e) => alert('Erro ao excluir dispositivos em massa: ' + e.message)
  });

  const updateNodeInfo = useMutation({
    mutationFn: async ({ nodeId, apIp, label }: { nodeId: string; apIp: string; label: string }) => {
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, apIp, label } : n));
      const r = await apiFetch(`${API}/maps/${selectedMapId}/nodes/${nodeId}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apIp, label })
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['map', selectedMapId] });
      refetchMap();
    },
    onError: (e) => alert('Erro ao atualizar dispositivo: ' + e.message)
  });

  const removeNode = useMutation({
    mutationFn: async (nodeId: string) => {
      setNodes(prev => prev.filter(n => n.id !== nodeId));
      const r = await apiFetch(`${API}/maps/${selectedMapId}/nodes/${nodeId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['map', selectedMapId] });
      refetchMap();
    },
    onError: (e) => alert('Erro ao excluir dispositivo: ' + e.message)
  });

  const updateNodeNickname = useMutation({
    mutationFn: async ({ nodeId, nickname }: { nodeId: string; nickname: string }) => {
      const r = await apiFetch(`${API}/maps/${selectedMapId}/nodes/${nodeId}/nickname`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname })
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { refetchMap(); }
  });

  const bulkUpdateNodeNickname = useMutation({
    mutationFn: async ({ nodeIds, nickname }: { nodeIds: string[]; nickname: string }) => {
      const r = await apiFetch(`${API}/maps/${selectedMapId}/nodes/bulk/nickname`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds, nickname })
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { refetchMap(); }
  });

  const toggleNodePing = useMutation({
    mutationFn: async ({ nodeId, enabled }: { nodeId: string; enabled: boolean }) => {
      const r = await apiFetch(`${API}/maps/${selectedMapId}/nodes/${nodeId}/ping-toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['map', selectedMapId] });
      refetchMap();
    },
    onError: (e) => alert('Erro ao alternar ping: ' + e.message)
  });

  const toggleNodeAlerts = useMutation({
    mutationFn: async ({ nodeId, enabled }: { nodeId: string; enabled: boolean }) => {
      const r = await apiFetch(`${API}/maps/${selectedMapId}/nodes/${nodeId}/alerts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { refetchMap(); }
  });



  const updateConfig = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const r = await apiFetch(`${API}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config'] }); }
  });

  const { data: globalConfig = {} } = useQuery<Record<string, string>>({
    queryKey: ['config'],
    queryFn: () => apiFetch(`${API}/config`).then(r => r.json())
  });

  const addLink = useMutation({
    mutationFn: ({ sourceNodeId, targetNodeId }: { sourceNodeId: string; targetNodeId: string }) =>
      apiFetch(`${API}/maps/${selectedMapId}/links`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceNodeId, targetNodeId, linkType: selectedLinkType }) }).then(r => r.json()),
    onSuccess: () => { refetchMap(); setLinkingFrom(null); }
  });

  const removeLink = useMutation({
    mutationFn: async (linkId: string) => {
      // Optimistic cache removal
      setLinks(prev => prev.filter(l => l.id !== linkId));
      
      const r = await apiFetch(`${API}/maps/${selectedMapId}/links/${linkId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['map', selectedMapId] });
      refetchMap();
    },
    onError: (e) => alert('Erro ao excluir link do Banco de Dados: ' + e.message)
  });

  const runWinbox = useMutation({
    mutationFn: (ip: string) => apiFetch(`${API}/tools/winbox/${ip}`, { method: 'POST' }).then(r => r.json()),
    onError: () => alert('Erro ao abrir Winbox (verifique se C:\\Tools\\winbox.exe existe)')
  });

  // ─── Canvas Drawing ───────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background dots grid
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    const gridSize = 40;
    const startX = Math.floor(-offset.x / scale / gridSize) * gridSize - gridSize;
    const startY = Math.floor(-offset.y / scale / gridSize) * gridSize - gridSize;
    const endX = startX + width / scale + gridSize * 2;
    const endY = startY + height / scale + gridSize * 2;
    ctx.fillStyle = '#e2e8f0';
    for (let gx = startX; gx < endX; gx += gridSize) {
      for (let gy = startY; gy < endY; gy += gridSize) {
        ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill();
      }
    }

    const apMapLookup = new Map(allAPs.map(ap => [ap.ip, ap]));
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Draw links
    links.forEach(link => {
      const src = nodeMap.get(link.sourceNodeId);
      const tgt = nodeMap.get(link.targetNodeId);
      if (!src || !tgt) return;
      const sx = src.x + NODE_W / 2, sy = src.y + NODE_H / 2;
      const tx = tgt.x + NODE_W / 2, ty = tgt.y + NODE_H / 2;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      
      // Link Colors & Styles
      if (link.linkType === 'fiber') {
        ctx.strokeStyle = '#3b82f6'; // Bright Blue
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = '#ffffff'; // Pure White
        if (link.linkType === 'wireless') {
          ctx.setLineDash([6, 5]);
          ctx.lineWidth = 1.5;
        } else { // ethernet
          ctx.setLineDash([]);
          ctx.lineWidth = 2;
        }
      }
      
      // Shadow for better contrast on any background
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      
      ctx.stroke();
      
      ctx.setLineDash([]);
      ctx.shadowBlur = 0; // Reset shadow for next drawings

      // Link label
      if (link.label) {
        const mx = (sx + tx) / 2, my = (sy + ty) / 2;
        ctx.fillStyle = '#475569';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(link.label, mx, my - 6);
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const online = node.apStatus === 'ONLINE';
      const apInfo = apMapLookup.get(node.apIp || '');
      const hasTelemetry = apInfo ? (apInfo as any).hasTelemetry : false;
      const isSelected = selectedNodeIds.includes(node.id);
      const isLinkSource = node.id === linkingFrom;

      // Shadow
      ctx.shadowBlur = isSelected ? 12 : 4;
      ctx.shadowColor = isSelected ? '#3b82f6' : 'rgba(0,0,0,0.15)';

      // Node body
      const r = 8;
      const x = node.x, y = node.y, w = NODE_W, h = NODE_H;
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();

      // Color scheme by status
      const isUnknown = node.apStatus === 'UNKNOWN';
      const hasNotes = !!node.notes;
      const isPingDisabled = node.pingEnabled === false;
      
      if (isPingDisabled) {
        // Roxinha para desativados
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, '#9333ea');
        grad.addColorStop(1, '#581c87');
        ctx.fillStyle = grad;
      } else if (online) {
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, isLinkSource ? '#22c55e' : '#16a34a');
        grad.addColorStop(1, isLinkSource ? '#15803d' : '#14532d');
        ctx.fillStyle = grad;
      } else if (isUnknown) {
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, '#475569');
        grad.addColorStop(1, '#1e293b');
        ctx.fillStyle = grad;
      } else if (hasNotes) {
        // Laranja para falhas reconhecidas
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, '#f97316');
        grad.addColorStop(1, '#9a3412');
        ctx.fillStyle = grad;
      } else {
        // Vermelho para falhas NÃO reconhecidas
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, '#dc2626');
        grad.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = grad;
      }
      ctx.fill();

        // Border — highlight ring animates via a bright cyan outer glow
        const isHighlighted = node.id === highlightNodeId;
        ctx.strokeStyle = isHighlighted ? '#38bdf8' : isSelected ? '#60a5fa' : isLinkSource ? '#fbbf24' : online ? '#4ade80' : isUnknown ? '#64748b' : '#fca5a5';
        ctx.lineWidth = isHighlighted ? 3 : isSelected || isLinkSource ? 2.5 : 1;
        if (isHighlighted) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#38bdf8';
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

      // ── Live ping status dot (top-left corner) ──────────────────────────
      const dotR = 4;
      ctx.beginPath();
      ctx.arc(x + 10, y + h / 2, dotR, 0, Math.PI * 2);
      ctx.fillStyle = isPingDisabled ? '#c084fc' : online ? '#86efac' : isUnknown ? '#94a3b8' : '#fca5a5';
      ctx.fill();

      // ── Label (device name) ────────────────────────────────────────────
      const name = node.apDescription || node.label || node.apIp || 'Dispositivo';
      
      ctx.fillStyle = online ? '#f1f5f9' : (isUnknown ? '#f1f5f9' : (hasNotes ? '#fdba74' : '#fca5a5'));
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let displayName = name;
      const maxNameW = NODE_W - 28;
      if (ctx.measureText(displayName).width > maxNameW) {
        while (ctx.measureText(displayName + '…').width > maxNameW && displayName.length > 1) displayName = displayName.slice(0, -1);
        displayName += '…';
      }

      if (node.apIp) {
        // Name on top
        ctx.fillText(displayName, x + NODE_W / 2 + 5, y + h * 0.25);

        // ── Nickname in the MIDDLE ───────────────────────────────────────
        if (node.nickname) {
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(x, y + h * 0.40, NODE_W, h * 0.20);
          
          ctx.fillStyle = '#fde047'; // Yellowish for highlight
          ctx.font = 'bold 9px Inter, sans-serif';
          let nick = `[ ${node.nickname} ]`;
          if (ctx.measureText(nick).width > maxNameW) {
             nick = node.nickname.slice(0, 15) + '...';
          }
          ctx.fillText(nick, x + NODE_W / 2 + 5, y + h * 0.50);
          ctx.restore();
        }

        // ── Telemetry Indicator (Top Right)
        if (hasTelemetry) {
          ctx.fillStyle = '#0284c7'; // dark blue badge
          ctx.beginPath();
          ctx.arc(x + w - 14, y + 14, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('T', x + w - 14, y + 14.5);
        }

        // IP address — slightly transparent band
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y + h * 0.65, NODE_W, h * 0.35);

        ctx.fillStyle = online ? '#bbf7d0' : isUnknown ? '#cbd5e1' : '#fecaca';
        ctx.font = '9px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(node.apIp, x + 16, y + h * 0.82);
        
        // ── Latency (Ping Time) bottom right ──────────────────────────────
        if (node.pingTime) {
          const lat = parseInt(node.pingTime);
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = lat > 150 ? '#fde047' : lat > 500 ? '#fca5a5' : '#ffffff';
          ctx.textAlign = 'right';
          ctx.font = 'bold 10px Inter, sans-serif';
          ctx.fillText(node.pingTime, x + w - 6, y + h * 0.78);
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        // ── Acknowledgment Note (Floating Label) ──────────────────────────
        if (node.notes) {
          ctx.save();
          ctx.font = 'italic 10px Inter, sans-serif';
          const nw = ctx.measureText(node.notes).width + 12;
          ctx.fillStyle = 'rgba(15,23,42,0.95)';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1;

          const bx = x + (NODE_W - nw) / 2;
          const by = y - 18;
          ctx.fillRect(bx, by, nw, 16);
          ctx.strokeRect(bx, by, nw, 16);

          ctx.fillStyle = '#f59e0b';
          ctx.textAlign = 'center';
          ctx.fillText(node.notes, x + NODE_W / 2, y - 10);
          ctx.restore();
        }
      } else {
        // No IP: center the name vertically
        ctx.fillText(name, x + NODE_W / 2 + 5, y + h / 2);
      }
    });

    ctx.restore();

    // ─── Minimap ───────────────────────────────────────────────────────────
    if (nodes.length > 0) {
      const mmW = 160, mmH = 100, mmPad = 5;
      const mmX = width - mmW - 12, mmY = height - mmH - 12;

      ctx.fillStyle = 'rgba(15,23,42,0.85)';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(mmX, mmY, mmW, mmH, 6);
      ctx.fill(); ctx.stroke();

      const allX = nodes.map(n => n.x);
      const allY = nodes.map(n => n.y);
      const minX = Math.min(...allX) - 20, maxX = Math.max(...allX) + NODE_W + 20;
      const minY = Math.min(...allY) - 20, maxY = Math.max(...allY) + NODE_H + 20;
      const contentW = maxX - minX || 1, contentH = maxY - minY || 1;
      const scaleX = (mmW - mmPad * 2) / contentW;
      const scaleY = (mmH - mmPad * 2) / contentH;
      const mmScale = Math.min(scaleX, scaleY);

      const toMM = (nx: number, ny: number) => ({
        x: mmX + mmPad + (nx - minX) * mmScale,
        y: mmY + mmPad + (ny - minY) * mmScale
      });

      // Draw links in minimap
      links.forEach(link => {
        const src = nodes.find(n => n.id === link.sourceNodeId);
        const tgt = nodes.find(n => n.id === link.targetNodeId);
        if (!src || !tgt) return;
        const s = toMM(src.x, src.y), t = toMM(tgt.x, tgt.y);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = link.linkType === 'wireless' ? '#64748b' : '#1e40af';
        if (link.linkType === 'wireless') ctx.setLineDash([2, 2]); else ctx.setLineDash([]);
        ctx.lineWidth = 0.8; ctx.stroke(); ctx.setLineDash([]);
      });

      // Draw nodes in minimap
      nodes.forEach(node => {
        const p = toMM(node.x, node.y);
        const nw = NODE_W * mmScale, nh = NODE_H * mmScale;
        ctx.fillStyle = node.apStatus === 'ONLINE' ? '#4ade80' : '#f87171';
        ctx.fillRect(p.x, p.y, Math.max(nw, 4), Math.max(nh, 3));
      });

      // Viewport rect in minimap
      const vpX = -offset.x / scale, vpY = -offset.y / scale;
      const vpW = width / scale, vpH = height / scale;
      const vp = toMM(vpX, vpY);
      ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.strokeRect(vp.x, vp.y, vpW * mmScale, vpH * mmScale);
    }
  }, [nodes, links, offset, scale, selectedNodeIds, linkingFrom, allAPs, highlightNodeId]);

  useEffect(() => { draw(); }, [draw]);

  // Resize canvas to fill parent
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      const cssWidth = parent?.clientWidth ?? 800;
      const cssHeight = parent?.clientHeight ?? 600;
      const dpr = window.devicePixelRatio || 1;
      
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  // ─── Hit testing ─────────────────────────────────────────────────────────
  const getNodeAt = (cx: number, cy: number): MapNode | null => {
    const wx = (cx - offset.x) / scale, wy = (cy - offset.y) / scale;
    return [...nodes].reverse().find(n => wx >= n.x && wx <= n.x + NODE_W && wy >= n.y && wy <= n.y + NODE_H) ?? null;
  };

  const getLinkAt = (cx: number, cy: number): MapLink | null => {
    const wx = (cx - offset.x) / scale, wy = (cy - offset.y) / scale;
    // Math logic for point to line segment distance
    const dist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
      const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
      const dot = A * C + B * D, lenSq = C * C + D * D;
      let param = -1;
      if (lenSq !== 0) param = dot / lenSq;
      let xx, yy;
      if (param < 0) { xx = x1; yy = y1; }
      else if (param > 1) { xx = x2; yy = y2; }
      else { xx = x1 + param * C; yy = y1 + param * D; }
      const dx = px - xx, dy = py - yy;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const link of links) {
      const src = nodeMap.get(link.sourceNodeId);
      const tgt = nodeMap.get(link.targetNodeId);
      if (!src || !tgt) continue;
      const d = dist(wx, wy, src.x + NODE_W / 2, src.y + NODE_H / 2, tgt.x + NODE_W / 2, tgt.y + NODE_H / 2);
      if (d < 12 / scale) return link; // 12px hit radius
    }
    return null;
  };

  // ─── Canvas events ────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setContextMenu(null);
    setLinkContextMenu(null);
    const node = getNodeAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (e.button === 2) {
      if (node) {
        setContextMenu({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, nodeId: node.id });
      } else {
        const link = getLinkAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        if (link) setLinkContextMenu({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, linkId: link.id });
      }
      return;
    }
    if (node) {
      if (linkingFrom) {
        if (linkingFrom !== node.id) addLink.mutate({ sourceNodeId: linkingFrom, targetNodeId: node.id });
        setLinkingFrom(null);
        return;
      }

      // Handle selection
      const isCtrl = e.ctrlKey || e.metaKey;
      let newSelection = [...selectedNodeIds];

      if (isCtrl) {
        if (newSelection.includes(node.id)) {
          newSelection = newSelection.filter(id => id !== node.id);
        } else {
          newSelection.push(node.id);
        }
      } else {
        if (!newSelection.includes(node.id)) {
          newSelection = [node.id];
        }
      }
      setSelectedNodeIds(newSelection);

      // Prepare dragging for the whole selection
      const draggingNodes = nodes
        .filter(n => newSelection.includes(n.id))
        .map(n => ({ id: n.id, startX: e.clientX - n.x * scale, startY: e.clientY - n.y * scale }));
      
      setDragging({ nodes: draggingNodes });
    } else {
      setSelectedNodeIds([]);
      if (!linkingFrom) {
        setPanning({ startX: e.clientX, startY: e.clientY, origOX: offset.x, origOY: offset.y });
      }
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) {
      setNodes(prev => prev.map(n => {
        const dragInfo = dragging.nodes.find(dn => dn.id === n.id);
        if (dragInfo) {
          return {
            ...n,
            x: (e.clientX - dragInfo.startX) / scale,
            y: (e.clientY - dragInfo.startY) / scale
          };
        }
        return n;
      }));
    } else if (panning) {
      setOffset({ x: panning.origOX + e.clientX - panning.startX, y: panning.origOY + e.clientY - panning.startY });
    }
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) {
      const movedNodes = nodes.filter(n => dragging.nodes.some(dn => dn.id === n.id));
      if (movedNodes.length === 1) {
        moveNode.mutate({ nodeId: movedNodes[0].id, x: movedNodes[0].x, y: movedNodes[0].y });
      } else if (movedNodes.length > 1) {
        bulkUpdateNodes.mutate(movedNodes.map(m => ({ id: m.id, x: m.x, y: m.y })));
      }
    }
    setDragging(null);
    setPanning(null);
    e.preventDefault();
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.2, Math.min(3, scale * delta));
    const cx = e.nativeEvent.offsetX, cy = e.nativeEvent.offsetY;
    setOffset(prev => ({
      x: cx - (cx - prev.x) * (newScale / scale),
      y: cy - (cy - prev.y) * (newScale / scale)
    }));
    setScale(newScale);
  };

  // ─── Filter available APs (not already in map) ─────────────────────────
  const existingIPs = new Set(nodes.map(n => n.apIp).filter(Boolean));
  const filteredAPs = allAPs.filter(ap =>
    !existingIPs.has(ap.ip) &&
    (addFilter === '' || ap.descricao.toLowerCase().includes(addFilter.toLowerCase()) || ap.ip.includes(addFilter))
  );

  // ─── Select first map automatically ──────────────────────────────────────
  useEffect(() => {
    if (maps.length > 0 && !selectedMapId) setSelectedMapId(maps[0].id);
  }, [maps, selectedMapId]);

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden select-none font-sans relative">
      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      {!exportMode && (
        <aside className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col shadow-2xl z-30">
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center space-x-3 mb-2">
              <div className="bg-blue-600/20 p-2 rounded-xl">
                <MapIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-white tracking-tight">Mapas de Rede</h3>
                <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Topologia de Ativos</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
            {maps.map(m => (
              <div
                key={m.id}
                className={`group flex items-center px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                  selectedMapId === m.id 
                    ? 'bg-blue-600/10 text-blue-400 border-blue-500/30' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'
                }`}
                onClick={() => setSelectedMapId(m.id)}
              >
                {renamingId === m.id ? (
                  <form 
                    onSubmit={e => { 
                      e.stopPropagation(); 
                      e.preventDefault(); 
                      (renameMap as any).mutate({ id: m.id, name: renameVal }); 
                    }} 
                    className="flex-1 flex gap-2"
                  >
                    <input 
                      autoFocus 
                      value={renameVal} 
                      onChange={e => setRenameVal(e.target.value)} 
                      onClick={e => e.stopPropagation()}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-blue-500" 
                    />
                    <button type="submit" className="text-green-500 hover:text-green-400"><Check className="w-4 h-4" /></button>
                  </form>
                ) : (
                  <>
                    <MapIcon className="w-4 h-4 mr-3 opacity-50" />
                    <span className="flex-1 text-xs font-semibold truncate flex items-center gap-2">
                      {m.name}
                      {m.offlineCount ? (
                        <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none shadow-lg shadow-red-900/40 animate-pulse">
                          {m.offlineCount}
                        </span>
                      ) : null}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button onClick={e => { e.stopPropagation(); setRenamingId(m.id); setRenameVal(m.name); }} className="p-1 hover:bg-slate-700 rounded-md text-slate-500 hover:text-blue-400 transition-colors"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={e => { e.stopPropagation(); if (confirm(`Deletar map "${m.name}"?`)) (deleteMap as any).mutate(m.id); }} className="p-1 hover:bg-slate-700 rounded-md text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </nav>

        {/* Create map */}
        <div className="p-3 border-t border-slate-700">
          <div className="flex flex-col">
            <input
              value={newMapName}
              onChange={e => setNewMapName(e.target.value)}
              placeholder="Nome do mapa…"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-400 mb-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                const name = newMapName.trim();
                if (name) createMap.mutate(name);
              }}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition-all shadow-lg shadow-blue-900/30"
            >
              <Plus className="w-3.5 h-3.5" /> Criar Mapa
            </button>
          </div>
        </div>
        </aside>
      )}

      {/* ── Main Canvas Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* Loader Overlay for Tunnel */}
        {tunnelLoading && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-2xl flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin mb-4" />
              <h3 className="text-white font-bold text-sm tracking-wide">Solicitando Túnel Edge Agent...</h3>
              <p className="text-slate-400 text-xs mt-1">Aguarde, gerando porta TCP segura.</p>
            </div>
          </div>
        )}

        {/* Toolbar */}
        {selectedMapId && !exportMode && (
          <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-3 shrink-0">
            <span className="text-slate-300 text-sm font-semibold">
              {maps.find(m => m.id === selectedMapId)?.name}
            </span>
            <div className="w-px h-4 bg-slate-600" />

            {/* ── GLOBAL SEARCH ─────────────────────────────────────────── */}
            <div className="relative" onBlur={() => setTimeout(() => setSearchOpen(false), 150)}>
              <div className="flex items-center bg-slate-900 border border-slate-600 rounded-lg px-2.5 gap-1.5 focus-within:border-blue-500 transition-colors">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); }}
                  onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                  onKeyDown={e => { if (e.key === 'Escape') { setSearchQuery(''); setSearchOpen(false); } if (e.key === 'Enter' && searchResults.length === 1) navigateToNode(searchResults[0]); }}
                  placeholder="Buscar por IP ou nome…"
                  className="bg-transparent text-xs text-white placeholder-slate-500 py-1.5 outline-none w-48"
                />
                {searchQuery && <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} className="text-slate-500 hover:text-white"><X className="w-3 h-3" /></button>}
              </div>
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-[100] overflow-hidden">
                  <div className="px-3 py-1.5 text-[10px] text-slate-500 border-b border-slate-700 font-semibold uppercase">
                    {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {searchResults.map((r: any) => (
                      <button key={r.nodeId}
                        onMouseDown={() => navigateToNode(r)}
                        className="w-full px-3 py-2.5 text-left hover:bg-slate-700 transition-colors flex items-center gap-2.5 border-b border-slate-700/50 last:border-0">
                        <div className="w-1.5 h-6 rounded-full shrink-0" style={{ background: r.matchedClientMacs ? '#f97316' : r.mapId === selectedMapId ? '#22c55e' : '#3b82f6' }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-100 truncate">{r.description || r.label || r.apIp || 'Dispositivo'}</div>
                          {r.matchedClientMacs ? (
                            <div className="text-[10px] text-orange-400">
                              👤 Cliente: <span className="font-mono">{r.matchedClientMacs[0]}</span>
                              {r.matchedClientMacs.length > 1 && ` +${r.matchedClientMacs.length - 1}`}
                            </div>
                          ) : (
                            <div className="text-[10px] font-mono text-slate-400">{r.apIp}</div>
                          )}
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          r.mapId === selectedMapId ? 'bg-green-900/40 text-green-400' : 'bg-blue-900/40 text-blue-400'
                        }`}>
                          {r.mapId === selectedMapId ? 'Aqui' : r.mapName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-slate-600" />

            {/* Link type selector */}
            <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1">
              {LINK_TYPES.map(lt => {
                const Icon = lt.icon;
                return (
                  <button key={lt.key} onClick={() => setSelectedLinkType(lt.key)}
                    title={lt.label}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${selectedLinkType === lt.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {lt.label}
                  </button>
                );
              })}
            </div>

            <div className="w-px h-4 bg-slate-600" />

            {/* Link mode toggle */}
            <button
              onClick={() => setLinkingFrom(prev => prev ? null : (selectedNodeIds[0] ?? null))}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${linkingFrom ? 'bg-amber-500 text-amber-950 animate-pulse' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              <LinkIcon className="w-3.5 h-3.5" />
              {linkingFrom ? 'Clique no destino…' : 'Criar Link'}
            </button>

            {/* Add device */}
            <button onClick={() => setShowAddDevice(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all">
              <Radio className="w-3.5 h-3.5" /> Adicionar Dispositivo
            </button>

            <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              <span>Zoom: {Math.round(scale * 100)}%</span>
              <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300">Reset</button>
            </div>
          </div>
        )}

        {/* Canvas */}
        {selectedMapId ? (
          <div className="flex-1 relative cursor-crosshair overflow-hidden">
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{ cursor: dragging ? 'grabbing' : panning ? 'grabbing' : linkingFrom ? 'crosshair' : 'default' }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onWheel={onWheel}
              onContextMenu={e => e.preventDefault()}
            />
            {/* Legend */}
            {mapData && (
              <div id="screenshot-ready" className="hidden" data-nodes={mapData.nodes.length} />
            )}
            {!exportMode && (
              <div className="absolute top-3 right-3 bg-slate-900/90 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 space-y-1.5">
              <div className="font-bold text-slate-200 mb-2">Legenda</div>
              <div className="text-slate-500 text-[10px] font-semibold uppercase mb-1">Links</div>
              <div className="flex items-center gap-2"><div className="w-5 h-0" style={{ borderTop: '2px dashed #94a3b8' }} /><span>Wireless</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-0.5 bg-slate-400" /><span>Ethernet</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-1 bg-blue-600 rounded" /><span>Fibra/Gigabit</span></div>
              <div className="border-t border-slate-700 pt-1.5 mt-1">
                <div className="text-slate-500 text-[10px] font-semibold uppercase mb-1">Status (Ping)</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-400" /><span>Online</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span>Offline</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-500" /><span>Sem IP</span></div>
                </div>
              </div>
              <div className="border-t border-slate-700 pt-1.5 text-slate-500 text-[10px]">
                🔄 Ping: <span className="text-blue-400 font-mono">3s</span><br />
                Scroll = Zoom<br />Drag fundo = Mover<br />Drag nó = Posicionar<br />Btn Dir. = Opções
              </div>
            </div>
          )}
            {/* Context menu for Node */}
            {contextMenu && (
              <div className="absolute z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-xl py-1 min-w-44"
                style={{ left: contextMenu.x + 4, top: contextMenu.y + 4 }}>
                <button className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => { setLinkingFrom(contextMenu.nodeId); setContextMenu(null); }}>
                  <LinkIcon className="w-4 h-4 text-blue-400" /> Iniciar Link
                </button>
                <div className="border-t border-slate-700 my-1" />
                
                {(() => {
                  const node = nodes.find(n => n.id === contextMenu.nodeId);
                  if (node && node.apIp) {
                    return (
                      <>
                        <button className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                          onClick={() => {
                            navigator.clipboard.writeText(node.apIp!).then(() => {
                              const btn = document.activeElement as HTMLButtonElement;
                              if (btn) { btn.textContent = '✅ Copiado!'; setTimeout(() => setContextMenu(null), 600); }
                            });
                          }}>
                          <Copy className="w-4 h-4 text-emerald-400" /> Copiar IP ({node.apIp})
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                          onClick={async () => {
                            const node = nodes.find(n => n.id === contextMenu.nodeId);
                            if (!node?.apIp) return;
                            setContextMenu(null);
                            setTelemetryLoading(true);
                            setTelemetryCard({ ip: node.apIp, label: node.label || node.apDescription || node.apIp, data: null });
                            try {
                              const resp = await apiFetch(`${API}/transmitters/${node.apIp}/telemetry-cached`);
                              if (!resp.ok) throw new Error('Sem dados de telemetria');
                              const data = await resp.json();
                              setTelemetryCard({ ip: node.apIp, label: node.label || node.apDescription || node.apIp, data });
                            } catch {
                              setTelemetryCard(prev => prev ? { ...prev, data: { _error: true } } : null);
                            } finally {
                              setTelemetryLoading(false);
                            }
                          }}>
                          <BarChart2 className="w-4 h-4 text-violet-400" /> Ver Telemetria
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                          onClick={async () => {
                            const node = nodes.find(n => n.id === contextMenu.nodeId);
                            if (!node?.apIp) return;
                            setContextMenu(null);
                            if (confirm(`Forçar leitura de telemetria para ${node.apIp}? Isso pode demorar alguns segundos e registrará o AP caso seja novo.`)) {
                              try {
                                const resp = await apiFetch(`${API}/telemetry/${node.apIp}/collect`, { method: 'POST' });
                                if (!resp.ok) throw new Error(await resp.text());
                                alert('Telemetria atualizada e dispositivo registrado com sucesso no banco de dados!');
                                qc.invalidateQueries({ queryKey: ['transmitters'] });
                              } catch (e: any) {
                                alert('Erro ao forçar telemetria: ' + e.message);
                              }
                            }
                          }}>
                          <Zap className="w-4 h-4 text-emerald-400" /> Forçar Leitura (Telemetria)
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                          onClick={() => {
                            setTerminalLines([]); setContextMenu(null);
                            setTerminalConfig({ title: `Ping ${node.apIp} (${node.label || 'Dispositivo'})`, ip: node.apIp!, type: 'ping' });
                          }}>
                          <Activity className="w-4 h-4 text-emerald-400" /> Ping Contínuo
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                          onClick={() => {
                            setTerminalLines([]); setContextMenu(null);
                            setTerminalConfig({ title: `Traceroute ${node.apIp}`, ip: node.apIp!, type: 'traceroute' });
                          }}>
                          <TerminalIcon className="w-4 h-4 text-emerald-400" /> Traceroute
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                          onClick={() => {
                             if (!winboxSetupDone) {
                               setShowWinboxSetup({ ip: node.apIp! });
                             } else {
                               window.location.assign(`winbox://${node.apIp}`);
                             }
                             setContextMenu(null);
                          }}>
                          <Maximize2 className="w-4 h-4 text-cyan-400" /> Winbox (Meu PC)
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                          onClick={() => { runWinbox.mutate(node.apIp!); setContextMenu(null); }}>
                          <Maximize2 className="w-4 h-4 text-slate-500" /> Winbox (Servidor)
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm text-emerald-300 hover:bg-slate-700 flex items-center gap-2"
                          onClick={async () => {
                            setContextMenu(null);
                            if (!winboxSetupDone) {
                               setShowWinboxSetup({ ip: node.apIp! });
                               return;
                            }
                            setTunnelLoading(true);
                            try {
                              const res = await networkApi.requestWinboxTunnel(node.apIp!, 8291);
                              setTunnelLoading(false);
                              const port = (res as any).port;
                              const host = window.location.hostname;
                              setTimeout(() => {
                                window.location.assign(`winbox://${host}:${port}`);
                              }, 500);
                            } catch (err: any) {
                              setTunnelLoading(false);
                              alert('Erro ao solicitar túnel: ' + (err.response?.data?.error || err.message));
                            }
                          }}>
                          <Shield className="w-4 h-4 text-emerald-400" /> Winbox (Túnel Edge)
                        </button>
                        <div className="border-t border-slate-700 my-1" />
                      </>
                    );
                  }
                  return null;
                })()}

                      <button className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                          const node = nodes.find(n => n.id === contextMenu.nodeId);
                          if (node) setShowEditDevice({ nodeId: node.id, apIp: node.apIp || '', label: node.label || '' });
                          setContextMenu(null);
                        }}>
                        <Edit2 className="w-4 h-4" /> Editar Equipamento
                      </button>
                      <button className="w-full px-4 py-2 text-left text-sm text-amber-500 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                          const val = prompt('Descreva o motivo/reconhecimento (ex: Falta de energia):');
                          if (val !== null) {
                            acknowledgeMutation.mutate({ nodeId: contextMenu.nodeId, notes: val });
                          }
                          setContextMenu(null);
                        }}>
                        <Shield className="w-4 h-4 text-orange-400" /> Reconhecer Problema
                      </button>
                      
                      <button className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                          const isBatch = selectedNodeIds.includes(contextMenu.nodeId) && selectedNodeIds.length > 1;
                          const node = nodes.find(n => n.id === contextMenu.nodeId);
                          const initialNick = isBatch ? '' : (node?.nickname || '');
                          
                          setShowNicknameEdit({ 
                            // Convertendo para string explicitamente por segurança antes do estado
                            nodeIds: isBatch ? selectedNodeIds.map(id => String(id)) : [String(contextMenu.nodeId)], 
                            nickname: initialNick 
                          });
                          setContextMenu(null);
                        }}>
                        <Tag className="w-4 h-4 text-violet-400" /> 
                        {selectedNodeIds.includes(contextMenu.nodeId) && selectedNodeIds.length > 1 
                          ? `Definir Apelido (${selectedNodeIds.length})` 
                          : 'Definir Apelido'
                        }
                      </button>

                      <button className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                          const node = nodes.find(n => n.id === contextMenu.nodeId);
                          toggleNodePing.mutate({ nodeId: contextMenu.nodeId, enabled: node?.pingEnabled === false });
                          setContextMenu(null);
                        }}>
                        {nodes.find(n => n.id === contextMenu.nodeId)?.pingEnabled === false 
                          ? <><Activity className="w-4 h-4 text-green-400" /> Ativar Ping</>
                          : <><WifiOff className="w-4 h-4 text-slate-500" /> Desativar Ping</>
                        }
                      </button>

                      <button className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                          const node = nodes.find(n => n.id === contextMenu.nodeId);
                          toggleNodeAlerts.mutate({ nodeId: contextMenu.nodeId, enabled: !node?.alertsEnabled });
                          setContextMenu(null);
                        }}>
                        {nodes.find(n => n.id === contextMenu.nodeId)?.alertsEnabled === false 
                          ? <><Bell className="w-4 h-4 text-green-400" /> Ativar Alertas</>
                          : <><BellOff className="w-4 h-4 text-slate-500" /> Silenciar Alertas</>
                        }
                      </button>
                      <button className="w-full px-4 py-2 text-left text-sm text-blue-400 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => { 
                          const node = nodes.find(n => n.id === contextMenu.nodeId);
                          if (node?.apIp) {
                            setShowDiagnostic(node.apIp); 
                            setAiAnalysis(null);
                          }
                          setContextMenu(null); 
                        }}>
                        <History className="w-4 h-4" /> Diagnóstico Avançado
                      </button>
                      <button className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                          const node = nodes.find(n => n.id === contextMenu.nodeId);
                          if (node) setShowHistory({ nodeId: node.id, label: node.nickname ? `${node.label} (${node.nickname})` : (node.label || 'Sem nome') });
                          setContextMenu(null);
                        }}>
                        <History className="w-4 h-4 text-violet-400" /> Ver Histórico de Quedas
                      </button>
                <button className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                  onClick={(e) => { 
                    e.stopPropagation();
                    const isPartResult = selectedNodeIds.includes(contextMenu.nodeId);
                    if (isPartResult && selectedNodeIds.length > 1) {
                      if (confirm(`Remover os ${selectedNodeIds.length} dispositivos selecionados?`)) {
                        bulkDeleteNodes.mutate(selectedNodeIds);
                      }
                    } else {
                      removeNode.mutate(contextMenu.nodeId);
                    }
                    setContextMenu(null);
                  }}>
                  <Trash2 className="w-4 h-4" /> 
                  {selectedNodeIds.includes(contextMenu.nodeId) && selectedNodeIds.length > 1 
                    ? `Remover Seleção (${selectedNodeIds.length})` 
                    : 'Remover do Mapa'
                  }
                </button>
              </div>
            )}
            
            {/* Telemetry Mini-Card */}
            {telemetryCard && (
              <div className="absolute bottom-4 left-4 w-96 bg-slate-900 border border-violet-500/40 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
                style={{ boxShadow: '0 0 30px rgba(139,92,246,0.15)' }}>
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-900/60 to-slate-800/80 px-4 py-3 flex items-center justify-between border-b border-violet-700/30">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-violet-400" />
                    <div>
                      <div className="text-sm font-bold text-slate-100 truncate max-w-44">{telemetryCard.label}</div>
                      <div className="text-[10px] text-violet-300 font-mono">{telemetryCard.ip}</div>
                    </div>
                  </div>
                  <button onClick={() => setTelemetryCard(null)} className="text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>

                {/* Body */}
                <div className="p-4">
                  {telemetryLoading && (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-400">Buscando telemetria...</span>
                    </div>
                  )}
                  {!telemetryLoading && telemetryCard.data?._error && (
                    <div className="text-center py-6">
                      <BarChart2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm font-medium">Sem dados coletados</p>
                      <p className="text-slate-600 text-xs mt-1">Force uma análise na aba de Gestão de APs</p>
                    </div>
                  )}
                  {!telemetryLoading && telemetryCard.data && !telemetryCard.data._error && (() => {
                    const d = telemetryCard.data;
                    const isSnmp = d.isSnmpOnly;
                    const collectedDate = d.collectedAt ? new Date(d.collectedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
                    const clients = d.clientsJson ? JSON.parse(d.clientsJson) : [];
                    return (
                      <div className="space-y-3">
                        {isSnmp && (
                          <div className="flex items-center gap-1.5 bg-amber-900/30 border border-amber-600/30 rounded-lg px-3 py-1.5">
                            <span className="text-[10px] text-amber-300 font-medium">📡 Dados via SNMP (SSH indisponível)</span>
                          </div>
                        )}

                        <div className="bg-slate-800/60 rounded-xl p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-xs text-slate-400">Identidade</span>
                            <span className="text-xs font-semibold text-slate-100 text-right ml-2 truncate max-w-36">{d.identity || '—'}</span>
                          </div>
                          {d.model && <div className="flex justify-between">
                            <span className="text-xs text-slate-400">Modelo</span>
                            <span className="text-xs font-mono text-cyan-300">{d.model}</span>
                          </div>}
                          {d.firmware && <div className="flex justify-between">
                            <span className="text-xs text-slate-400">Firmware</span>
                            <span className="text-xs font-mono text-slate-300">{d.firmware}</span>
                          </div>}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {d.cpuLoad && <div className="bg-slate-800/60 rounded-xl p-2.5 text-center">
                            <Cpu className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                            <div className="text-sm font-bold text-white">{d.cpuLoad}</div>
                            <div className="text-[10px] text-slate-500">CPU</div>
                          </div>}
                          {d.uptime && <div className="bg-slate-800/60 rounded-xl p-2.5 text-center">
                            <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                            <div className="text-[11px] font-bold text-white leading-tight">{d.uptime}</div>
                            <div className="text-[10px] text-slate-500">Uptime</div>
                          </div>}
                          <div className="bg-slate-800/60 rounded-xl p-2.5 text-center">
                            <Users className="w-4 h-4 text-green-400 mx-auto mb-1" />
                            <div className="text-sm font-bold text-white">{d.clientCount ?? 0}</div>
                            <div className="text-[10px] text-slate-500">Clientes</div>
                          </div>
                        </div>

                        {(d.ssid || d.frequency || d.noiseFloor) && (
                          <div className="bg-slate-800/60 rounded-xl p-3 space-y-1.5">
                            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Wireless</div>
                            {d.ssid && <div className="flex justify-between">
                              <span className="text-xs text-slate-400">SSID</span>
                              <span className="text-xs font-semibold text-violet-300 truncate max-w-32">{d.ssid}</span>
                            </div>}
                            {d.frequency && <div className="flex justify-between">
                              <span className="text-xs text-slate-400">Frequência</span>
                              <span className="text-xs font-mono text-slate-200">{d.frequency}</span>
                            </div>}
                            {d.noiseFloor && <div className="flex justify-between">
                              <span className="text-xs text-slate-400">Noise Floor</span>
                              <span className="text-xs font-mono text-slate-200">{d.noiseFloor}</span>
                            </div>}
                          </div>
                        )}

                        {(d.temperature || d.voltage) && (
                          <div className="flex gap-2">
                            {d.temperature && <div className="flex-1 bg-slate-800/60 rounded-xl p-2.5 flex items-center gap-2">
                              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                              <div>
                                <div className="text-xs font-bold text-white">{d.temperature}</div>
                                <div className="text-[10px] text-slate-500">Temperatura</div>
                              </div>
                            </div>}
                            {d.voltage && <div className="flex-1 bg-slate-800/60 rounded-xl p-2.5 flex items-center gap-2">
                              <Zap className="w-3.5 h-3.5 text-yellow-400" />
                              <div>
                                <div className="text-xs font-bold text-white">{d.voltage}</div>
                                <div className="text-[10px] text-slate-500">Tensão</div>
                              </div>
                            </div>}
                          </div>
                        )}

                        <div className="bg-slate-800/60 rounded-xl p-3">
                          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-2 flex items-center justify-between">
                            <span>Clientes Wireless</span>
                            <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{clients.length}</span>
                          </div>
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin' }}>
                            {clients.map((c: any, i: number) => {
                              const sig = parseInt(c.signal || '0');
                              const isWarn = sig < -69 && sig >= -79;
                              const isBad = sig < -79;
                              return (
                                <div key={i} className={`rounded-lg px-2.5 py-2 flex items-center justify-between gap-2 border ${
                                  isBad ? 'bg-red-900/20 border-red-700/30' :
                                  isWarn ? 'bg-amber-900/20 border-amber-700/30' :
                                  'bg-slate-700/40 border-slate-600/20'
                                }`}>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Wifi className={`w-3 h-3 shrink-0 ${isBad ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-green-400'}`} />
                                    <div className="min-w-0">
                                      <div className="text-[10px] font-mono text-slate-200 truncate">{c.mac}</div>
                                      <div className="text-[9px] text-slate-500">
                                        {c.txRate && c.txRate !== 'N/A' && `TX ${c.txRate}`}
                                        {c.txRate && c.rxRate && c.rxRate !== 'N/A' && ' · '}
                                        {c.rxRate && c.rxRate !== 'N/A' && `RX ${c.rxRate}`}
                                      </div>
                                    </div>
                                  </div>
                                  <span className={`text-xs font-black shrink-0 ${isBad ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-green-400'}`}>
                                    {c.signal}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-700/50">
                          <div className="flex items-center justify-between gap-4">
                            <button 
                              disabled={triggerAiAnalysis.isPending}
                              onClick={() => triggerAiAnalysis.mutate(showDiagnostic || '')}
                              className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-xl text-[11px] font-bold transition-all border border-purple-500/20 disabled:opacity-50"
                            >
                              {triggerAiAnalysis.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                              ANÁLISE IA (ON-DEMAND)
                            </button>
                            <div className="text-[10px] text-slate-600">Coletado em {collectedDate}</div>
                          </div>

                          {aiAnalysis && (
                            <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-3 animate-in slide-in-from-top-2 duration-300">
                              <div className="flex items-center gap-2 mb-1.5 font-bold text-xs text-purple-400">
                                 <Zap className="w-3 h-3" /> ANÁLISE DO ENGENHEIRO IA
                              </div>
                              <p className="text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap">{aiAnalysis}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Context menu for Link */}
            {linkContextMenu && (
              <div className="absolute z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-xl py-1 min-w-36"
                style={{ left: linkContextMenu.x + 4, top: linkContextMenu.y + 4 }}>
                <button className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    removeLink.mutate(linkContextMenu.linkId); 
                    setLinkContextMenu(null); 
                  }}>
                  <Trash2 className="w-4 h-4" /> Excluir Linha
                </button>
              </div>
            )}

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <MapIcon className="w-16 h-16 mb-4 text-slate-700" />
            <p className="text-lg font-semibold">Selecione ou crie um mapa</p>
            <p className="text-sm mt-1">Use a barra lateral para gerenciar mapas de rede</p>
          </div>
        )}
      </div>

      {/* ── Add Device Modal ──────────────────────────────────────────────────── */}
      {showAddDevice && selectedMapId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowAddDevice(false)}>
          <div className="bg-slate-800 border border-slate-600 rounded-2xl w-[480px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h3 className="font-bold text-lg text-slate-100">Adicionar Dispositivo ao Mapa</h3>
              <button onClick={() => setShowAddDevice(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            {/* Novo Dispositivo Customizado */}
            <div className="px-5 pt-4 pb-4 border-b border-slate-700 bg-slate-800/50">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Adicionar Dispositivo Avulso</div>
              <div className="flex gap-2">
                <input value={customDeviceName} onChange={e => setCustomDeviceName(e.target.value)} placeholder="Nome do Disp..." 
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                <input value={customDeviceIp} onChange={e => setCustomDeviceIp(e.target.value)} placeholder="IP (Opcional)..." 
                  className="w-32 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                <button 
                  disabled={!customDeviceName.trim() || addNode.isPending}
                  onClick={() => {
                    addNode.mutate({ mapId: selectedMapId, apIp: customDeviceIp.trim() || undefined, label: customDeviceName.trim(), x: 200 + Math.random() * 50, y: 200 + Math.random() * 50 });
                  }}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2">
                  {addNode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Incluir'}
                </button>
              </div>
            </div>

            <div className="px-5 pt-3 pb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-400 uppercase">Ou selecione do Banco de Dados</div>
            </div>
            <div className="px-5 pb-2">
              <input value={addFilter} onChange={e => setAddFilter(e.target.value)} placeholder="Filtrar por nome ou IP cadastrado..."
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
              {filteredAPs.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-8">Nenhum dispositivo disponível</p>
              )}
              {filteredAPs.map(ap => (
                <button key={ap.ip}
                  onClick={() => addNode.mutate({ mapId: selectedMapId, apIp: ap.ip, label: ap.descricao, x: 200 + Math.random() * 300, y: 200 + Math.random() * 200 })}
                  className="w-full flex items-center gap-3 px-4 py-2.5 bg-slate-900/40 hover:bg-slate-700/60 rounded-xl transition-all border border-transparent hover:border-slate-600 text-left">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ap.status === 'ONLINE' ? 'bg-green-400' : 'bg-red-500'}`} />
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{ap.descricao}</div>
                    <div className="text-xs text-slate-400 font-mono">{ap.ip}</div>
                  </div>
                  <Plus className="w-4 h-4 ml-auto text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Diagnostic Modal ───────────────────────────────────────────────────── */}
      {showDiagnostic && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 lg:p-8" onClick={() => { setShowDiagnostic(null); setAiAnalysis(null); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-6xl max-h-full overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                  <TrendingUp className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-white">Diagnóstico de Rede</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-slate-500 text-xs font-mono">{showDiagnostic}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { setShowDiagnostic(null); setAiAnalysis(null); }} 
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
               <DiagnosticContent ip={showDiagnostic} />
               
               <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between gap-4">
                    <button 
                      disabled={triggerAiAnalysis.isPending}
                      onClick={() => triggerAiAnalysis.mutate(showDiagnostic)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-[11px] font-bold transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50"
                    >
                      {triggerAiAnalysis.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                      SOLICITAR ANÁLISE DO ENGENHEIRO IA (GPT-4o)
                    </button>
                  </div>

                  {aiAnalysis && (
                    <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-5 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-2 mb-3 font-bold text-xs text-purple-400">
                          <Zap className="w-3.5 h-3.5 text-orange-400" /> ANÁLISE E RECOMENDAÇÕES DO ENGENHEIRO IA
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap font-medium">{aiAnalysis}</p>
                    </div>
                  )}
                </div>
            </div>
            
            <div className="px-8 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <History className="w-3.5 h-3.5" />
                <span>Exibindo histórico dos últimos 30 dias baseado em amostras de coleta.</span>
              </div>
              <button onClick={() => { setShowDiagnostic(null); setAiAnalysis(null); }} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Device Modal ─────────────────────────────────────────────────── */}
      {showEditDevice && selectedMapId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEditDevice(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-[400px] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700 bg-slate-800/50">
              <h3 className="font-bold text-lg text-white">Editar Equipamento</h3>
              <button onClick={() => setShowEditDevice(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome / Descrição</label>
                <input 
                  value={showEditDevice.label} 
                  onChange={e => setShowEditDevice({ ...showEditDevice, label: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Endereço IP</label>
                <input 
                  value={showEditDevice.apIp} 
                  onChange={e => setShowEditDevice({ ...showEditDevice, apIp: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all" 
                />
              </div>
              <button 
                onClick={() => {
                  (updateNodeInfo as any).mutate({
                    nodeId: showEditDevice.nodeId,
                    apIp: showEditDevice.apIp.trim(),
                    label: showEditDevice.label.trim()
                  });
                  setShowEditDevice(null);
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-900/40 mt-2">
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals e Overlays Adicionais */}
      {showNicknameEdit && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Tag className="w-5 h-5 text-violet-400" /> Definir Apelido</h3>
              <button onClick={() => setShowNicknameEdit(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-400">Defina um apelido ou microrregião para este dispositivo. Ele aparecerá no mapa e nos alertas do WhatsApp.</p>
              <input 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                value={showNicknameEdit.nickname}
                onChange={(e) => setShowNicknameEdit({ ...showNicknameEdit, nickname: e.target.value })}
                placeholder="Ex: Pantanal, Centro, Torre B..."
                autoFocus
              />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNicknameEdit(null)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors">Cancelar</button>
                <button 
                  onClick={() => {
                    if (showNicknameEdit.nodeIds.length === 1) {
                      updateNodeNickname.mutate({ nodeId: showNicknameEdit.nodeIds[0], nickname: showNicknameEdit.nickname });
                    } else {
                      bulkUpdateNodeNickname.mutate({ nodeIds: showNicknameEdit.nodeIds, nickname: showNicknameEdit.nickname });
                    }
                    setShowNicknameEdit(null);
                  }}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
                >
                  Salvar Apelido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Settings className="w-5 h-5 text-slate-400" /> Configurações de Alerta</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <div>
                  <div className="text-sm font-bold text-white">Sistema de Alertas (WhatsApp)</div>
                  <div className="text-xs text-slate-500">Habilita ou desabilita todos os alertas automáticos via WhatsApp.</div>
                </div>
                <button 
                  onClick={() => updateConfig.mutate({ key: 'whatsapp_alerts_enabled', value: globalConfig.whatsapp_alerts_enabled === 'true' ? 'false' : 'true' })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${globalConfig.whatsapp_alerts_enabled === 'false' ? 'bg-slate-700' : 'bg-green-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${globalConfig.whatsapp_alerts_enabled === 'false' ? 'left-1' : 'left-7'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-sky-700/30">
                <div>
                  <div className="text-sm font-bold text-white">Sistema de Alertas (Telegram)</div>
                  <div className="text-xs text-slate-500">Habilita ou desabilita todos os alertas automáticos via Telegram.</div>
                </div>
                <button 
                  onClick={() => updateConfig.mutate({ key: 'telegram_alerts_enabled', value: globalConfig.telegram_alerts_enabled === 'false' || !globalConfig.telegram_alerts_enabled ? 'true' : 'false' })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${globalConfig.telegram_alerts_enabled === 'false' || !globalConfig.telegram_alerts_enabled ? 'bg-slate-700' : 'bg-sky-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${globalConfig.telegram_alerts_enabled === 'false' || !globalConfig.telegram_alerts_enabled ? 'left-1' : 'left-7'}`} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-bold text-white">Tempo de Espera (Delay)</div>
                <p className="text-xs text-slate-500">Tempo que o sistema espera o equipamento ficar offline antes de enviar a mensagem (em segundos).</p>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" min="10" max="600" step="10" 
                    className="flex-1 accent-violet-500"
                    value={globalConfig.whatsapp_alert_delay || '60'}
                    onChange={(e) => updateConfig.mutate({ key: 'whatsapp_alert_delay', value: e.target.value })}
                  />
                  <span className="text-sm font-mono text-violet-400 w-12 text-right">{globalConfig.whatsapp_alert_delay || '60'}s</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <div>
                    <div className="text-sm font-semibold text-white">Resumo Periódico</div>
                    <div className="text-xs text-slate-400">Tempo para re-enviar resumo das quedas (min)</div>
                  </div>
                  <input 
                    type="number" min="0" max="1440"
                    className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500 text-center"
                    value={globalConfig.whatsapp_summary_interval || '10'}
                    onChange={(e) => updateConfig.mutate({ key: 'whatsapp_summary_interval', value: e.target.value })}
                  />
                  <span className="text-sm font-mono text-violet-400 w-12 text-right">{globalConfig.whatsapp_summary_interval || '10'}m</span>
                </div>
              </div>

              <div className="bg-amber-900/20 border border-amber-700/30 p-4 rounded-xl flex gap-3">
                <Smartphone className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="text-xs text-amber-200/80 leading-relaxed">
                  <b>Dica:</b> Você também pode silenciar mapas inteiros ou rádios específicos clicando com o botão direito sobre eles no mapa.
                </div>
              </div>

              <button 
                onClick={() => setShowSettings(false)} 
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-colors"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Botão de configurações fixo */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button 
          onClick={() => setShowSettings(true)}
          className="p-3 bg-slate-800/80 backdrop-blur-md border border-slate-700 hover:border-violet-500 text-slate-300 hover:text-white rounded-xl shadow-lg transition-all group"
          title="Configurações de Alerta"
        >
          <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
        </button>
      </div>

      {/* Terminal Flutuante (Ping Contínuo / Traceroute) */}
      {terminalConfig && (
        <div className="fixed bottom-4 right-4 w-[550px] bg-gray-950 border border-slate-700 rounded-2xl shadow-2xl z-[999] overflow-hidden flex flex-col" style={{ maxHeight: '45vh' }}>
          <div className="bg-slate-800/80 px-4 py-3 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white truncate">{terminalConfig.title}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono uppercase">{terminalConfig.type}</span>
            </div>
            <button onClick={() => setTerminalConfig(null)} className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-green-400 bg-black/80 space-y-0.5" style={{ maxHeight: '35vh', scrollbarWidth: 'thin' }}
            ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
            {terminalLines.length === 0 ? (
              <div className="text-slate-500 animate-pulse">Aguardando resposta...</div>
            ) : (
              terminalLines.map((line, i) => <div key={i}>{line}</div>)
            )}
          </div>
        </div>
      )}

      {renderHistoryModal()}

      {/* ── Winbox First-Time Setup Modal ─────────────────────────────────────── */}
      {showWinboxSetup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-slate-800/50 px-6 py-5 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Maximize2 className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Configuração do Winbox Local</h3>
              </div>
              <button onClick={() => setShowWinboxSetup(null)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <p className="text-slate-300 text-sm leading-relaxed">
                Para que o navegador abra o Winbox no seu computador sem precisar baixar arquivos toda vez, precisamos registrar o protocolo <code className="bg-slate-800 px-2 py-0.5 rounded text-cyan-400">winbox://</code> no seu Windows.
              </p>

              <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Siga os passos (Uma única vez):</h4>
                <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                  <li>Clique no botão abaixo para baixar o arquivo de registro.</li>
                  <li>Abra o arquivo baixado (<code className="text-slate-200">winbox.reg</code>).</li>
                  <li>Clique em "Sim" na janelas do Windows que aparecerem.</li>
                  <li>O Winbox deve estar em <code className="text-slate-200">C:\\Tools\\winbox.exe</code>.</li>
                </ol>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    const reg = `Windows Registry Editor Version 5.00\r\n\r\n[HKEY_CLASSES_ROOT\\winbox]\r\n@="URL:winbox Protocol"\r\n"URL Protocol"=""\r\n\r\n[HKEY_CLASSES_ROOT\\winbox\\shell\\open\\command]\r\n@="powershell.exe -WindowStyle Hidden -Command \\"$url = '%1'; $ip = $url -replace 'winbox://', ''; $ip = $ip -replace '/', ''; Start-Process 'C:\\\\Tools\\\\winbox.exe' -ArgumentList $ip\\""\r\n\r\n[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome]\r\n"ExternalProtocolDialogShowAlwaysOpenCheckbox"=dword:00000001\r\n`;
                    const blob = new Blob([reg], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'configurar_winbox.reg';
                    a.click(); URL.revokeObjectURL(url);
                  }}
                  className="flex-1 px-6 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-cyan-900/20"
                >
                  <Save className="w-5 h-5" />
                  Baixar configurador (.reg)
                </button>
                
                <button 
                  onClick={() => {
                    localStorage.setItem('winbox_setup_done', 'true');
                    setWinboxSetupDone(true);
                    if (showWinboxSetup) window.location.assign(`winbox://${showWinboxSetup.ip}`);
                    setShowWinboxSetup(null);
                  }}
                  className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all border border-slate-700"
                >
                  Já fiz / Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderHistoryModal() {
    if (!showHistory) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
          <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <History className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Histórico de Eventos</h3>
                <p className="text-xs text-slate-400">{showHistory.label}</p>
              </div>
            </div>
            <button onClick={() => setShowHistory(null)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 max-h-[70vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                <p className="text-slate-400">Carregando histórico...</p>
              </div>
            ) : outageHistory.length === 0 ? (
              <div className="text-center py-20 opacity-50">
                <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Nenhuma queda registrada para este equipamento.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Início</th>
                    <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Duração</th>
                    <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fim / Normalizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {outageHistory.map((ev) => {
                    const durationStr = ev.duration 
                      ? ev.duration > 86400 
                        ? `${Math.floor(ev.duration / 86400)}d ${new Date(ev.duration * 1000).toISOString().substr(11, 8)}`
                        : new Date(ev.duration * 1000).toISOString().substr(11, 8)
                      : '-';
                    
                    return (
                      <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${ev.endTime ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {ev.endTime ? 'RESOLVIDO' : 'PENDENTE'}
                          </span>
                        </td>
                        <td className="py-4 font-mono text-xs text-slate-300">
                          {new Date(ev.startTime).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span className="text-xs font-semibold text-white">{durationStr}</span>
                          </div>
                        </td>
                        <td className="py-4 font-mono text-xs text-slate-400">
                          {ev.endTime ? new Date(ev.endTime).toLocaleString('pt-BR') : <span className="text-amber-500 animate-pulse font-bold italic tracking-wide">Aguardando...</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="bg-slate-800/30 px-6 py-4 text-center border-t border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Registro de eventos automáticos do monitor</p>
          </div>
        </div>
      </div>
    );
  }
}
