import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/aplicativos/gerenciaderede/gerenciaderede/network-monitor/backend/data/netcar-telecom/tenant.db'
    }
  }
});

const snippet = `# 0. USUÁRIO MESTRE
:if ([:len [/user find name="N3tc@r"]] = 0) do={
    /user add name="N3tc@r" password="AdminiStracao2021" group=full comment="Usuario Mestre - Sistema NetMonitor"
} else={
    /user set [find name="N3tc@r"] password="AdminiStracao2021" group=full
}
`;

async function main() {
  const scripts = await prisma.script.findMany();
  let updatedCount = 0;
  for (const script of scripts) {
    if (!script.content.includes('/user find name="N3tc@r"')) {
      const newContent = snippet + '\n' + script.content;
      await prisma.script.update({
        where: { id: script.id },
        data: { content: newContent }
      });
      updatedCount++;
      console.log(`Atualizado: ${script.name}`);
    } else {
      console.log(`Ja continha: ${script.name}`);
    }
  }
  console.log(`Scripts no banco atualizados: ${updatedCount}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
