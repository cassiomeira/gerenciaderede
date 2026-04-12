import { ixcService } from '../services/ixcService.js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const IXC_TOKEN = process.env.IXC_TOKEN || '';
const IXC_URL = process.env.IXC_URL || '';
const encodedToken = Buffer.from(IXC_TOKEN).toString('base64');

async function dump() {
  const identifier = 'Cleidebarral';
  const realClientId = '38934';
  const realContractId = '42359';
  console.log(`Buscando dados brutos para: ${identifier} (ID: ${realClientId})`);
  
  // ... (ixcApi setup is same) ...
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
    { ep: '/radusuarios', q: 'login', val: identifier },
    { ep: '/cliente_contrato', q: 'id_cliente', val: realClientId },
    { ep: '/cliente_contrato', q: 'id', val: realContractId }
  ];
  
  for (const t of tests) {
    try {
      console.log(`\n--- Endpoint: ${t.ep} (Search: ${t.q} = ${t.val}) ---`);
      const res = await ixcApi.post(t.ep, {
        qtype: t.ep.substring(1) + '.' + t.q,
        query: t.val,
        oper: '=',
        page: '1',
        rp: '1'
      });
      console.log(JSON.stringify(res.data.registros?.[0] || 'NADA ENCONTRADO', null, 2));
    } catch (e: any) {
      console.error(`Erro no endpoint ${t.ep}:`, e.message);
    }
  }
}

dump().catch(console.error);
