import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/aplicativos/gerenciaderede/gerenciaderede/network-monitor/backend/prisma/dev.db'
    }
  }
});

async function main() {
  console.log('Iniciando patch do banco de dados para Histórico de Quedas...');

  try {
    // Criar tabela OutageHistory
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
    console.log('Tabela OutageHistory verificada/criada.');

    // Criar índices
    try {
      await prisma.$executeRawUnsafe('CREATE INDEX "OutageHistory_nodeId_idx" ON "OutageHistory"("nodeId")');
      console.log('Índice nodeId criado.');
    } catch (e) {
      console.log('Índice nodeId já existe ou erro ignorado.');
    }

    try {
      await prisma.$executeRawUnsafe('CREATE INDEX "OutageHistory_apIp_idx" ON "OutageHistory"("apIp")');
      console.log('Índice apIp criado.');
    } catch (e) {
      console.log('Índice apIp já existe ou erro ignorado.');
    }

    console.log('Patch concluído com sucesso!');
  } catch (error) {
    console.error('Erro ao aplicar patch:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
