import snmp from 'net-snmp';

const ip = process.argv[2] || '10.201.11.118';
const community = 'N3tc@rSNMP';

const session = snmp.createSession(ip, community, {
  version: snmp.Version2c,
  retries: 2,
  timeout: 5000
});

console.log(`--- TESTANDO SNMP DINAMICO PARA ${ip} ---`);

session.get(['1.3.6.1.2.1.1.5.0'], (error, varbinds) => {
  if (error) {
    console.error('ERRO SNMP:', error.toString());
  } else {
    console.log(`SUCESSO SNMP! Hostname: ${varbinds[0].value.toString()}`);
  }
  session.close();
});
