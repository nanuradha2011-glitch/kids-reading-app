// Seeds (or updates) the stickers catalog. Same safe-to-run-more-than-
// once idea as seed.js: a sticker is matched by its "code", inserted if
// new, or updated in place if it already exists — so tweaking an emoji
// or name in scripts/stickers.js and re-running this just updates that
// row instead of creating a duplicate.
//
// Run it with: node --env-file=.env scripts/seed-stickers.js
const db = require('../lib/db');
const stickers = require('./stickers');

async function main() {
  const { rows: existing } = await db.query('SELECT id, code FROM stickers');
  const existingByCode = new Map(existing.map((r) => [r.code, r.id]));

  let inserted = 0;
  let updated = 0;

  for (const s of stickers) {
    const existingId = existingByCode.get(s.code);
    if (existingId) {
      await db.query(
        'UPDATE stickers SET emoji = $1, name = $2, rarity = $3 WHERE id = $4',
        [s.emoji, s.name, s.rarity, existingId]
      );
      updated++;
    } else {
      await db.query(
        'INSERT INTO stickers (code, emoji, name, rarity) VALUES ($1, $2, $3, $4)',
        [s.code, s.emoji, s.name, s.rarity]
      );
      inserted++;
    }
  }

  console.log(`Sticker seed complete: ${inserted} new sticker(s) inserted, ${updated} existing sticker(s) updated.`);
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
