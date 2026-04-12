import { radioService } from './services/radioService.js';
import dotenv from 'dotenv';
dotenv.config();

async function testModes() {
  const ips = ['10.200.15.27']; // AP de teste
  console.log('--- Testando Detecção de Modo ---');
  for (const ip of ips) {
    const mode = await radioService.getWirelessMode(ip);
    console.log(`IP: ${ip} | Modo Detectado: ${mode}`);
  }
}

testModes();
