import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { prisma as globalPrisma } from '../db.js';
import { monitoringService } from '../services/monitoringService.js';

// Ping a single IP — returns true if alive, false if not
async function pingIp(ip: string): Promise<{ alive: boolean, latency?: string }> {
  try {
    // Windows: ping -n 1 -w 1500   Linux: ping -c 1 -W 1
    const isWin = process.platform === 'win32';
    const cmd = isWin ? `ping -n 1 -w 1500 ${ip}` : `ping -c 1 -W 2 ${ip}`;
    const { stdout } = await execAsync(cmd, { timeout: 3000 });
    
    const alive = isWin ? /TTL=/i.test(stdout) : /1 received|1 packets received/i.test(stdout);
    let latency;
    
    if (alive) {
      // Look for time=5ms or tempo=5ms or time<1ms
      const match = stdout.match(/(?:time|tempo)[=<]\s*(\d+ms|<1ms)/i);
      if (match && match[1]) {
        latency = match[1];
      }
    }
    
    return { alive, latency };
  } catch {
    return { alive: false };
  }
}
export const getPingStatus = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const company = (req as any).company;
    const telemetryMode = company?.telemetryMode || 'CENTRAL';
    const { id } = req.params;
    
    const nodes = await prisma.mapNode.findMany({ where: { mapId: id as string } });
    const ipsToPing = new Set<string>();
    nodes.forEach((n: any) => {
      if (n.apIp && n.pingEnabled !== false) {
        ipsToPing.add(n.apIp);
      }
    });
    const ips = [...ipsToPing];

    if (ips.length === 0) return res.json({});

    const status: Record<string, { status: 'ONLINE' | 'OFFLINE', latency?: string }> = {};

    // SEMPRE ler do cache em memória do monitoringService para evitar spawnar
    // centenas de processos ping do OS a cada 3 segundos (bloqueava o servidor inteiro).
    const inventory = monitoringService.getInventory();
    const inventoryMap = new Map(inventory.map(n => [n.ip, n]));

    // Para IPs que não estão no inventário CSV, ler status do banco de dados
    const dbIps = ips.filter(ip => !inventoryMap.has(ip));
    const dbAps = dbIps.length > 0
      ? await prisma.accessPoint.findMany({
          where: { ip: { in: dbIps } },
          select: { ip: true, status: true }
        })
      : [];
    const dbApMap = new Map((dbAps as any[]).map(a => [a.ip, a]));

    ips.forEach(ip => {
      const invNode = inventoryMap.get(ip);
      if (invNode) {
        status[ip] = {
          status: invNode.online ? 'ONLINE' : 'OFFLINE',
          latency: invNode.latency > 0 ? `${invNode.latency}ms` : undefined
        };
      } else {
        const dbAp = dbApMap.get(ip);
        status[ip] = { status: (dbAp as any)?.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE' };
      }
    });

    if (status['10.1.15.35']) {
      const dbgNode = inventoryMap.get('10.1.15.35');
      console.log('[DEBUG PINGSTATUS] 10.1.15.35 ping status:', status['10.1.15.35'], 'invNode was:', dbgNode);
    }

    res.json(status);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

// Busca global de dispositivos em todos os mapas (IP, nome e MAC)
export const searchNodes = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim().toLowerCase();
    if (!q || q.length < 2) return res.json([]);

    // ─── Carregar todos os nós com info do mapa ───────────────────────────
    const prisma = (req as any).tenantPrisma || globalPrisma;
    // Usamos queryRaw pois o Prisma Client pode estar sem o campo nickname no tipo estático
    const allNodes = await prisma.$queryRawUnsafe(`
      SELECT n.*, m.name as mapName 
      FROM MapNode n
      JOIN NetworkMap m ON n.mapId = m.id
    `) as any[];

    const ips = [...new Set(allNodes.map(n => n.apIp).filter(Boolean))] as string[];

    // ─── Carregar dados dos APs (description + mac) ───────────────────────
    const aps = ips.length
      ? await prisma.accessPoint.findMany({
          where: { ip: { in: ips } },
          select: { ip: true, description: true }
        })
      : [];
    const apDescMap = new Map(aps.map((a: any) => [a.ip, a.description]));

    // ─── Busca no clientsJson da telemetria (MACs de clientes) ────────────
    // Pega a última telemetria de cada AP com IP no sistema
    const telemetryRecords = ips.length
      ? await (prisma as any).deviceTelemetry.findMany({
          where: { ip: { in: ips }, clientsJson: { not: null } },
          select: { ip: true, clientsJson: true, collectedAt: true },
          orderBy: { collectedAt: 'desc' },
        })
      : [];

    // Mapa: ip → clientsJson mais recente
    const latestTelemetry = new Map<string, string>();
    for (const t of telemetryRecords) {
      if (!latestTelemetry.has(t.ip)) latestTelemetry.set(t.ip, t.clientsJson);
    }

    // Para busca por MAC de cliente: mapa mac → apIp
    const clientMacToApIp = new Map<string, string>();
    for (const [apIp, clientsJson] of latestTelemetry) {
      try {
        const clients: { mac: string }[] = JSON.parse(clientsJson || '[]');
        for (const c of clients) {
          if (c.mac) clientMacToApIp.set(c.mac.toLowerCase(), apIp);
        }
      } catch { /* ignore parse errors */ }
    }

    // ─── Verifica se a query é um MAC de cliente ──────────────────────────
    const clientApIps = new Set<string>();
    for (const [mac, apIp] of clientMacToApIp) {
      if (mac.includes(q)) clientApIps.add(apIp);
    }

    // ─── Resultados: nós que batem por IP, nome, descrição ou MAC cliente ─
    const seen = new Set<string>();
    const matches: any[] = [];

    for (const n of allNodes) {
      if (seen.has(n.id)) continue;
      const label = (n.label || '').toLowerCase();
      const ip = (n.apIp || '').toLowerCase();
      const desc = String(apDescMap.get(n.apIp || '') || '').toLowerCase();
      const isClientMacMatch = n.apIp ? clientApIps.has(n.apIp) : false;

      if (ip.includes(q) || label.includes(q) || desc.includes(q) || isClientMacMatch) {
        seen.add(n.id);
        // Qual MAC de cliente atingiu esse AP?
        const matchedClientMacs = isClientMacMatch
          ? [...clientMacToApIp.entries()]
              .filter(([mac, apIp]) => apIp === n.apIp && mac.includes(q))
              .map(([mac]) => mac)
          : [];
        matches.push({
          nodeId: n.id,
          mapId: n.mapId,
          mapName: n.mapName,
          label: n.label,
          apIp: n.apIp,
          description: apDescMap.get(n.apIp || '') || null,
          x: n.x,
          y: n.y,
          matchedClientMacs: matchedClientMacs.length > 0 ? matchedClientMacs : undefined,
        });
      }
      if (matches.length >= 20) break;
    }

    res.json(matches);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};


