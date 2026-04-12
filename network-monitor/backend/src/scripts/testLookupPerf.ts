import { ixcService } from '../services/ixcService.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const id = 'Mariazenilde';
  console.log(`\n>>> TESTANDO BUSCA LIMPA PARA: ${id} <<<`);
  const start = Date.now();
  try {
    const result = await ixcService.getClientByMacOrLogin(id);
    const end = Date.now();
    console.log(`Tempo: ${end - start}ms`);
    console.log(`Resultado:`, JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.error(`Erro:`, e.message);
  }
}

test().catch(console.error);
