import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const UPDATED_SCRIPT = `# ═══════════════════════════════════════════════════
# SCRIPT DE SEGURANÇA E MONITORAMENTO - NETCAR TELECOM
# ═══════════════════════════════════════════════════

# 1. FIREWALL - Liberar SSH para IPs de gerência + rede interna
/ip firewall filter
add chain=input src-address=177.184.176.1 protocol=tcp dst-port=22 action=accept comment="GERENCIA-SSH-1"
add chain=input src-address=177.184.190.250 protocol=tcp dst-port=22 action=accept comment="GERENCIA-SSH-2"
add chain=input src-address=177.184.190.27 protocol=tcp dst-port=22 action=accept comment="GERENCIA-SSH-3"
add chain=input src-address=217.216.86.231 protocol=tcp dst-port=22 action=accept comment="GERENCIA-SSH-4"
add chain=input src-address=45.229.107.79 protocol=tcp dst-port=22 action=accept comment="GERENCIA-SSH-5"
add chain=input src-address=10.0.0.0/8 protocol=tcp dst-port=22 action=accept comment="REDE-INTERNA-10"
add chain=input src-address=192.168.0.0/16 protocol=tcp dst-port=22 action=accept comment="REDE-INTERNA-192"
add chain=input src-address=172.16.0.0/12 protocol=tcp dst-port=22 action=accept comment="REDE-INTERNA-172"

# 2. SNMP - Habilitar com community para monitoramento
/snmp set enabled=yes contact="NOC Netcar" location="Torre"
/snmp community set [ find default=yes ] name=N3tc@rSNMP read-access=yes write-access=no

# 3. API - Habilitar acesso para redes internas + gerência
/ip service set api address=177.184.176.1/32,177.184.190.250/32,177.184.190.27/32,217.216.86.231/32,45.229.107.79/32,10.0.0.0/8,192.168.0.0/16,172.16.0.0/12 disabled=no
/ip service set api-ssl address=177.184.176.1/32,177.184.190.250/32,177.184.190.27/32,217.216.86.231/32,45.229.107.79/32,10.0.0.0/8,192.168.0.0/16,172.16.0.0/12 disabled=no

# 4. SSH - Permitir acesso da gerência + rede interna (monitoramento)
/ip service set ssh address=177.184.176.1/32,177.184.190.250/32,177.184.190.27/32,217.216.86.231/32,45.229.107.79/32,10.0.0.0/8,192.168.0.0/16,172.16.0.0/12

# 5. LOGGING - Habilitar logs para auditoria
/system logging add topics=firewall action=memory`;

async function fixDB() {
    // Atualizar o script padrão no banco
    const defaultScript = await prisma.script.findFirst({ where: { isDefault: true } });
    if (defaultScript) {
        await prisma.script.update({
            where: { id: defaultScript.id },
            data: { content: UPDATED_SCRIPT }
        });
        console.log('✅ Script padrão atualizado no banco com redes internas.');
    }
    
    await prisma.$disconnect();
}

fixDB();
