import { monitoringService } from './monitoringService.js';
import { whatsappService } from './whatsappService.js';
import { telegramService } from './telegramService.js';
import crypto from 'crypto';
import { prisma, getTenantPrisma } from '../db.js';
import { masterPrisma } from '../masterDb.js';
import { screenshotService } from './screenshotService.js';
import { openAIService } from './openAIService.js';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

interface NodeState {
  ip: string;
  lastStatus: 'ONLINE' | 'OFFLINE';
  offlineSince: Date | null;
  alertSent: boolean;
  companyId?: string | null;
}

class AlertManager {
  private nodeStates: Map<string, NodeState> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private alertGroup = ''; 
  private alertsEnabled = true;
  private telegramAlertsEnabled = true;
  private alertDelay = 60; // segundos
  private pendingOutages: Set<string> = new Set();
  private batchTimeout: NodeJS.Timeout | null = null;
  private summaryInterval = 0; // minutos (0 = desativado)
  private summaryTimer: NodeJS.Timeout | null = null;
  public async start() {
    if (this.checkInterval) return; // Já iniciado
    console.log('[ALERTAS] Iniciando monitor de quedas (Modo Agrupado)...');
    await this.loadConfig();
    this.checkInterval = setInterval(() => this.checkNodes(), 10000); 
  }

  public async reloadConfig() {
    console.log('[ALERTAS] Recarregando configurações...');
    await this.loadConfig();
  }

  private async loadConfig() {
    try {
      const config = await (prisma as any).config.findUnique({
        where: { key: 'whatsapp_alert_group' }
      });
      if (config) {
        this.alertGroup = config.value;
        console.log('[ALERTAS] Grupo de alertas carregado do banco:', this.alertGroup);
      }
      
      const enabledConfig = await (prisma as any).config.findUnique({ where: { key: 'whatsapp_alerts_enabled' } });
      this.alertsEnabled = enabledConfig ? enabledConfig.value === 'true' : true;

      const delayConfig = await (prisma as any).config.findUnique({ where: { key: 'whatsapp_alert_delay' } });
      this.alertDelay = delayConfig ? parseInt(delayConfig.value) : 60;

      const summaryConfig = await (prisma as any).config.findUnique({ where: { key: 'whatsapp_summary_interval' } });
      this.summaryInterval = summaryConfig && !isNaN(parseInt(summaryConfig.value)) ? parseInt(summaryConfig.value) : 10;

      const telegramEnabledConfig = await (prisma as any).config.findUnique({ where: { key: 'telegram_alerts_enabled' } });
      this.telegramAlertsEnabled = telegramEnabledConfig ? telegramEnabledConfig.value === 'true' : true;

      console.log(`[ALERTAS] Configs: Enabled=${this.alertsEnabled}, TelegramEnabled=${this.telegramAlertsEnabled}, Delay=${this.alertDelay}s, SummaryInterval=${this.summaryInterval}m`);
      
      this.scheduleSummary();
    } catch (err) {
      console.error('[ALERTAS] Erro ao carregar config:', err);
    }
  }

  private scheduleSummary() {
    if (this.summaryTimer) clearInterval(this.summaryTimer);
    if (!this.alertsEnabled || this.summaryInterval <= 0) return;
    
    console.log(`[ALERTAS] Resumo periódico agendado para cada ${this.summaryInterval} minutos.`);
    // O intervalo configurado é em minutos. Converter para milissegundos.
    this.summaryTimer = setInterval(() => this.sendSummary(), this.summaryInterval * 60 * 1000);
  }

