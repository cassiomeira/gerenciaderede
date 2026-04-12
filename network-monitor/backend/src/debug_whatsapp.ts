import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

console.log('--- TESTE DE INICIALIZAÇÃO WHATSAPP ---');

const client = new Client({
    puppeteer: {
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-zygote',
        ]
    }
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED:');
    qrcode.toString(qr, {type:'terminal'}, function (err, url) {
        console.log(url);
    });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

console.log('Iniciando o cliente...');
client.initialize().catch(err => {
    console.error('ERRO AO INICIALIZAR:', err);
});
