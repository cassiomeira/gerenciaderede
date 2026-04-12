import fs from 'fs';
import { parse } from 'csv-parse/sync';

const CSV_PATH = "c:/aplicativos/gerenciaderede/gerenciaderede/dispositivos_monitoramento.csv";

function testCsvLoading() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error("Arquivo não encontrado!");
        return;
    }

    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true });

    console.log("Número de registros:", records.length);
    if (records.length > 0) {
        console.log("Teclas do primeiro registro:", Object.keys(records[0]));
        console.log("Primeiro registro:", records[0]);
    }

    const testIp = '10.1.15.153';
    const found = records.find((r: any) => {
        const ip = r['Endereço IP'];
        return ip === testIp;
    });

    if (found) {
        console.log(`Encontrado ${testIp}:`, found);
    } else {
        console.log(`NÃO encontrado ${testIp} usando chave 'Endereço IP'`);
        // Tentar encontrar por inspeção de chaves
        const firstRec = records[0];
        const keys = Object.keys(firstRec);
        const ipKey = keys.find(k => k.includes('IP') || k.includes('Endere'));
        console.log(`Sugestão de chave de IP: "${ipKey}"`);
        
        if (ipKey) {
            const foundWithKey = records.find((r: any) => r[ipKey] === testIp);
            console.log(`Encontrado com chave sugerida:`, foundWithKey);
        }
    }
}

testCsvLoading();
