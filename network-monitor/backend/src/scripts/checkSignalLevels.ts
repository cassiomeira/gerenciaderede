import { monitoringService } from '../services/monitoringService.js';

async function check() {
  const cache = monitoringService.getMacCache();
  console.log(`Current Cache size: ${cache.size}`);
  
  const signals: number[] = [];
  cache.forEach(data => signals.push(data.signal));
  
  if (signals.length > 0) {
    const min = Math.min(...signals);
    const max = Math.max(...signals);
    const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
    const below70 = signals.filter(s => s <= -70).length;
    
    console.log(`Min Signal: ${min}`);
    console.log(`Max Signal: ${max}`);
    console.log(`Avg Signal: ${avg.toFixed(2)}`);
    console.log(`Signals <= -70dBm: ${below70}`);
    
    console.log('Sample signals (first 10):', signals.slice(0, 10));
  } else {
    console.log('Cache is empty.');
  }
  process.exit(0);
}

check();
