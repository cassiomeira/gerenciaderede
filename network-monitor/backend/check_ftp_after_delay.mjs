import { Client } from 'ssh2';

console.log('Aguardando os delays de segurança do RouterOS terminarem (30s)...');
setTimeout(() => {
  const pconn = new Client();
  pconn.on('ready', () => {
    pconn.exec('ls -lh /home/mikrotik/backups', (err, stream) => {
      let out = '';
      stream.on('close', () => {
        console.log('\\n--- ARQUIVOS PROXMOX ---');
        console.log(out);
        pconn.end();
      }).on('data', (data) => out += data.toString());
    });
  }).connect({
    host: '217.216.86.231',
    port: 22,
    username: 'root',
    password: 'suporte10025'
  });
}, 30000);
