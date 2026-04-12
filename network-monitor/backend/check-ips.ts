import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const ips = ['10.201.11.36', '10.201.11.116', '10.201.11.124', '10.201.11.121', '10.201.11.12'];
  for (const ip of ips) {
    const ap = await prisma.accessPoint.findUnique({ where: { ip } });
    const nodes = await prisma.mapNode.findMany({ where: { apIp: ip }, include: { map: true } });
    console.log(`IP ${ip}: Status=${ap?.status}, Maps=[${nodes.map(n => n.map?.name).join(', ')}]`);
  }
}
main().finally(() => prisma.$disconnect());
