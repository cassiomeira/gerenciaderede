import { prisma } from '../db.js';
import crypto from 'crypto';

async function main() {
  console.log('--- INICIANDO PATCH DE HISTÓRICO ---');
  try {
    // Criar tabela via Raw SQL para evitar problemas de tipos no Prisma Client antigo
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OutageHistory" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "nodeId" TEXT NOT NULL,
        "apIp" TEXT,
        "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endTime" DATETIME,
        "duration" REAL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela OutageHistory criada/verificada.');

    // Índices
    try {
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "OutageHistory_nodeId_idx" ON "OutageHistory"("nodeId")');
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "OutageHistory_apIp_idx" ON "OutageHistory"("apIp")');
      console.log('✅ Índices criados.');
    } catch (e) {}

    console.log('--- PATCH CONCLUÍDO COM SUCESSO ---');
  } catch (err) {
    console.error('❌ Erro no patch:', err);
  } finally {
    process.exit();
  }
}

main();
