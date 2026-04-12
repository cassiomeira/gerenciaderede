import { Client } from 'ssh2';

const PASSWORDS = [
  { user: 'N3tc@r', pass: 'AdminiStracao2021' },
  { user: 'admin', pass: 'N3tc@r AdminiStracao2021' },
  { user: 'matrix', pass: 'matrix' },
  { user: 'admin', pass: '' },
  { user: 'admin', pass: 'NETC@R MANU@)@(' }
];

async function testAP(ip: string, targetMac: string) {
  console.log(`\n--- Testando AP: ${ip} ---`);
  console.log(`Buscando MAC: ${targetMac}`);

  for (const cred of PASSWORDS) {
    try {
      console.log(`Tentativa com usuário: ${cred.user}...`);
      const result = await getMikrotikInfo(ip, cred.user, cred.pass, targetMac);
      if (result) {
        console.log(`✅ SUCESSO! MAC localizado no AP ${ip}`);
        console.log(`Dados retornados:`, result);
        return;
      } else {
        console.log(`❌ MAC não encontrado nesta antena.`);
      }
    } catch (e: any) {
      console.log(`⚠️ Falha na conexão (${cred.user}):`, e.message);
    }
  }
}

function getMikrotikInfo(host: string, username: string, password: string, mac: string) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    
    conn.on('ready', () => {
      conn.exec(`/interface wireless registration-table print stats where mac-address=${mac.toUpperCase()}`, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        }).on('close', () => {
          conn.end();
          if (output.includes(mac.toUpperCase())) {
            resolve({
              output: output.trim(),
              signal: parseSignal(output)
            });
          } else {
            resolve(null);
          }
        });
      });
    }).on('error', (err) => {
      reject(err);
    }).connect({ 
      host, 
      username, 
      password, 
      timeout: 5000,
      algorithms: {
        serverHostKey: [ 'ssh-rsa', 'ssh-dss' ],
        kex: [ 'diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1' ],
        cipher: [ 'aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', '3des-cbc' ]
      }
    });
  });
}

function parseSignal(output: string): string | null {
  const match = output.match(/signal-strength=(-?\d+dBm)/);
  return match ? match[1] : null;
}

// Executar teste
const targetIP = "10.200.15.27";
const targetMAC = "4C:5E:0C:C1:95:2B";

testAP(targetIP, targetMAC);
