import { useState, useEffect } from 'react';
import { Cloud, CheckCircle, AlertCircle, RefreshCw, HardDrive, Share2 } from 'lucide-react';
import { clsx } from 'clsx';
import { networkApi } from '../services/api';

interface BackupFile {
  name: string;
  size: number;
  date: string;
  isUploaded: boolean;
}

export default function BackupManager() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [folderId, setFolderId] = useState(localStorage.getItem('google_drive_folder_id') || '');
  const [loading, setLoading] = useState(true);

  const fetchBackups = async () => {
    try {
      const data = await networkApi.listBackups();
      setBackups(data);
    } catch (err) {
      console.error('Erro ao buscar backups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
    const interval = setInterval(fetchBackups, 10000); // Atualiza a cada 10s
    return () => clearInterval(interval);
  }, []);

  const [statusMsg, setStatusMsg] = useState('');

  const handleSaveFolder = () => {
    localStorage.setItem('google_drive_folder_id', folderId);
    alert('ID da Pasta salvo com sucesso!');
  };

  const handleTriggerBackup = async () => {
    try {
      setIsBackingUp(true);
      setStatusMsg('Conectando ao servidor...');
      
      const data = await networkApi.triggerBackup(false);
      setStatusMsg(`✅ ${data.message} Atualizando a cada 10 segundos...`);
    } catch (err: any) {
      if (err.status === 409) {
        setStatusMsg('⚠️ Um backup já está em andamento. Aguarde...');
      } else {
        setStatusMsg(`❌ Erro: ${err.message || 'Falha ao processar'}`);
      }
    } finally {
      setIsBackingUp(false);
      fetchBackups();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Cloud className="text-blue-400" /> Backups em Nuvem
          </h1>
          <p className="text-slate-400">MikroTik → Google Drive (2TB)</p>
        </div>
        
        <button
          onClick={handleTriggerBackup}
          disabled={isBackingUp}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
            isBackingUp 
              ? "bg-slate-700 text-slate-400 cursor-not-allowed" 
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
          )}
        >
          {isBackingUp ? <RefreshCw className="animate-spin" size={20} /> : <Share2 size={20} />}
          {isBackingUp ? 'Processando...' : 'Iniciar Backup Agora'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <HardDrive size={20} className="text-slate-400" /> Configuração Drive
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">ID da Pasta Google Drive</label>
                <input
                  type="text"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  placeholder="Ex: 1b2C3d4E5f6G..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">O ID fica na URL da pasta no navegador.</p>
              </div>
              <button
                onClick={handleSaveFolder}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded-lg transition-colors"
              >
                Salvar Configuração
              </button>
            </div>
          </div>

          <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-800/50">
            <h3 className="text-blue-200 font-medium flex items-center gap-2 mb-2">
              <AlertCircle size={18} /> Importante
            </h3>
            <p className="text-sm text-blue-300/80 leading-relaxed">
              Certifique-se de que o arquivo <code>google-credentials.json</code> está na pasta <code>backend/</code> e que a pasta do Drive foi compartilhada com o e-mail da conta de serviço.
            </p>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex items-center justify-between">
              <h2 className="font-semibold text-slate-200">Arquivos Recentes</h2>
              <span className="text-xs text-slate-500">{backups.length} arquivos locais</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3">Arquivo</th>
                    <th className="px-6 py-3">Tamanho</th>
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3 text-center">Status Cloud</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Carregando...</td>
                    </tr>
                  ) : backups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Nenhum backup encontrado.</td>
                    </tr>
                  ) : backups.map((file) => (
                    <tr key={file.name} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-slate-200 font-medium font-mono text-sm">{file.name}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {(file.size / 1024).toFixed(1)} KB
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {new Date(file.date).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          {file.isUploaded ? (
                            <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold bg-emerald-400/10 px-2 py-1 rounded-full">
                              <CheckCircle size={14} /> Sincronizado
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold bg-slate-400/10 px-2 py-1 rounded-full">
                              <RefreshCw size={14} /> Local
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
