import { Client } from 'ssh2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testLocalFTP() {
  const ip = '10.201.11.86'; // Mikrotik do usuario
  const ap = await prisma.accessPoint.findUnique({ where: { ip } });
  
  if (!ap) { console.error('AP n encontrado'); return; }

  const conn = new Client();
  conn.on('ready', () => {
    console.log('SSH conectado no MikroTik:', ip);
    
    // Comando para testar o FTP local do usuario
    const cmd = `
:local namefilersc "teste_LOCAL.rsc"
/export file=$namefilersc
:delay 5s
/tool fetch address=192.168.13.2 user=Netcar password=1957ntc src-path=$namefilersc mode=ftp upload=yes port=21 dst-path=("Backup_Mikrotik/" . $namefilersc)
:delay 5s
/file remove $namefilersc
`;

    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      let out = '';
      stream.on('close', () => {
        console.log('Comando finalizado');
        console.log(out);
        conn.end();
      }).on('data', (data) => {
        out += data.toString();
        console.log("STDOUT:", data.toString());
      }).stderr.on('data', (data) => {
        out += 'STDERR: ' + data.toString();
        console.error("STDERR:", data.toString());
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
testLocalFTP();
