import { useEffect, useState } from 'react';
import { networkApi } from '../services/api';
import { ShieldAlert, Server, Activity, Laptop, Code, Copy, Check, Database, Download, UploadCloud } from 'lucide-react';
import { useAuth } from '../components/AuthContext';

export default function SystemSettings() {
  const [telemetryMode, setTelemetryMode] = useState<'CENTRAL' | 'MIKROTIK_SCRIPT' | 'EDGE_AGENT'>('CENTRAL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [companyId, setCompanyId] = useState('');
  
  // FTP State
  const [ftpHost, setFtpHost] = useState('');
  const [ftpPort, setFtpPort] = useState(21);
  const [ftpUser, setFtpUser] = useState('');
  const [ftpPass, setFtpPass] = useState('');

  const { company } = useAuth();
  
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await networkApi.getCompanySettings();
      setTelemetryMode(data.telemetryMode);
      setCompanyId(data.companyId);
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ftpData = {
        ftpHost: ftpHost || null,
        ftpPort: ftpPort || 21,
        ftpUser: ftpUser || null,
        ftpPass: ftpPass || null
      };
      await networkApi.updateCompanySettings(telemetryMode, ftpData);
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      alert('Erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const backendUrl = window.location.protocol + '//' + window.location.host + '/api/telemetry/push';
  const token = companyId;

  const mikrotikScript = [
    '# Script NetMonitor: Telemetria Edge (Webhook)',
    '# Rodar a cada 3 minutos via Scheduler',
    '',
    ':local targetUrl "' + backendUrl + '";',
    ':local authHeader "Authorization: Bearer ' + token + '";',
    ':local jsonPayload "[";',
    ':local first true;',
    '',
    '# Encontrar roteadores via ARP',
    ':foreach arpEntry in=[/ip arp find where dynamic=no] do={',
    '    :local devIp [/ip arp get $arpEntry address];',
    '    :local pingCount [/ping $devIp count=3 size=64 interval=200ms];',
    '    :local status "OFFLINE";',
    '    :local latency 0;',
    '    :if ($pingCount > 0) do={',
    '        :set status "ONLINE";',
    '        :set latency 5;',
    '    }',
    '    :if (!first) do={',
    '        :set jsonPayload ($jsonPayload . ",");',
    '    }',
    '    :set first false;',
    '    :set jsonPayload ($jsonPayload . "{\\"ip\\":\\"" . $devIp . "\\",\\"status\\":\\"" . $status . "\\",\\"latency\\":" . $latency . "}");',
    '}',
    '',
    ':set jsonPayload ($jsonPayload . "]");',
    '',
    ':do {',
    '    /tool fetch url=$targetUrl http-method=post http-header-field=("Content-Type: application/json", $authHeader) http-data=$jsonPayload as-value;',
    '    :log info "NetMonitor: Telemetrias enviadas com sucesso.";',
    '} on-error={',
    '    :log error "NetMonitor: Falha ao enviar telemetrias.";',
    '}',
  ].join('\n');

  const copyScript = () => {
    navigator.clipboard.writeText(mikrotikScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="p-8 text-white">Carregando configurações...</div>;
  }

  const modeCardClass = (mode: string, activeColor: string) => {
    const isActive = telemetryMode === mode;
    return [
      'relative p-5 rounded-xl border-2 cursor-pointer transition-all',
      isActive ? 'border-' + activeColor + '-500 bg-' + activeColor + '-50 dark:bg-' + activeColor + '-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-' + activeColor + '-300'
    ].join(' ');
  };

  const modeIconClass = (mode: string, activeColor: string) => {
    const isActive = telemetryMode === mode;
    return [
      'p-2 rounded-lg',
      isActive ? 'bg-' + activeColor + '-100 text-' + activeColor + '-600 dark:bg-' + activeColor + '-800 dark:text-' + activeColor + '-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700'
    ].join(' ');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-blue-500" />
            Configurações do Sistema
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Gerencie o comportamento do NetMonitor para sua empresa ({company?.name}).
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Server className="w-6 h-6 text-gray-400" />
            Método de Coleta de Telemetria (Latência/Disponibilidade)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Como sua empresa medirá o tempo de resposta (ping) dos equipamentos da rede interna.
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Opção 1: CENTRAL */}
            <div onClick={() => setTelemetryMode('CENTRAL')} className={modeCardClass('CENTRAL', 'blue')}>
              <div className="flex items-center gap-3 mb-2">
                <div className={modeIconClass('CENTRAL', 'blue')}>
                  <Server className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">Centralizada (Nuvem)</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                O servidor principal faz os pings através da Internet/VPN.
                <span className="block mt-2 text-xs font-semibold text-yellow-600 dark:text-yellow-400">Latência distorcida (não será o ping interno real).</span>
              </p>
            </div>

            {/* Opção 2: EDGE_AGENT */}
            <div onClick={() => setTelemetryMode('EDGE_AGENT')} className={modeCardClass('EDGE_AGENT', 'purple')}>
              <div className="flex items-center gap-3 mb-2">
                <div className={modeIconClass('EDGE_AGENT', 'purple')}>
                  <Laptop className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">Agente Local (Edge)</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Mini-PC rodando NetMonitorAgent na sua matriz.
                <span className="block mt-2 text-xs font-semibold text-green-600 dark:text-green-400">Ping local Real-time (a cada 10s) sem carga no MikroTik.</span>
              </p>
            </div>

            {/* Opção 3: MIKROTIK_SCRIPT */}
            <div onClick={() => setTelemetryMode('MIKROTIK_SCRIPT')} className={modeCardClass('MIKROTIK_SCRIPT', 'emerald')}>
              <div className="flex items-center gap-3 mb-2">
                <div className={modeIconClass('MIKROTIK_SCRIPT', 'emerald')}>
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">MikroTik Script</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Um script é colado no roteador principal para fazer a validação.
                <span className="block mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Zero custo (sem Mini-PC). Atualização a cada 3~5 min.</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {telemetryMode === 'MIKROTIK_SCRIPT' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-gray-400" />
              Script para RouterOS (Versões 6/7)
            </h3>
            <button
              onClick={copyScript}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors text-gray-700 dark:text-gray-300"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar Script'}
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {"Crie um System -> Scheduler no seu MikroTik principal para rodar este script a cada 3 minutos."}
          </p>
          <div className="relative">
            <pre className="p-4 bg-gray-900 text-gray-100 rounded-xl overflow-x-auto text-sm font-mono border border-gray-700">
              <code>{mikrotikScript}</code>
            </pre>
          </div>
        </div>
      )}

      {telemetryMode === 'EDGE_AGENT' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Laptop className="w-5 h-5 text-gray-400" />
            Implantação do Agente Local
          </h3>
          <div className="prose dark:prose-invert max-w-none text-sm">
            <p>O <strong>NetMonitor Agent</strong> é um executável leve que deve ser deixado ativo num computador na sua base.</p>
            <ol className="list-decimal pl-5 space-y-2 mt-4 text-gray-600 dark:text-gray-300">
              <li>Baixe o executável para Windows/Linux (disponível com o Administrador do Sistema).</li>
              <li>Crie um arquivo <code>.env</code> na mesma pasta do executável com o conteúdo abaixo.</li>
              <li>Execute o arquivo ou crie um serviço/tarefa agendada para mantê-lo rodando.</li>
            </ol>
            <pre className="mt-4 p-4 bg-gray-900 text-gray-100 rounded-xl overflow-x-auto font-mono text-xs border border-gray-700">
{[
  'API_BASE_URL=' + backendUrl.replace('/telemetry/push', ''),
  'COMPANY_TOKEN=' + companyId,
  'POLL_INTERVAL_MS=10000'
].join('\n')}
            </pre>
          </div>
        </div>
      )}

      {/* Seção de Backup de Sistema */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mt-8">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-500" />
            Backup e Segurança (Disaster Recovery)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gere um backup manual completo de toda a sua base de dados instantaneamente ou configure um espelhamento FTP.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 p-5 rounded-xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-500" />
                Backup Local
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Baixe o arquivo do banco de dados completo (.zip) para o seu computador. Use isso antes de atualizações ou para segurança local.
              </p>
              <button
                onClick={() => networkApi.triggerSystemBackup()}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex justify-center items-center gap-2"
              >
                <Database className="w-4 h-4" />
                BAIXAR BACKUP (ZIP)
              </button>
            </div>

            <div className="flex-1 w-full space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-slate-400" />
                Upload FTP Automático (Off-site)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Host FTP (ex: ftp.meusite.com)</label>
                  <input
                    type="text"
                    value={ftpHost}
                    onChange={(e) => setFtpHost(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white"
                    placeholder="Se vazio, desativa envio FTP"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário</label>
                  <input
                    type="text"
                    value={ftpUser}
                    onChange={(e) => setFtpUser(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha</label>
                  <input
                    type="password"
                    value={ftpPass}
                    onChange={(e) => setFtpPass(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white"
                    placeholder={ftpHost ? '•••• (oculta)' : ''}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Porta</label>
                  <input
                    type="number"
                    value={ftpPort}
                    onChange={(e) => setFtpPort(parseInt(e.target.value) || 21)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Se configurado, qualquer backup gerado (manual e agendado) será automaticamente espelhado sobresscrevendo o arquivo existente neste FTP, poupando espaço!
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
