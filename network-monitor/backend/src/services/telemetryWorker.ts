import { prisma } from '../db.js';
import { radioService, PASSWORDS, SSH_ALGORITHMS } from './radioService.js';
import { monitoringService } from './monitoringService.js';
import { Client } from 'ssh2';
import snmp from 'net-snmp';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import cron from 'node-cron';

const LOG_FILE = 'telemetry_poll.log';

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, line);
}

// Comandos por Fabricante
const COMMANDS_BY_VENDOR: Record<string, string[]> = {
  'Mikrotik': [
    '/system identity print',
    '/system resource print',
    '/system health print',
    '/system routerboard print',
    '/interface print detail',
    '/interface wireless print detail'
  ],
  'Intelbras': [
    'sysinfo', // Geralmente Intelbras Wom/APC ou Dropbear shell
    'uptime',
    'ifconfig',
    'iwconfig',
    'status' // Alguns firmwares Intelbras tem comando status completo
  ],
  'Ubiquiti': [
    'mca-status', // Comando padrão AirOS (Ubiquiti)
    'cat /etc/board.info',
    'uptime',
    'wstalist' // Para listar clientes conectados JSON
  ]
};

// Seletor de comandos default
const TELEMETRY_COMMANDS = COMMANDS_BY_VENDOR['Mikrotik'];

const SNMP_COMMUNITY = 'N3tc@rSNMP';
const MIKROTIK_RTAB_OID = '1.3.6.1.4.1.14988.1.1.1.2.1';

// OIDs para Fallback de Sistema (quando SSH falha)
const OID_IDENTITY = '1.3.6.1.2.1.1.5.0';
const OID_UPTIME = '1.3.6.1.2.1.1.3.0';
const OID_MODEL = '1.3.6.1.4.1.14988.1.1.7.3.0';
const OID_FIRMWARE = '1.3.6.1.4.1.14988.1.1.7.4.0';
const OID_CPU_LOAD = '1.3.6.1.4.1.14988.1.1.3.10.0';
const OID_VOLTAGE = '1.3.6.1.4.1.14988.1.1.3.8.0';
const OID_TEMPERATURE = '1.3.6.1.4.1.14988.1.1.3.11.0';

// OIDs Intelbras WOM
const OID_INTELBRAS_SIGNAL = '1.3.6.1.4.1.26138.3.1.0';
const OID_INTELBRAS_NOISE = '1.3.6.1.4.1.26138.3.2.0';
const OID_INTELBRAS_SSID = '1.3.6.1.4.1.26138.2.2.4.0';
const OID_UBNT_SIGNAL = '1.3.6.1.4.1.41112.1.4.1.1.5.1';

// Campos permitidos no modelo DeviceTelemetry do Prisma
const DEVICE_TELEMETRY_FIELDS = [
  'ip', 'identity', 'model', 'firmware', 'cpuLoad', 'uptime', 
  'freeMemory', 'totalMemory', 'temperature', 'voltage', 'latency',
  'wirelessMode', 'frequency', 'ssid', 'scanList', 'band', 
  'channelWidth', 'noiseFloor', 'signal', 'ccq', 'txPower', 'interfaces', 
  'clientCount', 'clientsJson'
];

function cleanForPrisma(data: any) {
  const clean: any = {};
  DEVICE_TELEMETRY_FIELDS.forEach(field => {
    if (data[field] !== undefined) {
      clean[field] = data[field];
    }
  });
  return clean;
}

/**
 * Executa MÚLTIPLOS comandos em UMA ÚNICA conexão SSH sequencial.
 */
