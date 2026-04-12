import { Client } from 'ssh2';

const ip = '10.100.16.44';
const user = 'matrix';
const pass = 'matrix';

console.log(`--- Testing SSH for ${ip} with DEFAULT algorithms ---`);

const conn = new Client();
conn.on('ready', () => {
    console.log('[SUCCESS] Connected with default algorithms!');
    conn.end();
}).on('error', (err) => {
    console.log(`[FAIL] Error: ${err.message}`);
}).on('banner', (msg) => {
    console.log(`[BANNER] ${msg.trim()}`);
}).connect({
    host: ip,
    port: 22,
    username: user,
    password: pass,
    readyTimeout: 10000
});
