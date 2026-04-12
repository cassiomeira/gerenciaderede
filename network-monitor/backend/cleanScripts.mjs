async function clean() {
  const res = await fetch('http://localhost:3001/api/scripts');
  const scripts = await res.json();
  const supremos = scripts.filter(s => s.name.includes('Supremo: Firewall'));
  
  if (supremos.length > 1) {
    for (let i = 0; i < supremos.length - 1; i++) {
        await fetch('http://localhost:3001/api/scripts/' + supremos[i].id, { method: 'DELETE' });
    }
    console.log(`Deletou ${supremos.length - 1} duplicatas.`);
  } else {
    console.log('Sem duplicatas.');
  }
}
clean();
