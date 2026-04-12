import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../services/api';
import { 
  Terminal, Play, CheckCircle2, XCircle, Loader2, 
  Plus, Save, Trash2, Code2, Radio, ChevronDown, ChevronUp,
  AlertCircle, SquareStack, Search, BarChart3
} from 'lucide-react';

const API = '/api';

interface Script {
  id: string;
  name: string;
  description: string | null;
  content: string;
  isDefault: boolean;
}

interface Transmitter {
  id: string;
  descricao: string;
  ip: string;
  status: string;
}

interface ExecutionResult {
  id: string;
  apIp: string;
  apName: string;
  status: string;
  output: string | null;
  error: string | null;
  createdAt: string;
}

export default function ScriptManager() {
  const queryClient = useQueryClient();
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [selectedIps, setSelectedIps] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ONLINE');
  // Queries
  const { data: scripts } = useQuery<Script[]>({
    queryKey: ['scripts'],
    queryFn: async () => { const r = await apiFetch(`${API}/scripts`); return r.json(); },
    refetchInterval: 5000,
  });

  const { data: transmitters } = useQuery<Transmitter[]>({
    queryKey: ['transmitters'],
    queryFn: async () => { const r = await apiFetch(`${API}/transmitters`); return r.json(); },
  });

  const { data: results, refetch: refetchResults } = useQuery<{ summary: any; results: ExecutionResult[] }>({
    queryKey: ['script-results', selectedScript?.id],
    queryFn: async () => {
      if (!selectedScript) return { summary: {}, results: [] };
      const r = await apiFetch(`${API}/scripts/${selectedScript.id}/results`);
      return r.json();
    },
    enabled: !!selectedScript && showResults,
    refetchInterval: 3000,
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; name: string; description: string; content: string }) => {
      const url = data.id ? `${API}/scripts/${data.id}` : `${API}/scripts`;
      const method = data.id ? 'PUT' : 'POST';
      const r = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      return r.json();
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      setSelectedScript(saved);
      setIsCreating(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`${API}/scripts/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      setSelectedScript(null);
      setEditContent('');
    }
  });

  const executeMutation = useMutation({
    mutationFn: async (data: { scriptId: string; targets: string[] | 'ALL' }) => {
      const r = await apiFetch(`${API}/scripts/${data.scriptId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: data.targets })
      });
      return r.json();
    },
    onSuccess: () => {
      setShowResults(true);
      setTimeout(() => refetchResults(), 2000);
    }
  });

  const filteredTransmitters = useMemo(() => {
    if (!transmitters) return [];
    return transmitters.filter(t => {
      const matchSearch = t.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || t.ip.includes(searchTerm);
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [transmitters, searchTerm, statusFilter]);

  const selectScript = (s: Script) => {
    setSelectedScript(s);
    setEditContent(s.content);
    setEditName(s.name);
    setEditDesc(s.description || '');
    setShowResults(false);
    setIsCreating(false);
  };

  const startNewScript = () => {
    setIsCreating(true);
    setSelectedScript(null);
    setEditName('');
    setEditDesc('');
    setEditContent('# Novo Script RouterOS\n');
    setShowResults(false);
  };

  const toggleIp = (ip: string) => {
    const next = new Set(selectedIps);
    if (next.has(ip)) next.delete(ip); else next.add(ip);
    setSelectedIps(next);
  };

  const toggleAll = () => {
    const currentFilteredIps = filteredTransmitters.map(t => t.ip);
    const allSelectedInFilter = currentFilteredIps.every(ip => selectedIps.has(ip));
    
    const next = new Set(selectedIps);
    if (allSelectedInFilter) {
      // Se todos visíveis já estão selecionados, desmarcamos todos OS VISÍVEIS
      currentFilteredIps.forEach(ip => next.delete(ip));
    } else {
      // Marcamos todos os visíveis
      currentFilteredIps.forEach(ip => next.add(ip));
    }
    setSelectedIps(next);
  };

  const handleExecute = () => {
    if (!selectedScript) return;
    const targets = selectedIps.size === (transmitters?.length || 0) 
      ? 'ALL' 
      : Array.from(selectedIps);
    executeMutation.mutate({ scriptId: selectedScript.id, targets });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2 flex items-center">
          <Terminal className="w-10 h-10 mr-4 text-purple-600" />
          Scripts em Massa
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          Execute comandos RouterOS em todos os equipamentos da rede simultaneamente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Coluna Esquerda: Lista de Scripts */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Scripts Salvos</h3>
            <button onClick={startNewScript} className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {scripts?.map(s => (
            <div
              key={s.id}
              onClick={() => selectScript(s)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedScript?.id === s.id 
                  ? 'bg-purple-50 border-purple-300 dark:bg-purple-900/20 dark:border-purple-700 shadow-md' 
                  : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:shadow-md'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Code2 className={`w-5 h-5 ${selectedScript?.id === s.id ? 'text-purple-600' : 'text-gray-400'}`} />
                <div>
                  <p className="font-bold text-sm text-gray-900 dark:text-white">{s.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{s.description || 'Sem descrição'}</p>
                </div>
              </div>
              {s.isDefault && (
                <span className="mt-2 inline-block text-[9px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase">Padrão</span>
              )}
            </div>
          ))}
        </div>

        {/* Coluna Central: Editor de Script */}
        <div className="lg:col-span-5 space-y-4">
          {(selectedScript || isCreating) ? (
            <>
              <div className="flex items-center space-x-3">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Nome do Script"
                  className="flex-1 text-lg font-bold p-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={() => saveMutation.mutate({
                    id: selectedScript?.id,
                    name: editName,
                    description: editDesc,
                    content: editContent
                  })}
                  className="p-3 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-all flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span className="text-sm font-bold">Salvar</span>
                </button>
                {selectedScript && !selectedScript.isDefault && (
                  <button
                    onClick={() => deleteMutation.mutate(selectedScript.id)}
                    className="p-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <input
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="Descrição (opcional)"
                className="w-full text-sm p-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white"
              />

              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={20}
                className="w-full font-mono text-xs p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-900 text-green-400 focus:ring-2 focus:ring-purple-500 resize-none leading-relaxed"
                spellCheck={false}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 bg-gray-50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <Code2 className="w-16 h-16 text-gray-200 mb-4" />
              <p className="text-gray-400 font-bold text-lg">Selecione um script ou crie um novo</p>
            </div>
          )}
        </div>

        {/* Coluna Direita: Seletor de Equipamentos + Execução */}
        <div className="lg:col-span-4 space-y-4">
          {selectedScript && (
            <>
              {/* Seletor de Alvos */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center">
                    <Radio className="w-4 h-4 mr-2" /> Equipamentos Alvo
                  </h4>
                </div>

                <div className="flex flex-col gap-3 mb-4">
                  {/* Busca */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar Nome ou IP..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  {/* Filtro Dropdown */}
                  <select 
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="w-full p-2 text-xs font-bold rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ONLINE">Apenas Online</option>
                    <option value="OFFLINE">Apenas Offline</option>
                    <option value="ALL">Todos os Status</option>
                  </select>
                </div>

                <div className="text-[10px] text-gray-400 mb-3 font-medium flex justify-between">
                  <span>{selectedIps.size} total selecionado(s)</span>
                  <span>{filteredTransmitters.length} na lista</span>
                </div>

                {filteredTransmitters.length > 0 && (
                  <div 
                    onClick={toggleAll}
                    className="flex items-center p-3 mb-2 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-900/20 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={filteredTransmitters.every(t => selectedIps.has(t.ip))}
                      readOnly
                      className="mr-3 rounded accent-purple-600 pointer-events-none"
                    />
                    <span className="text-xs font-black text-purple-700 dark:text-purple-400">
                      Marcar todos os {filteredTransmitters.length} filtrados
                    </span>
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                  {filteredTransmitters.map(t => (
                    <label
                      key={t.ip}
                      className={`flex items-center p-2 rounded-xl cursor-pointer transition-all ${
                        selectedIps.has(t.ip) 
                          ? 'bg-purple-50 dark:bg-purple-900/20' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIps.has(t.ip)}
                        onChange={() => toggleIp(t.ip)}
                        className="mr-3 rounded accent-purple-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate flex items-center">
                          {t.descricao}
                          <span className={`ml-2 w-2 h-2 rounded-full ${t.status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`} />
                        </p>
                        <p className="text-[9px] text-gray-400 font-mono">{t.ip}</p>
                      </div>
                    </label>
                  ))}
                  {filteredTransmitters.length === 0 && (
                     <div className="text-center p-4 text-xs text-gray-500 font-bold">Nenhum rádio encontrado.</div>
                  )}
                </div>
              </div>

              {/* Botão Executar */}
              <button
                onClick={handleExecute}
                disabled={selectedIps.size === 0 || executeMutation.isPending}
                className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center space-x-3 transition-all ${
                  selectedIps.size > 0 
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-xl shadow-purple-500/20 active:scale-95' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {executeMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span>Executar em {selectedIps.size} Equipamento(s)</span>
              </button>

              {/* Resultados */}
              {showResults && (
                <button
                  onClick={() => { setShowResults(!showResults); refetchResults(); }}
                  className="w-full text-sm font-bold text-purple-600 py-2 flex items-center justify-center space-x-2"
                >
                  <SquareStack className="w-4 h-4" />
                  <span>Ver Resultados</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Seção de Resultados */}
      {showResults && results && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center">
              <SquareStack className="w-5 h-5 mr-3 text-purple-600" />
              Resultados da Execução
            </h3>
            <div className="flex space-x-4 text-xs font-bold">
              <span className="text-green-600 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" />{results.summary?.success || 0} OK</span>
              <span className="text-red-500 flex items-center"><XCircle className="w-3 h-3 mr-1" />{results.summary?.failed || 0} Falhas</span>
              <span className="text-blue-500 flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin" />{(results.summary?.pending || 0) + (results.summary?.running || 0)} Pendentes</span>
            </div>
          </div>

          <div className="space-y-2">
            {results.results?.map((r: ExecutionResult) => (
              <div 
                key={r.id} 
                className={`bg-white dark:bg-gray-800 rounded-2xl border transition-all ${
                  r.status === 'SUCCESS' ? 'border-green-100 dark:border-green-900/30' :
                  r.status === 'FAILED' ? 'border-red-100 dark:border-red-900/30' :
                  'border-gray-100 dark:border-gray-700'
                }`}
              >
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedResult(expandedResult === r.id ? null : r.id)}
                >
                  <div className="flex items-center space-x-4">
                    {r.status === 'SUCCESS' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> :
                     r.status === 'FAILED' ? <XCircle className="w-5 h-5 text-red-500" /> :
                     r.status === 'RUNNING' ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> :
                     <AlertCircle className="w-5 h-5 text-gray-400" />}
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{r.apName || r.apIp}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{r.apIp}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase ${
                      r.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                      r.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      r.status === 'RUNNING' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{r.status}</span>
                    {expandedResult === r.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {expandedResult === r.id && (
                  <div className="px-4 pb-4">
                    {r.output && (
                      <pre className="bg-gray-900 text-green-400 text-[10px] p-3 rounded-xl overflow-x-auto font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">{r.output}</pre>
                    )}
                    {r.error && (
                      <pre className="bg-red-50 dark:bg-red-900/20 text-red-600 text-[10px] p-3 rounded-xl overflow-x-auto font-mono">{r.error}</pre>
                    )}
                    {!r.output && !r.error && (
                      <p className="text-xs text-gray-400 italic">Aguardando resposta...</p>
                    )}
                    {r.status === 'SUCCESS' && (
                      <a 
                        href={`/aps`}
                        className="mt-3 flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Ver Telemetria em Gestão de APs</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
