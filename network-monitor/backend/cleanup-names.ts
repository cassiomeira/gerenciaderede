import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
const prisma = new PrismaClient();

async function main() {
  console.log('--- CLEANING UP NAMES ---');
  
  // 1. Tentar pegar nomes dos MapNodes
  const aps = await prisma.accessPoint.findMany({ 
    where: { description: 'Sincronizado via MapNode' } 
  });
  console.log(`Encontrados ${aps.length} dispositivos com nome genérico.`);

  for (const ap of aps) {
    const node = await prisma.mapNode.findFirst({ 
      where: { apIp: ap.ip, NOT: { label: null } } 
    });
    if (node && node.label && node.label !== ap.ip) {
      console.log(`Atualizando ${ap.ip} -> ${node.label} (via MapNode)`);
      await prisma.accessPoint.update({
        where: { id: ap.id },
        data: { description: node.label }
      });
      continue;
    }

    // 2. Tentar via CSV se o MapNode não ajudou
    const CSV_PATH = "c:/aplicativos/gerenciaderede/gerenciaderede/dispositivos_monitoramento.csv";
    if (fs.existsSync(CSV_PATH)) {
       const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
       const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
       const csvMatch = records.find((r: any) => {
          const ip = r['Endereço IP'] || r['Endereco IP'] || r['IP Address'] || r['IP'] || Object.values(r)[1];
          return ip === ap.ip;
       });
       if (csvMatch) {
          const name = csvMatch['Nome do Dispositivo'] || csvMatch['Nome'] || csvMatch['Device Name'] || Object.values(csvMatch)[0];
          console.log(`Atualizando ${ap.ip} -> ${name} (via CSV)`);
          await prisma.accessPoint.update({
            where: { id: ap.id },
            data: { description: name }
          });
       }
    }
  }
  console.log('Cleanup finalizado.');
}
main().finally(() => prisma.$disconnect());
