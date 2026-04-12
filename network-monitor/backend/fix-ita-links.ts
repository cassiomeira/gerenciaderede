import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Fix: the actual label in DB might use different dash/underscore
const MISSING_LINKS: [string, string, string][] = [
  ['10025-T32 2011', '10025-T81_1', 'ethernet'],      // was 10025_T81_1
  ['10025-T81_1', '10.1.15.50', 'ethernet'],
  ['10025-T81_1', '10025_T81_2 SB', 'ethernet'],
  ['10025-T81_1', 'AAMAR', 'wireless'],
  ['10025-T81_1', '10025-T81_4 SIAE', 'fiber'],
  ['10025-T81_1', '10025_T74_17 SIAE', 'fiber'],
];

function normalize(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
}

async function main() {
  const map = await prisma.networkMap.findFirst({ where: { name: { contains: 'ITAMARANDIBA' } } });
  if (!map) return;
  
  const nodes = await prisma.mapNode.findMany({ where: { mapId: map.id } });
  
  // Build a fuzzy lookup
  const findNode = (label: string) => {
    // Exact match
    let n = nodes.find(nd => nd.label === label);
    if (n) return n.id;
    // Normalized match
    const norm = normalize(label);
    n = nodes.find(nd => normalize(nd.label || '') === norm);
    if (n) return n.id;
    // Try swapping - and _
    const alt = label.replace(/-/g, '_');
    n = nodes.find(nd => nd.label === alt);
    if (n) return n.id;
    const alt2 = label.replace(/_/g, '-');
    n = nodes.find(nd => nd.label === alt2);
    if (n) return n.id;
    return null;
  };

  let created = 0;
  for (const [src, tgt, type] of MISSING_LINKS) {
    const srcId = findNode(src);
    const tgtId = findNode(tgt);
    if (!srcId) { console.log(`❌ Not found: ${src}`); continue; }
    if (!tgtId) { console.log(`❌ Not found: ${tgt}`); continue; }
    
    await prisma.mapLink.create({
      data: { mapId: map.id, sourceNodeId: srcId, targetNodeId: tgtId, linkType: type }
    });
    console.log(`✅ ${src} → ${tgt}`);
    created++;
  }
  
  console.log(`\nAdded ${created} fix links`);
  const total = await prisma.mapLink.count({ where: { mapId: map.id } });
  console.log(`Total links in ITAMARANDIBA: ${total}`);
  await prisma.$disconnect();
}
main();
