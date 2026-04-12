import { prisma } from '../db.js';

async function run() {
  const c = await prisma.client.findFirst({where: {mac: {not: 'N/A'}}});
  console.log(`DB MAC SAMPLE: "${c?.mac}"`);
  console.log(`NORMALIZED: "${(c?.mac || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase()}"`);
  process.exit(0);
}

run();
