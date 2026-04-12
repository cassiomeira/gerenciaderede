import { PrismaClient } from '@prisma/client';

// Pool de instâncias Prisma por empresa (chave = dbPath absoluto)
const tenantPool = new Map<string, PrismaClient>();

import path from 'path';

/**
 * Retorna (ou cria) uma instância PrismaClient apontando para o banco da empresa.
 */
export function getTenantPrisma(dbPath: string): PrismaClient {
  // Normalize the path to avoid case/slash differences on Windows creating dupes
  const normalizedKey = path.resolve(dbPath).toLowerCase();
  
  if (tenantPool.has(normalizedKey)) {
    console.log(`[DB] Reusing Prisma pool for: ${normalizedKey}`);
    return tenantPool.get(normalizedKey)!;
  }

  // Format the absolute path to a valid file URI for Prisma (works across OSes)
  // e.g. C:\path\to\db -> file:///C:/path/to/db
  const normalizedPath = path.resolve(dbPath).replace(/\\/g, '/');
  
  // On Windows, absolute paths like C:/... work best as file:C:/... 
  // without the typical /// URI format when using Prisma's default library engine.
  const fileUrl = normalizedPath.startsWith('/') ? `file:${normalizedPath}` : `file:${normalizedPath}`;
  
  const client = new PrismaClient({
    datasources: {
      db: {
        url: fileUrl
      }
    }
  });

  tenantPool.set(normalizedKey, client);
  return client;
}

// Extract the exact file path from DATABASE_URL if it exists
function getDefaultDbPath() {
  const defaultUrl = process.env.DATABASE_URL || '';
  if (defaultUrl.startsWith('file:///')) return defaultUrl.replace('file:///', '');
  if (defaultUrl.startsWith('file://')) return defaultUrl.replace('file://', '');
  if (defaultUrl.startsWith('file:')) return defaultUrl.replace('file:', '');
  return `${process.cwd()}/prisma/dev.db`;
}

// Backward-compatible: exporta a instância padrão usando a DATABASE_URL do .env
// Busca do pool para garantir que nunca abriremos 2 engines para o mesmo arquivo!
export const prisma = getTenantPrisma(getDefaultDbPath());
