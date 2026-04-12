import { forceCollectDevice } from './src/services/telemetryWorker.js';
import { prisma } from './src/db.js';

const ip = '10.201.11.118';

async function test() {
  console.log(`--- TESTANDO FORCE COLLECT COM FALLBACK (IP: ${ip}) ---`);
  
  try {
    const success = await forceCollectDevice(ip);
    console.log('Retorno de forceCollectDevice:', success);
    
    const ap = await prisma.accessPoint.findUnique({ where: { ip } });
    console.log('Status no AccessPoint:', ap?.lastSshStatus);
    
    const telemetry = await (prisma as any).deviceTelemetry.findFirst({ where: { ip } });
    if (telemetry) {
        console.log('Telemetria no banco:', telemetry.identity, 'via', telemetry.isSnmpOnly ? 'SNMP' : 'SSH');
    } else {
        console.log('Sem telemetria no banco.');
    }
  } catch (e: any) {
    console.error('ERRO GLOBAL NO TESTE:', e);
  }
  
  process.exit();
}

test();
