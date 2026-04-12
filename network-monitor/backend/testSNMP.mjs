import snmp from 'net-snmp';

const ip = '10.201.11.86';
const community = 'N3tc@rSNMP';

const session = snmp.createSession(ip, community, {
  version: snmp.Version2c,
  retries: 1,
  timeout: 5000
});

console.log(`Testando SNMP para ${ip} com community '${community}'...`);

// Testando OID de Uptime
session.get(['1.3.6.1.2.1.1.3.0'], (error, varbinds) => {
  if (error) {
    console.error('Erro SNMP Uptime:', error.toString());
  } else {
    for (const vb of varbinds) {
      if (snmp.isVarbindError(vb)) {
        console.error(snmp.varbindError(vb));
      } else {
        console.log('Sucesso! Uptime OID value =', vb.value.toString());
      }
    }
  }
  session.close();
});
