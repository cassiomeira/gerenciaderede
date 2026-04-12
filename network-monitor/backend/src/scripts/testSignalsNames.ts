import { prisma } from '../db.js';
import { monitoringService } from '../services/monitoringService.js';

async function test() {
  console.log('Testing Signal Names Resolution...');
  
  // Need to populate inventory in memory for the monitoringService to work in this script
  await monitoringService.refreshInventory();
  
  const cache = monitoringService.getMacCache();
  const results: any[] = [];
  for (const [mac, data] of cache.entries()) {
    results.push({ mac, ...data });
  }

  console.log(`MACs in cache: ${results.length}`);
  
  const inventory = monitoringService.getInventory();
  const normalizeMac = (m: string) => (m || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();

  const macs = results.map(r => r.mac);
  const clients = await prisma.client.findMany({
    where: { 
      OR: [
        { mac: { in: macs } },
        { mac: { in: macs.map(m => normalizeMac(m)) } }
      ]
    },
    select: { mac: true, name: true, login: true }
  });
  
  const clientMap = new Map();
  clients.forEach(c => {
    clientMap.set(normalizeMac(c.mac), c);
  });
  
  console.log(`Clients found in DB: ${clients.length}`);

  results.slice(0, 20).forEach(r => {
    const normalizedR = normalizeMac(r.mac);
    const client = clientMap.get(normalizedR);
    
    let displayName = 'Desconhecido';
    if (client) {
      displayName = client.name || client.login || 'Sem Nome';
    } else {
      const possibleAp = inventory.find(ap => ap.ip === r.mac || normalizeMac(ap.ip) === normalizedR);
      if (possibleAp) {
        displayName = `PTP: ${possibleAp.name} (${possibleAp.ip})`;
      } else {
        displayName = `Equipamento ${r.mac}`;
      }
    }
    console.log(`MAC: ${r.mac} -> Name: ${displayName}`);
  });
  
  process.exit(0);
}

test().catch(e => {
  console.error(e);
  process.exit(1);
});
