/**
 * Seed Maps – cria os 9 mapas de rede com nós e links conforme as imagens do Dude.
 * Execução: npx tsx seed-maps.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── helpers ───────────────────────────────────────────────────────────────
async function createMap(name: string) {
  // delete if exists
  const existing = await prisma.networkMap.findFirst({ where: { name } });
  if (existing) {
    await prisma.networkMap.delete({ where: { id: existing.id } });
  }
  return prisma.networkMap.create({ data: { name } });
}

async function addNode(mapId: string, label: string, ip: string | null, x: number, y: number) {
  return prisma.mapNode.create({ data: { mapId, label, apIp: ip, x, y } });
}

async function addLink(mapId: string, srcId: string, tgtId: string, type: 'wireless' | 'ethernet' | 'fiber', label?: string) {
  return prisma.mapLink.create({ data: { mapId, sourceNodeId: srcId, targetNodeId: tgtId, linkType: type, label: label ?? null } });
}

// ─── FLORES ─────────────────────────────────────────────────────────────────
async function seedFlores() {
  const m = await createMap('FLORES');
  const id = m.id;

  const nc = await addNode(id, 'NETCAR058', null, 100, 200);
  const rb = await addNode(id, 'RB-FLORES', null, 260, 200);
  const t6 = await addNode(id, '10025_T6', '10.200.15.78', 430, 200);
  const t12 = await addNode(id, '10025_T12_9', null, 600, 200);
  const carb = await addNode(id, 'CARBONITA', null, 800, 200);
  const w78 = await addNode(id, '10.200.15.78', '10.200.15.78', 260, 320);
  const w84 = await addNode(id, '10.200.15.84', '10.200.15.84', 430, 320);
  const w89 = await addNode(id, '10.200.15.89', '10.200.15.89', 600, 320);
  const rbigr = await addNode(id, 'RB_IGREJA', null, 100, 450);
  const salg = await addNode(id, 'AP-SALGADINHO', null, 430, 450);
  const w83 = await addNode(id, '10.200.15.83', '10.200.15.83', 600, 450);
  const w85 = await addNode(id, '10.200.15.85', '10.200.15.85', 760, 450);
  const w82 = await addNode(id, '10.200.15.82', '10.200.15.82', 100, 570);
  const w81 = await addNode(id, '10.200.15.81', '10.200.15.81', 430, 570);
  const zurvarz = await addNode(id, 'AP-ZNRURAL_VARZEA', null, 600, 570);
  const w86 = await addNode(id, '10.200.15.86', '10.200.15.86', 760, 570);
  const w87 = await addNode(id, '10.200.15.87', '10.200.15.87', 760, 690);
  const escsal = await addNode(id, 'AP_ESC_SAL', null, 260, 690);
  const rb750 = await addNode(id, 'RB-750', null, 430, 690);
  const w92 = await addNode(id, '10.200.15.92', '10.200.15.92', 600, 690);
  const w72 = await addNode(id, '10.200.15.72', '10.200.15.72', 760, 810);
  const ext = await addNode(id, '177.184.176.42', null, 260, 810);
  const apleo = await addNode(id, 'AP_LEO', null, 760, 930);

  // links
  await addLink(id, nc.id, rb.id, 'ethernet');
  await addLink(id, rb.id, t6.id, 'ethernet');
  await addLink(id, t6.id, t12.id, 'wireless');
  await addLink(id, t12.id, carb.id, 'wireless');
  await addLink(id, rb.id, w78.id, 'ethernet');
  await addLink(id, t6.id, w84.id, 'ethernet');
  await addLink(id, w84.id, w89.id, 'wireless');
  await addLink(id, rbigr.id, w82.id, 'ethernet');
  await addLink(id, salg.id, w83.id, 'ethernet');
  await addLink(id, w83.id, w85.id, 'ethernet');
  await addLink(id, salg.id, w81.id, 'ethernet');
  await addLink(id, w81.id, w82.id, 'ethernet');
  await addLink(id, zurvarz.id, w86.id, 'ethernet');
  await addLink(id, w86.id, w87.id, 'ethernet');
  await addLink(id, escsal.id, rb750.id, 'ethernet');
  await addLink(id, rb750.id, w92.id, 'ethernet');
  await addLink(id, w92.id, w72.id, 'wireless');
  await addLink(id, escsal.id, ext.id, 'ethernet');
  await addLink(id, w72.id, apleo.id, 'ethernet');

  console.log('✅ FLORES criado');
}

// ─── ITAMARANDIBA ───────────────────────────────────────────────────────────
async function seedItamarandiba() {
  const m = await createMap('ITAMARANDIBA');
  const id = m.id;

  const core = await addNode(id, '10025-T32 2011', null, 700, 400);
  const mirpenha = await addNode(id, 'MIRANTE-PENHA', null, 500, 280);
  const rbmir = await addNode(id, 'RB-MIRANTE', null, 380, 280);
  const rbpenha = await addNode(id, 'RB-PENHA', null, 260, 280);
  const penha = await addNode(id, 'PENHA', null, 380, 160);
  const apcach = await addNode(id, 'AP-CACHOEIRA', null, 260, 160);
  const appenha = await addNode(id, 'AP-PENHA', null, 380, 380);
  const snpontes = await addNode(id, 'SN_PONTE_S', null, 500, 380);
  const sn45 = await addNode(id, 'SN45', null, 580, 480);
  const t119 = await addNode(id, '10025-T119', null, 820, 160);
  const t1191 = await addNode(id, '10025-T119_1', null, 700, 160);
  const stsan = await addNode(id, 'ST-SANTOS', null, 820, 80);
  const w70 = await addNode(id, '10.100.16.70', '10.100.16.70', 960, 80);
  const sw = await addNode(id, 'SWITCH', null, 960, 160);
  const t1232 = await addNode(id, '10025-T123_2', null, 960, 200);
  const apjoaq = await addNode(id, 'AP-JOAQUIM', null, 1140, 240);
  const w82 = await addNode(id, '10.100.16.82', '10.100.16.82', 840, 400);
  const t110 = await addNode(id, '10025-T110_4', null, 620, 520);
  const t81 = await addNode(id, '10025-T81_1', null, 820, 520);
  const t35 = await addNode(id, '10025-T35', null, 960, 520);
  const t45 = await addNode(id, '10025-T45_26', null, 820, 580);
  const omni = await addNode(id, 'OMNI-AREAO', null, 960, 600);
  const sacaf = await addNode(id, 'SANTA LUZIA FIBRA', null, 620, 580);
  const sjfibre = await addNode(id, 'SANTA JOANA FIBRA', null, 840, 460);
  const tacara = await addNode(id, 'CHACARA', null, 820, 660);
  const cruzgr = await addNode(id, 'CRUZ-GRANDE', null, 960, 660);
  const bacbone = await addNode(id, 'BACBONE 40/0/12', null, 840, 760);
  const serraneg = await addNode(id, 'SERRA NEGRA', null, 700, 760);
  const carb = await addNode(id, 'CARBONITA 94/0/4', null, 540, 480);

  await addLink(id, core.id, mirpenha.id, 'fiber');
  await addLink(id, mirpenha.id, rbmir.id, 'ethernet');
  await addLink(id, rbmir.id, rbpenha.id, 'ethernet');
  await addLink(id, rbpenha.id, penha.id, 'ethernet');
  await addLink(id, rbpenha.id, apcach.id, 'ethernet');
  await addLink(id, mirpenha.id, appenha.id, 'wireless');
  await addLink(id, mirpenha.id, snpontes.id, 'ethernet');
  await addLink(id, core.id, t1191.id, 'ethernet');
  await addLink(id, t1191.id, t119.id, 'ethernet');
  await addLink(id, t119.id, stsan.id, 'ethernet');
  await addLink(id, t119.id, w70.id, 'ethernet');
  await addLink(id, t119.id, sw.id, 'ethernet');
  await addLink(id, sw.id, t1232.id, 'ethernet');
  await addLink(id, t1232.id, apjoaq.id, 'wireless');
  await addLink(id, core.id, w82.id, 'fiber');
  await addLink(id, core.id, t110.id, 'fiber');
  await addLink(id, core.id, t81.id, 'fiber');
  await addLink(id, t81.id, t35.id, 'fiber');
  await addLink(id, t81.id, t45.id, 'ethernet');
  await addLink(id, t35.id, omni.id, 'ethernet');
  await addLink(id, t81.id, sjfibre.id, 'ethernet');
  await addLink(id, t81.id, sacaf.id, 'ethernet');
  await addLink(id, core.id, tacara.id, 'fiber');
  await addLink(id, tacara.id, cruzgr.id, 'ethernet');
  await addLink(id, core.id, bacbone.id, 'fiber');
  await addLink(id, core.id, serraneg.id, 'fiber');
  await addLink(id, core.id, carb.id, 'fiber');
  await addLink(id, snpontes.id, sn45.id, 'ethernet');

  console.log('✅ ITAMARANDIBA criado');
}

// ─── MENDONÇA ───────────────────────────────────────────────────────────────
async function seedMendonca() {
  const m = await createMap('MENDONÇA');
  const id = m.id;

  const carb = await addNode(id, 'CARBONITA', null, 600, 100);
  const torre = await addNode(id, 'TORRE DA MADEIREIRA CAPELINHA', null, 280, 180);
  const torre5 = await addNode(id, 'TORRE 5 CAPELINHA', null, 580, 320);
  const w133 = await addNode(id, '10.100.15.133', '10.100.15.133', 280, 310);
  const w131 = await addNode(id, '10.100.15.131', '10.100.15.131', 280, 430);
  const conc = await addNode(id, 'CONCENTRADOR MENDONÇA', null, 280, 560);
  const w52 = await addNode(id, '10.100.15.52', '10.100.15.52', 520, 560);
  const sn = await addNode(id, 'SN', null, 280, 680);

  await addLink(id, torre.id, w133.id, 'ethernet');
  await addLink(id, w133.id, w131.id, 'wireless');
  await addLink(id, w131.id, conc.id, 'ethernet');
  await addLink(id, conc.id, w52.id, 'fiber');
  await addLink(id, conc.id, sn.id, 'ethernet');
  await addLink(id, torre5.id, w133.id, 'ethernet');

  console.log('✅ MENDONÇA criado');
}

// ─── PLANALTO/LAGOA ──────────────────────────────────────────────────────────
async function seedPlanalto() {
  const m = await createMap('PLANALTO/LAGOA');
  const id = m.id;

  const core = await addNode(id, 'CORE-RCZNET', null, 900, 340);
  const t83 = await addNode(id, '10025-T83', null, 360, 380);
  const t57 = await addNode(id, '10025-T57', null, 640, 580);
  const t56 = await addNode(id, '10025-T56', null, 720, 660);
  const t73 = await addNode(id, '10025-T73', null, 860, 660);
  const t732 = await addNode(id, '10025-T73_2', null, 960, 660);
  const bacbone = await addNode(id, 'BACBONE 40/0/12', null, 1060, 660);
  const sxt = await addNode(id, 'SXT AP', null, 1060, 340);
  const sxtst = await addNode(id, 'SXT ST', null, 1160, 340);
  const t23 = await addNode(id, '10025-T23_1', null, 240, 280);
  const t25 = await addNode(id, '10025-T25', null, 560, 220);
  const t50 = await addNode(id, '10025-T50', null, 360, 280);
  const t24 = await addNode(id, '10025-T24', null, 440, 160);
  const macau = await addNode(id, 'MACAU-RENATOXT', null, 320, 380);
  const netcarbdi = await addNode(id, 'NETCARBDI', null, 200, 380);
  const snbdi = await addNode(id, 'SN-BDI', null, 400, 440);
  const fibmac = await addNode(id, 'FIBRA-MACAUBAS', null, 500, 480);
  const cord = await addNode(id, 'CORDEIRO', null, 480, 580);
  const t66 = await addNode(id, '10025-T66', null, 540, 720);
  const t66_1 = await addNode(id, '10025-T66_1', null, 360, 720);
  const aphozana = await addNode(id, 'AP_HOZANA', null, 240, 720);
  const carb = await addNode(id, 'CARBONITA 94/0/4', null, 640, 440);
  const campolimpo = await addNode(id, 'CAMPO LIMPO 84/0/3', null, 1140, 440);
  const serraneg = await addNode(id, 'SERRA NEGRA 43/0/1', null, 1060, 540);

  await addLink(id, t25.id, core.id, 'fiber');
  await addLink(id, core.id, sxt.id, 'ethernet');
  await addLink(id, sxt.id, sxtst.id, 'wireless');
  await addLink(id, core.id, t732.id, 'ethernet');
  await addLink(id, t732.id, bacbone.id, 'wireless');
  await addLink(id, t732.id, serraneg.id, 'wireless');
  await addLink(id, t732.id, campolimpo.id, 'wireless');
  await addLink(id, t73.id, t732.id, 'ethernet');
  await addLink(id, t56.id, t73.id, 'ethernet');
  await addLink(id, t57.id, t56.id, 'ethernet');
  await addLink(id, t83.id, snbdi.id, 'ethernet');
  await addLink(id, snbdi.id, fibmac.id, 'ethernet');
  await addLink(id, fibmac.id, cord.id, 'ethernet');
  await addLink(id, cord.id, t57.id, 'ethernet');
  await addLink(id, t83.id, netcarbdi.id, 'wireless');
  await addLink(id, t83.id, macau.id, 'ethernet');
  await addLink(id, t50.id, t83.id, 'ethernet');
  await addLink(id, t23.id, t50.id, 'ethernet');
  await addLink(id, t24.id, t25.id, 'wireless');
  await addLink(id, t66_1.id, t66.id, 'ethernet');
  await addLink(id, aphozana.id, t66_1.id, 'ethernet');
  await addLink(id, carb.id, t83.id, 'fiber');

  console.log('✅ PLANALTO/LAGOA criado');
}

// ─── SERRA NEGRA ─────────────────────────────────────────────────────────────
async function seedSerraNegra() {
  const m = await createMap('SERRA NEGRA');
  const id = m.id;

  const core = await addNode(id, '10025-T74_12(CORE)', null, 640, 400);
  const ita = await addNode(id, 'ITAMARANDIBA 104/0/17', null, 820, 160);
  const soc = await addNode(id, 'SOCORRO PELA FIBRA DA BKP', null, 1020, 160);
  const t7413 = await addNode(id, '10025-T74_13 SIAE', null, 820, 240);
  const t77siae = await addNode(id, '10025-77-SIAE', null, 1020, 280);
  const t742 = await addNode(id, '10025-T74_2', null, 820, 400);
  const t63 = await addNode(id, '10025-T63', null, 960, 400);
  const t631 = await addNode(id, '10025-T63_1', null, 1060, 400);
  const t632 = await addNode(id, '10025-T63_2', null, 1160, 400);
  const t29 = await addNode(id, '10025-T29', null, 1060, 320);
  const t291 = await addNode(id, '10025-T29_1', null, 1060, 480);
  const t296 = await addNode(id, '10025-T29_6', null, 1160, 480);
  const t292 = await addNode(id, '10025-T29_2', null, 1060, 550);
  const t294 = await addNode(id, '10025-T29_4', null, 1060, 620);
  const t295 = await addNode(id, '10025-T29_5', null, 1060, 690);
  const t744cam = await addNode(id, '10025-T74_CAM', null, 640, 480);
  const apourofino = await addNode(id, 'AP_OURO_FINO', null, 320, 400);
  const stourofino = await addNode(id, 'ST_OURO_FINO', null, 440, 400);
  const w185 = await addNode(id, '10.100.206.185', '10.100.206.185', 540, 400);
  const serradivino = await addNode(id, 'SERRA A DIVINO', null, 820, 560);
  const t77 = await addNode(id, '10025-T77', null, 820, 640);
  const t771 = await addNode(id, '10025-T77_1', null, 820, 580);
  const t772 = await addNode(id, '10025-T77_2', null, 820, 700);
  const ctn = await addNode(id, 'CTN3178XX', null, 960, 540);
  const carb = await addNode(id, 'CARBONITA 94/0/4', null, 640, 600);
  const bacb = await addNode(id, 'BACBONE 40/0/12', null, 700, 660);
  const t74_15 = await addNode(id, '10025-T74_15', null, 400, 280);
  const esc = await addNode(id, 'ESC SAO GIL', null, 400, 140);
  const apesc = await addNode(id, 'AP-ESCOLA-SAO-GIL', null, 480, 200);
  const divback = await addNode(id, 'DIVINO-BACKUP', null, 640, 200);
  const t749 = await addNode(id, '10025-T74_9', null, 700, 280);
  const valdete = await addNode(id, 'VALDETE', null, 820, 280);
  const t74nic = await addNode(id, '10025-T74_12 NIC', null, 560, 560);
  const t79nic = await addNode(id, '10025-T79 NIC', null, 560, 620);
  const t741 = await addNode(id, '10025-T742', null, 520, 400);

  await addLink(id, core.id, ita.id, 'fiber');
  await addLink(id, ita.id, soc.id, 'fiber');
  await addLink(id, ita.id, t7413.id, 'wireless');
  await addLink(id, t7413.id, t77siae.id, 'wireless');
  await addLink(id, core.id, t742.id, 'ethernet');
  await addLink(id, t742.id, t63.id, 'wireless');
  await addLink(id, t63.id, t631.id, 'ethernet');
  await addLink(id, t631.id, t632.id, 'ethernet');
  await addLink(id, t631.id, t29.id, 'ethernet');
  await addLink(id, t631.id, t291.id, 'ethernet');
  await addLink(id, t291.id, t296.id, 'ethernet');
  await addLink(id, t291.id, t292.id, 'ethernet');
  await addLink(id, t292.id, t294.id, 'ethernet');
  await addLink(id, t294.id, t295.id, 'ethernet');
  await addLink(id, core.id, apourofino.id, 'fiber');
  await addLink(id, apourofino.id, stourofino.id, 'ethernet');
  await addLink(id, stourofino.id, w185.id, 'wireless');
  await addLink(id, w185.id, t741.id, 'ethernet');
  await addLink(id, t741.id, core.id, 'ethernet');
  await addLink(id, core.id, serradivino.id, 'fiber');
  await addLink(id, serradivino.id, t771.id, 'ethernet');
  await addLink(id, t771.id, t77.id, 'ethernet');
  await addLink(id, t77.id, t772.id, 'ethernet');
  await addLink(id, serradivino.id, ctn.id, 'wireless');
  await addLink(id, core.id, carb.id, 'fiber');
  await addLink(id, core.id, bacb.id, 'fiber');
  await addLink(id, core.id, t74nic.id, 'ethernet');
  await addLink(id, core.id, t79nic.id, 'ethernet');
  await addLink(id, t74_15.id, core.id, 'ethernet');
  await addLink(id, esc.id, apesc.id, 'ethernet');
  await addLink(id, apesc.id, divback.id, 'wireless');
  await addLink(id, divback.id, t749.id, 'wireless');
  await addLink(id, t749.id, valdete.id, 'wireless');
  await addLink(id, core.id, t744cam.id, 'ethernet');

  console.log('✅ SERRA NEGRA criado');
}

// ─── BACKBONE ────────────────────────────────────────────────────────────────
async function seedBackbone() {
  const m = await createMap('BACKBONE');
  const id = m.id;

  const sne = await addNode(id, '10.1.15.36(NE)', '10.1.15.36', 540, 140);
  const nespm = await addNode(id, '45.167.44.1(NE-SPN)', null, 720, 140);
  const t45 = await addNode(id, '10.255.255.4(T45)', null, 920, 140);
  const w130 = await addNode(id, '10.200.15.130(T45)', '10.200.15.130', 1060, 140);
  const w131t22 = await addNode(id, '10.200.15.131(T22)', '10.200.15.131', 1200, 140);
  const w1549 = await addNode(id, '10.1.15.49', '10.1.15.49', 720, 240);
  const t12 = await addNode(id, '10.100.15.12(T12)', '10.100.15.12', 720, 180);
  const t127 = await addNode(id, '10.100.15.13(T127)', '10.100.15.13', 860, 200);
  const t22 = await addNode(id, '10.100.15.10(T22)', '10.100.15.10', 1000, 200);
  const t48t22 = await addNode(id, '10.1.15.48(T22)', '10.1.15.48', 1100, 200);
  const swita = await addNode(id, '10.59.59.2(SW-ITA)', null, 560, 260);
  const swcb = await addNode(id, '10.200.206.186(SW-CB)', null, 660, 300);
  const t13 = await addNode(id, '10.1.5.8(T13)', null, 820, 300);
  const t13a = await addNode(id, '10.1.5.37(T13)', null, 660, 380);
  const t81bb = await addNode(id, '10.100.15.37(T81)', '10.100.15.37', 560, 360);
  const t74 = await addNode(id, '10.100.15.36(T74)', '10.100.15.36', 560, 440);
  const t35 = await addNode(id, '10.100.15.43(T35)', '10.100.15.43', 720, 460);
  const t73 = await addNode(id, '10.100.15.44(T73)', '10.100.15.44', 900, 460);
  const t392 = await addNode(id, '10.1.15.39(T74)', '10.1.15.39', 480, 460);
  const t1356 = await addNode(id, '10.1.15.56(T77)', '10.1.15.56', 480, 620);
  const siae = await addNode(id, '10025_T74_13_SIAE', null, 480, 360);
  const w77siae = await addNode(id, '10025-77-SIAE', null, 1040, 360);
  const planlago = await addNode(id, 'PLA/OLHD/LAGOA 100/0/0', null, 1000, 480);
  const serraneg = await addNode(id, 'SERRA NEGRA 43/0/1', null, 480, 520);
  const campo = await addNode(id, 'CAMPO LIMPO 84/0/3', null, 1140, 480);
  const capel = await addNode(id, 'CAPELINHA 14/0/8', null, 960, 260);
  const carb = await addNode(id, 'CARBONITA 94/0/4', null, 760, 420);
  const ita = await addNode(id, 'ITAMARANDIBA 104/0/17', null, 480, 180);

  await addLink(id, sne.id, nespm.id, 'fiber');
  await addLink(id, nespm.id, t45.id, 'fiber');
  await addLink(id, t45.id, w130.id, 'ethernet');
  await addLink(id, w130.id, w131t22.id, 'wireless');
  await addLink(id, sne.id, w1549.id, 'fiber');
  await addLink(id, w1549.id, t12.id, 'ethernet');
  await addLink(id, t12.id, t127.id, 'wireless');
  await addLink(id, t127.id, t22.id, 'ethernet');
  await addLink(id, t22.id, t48t22.id, 'ethernet');
  await addLink(id, swita.id, swcb.id, 'fiber');
  await addLink(id, swcb.id, t13.id, 'ethernet');
  await addLink(id, swcb.id, t13a.id, 'ethernet');
  await addLink(id, swita.id, t81bb.id, 'fiber');
  await addLink(id, t81bb.id, t74.id, 'ethernet');
  await addLink(id, t74.id, t35.id, 'ethernet');
  await addLink(id, t35.id, t73.id, 'wireless');
  await addLink(id, t74.id, t392.id, 'ethernet');
  await addLink(id, t392.id, siae.id, 'wireless');
  await addLink(id, t392.id, serraneg.id, 'ethernet');
  await addLink(id, serraneg.id, t1356.id, 'ethernet');
  await addLink(id, t73.id, planlago.id, 'ethernet');
  await addLink(id, t73.id, campo.id, 'ethernet');
  await addLink(id, t73.id, w77siae.id, 'wireless');
  await addLink(id, t127.id, capel.id, 'wireless');
  await addLink(id, t13.id, carb.id, 'fiber');
  await addLink(id, swita.id, ita.id, 'fiber');
  await addLink(id, sne.id, ita.id, 'fiber');

  console.log('✅ BACKBONE criado');
}

// ─── CAMPO LIMPO ──────────────────────────────────────────────────────────────
async function seedCampoLimpo() {
  const m = await createMap('CAMPO LIMPO');
  const id = m.id;

  const t44 = await addNode(id, '10025-T44', null, 720, 480);
  const t13loja = await addNode(id, '10025-T13 - LOJA', null, 600, 480);
  const t117 = await addNode(id, '10025-T117', null, 460, 480);
  const t92 = await addNode(id, '10025-T92', null, 400, 500);
  const t921 = await addNode(id, '10025-T92_1', null, 340, 480);
  const t922 = await addNode(id, '10025_T92_2 PONTE', null, 340, 560);
  const t11 = await addNode(id, '10025-T11', null, 540, 220);
  const t192 = await addNode(id, '10025-T19_2', null, 640, 200);
  const t19 = await addNode(id, '10025-T19', null, 740, 200);
  const t196 = await addNode(id, '10025-T19_6', null, 840, 200);
  const t17 = await addNode(id, '10025-T17', null, 740, 280);
  const t17_2 = await addNode(id, '10025-T17_2', null, 800, 340);
  const t44_1 = await addNode(id, '10025-T44_1', null, 820, 440);
  const t48 = await addNode(id, '10025-T48', null, 900, 380);
  const t17_4 = await addNode(id, '10025-T17_4', null, 720, 360);
  const t17_3 = await addNode(id, '10025-T17_3', null, 640, 320);
  const switch2 = await addNode(id, 'SWITCH', null, 820, 280);
  const t17_10 = await addNode(id, '10025-T17_10', null, 900, 280);
  const t44_4 = await addNode(id, '10025-T44_4', null, 900, 480);
  const vicenta = await addNode(id, 'VICENTA', null, 1000, 440);
  const w158 = await addNode(id, '10.201.11.158', '10.201.11.158', 1100, 440);
  const t47 = await addNode(id, '10025-T47', null, 980, 360);
  const apglaucia = await addNode(id, 'AP-GLAUCIA', null, 1060, 360);
  const bacbone = await addNode(id, 'BACBONE 40/0/12', null, 400, 380);
  const planlago = await addNode(id, 'PLA/OLHD/LAGOA 100/0/0', null, 400, 320);
  const carb = await addNode(id, 'CARBONITA 94/0/4', null, 400, 440);
  const t16 = await addNode(id, '10025-T16', null, 780, 580);
  const t162 = await addNode(id, '10025-T16_2', null, 700, 580);
  const fibabadia = await addNode(id, 'FIBRA-ABADIA', null, 900, 580);
  const t164 = await addNode(id, '10025-T16_4', null, 780, 660);
  const repvan = await addNode(id, 'REPETIDORA VANIA', null, 720, 720);
  const rotint = await addNode(id, 'ROTEADOR INTELBRAS', null, 860, 720);
  const apsandra = await addNode(id, 'AP-SANDRA', null, 980, 720);
  const t44_2 = await addNode(id, '10025-T44_2', null, 820, 540);
  const t44_5 = await addNode(id, '10025-T44_5', null, 700, 540);
  const bercas = await addNode(id, 'BERENICE ROCA', null, 540, 560);
  const t443sxt = await addNode(id, '10025-T44_3 - SXT NILZA', null, 640, 560);
  const w1116 = await addNode(id, '10.201.11.6', '10.201.11.6', 1000, 580);
  const t16_5 = await addNode(id, '10025-T16_5', null, 780, 580);
  const rb750cap = await addNode(id, 'RB-750-CAPAO', null, 600, 300);
  const netc058cp = await addNode(id, 'NETCAR058-CP', null, 500, 300);
  const leme = await addNode(id, 'LEME cpu:6%', null, 700, 120);

  await addLink(id, t44.id, t44_1.id, 'ethernet');
  await addLink(id, t44.id, t17_2.id, 'ethernet');
  await addLink(id, t44.id, t13loja.id, 'ethernet');
  await addLink(id, t13loja.id, t117.id, 'wireless');
  await addLink(id, t117.id, t92.id, 'ethernet');
  await addLink(id, t92.id, t921.id, 'wireless');
  await addLink(id, t921.id, t922.id, 'ethernet');
  await addLink(id, t11.id, t192.id, 'wireless');
  await addLink(id, t192.id, t19.id, 'ethernet');
  await addLink(id, t19.id, t196.id, 'ethernet');
  await addLink(id, t19.id, t17.id, 'ethernet');
  await addLink(id, t17.id, switch2.id, 'ethernet');
  await addLink(id, switch2.id, t17_10.id, 'ethernet');
  await addLink(id, switch2.id, t17_2.id, 'ethernet');
  await addLink(id, t17_2.id, t48.id, 'ethernet');
  await addLink(id, t48.id, t47.id, 'wireless');
  await addLink(id, t47.id, apglaucia.id, 'ethernet');
  await addLink(id, t44.id, t44_4.id, 'ethernet');
  await addLink(id, t44_4.id, vicenta.id, 'wireless');
  await addLink(id, vicenta.id, w158.id, 'ethernet');
  await addLink(id, netc058cp.id, rb750cap.id, 'ethernet');
  await addLink(id, rb750cap.id, t17_3.id, 'ethernet');
  await addLink(id, t17_3.id, t17_4.id, 'wireless');
  await addLink(id, t11.id, leme.id, 'ethernet');
  await addLink(id, bacbone.id, t44.id, 'fiber');
  await addLink(id, planlago.id, t44.id, 'fiber');
  await addLink(id, carb.id, t44.id, 'fiber');
  await addLink(id, t44.id, t16.id, 'ethernet');
  await addLink(id, t16.id, t162.id, 'ethernet');
  await addLink(id, t16.id, t164.id, 'ethernet');
  await addLink(id, t16.id, fibabadia.id, 'fiber');
  await addLink(id, t164.id, repvan.id, 'wireless');
  await addLink(id, repvan.id, rotint.id, 'ethernet');
  await addLink(id, rotint.id, apsandra.id, 'wireless');
  await addLink(id, t44.id, t44_2.id, 'ethernet');
  await addLink(id, t44.id, t44_5.id, 'ethernet');
  await addLink(id, t44_5.id, bercas.id, 'ethernet');
  await addLink(id, bercas.id, t443sxt.id, 'ethernet');
  await addLink(id, t162.id, t443sxt.id, 'ethernet');
  await addLink(id, t47.id, w1116.id, 'wireless');
  await addLink(id, t16.id, t16_5.id, 'ethernet');

  console.log('✅ CAMPO LIMPO criado');
}

// ─── CAPELINHA ───────────────────────────────────────────────────────────────
async function seedCapelinha() {
  const m = await createMap('CAPELINHA');
  const id = m.id;

  const bacb = await addNode(id, 'BACBONE 40/0/12', null, 380, 160);
  const carb = await addNode(id, 'CARBONITA 94/0/4', null, 780, 160);
  const t45 = await addNode(id, '10025-T45', null, 380, 280);
  const t127 = await addNode(id, '10025_T127', null, 780, 280);
  const w134 = await addNode(id, '10.200.15.134', '10.200.15.134', 380, 380);
  const w1504 = await addNode(id, '10.150.0.4', '10.150.0.4', 520, 280);
  const w1500 = await addNode(id, '10.150.0.10', '10.150.0.10', 640, 280);
  const t4521 = await addNode(id, '10025-T45_21', null, 380, 480);
  const t2214 = await addNode(id, '10025-T22_4', null, 360, 560);
  const t22 = await addNode(id, '10025T22', null, 500, 560);
  const w52cap = await addNode(id, '10.100.15.52', '10.100.15.52', 640, 560);
  const t4512 = await addNode(id, '10025-T45_12', null, 780, 380);
  const w1554 = await addNode(id, '10.1.15.54', '10.1.15.54', 580, 660);
  const apzeq = await addNode(id, 'AP-ZEQUINHA', null, 700, 660);
  const w17292 = await addNode(id, '172.16.92.51', null, 840, 660);
  const w1533 = await addNode(id, '10.1.15.33', '10.1.15.33', 580, 760);

  await addLink(id, bacb.id, t45.id, 'fiber');
  await addLink(id, carb.id, t127.id, 'fiber');
  await addLink(id, t45.id, w134.id, 'ethernet');
  await addLink(id, t45.id, w1504.id, 'ethernet');
  await addLink(id, w1504.id, w1500.id, 'wireless');
  await addLink(id, w1500.id, t127.id, 'ethernet');
  await addLink(id, t127.id, t4512.id, 'ethernet');
  await addLink(id, w134.id, t4521.id, 'ethernet');
  await addLink(id, t4521.id, t2214.id, 'wireless');
  await addLink(id, t2214.id, t22.id, 'ethernet');
  await addLink(id, t22.id, w52cap.id, 'fiber');
  await addLink(id, w1554.id, apzeq.id, 'ethernet');
  await addLink(id, apzeq.id, w17292.id, 'wireless');
  await addLink(id, w1554.id, w1533.id, 'ethernet');

  console.log('✅ CAPELINHA criado');
}

// ─── APERAN ──────────────────────────────────────────────────────────────────
async function seedAperan() {
  const m = await createMap('APERAN');
  const id = m.id;

  const carb = await addNode(id, 'CARBONITA 94/0/4', null, 300, 180);
  const conc = await addNode(id, 'APR00-CONCENTRADOR-APERAM', null, 380, 360);
  const apr10 = await addNode(id, 'AP APR10', null, 240, 440);
  const t45 = await addNode(id, '10025_T45', null, 380, 440);
  const apr05ap = await addNode(id, 'APR00-APR05 AP', null, 460, 440);
  const apr05st = await addNode(id, 'APR00-APR05 ST', null, 560, 440);
  const ntct05 = await addNode(id, 'NTC_APR_T05', null, 740, 440);
  const ntct06 = await addNode(id, 'NTC_APR_T06', null, 760, 200);
  const ntct08 = await addNode(id, 'NTC_APR_T08', null, 900, 220);
  const ntct09 = await addNode(id, 'NTC_APR_T09', null, 1000, 220);
  const ntcapr07 = await addNode(id, 'NTC_APR_07', null, 660, 160);
  const aprt05_72ap = await addNode(id, 'APR-T05-T072 AP', null, 760, 340);
  const aprt05_72st = await addNode(id, 'APR-T05-T072 ST', null, 760, 460);
  const apap06 = await addNode(id, 'AP AP06', null, 860, 360);
  const cam6 = await addNode(id, 'CAMERA 6', null, 840, 140);
  const cam5 = await addNode(id, 'CAMERA 5', null, 640, 320);
  const w1519 = await addNode(id, '10.150.0.19', '10.150.0.19', 860, 280);
  const aprt0509ap = await addNode(id, 'APR-T05-T09 AP', null, 1000, 440);
  const aprt0509st = await addNode(id, 'APR-T05-T09 ST', null, 1000, 280);
  const aprapr11ap = await addNode(id, 'APR-APR11 AP>10', null, 760, 540);
  const aprapr11st = await addNode(id, 'APR-APR11 ST', null, 760, 640);
  const cam10 = await addNode(id, 'CAMERA 10', null, 760, 700);
  const apr0100st = await addNode(id, 'APR-0100 ST', null, 460, 540);
  const w1522 = await addNode(id, '10.150.0.22', '10.150.0.22', 460, 640);
  const cam1 = await addNode(id, 'CAMERA 1', null, 560, 640);
  const cam3 = await addNode(id, 'CAMERA 3', null, 360, 640);
  const apr0103ap = await addNode(id, 'APR01-03 AP', null, 380, 720);
  const apr0103st = await addNode(id, 'APR01-03 ST', null, 480, 720);

  await addLink(id, conc.id, apr10.id, 'ethernet');
  await addLink(id, conc.id, t45.id, 'ethernet');
  await addLink(id, t45.id, apr05ap.id, 'wireless');
  await addLink(id, apr05ap.id, apr05st.id, 'wireless');
  await addLink(id, apr05st.id, ntct05.id, 'wireless');
  await addLink(id, ntct05.id, ntct06.id, 'ethernet');
  await addLink(id, ntct06.id, ntcapr07.id, 'ethernet');
  await addLink(id, ntct06.id, cam6.id, 'wireless');
  await addLink(id, ntct06.id, ntct08.id, 'ethernet');
  await addLink(id, ntct08.id, ntct09.id, 'ethernet');
  await addLink(id, ntct05.id, aprt05_72ap.id, 'ethernet');
  await addLink(id, aprt05_72ap.id, aprt05_72st.id, 'wireless');
  await addLink(id, aprt05_72ap.id, cam5.id, 'wireless');
  await addLink(id, ntct05.id, apap06.id, 'ethernet');
  await addLink(id, apap06.id, w1519.id, 'wireless');
  await addLink(id, ntct05.id, aprt0509ap.id, 'fiber');
  await addLink(id, aprt0509ap.id, aprt0509st.id, 'wireless');
  await addLink(id, ntct05.id, aprapr11ap.id, 'ethernet');
  await addLink(id, aprapr11ap.id, aprapr11st.id, 'wireless');
  await addLink(id, aprapr11st.id, cam10.id, 'ethernet');
  await addLink(id, conc.id, apr0100st.id, 'wireless');
  await addLink(id, apr0100st.id, w1522.id, 'ethernet');
  await addLink(id, w1522.id, cam1.id, 'ethernet');
  await addLink(id, w1522.id, cam3.id, 'ethernet');
  await addLink(id, w1522.id, apr0103ap.id, 'ethernet');
  await addLink(id, apr0103ap.id, apr0103st.id, 'wireless');

  console.log('✅ APERAN criado');
}

// ─── Run all ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🗺️  Criando mapas de rede...\n');
  await seedFlores();
  await seedItamarandiba();
  await seedMendonca();
  await seedPlanalto();
  await seedSerraNegra();
  await seedBackbone();
  await seedCampoLimpo();
  await seedCapelinha();
  await seedAperan();
  await prisma.$disconnect();
  console.log('\n✅ Todos os mapas criados com sucesso!');
}

main().catch(e => { console.error(e); process.exit(1); });
