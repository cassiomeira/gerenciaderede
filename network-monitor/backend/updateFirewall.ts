import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/aplicativos/gerenciaderede/gerenciaderede/network-monitor/backend/data/netcar-telecom/tenant.db'
    }
  }
});

const MOVE_BLOCK = `
# Mover as regras para o topo da lista (evita bloqueio por Drop Rules)
:pcall { move [find comment="GERENCIA-SSH-1"] 0 }
:pcall { move [find comment="GERENCIA-SSH-2"] 1 }
:pcall { move [find comment="GERENCIA-SSH-3"] 2 }
:pcall { move [find comment="GERENCIA-SSH-4"] 3 }
:pcall { move [find comment="GERENCIA-SSH-5"] 4 }
:pcall { move [find comment="REDE-INTERNA-10"] 5 }
:pcall { move [find comment="REDE-INTERNA-192"] 6 }
:pcall { move [find comment="REDE-INTERNA-172"] 7 }
`;

async function main() {
  const scripts = await prisma.script.findMany();
  let updatedCount = 0;
  for (const script of scripts) {
    if (script.content.includes('GERENCIA-SSH-1') && !script.content.includes('move [find comment="GERENCIA-SSH-1"]')) {
      // Remover duplicatas caso a regra ja estivesse sendo só adicionada e falhou
      const removeBlock = `remove [find comment="GERENCIA-SSH-1"]\nremove [find comment="GERENCIA-SSH-2"]\nremove [find comment="GERENCIA-SSH-3"]\nremove [find comment="GERENCIA-SSH-4"]\nremove [find comment="GERENCIA-SSH-5"]\nremove [find comment="REDE-INTERNA-10"]\nremove [find comment="REDE-INTERNA-192"]\nremove [find comment="REDE-INTERNA-172"]\n\nadd chain=input`;
      
      let newContent = script.content.replace('add chain=input', removeBlock);
      
      // Inserir o bloco de move logo abaixo dos adds
      newContent = newContent.replace('add chain=input src-address=172.16.0.0/12 protocol=tcp dst-port=22 action=accept comment="REDE-INTERNA-172"', 
        'add chain=input src-address=172.16.0.0/12 protocol=tcp dst-port=22 action=accept comment="REDE-INTERNA-172"\n' + MOVE_BLOCK);
      
      await prisma.script.update({
        where: { id: script.id },
        data: { content: newContent }
      });
      updatedCount++;
      console.log(`Atualizado: ${script.name}`);
    } else {
      console.log(`Ja continha os Moves ou não possui as regras do firewall: ${script.name}`);
    }
  }
  console.log(`Scripts atualizados: ${updatedCount}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
