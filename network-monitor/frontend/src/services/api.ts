/**
 * Helper global para chamadas à API com autenticação automática.
 * Todas as pages devem usar este helper ao invés de `fetch` direto.
 */

// Em dev (porta 5173): chama localhost:3001 direto
// Em produção: usa URL relativa (nginx faz proxy /api → backend:3001)
const API_BASE = window.location.port === '5173'
  ? `http://${window.location.hostname}:3001`
  : '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

function getHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  // Suporte a bypass interno para robô de screenshot
  const urlParams = new URLSearchParams(window.location.search);
  const secret = urlParams.get('secret');
  if (secret === 'NETMONITOR_INTERNAL_BYPASS_2026') {
    headers['x-internal-secret'] = secret;
  }

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  
  const res = await fetch(url, {
    ...options,
    headers: getHeaders(options.headers as Record<string, string>),
  });

  if (res.status === 401) {
    // Se estivermos em modo screenshot (com secret), não redirecionamos
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('secret') === 'NETMONITOR_INTERNAL_BYPASS_2026') {
      throw new Error('Falha na autenticação interna do robô');
    }

    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  return res;
}

export function apiGet(path: string) {
  return apiFetch(path).then(async r => {
    if (!r.ok) {
      const errData = await r.json().catch(() => null);
      throw { response: { data: errData, status: r.status } };
    }
    return r.json();
  });
}

export function apiPost(path: string, body?: any) {
  return apiFetch(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => {
    if (!r.ok) {
      const errData = await r.json().catch(() => null);
      throw { response: { data: errData, status: r.status } };
    }
    return r.json();
  });
}

export function apiPut(path: string, body?: any) {
  return apiFetch(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => {
    if (!r.ok) {
      const errData = await r.json().catch(() => null);
      throw { response: { data: errData, status: r.status } };
    }
    return r.json();
  });
}

export function apiDelete(path: string) {
  return apiFetch(path, { method: 'DELETE' }).then(async r => {
    if (!r.ok) {
      const errData = await r.json().catch(() => null);
      throw { response: { data: errData, status: r.status } };
    }
    return r.json();
  });
}

export { API_BASE };

// Wrapper for backward compatibility with existing components like ClientDetails
export const networkApi = {
  getClientStatus: async (clientIdOrMac: string, bypassCache = false) => {
    return apiGet(`/api/client-status?q=${encodeURIComponent(clientIdOrMac)}&bypassCache=${bypassCache}`);
  },
  searchClients: async (q: string) => {
    return apiGet(`/api/clients/search?q=${encodeURIComponent(q)}`);
  },
  getBadSignals: async () => {
    return apiGet('/api/reports/bad-signals');
  },
  getTransmitters: async () => {
    return apiGet('/api/transmitters');
  },
  getStats: async () => {
    return apiGet('/api/stats');
  },
  getTelemetry: async (ip: string) => {
    return apiGet(`/api/telemetry/${ip}`);
  },
  getTelemetryHistory: async (ip: string) => {
    return apiGet(`/api/telemetry/${ip}/history`);
  },
  analyzeTelemetry: async (ip: string) => {
    return apiPost(`/api/telemetry/${ip}/analyze`);
  },
  updateCredentials: async (id: string, ip: string, user: string, pass: string, port: number, equipmentType?: string) => {
    return apiPost(`/api/transmitters/${id}/credentials`, { user, pass, port, ip, equipmentType });
  },
  collectTelemetry: async (ip: string) => {
    return apiPost(`/api/telemetry/${ip}/collect`);
  },
  triggerFullTelemetry: async () => {
    return apiPost('/api/trigger-telemetry');
  },
  triggerFullMacCache: async () => {
    return apiPost('/api/trigger-cache');
  },
  listBackups: async () => {
    return apiGet('/api/backups/list');
  },
  triggerBackup: async (force = false) => {
    return apiPost('/api/backups/trigger', { force });
  },
  getMaps: async () => {
    return apiGet('/api/maps');
  },
  getMap: async (id: string) => {
    return apiGet(`/api/maps/${id}`);
  },
  getScriptResults: async () => {
    return apiGet('/api/script-results');
  },
  getLatestScriptResults: async () => {
    return apiGet('/api/script-results/latest');
  },
  getCompanySettings: async () => {
    return apiGet('/api/company/settings');
  },
  updateCompanySettings: async (mode: 'CENTRAL' | 'MIKROTIK_SCRIPT' | 'EDGE_AGENT', ftpData?: any): Promise<void> => {
    try {
      await apiPost('/api/company/settings', { telemetryMode: mode, ftpData });
    } catch (error) {
      console.error('Update settings failed:', error);
      throw error;
    }
  },

  triggerSystemBackup: (): void => {
    const token = getToken(); // Use existing getToken function
    // Fazemos o download direto navegando para a URL com o token via query param ou fetch blob
    // A melhor forma de baixar um arquivo protegido por auth é via fetch e blob
    fetch(`${API_BASE}/api/system-backup`, { // Use API_BASE
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
      if (!response.ok) throw new Error('Falha no backup');
      return response.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_netmonitor.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch(error => {
      console.error('System backup falhou:', error);
      alert('Erro ao iniciar backup do sistema.');
    });
  }
};

export type Transmitter = {
  id: string;
  ip: string;
  descricao: string;
  status: 'ONLINE' | 'OFFLINE';
  latency?: number;
  mode?: string;
  equipmentType?: string;
  config?: {
    user?: string;
    port?: number;
    hasPass?: boolean;
    lastSshStatus?: 'SUCCESS' | 'FAILED' | 'PENDING' | 'NOT_CONFIGURED';
  };
};
