import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  conn.exec('ls -lh /home/mikrotik/backups', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log('--- CONTEÚDO DO FTP ---');
      console.log(out || '(Pasta Vazia)');
      conn.end();
    }).on('data', (data) => {
      out += data.toString();
    });
  });
}).on('error', err => console.error('SSH Error:', err.message)).connect({
  host: '217.216.86.231',
  port: 22,
  username: 'root',
  password: 'suporte10025',
  readyTimeout: 5000
});
