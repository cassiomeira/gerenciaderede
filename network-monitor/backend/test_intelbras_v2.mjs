import { Client } from 'ssh2';

const ip = '10.200.15.53';
const credentials = [
  { user: 'NETC@R', pass: 'MANU@)@(' },
  { user: 'netc@r', pass: 'MANU@)@(' },
  { user: 'NETC@R', pass: 'manu@)@(' },
  { user: 'admin', pass: 'admin' },
  { user: 'admin', pass: 'MANU@)@(' }
];

const SSH_ALGORITHMS = {
  serverHostKey: [ 'ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521' ],
  kex: [ 
    'diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha1',
    'diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'
  ],
  cipher: [ 
    'aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', '3des-cbc', 'aes256-cbc',
    'aes128-gcm', 'aes256-gcm'
  ],
  mac: [ 'hmac-sha1', 'hmac-md5', 'hmac-sha2-256', 'hmac-sha2-512' ]
};

async function test() {
    for (const cred of credentials) {
        console.log(`--- Testing ${cred.user} / ${cred.pass} ---`);
        try {
            await new Promise((resolve, reject) => {
                const conn = new Client();
                conn.on('ready', () => {
                    console.log(`[SUCCESS] Connected with ${cred.user}!`);
                    conn.exec('uptime', (err, stream) => {
                        if (!err) {
                            stream.on('data', (d) => console.log(`[UPTIME]: ${d.toString()}`))
                                  .on('close', () => { conn.end(); resolve(true); });
                        } else {
                            conn.end(); resolve(true);
                        }
                    });
                }).on('error', (err) => {
                    console.log(`[FAIL] ${err.message}`);
                    reject(err);
                }).connect({
                    host: ip, port: 22, username: cred.user, password: cred.pass,
                    readyTimeout: 15000,
                    algorithms: SSH_ALGORITHMS
                });
            });
            break; // Se deu certo, para
        } catch (e) {}
    }
}

test();
