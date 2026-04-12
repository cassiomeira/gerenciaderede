import { Client } from 'ssh2';
import snmp from 'net-snmp';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('C:/aplicativos/gerenciaderede1/gerenciaderede/gerenciaderede/gerenciaderede/network-monitor/backend/.env') });

const NE8000_HOST = process.env.NE8000_HOST || '177.184.190.193';
const NE8000_SSH_PORT = parseInt(process.env.NE8000_SSH_PORT || '2222');
const NE8000_SSH_USER = process.env.NE8000_SSH_USER || 'suporte';
const NE8000_SSH_PASS = process.env.NE8000_SSH_PASS || 'C@ssioadmin2000';
const NE8000_SNMP_COMMUNITY = process.env.NE8000_SNMP_COMMUNITY || 'Netcar@2024ro';

// ============================================================
// TYPES
// ============================================================
interface InterfaceData {
  name: string;
  description: string;
  phyStatus: string;
  protocol: string;
  inUtil: string;
  outUtil: string;
  inErrors: number;
  outErrors: number;
}

interface BgpPeer {
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

interface SystemInfo {
  uptime: string;
  cpu: number;
  cpuCores: { name: string; current: number; fiveSec: number; oneMin: number; fiveMin: number; }[];
  memoryTotal: number;
  memoryUsed: number;
  memoryPercent: number;
  model: string;
  version: string;
}

interface PppoeInfo {
  total: number;
  radius: number;
  local: number;
}

interface BridgeDomain {
  id: number;
  description: string;
  state: string;
  ports: string[];
}

interface TrafficPoint {
  time: number;
  inBps: number;
  outBps: number;
}

interface SnmpInterfaceCounters {
  ifIndex: number;
  ifDescr: string;
  inOctets: bigint;
  outOctets: bigint;
  ifOperStatus: number;
  timestamp: number;
}

// ============================================================
// STATE
// ============================================================
let systemInfo: SystemInfo = {
  uptime: 'N/A', cpu: 0, cpuCores: [],
  memoryTotal: 0, memoryUsed: 0, memoryPercent: 0,
  model: 'NE8000 M8', version: 'N/A'
};
let pppoeInfo: PppoeInfo = { total: 0, radius: 0, local: 0 };
let interfaces: InterfaceData[] = [];
let bgpPeers: BgpPeer[] = [];
let bgpPeerDescriptions: Map<string, string> = new Map();
let bridgeDomains: BridgeDomain[] = [];
let interfaceDescriptions: Map<string, string> = new Map();
let trafficHistory: Map<string, TrafficPoint[]> = new Map();
let lastSnmpCounters: Map<number, SnmpInterfaceCounters> = new Map();
let snmpIfIndexMap: Map<number, string> = new Map();
let snmpTraffic: Map<string, { inBps: number; outBps: number }> = new Map();
let lastCollectError: string | null = null;
let lastCollectTime: Date | null = null;
let isCollecting = false;

const MAX_HISTORY_POINTS = 2880; // 24h at 30s intervals

// ============================================================
// SSH HELPERS
// ============================================================
function sshExec(command: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    const timer = setTimeout(() => {
      conn.destroy();
      reject(new Error(`SSH timeout for: ${command}`));
    }, timeoutMs);

    conn.on('ready', () => {
      conn.shell((err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); return reject(err); }

        stream.on('data', (data: Buffer) => { output += data.toString(); });
        stream.on('close', () => { clearTimeout(timer); conn.end(); resolve(output); });

        // Disable paging then execute command
        stream.write('screen-length 0 temporary\n');
        setTimeout(() => {
          stream.write(command + '\n');
          setTimeout(() => {
            stream.write('quit\n');
          }, timeoutMs - 5000);
        }, 1500);
      });
    }).on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    }).connect({
      host: NE8000_HOST,
      port: NE8000_SSH_PORT,
      username: NE8000_SSH_USER,
      password: NE8000_SSH_PASS,
      tryKeyboard: true,
      readyTimeout: 10000,
      algorithms: {
        kex: ['diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256'],
        serverHostKey: ['ecdsa-sha2-nistp256', 'ssh-rsa', 'ssh-dss'],
        cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', 'aes256-cbc', '3des-cbc'],
      } as any,
      hostVerifier: () => true,
    }).on('keyboard-interactive', (_name, _instructions, _instructionsLang, _prompts, finish) => {
      finish([NE8000_SSH_PASS]);
    });
  });
}

