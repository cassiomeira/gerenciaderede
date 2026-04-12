import { Router } from 'express';
import { 
  getClientStatus, searchClients, getTransmitters, getStats, triggerMacCache, 
  getTransmitterClients, updateTransmitterCredentials, getTransmitterDetails, getCachedTelemetry,
  getDeviceTelemetry, getTelemetryHistory, triggerTelemetry, collectSingleDeviceTelemetry, getBadSignals, pushTelemetry,
  getCompanySettings, updateCompanySettings
} from '../controllers/networkController.js';
import { whatsappService } from '../services/whatsappService.js';
import { telegramService } from '../services/telegramService.js';
import { alertManager } from '../services/alertManager.js';
import { openAIService } from '../services/openAIService.js';
import { triggerFullBackup, listLocalBackups } from '../controllers/backupController.js';
import { getScripts, createScript, updateScript, deleteScript, executeScript, getScriptResults, getLatestResults } from '../controllers/scriptController.js';
import { getMaps, createMap, updateMap, deleteMap, getMap, addNode, updateNode, bulkUpdateNodes, deleteNode, bulkDeleteNodes, addLink, deleteLink, getPingStatus, searchNodes, togglePing } from '../controllers/mapController.js';
import { pingContinuous, launchWinbox, traceroute } from '../controllers/toolsController.js';
import { tunnelService } from '../services/tunnelService.js';
import { monitoringService } from '../services/monitoringService.js';

const router = Router();

router.get('/client-status', getClientStatus);
router.get('/clients/search', searchClients);
router.get('/transmitters', getTransmitters);
router.get('/transmitters/:ip/clients', getTransmitterClients);
router.get('/transmitters/:ip/details', getTransmitterDetails);
router.post('/transmitters/:id/credentials', updateTransmitterCredentials);
router.get('/transmitters/:ip/telemetry-cached', getCachedTelemetry);
router.get('/stats', getStats);
router.post('/trigger-cache', triggerMacCache);

// Edge Agent - Lista de dispositivos para monitorar localmente
router.get('/edge/devices', async (req, res) => {
  try {
    const inventory = monitoringService.getInventory();
    const devices = inventory.map((d: any) => ({ ip: d.ip, name: d.name }));
    console.log('[EDGE] Enviando ' + devices.length + ' dispositivos para o agente (via Inventory).');
    res.json(devices);
  } catch (err: any) {
    console.error('[EDGE] Erro ao buscar dispositivos:', err.message);
    res.status(500).json({ error: err.message });
  }
});


import { triggerSystemBackup } from '../controllers/systemBackupController.js';

// Diagnóstico rápido de um IP no inventário
router.get('/debug/inventory/:ip', (req, res) => {
  const ip = req.params.ip;
  const inventory = monitoringService.getInventory();
  const device = inventory.find(d => d.ip === ip);
  const totalDevices = inventory.length;
  const onlineCount = inventory.filter(d => d.online).length;
  res.json({
    ip,
    found: !!device,
    device: device || null,
    inventorySize: totalDevices,
    onlineCount,
    timestamp: new Date().toISOString()
  });
});

// Rotas de Backup
router.post('/backups/trigger', triggerFullBackup);
router.get('/backups/list', listLocalBackups);
router.get('/system-backup', triggerSystemBackup);
router.get('/reports/bad-signals', getBadSignals);

// WhatsApp
router.get('/config', async (req, res) => {
  try {
    const prisma = req.tenantPrisma;
    const configs = await (prisma as any).config.findMany();
    const configMap = configs.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
    res.json(configMap);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar configs' });
  }
});

router.post('/config', async (req, res) => {
  const { key, value } = req.body;
  try {
    const prisma = req.tenantPrisma;
    await (prisma as any).config.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    });
    
    // Notificar AlertManager se necessário
    if (key.startsWith('whatsapp_') || key.startsWith('telegram_')) {
      await alertManager.reloadConfig(); // Recarregar configs
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar config' });
  }
});

router.get('/whatsapp/status', (req, res) => {
  res.json({
    ...whatsappService.getStatus(),
    groupId: (alertManager as any).alertGroup
  });
});
router.get('/whatsapp/qr', (req, res) => {
  const qr = whatsappService.getQrCode();
  res.json({ qr });
});
router.post('/whatsapp/group', (req, res) => {
  const { groupId } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId é obrigatório' });
  alertManager.setAlertGroup(groupId);
  res.json({ success: true });
});

