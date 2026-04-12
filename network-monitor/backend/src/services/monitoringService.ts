import { radioService } from './radioService.js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { prisma } from '../db.js';
import { masterPrisma } from '../masterDb.js';
import cron from 'node-cron';
import { runFullBackupProcess } from '../controllers/backupController.js';

dotenv.config();

const CSV_PATH = process.env.CSV_PATH || '';

interface DeviceStatus {
  name: string;
  ip: string;
  mac?: string; // MAC do rádio (obtido via SSH)
  online: boolean;
  mode: 'AP' | 'STATION' | 'UNKNOWN';
  latency: number;
  lastCheck: Date;
}

interface MacCacheEntry {
  apName: string;
  apIp: string;
  signal: number;
  ccq: number;
  lastSeen: Date;
}

let networkInventory: DeviceStatus[] = [];
let macToApMap: Map<string, MacCacheEntry> = new Map();
let sshSuccessCount = 0;
let sshErrorCount = 0;
let isMacPollingRunning = false;

// IPs que foram atualizados pelo Edge Agent recentemente (não devem ser sobrescritos pelo ping local)
let pushedIps: Map<string, Date> = new Map();
const PUSH_FRESHNESS_MS = 120_000; // 2 minutos - se recebeu push nos últimos 2 min, não pinga localmente

