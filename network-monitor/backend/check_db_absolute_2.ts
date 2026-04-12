import { PrismaClient } from '@prisma/client';

const ip = '10.201.11.118';
// Tentando o OUTRO caminho do banco
const dbPath = 'c:/aplicativos/gerenciaderede/gerenciaderede/network-monitor/backend/prisma/prisma/dev.db';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
});

async function check() {
  console.log('--- REVISANDO ACCESS POINT E TELEMETRIA (118) - BANCO 2 ---');
  try {
    const ap = await prisma.accessPoint.findUnique({ where: { ip } });
    const telemetry = await (prisma as any).deviceTelemetry.findFirst({ where: { ip } });
    
    console.log('ACCESS POINT:', {
      ip: ap?.ip,
      status: ap?.status,
      lastSshStatus: ap?.lastSshStatus
    });
    
    if (telemetry) {
      console.log('TELEMETRIA ENCONTRADA:', {
        identity: telemetry.identity,
        collectedAt: telemetry.collectedAt,
        isSnmpOnly: telemetry.isSnmpOnly
      });
    } else {
      console.log('NENHUMA TELEMETRIA NO BANCO 2.');
    }
  } catch (e: any) {
    console.error('ERRO NO BANCO 2:', e.message);
  }
  process.exit();
}

check();
