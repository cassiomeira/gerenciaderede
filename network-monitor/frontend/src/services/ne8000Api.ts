import { apiGet } from './api';

export interface NE8000SystemInfo {
  uptime: string;
  cpu: number;
  cpuCores: { name: string; current: number; fiveSec: number; oneMin: number; fiveMin: number }[];
  memoryTotal: number;
  memoryUsed: number;
  memoryPercent: number;
  model: string;
  version: string;
}

export interface NE8000PppoeInfo {
  total: number;
  radius: number;
  local: number;
}

export interface NE8000Interface {
  name: string;
  description: string;
  phyStatus: string;
  protocol: string;
  inUtil: string;
  outUtil: string;
  inBps: number;
  outBps: number;
  inErrors: number;
  outErrors: number;
}

export interface NE8000BgpPeer {
  peer: string;
  description: string;
  as: number;
  version: number;
  state: string;
  prefixesReceived: number;
  uptime: string;
  msgRcvd: number;
  msgSent: number;
}

export interface NE8000DashboardData {
  system: NE8000SystemInfo;
  pppoe: NE8000PppoeInfo;
  topInterfaces: NE8000Interface[];
  totalTraffic: { inBps: number; outBps: number };
  bgpSummary: { total: number; established: number };
  lastCollect: string | null;
  lastError: string | null;
}

export interface TrafficPoint {
  time: number;
  inBps: number;
  outBps: number;
}

export const ne8000 = {
  getDashboard: (): Promise<NE8000DashboardData> => apiGet('/api/ne8000/dashboard'),
  getInterfaces: (): Promise<NE8000Interface[]> => apiGet('/api/ne8000/interfaces'),
  getInterfaceTraffic: (name: string, hours = 2): Promise<TrafficPoint[]> =>
    apiGet(`/api/ne8000/interfaces/${encodeURIComponent(name)}/traffic?hours=${hours}`),
  getBgpPeers: (): Promise<NE8000BgpPeer[]> => apiGet('/api/ne8000/bgp'),
  getSystem: (): Promise<NE8000SystemInfo> => apiGet('/api/ne8000/system'),
  getPppoe: (): Promise<NE8000PppoeInfo> => apiGet('/api/ne8000/pppoe'),
  getMainPorts: (): Promise<NE8000Interface[]> => apiGet('/api/ne8000/ports'),
};
