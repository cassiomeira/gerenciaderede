import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH conectado. Rodando script auto_backup_ftp...');
  conn.exec('/system script run auto_backup_ftp', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log('Script finalizado no MK. Checando arquivos no Proxmox...');
      conn.end();
      checkProxmox();
    }).on('data', (data) => {
      out += data.toString();
    }).stderr.on('data', (data) => {
      out += 'STDERR: ' + data.toString();
    });
  });
}).on('error', err => console.error('Erro SSH:', err)).connect({
  host: '10.201.11.86',
  port: 22,
  username: 'N3tc@r',
  password: 'AdminiStracao2021',
  readyTimeout: 10000
});

function checkProxmox() {
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
}
