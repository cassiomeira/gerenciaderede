import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const nodes = await prisma.mapNode.findMany({ select: { apIp: true, mapId: true } });
  const nodesWithNoAp = [];
  for (const node of nodes) {
    if (!node.apIp) continue;
    const ap = await prisma.accessPoint.findUnique({ where: { ip: node.apIp } });
    if (!ap) {
      nodesWithNoAp.push(node.apIp);
    }
  }
  console.log(`Nodes with IP but NO AccessPoint record: ${nodesWithNoAp.length}`);
  if (nodesWithNoAp.length > 0) {
    console.log('Sample missing IPs:', nodesWithNoAp.slice(0, 10));
  }
}
main().finally(() => prisma.$disconnect());
