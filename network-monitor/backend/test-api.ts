async function main() {
  console.log('=== TESTANDO API ===');
  const loginRes = await fetch('http://localhost:3001/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cassiomeiramir4@gmail.com', password: '28152815@' })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.token;

  console.log('Testing /api/transmitters...');
  const tRes = await fetch('http://localhost:3001/api/transmitters', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (tRes.status !== 200) {
    console.error('Transmitters Error:', await tRes.text());
  } else {
    console.log('Transmitters OK:', (await tRes.json()).length);
  }

  console.log('Testing /api/stats...');
  const sRes = await fetch('http://localhost:3001/api/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (sRes.status !== 200) {
    console.error('Stats Error:', await sRes.text());
  } else {
    console.log('Stats OK', await sRes.json());
  }
}
main();
