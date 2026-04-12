
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const maps = await prisma.networkMap.findMany();
  console.log("Mapas criados no banco de dados:");
  for (const m of maps) {
    console.log(`- ${m.name} (ID: ${m.id})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
