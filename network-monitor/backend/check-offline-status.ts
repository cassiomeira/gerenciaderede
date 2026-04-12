import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const offlineAps = await prisma.accessPoint.findMany({ where: { status: 'OFFLINE' } });
  console.log('Offline APs in AccessPoint table:', offlineAps.length);
  const nodes = await prisma.mapNode.findMany({ include: { map: true } });
  console.log('Total MapNodes:', nodes.length);
  const nodesWithIp = nodes.filter(n => n.apIp);
  console.log('MapNodes with IP:', nodesWithIp.length);
  
  const maps = await prisma.networkMap.findMany({ include: { nodes: true } });
  for (const map of maps) {
    const offlineNodes = [];
    for (const node of map.nodes) {
       if (!node.apIp) continue;
       const ap = await prisma.accessPoint.findUnique({ where: { ip: node.apIp } });
       if (ap && ap.status === 'OFFLINE' && node.pingEnabled !== false) {
         offlineNodes.push(node.apIp);
       }
    }
    console.log(`Map ${map.name}: ${offlineNodes.length} real offline devices`);
  }
}
main().finally(() => prisma.$disconnect());
