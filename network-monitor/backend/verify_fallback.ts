import { forceCollectDevice } from './src/services/telemetryWorker.js';
import { prisma } from './src/db.js';

const ip = '10.201.11.118';

async function test() {
  console.log(`--- TESTANDO FORCE COLLECT COM FALLBACK (IP: ${ip}) ---`);
  
  const success = await forceCollectDevice(ip);
  
  if (success) {
    console.log('SUCESSO! Telemetria coletada (provavelmente via SNMP).');
    const data = await (prisma as any).deviceTelemetry.findFirst({ where: { ip } });
    if (data) {
        console.log('RESULTADO NO BANCO:', {
          identity: data.identity,
          uptime: data.uptime,
          model: data.model,
          cpu: data.cpuLoad,
          isSnmpOnly: data.isSnmpOnly ? 'SIM (SNMP Fallback)' : 'NÃO (SSH)'
        });
    }
  } else {
    console.log('FALHA: Mesmo com SNMP fallback não foi possível coletar.');
  }
  
  process.exit();
}

test();
