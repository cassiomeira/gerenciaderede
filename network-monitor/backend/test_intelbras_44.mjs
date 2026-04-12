import { Client } from 'ssh2';

const ip = '10.200.15.53';
const user = 'NETC@R';
const pass = 'MANU@)@(';

const SSH_ALGORITHMS = {
  serverHostKey: [ 'ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521' ],
  kex: [ 
    'diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha1',
    'diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'
  ],
  cipher: [ 
    'aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', '3des-cbc', 'aes256-cbc',
    'aes128-gcm', 'aes256-gcm', 'aes128-gcm@openssh.com', 'aes256-gcm@openssh.com'
  ],
  mac: [ 'hmac-sha1', 'hmac-md5', 'hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1-96', 'hmac-md5-96' ]
};

console.log(`--- Testing Intelbras SSH for ${ip} with LEGACY ALGORITHMS ---`);

const conn = new Client();
conn.on('ready', () => {
    console.log('[SUCCESS] Connected!');
    
    // Tenta comandos comuns de Intelbras
    conn.exec('help', (err, stream) => {
        if (err) {
            console.log(`[EXEC ERROR] ${err.message}`);
            conn.end();
            return;
        }
        stream.on('data', (data) => {
            console.log(`[OUTPUT]:\n${data.toString()}`);
        }).on('close', () => {
            console.log('--- Help output finished ---');
            // Tenta 'status'
            conn.exec('status', (err2, stream2) => {
                if (!err2) {
                    stream2.on('data', (d) => console.log(`[STATUS]:\n${d.toString()}`))
                           .on('close', () => conn.end());
                } else {
                    conn.end();
                }
            });
        });
    });
}).on('error', (err) => {
    console.log(`[FAIL] Error: ${err.message}`);
}).on('banner', (msg) => {
    console.log(`[BANNER]: ${msg.trim()}`);
}).connect({
    host: ip,
    port: 22,
    username: user,
    password: pass,
    readyTimeout: 15000,
    algorithms: SSH_ALGORITHMS
});