function runMultipleCommandsSingleSession(
  host: string, user: string, pass: string, commands: string[], port: number = 22
): Promise<{ results: string[], error?: string }> {
  return new Promise((resolve) => {
    const conn = new Client();
    const results: string[] = [];
    let currentIdx = 0;

    const timer = setTimeout(() => {
      conn.destroy();
      while (results.length < commands.length) results.push('');
      resolve({ results, error: 'TIMEOUT' });
    }, 15000);

    function runNext() {
      if (currentIdx >= commands.length) {
        clearTimeout(timer);
        conn.end();
        resolve({ results });
        return;
      }

      const cmd = commands[currentIdx];
      let output = '';

      conn.exec(cmd, (err, stream) => {
        if (err) {
          results.push('');
          currentIdx++;
          runNext();
          return;
        }

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });
        stream.stderr.on('data', (data: Buffer) => {
          output += data.toString();
        });
        stream.on('error', (err: any) => {
          console.error('[SSH STREAM ERRO]', err);
        });
        stream.on('close', () => {
          results.push(output);
          currentIdx++;
          setTimeout(runNext, 100);
        });
      });
    }

    conn.on('ready', () => {
      runNext();
    }).on('error', (err) => {
      clearTimeout(timer);
      while (results.length < commands.length) results.push('');
      resolve({ results, error: err.message });
    }).connect({
      host, username: user, password: pass, port,
      timeout: 10000,
      readyTimeout: 15000,
      algorithms: SSH_ALGORITHMS as any
    });
  });
}

function parseIdentity(output: string): string {
  const match = output.match(/name:\s*(.+)/);
  return match ? match[1].trim() : '';
}

function parseResources(output: string) {
  if (!output) return {};
  const clean = output.replace(/\r/g, '');
  const cpu = clean.match(/cpu-load:\s*(\d+)/i);
  const uptime = clean.match(/uptime:\s*([^\n]+)/i);
  const freeMem = clean.match(/free-memory:\s*([\d.]+\s*\w+)/i);
  const totalMem = clean.match(/total-memory:\s*([\d.]+\s*\w+)/i);
  return {
    cpuLoad: cpu ? cpu[1] + '%' : null,
    uptime: uptime ? uptime[1].trim() : null,
    freeMemory: freeMem ? freeMem[1] : null,
    totalMemory: totalMem ? totalMem[1] : null
  };
}

function parseHealth(output: string) {
  if (!output) return {};
  const temp = output.match(/temperature:\s*(\d+)/i);
  const volt = output.match(/voltage:\s*([\d.]+)/i);
  return {
    temperature: temp ? temp[1] + '°C' : null,
    voltage: volt ? volt[1] + 'V' : null
  };
}

function parseRouterboard(output: string) {
  if (!output) return {};
  const model = output.match(/model:\s*([^\n\r]+)/i);
  const firmware = output.match(/current-firmware:\s*([^\n\r]+)/i);
  return {
    model: model ? model[1].trim() : null,
    firmware: firmware ? firmware[1].trim() : null
  };
}

function parseInterfaces(output: string) {
  if (!output) return [];
  const interfaces: any[] = [];
  const entries = output.split(/\d+\s+/);
  
  for (const entry of entries) {
    if (!entry.trim()) continue;
    const nameMatch = entry.match(/name="([^"]+)"/);
    if (!nameMatch) continue;
    
    const name = nameMatch[1];
    if (name === 'lo') continue;
    
    const speedMatch = entry.match(/speed=(\d+[GMK]bps)/i);
    const rateMatch = entry.match(/rate=(\d+[GMK]bps)/i);
    const runningMatch = entry.match(/running/i);
    const disabledMatch = entry.match(/disabled/i);
    const typeMatch = entry.match(/type="([^"]+)"/);
    
    const speed = speedMatch ? speedMatch[1] : (rateMatch ? rateMatch[1] : 'N/A');
    
    let speedClass = 'desconhecido';
    if (speed.includes('1G') || speed.includes('1000M')) speedClass = '1Gbps ✅';
    else if (speed.includes('100M')) speedClass = '100Mbps ⚠️';
    else if (speed.includes('10M')) speedClass = '10Mbps ❌ ERRO';
    else if (speed !== 'N/A') speedClass = speed;
    
    interfaces.push({
      name,
      type: typeMatch ? typeMatch[1] : 'ethernet',
      speed,
      speedClass,
      running: !!runningMatch && !disabledMatch
    });
  }
  return interfaces;
}

