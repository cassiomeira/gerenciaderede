import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { 
  MessageSquare, Settings, Bell, Shield, Key, 
  RefreshCw, CheckCircle2, AlertTriangle, 
  ExternalLink, Loader2, Save, Send, Zap,
  Bot, Hash, WifiOff
} from 'lucide-react';
import { apiFetch } from '../services/api';

const API = '/api';

export default function AlertSettings() {
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => apiFetch(`${API}/whatsapp/status`).then(r => r.json()),
    refetchInterval: 5000
  });

  const { data: qr } = useQuery({
    queryKey: ['whatsapp-qr'],
    queryFn: () => apiFetch(`${API}/whatsapp/qr`).then(r => r.json()),
    enabled: status?.status === 'DISCONNECTED',
    refetchInterval: 5000
  });

  // Telegram Status
  const { data: telegramStatus, isLoading: telegramLoading } = useQuery({
    queryKey: ['telegram-status'],
    queryFn: () => apiFetch(`${API}/telegram/status`).then(r => r.json()),
    refetchInterval: 5000
  });

  useEffect(() => {
    if (status?.groupId) {
      setGroupId(status.groupId);
    }
  }, [status]);

  useEffect(() => {
    if (telegramStatus?.chatId) {
      setTelegramChatId(telegramStatus.chatId);
    }
  }, [telegramStatus]);

  const saveGroupMutation = useMutation({
    mutationFn: (newId: string) => 
      apiFetch(`${API}/whatsapp/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: newId })
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      alert('Configuração WhatsApp salva com sucesso!');
    }
  });

  const saveTelegramMutation = useMutation({
    mutationFn: (chatId: string) => 
      apiFetch(`${API}/telegram/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-status'] });
      alert('Configuração Telegram salva com sucesso!');
    }
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="bg-blue-600/20 p-2.5 rounded-2xl">
              <Bell className="w-8 h-8 text-blue-400" />
            </div>
            Configurações de Alertas
          </h1>
          <p className="text-slate-400 mt-2 font-medium">Gerencie notificações via WhatsApp e Telegram</p>
        </div>
      </div>

      {/* ============ TELEGRAM SECTION ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Telegram Connection Card */}
        <section className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 backdrop-blur-md shadow-2xl flex flex-col items-center text-center">
          <div className="mb-6 relative">
            <div className={`p-5 rounded-3xl ${telegramStatus?.polling ? 'bg-sky-500/20 text-sky-400' : 'bg-orange-500/20 text-orange-400'}`}>
              <Bot className="w-12 h-12" />
            </div>
            {telegramStatus?.polling && (
              <div className="absolute -bottom-1 -right-1 bg-sky-500 w-5 h-5 rounded-full border-4 border-slate-800 animate-pulse" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Telegram Bot</h2>
          <p className="text-slate-400 text-sm mb-6 px-4">
            {telegramStatus?.polling
              ? `Bot "${telegramStatus.botName}" está ativo e recebendo comandos.`
              : 'Configure o token do bot e o chat ID para ativar alertas via Telegram.'}
          </p>

          {telegramStatus?.polling ? (
            <div className="h-[200px] w-full flex flex-col items-center justify-center gap-6 bg-sky-500/5 rounded-[2rem] border border-sky-500/20">
              <CheckCircle2 className="w-16 h-16 text-sky-400/80" />
              <div className="text-center">
                <span className="text-sky-400 font-bold bg-sky-400/10 px-6 py-2 rounded-full border border-sky-400/20 block">
                  BOT ATIVO
                </span>
                {telegramStatus?.botName && (
                  <p className="text-slate-500 text-xs mt-3 font-medium">@{telegramStatus.botName}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-[200px] w-full flex flex-col items-center justify-center gap-4 bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-700">
              <WifiOff className="w-8 h-8 text-orange-500/60" />
              <span className="text-slate-500 text-sm font-medium">Bot não configurado</span>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            <RefreshCw className={`w-3 h-3 ${telegramLoading ? 'animate-spin text-sky-400' : ''}`} />
            Atualizado a cada 5s
          </div>

          {/* Comandos disponíveis */}
          <div className="mt-6 w-full text-left bg-slate-900/60 rounded-2xl p-5 border border-slate-700/30">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Comandos do Bot</h3>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2"><code className="bg-slate-800 px-2 py-0.5 rounded text-sky-400">/id</code> Mostra o ID do chat</div>
              <div className="flex items-center gap-2"><code className="bg-slate-800 px-2 py-0.5 rounded text-sky-400">/setgroup</code> Define chat de alertas</div>
              <div className="flex items-center gap-2"><code className="bg-slate-800 px-2 py-0.5 rounded text-sky-400">/status</code> Status dos dispositivos</div>
              <div className="flex items-center gap-2"><code className="bg-slate-800 px-2 py-0.5 rounded text-sky-400">/recon</code> Reconhece uma queda</div>
              <div className="flex items-center gap-2"><code className="bg-slate-800 px-2 py-0.5 rounded text-sky-400">/help</code> Lista de comandos</div>
            </div>
          </div>
        </section>

        {/* Telegram Configuration */}
        <section className="space-y-8">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-sky-600/20 p-3 rounded-2xl">
                <Hash className="w-6 h-6 text-sky-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Configuração do Telegram</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Chat ID de Destino</label>
                <div className="relative group">
                  <input 
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="Ex: -1001234567890 (use /id no bot para descobrir)"
                    className="w-full bg-slate-900/80 border border-slate-700/50 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 transition-all font-mono"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
                    <Key className="w-5 h-5 text-sky-400" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500 flex items-start gap-2 px-1">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-orange-400/50 shrink-0" />
                  Envie <strong>/id</strong> no chat do bot para descobrir o Chat ID. Para grupos, adicione o bot ao grupo primeiro.
                </p>
              </div>

              <button 
                onClick={() => saveTelegramMutation.mutate(telegramChatId)}
                disabled={saveTelegramMutation.isPending}
                className="w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-sky-900/20 group"
              >
                {saveTelegramMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                Salvar Chat ID
              </button>

              {telegramStatus?.configured && (
                <button 
                  onClick={() => {
                    apiFetch(`${API}/telegram/test`, { method: 'POST' })
                      .then(r => r.json())
                      .then(d => d.success ? alert('Mensagem de teste Telegram enviada!') : alert('Erro: ' + (d.error || 'Chat ID não configurado')));
                  }}
                  className="w-full bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-300 font-bold py-3 rounded-2xl flex items-center justify-center gap-3 transition-all mt-4"
                >
                  <Send className="w-4 h-4 text-sky-400" />
                  Enviar Mensagem de Teste (Telegram)
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-slate-700/50"></div>
        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">WhatsApp</span>
        <div className="flex-1 h-px bg-slate-700/50"></div>
      </div>

      {/* ============ WHATSAPP SECTION ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* WhatsApp Connection Card */}
        <section className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 backdrop-blur-md shadow-2xl flex flex-col items-center text-center">
          <div className="mb-6 relative">
            <div className={`p-5 rounded-3xl ${status?.connected ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
              <MessageSquare className="w-12 h-12" />
            </div>
            {status?.connected && (
              <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-slate-800 animate-pulse" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Conexão WhatsApp</h2>
          <p className="text-slate-400 text-sm mb-8 px-4">
            {status?.connected 
              ? 'Seu sistema está conectado e pronto para enviar alertas em tempo real.'
              : 'Escaneie o QR Code abaixo com seu WhatsApp para ativar as notificações.'}
          </p>

          {!status?.connected && qr?.qr ? (
            <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-blue-500/10 border-4 border-slate-700/50 mb-6">
              <QRCodeSVG value={qr.qr} size={220} level="H" includeMargin={true} />
              <p className="text-slate-900 text-[10px] font-bold mt-4 uppercase tracking-widest opacity-40 italic">Aguardando Leitura...</p>
            </div>
          ) : !status?.connected ? (
            <div className="h-[280px] w-full flex flex-col items-center justify-center gap-4 bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-700">
               <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
               <span className="text-slate-500 text-sm font-medium">Gerando QR Code...</span>
            </div>
          ) : (
             <div className="h-[280px] w-full flex flex-col items-center justify-center gap-6 bg-green-500/5 rounded-[2rem] border border-green-500/20">
                <CheckCircle2 className="w-16 h-16 text-green-400/80" />
                <span className="text-green-400 font-bold bg-green-400/10 px-6 py-2 rounded-full border border-green-400/20">SISTEMA CONECTADO</span>
             </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            <RefreshCw className={`w-3 h-3 ${statusLoading ? 'animate-spin text-blue-400' : ''}`} />
            Atualizado a cada 5s
          </div>
        </section>

        {/* Group & AI Configuration Card */}
        <section className="space-y-8">
          
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-purple-600/20 p-3 rounded-2xl">
                <Settings className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Configuração do Grupo</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">ID do Grupo de Alertas</label>
                <div className="relative group">
                  <input 
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    placeholder="Ex: 1203630248596@g.us"
                    className="w-full bg-slate-900/80 border border-slate-700/50 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
                    <Key className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500 flex items-start gap-2 px-1">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-orange-400/50 shrink-0" />
                  Certifique-se de usar o ID interno do grupo (geralmente termina em @g.us).
                </p>
              </div>

              <button 
                onClick={() => saveGroupMutation.mutate(groupId)}
                disabled={saveGroupMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-900/20 group"
              >
                {saveGroupMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                Salvar Configurações
              </button>

              {status?.connected && (
                <button 
                  onClick={() => {
                    apiFetch(`${API}/whatsapp/test`, { method: 'POST' })
                      .then(r => r.json())
                      .then(d => d.success ? alert('Mensagem de teste enviada!') : alert('Erro: ' + d.error));
                  }}
                  className="w-full bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-300 font-bold py-3 rounded-2xl flex items-center justify-center gap-3 transition-all mt-4"
                >
                  <Send className="w-4 h-4 text-blue-400" />
                  Enviar Mensagem de Teste
                </button>
              )}
            </div>
          </div>

          {/* AI Info Card */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full group-hover:bg-blue-500/10 transition-colors" />
            
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-emerald-600/20 p-3 rounded-2xl">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Inteligência Artificial (Opcional)</h2>
            </div>

            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              A análise via <strong className="text-slate-200">GPT-4o</strong> não é mais automática para economizar seus créditos. Você pode solicitar uma análise manual clicando no botão de IA dentro do painel de diagnóstico de cada equipamento.
            </p>

            <div className="flex items-center p-4 bg-slate-900/60 rounded-2xl border border-slate-700/30">
               <Zap className="w-5 h-5 text-orange-400 mr-3 shrink-0" />
               <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modelo: GPT-4 Omni (Sob Demanda)</span>
            </div>
          </div>

        </section>
      </div>

      <div className="bg-blue-600/5 border border-blue-500/10 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
              <div className="bg-blue-500/20 p-2 rounded-xl">
                 <Send className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-slate-300 text-sm font-medium">Os alertas são enviados simultaneamente via WhatsApp e Telegram com captura do mapa em 4K.</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://t.me/Netcartelecom_bot" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors">
                ABRIR TELEGRAM BOT <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a href="https://web.whatsapp.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                ABRIR WHATSAPP WEB <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
      </div>
    </div>
  );
}
