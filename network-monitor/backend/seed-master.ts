import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const masterPrisma = new PrismaClient({
  datasources: {
    db: { url: `file:${process.cwd()}/prisma/master.db` }
  }
});

const DATA_DIR = path.resolve(process.cwd(), 'data');

async function seed() {
  console.log('=== SEED: Configurando empresa Netcar Telecom ===');

  // 1. Criar diretório data/netcar-telecom
  const companyDir = path.join(DATA_DIR, 'netcar-telecom');
  if (!fs.existsSync(companyDir)) {
    fs.mkdirSync(companyDir, { recursive: true });
  }

  // 2. Copiar banco atual para a pasta da empresa
  const currentDb = path.resolve(process.cwd(), 'prisma/dev.db');
  const tenantDb = path.join(companyDir, 'tenant.db');

  if (fs.existsSync(currentDb) && !fs.existsSync(tenantDb)) {
    console.log(`Copiando ${currentDb} -> ${tenantDb}`);
    fs.copyFileSync(currentDb, tenantDb);
  } else if (fs.existsSync(tenantDb)) {
    console.log('Banco da empresa já existe, pulando cópia.');
  }

  // 3. Copiar sessão WhatsApp se existir
  const currentWhatsapp = path.resolve(process.cwd(), 'whatsapp-session');
  const tenantWhatsapp = path.join(companyDir, 'whatsapp-session');
  if (fs.existsSync(currentWhatsapp) && !fs.existsSync(tenantWhatsapp)) {
    console.log('Copiando sessão WhatsApp...');
    fs.cpSync(currentWhatsapp, tenantWhatsapp, { recursive: true });
  }

  // 4. Criar empresa no master
  const company = await masterPrisma.company.upsert({
    where: { slug: 'netcar-telecom' },
    update: {
      dbPath: tenantDb,
      csvPath: process.env.CSV_PATH || '',
      ixcUrl: process.env.IXC_URL || '',
      ixcToken: process.env.IXC_TOKEN || '',
    },
    create: {
      name: 'Netcar Telecom',
      slug: 'netcar-telecom',
      dbPath: tenantDb,
      csvPath: process.env.CSV_PATH || '',
      ixcUrl: process.env.IXC_URL || '',
      ixcToken: process.env.IXC_TOKEN || '',
    }
  });
  console.log(`Empresa: ${company.name} (ID: ${company.id})`);

  // 5. Criar usuário mestre
  const hashedPassword = await bcrypt.hash('28152815@', 10);
  const user = await masterPrisma.user.upsert({
    where: { email: 'cassiomeiramir4@gmail.com' },
    update: { password: hashedPassword },
    create: {
      email: 'cassiomeiramir4@gmail.com',
      password: hashedPassword,
      name: 'Cássio Meira',
      role: 'ADMIN',
      companyId: company.id
    }
  });
  console.log(`Usuário mestre: ${user.email} (Role: ${user.role})`);

  // 6. Atualizar DATABASE_URL no .env para apontar para o tenant (backward-compat)
  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');
  const newDbUrl = `file:${tenantDb.replace(/\\/g, '/')}`;
  envContent = envContent.replace(
    /DATABASE_URL="[^"]*"/,
    `DATABASE_URL="${newDbUrl}"`
  );
  fs.writeFileSync(envPath, envContent);
  console.log(`DATABASE_URL atualizado para: ${newDbUrl}`);

  console.log('=== SEED CONCLUÍDO ===');
}

seed().finally(() => masterPrisma.$disconnect());
