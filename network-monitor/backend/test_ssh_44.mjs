import { Client } from 'ssh2';

const ip = '10.100.16.44';
const port = 22;
const credentials = [
  { user: 'matrix', pass: 'matrix' },
  { user: 'matrix', pass: 'matrix ' },
  { user: 'Matrix', pass: 'Matrix' },
  { user: 'admin', pass: '' },
  { user: 'N3tc@r', pass: 'AdminiStracao2021' }
];

async function test() {
  console.log(`--- Testing SSH for ${ip}:${port} ---`);
  
  for (const cred of credentials) {
    console.log(`Trying ${cred.user} / "${cred.pass}"...`);
    try {
      await new Promise((resolve, reject) => {
        const conn = new Client();
        conn.on('ready', () => {
          console.log(`[SUCCESS] Connected with ${cred.user}!`);
          conn.end();
          resolve(true);
        }).on('error', (err) => {
          console.log(`[FAIL] ${err.message}`);
          reject(err);
        }).on('banner', (msg) => {
            console.log(`[BANNER] ${msg.trim()}`);
        }).connect({
          host: ip,
          port,
          username: cred.user,
          password: cred.pass,
          readyTimeout: 10000,
          algorithms: {
            serverHostKey: [ 'ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521' ],
            kex: [ 'diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha1', 'diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521' ],
            cipher: [ 'aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', '3des-cbc', 'aes256-cbc', 'aes128-gcm', 'aes256-gcm' ]
          }
        });
      });
      break;
    } catch (e) {}
  }
}

test();
