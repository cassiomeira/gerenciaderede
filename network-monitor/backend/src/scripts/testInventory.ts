import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
dotenv.config();

const CSV_PATH = process.env.CSV_PATH || '';

function test() {
  console.log(`Testing CSV: ${CSV_PATH}`);
  if (!fs.existsSync(CSV_PATH)) {
    console.error('CSV NOT FOUND');
    return;
  }
  
  const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(fileContent, { 
    columns: true, 
    skip_empty_lines: true,
    trim: true
  });
  
  console.log('Sample record keys:', Object.keys(records[0]));
  console.log('Sample record values:', Object.values(records[0]));
  
  const devices = records
    .map((r: any) => {
      const ip = r['Endereço IP'] || r['Endereco IP'] || r['IP Address'] || r['IP'] || Object.values(r)[1];
      const name = r['Nome do Dispositivo'] || r['Nome'] || r['Device Name'] || Object.values(r)[0];
      
      return {
        name: (name || 'Sem Nome').toString().trim(),
        ip: (ip || '').toString().trim()
      };
    })
    .filter((d: any) => d.ip && d.ip !== '0.0.0.0' && d.ip !== 'IP' && d.ip.includes('.'));

  console.log(`Found ${devices.length} devices.`);
  if (devices.length > 0) {
    console.log('First device:', devices[0]);
  }
}

test();
