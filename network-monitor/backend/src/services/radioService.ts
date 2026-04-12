import snmp from 'net-snmp';
import ping from 'ping';
import { Client } from 'ssh2';
import { prisma } from '../db.js';

// Credenciais fornecidas pelo usuário
export const PASSWORDS = [
  { user: 'N3tc@r', pass: 'AdminiStracao2021' },
  { user: 'n3tc@r', pass: 'AdminiStracao2021' },
  { user: 'matrix', pass: 'matrix' },
  { user: 'matrix', pass: 'Matrix' },
  { user: 'Matrix', pass: 'matrix' },
  { user: 'admin', pass: '' },
  { user: 'admin', pass: 'N3tc@r AdminiStracao2021' }
];

const OIDS = {
  signal: "1.3.6.1.4.1.41112.1.4.1.1.5.1",
  ccq: "1.3.6.1.4.1.41112.1.4.1.1.8.1",
  uptime: "1.3.6.1.2.1.1.3.0",
};

export const SSH_ALGORITHMS = {
  serverHostKey: [ 'ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521' ],
  kex: [ 
    'diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha1',
    'diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'
  ],
  cipher: [ 
    'aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', '3des-cbc', 'aes256-cbc',
    'aes128-gcm', 'aes256-gcm', 'aes128-gcm@openssh.com', 'aes256-gcm@openssh.com'
  ],
  mac: [ 'hmac-sha1', 'hmac-md5', 'hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1-96', 'hmac-md5-96' ]
};

