import { prisma } from './db.js';

async function test() {
  try {
    const aps = await prisma.accessPoint.findMany();
    console.log('Sucesso! APs no banco:', aps.length);
  } catch (e) {
    console.error('Erro ao acessar banco:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
