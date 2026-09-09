// Runs schema.sql against whatever database DATABASE_URL points to.
// Safe to run more than once (every statement in schema.sql uses
// IF NOT EXISTS). Run it with:
//   node --env-file=.env scripts/migrate.js
const fs = require('node:fs');
const path = require('node:path');
const db = require('../lib/db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(sql);
  console.log('Migration complete: schema is up to date.');
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
