import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('--- DIAGNOSTICS ---');
  const maps = await prisma.networkMap.findMany();
  for (const m of maps) {
    const rawCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM MapNode n 
      JOIN AccessPoint a ON n.apIp = a.ip 
      WHERE n.mapId = ? AND (n.pingEnabled = 1 OR n.pingEnabled IS NULL) AND a.status = 'OFFLINE'
    `, m.id) as any[];
    
    const nodes = await prisma.mapNode.findMany({ 
        where: { mapId: m.id },
        select: { id: true, apIp: true, pingEnabled: true }
    });
    
    const offlineNodes = [];
    for (const node of nodes) {
        if (!node.apIp) continue;
        const ap = await prisma.accessPoint.findUnique({ where: { ip: node.apIp } });
        if (ap && ap.status === 'OFFLINE') {
            offlineNodes.push({ ip: node.apIp, pingEnabled: node.pingEnabled });
        }
    }
    
    console.log(`Map: ${m.name}`);
    console.log(`  QueryRaw Count: ${Number(rawCount[0].count)}`);
    console.log(`  Manual Check Count (All Offline): ${offlineNodes.length}`);
    console.log(`  Manual Check Count (Filtered): ${offlineNodes.filter(n => n.pingEnabled !== false).length}`);
    if (offlineNodes.length > 0) {
        console.log(`  Samples:`, offlineNodes.slice(0, 3));
    }
  }
}
main().finally(() => prisma.$disconnect());
