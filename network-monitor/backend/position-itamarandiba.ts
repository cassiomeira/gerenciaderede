import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Positions with MUCH wider spacing to match the clean Dude layout
// Node boxes are ~150px wide x 45px tall, so we need 200+ px between nodes
const POSITIONS: Record<string, [number, number]> = {
  // ========== CENTER HUB ==========
  '10025-T32 2011':          [1000, 600],

  // ========== UPPER-LEFT: PENHA/MIRANTE CHAIN ==========
  // This is a vertical chain going up-left from center
  '10.100.16.168':           [100,  50],
  'ST-PEDREIRA':             [100,  130],
  'AP-PEDREIRAS':            [300,  130],
  'PENHA':                   [300,  220],
  'RB-PENHA':                [100,  220],
  'AP-PENHA':                [300,  320],
  'RB-MIRANTE':              [100,  420],
  'MIRANTE-PENHA':           [300,  420],
  'AP-CACHOEIRA':            [100,  320],
  'TV A MIRANTE PENHA':      [500,  460],

  // ========== LEFT COLUMN: 10.100.16.20x ==========
  '10.100.16.203':           [100,  520],
  '10.100.16.204':           [100,  600],
  '10.100.16.205':           [100,  680],

  // ========== LEFT-CENTER AREA ==========
  'SN_PONTE_S':              [350,  560],
  '10.100.16.2':             [500,  560],
  '10025_T32_5':             [600,  500],
  '10.100.16.98':            [750,  500],
  '10.100.16.163':           [600,  420],
  '10.100.16.164':           [400,  100],

  // ========== LEFT-LOW: SN45 / T110 / T32_8 ==========
  'SN45':                    [500,  700],
  '10025-T110_4':            [650,  700],
  '10.1.15.49':              [800,  700],
  '10025-T110_3':            [800,  780],
  '10025-T32_8':             [600,  800],
  'CARBONITA 94/0/4':        [350,  880],

  // ========== UPPER CENTER: AP ARANTES / ZOO / T124 ==========
  'AP_ARANTES':              [700,  80],
  'AP-ZOO':                  [900,  80],
  '10025-T124':              [900,  180],
  '10025-T119_1':            [1050, 100],
  '10025-T119':              [1050, 200],

  // ========== UPPER RIGHT: ST-SANTOS / T123 TOP ==========
  'ST-SANTOS':               [1200, 50],
  '10.100.16.70':            [1400, 50],
  '10025-T123_3':            [1200, 150],
  'SWITCH':                  [1400, 150],
  '10025-T122_3':            [1600, 150],
  '10025-T122_4':            [1800, 50],
  '10025-T122_1':            [1800, 150],

  // ========== RIGHT: T123 MIDDLE / 10.100.16.7x ==========
  '10025-T123_2':            [1400, 280],
  '10.100.16.76':            [1450, 370],
  '10.100.16.77':            [1650, 370],
  '10.100.16.78':            [1850, 370],
  '10.100.16.79':            [1450, 460],
  '10.100.16.80':            [1650, 460],
  'AP-JOAQUIM':              [1850, 460],
  '10025-T123_4':            [1850, 280],
  'ST-DE':                   [2000, 280],
  'ESCOLA-CD':               [2000, 380],

  // ========== T32_2 → T123 HORIZONTAL CHAIN ==========
  '10025-T32_2':             [1100, 500],
  '10025-T123':              [1300, 500],
  '10025-T123_1':            [1500, 500],

  // ========== RIGHT: T80 CHAIN ==========
  '10025-T80_3':             [1350, 600],
  '10.200.206.71':           [1550, 600],
  'AP-BRAUNAS':              [1750, 600],
  '10025-T80':               [1300, 700],
  '10025-T80_2':             [1500, 700],
  '10025-T80_1':             [1700, 700],

  // ========== FAR RIGHT: T83/T85 COLUMN ==========
  '10025-T83 SOLAR VENENO':  [1900, 640],
  '10025-T83_1':             [1900, 720],
  '10.200.206.82':           [1700, 800],
  '10025-T83_2':             [1900, 800],
  '10.200.206.83':           [1700, 880],
  '10025-T85':               [1900, 880],
  '10.200.206.76':           [1700, 960],

  // ========== T84 ==========
  '10025-T84_1':             [1900, 960],
  '10025-T84_4':             [1900, 1040],

  // ========== CENTER-RIGHT: 16.66/81/82 ==========
  '10.100.16.66':            [1100, 600],
  '10.100.16.81':            [1050, 700],
  '10.100.16.82':            [1200, 700],

  // ========== SANTA JOANA FIBRA ==========
  'SANTA JOANA FIBRA':       [1200, 800],

  // ========== T35 BRANCH ==========
  '10025-T35_3':             [1100, 880],
  '10025-T35':               [1300, 880],
  '10025-T35_5':             [1500, 880],
  '10025-T35_1':             [1300, 960],

  // ========== OMNI AREAO ==========
  'OMNI-AREAO':              [1100, 960],

  // ========== BOTTOM CENTER: T81 CHAIN ==========
  '10025_T81_1':             [800,  900],
  '10025-T45_26':            [850,  1000],

  // Chain: 10.1.15.50 → CHACARA → CRUZ-GRANDE → T125 → T89
  '10.1.15.50':              [900,  1080],
  'CHACARA':                 [1100, 1080],
  'CRUZ-GRANDE':             [1300, 1080],
  '10025-T125_2':            [1500, 1080],
  '10025-T89':               [1700, 1080],
  'AAMAR':                   [1350, 1160],

  // T81_2 / T81_3
  '10025_T81_2 SB':          [700,  1080],
  '10025_T81_3 ESC':         [700,  1160],

  // ========== SIAE / REFERENCES ==========
  '10025-T81_4 SIAE':        [600,  1100],
  '10025_T74_17 SIAE':       [600,  1200],
  'SERRA NEGRA':             [450,  1280],
  'BACKBONE 40/0/12':        [850,  1200],

  // ========== BOTTOM-LEFT: SANTA LUZIA / T40 ==========
  'SANTA LUZIA FIBRA':       [450,  800],
  '10025-T40_10':            [350,  900],
  '10025-T40_11':            [150,  900],
  '10025-T40_4':             [150,  1000],
  '10025-T40_5_RP_TOM':      [100,  1100],

  // ========== FAR RIGHT BOTTOM: TABATINGA/PATRICIA ==========
  'RECEB TABATINGA':         [1700, 1160],
  'AP TABATINGA':            [1700, 1250],
  'AP-PATRICIA':             [1900, 1250],
  'ST-PATRICIA':             [2100, 1250],
};

