async function list() {
  const r = await fetch('http://localhost:3001/api/scripts');
  const scripts = await r.json();
  console.log('--- SCRIPTS CADASTRADOS NO SISTEMA ---');
  if (scripts.length === 0) console.log('Nenhum script encontrado.');
  for (const s of scripts) {
    console.log('[ID: ' + s.id + '] ' + s.name);
  }
}
list();
