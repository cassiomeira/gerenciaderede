import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { masterPrisma } from '../masterDb.js';
import { getTenantPrisma } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'netmonitor-multi-tenant-secret-2026';

export interface TokenPayload {
  userId: string;
  companyId: string;
  email: string;
  role: string;
}

// Estender Request do Express para incluir dados do tenant
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      company?: any;
      tenantPrisma?: any;
    }
  }
}

/**
 * Middleware que valida o JWT e injeta:
 * - req.user (dados do token)
 * - req.company (dados da empresa do banco central)
 * - req.tenantPrisma (instância Prisma apontando para o banco da empresa)
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const internalSecret = req.headers['x-internal-secret'];
  const companyIdHeader = req.headers['x-company-id']; // Novo cabeçalho para bypass

  // Bypass para o serviço de screenshot interno
  if (internalSecret === 'NETMONITOR_INTERNAL_BYPASS_2026') {
    console.log(`[AUTH BYPASS] Robô detectado. ID Sugerido: ${companyIdHeader || 'NENHUM'}`);

    try {
      let company;
      if (companyIdHeader && typeof companyIdHeader === 'string' && companyIdHeader !== 'default') {
        company = await masterPrisma.company.findUnique({ where: { id: companyIdHeader } });
      } else {
        company = await masterPrisma.company.findFirst();
      }

      if (!company) {
        console.error('[AUTH BYPASS] Nenhuma empresa encontrada no Master DB ou ID inválido!');
        res.status(500).json({ error: 'Nenhuma empresa configurada no sistema ou ID de empresa inválido para bypass.' });
        return;
      }

      console.log(`[AUTH BYPASS] Sucesso! Usando Empresa: ${company.name} | DB: ${company.dbPath}`);
      req.company = company;
      req.user = {
        userId: 'system-bot',
        companyId: company.id,
        email: 'system@internal',
        role: 'ADMIN'
      };
      req.tenantPrisma = getTenantPrisma(company.dbPath);
      next();
      return;
    } catch (err) {
      console.error('[AUTH BYPASS] Erro fatal no bypass:', err);
      res.status(500).json({ error: 'Erro no bypass interno.' });
    }
    return;
  }

  // Verificação de JWT padrão (apenas se não for bypass)
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.user = decoded;

    // Buscar empresa e injetar Prisma do tenant
    masterPrisma.company.findUnique({
      where: { id: decoded.companyId }
    }).then(company => {
      if (!company || !company.active) {
        res.status(403).json({ error: 'Empresa não encontrada ou desativada.' });
        return;
      }

      req.company = company;
      req.tenantPrisma = getTenantPrisma(company.dbPath);
      next();
    }).catch(err => {
      console.error('[AUTH] Erro ao buscar empresa:', err);
      res.status(500).json({ error: 'Erro interno de autenticação.' });
    });
  } catch (err) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

/**
 * Middleware opcional para rotas que precisam de acesso admin
 */
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return;
  }
  next();
}

export { JWT_SECRET };
