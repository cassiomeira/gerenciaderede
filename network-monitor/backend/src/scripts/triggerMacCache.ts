import { monitoringService } from '../services/monitoringService.js';
import { prisma } from '../db.js';

async function trigger() {
  console.log('Triggering manual MAC cache refresh...');
  // Force inventory refresh first to make sure APs are marked as online
  await monitoringService.refreshInventory();
  console.log(`Inventory refreshed. ${monitoringService.getInventory().length} devices found.`);
  
  await monitoringService.refreshMacCache();
  console.log('Manual refresh completed.');
  process.exit(0);
}

trigger().catch(e => {
  console.error(e);
  process.exit(1);
});
