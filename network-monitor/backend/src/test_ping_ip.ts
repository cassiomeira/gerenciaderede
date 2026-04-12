import ping from 'ping';

async function testPing() {
    const ip = '10.1.15.153';
    console.log(`Testando ping para ${ip}...`);
    try {
        const res = await ping.promise.probe(ip, { timeout: 2 });
        console.log('Resultado:', {
            alive: res.alive,
            latency: res.avg,
            full: res
        });
    } catch (err) {
        console.error('Erro no ping:', err);
    }
}

testPing();
