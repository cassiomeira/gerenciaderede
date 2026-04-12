import { prisma } from '../db.js';

async function main() {
  const count = await prisma.client.count();
  const sample = await prisma.client.findFirst({
    where: { OR: [
      { login: { contains: 'Mariazenilde' } },
      { name: { contains: 'Mariazenilde' } }
    ]}
  });
  console.log(`Total Clientes: ${count}`);
  if (sample) {
    console.log(`Dados Sincronizados (Sample):`, JSON.stringify(sample, null, 2));
  }
}

main().catch(console.error);
