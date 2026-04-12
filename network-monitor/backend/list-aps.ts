import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const aps = await p.accessPoint.findMany({ select: { ip: true, description: true }, orderBy: { description: 'asc' } });
aps.forEach(x => console.log(x.ip.padEnd(18), x.description));
await p.$disconnect();
