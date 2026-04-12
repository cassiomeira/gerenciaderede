/**
 * Reseed Campo Limpo – recria o mapa "CAMPO LIMPO" fiel às imagens do Dude.
 * Execução: npx tsx reseed-campo-limpo.ts
 * 
 * IMPORTANTE: Coordenadas calculadas com NODE_W=160, NODE_H=52 em mente.
 * Cada "célula" do grid é ~200px de largura e ~80px de altura.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── helpers ───────────────────────────────────────────────────────────────
async function addNode(mapId: string, label: string, ip: string | null, x: number, y: number) {
  return prisma.mapNode.create({ data: { mapId, label, apIp: ip, x, y } });
}

async function addLink(mapId: string, srcId: string, tgtId: string, type: 'wireless' | 'ethernet' | 'fiber', label?: string) {
  return prisma.mapLink.create({ data: { mapId, sourceNodeId: srcId, targetNodeId: tgtId, linkType: type, label: label ?? null } });
}

async function main() {
  console.log('🗺️  Recriando mapa CAMPO LIMPO...\n');

  // 1) Buscar mapa existente
  let map = await prisma.networkMap.findFirst({ where: { name: 'CAMPO LIMPO' } });
  if (!map) {
    console.log('Criando novo mapa CAMPO LIMPO...');
    map = await prisma.networkMap.create({ data: { name: 'CAMPO LIMPO' } });
  }

  // 2) Deletar links e nós existentes
  await prisma.mapLink.deleteMany({ where: { mapId: map.id } });
  await prisma.mapNode.deleteMany({ where: { mapId: map.id } });
  console.log('🗑️  Links e nós antigos deletados.');

  // 3) Recriar
  await recreateMap(map.id);
}

async function recreateMap(id: string) {
  // Escala: as imagens do Dude são ~1024x640.
  // No nosso app os nós são 160x52px.
  // Precisamos espaçar bem: ~200px horizontal, ~90px vertical entre nós.
  //
  // Layout fiel às imagens:
  // - Coluna (col) = posição horizontal, cada col ~200px
  // - Linha (row) = posição vertical, cada row ~85px
  // Usaremos coordenadas absolutas já calculadas.

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 0-1: TOPO ESQUERDO - Cluster T42/T11/T20
  // ═══════════════════════════════════════════════════════════════════════════
  const t42_2 = await addNode(id, '10025-T42_2', '10.1.15.202', 450, 10);
  const t42_1 = await addNode(id, '10025-T42_1', '10.1.15.201', 200, 30);
  const t11_1 = await addNode(id, '10025-T11_1', '10.1.15.199', 450, 80);
  const t42 = await addNode(id, '10025-T42', '10.1.15.200', 10, 100);
  const t20_1 = await addNode(id, '10025-T20_1', '10.1.15.204', 10, 200);
  const t11_2 = await addNode(id, '10025-T11_2', '10.1.15.203', 520, 170);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 0-1: TOPO CENTRO - SUITCH, T11, T19, LEME
  // ═══════════════════════════════════════════════════════════════════════════
  const suitch = await addNode(id, 'SUITCH', null, 700, 40);
  const t11 = await addNode(id, '10025-T11', '10.1.15.198', 740, 120);
  const t19_2 = await addNode(id, '10025-T19_2', '10.1.15.194', 940, 100);
  const t19 = await addNode(id, '10025-T19', '10.1.15.197', 1140, 100);
  const t19_6 = await addNode(id, '10025-T19_6', '0.0.0.0', 1350, 100);
  const leme = await addNode(id, 'LEME', '177.184.185.66', 1040, 10);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 2: T23, NETCAR058-CP, RB-750-CAPAO, 172.16.x
  // ═══════════════════════════════════════════════════════════════════════════
  const t23_1 = await addNode(id, '10025-T23_1', '10.201.11.60', 200, 280);
  const t23 = await addNode(id, '10025-T23', '10.201.11.35', 420, 280);
  const netcar058cp = await addNode(id, 'NETCAR058-CP', null, 420, 370);
  const rb750capao = await addNode(id, 'RB-750-CAPAO', null, 660, 370);
  const _172_16_133_2 = await addNode(id, '172.16.133.2', null, 900, 370);
  const _172_16_133_3 = await addNode(id, '172.16.133.3', null, 1100, 370);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 1-2: T19_7, T19_10 MC, T17_5
  // ═══════════════════════════════════════════════════════════════════════════
  const t19_7 = await addNode(id, '10025-T19_7', '10.201.11.61', 850, 210);
  const t19_10mc = await addNode(id, '10025-T19_10 MC', '177.184.190.234', 1050, 210);
  const t17_5 = await addNode(id, '10025-T17_5', '10.1.15.195', 1250, 210);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 3: AP RIOS2, T39, T17_3, SWITCH central, T17_1, T1132_1
  // ═══════════════════════════════════════════════════════════════════════════
  const ap_rios2 = await addNode(id, 'AP RIOS2', '10.201.11.228', 550, 470);
  const t39 = await addNode(id, '10025-T39', '10.201.11.227', 800, 470);
  const t17_3 = await addNode(id, '10025-T17_3', '10.201.11.226', 1030, 470);
  const switch_central = await addNode(id, 'SWITCH', null, 1300, 470);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 4: CLUSTER T17 (SN3, T17_14, T17_12, T17_4, T17_6, T17_2)
  // ═══════════════════════════════════════════════════════════════════════════
  const sn3 = await addNode(id, 'SN3', '10.201.11.238', 720, 570);
  const t17_14 = await addNode(id, '10025-T17_14', '10.201.11.235', 520, 620);
  const t17_12 = await addNode(id, '10025-T17_12', '10.201.11.231', 850, 600);
  const t17_4 = await addNode(id, '10025-T17_4', '10.201.11.229', 1080, 560);
  const t17_6 = await addNode(id, '10025-T17_6', '10.201.11.230', 1160, 630);
  const t17_2 = await addNode(id, '10025-T17_2', '10.201.11.140', 1360, 560);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 3: DIREITA - T17_1, T17_7, T1132_1, T18_1, T18_2, T18
  // ═══════════════════════════════════════════════════════════════════════════
  const t17_1 = await addNode(id, '10025-T17_1', '10.201.11.74', 1520, 430);
  const t17_7 = await addNode(id, '10025-T17_7', null, 1520, 350);
  const t1132_1 = await addNode(id, '10025-T1132_1', '10.201.11.233', 1620, 470);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 0-2: DIREITA - T18 chain vertical
  // ═══════════════════════════════════════════════════════════════════════════
  const t18_1 = await addNode(id, '10025-T18_1', '10.201.11.76', 1700, 10);
  const t18_2 = await addNode(id, '10025-T18_2', '10.201.11.70', 1700, 100);
  const t18 = await addNode(id, '10025-T18', '10.201.11.75', 1700, 200);
  const t21 = await addNode(id, '10025-T21', '10.201.11.69', 1850, 260);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 0-2: EXTREMO DIREITO - T18_3, T22_1, T22, T73, T1132_4, T77
  // ═══════════════════════════════════════════════════════════════════════════
  const t18_3 = await addNode(id, '10025-T18_3 PARADO DEVIDO LOOP', '10.201.11.66', 2100, 10);
  const t22_1 = await addNode(id, '10025-T22_1', '10.201.11.68', 2150, 150);
  const t22 = await addNode(id, '10025-T22', '10.201.11.67', 2400, 80);
  const t73 = await addNode(id, '10025-T73', '10.201.11.73', 2150, 280);
  const t1132_4 = await addNode(id, '10025-T1132_4', '10.201.11.71', 2400, 240);
  const _0_201_11_71 = await addNode(id, '0.201.11.71', null, 1950, 380);
  const t77 = await addNode(id, '10025-T77', '10.201.11.77', 2150, 400);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 5-6: CENTRO - T48_1, T48, T44_1, T44, T44_4
  // ═══════════════════════════════════════════════════════════════════════════
  const t48_1 = await addNode(id, '10025-T48_1', '10.201.11.139', 1500, 660);
  const t155 = await addNode(id, '10025-T48_1', '10.201.11.155', 1680, 640);
  const t48 = await addNode(id, '10025-T48', '10.201.11.148', 1700, 730);
  const t44_1 = await addNode(id, '10025-T44_1', '10.201.11.138', 1500, 760);
  const t44 = await addNode(id, '10025-T44', '177.184.190.230', 1300, 810);
  const t44_4 = await addNode(id, '10025-T44_4', '10.201.11.146', 1780, 820);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 7: T44_2, T16_2
  // ═══════════════════════════════════════════════════════════════════════════
  const t44_2 = await addNode(id, '10025-T44_2', '10.201.11.194', 1500, 860);
  const t16_2 = await addNode(id, '10025-T16_2', '10.201.11.195', 1500, 950);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 6-7: CENTRO-ESQUERDA - T13 LOJA, T117, T92, clouds
  // ═══════════════════════════════════════════════════════════════════════════
  const t13_loja = await addNode(id, '10025-T13 - LOJA', '177.184.176.1', 980, 810);
  const t44_5 = await addNode(id, '10025-T44_5', '10.201.11.147', 1080, 870);
  const t117_1 = await addNode(id, '10025-T117_1', null, 560, 810);
  const t117 = await addNode(id, '10025-T117', '10.201.11.100', 720, 820);
  const t92_1 = await addNode(id, '10025-T92_1', '10.201.11.101', 340, 780);
  const t92 = await addNode(id, '10025-T92', null, 340, 870);
  const t92_2_ponte = await addNode(id, '10025_T92_2 PONTE', '10.201.11.102', 340, 1010);

  const planalto = await addNode(id, 'PLA/OLHD/LAGOA 108/0/0', null, 50, 480);
  const bacbone = await addNode(id, 'BACBONE 40/0/14', null, 80, 590);
  const carbonita = await addNode(id, 'CARBONITA 94/0/4', null, 80, 700);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 8: BERENICE, CASA ROCA, T44_3 SXT, T60
  // ═══════════════════════════════════════════════════════════════════════════
  const t44_3_sxt = await addNode(id, '10025-T44_3 - SXT NILZA', '10.201.11.5', 1080, 950);
  const berenice = await addNode(id, 'BERENICE ROCA', '10.201.11.4', 780, 960);
  const casa_roca = await addNode(id, 'CASA ROCA CASSIO', '10.201.11.3', 680, 1050);
  const _11_6 = await addNode(id, '10.201.11.6', '10.201.11.6', 880, 1050);
  const t60 = await addNode(id, '10025-T60 AP PC', '10.201.11.2', 800, 1140);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 8-9: T16, T16_5, FIBRA-ABADIA
  // ═══════════════════════════════════════════════════════════════════════════
  const t16_5 = await addNode(id, '10025-T16_5', '10.201.11.218', 1200, 1020);
  const t16 = await addNode(id, '10025-T16', '10.201.11.196', 1400, 1030);
  const fibra_abadia = await addNode(id, 'FIBRA-ABADIA', '10.201.11.204', 1640, 1030);
  const t16_4 = await addNode(id, '10025-T16_4', '10.201.11.222', 1250, 1120);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 10: REPETIDORA VANIA, ROTEADOR INTELBRAS, AP-SANDRA
  // ═══════════════════════════════════════════════════════════════════════════
  const repetidora = await addNode(id, 'REPETIDORA VANIA', '10.201.11.205', 1250, 1230);
  const roteador = await addNode(id, 'ROTEADOR INTELBRAS', '10.0.0.10', 1520, 1230);
  const ap_sandra = await addNode(id, 'AP-SANDRA', '10.201.11.206', 1790, 1230);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 5-6: DIREITA - T47, AP-GLAUCIA, T45, T151, VICENTA
  // ═══════════════════════════════════════════════════════════════════════════
  const t47 = await addNode(id, '10025-T47', '10.201.11.152', 2000, 640);
  const ap_glaucia = await addNode(id, 'AP-GLAUCIA', '10.201.11.153', 2250, 620);
  const t45 = await addNode(id, '10025-T45', '10.201.11.150', 2100, 750);
  const t151 = await addNode(id, '10025-T151', '10.201.11.151', 2320, 750);
  const t148_r = await addNode(id, '10025-T48', '10.201.11.148', 2100, 680);
  const t149 = await addNode(id, '10025-T149', '10.201.11.149', 2320, 680);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 6-7: DIREITA - VICENTA, AP-MARTINHO, ST-BOZO, 11.11, 11.12
  // ═══════════════════════════════════════════════════════════════════════════
  const vicenta = await addNode(id, 'VICENTA', '10.201.11.157', 2100, 830);
  const _11_158 = await addNode(id, '10.201.11.158', '10.201.11.158', 2340, 830);
  const _11_156 = await addNode(id, '10.201.11.156', '10.201.11.156', 2100, 920);
  const ap_martinho = await addNode(id, 'AP-MARTINHO', null, 2340, 920);
  const st_bozo = await addNode(id, 'ST-BOZO', '10.201.11.10', 1850, 940);
  const _11_11 = await addNode(id, '10.201.11.11', '10.201.11.11', 2050, 1010);
  const _11_12 = await addNode(id, '10.201.11.12', '10.201.11.12', 2280, 1010);

  // ═══════════════════════════════════════════════════════════════════════════
  //  LINKS — Conexões baseadas nas imagens do Dude
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('🔗 Criando links...');

  // -- Cluster T42/T11/T20 --
  await addLink(id, t42_1.id, t42_2.id, 'ethernet');
  await addLink(id, t42.id, t42_1.id, 'ethernet');
  await addLink(id, t42.id, t11_1.id, 'wireless');
  await addLink(id, t11_1.id, t42_2.id, 'ethernet');
  await addLink(id, t42.id, t20_1.id, 'ethernet');
  await addLink(id, t11_1.id, t11.id, 'wireless');
  await addLink(id, t11_2.id, t11.id, 'ethernet');

  // -- T11 → SUITCH → T19 --
  await addLink(id, t11.id, suitch.id, 'ethernet');
  await addLink(id, t11.id, t19_2.id, 'wireless');
  await addLink(id, t19_2.id, t19.id, 'ethernet');
  await addLink(id, t19.id, t19_6.id, 'ethernet');
  await addLink(id, t11.id, leme.id, 'ethernet');

  // -- T19_7, T19_10 MC, T17_5 --
  await addLink(id, t19_7.id, t11.id, 'wireless');
  await addLink(id, t19_7.id, t19_10mc.id, 'wireless');
  await addLink(id, t19_10mc.id, t17_5.id, 'wireless');

  // -- T23_1 ↔ T23 --
  await addLink(id, t23_1.id, t23.id, 'ethernet');

  // -- NETCAR058 → RB-750 → 172.16 --
  await addLink(id, netcar058cp.id, rb750capao.id, 'ethernet');
  await addLink(id, rb750capao.id, _172_16_133_2.id, 'wireless');
  await addLink(id, _172_16_133_2.id, _172_16_133_3.id, 'wireless');

  // -- AP RIOS2 → T39 → T17_3 → SWITCH --
  await addLink(id, ap_rios2.id, t39.id, 'wireless');
  await addLink(id, t39.id, t17_3.id, 'wireless');
  await addLink(id, t17_3.id, switch_central.id, 'ethernet');

  // -- SN3 ↔ T17_14, T17_12 --
  await addLink(id, sn3.id, t17_14.id, 'ethernet');
  await addLink(id, sn3.id, t17_12.id, 'wireless');

  // -- T17_4 → SWITCH, T17_6 → T17_2 --
  await addLink(id, t17_4.id, switch_central.id, 'wireless');
  await addLink(id, t17_4.id, t17_6.id, 'ethernet');
  await addLink(id, t17_6.id, t17_2.id, 'ethernet');

  // -- SWITCH → T17_2 → T17_1 → T17_7 --
  await addLink(id, switch_central.id, t17_2.id, 'ethernet');
  await addLink(id, t17_2.id, t17_1.id, 'ethernet');
  await addLink(id, t17_1.id, t17_7.id, 'ethernet');

  // -- T17_2 → T1132_1 --
  await addLink(id, t17_2.id, t1132_1.id, 'wireless');

  // -- T18 chain --
  await addLink(id, t18_1.id, t18_2.id, 'ethernet');
  await addLink(id, t18_2.id, t18.id, 'ethernet');
  await addLink(id, t18.id, t21.id, 'ethernet');

  // -- T21 → T18_3, T22_1, T22 --
  await addLink(id, t21.id, t18_3.id, 'wireless');
  await addLink(id, t18_3.id, t22_1.id, 'ethernet');
  await addLink(id, t22_1.id, t22.id, 'ethernet');

  // -- T21 → T73, T1132_4 --
  await addLink(id, t21.id, t73.id, 'ethernet');
  await addLink(id, t73.id, t1132_4.id, 'ethernet');

  // -- T21 → 0.201.11.71 → T77 --
  await addLink(id, t21.id, _0_201_11_71.id, 'wireless');
  await addLink(id, _0_201_11_71.id, t77.id, 'ethernet');

  // -- T17_5 → T18 --
  await addLink(id, t17_5.id, t18.id, 'wireless');

  // -- T17_2 → T48_1 → T48 --
  await addLink(id, t17_2.id, t48_1.id, 'wireless');
  await addLink(id, t48_1.id, t48.id, 'wireless');

  // -- T17_2 → T44_1 --
  await addLink(id, t17_2.id, t44_1.id, 'ethernet');

  // -- T44 central connections --
  await addLink(id, t44.id, t44_1.id, 'ethernet');
  await addLink(id, t44.id, t44_4.id, 'ethernet');
  await addLink(id, t44.id, t44_2.id, 'ethernet');
  await addLink(id, t44.id, t13_loja.id, 'ethernet');
  await addLink(id, t44.id, t44_5.id, 'ethernet');

  // -- T13 LOJA → T117 → T117_1 → T92 --
  await addLink(id, t13_loja.id, t117.id, 'wireless');
  await addLink(id, t117.id, t117_1.id, 'ethernet');
  await addLink(id, t117_1.id, t92_1.id, 'wireless');
  await addLink(id, t92_1.id, t92.id, 'ethernet');
  await addLink(id, t92.id, t92_2_ponte.id, 'ethernet');

  // -- Cloud links (PLANALTO, BACBONE, CARBONITA) --
  await addLink(id, planalto.id, t44.id, 'fiber');
  await addLink(id, bacbone.id, t44.id, 'fiber');
  await addLink(id, carbonita.id, t44.id, 'fiber');

  // -- T44_5 → T44_3 SXT, BERENICE --
  await addLink(id, t44_5.id, t44_3_sxt.id, 'wireless');
  await addLink(id, berenice.id, t44_3_sxt.id, 'ethernet');
  await addLink(id, berenice.id, casa_roca.id, 'ethernet');
  await addLink(id, casa_roca.id, _11_6.id, 'ethernet');
  await addLink(id, _11_6.id, t60.id, 'ethernet');

  // -- T44 → T16_5 → T16 --
  await addLink(id, t44.id, t16_5.id, 'wireless');
  await addLink(id, t16_5.id, t16.id, 'ethernet');

  // -- T16 connections --
  await addLink(id, t16.id, t16_2.id, 'ethernet');
  await addLink(id, t16.id, fibra_abadia.id, 'fiber');
  await addLink(id, t16.id, t16_4.id, 'ethernet');

  // -- T16_4 → REPETIDORA → ROTEADOR → AP-SANDRA --
  await addLink(id, t16_4.id, repetidora.id, 'wireless');
  await addLink(id, repetidora.id, roteador.id, 'ethernet');
  await addLink(id, roteador.id, ap_sandra.id, 'wireless');

  // -- T44_4 → T155 → T47 → AP-GLAUCIA --
  await addLink(id, t44_4.id, t155.id, 'wireless');
  await addLink(id, t155.id, t47.id, 'wireless');
  await addLink(id, t47.id, ap_glaucia.id, 'ethernet');

  // -- T44_4 → VICENTA → 11.158 --
  await addLink(id, t44_4.id, vicenta.id, 'wireless');
  await addLink(id, vicenta.id, _11_158.id, 'ethernet');

  // -- VICENTA → 11.156 → AP-MARTINHO --
  await addLink(id, vicenta.id, _11_156.id, 'ethernet');
  await addLink(id, _11_156.id, ap_martinho.id, 'wireless');

  // -- T44_4 → T45 → T151 --
  await addLink(id, t44_4.id, t45.id, 'ethernet');
  await addLink(id, t45.id, t151.id, 'ethernet');

  // -- T44_4 → T148_r → T149 --
  await addLink(id, t44_4.id, t148_r.id, 'ethernet');
  await addLink(id, t148_r.id, t149.id, 'ethernet');

  // -- ST-BOZO → 11.11 → 11.12 --
  await addLink(id, st_bozo.id, _11_11.id, 'ethernet');
  await addLink(id, _11_11.id, _11_12.id, 'ethernet');

  // -- T44_4 → ST-BOZO --
  await addLink(id, t44_4.id, st_bozo.id, 'wireless');

  // -- 172.16.133.3 → SWITCH --
  await addLink(id, _172_16_133_3.id, switch_central.id, 'wireless');

  // -- T13 LOJA → T17_12 --
  await addLink(id, t13_loja.id, t17_12.id, 'wireless');

  // -- T44_2 → T16_2 --
  await addLink(id, t44_2.id, t16_2.id, 'ethernet');

  // -- T48 → T44_1 --
  await addLink(id, t48.id, t44_1.id, 'wireless');

  console.log('\n✅ CAMPO LIMPO recriado com sucesso!');
  console.log(`   Mapa ID: ${id}`);

  const nodeCount = await prisma.mapNode.count({ where: { mapId: id } });
  const linkCount = await prisma.mapLink.count({ where: { mapId: id } });
  console.log(`   ${nodeCount} nós criados`);
  console.log(`   ${linkCount} links criados`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