  private async sendSummary() {
    if (!this.alertsEnabled || !this.alertGroup) return;

    try {
      console.log('[ALERTAS] Gerando resumo periódico...');
      const inventory = monitoringService.getInventory();
      const offlineIps = inventory.filter(n => !n.online).map(n => n.ip);
      
      if (offlineIps.length === 0) {
        console.log('[ALERTAS] Nenhum dispositivo offline para o resumo.');
        return; 
      }

      // Buscar nós offline (para descobrir em quais mapas eles estão e se estão mutados)
      const offlineNodes = await prisma.$queryRawUnsafe(`
        SELECT n.*, m.name as mapName, m.alertsEnabled as mapAlertsEnabled
        FROM MapNode n
        LEFT JOIN NetworkMap m ON n.mapId = m.id
        WHERE n.apIp IN (${offlineIps.map(() => '?').join(',')})
      `, ...offlineIps) as any[];

      const groupedByMap: Record<string, { mapName: string, nodes: any[] }> = {};
      let totalOfflineInMaps = 0;

      for (const mn of offlineNodes) {
        if (mn.alertsEnabled === 0 || mn.mapAlertsEnabled === 0 || mn.pingEnabled === 0 || mn.pingEnabled === false) continue;
        
        const invNode = inventory.find(n => n.ip === mn.apIp);
        if (!groupedByMap[mn.mapId]) {
          groupedByMap[mn.mapId] = { mapName: mn.mapName || 'Mapa Alternativo', nodes: [] };
        }
        groupedByMap[mn.mapId].nodes.push(invNode || { ip: mn.apIp, name: mn.label || 'Desconhecido' });
        totalOfflineInMaps++;
      }

      if (totalOfflineInMaps === 0) return;

      for (const mapId in groupedByMap) {
        const group = groupedByMap[mapId];
        let message = `📋 *RESUMO PERIÓDICO (4K): ${group.mapName.toUpperCase()}* 📋\n\n`;
        message += `⚠️ *${group.nodes.length} dispositivo(s) offline neste mapa:*\n`;
        group.nodes.forEach(node => {
          const displayName = node.nickname ? `${node.name || 'Desconhecido'} (${node.nickname})` : (node.name || 'Desconhecido');
          message += `• ${displayName} (${node.ip})\n`;
        });
        message += `\n⏱ *Horário:* ${new Date().toLocaleTimeString('pt-BR')}`;

        const screenshotPath = await (screenshotService as any).captureFullMap(mapId);
        if (screenshotPath) {
          const media = MessageMedia.fromFilePath(screenshotPath);
          // Enviar via WhatsApp
          await whatsappService.sendMessage(this.alertGroup, message, media).catch(e => console.error('[ALERTAS] Erro WhatsApp resumo:', e));
          // Enviar via Telegram
          if (this.telegramAlertsEnabled) {
            await telegramService.sendPhoto(screenshotPath, message).catch(e => console.error('[ALERTAS] Erro Telegram resumo:', e));
          }
          await screenshotService.cleanUp(screenshotPath);
        } else {
          await whatsappService.sendMessage(this.alertGroup, message).catch(e => console.error('[ALERTAS] Erro WhatsApp resumo:', e));
          if (this.telegramAlertsEnabled) {
            await telegramService.sendMessage(message).catch(e => console.error('[ALERTAS] Erro Telegram resumo:', e));
          }
        }
      }
    } catch (err) {
      console.error('[ALERTAS] Erro ao enviar resumo periódico:', err);
    }
  }