function sshMultiCmd(commands: string[], timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    const timer = setTimeout(() => {
      conn.destroy();
      reject(new Error('SSH multi-command timeout'));
    }, timeoutMs);

    conn.on('ready', () => {
      conn.shell((err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); return reject(err); }

        // Handle password change prompt
        let sentN = false;

        stream.on('data', (data: Buffer) => {
          const chunk = data.toString();
          output += chunk;

          if (!sentN && chunk.includes('Change now')) {
            stream.write('N\n');
            sentN = true;
          }
        });

        stream.on('close', () => {
          clearTimeout(timer);
          conn.end();
          resolve(output);
        });

        // Wait for initial banner, then run commands
        setTimeout(() => {
          stream.write('screen-length 0 temporary\n');
          let delay = 1500;
          for (const cmd of commands) {
            setTimeout(() => stream.write(cmd + '\n'), delay);
            delay += 2000;
          }
          setTimeout(() => stream.write('quit\n'), delay + 1000);
        }, 2000);
      });
    }).on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    }).connect({
      host: NE8000_HOST,
      port: NE8000_SSH_PORT,
      username: NE8000_SSH_USER,
      password: NE8000_SSH_PASS,
      tryKeyboard: true,
      readyTimeout: 10000,
      algorithms: {
        kex: ['diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256'],
        serverHostKey: ['ecdsa-sha2-nistp256', 'ssh-rsa', 'ssh-dss'],
        cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', 'aes256-cbc', '3des-cbc'],
      } as any,
      hostVerifier: () => true,
    }).on('keyboard-interactive', (_name, _instructions, _instructionsLang, _prompts, finish) => {
      finish([NE8000_SSH_PASS]);
    });
  });
}

// ============================================================
// PARSERS
// ============================================================
function parseInterfaceBrief(output: string): InterfaceData[] {
  const result: InterfaceData[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    // Match lines like: GigabitEthernet0/7/0(10G)   up    down      7.37% 60.78%         0          0
    const match = line.match(
      /^((?:GigabitEthernet|Eth-Trunk|Virtual-|LoopBack|NULL|Vlanif)\S+)\s+(up|\*?down|down)\s+(up|down|up\(s\))\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d+)/
    );
    if (match) {
      result.push({
        name: match[1].replace(/\(10G\)/, ''),
        description: '',
        phyStatus: match[2],
        protocol: match[3],
        inUtil: match[4],
        outUtil: match[5],
        inErrors: parseInt(match[6]),
        outErrors: parseInt(match[7]),
      });
    }
  }
  return result;
}

function parseInterfaceDescriptions(output: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = output.split('\n');
  for (const line of lines) {
    const match = line.match(
      /^((?:GE|Eth-Trunk|VE|VT|Loop|NULL|Vlanif)\S+)\s+(?:up|\*?down)\s+(?:up|down|up\(s\))\s+(.*)/
    );
    if (match) {
      const name = match[1].trim();
      const desc = match[2].trim();
      // Convert short names: GE0/7/0 -> GigabitEthernet0/7/0
      const fullName = name.startsWith('GE') ? name.replace('GE', 'GigabitEthernet') : name;
      // Remove (10G) suffix
      const cleanName = fullName.replace(/\(10G\)/, '');
      if (desc) map.set(cleanName, desc);
    }
  }
  return map;
}

function parseCpuUsage(output: string): { cpu: number; cores: SystemInfo['cpuCores'] } {
  let cpu = 0;
  const cores: SystemInfo['cpuCores'] = [];

  const cpuMatch = output.match(/System cpu use rate is\s*:\s*(\d+)%/);
  if (cpuMatch) cpu = parseInt(cpuMatch[1]);

  const coreRegex = /cpu(\d+)\s+(\d+)%\s+(\d+)%\s+(\d+)%\s+(\d+)%/g;
  let m;
  while ((m = coreRegex.exec(output)) !== null) {
    cores.push({
      name: `cpu${m[1]}`,
      current: parseInt(m[2]),
      fiveSec: parseInt(m[3]),
      oneMin: parseInt(m[4]),
      fiveMin: parseInt(m[5]),
    });
  }

  return { cpu, cores };
}

