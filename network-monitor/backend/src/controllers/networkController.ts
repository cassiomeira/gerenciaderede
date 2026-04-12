import { Request, Response } from 'express';
import { ixcService } from '../services/ixcService.js';
import { radioService } from '../services/radioService.js';
import { monitoringService } from '../services/monitoringService.js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { prisma as globalPrisma } from '../db.js';

dotenv.config();

export const updateTransmitterCredentials = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const id = req.params.id as string;
    const { user, pass, port, ip, description } = req.body;

    const updated = await prisma.accessPoint.upsert({
      where: ip ? { ip: ip } : { id: id },
      update: { 
        sshUser: user, 
        sshPass: pass, 
        sshPort: port ? parseInt(port) : 22,
        description: description || undefined,
        equipmentType: req.body.equipmentType || undefined
      },
      create: { 
        ip: ip, 
        description: description || 'Novo Equipamento',
        sshUser: user, 
        sshPass: pass, 
        sshPort: port ? parseInt(port) : 22,
        equipmentType: req.body.equipmentType || 'Mikrotik'
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTransmitterDetails = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const ip = req.params.ip as string;
    const dbAp = await prisma.accessPoint.findUnique({ where: { ip } });
    
    const details = await radioService.getDeviceDetails(
      ip, 
      dbAp?.sshUser || undefined, 
      dbAp?.sshPass || undefined, 
      dbAp?.sshPort || undefined
    );
    
    // Atualizar status SSH no banco
    if (dbAp) {
      await prisma.accessPoint.update({
        where: { id: dbAp.id },
        data: { lastSshStatus: details ? 'SUCCESS' : 'FAILED' }
      });
    }

    if (!details) {
      return res.status(404).json({ error: 'Falha na conexão SSH com o equipamento.' });
    }

    res.json(details);
  } catch (error: any) {
    if (req.params.ip) {
       const prisma = (req as any).tenantPrisma || globalPrisma;
       await prisma.accessPoint.updateMany({
         where: { ip: req.params.ip as string },
         data: { lastSshStatus: 'FAILED' }
       }).catch(() => {});
    }
    res.status(500).json({ error: error.message });
  }
};

export const getCachedTelemetry = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const ip = req.params.ip as string;
    const telemetry = await (prisma as any).deviceTelemetry.findFirst({
      where: { ip },
      orderBy: { collectedAt: 'desc' }
    });
    const ap = await prisma.accessPoint.findUnique({ where: { ip } });
    if (!telemetry) {
      return res.status(404).json({ error: 'Sem telemetria coletada para este IP.' });
    }
    res.json({ ...telemetry, lastSshStatus: ap?.lastSshStatus });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


function generateDiagnosis(radio: any, client: any) {
  const diagnosis: any[] = [];
  
  if (!radio || radio.status === 'OFFLINE') {
    diagnosis.push({
      level: 'error',
      message: 'Equipamento Offline',
      suggestion: 'Verifique se a antena do cliente está ligada e apontada corretamente.'
    });
    return diagnosis;
  }

  // Signal thresholds
  const signal = parseInt(radio.signal);
  if (signal < -75) {
    diagnosis.push({
      level: 'error',
      message: `Sinal extremamente baixo (${signal} dBm)`,
      suggestion: 'Verifique o alinhamento da antena ou obstruções no caminho.'
    });
  } else if (signal < -68) {
    diagnosis.push({
      level: 'warning',
      message: `Sinal moderado (${signal} dBm)`,
      suggestion: 'Considere realinhar para obter mais estabilidade.'
    });
  } else {
    diagnosis.push({
      level: 'success',
      message: 'Sinal OK',
      suggestion: 'O nível de sinal está dentro dos padrões ideais.'
    });
  }

  // CCQ thresholds
  const ccq = parseInt(radio.ccq);
  if (ccq < 70) {
    diagnosis.push({
      level: 'error',
      message: `CCQ muito baixo (${ccq}%)`,
      suggestion: 'Possível interferência ou zona de Fresnel obstruída.'
    });
  } else if (ccq < 90) {
    diagnosis.push({
      level: 'warning',
      message: `CCQ instável (${ccq}%)`,
      suggestion: 'Verifique por outras redes operando na mesma frequência.'
    });
  }

  return diagnosis;
}

export const getClientStatus = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const identifier = (req.query.identifier || req.query.q) as string;
    const forceRefresh = req.query.force === 'true' || req.query.bypassCache === 'true';

    if (!identifier) return res.status(400).json({ error: 'Identificador obrigatório' });

    console.log(`[LOOKUP] Iniciando busca para: ${identifier} (Force: ${forceRefresh})`);

    // 1. Busca no Banco Local (Otimizada)
    let client: any = await prisma.client.findFirst({
      where: {
        OR: [
          { mac: { contains: identifier } },
          { login: { contains: identifier } },
          { name: { contains: identifier } }
        ]
      }
    });

    // 2. Se não encontrou ou se os dados estão incompletos, busca no IXC
    // Incompleto = sem MAC ou sem Plano ou sem Concentrador
    const isIncomplete = client && (
      !client.mac || client.mac === 'N/A' || 
      !client.concentratorIp || client.concentratorIp === 'N/A' || 
      !client.planName || client.planName === 'N/A'
    );

    if (!client || isIncomplete || forceRefresh) {
      console.log(`[LOOKUP] ${forceRefresh ? 'Atualização forçada' : isIncomplete ? 'Dados incompletos no banco' : 'Não encontrado no banco'}, consultando IXC...`);
      const ixcClient = await ixcService.getClientByMacOrLogin(identifier);
      
      if (ixcClient) {
        console.log(`[LOOKUP] Encontrado no IXC: ${ixcClient.login} (ID: ${ixcClient.id})`);
        console.log(`[LOOKUP] MAC: ${ixcClient.mac}, Transmissor: ${ixcClient.id_transmissor}, Plano: ${ixcClient.planName}`);
        
        client = await (prisma.client as any).upsert({
          where: { ixcId: ixcClient.id },
          update: { 
            mac: ixcClient.mac, 
            name: ixcClient.name, 
            ip: ixcClient.ip, 
            login: ixcClient.login,
            concentratorIp: ixcClient.concentratorIp,
            planName: ixcClient.planName,
            contractStatus: ixcClient.contractStatus,
            contractId: ixcClient.id_contrato,
            ixcClientId: ixcClient.ixcClientId,
            transmitterId: ixcClient.id_transmissor
          },
          create: { 
            ixcId: ixcClient.id, 
            login: ixcClient.login, 
            mac: ixcClient.mac, 
            name: ixcClient.name, 
            ip: ixcClient.ip,
            concentratorIp: ixcClient.concentratorIp,
            planName: ixcClient.planName,
            contractStatus: ixcClient.contractStatus,
            contractId: ixcClient.id_contrato,
            ixcClientId: ixcClient.ixcClientId,
            transmitterId: ixcClient.id_transmissor
          }
        }).then((res: any) => {
          console.log(`[LOOKUP] Cache local atualizado com sucesso para: ${res.login}`);
          return res;
        }).catch((e: any) => {
          console.error('Erro ao salvar no cache local:', e.message);
          return ixcClient;
        });

        // Garantir campos para o frontend
        client.id_cliente = ixcClient.id_cliente;
        client.id_contrato = ixcClient.id_contrato;
        client.online = ixcClient.online;
      }
    }

    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado no IXC ou banco local' });
    }

    const cleanValue = (val: string) => (val || '').toString().trim().replace(/\s+/g, '');
    const clientMac = cleanValue(client.mac);
    const clientLogin = cleanValue(client.login);

    let transmitter: any = null;
    let radioData: any = null;

    const isValidMac = (mac: string) => {
      if (!mac || mac === 'N/A' || mac === '') return false;
      // Regex flexível: XX:XX:XX:XX:XX:XX ou XXXXXXXXXXXX
      return /^([0-9A-Fa-f]{2}[:-]?){5}([0-9A-Fa-f]{2})$/.test(mac);
    };

    // 2.5 Tenta localizar pelo Transmissor do IXC (Muito mais rápido que varrer)
    const transmitterId = client.transmitterId || client.id_transmissor;
    if (transmitterId && transmitterId > 0) {
      console.log(`[LOOKUP] Localizando via Transmissor ID: ${transmitterId}`);
      const ixcTrans = await ixcService.getTransmitter(transmitterId);
      if (ixcTrans && ixcTrans.ip) {
        transmitter = {
          id: ixcTrans.id,
          descricao: ixcTrans.descricao,
          ip: ixcTrans.ip,
          tipo_equipamento: ixcTrans.fabricante || 'Vinculado no IXC'
        };
        // Tenta pegar dados do rádio diretamente
        radioData = await radioService.getRadioData(ixcTrans.ip, client.mac);
        if (radioData && radioData.status === 'OFFLINE') {
          // Se deu offline no IP do IXC, talvez mudou de AP, então limpamos para tentar sweep
          radioData = null;
          transmitter = null;
        }
      }
    }

    // Se o cliente não tem MAC válido nem IP, e não achamos via transmissor, pulamos varredura
    if (!transmitter && !isValidMac(client.mac) && (!client.ip || client.ip === '0.0.0.0')) {
      console.log(`[LOOKUP] Cliente sem rádio/IP ativo. Pulando varredura.`);
    } else if (!transmitter) {
      // 3. Tenta localizar via Cache de MACs
      const clientMac = client.mac;
      if (isValidMac(clientMac)) {
        const cached = monitoringService.getMacLocation(clientMac);
        if (cached) {
          transmitter = { 
            id: 0, 
            descricao: cached.apName, 
            ip: cached.apIp, 
            tipo_equipamento: 'Localizado via Cache' 
          };
          radioData = { 
            mac: clientMac, 
            signal: cached.signal, 
            ccq: cached.ccq, 
            status: 'ONLINE', 
            uptime: 'Visto no cache' 
          };
        }
      }

      // 4. Se não achou no cache, tenta o rádio direto pelo IP do IXC (Muito mais rápido que varrer APs)
      if (!transmitter && !radioData && client.ip && client.ip !== '0.0.0.0' && client.ip !== 'IP') {
        radioData = await radioService.getRadioData(client.ip, client.mac);
        if (radioData && radioData.status === 'ONLINE') {
          transmitter = { descricao: 'Identificado via IP Direto', ip: client.ip, tipo_equipamento: 'Rádio Cliente' };
        } else {
          radioData = null; // Limpa se estiver offline para tentar sweep
        }
      }

      // 5. FALLBACK SWEEP: Último recurso, varre os APs online (Só se o MAC for válido)
      if (!transmitter && !radioData && isValidMac(client.mac)) {
        const inventory = monitoringService.getInventory();
        const onlineAPs = inventory.filter(d => d.online).map(d => ({ name: d.name, ip: d.ip }));
        
        if (onlineAPs.length > 0) {
          const found = await radioService.findMacInAPs(client.mac, onlineAPs);
          if (found) {
            transmitter = { 
              id: 0, 
              descricao: found.ap.name, 
              ip: found.ap.ip, 
              tipo_equipamento: 'Localizado via Varredura' 
            };
            radioData = { 
              mac: client.mac, 
              signal: found.info.signal, 
              ccq: found.info.ccq, 
              status: 'ONLINE', 
              uptime: 'Conectado agora' 
            };
          }
        }
      }
    }

    const diagnosis = generateDiagnosis(radioData, client);

    // Normalização para o frontend (compatibilidade DB vs API)
    const formattedClient = {
      ...client,
      id_contrato: client.contractId || client.id_contrato || 0,
      id_cliente: client.ixcId || client.id_cliente || 0,
      online: client.status === 'ONLINE' ? 'S' : (client.online || 'N'),
      concentratorIp: client.concentratorIp || 'N/A',
      planName: client.planName || 'N/A',
      contractStatus: client.contractStatus || 'N/A'
    };

    res.json({ 
      client: formattedClient, 
      transmitter: transmitter || { descricao: 'N/A', ip: '0.0.0.0', tipo_equipamento: 'Não localizado nos APs' }, 
      radio: radioData || { mac: client.mac, signal: 0, ccq: 0, status: 'UNKNOWN' },
      diagnosis 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const searchClients = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const q = req.query.q as string;
    if (!q || q.length < 2) return res.json([]);

    const results = await prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { login: { contains: q } },
          { mac: { contains: q } }
        ]
      },
      take: 10,
      select: {
        name: true,
        login: true,
        mac: true
      }
    });

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTransmitters = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    
    // Get inventory from CSV
    const baseMonitoringResults = monitoringService.getInventory();
    
    // Clone array to avoid mutating internal state
    const monitoringResults = [...baseMonitoringResults];
    
    const dbAps = await prisma.accessPoint.findMany();
    const dbMap = new Map<string, any>(dbAps.map(a => [a.ip, a]));

    const monitoredIps = new Set(monitoringResults.map(d => d.ip));
    
    // Auto-inject any DB APs that aren't in the CSV monitoringResults
    dbAps.forEach((dbAp: any) => {
      if (!monitoredIps.has(dbAp.ip)) {
        monitoringResults.push({
          name: dbAp.description || 'Novo AP',
          ip: dbAp.ip,
          online: dbAp.status === 'ONLINE',
          mode: dbAp.wirelessMode || 'UNKNOWN',
          latency: 0,
          lastCheck: dbAp.updatedAt || new Date()
        });
      }
    });

    // Fetch latest telemetry for all IPs in the inventory to avoid N+1 queries manually
    const ips = monitoringResults.map(d => d.ip);
    const allLatestTelemetry = await (prisma as any).deviceTelemetry.findMany({
      where: { ip: { in: ips } },
      orderBy: { collectedAt: 'desc' }
    });

    // Create a map of the latest telemetry per IP
    const telemetryMap = new Map<string, any>();
    allLatestTelemetry.forEach((t: any) => {
      if (!telemetryMap.has(t.ip)) {
        telemetryMap.set(t.ip, t);
      }
    });

    const formatted = monitoringResults.map((d, index) => {
      const dbInfo = dbMap.get(d.ip);
      const telemetry = telemetryMap.get(d.ip);

      return {
        id: dbInfo?.id || `temp-${index}`,
        descricao: d.name,
        ip: d.ip,
        status: d.online ? 'ONLINE' : 'OFFLINE',
        mode: (dbInfo && dbInfo.wirelessMode) ? dbInfo.wirelessMode : d.mode,
        latency: d.latency,
        ultima_verificacao: d.lastCheck,
        // Telemetry data
        frequency: telemetry?.frequency || 'N/A',
        ssid: telemetry?.ssid || 'N/A',
        signal: telemetry?.signal || 'N/A',
        noiseFloor: telemetry?.noiseFloor || 'N/A',
        lastTelemetryDate: telemetry?.collectedAt || null,
        hasTelemetry: !!telemetry,
        telemetryIdentity: telemetry?.identity || null,
        telemetrySource: telemetry ? (telemetry.isSnmpOnly ? 'SNMP' : 'SSH') : null,
        config: dbInfo ? { 
          user: dbInfo.sshUser, 
          port: dbInfo.sshPort, 
          hasPass: !!dbInfo.sshPass,
          lastSshStatus: dbInfo.lastSshStatus
        } : null,
        equipmentType: dbInfo?.equipmentType || 'Mikrotik'
      };
    });

    formatted.sort((a, b) => (a.status === 'ONLINE' ? -1 : 1));
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTransmitterClients = async (req: Request, res: Response) => {
  try {
    const clients = monitoringService.getMacsByApIp(req.params.ip as string);
    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getStats = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const inventory = monitoringService.getInventory();
    const dbAps = await prisma.accessPoint.findMany();
    
    const online = inventory.filter(d => d.online).length;
    const total = inventory.length;
    
    // Contagem baseada no banco de dados para SSH
    const sshSuccess = dbAps.filter(a => a.lastSshStatus === 'SUCCESS').length;
    const sshFailed = dbAps.filter(a => a.lastSshStatus === 'FAILED').length;
    const configured = dbAps.filter(a => a.sshPass).length;

    res.json({
      totalDevices: total,
      onlineDevices: online,
      offlineDevices: total - online,
      sshStats: {
        success: sshSuccess,
        failed: sshFailed,
        pending: total - sshSuccess, // Consideramos pendente tudo que não está com SSH OK
        configured: configured
      },
      macCacheSize: monitoringService.getMacCacheSize(),
      lastUpdate: new Date()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const triggerMacCache = async (_req: Request, res: Response) => {
  try {
    const started = await monitoringService.refreshMacCache();
    if (started) {
      res.json({ message: 'Varredura iniciada com sucesso. Aguarde alguns minutos.' });
    } else {
      res.status(409).json({ error: 'Uma varredura já está em andamento. Aguarde ela terminar.' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Retorna a última telemetria salva de um dispositivo
export const getDeviceTelemetry = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const ip = req.params.ip as string;
    const telemetry = await (prisma as any).deviceTelemetry.findFirst({
      where: { ip },
      orderBy: { collectedAt: 'desc' }
    });
    
    if (!telemetry) {
      return res.status(404).json({ error: 'Telemetria não encontrada para este IP. Aguarde a próxima coleta automática (1h).' });
    }

    // Parse interfaces JSON
    let interfaces = [];
    try { interfaces = JSON.parse(telemetry.interfaces || '[]'); } catch {}

    res.json({
      ...telemetry,
      interfaces
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Dispara coleta manual
export const triggerTelemetry = async (_req: Request, res: Response) => {
  try {
    const { runTelemetryCollection } = await import('../services/telemetryWorker.js');
    runTelemetryCollection().catch(console.error);
    res.json({ message: 'Coleta de telemetria iniciada em background.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Dispara coleta forçada para um dispositivo específico
export const collectSingleDeviceTelemetry = async (req: Request, res: Response) => {
  try {
    const ip = req.params.ip as string;
    const { forceCollectDevice } = await import('../services/telemetryWorker.js');
    const success = await forceCollectDevice(ip);
    
    if (success) {
      res.json({ message: 'Telemetria coletada e atualizada com sucesso.' });
    } else {
      res.status(400).json({ error: 'Falha ao coletar telemetria deste dispositivo. Verifique SSH e o status.' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getBadSignals = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const cache = monitoringService.getMacCache();
    const results: any[] = [];
    
    // Convert Map to Array
    // @ts-ignore
    for (const [mac, data] of cache.entries()) {
      results.push({ mac, ...data });
    }

    if (results.length === 0) {
      return res.json([]);
    }

    // Enriquecer com nomes do banco local ou IPs de Transmissores (PtP)
    const inventory = monitoringService.getInventory();
    const apMap = new Map(inventory.map(ap => [ap.ip, ap.name]));
    
    // Função para normalizar MAC (remover pontos, dois-pontos e converter para maiúsculo)
    const normalizeMac = (m: string) => (m || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();

    const macs = results.map(r => r.mac);
    const macsNoColons = macs.map(m => normalizeMac(m));
    
    // Busca clientes que batam com o MAC original OU com o MAC sem colons
    const clients = await prisma.client.findMany({
      where: { 
        OR: [
          { mac: { in: macs } },
          { mac: { in: macsNoColons } }
        ]
      },
      select: { mac: true, name: true, login: true }
    });
    
    // Mapa de clientes: salva tanto pela chave original quanto pela normalizada para máxima precisão
    const clientMap = new Map();
    clients.forEach(c => {
      clientMap.set(c.mac, c);
      clientMap.set(normalizeMac(c.mac), c);
    });
    console.log(`[BAD-SIGNALS] Mapa de nomes criado com ${clientMap.size} entradas.`);
    
    const finalResults = results.map(r => {
      const normalizedR = normalizeMac(r.mac);
      const client = clientMap.get(normalizedR);
      
      let displayName = 'Desconhecido';
      if (client) {
        displayName = client.name || client.login || 'Sem Nome';
      } else {
        // Se não achou no banco de clientes, verifica se é um rádio da nossa própria rede (PtP)
        const possibleAp = inventory.find(ap => 
          (ap.mac && normalizeMac(ap.mac) === normalizedR) || 
          ap.ip === r.mac || 
          normalizeMac(ap.ip) === normalizedR
        );
        
        if (possibleAp) {
          displayName = `PTP: ${possibleAp.name} (${possibleAp.ip})`;
        } else {
          // Fallback: mostrar o MAC se nada for encontrado
          displayName = `Equipamento ${r.mac}`;
        }
      }

      return {
        ...r,
        name: displayName
      };
    });

    // Ordenar por sinal (pior para o melhor)
    finalResults.sort((a, b) => a.signal - b.signal);

    res.json(finalResults);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTelemetryHistory = async (req: Request, res: Response) => {
  const prisma = (req as any).tenantPrisma || globalPrisma;
  const { ip } = req.params;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const history = await (prisma as any).telemetryLog.findMany({
      where: {
        ip,
        collectedAt: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: {
        collectedAt: 'asc'
      }
    });

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Endpoint para Recepção de Telemetria via PUSH (MikroTik Webhook ou Edge Agent)
 * Espera um payload no formato Array: [{ ip: '10.0.0.1', latency: 5, status: 'ONLINE' }]
 */
export const pushTelemetry = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Payload deve ser um Array JSON.' });
    }

    // O token (gerado para o script/agente) já autenticou e injetou as infos em req.user/req.company
    const companyId = (req as any).user?.companyId || 'UNKNOWN';
    console.log(`[TELEMETRY PUSH] Recebida telemetria da Empresa ${companyId} com ${data.length} registros.`);

    // Delegamos a atualização do cache interno para o monitoringService
    monitoringService.processPushedTelemetry(data);

    res.json({ success: true, processed: data.length });
  } catch (error: any) {
    console.error(`[TELEMETRY PUSH] Erro:`, error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Retorna as configurações da empresa (telemetryMode, etc.)
 */
export const getCompanySettings = async (req: Request, res: Response) => {
  try {
    const company = (req as any).company;
    if (company) {
      return res.json({
        companyId: company.id,
        telemetryMode: company.telemetryMode || 'CENTRAL',
        ftpData: {
          ftpHost: (company as any).ftpHost || '',
          ftpPort: (company as any).ftpPort || 21,
          ftpUser: (company as any).ftpUser || '',
          ftpPass: (company as any).ftpPass || ''
        }
      });
    }

    res.json({ companyId: 'default', telemetryMode: 'CENTRAL' });
  } catch (error: any) {
    console.error('[COMPANY SETTINGS] Erro ao buscar:', error);
    res.json({ companyId: 'default', telemetryMode: 'CENTRAL' });
  }
};

/**
 * Atualiza as configurações da empresa (telemetryMode)
 */
export const updateCompanySettings = async (req: Request, res: Response) => {
  try {
    const { telemetryMode, ftpData } = req.body;
    const validModes = ['CENTRAL', 'MIKROTIK_SCRIPT', 'EDGE_AGENT'];
    
    if (!validModes.includes(telemetryMode)) {
      return res.status(400).json({ error: `Modo inválido. Use: ${validModes.join(', ')}` });
    }

    const company = (req as any).company;
    if (company) {
      const { masterPrisma } = await import('../masterDb.js');
      
      const updateData: any = { telemetryMode };
      if (ftpData) {
        updateData.ftpHost = ftpData.ftpHost || null;
        updateData.ftpPort = Number(ftpData.ftpPort) || 21;
        updateData.ftpUser = ftpData.ftpUser || null;
        updateData.ftpPass = ftpData.ftpPass || null;
      }

      await masterPrisma.company.update({
        where: { id: company.id },
        data: updateData
      });
      console.log(`[COMPANY SETTINGS] Empresa ${company.id} alterou telemetryMode para ${telemetryMode}`);
      return res.json({ success: true, telemetryMode, ftpData });
    }

    res.json({ success: false, error: 'Empresa não encontrada no request' });
  } catch (error: any) {
    console.error('[COMPANY SETTINGS] Erro ao atualizar:', error);
    res.status(500).json({ error: error.message });
  }
};


