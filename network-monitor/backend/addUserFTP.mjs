import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('Autenticado no servidor com sucesso.');
  
  // Cria o usuário 'matrix' sem criar nova pasta home (-M)
  // Define o diretório inicial (-d) direto na pasta de backups
  // Coloca no grupo mikrotik (-g)
  const cmd = `
    useradd -d /home/mikrotik/backups -g mikrotik -M matrix || true
    echo "matrix:suporte10025" | chpasswd
    systemctl restart vsftpd
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Comando concluido. Status:', code);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).on('error', (err) => {
  console.log('Erro SSH:', err);
}).connect({
  host: '217.216.86.231',
  port: 22,
  username: 'root',
  password: 'suporte10025',
  readyTimeout: 10000
});