function normalize(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
}

async function main() {
  const map = await prisma.networkMap.findFirst({ where: { name: { contains: 'ITAMARANDIBA' } } });
  if (!map) { console.error('Map not found'); return; }

  const nodes = await prisma.mapNode.findMany({ where: { mapId: map.id } });
  console.log(`🗺️ ITAMARANDIBA: ${nodes.length} nós`);

  let updated = 0;
  const positioned = new Set<string>();

  for (const node of nodes) {
    const label = node.label || '';
    let pos = POSITIONS[label];
    if (!pos) {
      const alt1 = label.replace(/-/g, '_');
      const alt2 = label.replace(/_/g, '-');
      pos = POSITIONS[alt1] || POSITIONS[alt2];
    }
    if (!pos) {
      const normLabel = normalize(label);
      for (const [key, value] of Object.entries(POSITIONS)) {
        if (normalize(key) === normLabel) { pos = value; break; }
      }
    }
    if (pos) {
      await prisma.mapNode.update({ where: { id: node.id }, data: { x: pos[0], y: pos[1] } });
      positioned.add(label);
      updated++;
    }
  }

  // Unpositioned nodes go in a clean grid below everything
  const unpositioned = nodes.filter(n => !positioned.has(n.label || ''));
  if (unpositioned.length > 0) {
    console.log(`\n📐 ${unpositioned.length} nós extras:`);
    for (let i = 0; i < unpositioned.length; i++) {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x = 100 + col * 200;
      const y = 1400 + row * 80;
      await prisma.mapNode.update({ where: { id: unpositioned[i].id }, data: { x, y } });
      console.log(`  📍 ${unpositioned[i].label}: (${x}, ${y})`);
    }
  }

  console.log(`\n✅ Posicionados: ${updated} | Extras: ${unpositioned.length}`);
  await prisma.$disconnect();
}

main().catch(console.error);