export const monitoringService = {
  startPolling() {
    console.log('Iniciando Polling de Monitoramento (Intervalo: 5min)');
    this.refreshInventory();
    setInterval(() => this.refreshInventory(), 300000); // 5 minutos

    console.log('Iniciando Worker de Cache de MACs (Intervalo: 15min)');
    // Pequeno atraso para o primeiro inventário carregar
    setTimeout(() => this.refreshMacCache(), 10000); 
    setInterval(() => this.refreshMacCache(), 900000); // 15 minutos

    // Agendamento de Backup Automático (Diário às 03:00)
    console.log('Agendando Backup Automático para as 03:00');
    cron.schedule('0 3 * * *', () => {
      console.log('[CRON] Iniciando backup automático agendado...');
      runFullBackupProcess();
    });
  },

  async refreshInventory() {
    try {
      if (!fs.existsSync(CSV_PATH)) return;
      
      const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
      const records = parse(fileContent, { 
        columns: true, 
        skip_empty_lines: true,
        trim: true
      });
      
      const devices = records
        .map((r: any) => {
          // Tenta encontrar colunas mesmo com problemas de encoding ou nomes diferentes
          const ip = r['Endereço IP'] || r['Endereco IP'] || r['IP Address'] || r['IP'] || Object.values(r)[1];
          const name = r['Nome do Dispositivo'] || r['Nome'] || r['Device Name'] || Object.values(r)[0];
          
          return {
            name: (name || 'Sem Nome').toString().trim(),
            ip: (ip || '').toString().trim()
          };
        })
        .filter((d: any) => d.ip && d.ip !== '0.0.0.0' && d.ip !== 'IP' && d.ip.includes('.'));

      if (devices.length === 0) {
        console.warn(`[WARNING] Nenhum dispositivo válido encontrado no CSV: ${CSV_PATH}`);
        return;
      }

      // Criar um mapa rápido do inventário atual para preservar estados conhecidos
      const currentStatusMap = new Map(networkInventory.map(d => [d.ip, d]));

      // Atualizar a lista baseada no CSV, mas preservando o status anterior se o IP for o mesmo
      const baseInventory = devices.map((d: any) => {
        const existing = currentStatusMap.get(d.ip);
        return {
          name: d.name,
          ip: d.ip,
          online: existing ? existing.online : false,
          mode: existing ? existing.mode : 'UNKNOWN',
          latency: existing ? existing.latency : 0,
          lastCheck: existing ? existing.lastCheck : new Date()
        };
      });

      // ─── ADICIONAR DISPOSITIVOS QUE ESTÃO NOS MAPAS MAS NÃO NO CSV ─────
      const mapNodes = await prisma.mapNode.findMany({
        where: { apIp: { not: null } },
        select: { apIp: true, label: true }
      });
      
      const csvIps = new Set(baseInventory.map(d => d.ip));
      const mapInventoryAdds: DeviceStatus[] = [];
      
      mapNodes.forEach(mn => {
        if (mn.apIp && !csvIps.has(mn.apIp)) {
          const existing = currentStatusMap.get(mn.apIp);
          mapInventoryAdds.push({
            name: mn.label || `MapNode-${mn.apIp}`,
            ip: mn.apIp,
            online: existing ? existing.online : false,
            mode: existing ? existing.mode : 'UNKNOWN',
            latency: existing ? existing.latency : 0,
            lastCheck: existing ? existing.lastCheck : new Date()
          });
          csvIps.add(mn.apIp); // Evita duplicados se o mesmo IP estiver em vários mapas
        }
      });

      networkInventory = [...baseInventory, ...mapInventoryAdds];

      // Verificar modo de telemetria da empresa (se não for CENTRAL, pula o Ping centralizado)
      const company: any = await masterPrisma.company.findFirst({
        where: { csvPath: CSV_PATH }
      });

      if (company && company.telemetryMode !== 'CENTRAL') {
        console.log(`[POLLING] Empresa (ID: ${company.id}) está em modo de telemetria Híbrida/Edge (${company.telemetryMode}). Ignorando ping central.`);
        return;
      }

      // Filtrar IPs que o Edge Agent já está monitorando (evita sobrescrever dados frescos com ping local que falha)
      const now = Date.now();
      const devicesToPing = networkInventory.filter(d => {
        const lastPush = pushedIps.get(d.ip);
        if (lastPush && (now - lastPush.getTime()) < PUSH_FRESHNESS_MS) {
          return false; // Edge Agent mandou dados recentes, pula ping local
        }
        return true;
      });

      const skipped = networkInventory.length - devicesToPing.length;
      if (skipped > 0) {
        console.log(`[POLLING] Pulando ping local de ${skipped} dispositivos (dados recentes do Edge Agent).`);
      }

      const BATCH_SIZE_PING = 25; 
      for (let i = 0; i < devicesToPing.length; i += BATCH_SIZE_PING) {
        const batch = devicesToPing.slice(i, i + BATCH_SIZE_PING);
        await Promise.all(batch.map(async (d) => {
          const pingRes = await radioService.checkPing(d.ip);
          // Encontrar o índice REAL no networkInventory pelo IP
          const realIdx = networkInventory.findIndex(inv => inv.ip === d.ip);
          if (realIdx !== -1) {
            const prevOnline = networkInventory[realIdx].online;
            networkInventory[realIdx].online = pingRes.alive;
            networkInventory[realIdx].latency = pingRes.latency;
            networkInventory[realIdx].lastCheck = new Date();

            if (prevOnline !== pingRes.alive) {
              prisma.accessPoint.updateMany({
                where: { ip: d.ip },
                data: { status: pingRes.alive ? 'ONLINE' : 'OFFLINE' }
              }).catch(() => {});
            }
          }
        }));
        console.log(`[DEBUG] Inventário: ${Math.min(i + BATCH_SIZE_PING, devicesToPing.length)}/${devicesToPing.length} dispositivos pingados...`);
        await new Promise(r => setTimeout(r, 300));
      }
      console.log(`[POLLING] ${networkInventory.length} dispositivos verificados. Online: ${networkInventory.filter(d => d.online).length}`);
    } catch (error) {
      console.error('Erro no Polling:', error);
    }
  },

  async refreshMacCache(): Promise<boolean> {
    if (isMacPollingRunning) return false;
    isMacPollingRunning = true;
    const logFile = 'c:/aplicativos/gerenciaderede1/gerenciaderede/gerenciaderede/gerenciaderede/network-monitor/backend/mac_poll.log';
    fs.appendFileSync(logFile, `\n[${new Date().toISOString()}] Iniciando varredura global...\n`);
    
    const onlineAPs = networkInventory.filter(d => d.online && d.ip !== '0.0.0.0');
    console.log(`[DEBUG] APs Online para varredura: ${onlineAPs.length} de ${networkInventory.length} totais`);
    fs.appendFileSync(logFile, `[CACHE] APs Online encontrados: ${onlineAPs.length}\n`);
    
    if (onlineAPs.length === 0) {
      console.log(`[DEBUG] Nenhum AP online encontrado no inventário.`);
      isMacPollingRunning = false;
      return true; // Retornamos true porque tentou, mas nao tinha nada
    }

    let successes = 0;
    let errors = 0;

    const BATCH_SIZE_MAC = 10; 
    for (let i = 0; i < onlineAPs.length; i += BATCH_SIZE_MAC) {
      const batch = onlineAPs.slice(i, i + BATCH_SIZE_MAC);
      await Promise.all(batch.map(async (ap) => {
        try {
          // Coleta o modo e o MAC do próprio AP para identificar PtP depois
          const radioInfo = await radioService.getWirelessMode(ap.ip);
          
          // Encontrar o índice no inventário global para atualizar os dados do AP
          const invIdx = networkInventory.findIndex(d => d.ip === ap.ip);
          if (invIdx !== -1) {
            networkInventory[invIdx].mode = radioInfo.mode;
            if (radioInfo.mac) {
              networkInventory[invIdx].mac = radioInfo.mac;
            }
          }

          const clients = await radioService.getAllConnectedMacs(ap.ip);
          if (clients.length >= 0) { // Consideramos sucesso mesmo se retornar 0 clientes (o rádio respondeu)
            successes++;
            // Registrar ou atualizar o sucesso no banco de dados
            await prisma.accessPoint.upsert({
              where: { ip: ap.ip },
              update: { 
                lastSshStatus: 'SUCCESS',
                wirelessMode: radioInfo.mode
              },
              create: { 
                ip: ap.ip, 
                description: ap.name, 
                lastSshStatus: 'SUCCESS',
                wirelessMode: radioInfo.mode
              }
            }).catch((err) => {
              fs.appendFileSync(logFile, `Erro ao salvar no banco (IP ${ap.ip}): ${err.message}\n`);
            });

            clients.forEach(c => {
               const mac = c.mac.toUpperCase();
               const entry = {
                 apName: ap.name,
                 apIp: ap.ip,
                 signal: c.signal,
                 ccq: c.ccq,
                 lastSeen: new Date()
               };
               macToApMap.set(mac, entry);
            });
            console.log(`[CACHE] AP ${ap.ip} (${ap.name}): ${clients.length} clientes encontrados.`);
          } else {
            errors++;
          }
        } catch (e: any) {
          errors++;
          fs.appendFileSync(logFile, `Error no AP ${ap.ip}: ${e.message}\n`);
        }
      }));
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    sshSuccessCount = successes;
    sshErrorCount = errors;
    isMacPollingRunning = false;
    console.log(`[DEBUG] Cache finalizado. MACs no Mapa: ${macToApMap.size}, APs Sucesso: ${successes}, APs Erro: ${errors}`);
    fs.appendFileSync(logFile, `[CACHE] Concluído. MACs: ${macToApMap.size}, Sucessos: ${successes}, Erros: ${errors}\n`);
    return true;
  },

  getInventory() {
    return networkInventory;
  },

  getSSHStats() {
    return { success: sshSuccessCount, error: sshErrorCount, running: isMacPollingRunning };
  },

  getMacLocation(mac: string): MacCacheEntry | null {
    return macToApMap.get(mac.toUpperCase()) || null;
  },

  getMacCacheSize(): number {
    return macToApMap.size;
  },

  getMacsByApIp(ip: string) {
    const clients: any[] = [];
    macToApMap.forEach((data, mac) => {
      if (data.apIp === ip) {
        clients.push({ mac, ...data });
      }
    });
    return clients;
  },

  getMacCache() {
    return macToApMap;
  },

  // Processa dados enviados por um Webhook (Mikrotik) ou Edge Agent
  processPushedTelemetry(data: any[]) {
    if (!Array.isArray(data)) return;
    
    const pushTime = new Date();
    
    // Atualizar inventário em memória
    data.forEach((device) => {
      // Formato esperado do device: { ip: "10.0.0.1", latency: 5, online: true, status: "ONLINE" }
      const ip = device.ip;
      if (!ip) return;

      // Registrar que este IP foi atualizado pelo Edge Agent (protege contra sobrescrita pelo ping local)
      pushedIps.set(ip, pushTime);

      const idx = networkInventory.findIndex(d => d.ip === ip);
      const isOnline = device.status === 'ONLINE' || device.online === true || device.status === 'up';

      if (idx !== -1) {
        networkInventory[idx].latency = device.latency || 0;
        networkInventory[idx].online = isOnline;
        networkInventory[idx].lastCheck = pushTime;
      } else {
        // Se não existir, adicionar provisoriamente
        networkInventory.push({
          name: device.name || `Remote-AP-${ip}`,
          ip: ip,
          online: isOnline,
          mode: 'UNKNOWN',
          latency: device.latency || 0,
          lastCheck: pushTime
        });
      }

      // Persistir no SQLite para não perder no restart e pro history no mapa
      prisma.accessPoint.updateMany({
        where: { ip: ip },
        data: { status: isOnline ? 'ONLINE' : 'OFFLINE' }
      }).catch(() => {});
    });

    // Limpar IPs antigos do mapa de push (mais de 5 minutos)
    const cutoff = Date.now() - 300_000;
    for (const [ip, date] of pushedIps) {
      if (date.getTime() < cutoff) pushedIps.delete(ip);
    }
  }
};
