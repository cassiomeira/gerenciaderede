import { prisma } from './src/db.js';
import { monitoringService } from './src/services/monitoringService.js';

async function test() {
  const mapNodes = await prisma.mapNode.findMany({
    where: { apIp: '10.1.15.35' }
  });
  console.log("MapNodes:", mapNodes);
  
  const ap = await prisma.accessPoint.findFirst({
    where: { ip: '10.1.15.35' }
  });
  console.log("AP DB Status:", ap?.status);

  const inventory = monitoringService.getInventory();
  const invNode = inventory.find(n => n.ip.includes('10.1.15.35'));
  console.log("Inventory Node:", invNode);
}

test().catch(console.error).finally(() => process.exit(0));
