import { Client } from 'ssh2';
import ping from 'ping';

const ip = '10.201.11.118';

async function verify() {
  console.log(`--- VERIFICANDO ${ip} ---`);
  
  const p = await ping.promise.probe(ip);
  console.log(`PING: ${p.alive ? 'ALIVE (' + p.time + 'ms)' : 'DEAD'}`);
  
  if (!p.alive) {
    console.log('Cancelando SSH pois IP esta morto no ping.');
    return;
  }

  const conn = new Client();
  conn.on('ready', () => {
    console.log('SSH CONECTADO!');
    conn.end();
  }).on('error', (err) => {
    console.log('ERRO SSH:', err.message);
  }).connect({
    host: ip,
    port: 22,
    username: 'N3tc@r',
    password: 'AdminiStracao2021',
    readyTimeout: 10000,
    algorithms: {
        serverHostKey: [ 'ssh-rsa', 'ssh-dss' ],
        kex: [ 'diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1' ],
        cipher: [ 'aes128-ctr', 'aes128-cbc', '3des-cbc' ]
    }
  });
}
verify();
