import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// CORRECTED topology based on careful analysis of the Dude ITAMARANDIBA photo
// Only ~11 connections from center. Everything else chains through intermediate nodes.

const LINKS: [string, string, string][] = [
  // ====================================================
  // FROM CENTER: 10025-T32 2011 (only ~11 direct links!)
  // ====================================================
  ['10025-T32 2011', '10025_T32_5', 'ethernet'],        // 1. left to T32_5 hub
  ['10025-T32 2011', '10025-T32_8', 'ethernet'],         // 2. lower-left to T32_8  
  ['10025-T32 2011', '10025-T32_2', 'ethernet'],          // 3. right to T32_2 hub
  ['10025-T32 2011', 'SANTA JOANA FIBRA', 'fiber'],       // 4. right fiber
  ['10025-T32 2011', 'SANTA LUZIA FIBRA', 'fiber'],       // 5. lower-left fiber
  ['10025-T32 2011', '10025_T81_1', 'ethernet'],          // 6. down to T81
  ['10025-T32 2011', '10025-T45_26', 'ethernet'],         // 7. down to T45
  ['10025-T32 2011', '10025-T119_1', 'ethernet'],         // 8. upper-right
  ['10025-T32 2011', '10.100.16.82', 'wireless'],         // 9. right wireless
  ['10025-T32 2011', '10.100.16.66', 'ethernet'],         // 10. right ethernet
  ['10025-T32 2011', 'OMNI-AREAO', 'wireless'],           // 11. lower-right wireless

  // ====================================================
  // FROM 10025_T32_5 (left sub-hub) - branches LEFT
  // ====================================================
  ['10025_T32_5', '10.100.16.98', 'ethernet'],
  ['10025_T32_5', '10.100.16.163', 'ethernet'],
  ['10025_T32_5', '10025-T124', 'ethernet'],
  ['10025_T32_5', 'AP-ZOO', 'wireless'],
  ['10.100.16.163', '10.100.16.164', 'ethernet'],
  ['10.100.16.163', 'AP_ARANTES', 'wireless'],

  // ====================================================
  // FROM 10025-T32_8 (lower-left sub-hub)
  // ====================================================
  ['10025-T32_8', '10025-T110_3', 'ethernet'],
  ['10025-T32_8', '10025-T110_4', 'ethernet'],
  ['10025-T32_8', 'SN45', 'ethernet'],
  ['10025-T32_8', '10.1.15.49', 'ethernet'],
  ['10025-T32_8', 'CARBONITA 94/0/4', 'fiber'],
  
  // From SN45 southward
  ['SN45', 'SN_PONTE_S', 'ethernet'],
  ['SN_PONTE_S', '10.100.16.2', 'ethernet'],
  ['10.100.16.2', '10.100.16.203', 'ethernet'],
  ['10.100.16.2', '10.100.16.204', 'ethernet'],
  ['10.100.16.2', '10.100.16.205', 'ethernet'],

  // From SN_PONTE_S to TV A MIRANTE PENHA chain
  ['SN_PONTE_S', 'TV A MIRANTE PENHA', 'ethernet'],
  ['TV A MIRANTE PENHA', 'MIRANTE-PENHA', 'ethernet'],
  ['MIRANTE-PENHA', 'RB-MIRANTE', 'ethernet'],
  ['RB-MIRANTE', 'AP-CACHOEIRA', 'ethernet'],
  ['MIRANTE-PENHA', 'AP-PENHA', 'wireless'],
  ['AP-PENHA', 'RB-PENHA', 'ethernet'],
  ['RB-PENHA', 'PENHA', 'ethernet'],
  ['PENHA', 'AP-PEDREIRAS', 'wireless'],
  ['AP-PEDREIRAS', 'ST-PEDREIRA', 'wireless'],
  ['ST-PEDREIRA', '10.100.16.168', 'wireless'],

  // ====================================================
  // FROM 10025-T119_1 (upper-right)
  // ====================================================
  ['10025-T119_1', '10025-T119', 'ethernet'],
  ['10025-T119', '10025-T123_3', 'ethernet'],
  ['10025-T123_3', 'ST-SANTOS', 'ethernet'],
  ['ST-SANTOS', '10.100.16.70', 'wireless'],
  ['10025-T123_3', 'SWITCH', 'wireless'],
  ['SWITCH', '10025-T122_3', 'wireless'],
  ['10025-T122_3', '10025-T122_1', 'ethernet'],
  ['10025-T122_4', '10025-T122_1', 'ethernet'],

  // ====================================================
  // FROM 10025-T32_2 → T123 chain (middle-right)
  // ====================================================
  ['10025-T32_2', '10025-T123', 'ethernet'],
  ['10025-T123', '10025-T123_1', 'ethernet'],
  ['10025-T123_1', '10025-T123_2', 'ethernet'],
  ['10025-T123_2', 'ESCOLA-CD', 'ethernet'],
  ['10025-T123_2', '10.100.16.76', 'ethernet'],
  ['10.100.16.76', '10.100.16.77', 'ethernet'],
  ['10.100.16.77', '10.100.16.78', 'ethernet'],
  ['10.100.16.79', '10.100.16.80', 'ethernet'],
  ['10025-T123_4', 'AP-JOAQUIM', 'wireless'],
  ['10025-T123_3', 'ST-DE', 'ethernet'],

  // From 10.100.16.66 / 10.100.16.81
  ['10.100.16.66', '10.100.16.81', 'ethernet'],

  // ====================================================
  // FROM SANTA JOANA FIBRA → T35 area / T80 area
  // ====================================================
  ['SANTA JOANA FIBRA', '10025-T35_3', 'ethernet'],
  ['10025-T35_3', '10025-T35', 'ethernet'],
  ['10025-T35', '10025-T35_5', 'ethernet'],
  ['10025-T35', '10025-T35_1', 'ethernet'],

  // T80 chain from SANTA JOANA or T35 area
  ['SANTA JOANA FIBRA', '10025-T80', 'ethernet'],
  ['10025-T80', '10025-T80_3', 'ethernet'],
  ['10025-T80_3', '10.200.206.71', 'ethernet'],
  ['10.200.206.71', 'AP-BRAUNAS', 'wireless'],
  ['10025-T80', '10025-T80_2', 'ethernet'],
  ['10025-T80_2', '10025-T80_1', 'ethernet'],
  ['10025-T80_1', '10025-T83 SOLAR VENENO', 'wireless'],
  ['10025-T80_1', '10025-T83_1', 'wireless'],
  ['10025-T80_1', '10.200.206.82', 'wireless'],
  ['10.200.206.82', '10025-T83_2', 'ethernet'],
  ['10025-T80_1', '10.200.206.83', 'wireless'],
  ['10025-T80_1', '10025-T85', 'wireless'],
  ['10025-T80_1', '10.200.206.76', 'wireless'],
  ['10025-T80_1', '10025-T84_1', 'wireless'],
  ['10025-T84_1', '10025-T84_4', 'ethernet'],

  // ====================================================
  // FROM 10025_T81_1 (bottom center hub)
  // ====================================================
  ['10025_T81_1', '10.1.15.50', 'ethernet'],
  ['10.1.15.50', 'CHACARA', 'ethernet'],
  ['CHACARA', 'CRUZ-GRANDE', 'ethernet'],
  ['CRUZ-GRANDE', '10025-T125_2', 'ethernet'],
  ['10025-T125_2', '10025-T89', 'ethernet'],
  ['10025_T81_1', '10025_T81_2 SB', 'ethernet'],
  ['10025_T81_2 SB', '10025_T81_3 ESC', 'ethernet'],
  ['10025_T81_1', 'AAMAR', 'wireless'],
  ['10025_T81_1', '10025-T81_4 SIAE', 'fiber'],
  ['10025_T81_1', '10025_T74_17 SIAE', 'fiber'],

  // SIAE references
  ['10025_T74_17 SIAE', 'SERRA NEGRA', 'fiber'],

  // ====================================================
  // FROM 10025-T89 (far right bottom)
  // ====================================================
  ['10025-T89', 'RECEB TABATINGA', 'wireless'],
  ['RECEB TABATINGA', 'AP TABATINGA', 'wireless'],
  ['AP TABATINGA', 'AP-PATRICIA', 'wireless'],
  ['AP-PATRICIA', 'ST-PATRICIA', 'wireless'],

  // ====================================================
  // FROM SANTA LUZIA FIBRA → T40 area
  // ====================================================
  ['SANTA LUZIA FIBRA', '10025-T40_10', 'ethernet'],
  ['10025-T40_10', '10025-T40_11', 'ethernet'],
  ['SANTA LUZIA FIBRA', '10025-T40_4', 'ethernet'],
  ['10025-T40_4', '10025-T40_5_RP_TOM', 'ethernet'],
];

