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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  content_type TEXT NOT NULL DEFAULT 'story', -- 'story' or 'news' — which tab it shows in
  read_minutes INTEGER NOT NULL DEFAULT 5,
  quiz JSONB NOT NULL DEFAULT '[]',
  vocabulary JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