export const radioService = {
  async checkPing(ip: string): Promise<{ alive: boolean; latency: number }> {
    if (!ip || ip === '0.0.0.0' || ip === 'IP' || ip.trim() === '') return { alive: false, latency: 0 };
    
    // Tenta até 2 vezes
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await ping.promise.probe(ip, { timeout: 3 });
        if (res.alive) {
          return { 
            alive: true, 
            latency: parseFloat(res.avg) 
          };
        }
      } catch (err) {
        console.error(`Erro no ping (tentativa ${attempt}) para ${ip}:`, err);
      }
      
      // Se não for a última tentativa, espera um pouco
      if (attempt < 2) await new Promise(r => setTimeout(r, 500));
    }

    return { alive: false, latency: 0 };
  },

  async getRadioData(ip: string, mac?: string) {
    const pingRes = await this.checkPing(ip);
    if (!pingRes.alive) return { mac: mac || 'N/A', signal: 0, ccq: 0, status: 'OFFLINE', uptime: 'N/A', latency: 0 };

    try {
      const snmpData: any = await this.fetchSNMP(ip);
      return { ...snmpData, mac: mac || 'N/A', status: 'ONLINE' };
    } catch (e) {
      return {
        mac: mac || 'N/A',
        signal: -50,
        ccq: 100,
        status: 'ONLINE',
        uptime: 'Ping OK (SNMP Timeout)'
      };
    }
  },

  fetchSNMP(ip: string, community = "N3tc@rSNMP"): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const session = snmp.createSession(ip, community, { timeout: 2000, retries: 0 });
        session.on("error", (err) => {
           try { session.close(); } catch {}
           reject(err);
        });
        session.get([OIDS.signal, OIDS.ccq, OIDS.uptime], (error, varbinds) => {
          if (error) {
            session.close();
            if (community === "N3tc@rSNMP") {
              // Fallback para public
              resolve(this.fetchSNMP(ip, "public"));
            } else {
              reject(error);
            }
          } else if (varbinds && varbinds.length >= 3) {
            const data = {
              signal: varbinds[0].value,
              ccq: varbinds[1].value,
              uptime: varbinds[2].value ? varbinds[2].value.toString() : 'N/A'
            };
            session.close();
            resolve(data);
          } else {
            session.close();
            reject(new Error("Resposta SNMP incompleta"));
          }
        });
      } catch (e) { reject(e); }
    });
  },

  async findMacInAPs(mac: string, apList: { name: string, ip: string }[]) {
    console.log(`[SWEEP] Localizando MAC ${mac} em ${apList.length} APs (Modo Rápido)...`);
    const formattedMac = mac.toUpperCase();
    const CHUNK_SIZE = 50; 

    for (let i = 0; i < apList.length; i += CHUNK_SIZE) {
      const batch = apList.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(batch.map(async (ap) => {
        if (!ap.ip || ap.ip === '0.0.0.0') return null;
        
        // 1. Tentar APENAS credencial específica do banco (Velocidade máxima)
        const dbAp = await prisma.accessPoint.findUnique({ where: { ip: ap.ip } });
        if (dbAp?.sshUser && dbAp?.sshPass) {
          try {
            const data: any = await this.getMikrotikClientInfo(ap.ip, dbAp.sshUser, dbAp.sshPass, formattedMac, dbAp.sshPort || 22);
            if (data) return { ap, info: data };
          } catch (e: any) {
            // Falha na conexão ou auth, ignora e segue
          }
        } else {
          // 2. Se não tem no banco, tenta apenas o primeiro par padrão (evita looping de senhas na varredura real-time)
          try {
            const cred = PASSWORDS[0];
            const data: any = await this.getMikrotikClientInfo(ap.ip, cred.user, cred.pass, formattedMac);
            if (data) return { ap, info: data };
          } catch (e: any) {
            // Ignora
          }
        }
        return null;
      }));

      const found = results.find(r => r !== null);
      if (found) return found;
    }
    return null;
  },

  getMikrotikClientInfo(host: string, username: string, password: string, mac: string, port: number = 22) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let output = '';
      
      const timer = setTimeout(() => {
        conn.destroy();
        reject(new Error('Timeout customizado'));
      }, 3000); // Reduzido de 4s para 3s

      conn.on('ready', () => {
        conn.exec(`/interface wireless registration-table print stats where mac-address=${mac}`, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            return reject(err);
          }
          stream.on('data', (data: Buffer) => {
            output += data.toString();
          }).on('error', (e: Error) => {
            clearTimeout(timer);
            conn.end();
            reject(e);
          }).on('close', () => {
            clearTimeout(timer);
            conn.end();
            if (output.includes(mac)) {
              resolve({
                connected: true,
                signal: this.parseSignal(output) || -50,
                ccq: 100
              });
            } else {
              resolve(null);
            }
          });
        });
      }).on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      }).connect({ 
        host, username, password, port,
        timeout: 2500, // Reduzido de 3s para 2.5s
        readyTimeout: 2500,
        algorithms: SSH_ALGORITHMS as any
      });
    });
  },

  async getWirelessMode(ip: string, user?: string, pass?: string, port?: number): Promise<{mode: 'AP' | 'STATION' | 'UNKNOWN', mac?: string}> {
    // Tenta credencial específica primeiro
    if (user && pass) {
      try {
        const output: any = await this.runMikrotikCommand(ip, user, pass, '/interface wireless print', port || 22);
        return this.parseWirelessInfoExtended(output);
      } catch (e) {}
    }

    // Fallback para lista de senhas padrão
    for (const cred of PASSWORDS) {
      try {
        const output: any = await this.runMikrotikCommand(ip, cred.user, cred.pass, '/interface wireless print');
        const info = this.parseWirelessInfoExtended(output);
        if (info.mode !== 'UNKNOWN') return info;
      } catch (e) { continue; }
    }
    return { mode: 'UNKNOWN' };
  },

  parseWirelessInfoExtended(output: string): {mode: 'AP' | 'STATION' | 'UNKNOWN', mac?: string} {
    if (!output) return { mode: 'UNKNOWN' };
    const lowerOutput = output.toLowerCase();
    
    // Extrai MAC: mac-address=XX:XX:XX:XX:XX:XX
    const macMatch = output.match(/mac-address=([0-9A-Fa-f:]{17})/);
    const mac = macMatch ? macMatch[1] : undefined;

    if (lowerOutput.includes('ap-bridge') || lowerOutput.includes('bridge')) return { mode: 'AP', mac };
    if (lowerOutput.includes('station')) return { mode: 'STATION', mac };
    return { mode: 'UNKNOWN', mac };
  },

  async getAllConnectedMacs(ip: string, user?: string, pass?: string, port?: number): Promise<{mac: string, signal: number, ccq: number}[]> {
    if (user && pass) {
      try {
        const output = await this.runMikrotikCommand(ip, user, pass, '/interface wireless registration-table print stats', port || 22);
        if (output) return this.parseBulkMacs(output as string);
      } catch (e) {}
    }

    for (const cred of PASSWORDS) {
      try {
        const output = await this.runMikrotikCommand(ip, cred.user, cred.pass, '/interface wireless registration-table print stats');
        if (output) return this.parseBulkMacs(output as string);
      } catch (e: any) { continue; }
    }
    return [];
  },

  runMikrotikCommand(host: string, username: string, password: string, command: string, port: number = 22) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let output = '';
      const timer = setTimeout(() => { conn.destroy(); reject(new Error('Timeout')); }, 6000);

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) { clearTimeout(timer); conn.end(); return reject(err); }
          stream.on('data', (data: Buffer) => { output += data.toString(); })
          .on('error', (e: Error) => { clearTimeout(timer); conn.end(); reject(e); })
          .on('close', () => { clearTimeout(timer); conn.end(); resolve(output); });
        });
      }).on('error', (err) => { clearTimeout(timer); reject(err); })
      .connect({ host, username, password, port, timeout: 4000, readyTimeout: 4000, algorithms: SSH_ALGORITHMS as any });
    });
  },

  async getDeviceDetails(ip: string, user?: string, pass?: string, port?: number) {
    const creds = await this.resolveCredentials(ip, user, pass, port);
    if (!creds) return null;

    try {
      // Coleta múltiplos dados em uma única conexão SSH para performance
      const commands = [
        '/system resource print',
        '/system health print',
        '/system identity print',
        '/interface wireless print',
        '/interface wireless registration-table print stats'
      ];
      
      const results = await Promise.all(commands.map(cmd => 
        this.runMikrotikCommand(ip, creds.user, creds.pass, cmd, creds.port)
      ));

      return {
        resources: this.parseSystemResources(results[0] as string),
        health: this.parseSystemHealth(results[1] as string),
        identity: results[2],
        wireless: this.parseWirelessInfo(results[3] as string),
        clients: this.parseDetailedClients(results[4] as string)
      };
    } catch (e) {
      return null;
    }
  },

  async resolveCredentials(ip: string, user?: string, pass?: string, port?: number) {
    if (user && pass) return { user, pass, port: port || 22 };
    for (const cred of PASSWORDS) {
      try {
        await this.runMikrotikCommand(ip, cred.user, cred.pass, '/system identity print');
        return { ...cred, port: 22 };
      } catch (e) { continue; }
    }
    return null;
  },

  parseSystemResources(output: string) {
    const cpu = output.match(/cpu-load: (\d+)%/);
    const uptime = output.match(/uptime: (.*)/);
    const memory = output.match(/free-memory: ([\d.]+[A-Z]+)/);
    const totalMem = output.match(/total-memory: ([\d.]+[A-Z]+)/);
    return {
      cpuLoad: cpu ? cpu[1] + '%' : 'N/A',
      uptime: uptime ? uptime[1].trim() : 'N/A',
      freeMemory: memory ? memory[1] : 'N/A',
      totalMemory: totalMem ? totalMem[1] : 'N/A'
    };
  },

  parseSystemHealth(output: string) {
    const temp = output.match(/temperature: (\d+)/);
    const voltage = output.match(/voltage: ([\d.]+)/);
    return {
      temperature: temp ? temp[1] + '°C' : 'N/A',
      voltage: voltage ? voltage[1] + 'V' : 'N/A'
    };
  },

  parseWirelessInfo(output: string) {
    const freq = output.match(/frequency=(\d+)/);
    const noise = output.match(/noise-floor=(-?\d+)/);
    return {
      frequency: freq ? freq[1] + 'MHz' : 'N/A',
      noiseFloor: noise ? noise[1] + 'dBm' : 'N/A'
    };
  },

  parseDetailedClients(output: string) {
    const clients: any[] = [];
    const entries = output.split(/\d+\s+interface=/);
    for (const entry of entries) {
      const macMatch = entry.match(/mac-address=([0-9A-F:]{17})/);
      if (macMatch) {
        const signal = entry.match(/signal-strength=(-?\d+)/);
        const txRate = entry.match(/tx-rate="([^"]+)"/);
        const rxRate = entry.match(/rx-rate="([^"]+)"/);
        const uptime = entry.match(/uptime=(.*)/);
        clients.push({
          mac: macMatch[1],
          signal: signal ? signal[1] + 'dBm' : 'N/A',
          txRate: txRate ? txRate[1] : 'N/A',
          rxRate: rxRate ? rxRate[1] : 'N/A',
          uptime: uptime ? uptime[1].split(' ')[0] : 'N/A'
        });
      }
    }
    return clients;
  },

  parseBulkMacs(output: string): {mac: string, signal: number, ccq: number}[] {
    const clients: {mac: string, signal: number, ccq: number}[] = [];
    const entries = output.split(/\d+\s+interface=/);
    for (const entry of entries) {
      const macMatch = entry.match(/mac-address=([0-9A-F:]{17})/);
      if (macMatch) {
        const signalMatch = entry.match(/signal-strength=(-?\d+)/);
        const rxCcqMatch = entry.match(/rx-ccq=(\d+)/);
        clients.push({
          mac: macMatch[1],
          signal: signalMatch ? parseInt(signalMatch[1]) : -50,
          ccq: rxCcqMatch ? parseInt(rxCcqMatch[1]) : 100
        });
      }
    }
    return clients;
  },

  parseSignal(output: string): number | null {
    const match = output.match(/signal-strength=(-?\d+)/);
    return match ? parseInt(match[1]) : null;
  }
};
