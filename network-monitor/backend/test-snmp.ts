import snmp from 'net-snmp';

const ip = '10.100.15.82';
const community = 'N3tc@rSNMP';
const RTAB_OID = '1.3.6.1.4.1.14988.1.1.1.2.1';

console.log(`Testing SNMP walk on ${ip} with community ${community}`);
console.log(`OID: ${RTAB_OID}`);

// Test 1: Simple subtree walk
console.log('\n=== TEST 1: subtree walk ===');
const session1 = snmp.createSession(ip, community, { 
  timeout: 5000, retries: 1, version: snmp.Version2c 
});

session1.subtree(RTAB_OID, 20,
  (varbinds) => {
    console.log(`Got ${varbinds.length} varbinds:`);
    for (const vb of varbinds) {
      console.log(`  OID: ${vb.oid} Type: ${vb.type} Value: ${vb.value}`);
    }
  },
  (error) => {
    session1.close();
    if (error) console.log(`Subtree error: ${error.message}`);
    else console.log('Subtree completed (no error)');

    // Test 2: Try SNMPv1
    console.log('\n=== TEST 2: subtree walk SNMPv1 ===');
    const session2 = snmp.createSession(ip, community, { 
      timeout: 5000, retries: 1, version: snmp.Version1 
    });
    
    session2.subtree(RTAB_OID, 20,
      (varbinds) => {
        console.log(`Got ${varbinds.length} varbinds:`);
        for (const vb of varbinds) {
          console.log(`  OID: ${vb.oid} Type: ${vb.type} Value: ${vb.value}`);
        }
      },
      (error) => {
        session2.close();
        if (error) console.log(`SNMPv1 error: ${error.message}`);
        else console.log('SNMPv1 completed (no error)');

        // Test 3: Try community "public"
        console.log('\n=== TEST 3: community "public" v2c ===');
        const session3 = snmp.createSession(ip, 'public', { 
          timeout: 5000, retries: 1, version: snmp.Version2c 
        });
        
        session3.subtree(RTAB_OID, 20,
          (varbinds) => {
            console.log(`Got ${varbinds.length} varbinds:`);
            for (const vb of varbinds) {
              console.log(`  OID: ${vb.oid} Type: ${vb.type} Value: ${vb.value}`);
            }
          },
          (error) => {
            session3.close();
            if (error) console.log(`Public error: ${error.message}`);
            else console.log('Public completed (no error)');

            // Test 4: Try basic system OID to confirm SNMP works at all
            console.log('\n=== TEST 4: Basic sysDescr to confirm SNMP works ===');
            const session4 = snmp.createSession(ip, community, { 
              timeout: 5000, retries: 1, version: snmp.Version2c 
            });
            session4.get(['1.3.6.1.2.1.1.1.0'], (err, varbinds) => {
              session4.close();
              if (err) console.log(`sysDescr error: ${err.message}`);
              else if (varbinds) {
                for (const vb of varbinds) {
                  console.log(`  sysDescr: ${vb.value}`);
                }
              }
              
              // Test 5: Try walk on parent OID  
              console.log('\n=== TEST 5: Walk broader MikroTik OID tree ===');
              const session5 = snmp.createSession(ip, community, { 
                timeout: 5000, retries: 1, version: snmp.Version1 
              });
              const parentOid = '1.3.6.1.4.1.14988.1.1.1';
              session5.subtree(parentOid, 20,
                (varbinds) => {
                  console.log(`Got ${varbinds.length} varbinds from parent:`);
                  for (const vb of varbinds) {
                    console.log(`  OID: ${vb.oid} Type: ${vb.type} Value: ${Buffer.isBuffer(vb.value) ? vb.value.toString('hex') : vb.value}`);
                  }
                },
                (error) => {
                  session5.close();
                  if (error) console.log(`Parent walk error: ${error.message}`);
                  else console.log('Parent walk completed');
                  console.log('\n=== ALL TESTS DONE ===');
                }
              );
            });
          }
        );
      }
    );
  }
);
