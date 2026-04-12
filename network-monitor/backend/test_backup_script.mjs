import { Client } from 'ssh2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testFetch() {
  const ip = '10.201.11.86';
  const ap = await prisma.accessPoint.findUnique({ where: { ip } });
  
  if (!ap) {
    console.error('AP nao encontrado no banco');
    return;
  }

  const user = ap.sshUser || 'N3tc@r';
  const pass = ap.sshPass || 'AdminiStracao2021';
  const port = ap.sshPort || 22;

  const conn = new Client();
  conn.on('ready', () => {
    console.log('SSH conectado no MikroTik:', ip);
    
    // Testa o sftp primeiro
    const cmd = `/system backup save name=testBackup
/export show-sensitive file=testBackup
/tool fetch address=217.216.86.231 port=22 src-path=testBackup.backup user=matrix password=suporte10025 mode=sftp dst-path=testBackup.backup upload=yes
`;

    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      let out = '';
      stream.on('close', (code, signal) => {
        console.log('Comando finalizado');
        console.log(out);
        conn.end();
      }).on('data', (data) => {
        out += data.toString();
      }).stderr.on('data', (data) => {
        out += 'STDERR: ' + data.toString();
      });
    });
  }).on('error', (err) => {
    console.error('Erro SSH:', err);
  }).connect({
    host: ip,
    port: port,
    username: user,
    password: pass,
    readyTimeout: 10000
  });
}
testFetch();
