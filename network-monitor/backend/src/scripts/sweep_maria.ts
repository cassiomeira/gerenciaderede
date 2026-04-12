import { PrismaClient } from '@prisma/client';
import { radioService } from '../services/radioService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const targetMac = '64:D1:54:6A:78:B9';

async function sweep() {
  console.log(`Buscando MAC ${targetMac} em todos os APs cadastrados...`);
  
  const aps = await prisma.mapNode.findMany({
    where: { type: 'ap' }
  });
  
  console.log(`Total de APs para verificar: ${aps.length}`);
  
  const onlineAPs = aps.map(ap => ({ name: ap.label, ip: ap.ip }));
  
  const result = await radioService.findMacInAPs(targetMac, onlineAPs);
  
  if (result) {
    console.log(`SUCESSO! Encontrado no AP: ${result.apName} (${result.apIp})`);
    console.log(`Sinal: ${result.signal}, CCQ: ${result.ccq}`);
  } else {
    console.log('NÃO ENCONTRADO em nenhum AP via varredura SSH.');
    
    // Tenta agora pelo cache de telemetria (para ver se estava lá antes)
    const telemetry = await prisma.deviceTelemetry.findMany({
      where: {
        clientsJson: {
          contains: targetMac
        }
      }
    });
    
    if (telemetry.length > 0) {
      console.log(`Encontrado no CACHE de telemetria antiga em ${telemetry.length} registros.`);
      for (const t of telemetry) {
        console.log(`  - AP IP: ${t.apIp}, Data: ${t.updatedAt}`);
      }
    } else {
      console.log('Também não consta no cache de telemetria.');
    }
  }
}

sweep()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
