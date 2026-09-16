// Picks a random sticker for a kid who just finished reading something.
// Common stickers show up often (so progress always feels frequent),
// rare ones are a nice surprise, and super_rare ones are a big deal.
//
// These weights are percentages of the total draw — they don't need to
// add up to any particular number of stickers in each tier, since the
// weight is for the TIER as a whole, then split evenly among however
// many stickers exist in that tier today. So adding a 19th common
// sticker to scripts/stickers.js doesn't change how often "common"
// stickers show up overall, it just spreads that same 70% chance a
// little thinner across one more sticker.
const RARITY_WEIGHTS = { common: 70, rare: 25, super_rare: 5 };

// `stickers` is the full catalog as loaded from the database (each row
// has at least `id` and `rarity`). Returns one sticker row, or null if
// the catalog is empty (e.g. seed-stickers.js hasn't been run yet).
function pickRandomSticker(stickers) {
  if (!stickers || stickers.length === 0) return null;

  const byRarity = {};
  for (const s of stickers) {
    (byRarity[s.rarity] = byRarity[s.rarity] || []).push(s);
  }

  // Only weight tiers that actually have at least one sticker in them,
  // so this still works fine before every tier has been filled in.
  const availableTiers = Object.keys(byRarity).filter((r) => byRarity[r].length > 0);
  const totalWeight = availableTiers.reduce((sum, r) => sum + (RARITY_WEIGHTS[r] || 0), 0);

  let roll = Math.random() * totalWeight;
  let chosenTier = availableTiers[availableTiers.length - 1];
  for (const tier of availableTiers) {
    const weight = RARITY_WEIGHTS[tier] || 0;
    if (roll < weight) {
      chosenTier = tier;
      break;
    }
    roll -= weight;
  }

  const pool = byRarity[chosenTier];
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { pickRandomSticker, RARITY_WEIGHTS };