function normalize(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
}

async function main() {
  const map = await prisma.networkMap.findFirst({ where: { name: { contains: 'ITAMARANDIBA' } } });
  if (!map) { console.error('Map not found'); return; }
  console.log(`🗺️ Map: ${map.name} (id=${map.id})`);
  
  const nodes = await prisma.mapNode.findMany({ where: { mapId: map.id } });
  
  // Build lookup with fuzzy matching
  const findNodeId = (label: string): string | null => {
    let n = nodes.find(nd => nd.label === label);
    if (n) return n.id;
    // swap - and _
    n = nodes.find(nd => nd.label === label.replace(/-/g, '_'));
    if (n) return n.id;
    n = nodes.find(nd => nd.label === label.replace(/_/g, '-'));
    if (n) return n.id;
    // normalized
    const norm = normalize(label);
    n = nodes.find(nd => normalize(nd.label || '') === norm);
    if (n) return n.id;
    return null;
  };
  
  // DELETE all existing links
  const deleted = await prisma.mapLink.deleteMany({ where: { mapId: map.id } });
  console.log(`🗑️ Deleted ${deleted.count} old links`);
  
  let created = 0;
  let skipped = 0;
  
  for (const [src, tgt, type] of LINKS) {
    const srcId = findNodeId(src);
    const tgtId = findNodeId(tgt);
    if (!srcId) { console.log(`  ⚠️ Not found: "${src}"`); skipped++; continue; }
    if (!tgtId) { console.log(`  ⚠️ Not found: "${tgt}"`); skipped++; continue; }
    
    await prisma.mapLink.create({
      data: { mapId: map.id, sourceNodeId: srcId, targetNodeId: tgtId, linkType: type }
    });
    created++;
  }

  // Count links from center
  const centerId = findNodeId('10025-T32 2011');
  if (centerId) {
    const centerLinks = await prisma.mapLink.count({
      where: { mapId: map.id, OR: [{ sourceNodeId: centerId }, { targetNodeId: centerId }] }
    });
    console.log(`\n📊 Links do centro (10025-T32 2011): ${centerLinks}`);
  }

  console.log(`\n✅ Criados: ${created} links`);
  console.log(`⚠️ Pulados: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(console.error);
