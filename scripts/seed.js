// Seeds (or updates) the stories table. Safe to run more than once: an
// item is inserted if its title is new, or updates the existing row with
// that title otherwise — so editing story-content.js and re-running this
// picks up the changes without creating duplicates.
//
// Run it with: node --env-file=.env scripts/seed.js
// (--env-file is a built-in Node flag since v20.6 — no dotenv package
// needed to load DATABASE_URL out of a local .env file.)
const db = require('../lib/db');
const items = require('./story-content');

async function main() {
  const { rows: existing } = await db.query('SELECT id, title FROM stories');
  const existingByTitle = new Map(existing.map((r) => [r.title, r.id]));

  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    // Sanity check: a vocabulary word that isn't actually IN the story
    // text would silently never become tappable — catch that here, at
    // seed time, rather than a kid discovering it doesn't work.
    const bodyLower = item.body.toLowerCase();
    for (const v of item.vocabulary || []) {
      if (!bodyLower.includes(v.word.toLowerCase())) {
        throw new Error(`Vocabulary word "${v.word}" does not appear in the body of "${item.title}"`);
      }
    }

    const quizJson = JSON.stringify(item.quiz || []);
    const vocabJson = JSON.stringify(item.vocabulary || []);
    const existingId = existingByTitle.get(item.title);

    if (existingId) {
      await db.query(
        `UPDATE stories SET body = $1, category = $2, content_type = $3, read_minutes = $4, quiz = $5::jsonb, vocabulary = $6::jsonb, age_band = $7
         WHERE id = $8`,
        [item.body.trim(), item.category, item.content_type, item.read_minutes, quizJson, vocabJson, item.age_band, existingId]
      );
      updated++;
    } else {
      await db.query(
        `INSERT INTO stories (title, body, category, content_type, read_minutes, quiz, vocabulary, age_band)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
        [item.title, item.body.trim(), item.category, item.content_type, item.read_minutes, quizJson, vocabJson, item.age_band]
      );
      inserted++;
    }
  }

  console.log(`Seed complete: ${inserted} new item(s) inserted, ${updated} existing item(s) updated.`);
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