// Listar todos os mapas com contagem de equipamentos offline
export const getMaps = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    
    const maps = await prisma.networkMap.findMany({
      orderBy: { createdAt: 'asc' }
    });

    const nodes = await prisma.mapNode.findMany({
      where: { 
        pingEnabled: { not: false }, 
        apIp: { not: null } 
      },
      select: { mapId: true, apIp: true }
    });

    const inventory = monitoringService.getInventory();
    const inventoryMap = new Map(inventory.map(d => [d.ip, d]));

    // Find IPs that are not in inventory to fallback to DB
    const nodeIps = [...new Set(nodes.map((n: any) => n.apIp).filter(Boolean) as string[])];
    const missingIps = nodeIps.filter(ip => !inventoryMap.has(ip));
    
    const dbAps = missingIps.length ? await prisma.accessPoint.findMany({
      where: { ip: { in: missingIps } },
      select: { ip: true, status: true }
    }) : [];
    const dbApMap = new Map(dbAps.map((ap: any) => [ap.ip, ap]));

    const offlineCountByMap = new Map<string, number>();

    for (const node of nodes) {
      if (!node.apIp) continue;
      
      const invDevice = inventoryMap.get(node.apIp);
      const dbAp = dbApMap.get(node.apIp);

      let isOffline = false;
      if (invDevice) {
        isOffline = !invDevice.online;
      } else if (dbAp) {
        isOffline = (dbAp as any).status === 'OFFLINE';
      } else {
        isOffline = true; // Not found in both is treated as offline
      }

      if (isOffline) {
        offlineCountByMap.set(node.mapId, (offlineCountByMap.get(node.mapId) || 0) + 1);
      }
    }

    const formatted = maps.map((m: any) => ({
      ...m,
      offlineCount: offlineCountByMap.get(m.id) || 0
    }));

    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

// Criar mapa
export const createMap = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name é obrigatório' });
    const map = await prisma.networkMap.create({ data: { name } });
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

