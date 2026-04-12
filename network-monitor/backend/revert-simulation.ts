import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.accessPoint.updateMany({ data: { status: 'ONLINE' } });
  console.log('Todos os equipamentos marcados como ONLINE.');
}
main().finally(() => prisma.$disconnect());
