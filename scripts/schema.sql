-- Postgres schema for the kids reading app. Safe to run more than once:
-- every statement uses IF NOT EXISTS, so re-running this after adding a
-- new statement at the bottom won't touch tables that already exist.
--
-- Differences from the old SQLite schema, worth knowing about:
--   * BIGSERIAL instead of INTEGER PRIMARY KEY AUTOINCREMENT — Postgres's
--     equivalent auto-incrementing id.
--   * TIMESTAMPTZ (timestamp with time zone) instead of TEXT for dates —
--     a real timestamp type instead of storing dates as plain text.
--   * quiz/vocabulary are JSONB (structured JSON Postgres understands
--     directly) instead of TEXT holding a JSON string — Postgres can
--     query inside them if we ever need to, and the driver hands them
--     back to Node as already-parsed objects.

CREATE TABLE IF NOT EXISTS parents (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  -- Email verification: a parent can't log in until they click the link
  -- we email them at signup. verify_token is cleared once used.
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verify_token TEXT,
  verify_token_expires TIMESTAMPTZ,
  -- Forgot-password flow: reset_token is only ever set while a reset is
  -- pending, and is cleared as soon as it's used (or replaced by a newer
  -- request).
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Same retroactive-migration pattern as age_band below: applies these
-- columns to a parents table that already existed before verification/
-- reset support did.
ALTER TABLE parents ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS verify_token TEXT;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS verify_token_expires TIMESTAMPTZ;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

-- Looking up a parent BY their token (verify-email / reset-password
-- routes) is the only place these columns are queried on, so index them
-- rather than the whole table getting scanned on every click.
CREATE INDEX IF NOT EXISTS idx_parents_verify_token ON parents(verify_token);
CREATE INDEX IF NOT EXISTS idx_parents_reset_token ON parents(reset_token);

-- IMPORTANT: any account that already existed before this migration ran
-- has email_verified = FALSE by default (the column's default), which
-- would lock out every real account you already use — including yours —
-- the moment login starts checking that flag. Grandfather them in: a row
-- with no verify_token was never issued one by the new signup flow,
-- which only ever means "this account predates email verification."
UPDATE parents SET email_verified = TRUE WHERE verify_token IS NULL AND email_verified = FALSE;

CREATE TABLE IF NOT EXISTS kids (
  id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT NOT NULL REFERENCES parents(id),
  name TEXT NOT NULL,
  age INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stories (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'story', -- 'story', 'news', or 'fact' — which tab it shows in
  read_minutes INTEGER NOT NULL DEFAULT 5,
  quiz JSONB NOT NULL DEFAULT '[]',
  vocabulary JSONB NOT NULL DEFAULT '[]',
  -- Which age band this item is written for: 'little_ones' (3-5),
  -- 'explorers' (6-8), or 'big_kids' (9-10). A kid only sees content
  -- tagged for their own band.
  age_band TEXT NOT NULL DEFAULT 'explorers' CHECK (age_band IN ('little_ones', 'explorers', 'big_kids')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ADD COLUMN IF NOT EXISTS so this also applies to a stories table that
-- already existed before age_band did — CREATE TABLE IF NOT EXISTS above
-- only defines new columns for a table created from scratch. Same
-- retroactive-migration idea as the CREATE UNIQUE INDEX statements
-- further down.
ALTER TABLE stories ADD COLUMN IF NOT EXISTS age_band TEXT NOT NULL DEFAULT 'explorers';
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_age_band_check;
ALTER TABLE stories ADD CONSTRAINT stories_age_band_check CHECK (age_band IN ('little_ones', 'explorers', 'big_kids'));

CREATE TABLE IF NOT EXISTS reading_progress (
  id BIGSERIAL PRIMARY KEY,
  kid_id BIGINT NOT NULL REFERENCES kids(id),
  story_id BIGINT NOT NULL REFERENCES stories(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One reaction per kid per story; tapping a different reaction later
-- replaces it rather than stacking up duplicates (see the UPSERT in
-- lib/handler.js's reactions route).
CREATE TABLE IF NOT EXISTS reactions (
  id BIGSERIAL PRIMARY KEY,
  kid_id BIGINT NOT NULL REFERENCES kids(id),
  story_id BIGINT NOT NULL REFERENCES stories(id),
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike', 'love', 'inspiring')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Best/most-recent quiz score per kid per story (same one-row-per-pair
-- pattern as reading_progress and reactions above).
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id BIGSERIAL PRIMARY KEY,
  kid_id BIGINT NOT NULL REFERENCES kids(id),
  story_id BIGINT NOT NULL REFERENCES stories(id),
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_kid_story ON reading_progress(kid_id, story_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_kid_story ON reactions(kid_id, story_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_kid_story ON quiz_attempts(kid_id, story_id);

-- Deleting a kid profile (Profile Settings -> a kid's own delete button)
-- should take their reading history with them instead of failing with a
-- foreign key error. These three tables' kid_id originally had no ON
-- DELETE behavior specified (Postgres defaults to blocking the delete),
-- so we drop and re-add each constraint with CASCADE. Postgres's default
-- auto-generated name for an unnamed foreign key is
-- "<table>_<column>_fkey", which is what these DROP statements target.
ALTER TABLE reading_progress DROP CONSTRAINT IF EXISTS reading_progress_kid_id_fkey;
ALTER TABLE reading_progress ADD CONSTRAINT reading_progress_kid_id_fkey
  FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE CASCADE;

ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_kid_id_fkey;
ALTER TABLE reactions ADD CONSTRAINT reactions_kid_id_fkey
  FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE CASCADE;

ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_kid_id_fkey;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_kid_id_fkey
  FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE CASCADE;

-- ================= ROW LEVEL SECURITY =================
-- Supabase automatically exposes every table in this schema through its
-- own public REST API (PostgREST), completely separately from our own
-- Vercel backend — unrelated to anything in lib/handler.js. Until RLS is
-- turned on for a table, ANYONE who has this project's URL can read,
-- edit, or delete every row in it through that API, bypassing our app's
-- login entirely. This app never uses that API (it always talks to
-- Postgres directly via DATABASE_URL, as the table owner), so turning
-- RLS on with zero policies is exactly right here: it locks that public
-- side door completely shut without affecting our app at all. Table
-- owners (which is what DATABASE_URL connects as) always bypass RLS in
-- Postgres by default — that's what keeps this safe to run.
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- ================= STICKER REWARDS =================
-- The sticker catalog itself (see scripts/stickers.js for the actual
-- emoji/name/rarity list — this table just holds whatever that file
-- seeds into it). "code" is the stable identifier scripts/seed-
-- stickers.js matches on, the same way "title" works for stories.
CREATE TABLE IF NOT EXISTS stickers (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  emoji TEXT NOT NULL,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'super_rare'))
);

-- Which stickers a kid has earned, and how many times (a kid can win the
-- same sticker again from a different story — count just goes up rather
-- than adding a duplicate row). One row per kid+sticker pair.
CREATE TABLE IF NOT EXISTS kid_stickers (
  id BIGSERIAL PRIMARY KEY,
  kid_id BIGINT NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  sticker_id BIGINT NOT NULL REFERENCES stickers(id),
  count INTEGER NOT NULL DEFAULT 1,
  first_earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kid_stickers_kid_sticker ON kid_stickers(kid_id, sticker_id);

ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kid_stickers ENABLE ROW LEVEL SECURITY;
