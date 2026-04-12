
import * as fs from 'fs';
import * as path from 'path';

// Using sqlite3 because it's standard and probably available. If not we can use better-sqlite3
const execSync = require('child_process').execSync;

try {
  const dbPath = 'c:/aplicativos/gerenciaderede/gerenciaderede/dude/dude.db';
  console.log(`Analyzing ${dbPath}`);

  // Need a quick script to run via node 
  const scriptStr = `
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('${dbPath}', sqlite3.OPEN_READONLY);
    
    db.serialize(() => {
      // 1. Get all tables
      db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) { console.error(err); return; }
        console.log("TABLES:", tables.map(t => t.name).join(", "));
        
        // 2. Sample 'objs' table if it exists
        if(tables.find(t => t.name === 'objs')) {
           db.all("SELECT obj, type FROM objs LIMIT 5", [], (err, rows) => {
              if (err) { console.error(err); return; }
              console.log("FIRST 5 OBJS:");
              rows.forEach((r, i) => {
                 let type = r.type;
                 let buf = r.obj;
                 console.log(\`[\${i}] Type \${type}: First 100 bytes is buffer? \${Buffer.isBuffer(buf)}\`);
                 if (Buffer.isBuffer(buf)) {
                    // It's binary/XML. Let's try to print as string
                    console.log(buf.toString('utf-8', 0, Math.min(200, buf.length)));
                 }
              });
           });

           // Count types
           db.all("SELECT type, count(*) as count FROM objs GROUP BY type", [], (err, counts) => {
              if (err) return;
              console.log("OBJECT TYPES SUMMARY:");
              counts.forEach(c => console.log(\`  Type \${c.type}: \${c.count}\`));
           });
        }
      });
    });
  `;
  
  fs.writeFileSync('inspect_dude.js', scriptStr);
  console.log('Script written to inspect_dude.js');
} catch (e) {
  console.error(e);
}
