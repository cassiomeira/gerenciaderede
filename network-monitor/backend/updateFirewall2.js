import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/aplicativos/gerenciaderede/gerenciaderede/network-monitor/backend/data/netcar-telecom/tenant.db'
    }
  }
});

const NEW_MOVE_BLOCK = `
# Mover as regras para o topo da lista (evita bloqueio por Drop Rules)
:local topRule [:pick [find chain=input] 0];
:if ([:type $topRule] = "id") do={
  :pcall { move [find comment="GERENCIA-SSH-1"] destination=$topRule }
  :pcall { move [find comment="GERENCIA-SSH-2"] destination=$topRule }
  :pcall { move [find comment="GERENCIA-SSH-3"] destination=$topRule }
  :pcall { move [find comment="GERENCIA-SSH-4"] destination=$topRule }
  :pcall { move [find comment="GERENCIA-SSH-5"] destination=$topRule }
  :pcall { move [find comment="SERVER-MONITOR-FULL-ACCESS"] destination=$topRule }
  :pcall { move [find comment="REDE-INTERNA-10"] destination=$topRule }
  :pcall { move [find comment="REDE-INTERNA-192"] destination=$topRule }
  :pcall { move [find comment="REDE-INTERNA-172"] destination=$topRule }
}
`;

async function main() {
  const scripts = await prisma.script.findMany();
  let updatedCount = 0;
  for (const script of scripts) {
    if (script.content.includes(':pcall { move [find comment="GERENCIA-SSH-1"] 0 }')) {
      const oldBlock = `# Mover as regras para o topo da lista (evita bloqueio por Drop Rules)\n:pcall { move [find comment="GERENCIA-SSH-1"] 0 }\n:pcall { move [find comment="GERENCIA-SSH-2"] 1 }\n:pcall { move [find comment="GERENCIA-SSH-3"] 2 }\n:pcall { move [find comment="GERENCIA-SSH-4"] 3 }\n:pcall { move [find comment="GERENCIA-SSH-5"] 4 }\n:pcall { move [find comment="REDE-INTERNA-10"] 5 }\n:pcall { move [find comment="REDE-INTERNA-192"] 6 }\n:pcall { move [find comment="REDE-INTERNA-172"] 7 }`;
      
      let newContent = script.content.replace(oldBlock, NEW_MOVE_BLOCK);
      
      await prisma.script.update({
        where: { id: script.id },
        data: { content: newContent }
      });
      updatedCount++;
      console.log(`Atualizado: ${script.name}`);
    } else {
      console.log(`Sem o bloco antigo: ${script.name}`);
    }
  }
  console.log(`Scripts atualizados com nova sintaxe nativa: ${updatedCount}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
