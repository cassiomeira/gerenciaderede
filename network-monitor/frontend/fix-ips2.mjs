import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
let changedCount = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let original = content;

  // Corrige os erros de escape criados pelo script anterior
  content = content.replace(/http:\\\/\\\/\\\$\{window\.location\.hostname\}:3001/g, 'http://${window.location.hostname}:3001');
  content = content.replace(/http:\/\/\\\$\{window\.location\.hostname\}:3001/g, 'http://${window.location.hostname}:3001');
  
  if (content !== original) {
    fs.writeFileSync(f, content, 'utf8');
    changedCount++;
  }
});
console.log('Arquivos corrigidos para acesso remoto:', changedCount);
