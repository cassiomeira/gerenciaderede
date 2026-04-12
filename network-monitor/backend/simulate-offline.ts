import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const node = await prisma.mapNode.findFirst({ where: { NOT: { apIp: null } }, include: { map: true } });
  if (!node || !node.apIp) { console.log('No node with IP found.'); return; }
  console.log(`Simulando queda no IP: ${node.apIp} (Mapa: ${node.map?.name})`);
  await prisma.accessPoint.update({ where: { ip: node.apIp }, data: { status: 'OFFLINE' } });
  console.log('Status atualizado para OFFLINE.');
}
main().finally(() => prisma.$disconnect());