function parseWireless(output: string) {
  if (!output) return {};
  const mode = output.match(/mode=(\S+)/i);
  const freq = output.match(/frequency=(\d+)/i);
  const ssid = output.match(/ssid="([^"]+)"/i);
  const scanList = output.match(/scan-list="?([^"\n\r]+)"?/i);
  const band = output.match(/band=(\S+)/i);
  const channelWidth = output.match(/channel-width=(\S+)/i);
  const noiseFloor = output.match(/noise-floor=(-?\d+)/i);
  const txPower = output.match(/tx-power=(\d+)/i);

  return {
    wirelessMode: mode ? mode[1] : null,
    frequency: freq ? freq[1] + 'MHz' : null,
    ssid: ssid ? ssid[1] : null,
    scanList: scanList ? scanList[1].trim() : null,
    band: band ? band[1] : null,
    channelWidth: channelWidth ? channelWidth[1] : null,
    noiseFloor: noiseFloor ? noiseFloor[1] + 'dBm' : null,
    txPower: txPower ? txPower[1] + 'dBm' : null
  };
}

/**
 * PARSERS PARA INTELBRAS
 */
function parseIntelbrasResults(results: string[]) {
  const [sysinfo, uptime, ifconfig, iwconfig, status] = results;
  
  // Parse simplificado baseado em shells comuns de rádio
  const identity = sysinfo?.match(/hostname:\s*(.+)/i)?.[1] || 
                   sysinfo?.match(/Device Model:\s*(.+)/i)?.[1] || 
                   status?.match(/Hostname:\s*(.+)/i)?.[1] || '';
  
  const model = sysinfo?.match(/Device Model:\s*(.+)/i)?.[1] || 
                status?.match(/Device model:\s*(.+)/i)?.[1] || 'Intelbras';
  const firmware = sysinfo?.match(/Firmware Version:\s*(.+)/i)?.[1] || 
                   status?.match(/Firmware version:\s*(.+)/i)?.[1] || '';
  
  const upMatch = uptime?.match(/up\s+([^,]+)/i);
  const cpuMatch = sysinfo?.match(/CPU Load:\s*([\d%]+)/i);
  
  // Wireless (iwconfig ou status)
  const ssid = iwconfig?.match(/ESSID:"([^"]+)"/i)?.[1] || status?.match(/SSID:\s*(.+)/i)?.[1];
  const freq = iwconfig?.match(/Frequency:([\d.]+)\s*GHz/i)?.[1] || status?.match(/Frequency:\s*([\d.]+)/i)?.[1];
  const mode = iwconfig?.match(/Mode:(\S+)/i)?.[1] || status?.match(/Wireless mode:\s*(.+)/i)?.[1];
  const signal = status?.match(/Signal level:\s*(-?\d+)\s*dBm/i)?.[1];
  const noise = status?.match(/Noise level:\s*(-?\d+)\s*dBm/i)?.[1];

  return {
    identity: identity.trim() || 'Intelbras AP',
    model: model.trim(),
    firmware: firmware.trim(),
    uptime: upMatch?.[1]?.trim() || uptime?.trim(),
    cpuLoad: cpuMatch?.[1] || null,
    wirelessMode: mode || null,
    ssid: ssid || null,
    frequency: freq ? (freq.includes('G') || freq.includes('.') ? freq : freq + ' GHz') : null,
    noiseFloor: noise ? noise + 'dBm' : null,
    signal: signal ? signal + 'dBm' : null
  };
}

/**
 * PARSERS PARA UBIQUITI
 */
