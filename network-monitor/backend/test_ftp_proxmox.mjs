import { Client } from 'ssh2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testFTP() {
  const ip = '10.201.11.86'; 
  const ap = await prisma.accessPoint.findUnique({ where: { ip } });
  
  if (!ap) { console.error('AP n encontrado'); return; }

  const conn = new Client();
  conn.on('ready', () => {
    console.log('SSH conectado no MikroTik:', ip);
    
    const cmd = `
:local namefilersc "teste_PROX.rsc"
/export file=$namefilersc
:delay 5s
/tool fetch address=217.216.86.231 port=21 user=matrix password=suporte10025 src-path=$namefilersc mode=ftp upload=yes dst-path=$namefilersc
:delay 5s
/file remove $namefilersc
`;

    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      let out = '';
      stream.on('close', () => {
        console.log('Comando finalizado');
        console.log("FINAL OUT:", out);
        conn.end();
      }).on('data', (data) => {
        out += data.toString();
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        out += data.toString();
        process.stderr.write(data.toString());
      });
    });
  }).on('error', (err) => {
    console.error('Erro SSH:', err);
  }).connect({
    host: ip,
    port: ap.sshPort || 22,
    username: ap.sshUser || 'N3tc@r',
    password: ap.sshPass || 'AdminiStracao2021',
    readyTimeout: 10000
  });
}
testFTP();
