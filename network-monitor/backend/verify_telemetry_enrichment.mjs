async function verify() {
  const res = await fetch('http://localhost:3001/api/transmitters');
  const transmitters = await res.json();
  const sample = transmitters.slice(0, 5);
  console.log('--- AMOSTRA DE TRANSMISSORES COM TELEMETRIA ---');
  sample.forEach(ap => {
    console.log(`[${ap.status}] ${ap.descricao} (${ap.ip})`);
    console.log(`- Freq: ${ap.frequency}`);
    console.log(`- SSID: ${ap.ssid}`);
    console.log(`- Data Telemetria: ${ap.lastTelemetryDate || 'N/A'}`);
    console.log('---');
  });
}
verify();