function parseUbiquitiResults(results: string[]) {
  const [mcaStatus, boardInfo, uptimeOutput, wstalistOutput] = results;
  
  const identityMatch = boardInfo?.match(/board\.name=(.+)/i) || mcaStatus?.match(/deviceName=(.+)/i);
  const identity = identityMatch ? identityMatch[1].trim() : 'Ubiquiti AP';

  const modelMatch = boardInfo?.match(/board\.model=(.+)/i) || mcaStatus?.match(/model=(.+)/i);
  const model = modelMatch ? modelMatch[1].trim() : 'Ubiquiti';

  const fwMatch = boardInfo?.match(/board\.revision=(.+)/i) || mcaStatus?.match(/firmware=(.+)/i) || boardInfo?.match(/board\.version=(.+)/i);
  const firmware = fwMatch ? fwMatch[1].trim() : 'N/A';

  // Uptime
  let uptime = 'N/A';
  const upMatch = uptimeOutput?.match(/up\s+([^,]+)/i);
  if (upMatch) {
    uptime = upMatch[1].trim();
  }

  // Telemetria básica
  const freq = mcaStatus?.match(/freq=(\d+)/i)?.[1] || 'N/A';
  const ssid = mcaStatus?.match(/essid=([^\n\r]+)/i)?.[1]?.trim() || 'N/A';
  const opmode = mcaStatus?.match(/opmode=(.+)/i)?.[1]?.trim() || 'UNKNOWN';
  const noise = mcaStatus?.match(/noise=(-?\d+)/i)?.[1] || 'N/A';
  
  // Clientes
  let clientsJson = '[]';
  let clientCount = 0;
  
  try {
     const wstaStr = wstalistOutput ? wstalistOutput.trim() : '';
     const firstBracket = wstaStr.indexOf('[');
     const lastBracket = wstaStr.lastIndexOf(']');
     const firstBrace = wstaStr.indexOf('{');
     const lastBrace = wstaStr.lastIndexOf('}');
     
     if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket && wstaStr.startsWith('[')) {
        const cleanJson = wstaStr.substring(firstBracket, lastBracket + 1);
        const parsed = JSON.parse(cleanJson);
        const clients = parsed.map((c: any) => ({
           mac: c.mac?.toUpperCase() || '',
           name: c.name || c.lastip || 'Ubiquiti Client',
           signal: typeof c.signal === 'number' ? c.signal : (c.remote ? c.remote.signal : -100),
           ccq: typeof c.ccq === 'number' ? c.ccq : (c.remote ? c.remote.ccq : 0),
           uptime: c.uptime ? Math.floor(c.uptime / 60) + 'm' : 'N/A'
        }));
        clientsJson = JSON.stringify(clients);
        clientCount = clients.length;
     } else if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace && wstaStr.startsWith('{')) {
        const cleanJson = wstaStr.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(cleanJson);
        const list = parsed.stations || [];
        if (Array.isArray(list)) {
            const clients = list.map((c: any) => ({
               mac: c.mac?.toUpperCase() || '',
               name: c.name || c.remote?.hostname || 'Ubiquiti Client',
               signal: typeof c.signal === 'number' ? c.signal : (c.remote?.signal || -100),
               ccq: typeof c.ccq === 'number' ? c.ccq : (c.remote?.ccq || 0),
               uptime: c.uptime ? Math.floor(c.uptime / 60) + 'm' : 'N/A'
            }));
            clientsJson = JSON.stringify(clients);
            clientCount = clients.length;
        }
     } else {
        const staMatch = mcaStatus?.match(/staCount=(\d+)/i) || mcaStatus?.match(/wlanConnections=(\d+)/i);
        if (staMatch) clientCount = parseInt(staMatch[1], 10);
     }
  } catch(e) {
     console.error('UBIQUITI JSON PARSE ERROR:', e);
  }

  return {
    identity,
    model: model.replace(/NaN/g, ''),
    firmware,
    uptime,
    cpuLoad: 'N/A',
    freeMemory: 'N/A',
    totalMemory: 'N/A',
    temperature: 'N/A',
    voltage: 'N/A',
    wirelessMode: opmode.toLowerCase().includes('ap') ? 'AP' : 'STATION',
    frequency: freq !== 'N/A' ? freq + 'MHz' : freq,
    ssid,
    noiseFloor: noise !== 'N/A' ? noise + 'dBm' : noise,
    txPower: 'N/A',
    interfaces: '[]',
    clientCount,
    clientsJson
  };
}

