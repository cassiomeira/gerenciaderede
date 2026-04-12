async function dump() {
  const res = await fetch('http://localhost:3001/api/scripts');
  const scripts = await res.json();
  const old = scripts.find(s => s.name.includes('Segurança e Monitoramento'));
  if (old) {
    const fs = require('fs');
    fs.writeFileSync('old_script.txt', old.content);
    console.log('Saved to old_script.txt');
  }
}
dump();