router.post('/whatsapp/test', async (req, res) => {
  const { message } = req.body;
  try {
    const target = (alertManager as any).alertGroup;
    await whatsappService.sendMessage(target, message || '🚀 Teste de Alerta NetMonitor - WhatsApp está funcionando!');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ======================== TELEGRAM ========================

router.get('/telegram/status', async (req, res) => {
  const status = telegramService.getStatus();
  res.json(status);
});

router.post('/telegram/configure', async (req, res) => {
  const { chatId } = req.body;
  try {
    if (chatId) {
      telegramService.setChatId(chatId);
      const prisma = req.tenantPrisma;
      await (prisma as any).config.upsert({
        where: { key: 'telegram_chat_id' },
        update: { value: String(chatId) },
        create: { key: 'telegram_chat_id', value: String(chatId) }
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/telegram/test', async (req, res) => {
  const { message } = req.body;
  try {
    const ok = await telegramService.sendMessage(
      message || '🚀 Teste de Alerta NetMonitor - Telegram está funcionando!'
    );
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Telemetria
router.get('/telemetry/:ip', getDeviceTelemetry);
router.get('/telemetry/:ip/history', getTelemetryHistory);
router.post('/trigger-telemetry', triggerTelemetry);
router.post('/telemetry/push', pushTelemetry);
router.post('/telemetry/:ip/collect', collectSingleDeviceTelemetry);

// Company Settings (Telemetry Mode)
router.get('/company/settings', getCompanySettings);
router.post('/company/settings', updateCompanySettings);

router.post('/telemetry/:ip/analyze', async (req, res) => {
  const { ip } = req.params;
  try {
    const analysis = await openAIService.analyzeOutage(ip);
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: 'Erro na análise IA' });
  }
});

// Túnel Reverso Winbox
router.post('/tunnel/request', async (req, res) => {
  const { ip, port } = req.body;
  const companyId = (req as any).company?.id;

  if (!companyId) return res.status(403).json({ error: 'Empresa não identificada' });
  if (!ip) return res.status(400).json({ error: 'IP de destino é obrigatório' });

  try {
    const tunnel = await tunnelService.createTunnel(companyId, ip, port || 8291);
    res.json({ success: true, port: tunnel.port, serverId: tunnel.serverId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Script Management
router.get('/scripts', getScripts);
router.post('/scripts', createScript);
router.put('/scripts/:id', updateScript);
router.delete('/scripts/:id', deleteScript);
router.post('/scripts/:id/execute', executeScript);
router.get('/scripts/:id/results', getScriptResults);
router.get('/script-results', getLatestResults);

// Network Maps
router.get('/maps/search', searchNodes);
router.get('/maps', getMaps);
router.post('/maps', createMap);
router.put('/maps/:id', updateMap);
router.delete('/maps/:id', deleteMap);
router.get('/maps/:id', getMap);
router.get('/maps/:id/ping', getPingStatus);
router.post('/maps/:id/nodes', addNode);
router.post('/maps/:id/links', addLink);
router.delete('/maps/:id/links/:linkId', deleteLink);
router.put('/maps/:id/nodes/bulk', bulkUpdateNodes);
router.put('/maps/:id/nodes/:nodeId', updateNode);
router.put('/maps/:id/nodes/:nodeId/ping-toggle', togglePing);
router.delete('/maps/:id/nodes/:nodeId', deleteNode);
router.post('/maps/:id/nodes/:nodeId/acknowledge', async (req, res) => {
  const { nodeId } = req.params;
  const { notes } = req.body;
  try {
    const prisma = req.tenantPrisma;
    await (prisma.mapNode as any).update({
      where: { id: nodeId },
      data: { notes }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar reconhecimento' });
  }
});

router.put('/maps/:id/alerts', async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;
  try {
    const prisma = req.tenantPrisma;
    await prisma.$executeRawUnsafe(`
      UPDATE NetworkMap SET alertsEnabled = ? WHERE id = ?
    `, enabled ? 1 : 0, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao toggar alertas do mapa' });
  }
});

router.put('/maps/:id/nodes/:nodeId/alerts', async (req, res) => {
  const { nodeId } = req.params;
  const { enabled } = req.body;
  try {
    const prisma = req.tenantPrisma;
    await prisma.$executeRawUnsafe(`
      UPDATE MapNode SET alertsEnabled = ? WHERE id = ?
    `, enabled ? 1 : 0, nodeId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao toggar alertas do rádio' });
  }
});

router.get('/nodes/:nodeId/history', async (req, res) => {
  const { nodeId } = req.params;
  try {
    const prisma = req.tenantPrisma;
    const history = await prisma.$queryRawUnsafe(`
      SELECT * FROM OutageHistory 
      WHERE nodeId = ? 
      ORDER BY startTime DESC 
      LIMIT 100
    `, nodeId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar histórico do rádio' });
  }
});

router.put('/maps/:id/nodes/:nodeId/nickname', async (req, res) => {
  const { nodeId } = req.params;
  const { nickname } = req.body;
  try {
    const prisma = req.tenantPrisma;
    await prisma.$executeRawUnsafe(`
      UPDATE MapNode SET nickname = ? WHERE id = ?
    `, nickname, nodeId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar apelido' });
  }
});

router.put('/maps/:id/nodes/bulk/nickname', async (req, res) => {
  const { nodeIds, nickname } = req.body;
  console.log(`[BULK NICKNAME] Recebido: ${nodeIds?.length} nós, Apelido: "${nickname}"`);
  
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
    return res.status(400).json({ error: 'Nenhum ID fornecido' });
  }

  try {
    const prisma = req.tenantPrisma;
    let successCount = 0;
    for (const nodeId of nodeIds) {
      await prisma.$executeRawUnsafe(`UPDATE MapNode SET nickname = ? WHERE id = ?`, nickname, nodeId);
      successCount++;
    }
    
    console.log(`[BULK NICKNAME] Sucesso: ${successCount}/${nodeIds.length}`);
    res.json({ success: true, count: successCount });
  } catch (err) {
    console.error('[BULK NICKNAME] Erro fatal:', err);
    res.status(500).json({ error: 'Erro ao salvar apelidos em massa' });
  }
});

// Tools (Ping, Winbox, Traceroute)
router.get('/tools/ping/:ip', pingContinuous);
router.post('/tools/winbox/:ip', launchWinbox);
router.get('/tools/traceroute/:ip', traceroute);

export default router;
