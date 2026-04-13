import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DATABASE_URL || `file:${process.cwd()}/prisma/master.db`;

export const masterPrisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});
