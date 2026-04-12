const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'master.db');
console.log('Abrindo banco:', dbPath);

const db = new Database(dbPath);

try {
  db.exec("ALTER TABLE Company ADD COLUMN telemetryMode TEXT DEFAULT 'CENTRAL'");
  console.log('Coluna telemetryMode adicionada com sucesso!');
} catch (err) {
  if (err.message.includes('duplicate column')) {
    console.log('Coluna telemetryMode ja existe, tudo OK.');
  } else {
    console.error('Erro:', err.message);
  }
}

db.close();
