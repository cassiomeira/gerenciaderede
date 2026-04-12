// Test login and API access
async function main() {
  console.log('=== TESTANDO LOGIN ===');
  
  // 1. Login
  const loginRes = await fetch('http://localhost:3001/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cassiomeiramir4@gmail.com', password: '28152815@' })
  });
  
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status);
  console.log('Login data:', JSON.stringify(loginData, null, 2));
  
  if (!loginData.token) {
    console.error('FALHA NO LOGIN!');
    return;
  }
  
  // 2. Get /auth/me
  const meRes = await fetch('http://localhost:3001/auth/me', {
    headers: { 'Authorization': `Bearer ${loginData.token}` }
  });
  console.log('\n/auth/me status:', meRes.status);
  console.log('/auth/me data:', JSON.stringify(await meRes.json(), null, 2));
  
  // 3. Test protected route
  const mapsRes = await fetch('http://localhost:3001/api/maps', {
    headers: { 'Authorization': `Bearer ${loginData.token}` }
  });
  const maps = await mapsRes.json();
  console.log('\n/api/maps status:', mapsRes.status);
  console.log('Maps:', maps.map((m: any) => m.name));
  
  // 4. Test without token (should be 401)
  const noTokenRes = await fetch('http://localhost:3001/api/maps');
  console.log('\n/api/maps (sem token) status:', noTokenRes.status);
}

main();
