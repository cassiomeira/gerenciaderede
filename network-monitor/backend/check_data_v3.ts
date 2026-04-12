
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  try {
    const nodes = await prisma.mapNode.findMany({
      where: { nickname: { not: null } },
      take: 5
    });
    console.log('Nodes with nicknames:', JSON.stringify(nodes, null, 2));
    
    // Check if the property exists even if null
    const firstNode = await prisma.mapNode.findFirst();
    console.log('First node keys:', Object.keys(firstNode || {}));
    
    process.exit(0);
  } catch (err) {
    console.error('Error checking data:', err.message);
    process.exit(1);
  }
}

check();
