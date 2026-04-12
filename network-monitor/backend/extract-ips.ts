import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const nodes = await prisma.mapNode.findMany({ where: { apIp: null } });
  
  const ipRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;
  
  console.log(`Buscando IPs nos nomes de ${nodes.length} nós...`);
  let updated = 0;
  
  for (const node of nodes) {
    if (!node.label) continue;
    
    const match = node.label.match(ipRegex);
    if (match) {
      const ip = match[0];
      console.log(`✅ Extraído: ${node.label.padEnd(25)} -> ${ip}`);
      await prisma.mapNode.update({
        where: { id: node.id },
        data: { apIp: ip }
      });
      updated++;
    }
  }

  console.log(`\nAtualizados: ${updated} nós com IP extraído do nome!`);
  await prisma.$disconnect();
}

main().catch(console.error);
