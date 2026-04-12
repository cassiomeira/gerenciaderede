import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('--- SYNCING AP STATUS ---');
  // 1. Pegar todos os IPs do CSV (visto no monitoringService)
  // Como não posso ler o CSV aqui facilmente sem o path exato, vou ver o que já está no banco.
  // E vou ver todos os MapNodes que têm IP.
  const nodes = await prisma.mapNode.findMany({ where: { NOT: { apIp: null } } });
  const ips = [...new Set(nodes.map(n => n.apIp as string))];
  
  console.log(`Encontrados ${ips.length} IPs únicos em MapNodes.`);
  
  for (const ip of ips) {
    // Tenta atualizar ou criar o AP para garantir que o JOIN funcione
    // Por padrão vamos deixar OFFLINE se for novo, e o polling vai arrumar logo em seguida.
    await prisma.accessPoint.upsert({
        where: { ip },
        update: {}, // Não muda o status se já existe (deixa o polling real cuidar disso)
        create: {
            ip,
            description: 'Sincronizado via MapNode',
            status: 'OFFLINE' // Começa offline até o monitoramento dar o sinal
        }
    }).catch(() => {});
  }
}
main().finally(() => prisma.$disconnect());