function parseMemoryUsage(output: string): { total: number; used: number; percent: number } {
  const totalMatch = output.match(/System Total Memory Is:\s*([\d]+)/);
  const usedMatch = output.match(/Total Memory Used Is:\s*([\d]+)/);
  const pctMatch = output.match(/Memory Using Percentage Is:\s*(\d+)%/);
  return {
    total: totalMatch ? parseInt(totalMatch[1]) : 0,
    used: usedMatch ? parseInt(usedMatch[1]) : 0,
    percent: pctMatch ? parseInt(pctMatch[1]) : 0,
  };
}

function parseAccessUserSummary(output: string): PppoeInfo {
  const totalMatch = output.match(/Total users\s*:\s*(\d+)/);
  const radiusMatch = output.match(/Radius authentication\s*:\s*(\d+)/);
  const localMatch = output.match(/Local authentication\s*:\s*(\d+)/);
  return {
    total: totalMatch ? parseInt(totalMatch[1]) : 0,
    radius: radiusMatch ? parseInt(radiusMatch[1]) : 0,
    local: localMatch ? parseInt(localMatch[1]) : 0,
  };
}

function parseBgpPeers(output: string): BgpPeer[] {
  const result: BgpPeer[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    // Match: 45.175.250.110                   4      269096 21364594    86981     0 1260h50m Established  1068992
    const match = line.match(
      /^\s+([\d.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)/
    );
    if (match) {
      result.push({
        peer: match[1],
        description: bgpPeerDescriptions.get(match[1]) || '',
        version: parseInt(match[2]),
        as: parseInt(match[3]),
        msgRcvd: parseInt(match[4]),
        msgSent: parseInt(match[5]),
        uptime: match[7],
        state: match[8],
        prefixesReceived: parseInt(match[9]),
      });
    }
    // Also match peers with 0 prefixes and different format
    const match2 = line.match(
      /^\s+([\d.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(Idle|Active|Connect|OpenSent|OpenConfirm)\s+(\d+)/
    );
    if (match2 && !match) {
      result.push({
        peer: match2[1],
        description: bgpPeerDescriptions.get(match2[1]) || '',
        version: parseInt(match2[2]),
        as: parseInt(match2[3]),
        msgRcvd: parseInt(match2[4]),
        msgSent: parseInt(match2[5]),
        uptime: match2[7],
        state: match2[8],
        prefixesReceived: parseInt(match2[9]),
      });
    }
  }
  return result;
}

function parsePeerDescriptions(output: string): Map<string, string> {
  const map = new Map<string, string>();
  const regex = /peer\s+([\d.]+)\s+description\s+(\S+)/g;
  let m;
  while ((m = regex.exec(output)) !== null) {
    map.set(m[1], m[2]);
  }
  return map;
}

function parseBridgeDomains(output: string): BridgeDomain[] {
  const result: BridgeDomain[] = [];
  const sections = output.split(/\n(?=\d+\s+)/);
  for (const section of sections) {
    const lines = section.trim().split('\n');
    if (lines.length < 1) continue;
    // Match: 1211         GE0/7/0.1211(U) GE0/7/3.1211(U)
    const headerMatch = lines[0].match(/^(\d+)\s+(.*)/);
    if (headerMatch) {
      const id = parseInt(headerMatch[1]);
      const portsStr = headerMatch[2].trim();
      const ports = portsStr.split(/\s+/).filter(p => p.includes('/'));

      // Look for description in second line
      let desc = '';
      let state = 'up';
      if (lines.length > 1) {
        const descMatch = lines[1].match(/^\d+\s+(\w+)\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+(.*)/);
        if (descMatch) {
          state = descMatch[1];
          desc = descMatch[2].trim();
        }
      }

      result.push({ id, description: desc, state, ports });
    }
  }
  return result;
}

function parseUptime(output: string): string {
  const match = output.match(/uptime is (\d+ days?, \d+ hours?, \d+ minutes?)/);
  return match ? match[1] : 'N/A';
}

function parseVersion(output: string): string {
  const match = output.match(/Version (\S+)/);
  return match ? match[1] : 'N/A';
}

// ============================================================
// SSH COLLECTION
// ============================================================
async function collectSSHData(): Promise<void> {
  try {
    const output = await sshMultiCmd([
      'display cpu-usage',
      'display memory-usage',
      'display access-user summary',
      'display interface brief',
      'display interface description',
    ], 45000);

    // Parse CPU
    const cpuData = parseCpuUsage(output);
    systemInfo.cpu = cpuData.cpu;
    systemInfo.cpuCores = cpuData.cores;

    // Parse Memory
    const memData = parseMemoryUsage(output);
    systemInfo.memoryTotal = memData.total;
    systemInfo.memoryUsed = memData.used;
    systemInfo.memoryPercent = memData.percent;

    // Parse PPPoE
    pppoeInfo = parseAccessUserSummary(output);

    // Parse Interfaces
    interfaces = parseInterfaceBrief(output);

    // Parse Interface Descriptions
    interfaceDescriptions = parseInterfaceDescriptions(output);

    // Apply descriptions to interfaces
    for (const iface of interfaces) {
      iface.description = interfaceDescriptions.get(iface.name) || '';
    }

    // Parse uptime and version from output if available
    const uptimeStr = parseUptime(output);
    if (uptimeStr !== 'N/A') systemInfo.uptime = uptimeStr;
    const verStr = parseVersion(output);
    if (verStr !== 'N/A') systemInfo.version = verStr;

    lastCollectTime = new Date();
    lastCollectError = null;
  } catch (err: any) {
    lastCollectError = err.message;
    console.error('[NE8000 SSH] Error:', err.message);
  }
}

async function collectBGPData(): Promise<void> {
  try {
    // BGP requires entering virtual-system first, then running commands, then exiting
    // We use a dedicated SSH session with careful timing
    const output = await new Promise<string>((resolve, reject) => {
      const conn = new Client();
      let output = '';
      const timer = setTimeout(() => {
        conn.destroy();
        reject(new Error('BGP SSH timeout'));
      }, 60000); // 60s timeout for BGP (VS switch takes time)

      conn.on('ready', () => {
        conn.shell((err, stream) => {
          if (err) { clearTimeout(timer); conn.end(); return reject(err); }

          let sentN = false;

          stream.on('data', (data: Buffer) => {
            const chunk = data.toString();
            output += chunk;

            if (!sentN && chunk.includes('Change now')) {
              stream.write('N\n');
              sentN = true;
            }
          });

          stream.on('close', () => {
            clearTimeout(timer);
            conn.end();
            resolve(output);
          });

          // Sequence with proper delays for virtual-system
          setTimeout(() => {
            stream.write('screen-length 0 temporary\n');
          }, 2000);
          
          // Switch to virtual-system (takes a few seconds)
          setTimeout(() => {
            stream.write('switch virtual-system NETCAR-BGP-01\n');
          }, 4000);

          // Wait for VS switch, then disable paging in VS context
          setTimeout(() => {
            stream.write('screen-length 0 temporary\n');
          }, 8000);

          // Now run BGP commands inside the VS
          setTimeout(() => {
            stream.write('display bgp peer\n');
          }, 10000);

          // Get peer descriptions
          setTimeout(() => {
            stream.write('display current-configuration | include peer.*description\n');
          }, 15000);

          // Exit virtual-system back to admin view
          setTimeout(() => {
            stream.write('quit\n'); // exit VS
          }, 20000);

          // Exit main shell
          setTimeout(() => {
            stream.write('quit\n'); // exit session
          }, 22000);
        });
      }).on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      }).connect({
        host: NE8000_HOST,
        port: NE8000_SSH_PORT,
        username: NE8000_SSH_USER,
        password: NE8000_SSH_PASS,
        tryKeyboard: true,
        readyTimeout: 10000,
        algorithms: {
          kex: ['diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256'],
          serverHostKey: ['ecdsa-sha2-nistp256', 'ssh-rsa', 'ssh-dss'],
          cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', 'aes256-cbc', '3des-cbc'],
        } as any,
        hostVerifier: () => true,
      }).on('keyboard-interactive', (_name, _instructions, _instructionsLang, _prompts, finish) => {
        finish([NE8000_SSH_PASS]);
      });
    });

    // Parse peer descriptions first
    bgpPeerDescriptions = parsePeerDescriptions(output);

    // Parse BGP peers
    bgpPeers = parseBgpPeers(output);

    // Apply descriptions
    for (const peer of bgpPeers) {
      if (!peer.description) {
        peer.description = bgpPeerDescriptions.get(peer.peer) || '';
      }
    }

    if (bgpPeers.length > 0) {
      console.log(`[NE8000 BGP] Coletados ${bgpPeers.length} peers (${bgpPeers.filter(p => p.state === 'Established').length} established)`);
    }
  } catch (err: any) {
    console.error('[NE8000 BGP] Error:', err.message);
  }
}

async function collectSystemVersion(): Promise<void> {
  try {
    const output = await sshMultiCmd(['display version'], 15000);
    systemInfo.uptime = parseUptime(output);
    systemInfo.version = parseVersion(output);
  } catch (err: any) {
    console.error('[NE8000 Version] Error:', err.message);
  }
}

// ============================================================
// SNMP COLLECTION
// ============================================================
function collectSNMPTraffic(): void {
  try {
    const session = snmp.createSession(NE8000_HOST, NE8000_SNMP_COMMUNITY, {
      timeout: 5000,
      retries: 1,
      version: snmp.Version2c,
    });

    // Walk ifDescr to get interface name mapping
    const ifDescrOid = '1.3.6.1.2.1.2.2.1.2'; // ifDescr
    const ifHCInOid = '1.3.6.1.2.1.31.1.1.1.6'; // ifHCInOctets (64-bit)
    const ifHCOutOid = '1.3.6.1.2.1.31.1.1.1.10'; // ifHCOutOctets (64-bit)
    const ifOperStatusOid = '1.3.6.1.2.1.2.2.1.8'; // ifOperStatus

    // Use subtree to walk all interface counters
    const newCounters = new Map<number, SnmpInterfaceCounters>();

    session.subtree(ifDescrOid, (varbinds) => {
      for (const vb of varbinds) {
        const oid = vb.oid;
        const ifIndex = parseInt(oid.split('.').pop() || '0');
        const ifDescr = vb.value.toString();

        // Only track GigabitEthernet and Eth-Trunk interfaces
        if (ifDescr.includes('GigabitEthernet') || ifDescr.includes('Eth-Trunk')) {
          snmpIfIndexMap.set(ifIndex, ifDescr);
          if (!newCounters.has(ifIndex)) {
            newCounters.set(ifIndex, {
              ifIndex,
              ifDescr,
              inOctets: BigInt(0),
              outOctets: BigInt(0),
              ifOperStatus: 1,
              timestamp: Date.now(),
            });
          }
        }
      }
    }, (error) => {
      if (error) {
        console.error('[NE8000 SNMP ifDescr] Error:', error.message);
        session.close();
        return;
      }

      // Now get HC counters for the interfaces we care about
      const oids: string[] = [];
      for (const [ifIndex] of snmpIfIndexMap) {
        oids.push(`${ifHCInOid}.${ifIndex}`);
        oids.push(`${ifHCOutOid}.${ifIndex}`);
      }

      if (oids.length === 0) { session.close(); return; }

      // Split into chunks of 40 OIDs (SNMP limit)
      const chunks: string[][] = [];
      for (let i = 0; i < oids.length; i += 40) {
        chunks.push(oids.slice(i, i + 40));
      }

      let completed = 0;
      for (const chunk of chunks) {
        session.get(chunk, (err, varbinds) => {
          if (!err && varbinds) {
            for (const vb of varbinds) {
              if (snmp.isVarbindError(vb)) continue;
              const parts = vb.oid.split('.');
              const ifIndex = parseInt(parts[parts.length - 1]);
              const isIn = vb.oid.includes(ifHCInOid);

              const counter = newCounters.get(ifIndex);
              if (counter) {
                let val: bigint;
                try {
                  if (typeof vb.value === 'bigint') {
                    val = vb.value;
                  } else if (Buffer.isBuffer(vb.value)) {
                    // Counter64 comes as Buffer from net-snmp
                    val = BigInt('0x' + vb.value.toString('hex'));
                  } else if (typeof vb.value === 'number') {
                    val = BigInt(vb.value);
                  } else {
                    val = BigInt(0);
                  }
                } catch {
                  val = BigInt(0);
                }
                if (isIn) counter.inOctets = val;
                else counter.outOctets = val;
                counter.timestamp = Date.now();
              }
            }
          }

          completed++;
          if (completed >= chunks.length) {
            // Calculate deltas
            calculateTrafficRates(newCounters);
            lastSnmpCounters = newCounters;
            session.close();
          }
        });
      }
    });
  } catch (err: any) {
    console.error('[NE8000 SNMP] Error:', err.message);
  }
}

function calculateTrafficRates(newCounters: Map<number, SnmpInterfaceCounters>): void {
  for (const [ifIndex, newC] of newCounters) {
    const oldC = lastSnmpCounters.get(ifIndex);
    if (!oldC) continue;

    const timeDelta = (newC.timestamp - oldC.timestamp) / 1000; // seconds
    if (timeDelta <= 0) continue;

    let inDelta = newC.inOctets - oldC.inOctets;
    let outDelta = newC.outOctets - oldC.outOctets;

    // Handle counter wrap
    if (inDelta < BigInt(0)) inDelta = BigInt(0);
    if (outDelta < BigInt(0)) outDelta = BigInt(0);

    const inBps = Number(inDelta * BigInt(8)) / timeDelta;
    const outBps = Number(outDelta * BigInt(8)) / timeDelta;

    const ifName = snmpIfIndexMap.get(ifIndex) || '';
    snmpTraffic.set(ifName, { inBps, outBps });

    // Add to history
    if (!trafficHistory.has(ifName)) {
      trafficHistory.set(ifName, []);
    }
    const history = trafficHistory.get(ifName)!;
    history.push({ time: Date.now(), inBps, outBps });
    if (history.length > MAX_HISTORY_POINTS) {
      history.splice(0, history.length - MAX_HISTORY_POINTS);
    }
  }
}

// ============================================================
// PUBLIC API
// ============================================================
export const ne8000Service = {
  startPolling() {
    console.log('[NE8000] Starting data collection...');

    // Initial collection - stagger to avoid overloading NE8000
    setTimeout(() => collectSystemVersion(), 3000);
    setTimeout(() => collectSSHData(), 15000);
    setTimeout(() => collectBGPData(), 30000);

    // SSH data every 60 seconds (CPU, Memory, PPPoE, Interfaces)
    setInterval(() => {
      if (!isCollecting) {
        isCollecting = true;
        collectSSHData().finally(() => { isCollecting = false; });
      }
    }, 60000);

    // BGP data every 5 minutes (requires VS switch, takes ~25s)
    setInterval(() => collectBGPData(), 300000);

    // Version/uptime every 5 minutes
    setInterval(() => collectSystemVersion(), 300000);

    // SNMP traffic every 15 seconds
    setTimeout(() => collectSNMPTraffic(), 5000);
    setInterval(() => collectSNMPTraffic(), 15000);
  },

  getDashboard() {
    // Top interfaces by traffic
    const topInterfaces = [...interfaces]
      .filter(i => i.name.startsWith('GigabitEthernet') || i.name.startsWith('Eth-Trunk'))
      .map(i => {
        const traffic = snmpTraffic.get(i.name);
        return { ...i, inBps: traffic?.inBps || 0, outBps: traffic?.outBps || 0 };
      })
      .sort((a, b) => (b.inBps + b.outBps) - (a.inBps + a.outBps))
      .slice(0, 10);

    // Total traffic
    let totalInBps = 0, totalOutBps = 0;
    for (const [, t] of snmpTraffic) {
      totalInBps += t.inBps;
      totalOutBps += t.outBps;
    }

    return {
      system: systemInfo,
      pppoe: pppoeInfo,
      topInterfaces,
      totalTraffic: { inBps: totalInBps, outBps: totalOutBps },
      bgpSummary: {
        total: bgpPeers.length,
        established: bgpPeers.filter(p => p.state === 'Established').length,
      },
      lastCollect: lastCollectTime,
      lastError: lastCollectError,
    };
  },

  getInterfaces() {
    return interfaces.map(i => {
      const traffic = snmpTraffic.get(i.name);
      return {
        ...i,
        inBps: traffic?.inBps || 0,
        outBps: traffic?.outBps || 0,
      };
    });
  },

  getInterfaceTraffic(name: string, hours = 2) {
    const history = trafficHistory.get(name) || [];
    const cutoff = Date.now() - hours * 3600 * 1000;
    return history.filter(p => p.time > cutoff);
  },

  getBgpPeers() {
    return bgpPeers;
  },

  getSystem() {
    return systemInfo;
  },

  getPppoe() {
    return pppoeInfo;
  },

  getBridgeDomains() {
    return bridgeDomains;
  },

  getTrafficHistory() {
    const result: Record<string, TrafficPoint[]> = {};
    for (const [name, history] of trafficHistory) {
      result[name] = history;
    }
    return result;
  },

  // Get list of main physical ports (slot 0/7)
  getMainPorts() {
    const mainPorts = interfaces.filter(i =>
      /^GigabitEthernet0\/7\/\d+$/.test(i.name)
    );
    return mainPorts.map(p => {
      const traffic = snmpTraffic.get(p.name);
      return { ...p, inBps: traffic?.inBps || 0, outBps: traffic?.outBps || 0 };
    });
  },
};
