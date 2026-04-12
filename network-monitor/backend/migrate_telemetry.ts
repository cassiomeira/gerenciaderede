import { PrismaClient } from '@prisma/client';
import path from 'path';

const dbPath = path.join(process.cwd(), 'prisma', 'master.db');
console.log('DB Path:', dbPath);

const masterPrisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } }
});

async function run() {
  try {
    await masterPrisma.$executeRawUnsafe("ALTER TABLE Company ADD COLUMN telemetryMode TEXT DEFAULT 'CENTRAL'");
    console.log('OK - Coluna adicionada!');
  } catch (e: any) {
    if (e.message.includes('duplicate')) {
      console.log('JA EXISTE - tudo certo.');
    } else {
      console.error('ERRO:', e.message);
    }
  } finally {
    await masterPrisma.$disconnect();
    process.exit(0);
  }
}
run();
