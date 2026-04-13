import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { ShieldAlert, Loader2, Eye, EyeOff, Building2, UserPlus } from 'lucide-react';

const API_BASE = window.location.port === '5173'
  ? `http://${window.location.hostname}:3001`
  : '';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Setup state
  const [needsSetup, setNeedsSetup] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupData, setSetupData] = useState({
    companyName: '', companySlug: '', userName: '', email: '', password: ''
  });
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/auth/check-setup`)
      .then(r => r.json())
      .then(data => {
        setNeedsSetup(true); // Sempre mostrar opção de cadastrar empresa
        if (data.needsSetup) setShowSetup(true); // Se vazio, já abre no setup
      })
      .catch(() => { setNeedsSetup(true); })
      .finally(() => setCheckingSetup(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await login(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar empresa');
      
      // Login automático com o token retornado
      localStorage.setItem('token', data.token);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSlug = (name: string) => {
    setSetupData(prev => ({
      ...prev,
      companyName: name,
      companySlug: name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    }));
  };

  if (checkingSetup) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600 rounded-full opacity-5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600 rounded-full opacity-5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-4">
            <ShieldAlert className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">NetMonitor</h1>
          <p className="text-gray-400 mt-1">Gerenciamento Centralizado de Rede</p>
        </div>

        {/* Card */}
        <div className="bg-gray-800/60 backdrop-blur-xl border border-gray-700/50 rounded-3xl shadow-2xl p-8">
          
          {/* Toggle entre Login e Setup */}
          {needsSetup && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setShowSetup(false)}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                  !showSetup 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-gray-700/50 text-gray-400 hover:text-white'
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setShowSetup(true)}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  showSetup 
                    ? 'bg-emerald-600 text-white shadow-lg' 
                    : 'bg-gray-700/50 text-gray-400 hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" /> Nova Empresa
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Formulário de Setup */}
          {showSetup ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" /> Setup Inicial
              </h2>
              <p className="text-gray-400 text-sm mb-5">Crie a primeira empresa e o administrador do sistema.</p>
              
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="p-3 bg-gray-700/30 rounded-xl space-y-3 border border-gray-600/30">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Empresa</p>
                  <input
                    value={setupData.companyName}
                    onChange={(e) => updateSlug(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-700/50 border border-gray-600/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
                    placeholder="Nome da Empresa (ex: Netcar Telecom)"
                    required
                  />
                  <input
                    value={setupData.companySlug}
                    onChange={(e) => setSetupData(prev => ({ ...prev, companySlug: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-700/50 border border-gray-600/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-mono transition-all"
                    placeholder="slug (ex: netcar-telecom)"
                    required
                  />
                </div>

                <div className="p-3 bg-gray-700/30 rounded-xl space-y-3 border border-gray-600/30">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Administrador</p>
                  <input
                    value={setupData.userName}
                    onChange={(e) => setSetupData(prev => ({ ...prev, userName: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-700/50 border border-gray-600/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
                    placeholder="Seu nome"
                    required
                  />
                  <input
                    type="email"
                    value={setupData.email}
                    onChange={(e) => setSetupData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-700/50 border border-gray-600/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
                    placeholder="Email do admin"
                    required
                  />
                  <input
                    type="password"
                    value={setupData.password}
                    onChange={(e) => setSetupData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-700/50 border border-gray-600/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
                    placeholder="Senha (mínimo 6 caracteres)"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Criando...</>
                  ) : (
                    <><Building2 className="w-5 h-5" /> Criar Empresa e Admin</>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Formulário de Login normal */
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Acessar sua conta</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-700/50 border border-gray-600/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    placeholder="seu@email.com"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Senha</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-700/50 border border-gray-600/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all pr-12"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Entrando...</>
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          NetMonitor &copy; {new Date().getFullYear()} — Sistema Multi-Empresa
        </p>
      </div>
    </div>
  );
}
