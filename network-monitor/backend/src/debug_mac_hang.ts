import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const MAC = '00:0C:42:CB:10:DD';
const API_URL = 'http://localhost:3001/api';

async function debugSearch() {
  console.log(`\n=== Depurando MAC: ${MAC} ===`);
  
  // 1. Verificar Stats primeiro
  try {
    const stats = await axios.get(`${API_URL}/stats`);
    console.log('Stats atuais:', JSON.stringify(stats.data, null, 2));
  } catch (e) { console.error('Erro ao pegar stats'); }

  // 2. Tentar busca (com timeout curto para detecção de trava)
  console.log('Iniciando busca no backend...');
  const start = Date.now();
  try {
    const res = await axios.get(`${API_URL}/client-status?identifier=${MAC}`, { timeout: 15000 });
    console.log(`Resposta em ${Date.now() - start}ms:`, JSON.stringify(res.data, null, 2));
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      console.error('ERRO: A busca TRAVOU (timeout de 15s atingido)');
    } else {
      console.error('Erro na busca:', error.message);
      if (error.response) console.log('Dados do erro:', error.response.data);
    }
  }
}

debugSearch();
