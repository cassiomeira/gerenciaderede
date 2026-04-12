import { prisma } from './src/db.js';

async function check() {
  try {
    const history = await prisma.$queryRawUnsafe('SELECT * FROM OutageHistory LIMIT 10');
    console.log('--- HISTÓRICO ENCONTRADO ---');
    console.log(JSON.stringify(history, null, 2));
    
    const count = await prisma.$queryRawUnsafe('SELECT COUNT(*) as total FROM OutageHistory');
    console.log('Total de registros:', (count as any)[0].total);
  } catch (err) {
    console.error('Erro ao verificar histórico:', err);
    console.log('Verificação: Se o erro for "no such table", o patch do banco ainda não rodou.');
  } finally {
    process.exit();
  }
}

check();
