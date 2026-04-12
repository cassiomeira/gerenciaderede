import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/aplicativos/gerenciaderede/gerenciaderede/network-monitor/backend/data/netcar-telecom/tenant.db'
    }
  }
});

async function main() {
  const scripts = await prisma.script.findMany();
  let updatedCount = 0;
  for (const script of scripts) {
    if (script.content.includes('GERENCIA-SSH-1')) {
      
      let content = script.content;
      
      // Strip old specific removes
      content = content.replace(/remove \[find comment="GERENCIA-SSH-1"\]/g, '');
      content = content.replace(/remove \[find comment="GERENCIA-SSH-2"\]/g, '');
      content = content.replace(/remove \[find comment="GERENCIA-SSH-3"\]/g, '');
      content = content.replace(/remove \[find comment="GERENCIA-SSH-4"\]/g, '');
      content = content.replace(/remove \[find comment="GERENCIA-SSH-5"\]/g, '');
      content = content.replace(/remove \[find comment="REDE-INTERNA-10"\]/g, '');
      content = content.replace(/remove \[find comment="REDE-INTERNA-192"\]/g, '');
      content = content.replace(/remove \[find comment="REDE-INTERNA-172"\]/g, '');
      
      // Strip move logic 1
      content = content.replace(/# Mover as regras para o topo da lista \(evita bloqueio por Drop Rules\)/g, '');
      content = content.replace(/:local topRule \[:pick \[find chain=input\] 0\];\s*:if \(\[:type \$topRule\] = "id"\) do=\{[\s\S]*?\}/g, '');
      
      // Strip move logic 2 (if present)
      content = content.replace(/:pcall \{ move \[find comment="GERENCIA-SSH-1"\].*?\}/g, '');
      content = content.replace(/:pcall \{ move \[find comment="GERENCIA-SSH-2"\].*?\}/g, '');
      content = content.replace(/:pcall \{ move \[find comment="GERENCIA-SSH-3"\].*?\}/g, '');
      content = content.replace(/:pcall \{ move \[find comment="GERENCIA-SSH-4"\].*?\}/g, '');
      content = content.replace(/:pcall \{ move \[find comment="GERENCIA-SSH-5"\].*?\}/g, '');
      content = content.replace(/:pcall \{ move \[find comment="SERVER-MONITOR-FULL-ACCESS"\].*?\}/g, '');
      content = content.replace(/:pcall \{ move \[find comment="REDE-INTERNA-10"\].*?\}/g, '');
      content = content.replace(/:pcall \{ move \[find comment="REDE-INTERNA-192"\].*?\}/g, '');
      content = content.replace(/:pcall \{ move \[find comment="REDE-INTERNA-172"\].*?\}/g, '');

      // Insert wipe command Before the rules
      const WIPE = `/ip firewall filter remove [find]\n/ip firewall filter`;
      content = content.replace(/\/ip firewall filter(\s*)\n(\s*)add chain=input src-address=177\.184\.176\.1/g, WIPE + '\nadd chain=input src-address=177.184.176.1');
      
      // Clean up multiple empty lines
      content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      await prisma.script.update({
        where: { id: script.id },
        data: { content: content }
      });
      updatedCount++;
      console.log(`Atualizado: ${script.name}`);
    }
  }
  console.log(`Scripts atualizados com WIPE ALL: ${updatedCount}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
