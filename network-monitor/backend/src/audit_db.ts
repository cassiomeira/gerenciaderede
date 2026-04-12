import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function audit() {
    try {
        const aps = await prisma.accessPoint.findMany();
        console.log('Total no Banco:', aps.length);
        console.log('Sucesso (SUCCESS):', aps.filter(a => a.lastSshStatus === 'SUCCESS').length);
        console.log('Falha (FAILED):', aps.filter(a => a.lastSshStatus === 'FAILED').length);
        console.log('Configurados (com senha):', aps.filter(a => a.sshPass).length);
        
        if (aps.length > 0) {
            console.log('Exemplos de SUCCESS:', aps.filter(a => a.lastSshStatus === 'SUCCESS').slice(0, 5).map(a => a.ip));
        }
    } catch (e) {
        console.error('Erro na auditoria:', e);
    } finally {
        await prisma.$disconnect();
    }
}

audit();
