import net from 'net';

const ip = '10.100.16.44';
const port = 22;

const socket = net.connect(port, ip, () => {
    console.log(`Connected to ${ip}:${port}`);
});

socket.on('data', (data) => {
    console.log(`Received: ${data.toString().trim()}`);
    socket.destroy();
});

socket.on('error', (err) => {
    console.log(`Error: ${err.message}`);
});

setTimeout(() => {
    console.log('Timeout waiting for data');
    socket.destroy();
}, 5000);
