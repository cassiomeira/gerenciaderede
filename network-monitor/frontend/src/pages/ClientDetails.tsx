import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { networkApi } from '../services/api';
import { 
  ArrowLeft, 
  Wifi, 
  Activity, 
  Clock, 
  IdCard, 
  Radio, 
  AlertCircle, 
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  RefreshCcw
} from 'lucide-react';
import { clsx } from 'clsx';

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['clientStatus', id],
    queryFn: () => networkApi.getClientStatus(id!),
    enabled: !!id,
    refetchInterval: 10000, // Refresh every 10s
  });

  const handleManualRefresh = async () => {
    if (!id) return;
    setIsRefreshing(true);
    try {
      await networkApi.getClientStatus(id, true);
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium italic tracking-wide">Consultando IXC e Rádio...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para busca</span>
        </Link>
        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-start space-x-4">
          <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
          <div>
            <h3 className="text-red-900 font-bold text-lg">Erro na consulta</h3>
            <p className="text-red-700">{(error as any)?.response?.data?.error || 'Não foi possível carregar os dados deste cliente.'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { client, transmitter, radio, diagnosis } = data;

  return (
    <div className="p-8 max-w-6xl mx-auto pb-20">
      <Link to="/" className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Voltar para Dashboard</span>
      </Link>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Client & AP Info */}
        <div className="flex-1 space-y-8">
          <header className="mb-8">
            <div className="flex items-center space-x-3 mb-2">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Cliente Wireless
              </span>
              <span className={clsx(
                "text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider",
                client?.online === 'S' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                {client?.online === 'S' ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white italic">
                {client?.login || 'Não encontrado'}
              </h1>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className={clsx(
                  "flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  isRefreshing 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                    : "bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-95 shadow-sm"
                )}
                title="Sincronizar dados novamente do IXC"
              >
                <RefreshCcw className={clsx("w-4 h-4", isRefreshing && "animate-spin")} />
                <span>{isRefreshing ? 'Sincronizando...' : 'Atualizar IXC'}</span>
              </button>
            </div>
            <p className="text-gray-500 font-medium flex items-center">
              <IdCard className="w-4 h-4 mr-2" />
              MAC: {client?.mac || '--'} • IP: {client?.ip || '--'}
            </p>
          </header>

          {/* Grid for Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* IXC Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2 text-blue-500" /> IXC Soft
              </h3>
              <div className="space-y-3">
                <InfoItem label="Contrato" value={client?.id_contrato ? `#${client.id_contrato}` : undefined} />
                <InfoItem label="ID Cliente" value={client?.id_cliente ? `#${client.id_cliente}` : undefined} />
                <InfoItem label="IP" value={client?.ip} />
                <InfoItem label="Concentrador" value={client?.concentratorIp} />
                <InfoItem label="Plano" value={client?.planName} />
                <div className="flex justify-between items-center group">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Status Internet</span>
                  <span className={clsx(
                    "font-bold tracking-tight px-3 py-1 rounded-lg transition-colors",
                    (client?.contractStatus === 'A' || client?.contractStatus?.toLowerCase().includes('normal') || client?.contractStatus?.toLowerCase().includes('ativo') || client?.contractStatus === 'S')
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      : (client?.contractStatus === 'B' || client?.contractStatus?.toLowerCase().includes('bloq'))
                      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                  )}>
                    {client?.contractStatus === 'A' || client?.contractStatus === 'S' ? 'ATIVO / NORMAL' : 
                     client?.contractStatus === 'B' ? 'BLOQUEADO (Financeiro)' :
                     client?.contractStatus === 'I' ? 'INATIVO' :
                     client?.contractStatus === 'D' ? 'DESATIVADO' :
                     (client?.contractStatus || 'N/A')}
                  </span>
                </div>
              </div>
            </div>

            {/* Transmitter Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Radio className="w-5 h-5 mr-2 text-indigo-500" /> Transmissor (AP)
              </h3>
              <div className="space-y-3">
                <InfoItem label="Descrição" value={transmitter?.descricao} />
                <InfoItem label="IP AP" value={transmitter?.ip} />
                <InfoItem label="Tecnologia" value={transmitter?.tipo_equipamento} />
              </div>
            </div>
          </div>

          {/* Diagnosis Section */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <Activity className="w-6 h-6 mr-2 text-orange-500" /> Diagnóstico e Sugestões
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {(diagnosis || []).map((diag: any, i: number) => (
                <div key={i} className={clsx(
                  "p-5 rounded-2xl flex items-start space-x-4 border-2 shadow-sm transition-all duration-300",
                  diag.level === 'success' ? "bg-green-50/50 border-green-100 text-green-900" :
                  diag.level === 'warning' ? "bg-orange-50/50 border-orange-100 text-orange-900" :
                  "bg-red-50/50 border-red-100 text-red-900"
                )}>
                  {diag.level === 'success' ? <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" /> :
                   diag.level === 'warning' ? <AlertCircle className="w-6 h-6 text-orange-500 shrink-0" /> :
                   <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />}
                  <div>
                    <h4 className="font-bold mb-1 uppercase tracking-tight text-sm">Problema Detectado</h4>
                    <p className="text-lg mb-3 leading-snug">{diag.message}</p>
                    <div className="flex items-center mt-2 p-3 bg-white/50 rounded-xl border border-white/80">
                      <ChevronRight className="w-4 h-4 mr-2" />
                      <span className="font-semibold italic">Sugestão: {diag.suggestion}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Radio Metrics */}
        <div className="w-full lg:w-96 space-y-6">
          <div className="bg-gray-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-center text-center">
              <Wifi className="w-12 h-12 text-blue-400 mb-6 animate-pulse" />
              <h3 className="text-xl font-bold mb-8 uppercase tracking-[0.2em] text-blue-400/80">Rádio em Tempo Real</h3>
              
              <div className="grid grid-cols-2 gap-8 w-full mb-8">
                <MetricRing label="Sinal" value={`${radio?.signal ?? '--'} dBm`} color={getSignalColor(radio?.signal ?? -100)} />
                <MetricRing label="CCQ" value={`${radio?.ccq ?? '--'}%`} color={getCCQColor(radio?.ccq ?? 0)} />
              </div>

              <div className="w-full space-y-4 pt-6 border-t border-white/10">
                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                  <span className="text-gray-400 font-medium">Tx Rate</span>
                  <span className="font-bold text-blue-300">{radio?.txRate ?? '--'}</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                  <span className="text-gray-400 font-medium">Rx Rate</span>
                  <span className="font-bold text-blue-300">{radio?.rxRate ?? '--'}</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                   <div className="flex items-center text-gray-400 font-medium">
                     <Clock className="w-4 h-4 mr-2" />
                     <span>Uptime</span>
                   </div>
                  <span className="font-bold text-green-300">{radio?.uptime ?? '--'}</span>
                </div>
              </div>
            </div>
            {/* Glow efekt */}
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-30"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex justify-between items-center group">
      <span className="text-gray-500 dark:text-gray-400 font-medium">{label}</span>
      <span className="text-gray-900 dark:text-white font-bold tracking-tight bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
        {value || 'N/A'}
      </span>
    </div>
  );
}

function MetricRing({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`text-3xl font-black mb-1 ${color} tracking-tighter`}>{value}</div>
      <div className="text-[10px] uppercase font-bold tracking-[0.3em] text-gray-500">{label}</div>
    </div>
  );
}

function getSignalColor(signal: number) {
  if (signal >= -60) return 'text-green-400';
  if (signal >= -70) return 'text-orange-400';
  return 'text-red-400';
}

function getCCQColor(ccq: number) {
  if (ccq >= 90) return 'text-green-400';
  if (ccq >= 80) return 'text-orange-400';
  return 'text-red-400';
}
