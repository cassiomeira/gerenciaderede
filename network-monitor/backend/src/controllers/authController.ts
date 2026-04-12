import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { masterPrisma } from '../masterDb.js';
import { JWT_SECRET } from '../middleware/authMiddleware.js';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');

// ─── SETUP INICIAL (público, só funciona se não houver empresas) ───────
export const checkSetup = async (_req: Request, res: Response) => {
  try {
    const count = await masterPrisma.company.count();
    res.json({ needsSetup: count === 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const setup = async (req: Request, res: Response) => {
  try {
    const { companyName, companySlug, email, password, userName } = req.body;
    if (!companyName || !companySlug || !email || !password || !userName) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    // Criar diretório para a empresa
    const companyDir = path.join(DATA_DIR, companySlug);
    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }

    const dbPath = path.join(companyDir, 'tenant.db');

    // Criar banco da empresa
    const tenantPrisma = new PrismaClient({
      datasources: { db: { url: `file:${dbPath}` } }
    });
    try { await tenantPrisma.$executeRawUnsafe(`SELECT 1`); } catch {}
    await tenantPrisma.$disconnect();

    // Criar empresa no master
    const company = await masterPrisma.company.create({
      data: { name: companyName, slug: companySlug, dbPath }
    });

    // Aplicar schema ao banco da empresa
    const { execSync } = await import('child_process');
    try {
      execSync(`npx prisma db push --schema=prisma/schema.prisma`, {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
        stdio: 'pipe'
      });
    } catch (err: any) {
      console.error(`[SETUP] Erro ao aplicar schema:`, err.message);
    }

    // Criar admin
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await masterPrisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: userName,
        role: 'ADMIN',
        companyId: company.id
      }
    });

    // Gerar token para login automático
    const token = jwt.sign(
      { userId: user.id, companyId: company.id, email: user.email, role: 'ADMIN' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[SETUP] Empresa "${companyName}" e admin "${email}" criados com sucesso!`);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: 'ADMIN' },
      company: { id: company.id, name: company.name, slug: company.slug }
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Slug ou email já existem.' });
    }
    console.error('[SETUP] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── LOGIN ─────────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    const user = await masterPrisma.user.findUnique({
      where: { email },
      include: { company: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    if (!user.company.active) {
      return res.status(403).json({ error: 'Empresa desativada. Entre em contato com o suporte.' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        companyId: user.companyId,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug
      }
    });
  } catch (error: any) {
    console.error('[AUTH] Erro no login:', error);
    res.status(500).json({ error: 'Erro interno ao fazer login.' });
  }
};

// ─── ME (Dados do usuário logado) ──────────────────────────────────────
export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await masterPrisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { company: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
        ixcUrl: user.company.ixcUrl || '',
        ixcToken: user.company.ixcToken || '',
        openaiKey: user.company.openaiKey ? '••••••' + user.company.openaiKey.slice(-4) : '',
        csvPath: user.company.csvPath || ''
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── ADMIN: Listar Empresas ────────────────────────────────────────────
export const listCompanies = async (req: Request, res: Response) => {
  try {
    const companies = await masterPrisma.company.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json(companies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── ADMIN: Criar Empresa ──────────────────────────────────────────────
export const createCompany = async (req: Request, res: Response) => {
  try {
    const { name, slug, csvPath, ixcUrl, ixcToken, openaiKey } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Nome e slug são obrigatórios.' });
    }

    // Criar diretório para a empresa
    const companyDir = path.join(DATA_DIR, slug);
    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }

    const dbPath = path.join(companyDir, 'tenant.db');

    // Criar o banco da empresa (copiar schema e fazer push)
    // Precisamos inicializar o banco SQLite vazio com a estrutura do tenant
    const tenantPrisma = new PrismaClient({
      datasources: { db: { url: `file:${dbPath}` } }
    });

    // O db push é feito via CLI, mas podemos usar o PrismaClient para forçar a criação
    // Na prática, o banco será criado no primeiro acesso. Vamos forçar com uma query.
    try {
      await tenantPrisma.$executeRawUnsafe(`SELECT 1`);
    } catch {
      // Banco novo, precisa de schema push manual
    }
    await tenantPrisma.$disconnect();

    const company = await masterPrisma.company.create({
      data: {
        name,
        slug,
        dbPath,
        csvPath: csvPath || null,
        ixcUrl: ixcUrl || null,
        ixcToken: ixcToken || null,
        openaiKey: openaiKey || null
      }
    });

    // Executar prisma db push para criar as tabelas no novo banco
    const { execSync } = await import('child_process');
    try {
      execSync(`npx prisma db push --schema=prisma/schema.prisma`, {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
        stdio: 'pipe'
      });
      console.log(`[ADMIN] Schema aplicado ao banco da empresa ${name}`);
    } catch (err: any) {
      console.error(`[ADMIN] Erro ao aplicar schema:`, err.message);
    }

    res.json(company);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Já existe uma empresa com esse slug.' });
    }
    res.status(500).json({ error: error.message });
  }
};

// ─── ADMIN: Atualizar Empresa ──────────────────────────────────────────
export const updateCompany = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, csvPath, ixcUrl, ixcToken, openaiKey, active } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (csvPath !== undefined) data.csvPath = csvPath;
    if (ixcUrl !== undefined) data.ixcUrl = ixcUrl;
    if (ixcToken !== undefined) data.ixcToken = ixcToken;
    if (openaiKey !== undefined) data.openaiKey = openaiKey;
    if (active !== undefined) data.active = active;

    const company = await masterPrisma.company.update({
      where: { id },
      data
    });

    res.json(company);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── ADMIN: Listar Usuários de uma Empresa ─────────────────────────────
export const listUsers = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const users = await masterPrisma.user.findMany({
      where: { companyId },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── ADMIN: Criar Usuário ──────────────────────────────────────────────
export const createUser = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, senha e nome são obrigatórios.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await masterPrisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'USER',
        companyId
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });

    res.json(user);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Email já cadastrado.' });
    }
    res.status(500).json({ error: error.message });
  }
};

// ─── ADMIN: Deletar Usuário ────────────────────────────────────────────
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await masterPrisma.user.delete({ where: { id: userId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
