import { ixcService } from './src/services/ixcService.js';

const targetName = 'MARIA DA CONCEIÇÃO COSTA';

async function test() {
  console.log(`Buscando por: ${targetName}`);
  const client = await ixcService.getClientByMacOrLogin(targetName);
  
  if (client) {
    console.log('--- RESULTADO ---');
    console.log(`Nome: ${client.name}`);
    console.log(`MAC: ${client.mac}`);
    console.log(`Login: ${client.login}`);
    console.log(`IP: ${client.ip}`);
    console.log(`Transmissor ID: ${client.id_transmissor}`);
    console.log(`Concentrador IP: ${client.concentratorIp}`);
    console.log(`Plano: ${client.planName}`);
  } else {
    console.log('Cliente não encontrado.');
  }
}

test().catch(console.error);
