import fs from 'fs';

const JSON_PATH = "/tmp/transmitters.json";

function findInJson() {
    if (!fs.existsSync(JSON_PATH)) {
        console.error("JSON não encontrado!");
        return;
    }

    const content = fs.readFileSync(JSON_PATH, 'utf-8');
    const data = JSON.parse(content);
    console.log("Total de dispositivos no JSON:", data.length);

    const testIp = '10.1.15.153';
    const found = data.find((d: any) => d.ip === testIp);

    if (found) {
        console.log(`Dispositivo ${testIp} encontrado:`, found);
    } else {
        console.log(`Dispositivo ${testIp} NÃO encontrado no JSON!`);
        // Listar alguns IPs para ver o formato
        console.log("Amostra de IPs:", data.slice(0, 5).map((d: any) => d.ip));
    }
}

findInJson();
