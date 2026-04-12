import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import networkRoutes from './routes/networkRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { authMiddleware } from './middleware/authMiddleware.js';
import { monitoringService } from './services/monitoringService.js';
import { startTelemetryWorker } from './services/telemetryWorker.js';
import { clientSyncWorker } from './services/clientSyncWorker.js';
import { whatsappService } from './services/whatsappService.js';
import { alertManager } from './services/alertManager.js';
import { telegramService } from './services/telegramService.js';
import { tunnelService } from './services/tunnelService.js';
import { ne8000Service } from './services/ne8000Service.js';
import ne8000Routes from './routes/ne8000Routes.js';
import { prisma } from './db.js';

// ====================================================================
// PROTEÇÃO GLOBAL: impede que erros de SNMP/SSH matem o servidor
// ====================================================================
process.on('uncaughtException', (err) => {
  console.error('[PROCESSO] Erro não capturado (ignorado para manter servidor UP):', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[PROCESSO] Promise rejeitada sem handler (ignorado):', reason);
});
// ====================================================================

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-secret', 'x-company-id']
}));
app.use(express.json());

// Auth Routes (públicas: /auth/login)
app.use('/auth', authRoutes);

// Debug público (sem autenticação) - diagnóstico do inventário
app.get('/api/debug/inventory/:ip', (_req, res) => {
  const ip = _req.params.ip;
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

// Debug: mostra IPs que estão ONLINE no inventário mas podem estar OFF no mapa
app.get('/api/debug/mismatch', (_req, res) => {
  const inventory = monitoringService.getInventory();
  const onlineIps = inventory.filter(d => d.online).map(d => d.ip);
  const offlineIps = inventory.filter(d => !d.online).map(d => d.ip);
  res.json({
    total: inventory.length,
    online: onlineIps.length,
    offline: offlineIps.length,
    sampleOnline: onlineIps.slice(0, 10),
    sampleOffline: offlineIps.slice(0, 10),
    timestamp: new Date().toISOString()
  });
});

import { getMap, getPingStatus } from './controllers/mapController.js';

// Debug MAPS
app.get('/api/debug/map/:id', getMap);
app.get('/api/debug/map/:id/ping', getPingStatus);

// NE8000 Routes (sem auth - dados de equipamento)
app.use('/api/ne8000', ne8000Routes);

// API Routes (protegidas por autenticação)
app.use('/api', authMiddleware, networkRoutes);

// Health Check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', message: 'Network Monitor API is running' });
});

const httpServer = app.listen(Number(PORT), '0.0.0.0', async () => {
  tunnelService.attachToServer(httpServer);
  
  monitoringService.startPolling();
  startTelemetryWorker();
  clientSyncWorker.startSchedule();
  whatsappService.initialize();
  alertManager.start().catch(err => console.error('[INDEX] Erro ao iniciar AlertManager:', err));
  ne8000Service.startPolling();

  // Inicializar Telegram Bot
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN || '';
  let telegramChatId = process.env.TELEGRAM_CHAT_ID || '';

  // Tentar carregar chatId do banco de dados
  try {
    const dbConfig = await (prisma as any).config.findUnique({ where: { key: 'telegram_chat_id' } });
    if (dbConfig?.value) {
      telegramChatId = dbConfig.value;
      console.log('[INDEX] Telegram chat ID carregado do banco:', telegramChatId);
    }
  } catch (err) {
    console.warn('[INDEX] Não foi possível ler telegram_chat_id do banco:', err);
  }

  if (telegramToken) {
    telegramService.configure(telegramToken, telegramChatId);
    telegramService.startPolling();
  } else {
    console.warn('[INDEX] TELEGRAM_BOT_TOKEN não definido, Telegram desativado.');
  }
});
