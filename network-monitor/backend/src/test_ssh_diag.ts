import { radioService } from './services/radioService.js';

async function testSSH() {
    const ip = '10.100.15.131';
    console.log(`\nTestando SSH para ${ip}...`);
    
    // Teste 1: Credencial mestra 1
    try {
        const output = await radioService.runMikrotikCommand(ip, 'N3tc@r', 'AdminiStracao2021', '/system identity print');
        console.log('✅ N3tc@r funcionou:', output);
    } catch (e: any) {
        console.log('❌ N3tc@r falhou:', e.message);
    }

    // Teste 2: Credencial mestra 2
    try {
        const output = await radioService.runMikrotikCommand(ip, 'matrix', 'matrix', '/system identity print');
        console.log('✅ matrix funcionou:', output);
    } catch (e: any) {
        console.log('❌ matrix falhou:', e.message);
    }

    // Teste 3: getDeviceDetails completo
    try {
        const details = await radioService.getDeviceDetails(ip);
        console.log('✅ getDeviceDetails:', JSON.stringify(details, null, 2));
    } catch (e: any) {
        console.log('❌ getDeviceDetails falhou:', e.message);
    }
}

testSSH();
