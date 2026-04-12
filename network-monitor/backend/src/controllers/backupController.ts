import { Request, Response } from 'express';
import { monitoringService } from '../services/monitoringService.js';
import { backupService } from '../services/backupService.js';
import { googleDriveService } from '../services/googleDriveService.js';
import fs from 'fs';
import path from 'path';

let isBackupInProgress = false;
const BACKUP_DIR = 'C:/Users/NOTE/Documents/BackupsMikrotik';
const LOG_FILE = 'c:/aplicativos/gerenciaderede1/gerenciaderede/gerenciaderede/gerenciaderede/network-monitor/backend/mac_poll.log';
const CREDENTIALS_PATH = 'c:/aplicativos/gerenciaderede1/gerenciaderede/gerenciaderede/gerenciaderede/network-monitor/backend/google-credentials.json';

export const runFullBackupProcess = async (folderId?: string) => {
  if (isBackupInProgress) return;
  isBackupInProgress = true;

  const BATCH_SIZE = 10; // 10 antenas simultâneas
  let successCount = 0;
  let failCount = 0;

  try {
    const inventory = monitoringService.getInventory();
    const onlineAPs = inventory.filter(ap => ap.online && ap.ip !== '0.0.0.0');

    fs.appendFileSync(LOG_FILE, `[BACKUP-ORCH] Iniciando processo PARALELO para ${onlineAPs.length} antenas (lotes de ${BATCH_SIZE})...\n`);

    if (onlineAPs.length === 0) {
      fs.appendFileSync(LOG_FILE, `[BACKUP-ORCH] Abortando: Inventário vazio ou antenas offline.\n`);
      return;
    }

    const hasCredentials = fs.existsSync(CREDENTIALS_PATH);

    for (let batchStart = 0; batchStart < onlineAPs.length; batchStart += BATCH_SIZE) {
      const batch = onlineAPs.slice(batchStart, batchStart + BATCH_SIZE);
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(onlineAPs.length / BATCH_SIZE);

      fs.appendFileSync(LOG_FILE, `[BACKUP-ORCH] === Lote ${batchNum}/${totalBatches} (${batch.length} antenas) ===\n`);

      const results = await Promise.allSettled(
        batch.map(async (ap, idx) => {
          const globalIdx = batchStart + idx + 1;
          try {
            await backupService.performDeviceBackup(ap.ip, ap.name);
            fs.appendFileSync(LOG_FILE, `[BACKUP-ORCH] [${globalIdx}/${onlineAPs.length}] SUCESSO: ${ap.name}\n`);
            successCount++;

            if (folderId && hasCredentials) {
              const files = fs.readdirSync(BACKUP_DIR).filter(f => f.includes(ap.ip.replace(/\./g, '_')) && !f.includes('uploaded'));
              for (const file of files) {
                const fullPath = path.join(BACKUP_DIR, file);
                await googleDriveService.uploadFile(fullPath, folderId);
                fs.renameSync(fullPath, fullPath + '.uploaded');
              }
            }
          } catch (err: any) {
            failCount++;
          }
        })
      );
    }

    fs.appendFileSync(LOG_FILE, `[BACKUP-ORCH] FINALIZADO! Sucesso: ${successCount}, Falha: ${failCount}, Total: ${onlineAPs.length}\n`);
    console.log(`[BACKUP-ORCH] Processo finalizado. Sucesso: ${successCount}, Falha: ${failCount}`);
  } finally {
    isBackupInProgress = false;
  }
};

export const triggerFullBackup = async (req: Request, res: Response) => {
  const folderId = req.body.folderId;
  
  if (isBackupInProgress) {
    return res.status(409).json({ error: 'Um backup já está em andamento.' });
  }

  res.json({ message: 'Backup iniciado. Os arquivos serão salvos em Documentos.' });
  runFullBackupProcess(folderId);
};

export const listLocalBackups = async (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
    const files = fs.readdirSync(BACKUP_DIR)
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          name: f,
          size: stats.size,
          date: stats.mtime,
          isUploaded: f.endsWith('.uploaded')
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 50);

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar backups' });
  }
};
