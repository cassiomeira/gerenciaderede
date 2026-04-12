import { Client } from 'ssh2';
import path from 'path';
import fs from 'fs';
import { radioService } from './radioService.js';

const BACKUP_DIR = 'C:/Users/NOTE/Documents/BackupsMikrotik';

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const LOG_FILE = 'c:/aplicativos/gerenciaderede1/gerenciaderede/gerenciaderede/gerenciaderede/network-monitor/backend/mac_poll.log';

export const backupService = {
  async performDeviceBackup(ip: string, name: string) {
    const passwords = [
      { user: 'N3tc@r', pass: 'AdminiStracao2021' },
      { user: 'matrix', pass: 'matrix' },
      { user: 'admin', pass: '' },
      { user: 'admin', pass: 'N3tc@r AdminiStracao2021' }
    ];

    fs.appendFileSync(LOG_FILE, `[BACKUP] Tentando ${name} (${ip})...\n`);
    
    for (const cred of passwords) {
      try {
        await this.tryBackupWithCreds(ip, name, cred.user, cred.pass);
        fs.appendFileSync(LOG_FILE, `[BACKUP] Sucesso em ${name} com usuário ${cred.user}\n`);
        return true;
      } catch (err: any) {
        // Continua para a próxima senha
      }
    }

    fs.appendFileSync(LOG_FILE, `[BACKUP] FALHA em todos os usuários para ${name} (${ip})\n`);
    throw new Error(`Falha de autenticação SSH em ${ip}`);
  },

  async tryBackupWithCreds(ip: string, name: string, user: string, pass: string, port = 22) {
    return new Promise((resolve, reject) => {
      let isDone = false;
      const conn = new Client();

      const done = (err?: any) => {
        if (isDone) return;
        isDone = true;
        clearTimeout(timer);
        try { conn.end(); } catch (e) {}
        if (err) reject(err); else resolve(true);
      };

      const timer = setTimeout(() => {
        done(new Error('Timeout absoluto de 30s no SSH'));
      }, 30000);

      conn.on('ready', () => {
        const backupName = `backup_${ip.replace(/\./g, '_')}`;
        const cmd = `/system backup save name=${backupName}; /export show-sensitive file=${backupName}`;
        
        conn.exec(cmd, (err, stream) => {
          if (err) return done(err);
          
          stream.on('close', () => {
            // Aguarda 1.5s pro MikroTik salvar o arquivo no disco físico
            setTimeout(async () => {
              try {
                await this.downloadBackupFiles(conn, backupName, ip, name);
                done();
              } catch (error) {
                done(error);
              }
            }, 1500);
          }).on('data', () => {}).stderr.on('data', () => {});
        });
      }).on('error', (err) => {
        done(err);
      }).on('close', () => {
        done(new Error('Conexão fechada inesperadamente pelo roteador'));
      }).connect({
        host: ip,
        port,
        username: user,
        password: pass,
        timeout: 10000,
        algorithms: {
           serverHostKey: [ 'ssh-rsa', 'ssh-dss' ],
           kex: [ 'diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha1' ],
           cipher: [ 'aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', '3des-cbc', 'aes256-cbc' ]
        }
      });
    });
  },

  async downloadBackupFiles(conn: Client, fileName: string, ip: string, deviceName: string) {
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const localBase = path.join(BACKUP_DIR, `${deviceName}_${ip.replace(/\./g, '_')}`);
        
        // Vamos baixar os dois: .backup e .rsc
        const filesToDownload = [
          { remote: `${fileName}.backup`, local: `${localBase}_${timestamp}.backup` },
          { remote: `${fileName}.rsc`, local: `${localBase}_${timestamp}.rsc` }
        ];

        let count = 0;
        filesToDownload.forEach(file => {
          sftp.fastGet(file.remote, file.local, (err) => {
            if (err) console.error(`[BACKUP] Erro ao baixar ${file.remote}:`, err);
            
            // Tenta remover do MikroTik após baixar para não encher o disco dele
            sftp.unlink(file.remote, () => {});
            
            count++;
            if (count === filesToDownload.length) {
              console.log(`[BACKUP] Arquivos baixados para ${deviceName}`);
              resolve(true);
            }
          });
        });
      });
    });
  }
};
