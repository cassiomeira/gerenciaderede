import snmp from 'net-snmp';

const ip = '10.100.16.44';
const community = 'N3tc@rSNMP';
const OIDS = [
  '1.3.6.1.2.1.1.5.0', // identity
  '1.3.6.1.4.1.14988.1.1.7.3.0', // model
  '1.3.6.1.4.1.14988.1.1.7.4.0', // firmware
];

const session = snmp.createSession(ip, community, { timeout: 3000, retries: 1 });

session.get(OIDS, (error, varbinds) => {
    if (error) {
        console.log(`[FAIL] SNMP error: ${error.message}`);
        // Tenta com public
        snmp.createSession(ip, 'public', { timeout: 3000, retries: 1 }).get(OIDS, (err2, var2) => {
            if (err2) {
                console.log(`[FAIL] Public community ALSO failed: ${err2.message}`);
            } else {
                console.log('--- SNMP Results (public) ---');
                var2.forEach(vb => console.log(`${vb.oid}: ${vb.value.toString()}`));
            }
        });
    } else {
        console.log('--- SNMP Results (N3tc@rSNMP) ---');
        varbinds.forEach(vb => console.log(`${vb.oid}: ${vb.value.toString()}`));
    }
});
