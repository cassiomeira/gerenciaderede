import axios from 'axios';
import dotenv from 'dotenv';
import qs from 'qs';

dotenv.config();

const IXC_TOKEN = process.env.IXC_TOKEN || '';
const IXC_URL = process.env.IXC_URL || '';
const encodedToken = Buffer.from(IXC_TOKEN).toString('base64');

async function testEndpoint(endpoint: string, qtype: string, query: string, useJson: boolean) {
  console.log(`\n--- Testando ${endpoint} | qtype: ${qtype} | query: ${query} | Formato: ${useJson ? 'JSON' : 'Form-Data'} ---`);
  
  const headers: any = {
    'Authorization': `Basic ${encodedToken}`,
    'ixcsoft': 'listar',
  };

  const payload = {
    qtype,
    query,
    oper: '=',
    page: '1',
    rp: '10'
  };

  if (useJson) {
    headers['Content-Type'] = 'application/json';
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  try {
    const response = await axios.post(`${IXC_URL}${endpoint}`, useJson ? payload : qs.stringify(payload), { headers });
    console.log(`Status: ${response.status}`);
    console.log(`Data:`, JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error(`Erro:`, error.message);
    if (error.response) console.error(`Dados erro:`, JSON.stringify(error.response.data).substring(0, 500));
  }
}

async function run() {
  // Testar MAC em /radusuarios (SABEMOS QUE FUNCIONAVA)
  await testEndpoint('/radusuarios', 'radusuarios.mac', '00:0C:42:CB:10:DD', true);
  await testEndpoint('/cliente', 'cliente.razao', '00:0C:42:CB:10:DD', true);

  // Testar Login "Cassiofibra" em /radusuarios
  await testEndpoint('/radusuarios', 'radusuarios.login', 'Cassiofibra', true);
  await testEndpoint('/radusuarios', 'radusuarios.login', 'Cassiofibra', false);

  // Testar Razão em /cliente
  await testEndpoint('/cliente', 'cliente.razao', 'Cassiofibra', true);
  await testEndpoint('/cliente', 'cliente.razao', 'Cassiofibra', false);
}

run();
