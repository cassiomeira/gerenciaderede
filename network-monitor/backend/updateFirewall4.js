import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/aplicativos/gerenciaderede/gerenciaderede/network-monitor/backend/data/netcar-telecom/tenant.db'
    }
  }
});

const COMPLETE_FIREWALL_BLOCK = `# 1. FIREWALL - Limpar tudo e adicionar regras fixas da Netcar
/ip firewall filter remove [find]
/ip firewall filter
add action=accept chain=input comment=SERVER-MONITOR-FULL-ACCESS src-address=192.168.13.230
add action=accept chain=input comment="Allow Winbox" dst-port=8291 protocol=tcp
add action=accept chain=input comment="Allow Ping" protocol=icmp
add action=drop chain=input comment="Drop Invalid connections" connection-state=invalid
add action=accept chain=input comment=GERENCIA-SSH-1 dst-port=22 protocol=tcp src-address=177.184.176.1
add action=accept chain=input comment=GERENCIA-SSH-2 dst-port=22 protocol=tcp src-address=177.184.190.250
add action=accept chain=input comment=GERENCIA-SSH-3 dst-port=22 protocol=tcp src-address=177.184.190.27
add action=accept chain=input comment=GERENCIA-SSH-4 dst-port=22 protocol=tcp src-address=217.216.86.231
add action=accept chain=input comment=GERENCIA-SSH-5 dst-port=22 protocol=tcp src-address=45.229.107.79
add action=accept chain=input comment=SERVER-MONITOR-FULL-ACCESS src-address=192.168.13.230
add action=accept chain=input comment=REDE-INTERNA-10 dst-port=22 protocol=tcp src-address=10.0.0.0/8
add action=accept chain=input comment=REDE-INTERNA-192 dst-port=22 protocol=tcp src-address=192.168.0.0/16
add action=accept chain=input comment=REDE-INTERNA-172 dst-port=22 protocol=tcp src-address=172.16.0.0/12
add action=accept chain=input comment="Allow Winbox" dst-port=8291 protocol=tcp
add action=accept chain=input comment="Allow Ping" protocol=icmp
add action=accept chain=input comment=Matrix-Aceita_OSPF disabled=yes protocol=ospf
add action=accept chain=output comment=Matrix-Aceita_OSPF disabled=yes protocol=ospf
add action=drop chain=forward comment="BLOQUEIO IXC" src-address=10.254.254.0/24
add action=add-src-to-address-list address-list=Acesso_Liberado_Firewall address-list-timeout=1h chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=4248 protocol=tcp
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=21 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=23 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=53 protocol=udp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=53 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=69 protocol=udp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=161 protocol=udp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=443 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=2000 protocol=udp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=2000 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=8081 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router disabled=yes dst-port=8291 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=8728 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=8729 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=forward comment="VIRUS ONU" disabled=yes dst-address=2.59.220.104
add action=drop chain=input comment="Drop Invalid connections" connection-state=invalid`;

async function main() {
  const scripts = await prisma.script.findMany();
  let updatedCount = 0;
  for (const script of scripts) {
    if (script.content.includes('/ip firewall filter')) {
      // Find the start of the firewall block
      const startIdx = script.content.indexOf('# 1. FIREWALL');
      if (startIdx !== -1) {
        // Find the END of the firewall block. Look for the next section, e.g., '# 2. SNMP' or '# 2. DATA/HORA'
        const endIdx = script.content.indexOf('# 2.', startIdx);
        
        if (endIdx !== -1) {
          const before = script.content.substring(0, startIdx);
          const after = script.content.substring(endIdx);
          const finalContent = before + COMPLETE_FIREWALL_BLOCK + '\n\n' + after;
          
          await prisma.script.update({
            where: { id: script.id },
            data: { content: finalContent }
          });
          updatedCount++;
          console.log(`Atualizado bloco de Firewall em: ${script.name}`);
        }
      }
    }
  }
  console.log(`Total Firewall Customizados Injetados: ${updatedCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
