import { PrismaClient } from '@prisma/client';
import ping from 'ping';
const prisma = new PrismaClient();
async function main() {
  console.log('--- FORCED PING SYNC ---');
  const nodes = await prisma.mapNode.findMany({ where: { NOT: { apIp: null } } });
  const ips = [...new Set(nodes.map(n => n.apIp as string))];
  console.log(`Pinging ${ips.length} IPs...`);
  
  const BATCH_SIZE = 50;
  for (let i = 0; i < ips.length; i += BATCH_SIZE) {
    const batch = ips.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (ip) => {
      const res = await ping.promise.probe(ip, { timeout: 2 });
      await prisma.accessPoint.upsert({
        where: { ip },
        update: { status: res.alive ? 'ONLINE' : 'OFFLINE' },
        create: {
            ip,
            description: 'Sincronizado via Ping Global',
            status: res.alive ? 'ONLINE' : 'OFFLINE'
        }
      }).catch(() => {});
    }));
    console.log(`Progress: ${Math.min(i + BATCH_SIZE, ips.length)}/${ips.length}`);
  }
}
main().finally(() => prisma.$disconnect());
