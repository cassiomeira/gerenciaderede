import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  conn.exec('df -h /home/mikrotik/backups', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log(out);
      conn.end();
    }).on('data', (data) => {
      out += data.toString();
    });
  });
}).connect({
  host: '217.216.86.231',
  port: 22,
  username: 'root',
  password: 'suporte10025',
  readyTimeout: 10000
});
