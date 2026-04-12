import { Request, Response } from 'express';
import { prisma } from '../db.js';
import archiver from 'archiver';
import * as ftp from 'basic-ftp';
import fs from 'fs';
import path from 'path';

export const triggerSystemBackup = async (req: Request, res: Response) => {
  const company = (req as any).company;
  const companyId = company?.id;
  const dbPath = company?.dbPath;

  if (!companyId || !dbPath) {
    return res.status(400).json({ error: 'Company ID ou DB Path não definidos. Endpoint apenas para Tenants.' });
  }

  try {
    const { ftpHost, ftpPort, ftpUser, ftpPass } = company as any;
    const hasFtpConf = ftpHost && ftpUser && ftpPass;
    const backupFileName = `backup_netmonitor.zip`; // Sempre o mesmo nome na nuvem para não estourar disco

    const tempFileName = `system_backup_${companyId}_${Date.now()}.zip`;
    const tempFilePath = path.join(path.dirname(dbPath), tempFileName);
    
    // Configurar a resposta para download no navegador
    res.attachment(backupFileName);
    
    // Criar o arquivo zip no disco temporário
    const output = fs.createWriteStream(tempFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // máximo de compressão
    });

    archive.on('error', (err) => {
      console.error('[SYSTEM BACKUP] Erro no archiver:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao gerar arquivo de backup' });
      }
    });

    archive.pipe(output);

    // 1. Injetar o arquivo do banco SQLite de dados da empresa (APs, Histórico, etc)
    if (fs.existsSync(dbPath)) {
      archive.file(dbPath, { name: 'tenant.db' });
    }

    // 2. Injetar o Master DB (Usuários, Senhas, Configurações Globais)
    const masterDbPath = path.join(process.cwd(), 'prisma', 'master.db');
    if (fs.existsSync(masterDbPath)) {
      archive.file(masterDbPath, { name: 'master.db' });
    }
    
    // 3. Injetar as credenciais do Edge Agent (se existirem localmente)
    // Esperar o arquivo ser escrito no disco para então disparar os uploads
    output.on('close', async () => {
      console.log(`[SYSTEM BACKUP] Arquivo ZIP gerado com ${archive.pointer()} bytes`);
      
      // 1. Enviar para o usuário baixar
      const readStream = fs.createReadStream(tempFilePath);
      readStream.pipe(res);
      
      readStream.on('end', () => {
        // Encerrou o download no browser
        if (!hasFtpConf) {
            // Se não tem FTP, apaga o temporário
            fs.unlinkSync(tempFilePath);
        }
      });

      // 2. Enviar por FTP (em background) se configurado
      if (hasFtpConf) {
        setTimeout(async () => {
          console.log(`[SYSTEM BACKUP] Iniciando envio FTP para ${ftpHost}:${ftpPort || 21}...`);
          const client = new ftp.Client();
          try {
            await client.access({
              host: ftpHost,
              user: ftpUser,
              password: ftpPass,
              port: ftpPort || 21,
              secure: false
            });
            
            await client.uploadFrom(tempFilePath, backupFileName);
            console.log(`[SYSTEM BACKUP] ✅ Arquivo enviado para FTP com sucesso (${backupFileName})`);
          } catch (ftpErr) {
            console.error('[SYSTEM BACKUP] ❌ Falha no envio FTP:', ftpErr);
          } finally {
            client.close();
            // Apaga o temporário após o FTP
            fs.unlinkSync(tempFilePath);
          }
        }, 0);
      }
    });

    archive.finalize();

  } catch (error: any) {
    console.error('[SYSTEM BACKUP] Falha geral:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao iniciar backup: ' + error.message });
    }
  }
};
