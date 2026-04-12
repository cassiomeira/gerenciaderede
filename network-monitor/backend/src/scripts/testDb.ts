import { prisma } from '../db.js';

async function test() {
  try {
    console.log('Testing DB connectivity...');
    const apsCount = await prisma.accessPoint.count();
    console.log(`AccessPoints count: ${apsCount}`);
    
    const clientsCount = await prisma.client.count();
    console.log(`Clients count: ${clientsCount}`);
    
    const firstAp = await prisma.accessPoint.findFirst();
    console.log('First AP:', firstAp?.ip);
    
    process.exit(0);
  } catch (e: any) {
    console.error('DB TEST FAILED:', e.message);
    process.exit(1);
  }
}

test();
