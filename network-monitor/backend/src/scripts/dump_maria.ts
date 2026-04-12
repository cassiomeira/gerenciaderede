import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const IXC_TOKEN = process.env.IXC_TOKEN || '';
const IXC_URL = process.env.IXC_URL || '';
const encodedToken = Buffer.from(IXC_TOKEN).toString('base64');

async function dump() {
  const realClientId = '107684';
  console.log(`Buscando dados brutos para ID Cliente: ${realClientId}`);
  
  const ixcApi = axios.create({
    baseURL: IXC_URL,
    headers: {
      'Authorization': `Basic ${encodedToken}`,
      'ixcsoft': 'listar',
      'Content-Type': 'application/json',
    },
  });

  const tests = [
    { ep: '/cliente', q: 'id', val: realClientId },
    { ep: '/radusuarios', q: 'id_cliente', val: realClientId },
    { ep: '/cliente_contrato', q: 'id_cliente', val: realClientId }
  ];
  
  for (const t of tests) {
    try {
      console.log(`\n--- Endpoint: ${t.ep} (Search: ${t.q} = ${t.val}) ---`);
      const res = await ixcApi.post(t.ep, {
        qtype: t.ep.substring(1) + '.' + t.q,
        query: t.val,
        oper: '=',
        page: '1',
        rp: '10' // Ver se tem mais de um
      });
      console.log(JSON.stringify(res.data.registros || 'NADA ENCONTRADO', null, 2));
    } catch (e: any) {
      console.error(`Erro no endpoint ${t.ep}:`, e.message);
    }
  }
}

dump().catch(console.error);
