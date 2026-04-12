import { Client } from 'ssh2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  const ip = '10.201.11.86';
  const ap = await prisma.accessPoint.findUnique({ where: { ip } });
  
  const conn = new Client();
  conn.on('ready', () => {
    console.log('SSH conectado no MikroTik:', ip);

    const cmd = `
:local routerName [/system identity get name];
:local routerIP "";
:foreach i in=[/ip address find disabled=no dynamic=no] do={
  :if ([:len \\$routerIP] = 0) do={
    :local raw [/ip address get \\$i address];
    :set routerIP [:pick \\$raw 0 [:find \\$raw "/"]];
  }
};
:local date [/system clock get date];
:local fixedDate [:pick \\$date 0 3][:pick \\$date 4 6][:pick \\$date 7 11];

:local namefilersc (\\$routerName . "_" . \\$routerIP . "_" . \\$fixedDate . ".rsc");

/export file=\\$namefilersc;
:delay 5s;
/tool fetch address=217.216.86.231 user=matrix password=suporte10025 src-path=\\$namefilersc mode=ftp upload=yes port=21 dst-path=\\$namefilersc;
:delay 5s;
/file remove [find name=\\$namefilersc];

:local namefilebkp (\\$routerName . "_" . \\$routerIP . "_" . \\$fixedDate . ".backup");
/system backup save name=\\$namefilebkp password=10025-MATRIX;
:delay 10s;
/tool fetch address=217.216.86.231 user=matrix password=suporte10025 src-path=\\$namefilebkp mode=ftp upload=yes port=21 dst-path=\\$namefilebkp;
:delay 5s;
/file remove [find name=\\$namefilebkp];
`;

    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      stream.on('close', () => {
        console.log('Comando finalizado no MK. Checando Proxmox...');
        conn.end();
        checkProxmox();
      }).on('data', (data) => {
        process.stdout.write("MK_OUT: " + data.toString());
      }).stderr.on('data', (data) => {
        process.stderr.write("MK_ERR: " + data.toString());
      });
    });
  }).on('error', (err) => console.error('Erro SSH:', err)).connect({
    host: ip,
    port: ap?.sshPort || 22,
    username: ap?.sshUser || 'N3tc@r',
    password: ap?.sshPass || 'AdminiStracao2021',
    readyTimeout: 10000
  });
}

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

test();
