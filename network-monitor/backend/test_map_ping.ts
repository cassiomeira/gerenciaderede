import { prisma } from './src/db.js';
import { monitoringService } from './src/services/monitoringService.js';

async function test() {
  const mapId = 'ae2dc64a-4590-4bf2-86be-bff5087ba401';
  const nodes = await prisma.mapNode.findMany({ where: { mapId } });
  const ipsToPing = new Set<string>();
  nodes.forEach((n: any) => {
    if (n.apIp && n.pingEnabled !== false) {
      ipsToPing.add(n.apIp);
    }
  });
  const ips = [...ipsToPing];
  console.log("IPs to Ping:", ips.filter(ip => ip.includes('10.1.15.35')));

  const inventory = monitoringService.getInventory();
  const inventoryMap = new Map(inventory.map(n => [n.ip, n]));
  
  const dbIps = ips.filter(ip => !inventoryMap.has(ip));
  const dbAps = dbIps.length > 0
    ? await prisma.accessPoint.findMany({
        where: { ip: { in: dbIps } },
        select: { ip: true, status: true }
      })
    : [];
  const dbApsMap = new Map(dbAps.map(a => [a.ip, a]));

  const status: any = {};
  ips.forEach(ip => {
    const invNode = inventoryMap.get(ip);
    if (invNode) {
      status[ip] = {
        status: invNode.online ? 'ONLINE' : 'OFFLINE',
        latency: invNode.latency > 0 ? `${invNode.latency}ms` : undefined
      };
    } else {
      const dbFallback = dbApsMap.get(ip);
      status[ip] = {
        status: dbFallback?.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE'
      };
    }
  });
  
  console.log("Status for 10.1.15.35:", status['10.1.15.35']);
}

test().catch(console.error).finally(() => process.exit(0));