  public async setAlertGroup(id: string) {
    this.alertGroup = id;
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO Config ("key", value) VALUES ('whatsapp_alert_group', ?)
        ON CONFLICT("key") DO UPDATE SET value = excluded.value
      `, id);
      console.log('[ALERTAS] Grupo de alertas salvo no banco:', id);
    } catch (err) {
      console.error('[ALERTAS] Erro ao salvar config:', err);
    }
  }

  private async checkNodes() {
    const inventory = monitoringService.getInventory();
    const now = new Date();
    
    if (!this.alertsEnabled) return;

    // Buscar todas as empresas ativas para varrer seus bancos
    const companies = await masterPrisma.company.findMany({ where: { active: true } });
    const companyPrismas = new Map<string, any>();
    const allMapNodes = new Map<string, any>();

    // Carregar em cache as configurações de MAPA de todas as empresas
    for (const comp of companies) {
      if (!comp.dbPath) continue;
      try {
        const tenantPrisma = getTenantPrisma(comp.id);
        companyPrismas.set(comp.id, tenantPrisma);
        const nodes = await tenantPrisma.$queryRawUnsafe(`
          SELECT n.*, m.alertsEnabled as mapAlertsEnabled 
          FROM MapNode n
          LEFT JOIN NetworkMap m ON n.mapId = m.id
        `) as any[];
        // Indexar por IP
        for (const n of nodes) {
          if (n.apIp) {
            allMapNodes.set(n.apIp, { ...n, _tenantPrisma: tenantPrisma, _companyId: comp.id });
          }
        }
      } catch (err) {
        console.error(`[ALERT MANAGER] Erro ao conectar no DB da empresa ${comp.name}`, err);
      }
    }

    for (const node of inventory) {
      if (!node.ip) continue;

      const mapNode = allMapNodes.get(node.ip);

      // Se existir no mapa e o rádio ou o mapa estiver silenciado ou ping desativado (roxo), pula
      if (mapNode) {
        if (mapNode.alertsEnabled === 0 || mapNode.mapAlertsEnabled === 0 || mapNode.pingEnabled === 0 || mapNode.pingEnabled === false) {
          continue; 
        }
      }

      const currentState = node.online ? 'ONLINE' : 'OFFLINE';
      let state = this.nodeStates.get(node.ip);

      if (!state) {
        state = { ip: node.ip, lastStatus: 'ONLINE', offlineSince: null, alertSent: false, companyId: mapNode?._companyId };
        this.nodeStates.set(node.ip, state);
      } else if (mapNode?._companyId && !state.companyId) {
        state.companyId = mapNode._companyId;
      }

      // Proteger TypeScript: force state exist
      if (!state) continue;

      // Detectar queda
      if (currentState === 'OFFLINE' && state.lastStatus === 'ONLINE') {
        state.offlineSince = now;
        state.lastStatus = 'OFFLINE';
        state.alertSent = false;
        console.log(`[ALERTAS] ${node.ip} caiu.`);

        // Iniciar registro de histórico no tenant específico
        if (mapNode && mapNode._tenantPrisma) {
          try {
             await mapNode._tenantPrisma.$executeRawUnsafe(`
               INSERT INTO OutageHistory (id, nodeId, apIp, startTime, createdAt)
               VALUES (?, ?, ?, ?, ?)
             `, crypto.randomUUID(), mapNode.id, node.ip, now.toISOString(), now.toISOString());
          } catch (err) {
            console.error(`[ALERTAS] Erro ao criar histórico de queda para ${node.ip}:`, err);
          }
        }
      }

      // Detectar volta
      if (currentState === 'ONLINE' && state.lastStatus === 'OFFLINE') {
        const offlineTime = state.offlineSince ? (now.getTime() - state.offlineSince.getTime()) : 0;
        const wasOfflineLongEnough = offlineTime > 30000;
        
        // Finalizar registro de histórico
        try {
          const durationSeconds = offlineTime / 1000;
          await prisma.$executeRawUnsafe(`
            UPDATE OutageHistory 
            SET endTime = ?, duration = ?
            WHERE apIp = ? AND endTime IS NULL
          `, now.toISOString(), durationSeconds, node.ip);
        } catch (err) {
          console.error(`[ALERTAS] Erro ao finalizar histórico para ${node.ip}:`, err);
        }

        if (wasOfflineLongEnough || state.alertSent) {
          await this.clearNodeNotes(node.ip);
          
          if (state.alertSent) {
            await this.sendRecoveryAlert(node);
          }
        }

        state.offlineSince = null;
        state.lastStatus = 'ONLINE';
        state.alertSent = false;
        console.log(`[ALERTAS] ${node.ip} normalizado.`);
      }

      // Verificar regra de delay para alertar
      if (currentState === 'OFFLINE' && state.offlineSince && !state.alertSent) {
        const diff = (now.getTime() - state.offlineSince.getTime()) / 1000;
        if (diff >= this.alertDelay) {
          this.queueOutage(node.ip);
          state.alertSent = true;
        }
      }
    }
  }

  private async clearNodeNotes(ip: string) {
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE MapNode SET notes = NULL WHERE apIp = ?
      `, ip);
    } catch (err) {
      console.error(`[ALERTAS] Erro ao limpar notas de ${ip}:`, err);
    }
  }

  private queueOutage(ip: string) {
    this.pendingOutages.add(ip);
    
    // Aguardar 30 segundos para pegar outros dispositivos que possam estar caindo juntos
    if (!this.batchTimeout) {
      console.log('[ALERTAS] Iniciando janela de 30s para agrupar quedas...');
      this.batchTimeout = setTimeout(() => this.processOutageBatch(), 30000);
    }
  }

  private async processOutageBatch() {
    const ips = Array.from(this.pendingOutages);
    this.pendingOutages.clear();
    this.batchTimeout = null;

    if (ips.length === 0) return;

    try {
      console.log(`[ALERTAS] Processando lote de ${ips.length} quedas...`);
      
      const inventory = monitoringService.getInventory();
      // Buscar nós via raw SQL para incluir nickname
      const allMapNodes = await prisma.$queryRawUnsafe(`
        SELECT n.*, m.name as mapName 
        FROM MapNode n
        LEFT JOIN NetworkMap m ON n.mapId = m.id
        WHERE n.apIp IN (${ips.map(() => '?').join(',')})
      `, ...ips) as any[];

      // Agrupar por MapId
      const groupedByMap: Record<string, { mapName: string, nodes: any[] }> = {};
      const noMapNodes: any[] = [];

      ips.forEach(ip => {
        const invNode = inventory.find(n => n.ip === ip);
        const mapNodes = allMapNodes.filter((mn: any) => mn.apIp === ip);
        
        if (mapNodes.length > 0) {
          mapNodes.forEach((mn: any) => {
            if (!groupedByMap[mn.mapId]) {
              groupedByMap[mn.mapId] = { mapName: mn.map?.name || 'Mapa Alternativo', nodes: [] };
            }
            groupedByMap[mn.mapId].nodes.push(invNode || { ip, name: mn.label || 'Desconhecido' });
          });
        } else {
          noMapNodes.push(invNode || { ip, name: 'Desconhecido' });
        }
      });

      // Enviar alertas para cada mapa
      for (const mapId in groupedByMap) {
        const group = groupedByMap[mapId];
        let message = `🚨 *ALERTA DE QUEDA (4K): ${group.mapName.toUpperCase()}* 🚨\n\n`;
        message += `⚠️ *Dispositivos Offline (>1 min):*\n`;
        group.nodes.forEach(node => {
          const displayName = node.nickname ? `${node.name || 'Desconhecido'} (${node.nickname})` : (node.name || 'Desconhecido');
          message += `• ${displayName} (${node.ip}) | *id: recon ${node.ip}*\n`;
        });
        message += `\n📍 *Status:* OFFLINE\n`;
        message += `⏱ *Horário:* ${new Date().toLocaleTimeString('pt-BR')}`;

        // Montar a lista de IPs offline para repassar ao screenshot
        const offlineIps = group.nodes.map(n => n.ip).filter(Boolean).join(',');

        const screenshotPath = await (screenshotService as any).captureFullMap(mapId, offlineIps);
        if (screenshotPath) {
          const media = MessageMedia.fromFilePath(screenshotPath);
          // Enviar via WhatsApp
          await whatsappService.sendMessage(this.alertGroup, message, media).catch(e => console.error('[ALERTAS] Erro WhatsApp alerta:', e));
          // Enviar via Telegram
          if (this.telegramAlertsEnabled) {
            await telegramService.sendPhoto(screenshotPath, message).catch(e => console.error('[ALERTAS] Erro Telegram alerta:', e));
          }
          await screenshotService.cleanUp(screenshotPath);
        } else {
          await whatsappService.sendMessage(this.alertGroup, message).catch(e => console.error('[ALERTAS] Erro WhatsApp alerta:', e));
          if (this.telegramAlertsEnabled) {
            await telegramService.sendMessage(message).catch(e => console.error('[ALERTAS] Erro Telegram alerta:', e));
          }
        }
      }

      // Alerta para dispositivos sem mapa
      if (noMapNodes.length > 0) {
        let message = `🚨 *ALERTA DE QUEDA: DISPOSITIVOS GERAIS* 🚨\n\n`;
        message += `⚠️ *Offline (>1 min):*\n`;
        noMapNodes.forEach(node => {
          const displayName = node.nickname ? `${node.name || 'Desconhecido'} (${node.nickname})` : (node.name || 'Desconhecido');
          message += `• ${displayName} (${node.ip}) | *id: recon ${node.ip}*\n`;
        });
        await whatsappService.sendMessage(this.alertGroup, message).catch(e => console.error('[ALERTAS] Erro WhatsApp geral:', e));
        if (this.telegramAlertsEnabled) {
          await telegramService.sendMessage(message).catch(e => console.error('[ALERTAS] Erro Telegram geral:', e));
        }
      }

    } catch (err) {
      console.error('[ALERTAS] Erro ao processar lote de alertas:', err);
    }
  }

  private async sendRecoveryAlert(node: any) {
    try {
      const message = `✅ *EQUIPAMENTO NORMALIZADO* ✅\n` +
                      `📍 *Equipamento:* ${node.name || 'Desconhecido'}\n` +
                      `🌐 *IP:* ${node.ip}\n` +
                      `✨ *Status:* ONLINE`;
      
      await whatsappService.sendMessage(this.alertGroup, message).catch(e => console.error('[ALERTAS] Erro WhatsApp recovery:', e));
      if (this.telegramAlertsEnabled) {
        await telegramService.sendMessage(message).catch(e => console.error('[ALERTAS] Erro Telegram recovery:', e));
      }
    } catch (err) {
      console.error('[ALERTAS] Erro ao enviar recuperação:', err);
    }
  }

}

export const alertManager = new AlertManager();
