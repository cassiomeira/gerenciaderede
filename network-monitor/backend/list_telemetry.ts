import { prisma } from './src/db.js';

async function list() {
  const all = await (prisma as any).deviceTelemetry.findMany({
    take: 10,
    orderBy: { collectedAt: 'desc' }
  });
  
  console.log(`--- ULTIMAS 10 TELEMETRIAS ---`);
  all.forEach((t: any) => {
    console.log(`IP: [${t.ip}] - Host: ${t.identity} - At: ${t.collectedAt}`);
  });
  process.exit();
}

list();
