import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface DudeDevice {
  flag: string;
  name: string;
  address: string;
  mac: string;
  type: string;
  map: string;
  servicesDown: string;
  notes: string;
}

function parseCSV(content: string): DudeDevice[] {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const devices: DudeDevice[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Parse CSV with potential quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    if (fields.length >= 6) {
      const addr = fields[2] || '';
      // Take first IP if multiple (comma separated within quotes)
      const firstIp = addr.split(',')[0].trim();
      
      devices.push({
        flag: fields[0],
        name: fields[1],
        address: firstIp && firstIp !== '0.0.0.0' ? firstIp : '',
        mac: fields[3],
        type: fields[4],
        map: fields[5],
        servicesDown: fields[6] || '',
        notes: fields[7] || '',
      });
    }
  }
  return devices;
}

function normalize(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Map CSV map names to our DB map names
const MAP_NAME_ALIAS: Record<string, string> = {
  'CARBONITA': 'CARBONITA',
  'FLORES': 'FLORES',
  'CAMPO LIMPO': 'CAMPO LIMPO',
  'SERRA NEGRA': 'SERRA NEGRA',
  'PLA/OLHD/LAGOA': 'PLANALTO/LAGOA',
  'ITAMARANDIBA': 'ITAMARANDIBA',
  'BACBONE': 'BACKBONE',
  'MENDONCA': 'MENDONÇA',
  'APERAN': 'APERAN',
  'CAPELINHA': 'CAPELINHA',
};

async function main() {
  let content: string | undefined;
  const csvPaths = [
    'C:/aplicativos/ixc claude/exportacao dude/Devices.csv',
    'C:\\aplicativos\\ixc claude\\exportacao dude\\Devices.csv',
  ];
  
  for (const p of csvPaths) {
    try {
      content = fs.readFileSync(p, 'utf-8');
      console.log(`✅ Lido CSV de: ${p}`);
      break;
    } catch { }
  }
  
  if (!content) {
    console.error('❌ Não encontrou o CSV!');
    process.exit(1);
  }

  const devices = parseCSV(content);
  console.log(`📋 Total de dispositivos no CSV: ${devices.length}`);

  // Get all maps from DB
  const maps = await prisma.networkMap.findMany();
  console.log(`🗺️ Mapas existentes: ${maps.map(m => m.name).join(', ')}`);

  // Build map name -> id lookup
  const mapNameToId: Record<string, number> = {};
  for (const m of maps) {
    mapNameToId[m.name.toUpperCase()] = m.id;
  }

  // Get all existing nodes
  const existingNodes = await prisma.mapNode.findMany();
  console.log(`📍 Nós existentes no banco: ${existingNodes.length}`);

  // ---- PHASE 1: Update missing IPs on existing nodes ----
  console.log('\n=== FASE 1: Atualizando IPs faltantes ===');
  let updatedIps = 0;
  
  for (const node of existingNodes) {
    if (node.apIp && node.apIp !== '0.0.0.0') continue; // Already has IP
    if (!node.label) continue;
    
    const nodeNorm = normalize(node.label);
    
    // Find exact match in CSV
    const csvMatch = devices.find(d => normalize(d.name) === nodeNorm && d.address);
    
    if (csvMatch) {
      console.log(`  ✅ ${node.label.padEnd(30)} -> ${csvMatch.address}`);
      await prisma.mapNode.update({
        where: { id: node.id },
        data: { apIp: csvMatch.address }
      });
      updatedIps++;
    }
  }
  console.log(`  Atualizados: ${updatedIps} IPs`);

  // ---- PHASE 2: Find devices in CSV that are missing from their maps ----
  console.log('\n=== FASE 2: Dispositivos do CSV faltando nos mapas ===');
  
  // Group CSV devices by map
  const csvByMap: Record<string, DudeDevice[]> = {};
  for (const d of devices) {
    if (!d.map) continue;
    const mapAlias = MAP_NAME_ALIAS[d.map];
    if (!mapAlias) continue;
    if (!csvByMap[mapAlias]) csvByMap[mapAlias] = [];
    csvByMap[mapAlias].push(d);
  }

  // For each map, check which CSV devices are missing
  let totalAdded = 0;
  for (const [mapName, csvDevices] of Object.entries(csvByMap)) {
    const mapId = mapNameToId[mapName.toUpperCase()];
    if (!mapId) {
      console.log(`  ⚠️ Mapa "${mapName}" não existe no banco, pulando.`);
      continue;
    }

    // Get existing nodes for this map
    const mapNodes = existingNodes.filter(n => n.mapId === mapId);
    const existingLabelsNorm = new Set(mapNodes.map(n => normalize(n.label)));
    
    // Find missing devices
    const missing = csvDevices.filter(d => {
      const norm = normalize(d.name);
      return !existingLabelsNorm.has(norm);
    });

    if (missing.length > 0) {
      console.log(`\n  🗺️ ${mapName}: ${missing.length} dispositivos faltando (de ${csvDevices.length} no CSV)`);
      
      // Add missing devices with auto-positioned layout
      let addedCount = 0;
      const startX = 100;
      const startY = mapNodes.length > 0 
        ? Math.max(...mapNodes.map(n => n.y)) + 80
        : 100;
      
      for (const d of missing) {
        // Skip devices with no useful info (test maps, unnamed, etc.)
        if (d.flag === 'unknown' && !d.address) continue;
        
        const col = addedCount % 6;
        const row = Math.floor(addedCount / 6);
        
        await prisma.mapNode.create({
          data: {
            mapId: mapId,
            label: d.name,
            x: startX + col * 180,
            y: startY + row * 80,
            apIp: d.address || null,
          }
        });
        
        console.log(`    + ${d.name.padEnd(30)} IP: ${d.address || 'N/A'}`);
        addedCount++;
        totalAdded++;
      }
    }
  }

  console.log(`\n✅ RESUMO:`);
  console.log(`   IPs atualizados: ${updatedIps}`);
  console.log(`   Dispositivos adicionados: ${totalAdded}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
