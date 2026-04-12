import { screenshotService } from './src/services/screenshotService.js';

async function run() {
  console.log("Iniciando captura...");
  const p = await screenshotService.captureFullMap('85154b8b-a12f-4846-b171-180a1be2b4b5', '192.168.1.1');
  console.log("Salvo em:", p);
  process.exit(0);
}
run();
