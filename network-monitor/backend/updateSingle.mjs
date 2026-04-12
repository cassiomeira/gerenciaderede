import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/aplicativos/gerenciaderede/gerenciaderede/network-monitor/backend/data/netcar-telecom/tenant.db'
    }
  }
});

async function main() {
  const fileContent = fs.readFileSync('single-mestre.txt', 'utf-8');
  const scripts = await prisma.script.findMany();
  let updatedCount = 0;
  
  for (const script of scripts) {
    if (script.name.toUpperCase().includes('MESTRE')) {
      await prisma.script.update({
        where: { id: script.id },
        data: { content: fileContent }
      });
      updatedCount++;
      console.log('Atualizado LINHA_UNICA: ' + script.name);
    }
  }
  console.log('Scripts MESTRE atualizados: ' + updatedCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
