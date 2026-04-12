import { prisma } from './src/db.js';

const ip = '10.201.11.118';

async function check() {
  const data = await (prisma as any).deviceTelemetry.findFirst({
    where: { ip }
  });
  
  if (data) {
    console.log('--- DADOS NO BANCO PARA 118 ---');
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('Nenhum dado encontrado para o IP 118.');
  }
  process.exit();
}

check();
