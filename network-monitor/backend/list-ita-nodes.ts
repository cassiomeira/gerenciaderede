import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const map = await p.networkMap.findFirst({ where: { name: { contains: 'ITAMARANDIBA' } } });
  if (!map) { console.log('Map not found'); return; }
  console.log(`Map ID: ${map.id}`);
  const nodes = await p.mapNode.findMany({ where: { mapId: map.id }, orderBy: { label: 'asc' } });
  nodes.forEach(n => console.log(`${n.label}`));
  console.log(`\nTotal: ${nodes.length}`);
  const links = await p.mapLink.findMany({ where: { mapId: map.id } });
  console.log(`Links: ${links.length}`);
  await p.$disconnect();
}
main();
