import { PrismaClient } from '@prisma/client';

async function testConnection(url: string) {
  console.log(`Testando URL: ${url}`);
  const prisma = new PrismaClient({
    datasources: {
      db: { url }
    }
  });

  try {
    const maps = await prisma.networkMap.findMany({ take: 1 });
    console.log('✅ Sucesso!');
  } catch (err: any) {
    console.log(`❌ Erro: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const basePath = 'C:\\aplicativos\\gerenciaderede\\gerenciaderede\\network-monitor\\backend\\data\\netcar-telecom\\tenant.db';
  
  await testConnection(`file:${basePath}`);
  await testConnection(`file:${basePath.replace(/\\/g, '/')}`);
  await testConnection(`file:///${basePath.replace(/\\/g, '/')}`);
}

main();
