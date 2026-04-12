import fs from 'fs';
async function dump() {
  const res = await fetch('http://localhost:3001/api/scripts');
  const scripts = await res.json();
  const old = scripts.find(s => s.name.includes('Segurança e Monitoramento'));
  if (old) {
    fs.writeFileSync('old_script.txt', old.content, 'utf8');
  }
}
dump();
