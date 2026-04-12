
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dbPath = 'C:/aplicativos/gerenciaderede/gerenciaderede/network-monitor/backend/prisma/dev.db';
const db = new Database(dbPath);

console.log('Direct SQL check at:', dbPath);

try {
  const nodes = db.prepare("SELECT id, label, nickname FROM MapNode WHERE nickname IS NOT NULL LIMIT 5").all();
  console.log('Nodes with nicknames (Direct SQL):', JSON.stringify(nodes, null, 2));
  
  const anyNode = db.prepare("SELECT * FROM MapNode LIMIT 1").get();
  console.log('All columns in MapNode (Direct SQL):', Object.keys(anyNode || {}));
} catch (e) {
  console.log('Error in direct SQL:', e.message);
}

db.close();
