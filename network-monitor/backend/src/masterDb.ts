import { PrismaClient } from '@prisma/client';

export const masterPrisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${process.cwd()}/prisma/master.db`
    }
  }
});
