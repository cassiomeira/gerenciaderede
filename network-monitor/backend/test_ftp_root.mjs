import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH conectado no MikroTik 10.201.11.86');
  const cmd = `
:local routerName [/system identity get name]
:local fixedDate "19Mar"
:local routerIP "10.201.11"
:local namefilersc ($routerName . "_" . $routerIP . "_" . $fixedDate . ".rsc")
/export file=$namefilersc
:delay 5s
/tool fetch address=217.216.86.231 user=matrix password=suporte10025 src-path="$namefilersc" mode=ftp upload=yes port=21 dst-path="$namefilersc"
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
    }).stderr.on('data', (data) => {
      out += 'STDERR: ' + data.toString();
    });
  });
}).on('error', err => console.error('SSH Error:', err)).connect({
  host: '10.201.11.86',
  port: 22,
  username: 'N3tc@r',
  password: 'AdminiStracao2021',
  readyTimeout: 10000
});
