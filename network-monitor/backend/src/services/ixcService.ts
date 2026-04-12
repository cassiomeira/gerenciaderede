import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const IXC_TOKEN = process.env.IXC_TOKEN || '';
const IXC_URL = process.env.IXC_URL || '';

const encodedToken = Buffer.from(IXC_TOKEN).toString('base64');

const ixcApi = axios.create({
  baseURL: IXC_URL,
  headers: {
    'Authorization': `Basic ${encodedToken}`,
    'ixcsoft': 'listar',
    'Content-Type': 'application/json',
  },
});

export const ixcService = {
  async getClientByMacOrLogin(identifier: string) {
    try {
      console.log(`\n--- IXC Search: ${identifier} ---`);
      
      let response: any = null;

      // 0. Inteligência: Se o usuário digitar números ou CRM-ID, busca direto por ID
      const numericId = identifier.match(/^CRM-(\d+)$/i)?.[1] || (identifier.match(/^\d+$/) ? identifier : null);
      
      if (numericId) {
        console.log(`Identificador numérico detectado (${numericId}), buscando por ID...`);
        response = await ixcApi.post('/cliente', {
          qtype: 'cliente.id',
          query: numericId,
          oper: '=',
          page: '1',
          rp: '1'
        });
      }

      // 1. Tenta radusuarios por MAC (vários formatos)
      if (!response?.data?.registros?.length && (identifier.includes(':') || identifier.includes('-') || identifier.length >= 12)) {
        const formats = [
          identifier,
          identifier.replace(/[:.-]/g, ''),
          identifier.replace(/[:.-]/g, ':').toUpperCase(),
          identifier.toLowerCase()
        ];
        
        // Remove duplicados
        const uniqueFormats = [...new Set(formats)];
        console.log(`[IXC] Tentando formatos de MAC: ${uniqueFormats.join(', ')}`);

        for (const f of uniqueFormats) {
          console.log(`[IXC] Buscando radusuarios.mac = "${f}"`);
          response = await ixcApi.post('/radusuarios', {
            qtype: 'radusuarios.mac',
            query: f,
            oper: '=',
            page: '1',
            rp: '1'
          });
          if (response?.data?.registros?.length) {
            console.log(`[IXC] Sucesso em radusuarios com formato: ${f}`);
            break;
          }
        }
      }

      // 2. Tenta /cliente por onu_mac ou mac se ainda não encontrou
      if (!response?.data?.registros?.length && (identifier.includes(':') || identifier.includes('-') || identifier.length >= 12)) {
         const norm = identifier.replace(/[:.-]/g, '');
         const searchFields = ['cliente.mac', 'cliente.onu_mac'];
         
         for (const field of searchFields) {
           console.log(`[IXC] Buscando ${field} = "${norm}" (normalizado)`);
           response = await ixcApi.post('/cliente', {
             qtype: field,
             query: norm,
             oper: 'LIKE',
             page: '1',
             rp: '1'
           });
           if (response?.data?.registros?.length) {
             console.log(`[IXC] Sucesso em /cliente no campo ${field}`);
             break;
           }
         }
      }

      // 3. Tenta radusuarios por Login (Exato)
      if (!response?.data?.registros?.length) {
        response = await ixcApi.post('/radusuarios', {
          qtype: 'radusuarios.login',
          query: identifier,
          oper: '=',
          page: '1',
          rp: '1'
        });
      }

      // 3. Tenta /cliente por Login ou Razão (Exato primeiro)
      if (!response?.data?.registros?.length) {
        response = await ixcApi.post('/cliente', {
          qtype: 'cliente.login',
          query: identifier,
          oper: '=',
          page: '1',
          rp: '1'
        });

        if (!response?.data?.registros?.length) {
          response = await ixcApi.post('/cliente', {
            qtype: 'cliente.razao',
            query: identifier,
            oper: 'LIKE',
            page: '1',
            rp: '1'
          });
        }
      }

      if (response.data && typeof response.data === 'object' && response.data.registros && response.data.registros.length > 0) {
        // --- NOVO: Selecionar o MELHOR registro entre os resultados (ex: buscar o que tem MAC) ---
        let candidates = response.data.registros.slice(0, 5); // Analisa os top 5 para performance
        let bestRecord = candidates[0];
        
        console.log(`[IXC] Encontrados ${response.data.registros.length} candidatos. Analisando os melhores...`);

        for (const cand of candidates) {
          const clientId = cand.id_cliente || cand.id;
          // Tenta carregar raduser para ver se tem MAC
          const rad = await this.getRadUserByClientId(clientId, cand.razao);
          if (rad && rad.mac && rad.mac !== 'N/A') {
             console.log(`[IXC] Melhor registro encontrado (via RadUser MAC): ID=${cand.id}, MAC=${rad.mac}`);
             bestRecord = { ...cand, ...rad, id: cand.id };
             break;
          }
          // Se o próprio registro já tem MAC, serve
          if (cand.mac && cand.mac !== 'N/A') {
            bestRecord = cand;
            break;
          }
        }

        let data = bestRecord;
        const clientId = data.id_cliente || data.id;
        
        // --- AGGREGATION: Buscar em Contratos ---
        console.log(`[IXC] Agregando contratos para Cliente ID: ${clientId}`);
        const contracts = await this.getAllContracts(clientId);
        let bestContract = contracts.find((c: any) => c.id_transmissor && c.id_transmissor > 0) || contracts[0];
        
        if (bestContract) {
          data = { ...data, ...bestContract, id: data.id }; 
        }

        let planName = data.plano || data.venda_plano || data.contrato || 'N/A';
        let contractStatus = data.status_internet || data.status || 'N/A';

        // Mapping final
        return {
          id: parseInt(data.id),
          login: data.login || data.razao || 'N/A',
          mac: data.mac || data.onu_mac || 'N/A',
          id_cliente: parseInt(data.id_cliente || data.id),
          ixcClientId: parseInt(data.id_cliente || data.id),
          id_contrato: data.id_contrato ? parseInt(data.id_contrato) : (data.id && !data.razao ? parseInt(data.id) : 0),
          id_transmissor: data.id_transmissor ? parseInt(data.id_transmissor) : 0,
          ip: data.ip || data.ip_concentrador || '0.0.0.0',
          online: (data.online === 'S' || data.online === 'SS' || data.ativo === 'S') ? 'S' : 'N',
          name: data.razao || data.login || 'N/A',
          concentratorIp: data.concentrador || data.ip_concentrador || 'N/A',
          planName: planName,
          contractStatus: contractStatus
        };
      }
      
      console.warn(`Nenhum registro encontrado no IXC para: ${identifier}`);
      return null;
    } catch (error: any) {
      console.error('Erro na API IXC:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', JSON.stringify(error.response.data));
      }
      throw new Error('Falha na comunicação com IXC Soft');
    }
  },

  async getAllContracts(clientId: string | number) {
    try {
      const response = await ixcApi.post('/cliente_contrato', {
        qtype: 'cliente_contrato.id_cliente',
        query: clientId.toString(),
        oper: '=',
        page: '1',
        rp: '10'
      });
      return response.data?.registros || [];
    } catch (e) {
      console.error('Erro ao buscar contratos:', e);
      return [];
    }
  },

  async getRadUserByClientId(clientId: string | number, loginHint?: string) {
    try {
      // 1. Tenta múltiplos campos para vincular ID do Cliente em radusuarios
      const fieldNames = ['radusuarios.id_cliente', 'radusuarios.cliente_id', 'radusuarios.id_usuario'];
      
      for (const field of fieldNames) {
        const resp = await ixcApi.post('/radusuarios', {
          qtype: field,
          query: clientId.toString(),
          oper: '=',
          page: '1',
          rp: '1'
        });
        if (resp.data?.registros?.length) {
          return resp.data.registros[0];
        }
      }

      // 2. Fallback: Tenta buscar por Login se tiver uma dica ou se o login for derivado do nome
      if (loginHint && loginHint !== 'N/A') {
        const normalizedLogin = loginHint.toLowerCase().replace(/\s+/g, '');
        const resp = await ixcApi.post('/radusuarios', {
          qtype: 'radusuarios.login',
          query: normalizedLogin,
          oper: 'LIKE',
          page: '1',
          rp: '1'
        });
        if (resp.data?.registros?.length) {
          return resp.data.registros[0];
        }
      }

      return null;
    } catch (e) {
      console.error('Erro ao buscar raduser:', e);
      return null;
    }
  },

  async getContractInfo(clientId: string | number) {
    try {
      console.log(`Buscando Plano/Status no Contrato para Cliente ID: ${clientId}`);
      const response = await ixcApi.post('/cliente_contrato', {
        qtype: 'cliente_contrato.id_cliente',
        query: clientId.toString(),
        oper: '=',
        page: '1',
        rp: '1'
      });

      if (response.data && response.data.registros && response.data.registros.length > 0) {
        const c = response.data.registros[0];
        return {
          status: c.status_internet || c.status, 
          plano: c.contrato // Nome do plano de venda
        };
      }
      return null;
    } catch (e) {
      console.error('Erro ao buscar contrato:', e);
      return null;
    }
  },

  async listAllClients(page: number = 1, rp: number = 1000) {
    try {
      console.log(`Buscando IXC Clientes - Página: ${page}, Registros: ${rp}`);
      const response = await ixcApi.post('/cliente', {
        qtype: 'cliente.id',
        query: '0',
        oper: '>',
        page: page.toString(),
        rp: rp.toString()
      });

      if (response.data && response.data.registros) {
        return response.data.registros.map((data: any) => ({
          ixcId: parseInt(data.id),
          login: data.login || `CRM-${data.id}`, // Use ID as fallback login for CRM-only clients
          mac: data.mac || data.onu_mac || 'N/A',
          id_cliente: parseInt(data.id),
          id_contrato: data.id_contrato ? parseInt(data.id_contrato) : null,
          id_transmissor: data.id_transmissor ? parseInt(data.id_transmissor) : null,
          ip: data.ip || data.ip_concentrador || '0.0.0.0',
          online: (data.online === 'S' || data.online === 'SS' || data.ativo === 'S') ? 'S' : 'N',
          razao: data.razao,
          concentratorIp: data.concentrador || data.ip_concentrador || 'N/A',
          planName: data.plano || data.venda_plano || 'N/A',
          contractStatus: data.status_internet || data.status || 'N/A'
        }));
      }
      return [];
    } catch (error: any) {
      console.error('Erro ao listar clientes no IXC:', error.message);
      return [];
    }
  },

  async getTransmitter(id: number) {
    if (!id || id === 0) return null;
    try {
      console.log(`Buscando Transmissor ID no IXC: ${id}`);
      const response = await ixcApi.post('/transmissor', {
        qtype: 'transmissor.id',
        query: id.toString(),
        oper: '=',
        page: '1',
        rp: '1'
      });

      if (response.data && response.data.registros && response.data.registros.length > 0) {
        const trans = response.data.registros[0];
        return {
          id: parseInt(trans.id),
          descricao: trans.descricao,
          ip: trans.ip,
          fabricante: trans.fabricante
        };
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar transmissor no IXC:', error);
      return null;
    }
  }
};
