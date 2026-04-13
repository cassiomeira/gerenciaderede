import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const API = window.location.port === '5173'
  ? `http://${window.location.hostname}:3001`
  : '';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  company: Company | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  // Verificar token ao carregar
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) throw new Error('Token inválido');
        return r.json();
      })
      .then(data => {
        setUser(data.user);
        setCompany(data.company);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setCompany(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await r.json();

      if (!r.ok) {
        return data.error || 'Erro ao fazer login';
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setCompany(data.company);
      return null;
    } catch {
      return 'Erro de conexão com o servidor';
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setCompany(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, company, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

/**
 * Helper para fazer fetch autenticado (inclui Bearer token automaticamente)
 */
export function useAuthFetch() {
  const { token, logout } = useAuth();

  return async (url: string, options: RequestInit = {}) => {
    const headers: any = {
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && typeof options.body === 'string') {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      logout();
      throw new Error('Sessão expirada');
    }

    return res;
  };
}