function fetchClientsViaSNMP(ip: string, initialCommunity = SNMP_COMMUNITY): Promise<any[]> {
    const communities = [initialCommunity];
    if (initialCommunity !== 'public') communities.push('public');

    return new Promise(async (resolve) => {
      let results: any[] = [];
      
      for (const community of communities) {
        if (results.length > 0) break;

        results = await new Promise((res) => {
          const clients = new Map<string, any>();
          const session = snmp.createSession(ip, community, { timeout: 3000, retries: 0, version: snmp.Version2c });
          const OID_CLIENTS = '1.3.6.1.4.1.14988.1.1.1.2.1'; // Mikrotik 
          
          let resolved = false;
          const finish = (data: any[]) => {
            if (resolved) return;
            resolved = true;
            try { session.close(); } catch {}
            res(data);
          };

          session.subtree(OID_CLIENTS, (varbinds: any[]) => {
            for (const vb of varbinds) {
              if (snmp.isVarbindError(vb)) continue;
              
              const parts = vb.oid.split('.');
              const BASE_PARTS = OID_CLIENTS.split('.').length;
              
              const subOid = parts[BASE_PARTS];
              const indexKey = parts.slice(BASE_PARTS + 1).join('.');
              
              if (!clients.has(indexKey)) {
                clients.set(indexKey, { mac: 'N/A', signal: 'N/A', txRate: 'N/A', rxRate: 'N/A' });
              }
              const client = clients.get(indexKey)!;
              
              if (subOid === '1') {
                try {
                  const buf = Buffer.isBuffer(vb.value) ? vb.value : Buffer.from(vb.value as any);
                  client.mac = Array.from(buf as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
                } catch {}
              } else if (subOid === '3') {
                client.signal = vb.value + 'dBm';
              } else if (subOid === '8') {
                const rateMbps = Math.round(Number(vb.value) / 1000000);
                client.txRate = rateMbps + 'Mbps';
              } else if (subOid === '9') {
                const rateMbps = Math.round(Number(vb.value) / 1000000);
                client.rxRate = rateMbps + 'Mbps';
              }
            }
          }, (error: any) => {
            const result = Array.from(clients.values()).filter(c => c.mac && c.mac !== '' && c.mac !== 'N/A');
            finish(result);
          });

          setTimeout(() => {
            const result = Array.from(clients.values()).filter(c => c.mac && c.mac !== '' && c.mac !== 'N/A');
            finish(result);
          }, 5000);
        });
      }
      resolve(results);
    });
}

function collectFromSnmp(ip: string, initialCommunity = SNMP_COMMUNITY): Promise<any> {
    const communities = [initialCommunity];
    if (initialCommunity !== 'public') communities.push('public');

    return new Promise(async (resolve) => {
      let data: any = null;

      for (const community of communities) {
        if (data) break;

        data = await new Promise((res) => {
          const session = snmp.createSession(ip, community, { timeout: 3000, retries: 0, version: snmp.Version2c });
          const oids = [
            OID_IDENTITY, 
            OID_UPTIME, 
            OID_MODEL, 
            OID_FIRMWARE, 
            OID_CPU_LOAD, 
            OID_VOLTAGE, 
            OID_TEMPERATURE,
            OID_UBNT_SIGNAL,
            OID_INTELBRAS_SIGNAL,
            OID_INTELBRAS_NOISE,
            OID_INTELBRAS_SSID
          ];

          session.get(oids, (err, varbinds) => {
            if (err || !varbinds || (varbinds.length > 0 && snmp.isVarbindError(varbinds[0]))) {
              session.close();
              res(null);
              return;
            }

            const currentData: any = { isSnmpOnly: true };
            try {
              if (varbinds[0] && !snmp.isVarbindError(varbinds[0]) && varbinds[0].value) currentData.identity = varbinds[0].value.toString();
              
              if (varbinds[1] && !snmp.isVarbindError(varbinds[1]) && varbinds[1].value) {
                const ticks = parseInt(varbinds[1].value.toString());
                const secs = Math.floor(ticks / 100);
                const days = Math.floor(secs / 86400);
                const hours = Math.floor((secs % 86400) / 3600);
                const mins = Math.floor((secs % 3600) / 60);
                currentData.uptime = `${days > 0 ? days + 'd ' : ''}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
              }

              if (varbinds[2] && !snmp.isVarbindError(varbinds[2]) && varbinds[2].value) currentData.model = varbinds[2].value.toString();
              if (varbinds[3] && !snmp.isVarbindError(varbinds[3]) && varbinds[3].value) currentData.firmware = varbinds[3].value.toString();
              if (varbinds[4] && !snmp.isVarbindError(varbinds[4]) && varbinds[4].value) currentData.cpuLoad = varbinds[4].value.toString() + '%';
              
              if (varbinds[5] && !snmp.isVarbindError(varbinds[5]) && varbinds[5].value) {
                  const v = parseInt(varbinds[5].value.toString());
                  if (v > 0) currentData.voltage = (v / 10).toFixed(1) + 'V';
              }
              if (varbinds[6] && !snmp.isVarbindError(varbinds[6]) && varbinds[6].value) {
                  const t = parseInt(varbinds[6].value.toString());
                  if (t > 0) currentData.temperature = (t / 10).toFixed(1) + '°C';
              }

              const vbUbiSig = varbinds[7];
              const vbIntSig = varbinds[8];
              const vbIntNoise = varbinds[9];
              const vbIntSsid = varbinds[10];

              if (vbIntSig && !snmp.isVarbindError(vbIntSig) && vbIntSig.value) {
                currentData.signal = vbIntSig.value.toString() + 'dBm';
                if (vbIntNoise && !snmp.isVarbindError(vbIntNoise) && vbIntNoise.value) currentData.noiseFloor = vbIntNoise.value.toString() + 'dBm';
                if (vbIntSsid && !snmp.isVarbindError(vbIntSsid) && vbIntSsid.value) currentData.ssid = vbIntSsid.value.toString();
                currentData.equipmentType = 'Intelbras';
              } else if (vbUbiSig && !snmp.isVarbindError(vbUbiSig) && vbUbiSig.value) {
                currentData.signal = vbUbiSig.value.toString() + 'dBm';
              }
            } catch (e) {
              console.error(`[SNMP PARSE ERROR] ${ip}`, e);
            }
            session.close();
            res(currentData);
          });
        });
      }
      resolve(data);
    });
}

export async function collectFromDevice(ip: string): Promise<any | null> {
  let telemetryData: any = null;
  let snmpClients: any[] = [];
  
  log(`[COLLECT ${ip}] Iniciando coleta...`);

  const dbAp = await prisma.accessPoint.findUnique({ where: { ip } });
  
  const vendor = dbAp?.equipmentType || 'Mikrotik';
  const commands = COMMANDS_BY_VENDOR[vendor] || TELEMETRY_COMMANDS;
  const user = dbAp?.sshUser || 'N3tc@r';
  const pass = dbAp?.sshPass || 'AdminiStracao2021';
  const port = dbAp?.sshPort || 22;

  const isIntelbras = vendor === 'Intelbras';

  // Se for Intelbras, tenta SNMP primeiro como solicitado (é mais estável para esse fabricante)
  if (isIntelbras) {
    log(`[COLLECT ${ip}] [Intelbras] Priorizando SNMP...`);
    const snmpData = await collectFromSnmp(ip);
    if (snmpData) {
      log(`[COLLECT ${ip}] SNMP SUCESSO!`);
      telemetryData = snmpData;
    }
  }

  // Se não for Intelbras ou se SNMP falhou, tenta SSH
  if (!telemetryData) {
    log(`[COLLECT ${ip}] [${vendor}] Tentando SSH com ${user} (port ${port})...`);
    let { results, error } = await runMultipleCommandsSingleSession(ip, user, pass, commands, port);
    let sshFailed = !results || results.every(r => !r || r.trim() === '');
    
    if (sshFailed && error) {
      log(`[COLLECT ${ip}] ⚠️ SSH ERRO DETALHADO: ${error}`);
    }

    // Fallback se falhar autenticação
    if (sshFailed && error?.includes('authentication methods failed')) {
      log(`[COLLECT ${ip}] SSH Auth falhou para ${user}. Tentando senhas mestras...`);
      for (const cred of PASSWORDS) {
        if (cred.user === user && cred.pass === pass) continue; 
        
        log(`[COLLECT ${ip}] Tentando master: ${cred.user}...`);
        const retry = await runMultipleCommandsSingleSession(ip, cred.user, cred.pass, commands, port);
        if (retry.results && retry.results.some(r => r && r.trim() !== '')) {
          log(`[COLLECT ${ip}] SSH SUCESSO com credencial mestra: ${cred.user}`);
          results = retry.results;
          sshFailed = false;
          
          await prisma.accessPoint.update({
            where: { ip },
            data: { sshUser: cred.user, sshPass: cred.pass }
          }).catch(() => {});
          break;
        }
      }
    }

    if (!sshFailed && results) {
      log(`[COLLECT ${ip}] SSH OK.`);
      if (vendor === 'Intelbras') {
        telemetryData = parseIntelbrasResults(results);
      } else if (vendor === 'Ubiquiti') {
        telemetryData = parseUbiquitiResults(results);
      } else {
        telemetryData = {
          identity: parseIdentity(results[0]),
          ...parseResources(results[1]),
          ...parseHealth(results[2]),
          ...parseRouterboard(results[3]),
          ...parseWireless(results[5]),
          interfaces: JSON.stringify(parseInterfaces(results[4]))
        };
      }
    } else if (!isIntelbras) {
      // Se não era intelbras e SSH falhou, tenta SNMP como fallback
      log(`[COLLECT ${ip}] SSH falhou. Tentando fallback SNMP...`);
      telemetryData = await collectFromSnmp(ip);
    }
  }

  if (!telemetryData) {
    log(`[COLLECT ${ip}] SSH e SNMP falharam.`);
    return null;
  }

  try {
    // Apenas tenta SNMP se já não tivermos clientes via SSH (Ubiquiti/Intelbras trazem via SSH)
    if (!telemetryData.clientsJson || telemetryData.clientsJson === '[]') {
      snmpClients = await fetchClientsViaSNMP(ip);
    }
  } catch {}

  const finalClientCount = (telemetryData.clientCount > 0) ? telemetryData.clientCount : snmpClients.length;
  const finalClientsJson = (telemetryData.clientsJson && telemetryData.clientsJson !== '[]') 
    ? telemetryData.clientsJson 
    : JSON.stringify(snmpClients);

  if (telemetryData.equipmentType && (!dbAp || dbAp.equipmentType !== telemetryData.equipmentType)) {
    log(`[COLLECT ${ip}] Atualizando equipamento detectado no banco: ${telemetryData.equipmentType}`);
    await prisma.accessPoint.upsert({
      where: { ip },
      update: { equipmentType: telemetryData.equipmentType },
      create: { 
        ip, 
        description: telemetryData.identity || 'Novo Equipamento',
        equipmentType: telemetryData.equipmentType 
      }
    }).catch(() => {});
  }

  return {
    ip,
    ...telemetryData,
    clientCount: finalClientCount,
    clientsJson: finalClientsJson
  };
}

export async function forceCollectDevice(ip: string): Promise<boolean> {
  try {
    const data = await collectFromDevice(ip);
    if (data) {
      // Obter latência atual do inventário para salvar no histórico
      const inv = monitoringService.getInventory().find(d => d.ip === ip);
      if (inv) (data as any).latency = inv.latency;

      const existingId = await getExistingTelemetryId(ip);
      const prismaData = cleanForPrisma(data);
      console.log(`[DB DEBUG] Tentando salvar telemetria para ${ip}:`, JSON.stringify(prismaData, null, 2));

      if (existingId && !existingId.startsWith('non-existent-id-')) {
        await (prisma as any).deviceTelemetry.update({
          where: { id: existingId },
          data: { ...prismaData, collectedAt: new Date() }
        }).then(() => console.log(`[DB SUCCESS] Telemetria atualizada para ${ip}`))
        .catch((err: any) => {
          console.error(`[DB ERROR] Update falhou para ${ip}:`, err);
          log(`[DB ERROR] Update falhou para ${ip}: ${err.message}`);
        });
      } else {
        await (prisma as any).deviceTelemetry.create({
          data: { ...prismaData, collectedAt: new Date() }
        }).then(() => console.log(`[DB SUCCESS] Telemetria criada para ${ip}`))
        .catch((err: any) => {
          console.error(`[DB ERROR] Create falhou para ${ip}:`, err);
          log(`[DB ERROR] Create falhou para ${ip}: ${err.message}`);
        });
      }

      // NOVO: Salvar no Log de Histórico (sempre cria novo)
      await (prisma as any).telemetryLog.create({
        data: {
          ip,
          identity: data.identity,
          uptime: data.uptime,
          signal: data.signal,
          noiseFloor: data.noiseFloor,
          ccq: data.ccq,
          latency: (data as any).latency,
          clientCount: data.clientCount,
          collectedAt: new Date()
        }
      }).catch((err: any) => console.error(`[DB ERROR] Histórico falhou para ${ip}:`, err.message));

      await prisma.accessPoint.update({
        where: { ip },
        data: { 
          lastSshStatus: data.isSnmpOnly ? 'FAILED' : 'SUCCESS',
          wirelessMode: data.wirelessMode || undefined
        }
      }).catch(() => {});
      return true;
    }
    return false;
  } catch(e) {
    await prisma.accessPoint.update({ where: { ip }, data: { lastSshStatus: 'FAILED' } }).catch(() => {});
    return false;
  }
}

export async function runTelemetryCollection() {
  log('═══════ Iniciando coleta de telemetria ═══════');
  const inventory = monitoringService.getInventory();
  const onlineAps = inventory.filter(d => d.online);
  log(`APs Online para coletar: ${onlineAps.length}`);

  for (let i = 0; i < onlineAps.length; i += 5) {
    const batch = onlineAps.slice(i, i + 5);
    await Promise.all(batch.map(async (ap) => {
      try {
        const data = await collectFromDevice(ap.ip);
        if (data) {
          const existingId = await getExistingTelemetryId(ap.ip);
          
          // Remove campos que não existem no Prisma para não falhar o update/create
          const prismaData = cleanForPrisma(data);

          if (existingId && !existingId.startsWith('non-existent-id-')) {
            await (prisma as any).deviceTelemetry.update({
              where: { id: existingId },
              data: { ...prismaData, collectedAt: new Date() }
            }).catch((err: any) => log(`[DB ERROR] Update falhou para ${ap.ip}: ${err.message}`));
          } else {
            await (prisma as any).deviceTelemetry.create({
              data: { ...prismaData, collectedAt: new Date() }
            }).catch((err: any) => log(`[DB ERROR] Create falhou para ${ap.ip}: ${err.message}`));
          }

          // NOVO: Salvar no Log de Histórico
          await (prisma as any).telemetryLog.create({
            data: {
              ip: ap.ip,
              identity: data.identity,
              uptime: data.uptime,
              signal: data.signal,
              noiseFloor: data.noiseFloor,
              ccq: data.ccq,
              latency: ap.latency,
              clientCount: data.clientCount,
              collectedAt: new Date()
            }
          }).catch(() => {});
          
          await prisma.accessPoint.update({
            where: { ip: ap.ip },
            data: { 
              lastSshStatus: data.isSnmpOnly ? 'FAILED' : 'SUCCESS',
              wirelessMode: data.wirelessMode || undefined
            }
          }).catch(() => {});
        }
      } catch {}
    }));
    await new Promise(r => setTimeout(r, 1000));
  }
}

/**
 * Remove dados de telemetria mais antigos que 30 dias
 */
export async function pruneTelemetryData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  log(`[PRUNE] Iniciando limpeza de logs anteriores a ${thirtyDaysAgo.toISOString()}`);
  
  try {
    const deleted = await (prisma as any).telemetryLog.deleteMany({
      where: {
        collectedAt: {
          lt: thirtyDaysAgo
        }
      }
    });
    log(`[PRUNE] Limpeza concluída: ${deleted.count} registros removidos.`);
  } catch (err: any) {
    log(`[PRUNE] Erro ao limpar logs: ${err.message}`);
  }
}

// Agendar limpeza diária às 04:00 da manhã
cron.schedule('0 4 * * *', () => {
  pruneTelemetryData();
});

async function getExistingTelemetryId(ip: string): Promise<string> {
  const existing = await (prisma as any).deviceTelemetry.findFirst({ where: { ip } });
  return existing?.id || 'non-existent-id-' + ip;
}

export function startTelemetryWorker() {
  log('Worker de Telemetria iniciado (intervalo: 1h)');
  setTimeout(() => { runTelemetryCollection().catch(() => {}); }, 2 * 60 * 1000);
  setInterval(() => { runTelemetryCollection().catch(() => {}); }, 60 * 60 * 1000);
}
