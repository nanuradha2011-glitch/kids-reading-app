// The sticker catalog for the reward system: finish reading anything
// (a story, a news article, or a fact — any tab, marked "done" once) and
// the kid gets a random sticker from this list. Common ones show up
// often so a kid always feels like they're making progress; rare and
// super_rare ones are exciting, occasional surprises. Weighting for the
// random draw lives in lib/stickers.js, not here — this file is just the
// catalog itself.
//
// `code` is a short, stable identifier (never shown to a kid) used to
// match a sticker across re-seeds, the same way `title` works for
// scripts/story-content.js — change the emoji or name freely, but don't
// change an existing sticker's code, or seeding will treat it as a brand
// new sticker instead of updating the one kids may have already earned.
module.exports = [
  // ---- common ----
  { code: 'turtle', emoji: '🐢', name: 'Turtle', rarity: 'common' },
  { code: 'dolphin', emoji: '🐬', name: 'Dolphin', rarity: 'common' },
  { code: 'butterfly', emoji: '🦋', name: 'Butterfly', rarity: 'common' },
  { code: 'bee', emoji: '🐝', name: 'Busy Bee', rarity: 'common' },
  { code: 'sunflower', emoji: '🌻', name: 'Sunflower', rarity: 'common' },
  { code: 'mushroom', emoji: '🍄', name: 'Mushroom', rarity: 'common' },
  { code: 'penguin', emoji: '🐧', name: 'Penguin', rarity: 'common' },
  { code: 'owl', emoji: '🦉', name: 'Wise Owl', rarity: 'common' },
  { code: 'squirrel', emoji: '🐿️', name: 'Squirrel', rarity: 'common' },
  { code: 'rainbow', emoji: '🌈', name: 'Rainbow', rarity: 'common' },
  { code: 'star', emoji: '⭐', name: 'Shiny Star', rarity: 'common' },
  { code: 'apple', emoji: '🍎', name: 'Apple', rarity: 'common' },
  { code: 'octopus', emoji: '🐙', name: 'Octopus', rarity: 'common' },
  { code: 'hedgehog', emoji: '🦔', name: 'Hedgehog', rarity: 'common' },
  { code: 'whale', emoji: '🐳', name: 'Whale', rarity: 'common' },
  { code: 'cactus', emoji: '🌵', name: 'Cactus', rarity: 'common' },
  { code: 'ladybug', emoji: '🐞', name: 'Ladybug', rarity: 'common' },
  { code: 'rocket_small', emoji: '🪐', name: 'Little Planet', rarity: 'common' },

  // ---- rare ----
  { code: 'unicorn', emoji: '🦄', name: 'Unicorn', rarity: 'rare' },
  { code: 'dragon', emoji: '🐉', name: 'Dragon', rarity: 'rare' },
  { code: 'rocket', emoji: '🚀', name: 'Rocket Ship', rarity: 'rare' },
  { code: 'volcano', emoji: '🌋', name: 'Volcano', rarity: 'rare' },
  { code: 't_rex', emoji: '🦖', name: 'T. Rex', rarity: 'rare' },
  { code: 'shooting_star', emoji: '🌠', name: 'Shooting Star', rarity: 'rare' },
  { code: 'trophy', emoji: '🏆', name: 'Trophy', rarity: 'rare' },
  { code: 'lightning', emoji: '⚡', name: 'Lightning Bolt', rarity: 'rare' },

  // ---- super_rare ----
  { code: 'crown', emoji: '👑', name: 'Golden Crown', rarity: 'super_rare' },
  { code: 'diamond', emoji: '💎', name: 'Diamond', rarity: 'super_rare' },
  { code: 'galaxy', emoji: '🌌', name: 'Galaxy', rarity: 'super_rare' },
  { code: 'phoenix', emoji: '🔥', name: 'Phoenix', rarity: 'super_rare' },
];
