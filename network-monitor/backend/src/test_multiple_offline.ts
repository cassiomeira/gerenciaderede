import ping from 'ping';

async function testMultiplePings() {
    const ips = ['10.201.11.187', '10.201.11.181', '10.201.11.156', '10.200.15.147', '10.200.15.69'];
    console.log(`Testando múltiplos pings via biblioteca...`);
    
    for (const ip of ips) {
        try {
            const res = await ping.promise.probe(ip, { timeout: 2 });
            console.log(`IP ${ip}: ${res.alive ? 'ALIVE' : 'DEAD'} (${res.avg}ms)`);
        } catch (err) {
            console.error(`Erro no ping para ${ip}:`, err);
        }
    }
}

testMultiplePings();
