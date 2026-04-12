import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalize(s: string) {
  if (!s) return '';
  // Remove special chars, spaces and uppercase it
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function main() {
  const nodes = await prisma.mapNode.findMany({ where: { apIp: null } });
  const aps = await prisma.accessPoint.findMany();

  console.log(`Buscando IPs para ${nodes.length} nós sem IP...`);

  let updated = 0;
  for (const node of nodes) {
    if (!node.label) continue;
    
    const nodeNameNorm = normalize(node.label);
    
    // Exact normalized match
    let match = aps.find(a => normalize(a.description) === nodeNameNorm);
    
    // Try to match if label is contained in description or vice-versa
    if (!match) {
        match = aps.find(a => {
            const apDescNorm = normalize(a.description);
            return apDescNorm.includes(nodeNameNorm) || nodeNameNorm.includes(apDescNorm);
        });
    }

    if (match && match.ip) {
      console.log(`✅ ${node.label.padEnd(25)} -> ${match.ip.padEnd(15)} (Match: ${match.description})`);
      await prisma.mapNode.update({
        where: { id: node.id },
        data: { apIp: match.ip }
      });
      updated++;
    } else {
      console.log(`❌ ${node.label.padEnd(25)} -> Não encontrado`);
    }
  }

  console.log(`\nAtualizados: ${updated} nós!`);
  await prisma.$disconnect();
}

main().catch(console.error);
