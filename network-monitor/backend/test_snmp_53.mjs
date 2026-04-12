import snmp from 'net-snmp';

const ip = '10.200.15.53';
const communities = ['N3tc@rSNMP', 'public', 'intelbras', 'admin'];
const OIDS = [
  '1.3.6.1.2.1.1.5.0', // identity
  '1.3.6.1.2.1.1.1.0', // descr
];

async function test() {
    for (const community of communities) {
        console.log(`--- Testing community: ${community} ---`);
        try {
            await new Promise((resolve, reject) => {
                const session = snmp.createSession(ip, community, { timeout: 3000, retries: 0 });
                session.get(OIDS, (error, varbinds) => {
                    if (error) {
                        console.log(`[FAIL] ${error.message}`);
                        resolve(false);
                    } else {
                        console.log(`[SUCCESS] Found info!`);
                        varbinds.forEach(vb => console.log(`${vb.oid}: ${vb.value.toString()}`));
                        resolve(true);
                    }
                });
            });
        } catch (e) {}
    }
}

test();
