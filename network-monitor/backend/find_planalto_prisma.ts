
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const maps = await prisma.networkMap.findMany();
    console.log('MAPS_LIST:');
    maps.forEach(m => console.log(`ID: ${m.id} | NAME: ${m.name}`));
    
    const planalto = maps.find(m => m.name.toLowerCase().includes('planalto'));
    if (planalto) {
        console.log('\n--- PLANALTO DETAILS ---');
        const nodes = await prisma.mapNode.findMany({ where: { mapId: planalto.id } });
        console.log(`NODES_COUNT: ${nodes.length}`);
        nodes.forEach(n => console.log(`NODE|${n.id}|${n.apIp}|${n.label}|${n.nickname}|${n.x}|${n.y}`));
        
        const links = await prisma.mapLink.findMany({ where: { mapId: planalto.id } });
        console.log(`LINKS_COUNT: ${links.length}`);
        links.forEach(l => console.log(`LINK|${l.id}|${l.sourceNodeId}|${l.targetNodeId}|${l.linkType}`));
    }
  } catch (e) {
    console.error('Prisma Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
