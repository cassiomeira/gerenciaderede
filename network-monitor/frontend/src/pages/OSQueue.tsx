import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { AlertTriangle, Clock, Activity, CheckCircle, ChevronDown, ChevronUp, Wifi, ActivitySquare, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Interfaces baseadas no JSON retornado pelo Python
interface OSTechData {
  tipo_conexao: string;
  mac: string;
  onu_mac: string;
  sinal_onu: string;
  online: string;
  conexao_ap: string;
  ip: string;
  login: string;
}

interface OSItem {
  id: number;
  data: string;
  assunto: string;
  mensagem: string;
  status: string;
  id_cliente: number;
  nome_cliente: string;
  risco: string;
  score: number;
  urgencia: string;
  motivos: string[];
  recomendacao: string;
  dados_tecnicos: OSTechData;
  quantidade_abertas_cliente: number;
  quantidade_fechadas_cliente: number;
  recorrencia_rapida_cliente: boolean;
  eh_recolhimento: boolean;
}

interface OSReport {
  timestamp: string;
  os_lista_plana: OSItem[];
}

function SignalMonitor({ sn }: { sn: string }) {
  const [loading, setLoading] = useState(false);
  const [signal, setSignal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSignal = async () => {
    if (!sn) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.get(`http://localhost:5000/api/sinal-onu?sn=${sn}`);
      if (resp.data.status === 'ok') {
        setSignal(resp.data.sinal);
      } else {
        setError(resp.data.mensagem || 'Erro ao buscar sinal');
      }
    } catch (err: any) {
      setError('OLTs inacessíveis ou ONT não encontrada.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase">Sinal Real-Time (OLT)</span>
        {!signal && !loading && (
          <button 
            onClick={(e) => { e.stopPropagation(); fetchSignal(); }}
            className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Consultar OLT
          </button>
        )}
      </div>
      <div className="mt-1 flex items-center">
        {loading ? (
          <span className="text-xs text-blue-500 animate-pulse">Conectando na OLT via SSH...</span>
        ) : signal ? (
          <span className={cn(
            "text-lg font-bold",
            parseFloat(signal) > -25 ? "text-green-500" : "text-red-500"
          )}>
            {signal}
          </span>
        ) : error ? (
          <span className="text-xs text-red-400">{error}</span>
        ) : (
          <span className="text-xs text-gray-400 italic font-mono">{sn || 'Sem Serial Number'}</span>
        )}
      </div>
    </div>
  );
}

export default function OSQueue() {
  const [activeTab, setActiveTab] = useState<'ATIVAS' | 'RECOLHIMENTO'>('ATIVAS');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['os-report'],
    queryFn: async () => {
      const response = await axios.get<{ status: string; dados?: OSReport; mensagem?: string }>('http://localhost:5000/api/relatorio');
      return response.data;
    },
    refetchInterval: 60000, // Atualiza a cada 1 minuto
  });

  const handleAnalise = async () => {
    try {
      await axios.post('http://localhost:5000/api/analisar', { dias: 30 });
      alert('Análise solicitada no backend. Isso pode levar alguns minutos.');
    } catch (err) {
      alert('Erro ao solicitar análise');
    }
  };

  const relatorio = data?.dados;
  const isPending = data?.status === 'pendente';
  
  const allOs = relatorio?.os_lista_plana || [];
  
  const ativas = allOs.filter(os => !os.eh_recolhimento);
  const recolhimentos = allOs.filter(os => os.eh_recolhimento);
  
  const displayedOs = activeTab === 'ATIVAS' ? ativas : recolhimentos;

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Fila de O.S. Inteligente</h1>
          <p className="text-gray-500 mt-1">
            Ordens de serviço ordenadas por IA de acordo com urgência, chamados em aberto e recorrência de problemas.
          </p>
        </div>
        <button
          onClick={handleAnalise}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Solicitar Nova Análise (IA)
        </button>
      </div>

      {isPending && !relatorio ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                {data?.mensagem || "A análise está em andamento. Aguarde alguns minutos e a página atualizará sozinha."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center space-x-1 mb-6 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 w-fit">
            <button
              onClick={() => setActiveTab('ATIVAS')}
              className={cn(
                "px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2",
                activeTab === 'ATIVAS' 
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <Activity className="w-4 h-4" />
              <span>O.S. Ativas / Recorrentes</span>
              <span className={cn(
                "ml-2 px-2 py-0.5 rounded-full text-xs font-bold",
                activeTab === 'ATIVAS' ? "bg-blue-500/30 text-white" : "bg-gray-200 text-gray-700"
              )}>
                {ativas.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('RECOLHIMENTO')}
              className={cn(
                "px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2",
                activeTab === 'RECOLHIMENTO' 
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <AlertCircle className="w-4 h-4" />
              <span>Cancelamento / Recolhimento</span>
              <span className={cn(
                "ml-2 px-2 py-0.5 rounded-full text-xs font-bold",
                activeTab === 'RECOLHIMENTO' ? "bg-red-500/30 text-white" : "bg-gray-200 text-gray-700"
              )}>
                {recolhimentos.length}
              </span>
            </button>
          </div>

          {/* Lista de OS */}
          <div className="space-y-4">
            {displayedOs.map((os) => {
              const isExpanded = expandedId === os.id;
              const isUrgent = os.risco === 'ALTO' || os.quantidade_abertas_cliente > 0 || os.recorrencia_rapida_cliente;
              const isOffline = os.dados_tecnicos?.online === 'Offline';
              
              return (
                <div 
                  key={os.id + "-" + os.score}
                  className={cn(
                    "bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all duration-200 overflow-hidden",
                    isUrgent ? "border-l-4 border-l-red-500 border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-gray-700" : "border-gray-200 dark:border-gray-700"
                  )}
                >
                  {/* Card Header (Resumo) */}
                  <div 
                    onClick={() => toggleExpand(os.id)}
                    className="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/80 grid grid-cols-12 gap-4 items-center"
                  >
                    {/* Status & Priority */}
                    <div className="col-span-12 md:col-span-3 flex flex-col justify-center">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-gray-500 dark:text-gray-400 font-mono text-sm">#{os.id}</span>
                        <span className={cn(
                          "px-2 py-0.5 text-xs font-bold rounded-md", 
                          os.status === 'F' ? 'bg-green-100 text-green-700' : 
                          os.status === 'A' ? 'bg-blue-100 text-blue-700' : 
                          'bg-yellow-100 text-yellow-700'
                        )}>
                          {os.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white truncate" title={os.nome_cliente}>
                        {os.nome_cliente}
                      </h3>
                    </div>

                    {/* Assunto & Recorrência */}
                    <div className="col-span-12 md:col-span-5 flex flex-col justify-center">
                      <div className="font-medium text-gray-800 dark:text-gray-200 text-sm mb-1">{os.assunto}</div>
                      <div className="flex flex-wrap gap-2">
                        {os.quantidade_abertas_cliente > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            <Clock className="w-3 h-3 mr-1" />
                            {os.quantidade_abertas_cliente} O.S. Abertas
                          </span>
                        )}
                        {os.recorrencia_rapida_cliente && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            <Activity className="w-3 h-3 mr-1" />
                            Recorrência Rápida
                          </span>
                        )}
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          os.quantidade_fechadas_cliente > 0 
                            ? "bg-green-100 text-green-800" 
                            : "bg-gray-100 text-gray-600"
                        )}>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {os.quantidade_fechadas_cliente} O.S. Fechadas
                        </span>
                         {isOffline && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-red-400">
                            Offline
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Data & AI Score */}
                    <div className="col-span-12 md:col-span-3 flex items-center justify-between md:justify-end space-x-4">
                      <div className="text-sm text-gray-500">
                        {os.data}
                      </div>
                      <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 font-semibold">IA SCORE</span>
                        <span className={cn(
                          "text-lg font-bold leading-none",
                          os.score >= 80 ? "text-red-600" : os.score >= 50 ? "text-orange-500" : "text-green-500"
                        )}>
                          {os.score}
                        </span>
                      </div>
                    </div>

                    {/* Chevron */}
                    <div className="col-span-12 md:col-span-1 flex justify-end">
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Left: O.S. Info & AI Diagnosis */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-2 text-blue-500" />
                            Descrição da O.S.
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                            {os.mensagem || "Sem descrição adicional."}
                          </p>
                        </div>

                        {os.motivos && os.motivos.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center">
                              <ActivitySquare className="w-4 h-4 mr-2 text-purple-500" />
                              Diagnóstico da IA
                            </h4>
                            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg border border-purple-100 dark:border-purple-800/30">
                              {os.motivos.map((msg, i) => (
                                <li key={i}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {os.recomendacao && (
                          <div>
                             <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center">
                              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                              Recomendação
                            </h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-100 dark:border-green-800/30">
                              {os.recomendacao}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right: Technical Info */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center">
                          <Wifi className="w-4 h-4 mr-2 text-blue-500" />
                          Dados de Conexão
                        </h4>
                        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                            <div>
                              <span className="text-xs text-gray-500 block">Tipo de Conexão</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                                {os.dados_tecnicos?.tipo_conexao || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500 block">Status PPPoE</span>
                              <div className="flex items-center space-x-1.5 mt-0.5">
                                <span className={cn(
                                  "w-2 h-2 rounded-full",
                                  os.dados_tecnicos?.online === 'Online' ? 'bg-green-500' : 'bg-red-500'
                                )} />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {os.dados_tecnicos?.online || 'Desconhecido'}
                                </span>
                              </div>
                            </div>
                            
                            {os.dados_tecnicos?.tipo_conexao === 'Fibra Óptica' ? (
                              <>
                                <div>
                                  <span className="text-xs text-gray-500 block">ONU Serial (SN)</span>
                                  <span className="text-sm font-mono text-gray-900 dark:text-white">{os.dados_tecnicos?.onu_mac || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 block">Último Sinal (IXC)</span>
                                  <span className="text-sm font-mono text-gray-900 dark:text-white">{os.dados_tecnicos?.sinal_onu || 'N/A'}</span>
                                </div>
                                <div className="col-span-2">
                                  <SignalMonitor sn={os.dados_tecnicos?.onu_mac} />
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <span className="text-xs text-gray-500 block">CPE MAC</span>
                                  <span className="text-sm font-mono text-gray-900 dark:text-white">{os.dados_tecnicos?.mac || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 block">Conexão AP</span>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">{os.dados_tecnicos?.conexao_ap || 'N/A'}</span>
                                </div>
                              </>
                            )}

                            <div>
                              <span className="text-xs text-gray-500 block">Login PPPoE</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white break-all">{os.dados_tecnicos?.login || 'N/A'}</span>
                            </div>
                            
                            <div>
                              <span className="text-xs text-gray-500 block">Endereço IP</span>
                              <span className="text-sm font-mono text-gray-900 dark:text-white">{os.dados_tecnicos?.ip || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}

            {displayedOs.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nenhuma O.S. nesta aba!</h3>
                <p className="text-gray-500 mt-1">Ótimo trabalho, fila vazia.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
