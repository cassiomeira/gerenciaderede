import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('ENV URL:', process.env.DATABASE_URL);
  
  // Notice NO datasources override here! Just let it use .env
  const prisma = new PrismaClient();
  
  try {
    const maps = await prisma.networkMap.findMany({ take: 1 });
    console.log('✅ findMany Success!', maps.length);
  } catch (err: any) {
    console.error('❌ Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
