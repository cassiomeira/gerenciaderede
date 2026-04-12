import axios from 'axios';
import ping from 'ping';
import dotenv from 'dotenv';
import fs from 'fs';
import { TunnelClient } from './tunnelClient.js';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const COMPANY_TOKEN = process.env.COMPANY_TOKEN || '';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '10000', 10);
const LOCAL_CSV_PATH = process.env.LOCAL_CSV_PATH || '';

interface Device {
  ip: string;
  name?: string;
}

let devicesToMonitor: Device[] = [];

async function fetchDevices(): Promise<void> {
  // Se houver um CSV local configurado, usa ele em vez de baixar da nuvem
  if (LOCAL_CSV_PATH && fs.existsSync(LOCAL_CSV_PATH)) {
    console.log(`[EDGE] Lendo lista de dispositivos do arquivo local: ${LOCAL_CSV_PATH}`);
    const content = fs.readFileSync(LOCAL_CSV_PATH, 'utf-8');
    devicesToMonitor = content.split('\\n')
      .slice(1) // Ignorar cabeçalho
      .map((line): Device | null => {
        const parts = line.split(',');
        if (parts.length >= 2) {
          return { name: parts[0].trim(), ip: parts[1].trim() };
        }
        return null;
      })
      .filter((d): d is Device => d !== null && !!d.ip && d.ip.includes('.'));
    return;
  }

  // Senão, busca do backend
  try {
    console.log(`[EDGE] Buscando lista de dispositivos da nuvem (${API_BASE_URL})...`);
    const res = await axios.get(`${API_BASE_URL}/edge/devices`, {
      headers: { 
        'x-internal-secret': 'NETMONITOR_INTERNAL_BYPASS_2026',
        'x-company-id': COMPANY_TOKEN
      }
    });
    
    if (Array.isArray(res.data)) {
      devicesToMonitor = res.data;
      console.log(`[EDGE] Atualizado: ${devicesToMonitor.length} dispositivos para monitorar.`);
    }
  } catch (error: any) {
    console.error(`[EDGE ERROR] Falha ao buscar lista de dispositivos: ${error.message}`);
  }
}

async function runPingSweep() {
  if (devicesToMonitor.length === 0) {
    console.log('[EDGE] Nenhum dispositivo na lista para fazer ping.');
    return;
  }

  console.log(`[EDGE] Iniciando varredura de ping em ${devicesToMonitor.length} dispositivos (em Lotes)...`);
  
  const results: any[] = [];
  const chunkSize = 20; // Tamanho do lote de pings simultâneos para não travar o Event Loop da Máfina (e do Winbox)

  for (let i = 0; i < devicesToMonitor.length; i += chunkSize) {
    const chunk = devicesToMonitor.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(async (device) => {
      try {
        const res = await ping.promise.probe(device.ip, { timeout: 2 });
        const latencyVal = typeof res.time === 'number' ? Math.round(res.time) : (String(res.time) !== 'unknown' ? Math.round(Number(res.time)) : 0);
        return {
          ip: device.ip,
          name: device.name,
          latency: latencyVal,
          status: res.alive ? 'ONLINE' : 'OFFLINE',
          online: res.alive
        };
      } catch (err) {
        return {
          ip: device.ip,
          name: device.name,
          latency: 0,
          status: 'OFFLINE',
          online: false
        };
      }
    });

    // Espera esse lote terminar, e dá um pequeno respiro no processador para o túnel do Winbox respirar
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
    
    // Tiny delay de 10ms a cada lote para o Event Loop enviar os pacotes do Winbox TCP
    await new Promise(r => setTimeout(r, 10));
  }

  const onlineCount = results.filter(r => r.online).length;
  console.log(`[EDGE] Varredura concluída. ${onlineCount}/${results.length} Online. Enviando para nuvem...`);

  try {
    await axios.post(`${API_BASE_URL}/telemetry/push`, results, {
      headers: { 
        'x-internal-secret': 'NETMONITOR_INTERNAL_BYPASS_2026',
        'x-company-id': COMPANY_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    console.log(`[EDGE] Dados enviados com sucesso!`);
  } catch (error: any) {
    console.error(`[EDGE ERROR] Falha ao enviar telemetria: ${error.message}`);
  }
}

async function start() {
  console.log('================================================');
  console.log(`🚀 NetMonitor Edge Agent Iniciado`);
  console.log(`📡 URL da Nuvem: ${API_BASE_URL}`);
  console.log(`⏱️ Intervalo: ${POLL_INTERVAL_MS}ms`);
  console.log('================================================');

  if (!COMPANY_TOKEN) {
    console.error('[EDGE FATAL] COMPANY_TOKEN não configurado no .env!');
    process.exit(1);
  }

  // Inicializar Cliente do Túnel Reverso (Winbox)
  const tunnel = new TunnelClient(API_BASE_URL, 'NETMONITOR_INTERNAL_BYPASS_2026', COMPANY_TOKEN);
  tunnel.connect();

  // Primeira carga
  await fetchDevices();
  await runPingSweep();

  // Agendar Fetch da lista (a cada 10 minutos)
  setInterval(() => fetchDevices(), 10 * 60 * 1000);

  // Agendar Ping Sweep (a cada 10-30s configurado)
  setInterval(() => runPingSweep(), POLL_INTERVAL_MS);
}

start();
