
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const maps = await prisma.networkMap.findMany();
  console.log('MAPS:', JSON.stringify(maps, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