// Renomear mapa
export const updateMap = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { id } = req.params;
    const { name } = req.body;
    const map = await prisma.networkMap.update({ where: { id: id as string }, data: { name } });
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

// Deletar mapa
export const deleteMap = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { id } = req.params;
    await prisma.networkMap.delete({ where: { id: id as string } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

// Obter mapa completo (nós + links + status APs)
export const getMap = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { id } = req.params;
    const map = await prisma.networkMap.findUnique({
      where: { id: id as string },
      include: {
        links: true
      }
    });

    if (!map) return res.status(404).json({ error: 'Mapa não encontrado' });

    // Fallback: usar queryRaw para buscar os nós pois o Prisma Client pode estar desatualizado
    const nodes = await prisma.$queryRawUnsafe(`SELECT * FROM MapNode WHERE mapId = ?`, id) as any[];
    
    // Enriquecer nós com status dos APs — priorizar inventário em memória (dados do Edge Agent)
    const inventory = monitoringService.getInventory();
    const inventoryMap = new Map(inventory.map(d => [d.ip, d]));

    const ips = nodes.map((n: any) => n.apIp).filter(Boolean) as string[];
    
    // Fallback: buscar do banco apenas IPs que NÃO estão no inventário
    const missingIps = ips.filter(ip => !inventoryMap.has(ip));
    const aps = missingIps.length
      ? await prisma.accessPoint.findMany({
          where: { ip: { in: missingIps } },
          select: { ip: true, description: true, status: true }
        })
      : [];
    const apDbMap = new Map(aps.map((ap: any) => [ap.ip, ap]));

    // Carregar descrições do banco para TODOS os IPs (inventário não tem descrição do banco)
    const allDbAps = ips.length
      ? await prisma.accessPoint.findMany({
          where: { ip: { in: ips } },
          select: { ip: true, description: true }
        })
      : [];
    const descMap = new Map(allDbAps.map((ap: any) => [ap.ip, ap.description]));

    const enrichedNodes = nodes.map((node: any) => {
      const invDevice = node.apIp ? inventoryMap.get(node.apIp) : null;
      const dbAp = node.apIp ? apDbMap.get(node.apIp) : null;
      
      let apStatus = 'UNKNOWN';
      if (invDevice) {
        apStatus = invDevice.online ? 'ONLINE' : 'OFFLINE';
      } else if (dbAp) {
        apStatus = (dbAp as any).status === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
      }

      return {
        ...node,
        apStatus,
        apDescription: descMap.get(node.apIp || '') || node.label
      };
    });

    const debugTarget = enrichedNodes.find(n => n.apIp === '10.1.15.35');
    if (debugTarget) {
       console.log('[DEBUG GETMAP] 10.1.15.35 status is:', debugTarget.apStatus, 'invDevice was:', inventoryMap.get('10.1.15.35'));
    }

    res.json({ ...map, nodes: enrichedNodes });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

// Adicionar nó ao mapa
export const addNode = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { id: mapId } = req.params;
    const { apIp, label, x, y } = req.body;

    // Verificar se já existe nó com esse IP no mapa
    if (apIp) {
      const existing = await prisma.mapNode.findFirst({ where: { mapId: mapId as string, apIp } });
      if (existing) return res.status(409).json({ error: 'Dispositivo já está no mapa' });
    }

    // Usar queryRaw para garantir inserção do nickname mesmo com client desatualizado
    const id = crypto.randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO MapNode (id, mapId, apIp, label, x, y, alertsEnabled, pingEnabled)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1)
    `, id, mapId, apIp || null, label || null, x ?? 200, y ?? 200);

    const node = await prisma.mapNode.findUnique({ where: { id } });
    res.json(node);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

// Atualizar posição/label/IP do nó
export const updateNode = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { nodeId } = req.params;
    const { x, y, label, apIp } = req.body;
    
    // Se o usuário digitou uma string vazia pro apIp, vamos salvar como null pra não bugar
    const finalApIp = apIp === '' ? null : apIp;
    
    // Usar queryRaw para garantir atualização do nickname e outros campos
    await prisma.$executeRawUnsafe(`
      UPDATE MapNode 
      SET 
        x = COALESCE(?, x), 
        y = COALESCE(?, y), 
        label = COALESCE(?, label), 
        apIp = COALESCE(?, apIp)
      WHERE id = ?
    `, x ?? null, y ?? null, label ?? null, finalApIp ?? null, nodeId);

    const node = await prisma.mapNode.findUnique({ where: { id: nodeId as string } }) as any;

    // Se mudou IP/label, atualiza também os duplicados empilhados por precaução
    if (label !== undefined || apIp !== undefined) {
       await prisma.$executeRawUnsafe(`
         UPDATE MapNode 
         SET label = COALESCE(?, label), apIp = COALESCE(?, apIp)
         WHERE x = ? AND y = ? AND mapId = ? AND id != ?
       `, label ?? null, finalApIp ?? null, node.x, node.y, node.mapId, node.id);
    }

    res.json(node);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

// Atualizar múltiplos nós em massa (útil para arraste em grupo)
export const bulkUpdateNodes = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { updates } = req.body; // Array de { id, x, y }
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates deve ser um array' });

    const results = await prisma.$transaction(
      updates.map(u => 
        prisma.mapNode.update({
          where: { id: u.id },
          data: { x: u.x, y: u.y }
        })
      )
    );

    res.json({ ok: true, count: results.length });
  } catch (e) {
    console.error('Erro no bulk update:', e);
    res.status(500).json({ error: String(e) });
  }
};

// Remover nó
export const deleteNode = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { nodeId } = req.params;
    const nodeToDel = await prisma.mapNode.findUnique({ where: { id: nodeId as string } });
    if (!nodeToDel) return res.status(404).json({ error: 'Nó não encontrado' });

    // Definir critério de duplicação: mesmo mapa + mesmo apIp (ou mesmo label se for genérico)
    const matchCriteria = nodeToDel.apIp 
      ? { mapId: nodeToDel.mapId, apIp: nodeToDel.apIp }
      : { mapId: nodeToDel.mapId, label: nodeToDel.label };

    const duplicateNodes = await prisma.mapNode.findMany({ where: matchCriteria });
    const duplicateIds = duplicateNodes.map(n => n.id);

    // Deletar links associados a qualquer um desses nós duplicados
    await prisma.mapLink.deleteMany({
      where: { OR: [{ sourceNodeId: { in: duplicateIds } }, { targetNodeId: { in: duplicateIds } }] }
    });

    // Deletar todos os nós duplicados de uma vez
    await prisma.mapNode.deleteMany({ where: { id: { in: duplicateIds } } });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

// Criar link entre nós
export const addLink = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { id: mapId } = req.params;
    const { sourceNodeId, targetNodeId, linkType, label } = req.body;
    if (!sourceNodeId || !targetNodeId) {
      return res.status(400).json({ error: 'sourceNodeId e targetNodeId são obrigatórios' });
    }
    const link = await prisma.mapLink.create({
      data: { mapId: mapId as string, sourceNodeId: sourceNodeId as string, targetNodeId: targetNodeId as string, linkType: linkType ?? 'wireless', label: label ?? null }
    });
    res.json(link);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

// Deletar link
export const deleteLink = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { linkId } = req.params;
    console.log('Attempting to delete link:', linkId);
    
    const linkToDel = await prisma.mapLink.findUnique({ where: { id: linkId as string } });
    if (linkToDel) {
      await prisma.mapLink.deleteMany({
        where: {
          sourceNodeId: linkToDel.sourceNodeId,
          targetNodeId: linkToDel.targetNodeId
        }
      });
      await prisma.mapLink.deleteMany({
        where: {
          sourceNodeId: linkToDel.targetNodeId,
          targetNodeId: linkToDel.sourceNodeId
        }
      });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Error deleting link:', e);
    res.status(500).json({ error: String(e) });
  }
};

// Remover múltiplos nós (útil para seleção em massa)
export const bulkDeleteNodes = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids deve ser um array' });

    await prisma.$transaction([
      prisma.mapLink.deleteMany({
        where: { OR: [{ sourceNodeId: { in: ids } }, { targetNodeId: { in: ids } }] }
      }),
      prisma.mapNode.deleteMany({
        where: { id: { in: ids } }
      })
    ]);

    res.json({ ok: true });
  } catch (e) {
    console.error('Erro no bulk delete:', e);
    res.status(500).json({ error: String(e) });
  }
};

// Alternar pingEnabled
export const togglePing = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { nodeId } = req.params;
    const { enabled } = req.body;

    await prisma.$executeRawUnsafe(`
      UPDATE MapNode 
      SET pingEnabled = ?
      WHERE id = ?
    `, enabled ? 1 : 0, nodeId);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
