import { PrismaClient } from '@prisma/client';
import path from 'path';

const ip = '10.201.11.118';
const dbPath = 'c:/aplicativos/gerenciaderede/gerenciaderede/network-monitor/backend/prisma/dev.db';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
});

async function check() {
  console.log('--- REVISANDO ACCESS POINT E TELEMETRIA (118) ---');
  
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
    console.log('NENHUMA TELEMETRIA NO BANCO.');
  }
  
  process.exit();
}

check();
