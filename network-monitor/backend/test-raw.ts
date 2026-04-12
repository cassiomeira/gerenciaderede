import { PrismaClient } from '@prisma/client';

async function testRawQuery() {
  const url = 'file:///C:/aplicativos/gerenciaderede/gerenciaderede/network-monitor/backend/data/netcar-telecom/tenant.db';
  console.log(`Testando URL raw query: ${url}`);
  const prisma = new PrismaClient({
    datasources: { db: { url } }
  });

  try {
    const maps = await prisma.networkMap.findMany({ take: 1 });
    console.log('✅ findMany Sucesso!', maps.length);
    
    const rawMaps = await prisma.$queryRawUnsafe(`SELECT * FROM NetworkMap`);
    console.log('✅ queryRawUnsafe Sucesso!', (rawMaps as any[]).length);
  } catch (err: any) {
    console.log(`❌ Erro: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

testRawQuery();
