import { ixcService } from './ixcService.js';
import { prisma } from '../db.js';

let isSyncRunning = false;

export const clientSyncWorker = {
  async runSync() {
    if (isSyncRunning) return;
    isSyncRunning = true;

    try {
      console.log('[SYNC] Iniciando sincronização global de clientes IXC...');
      let page = 1;
      let totalSynced = 0;
      let hasMore = true;

      while (hasMore) {
        const clients = await ixcService.listAllClients(page, 1000);
        
        if (clients.length === 0) {
          hasMore = false;
          break;
        }

        // Upsert em massa (limitado pelo SQLite, fazemos um por um ou em pequenos blocos)
        for (const c of clients) {
          try {
            await (prisma.client as any).upsert({
              where: { ixcId: c.ixcId },
              update: { 
                mac: c.mac,
                name: c.razao,
                contractId: c.id_contrato,
                ixcClientId: c.ixcClientId,
                ip: c.ip,
                concentratorIp: c.concentratorIp,
                planName: c.planName,
                contractStatus: c.contractStatus,
                status: c.online === 'S' ? 'ONLINE' : 'OFFLINE',
                transmitterId: c.id_transmissor,
                updatedAt: new Date()
              },
              create: {
                ixcId: c.ixcId,
                login: c.login,
                mac: c.mac,
                name: c.razao,
                contractId: c.id_contrato,
                ixcClientId: c.ixcClientId,
                ip: c.ip,
                concentratorIp: c.concentratorIp,
                planName: c.planName,
                contractStatus: c.contractStatus,
                status: c.online === 'S' ? 'ONLINE' : 'OFFLINE',
                transmitterId: c.id_transmissor
              }
            });
            totalSynced++;
          } catch (e: any) {
            // Silently continue for duplicate logins if they happen despite our CRM- prefix fallback
          }
        }

        console.log(`[SYNC] Página ${page} concluída. Total até agora: ${totalSynced}`);
        page++;
        
        // Pequena pausa para não sobrecarregar o banco ou CPU
        await new Promise(r => setTimeout(r, 500));
      }

      console.log(`[SYNC] Sincronização concluída com sucesso. Total de clientes: ${totalSynced}`);
    } catch (error: any) {
      console.error('[SYNC] Falha na sincronização de clientes:', error.message);
    } finally {
      isSyncRunning = false;
    }
  },

  startSchedule() {
    // Executa imediatamente ao iniciar
    this.runSync().catch(console.error);
    
    // Agenda para cada 1 hora
    setInterval(() => {
      this.runSync().catch(console.error);
    }, 3600000);
  }
};
