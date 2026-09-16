// This is the same route logic that used to live directly in server.js,
// moved here so it can be reused by both the Vercel entry point
// (api/[...all].js) and any local dev tooling. The biggest structural
// change from the dev version: node:sqlite's db.prepare(...).get()/.run()
// were SYNCHRONOUS (they just blocked until done); pg's pool.query(...)
// is ASYNCHRONOUS (it returns a Promise), because it's talking to a
// database over the network now instead of reading a local file. That's
// why every route below is `await`-ing its queries.
const crypto = require('node:crypto');
const db = require('./db');
const { hashPassword, verifyPassword } = require('./auth');
const { createSession, getParentIdFromToken, destroySession } = require('./sessions');
const { sendJson, readJsonBody, parseCookies } = require('./http-helpers');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./email');
const { pickRandomSticker } = require('./stickers');

// A long random string that's practically impossible to guess — used for
// both the "confirm your email" link and the "reset your password" link.
// 32 bytes -> 64 hex characters.
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getLoggedInParentId(req) {
  const cookies = parseCookies(req);
  return getParentIdFromToken(cookies.session) || null;
}

// Returns the kid's row (so callers who also need its age don't have to
// make a second query), or null if this kid doesn't exist or belongs to
// a different parent.
async function getOwnedKid(kidId, parentId) {
  const { rows } = await db.query(
    'SELECT id, name, age FROM kids WHERE id = $1 AND parent_id = $2',
    [kidId, parentId]
  );
  return rows[0] || null;
}

async function kidBelongsToParent(kidId, parentId) {
  return !!(await getOwnedKid(kidId, parentId));
}

const REACTION_TYPES = ['like', 'dislike', 'love', 'inspiring'];
const CONTENT_TYPES = ['story', 'news', 'fact'];

// Turns a kid's age into which shelf of content they see. Three bands
// rather than an exact per-age match, so we're not writing 8 versions of
// every story — each story/fact is tagged with the ONE band it best
// suits, and a kid sees everything tagged for their band.
function ageToBand(age) {
  if (age <= 5) return 'little_ones';
  if (age <= 8) return 'explorers';
  return 'big_kids';
}

async function handleApiRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    // --- Sign up a new parent account ---
    if (req.method === 'POST' && url.pathname === '/api/signup') {
      const { email, password } = await readJsonBody(req);

      if (!email || !password || password.length < 8) {
        return sendJson(res, 400, { error: 'Email and a password of at least 8 characters are required.' });
      }

      const existing = await db.query('SELECT id FROM parents WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return sendJson(res, 409, { error: 'An account with that email already exists.' });
      }

      const passwordHash = hashPassword(password);
      const verifyToken = generateToken();
      const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.query(
        `INSERT INTO parents (email, password_hash, verify_token, verify_token_expires)
         VALUES ($1, $2, $3, $4)`,
        [email, passwordHash, verifyToken, verifyExpires]
      );

      // A parent can't log in until they click the confirmation link we
      // just emailed them, so — unlike before — signup does NOT create a
      // session here. If the email fails to send (bad/missing API key,
      // Resend having a bad moment) we still let the account exist rather
      // than losing the signup entirely; resend-verification covers them.
      try {
        await sendVerificationEmail(email, verifyToken);
      } catch (err) {
        console.error('Failed to send verification email:', err);
      }
      return sendJson(res, 201, { email, needsVerification: true });
    }

    // --- Log in an existing parent ---
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const { email, password } = await readJsonBody(req);
      const { rows } = await db.query('SELECT * FROM parents WHERE email = $1', [email]);
      const parent = rows[0];

      if (!parent || !verifyPassword(password, parent.password_hash)) {
        return sendJson(res, 401, { error: 'Invalid email or password.' });
      }

      if (!parent.email_verified) {
        return sendJson(res, 403, {
          error: 'Please confirm your email before logging in — check your inbox for the confirmation link.',
          needsVerification: true,
        });
      }

      const token = createSession(parent.id);
      res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; SameSite=Lax; Secure`);
      return sendJson(res, 200, { email: parent.email });
    }

    // --- Confirm an email address from the link we sent at signup ---
    if (req.method === 'GET' && url.pathname === '/api/verify-email') {
      const token = url.searchParams.get('token');
      if (!token) return sendJson(res, 400, { error: 'Missing confirmation token.' });

      const { rows } = await db.query(
        'SELECT id, verify_token_expires FROM parents WHERE verify_token = $1',
        [token]
      );
      const parent = rows[0];
      if (!parent) {
        return sendJson(res, 400, { error: 'This confirmation link is invalid or has already been used.' });
      }
      if (new Date(parent.verify_token_expires) < new Date()) {
        return sendJson(res, 400, { error: 'This confirmation link has expired. Please request a new one below.' });
      }

      await db.query(
        'UPDATE parents SET email_verified = TRUE, verify_token = NULL, verify_token_expires = NULL WHERE id = $1',
        [parent.id]
      );
      return sendJson(res, 200, { ok: true });
    }

    // --- Send a fresh confirmation email (e.g. the first one expired or got lost) ---
    if (req.method === 'POST' && url.pathname === '/api/resend-verification') {
      const { email } = await readJsonBody(req);
      const { rows } = await db.query('SELECT id, email_verified FROM parents WHERE email = $1', [email]);
      const parent = rows[0];

      // Always the same response whether or not this matched a real,
      // still-unverified account — otherwise this endpoint could be used
      // to check which emails have an account (or are already verified).
      if (parent && !parent.email_verified) {
        const verifyToken = generateToken();
        const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.query(
          'UPDATE parents SET verify_token = $1, verify_token_expires = $2 WHERE id = $3',
          [verifyToken, verifyExpires, parent.id]
        );
        try {
          await sendVerificationEmail(email, verifyToken);
        } catch (err) {
          console.error('Failed to resend verification email:', err);
        }
      }
      return sendJson(res, 200, { ok: true });
    }

    // --- Request a password reset link ---
    if (req.method === 'POST' && url.pathname === '/api/forgot-password') {
      const { email } = await readJsonBody(req);
      const { rows } = await db.query('SELECT id FROM parents WHERE email = $1', [email]);
      const parent = rows[0];

      // Same response either way — this endpoint must not reveal whether
      // an account exists for a given email address.
      if (parent) {
        const resetToken = generateToken();
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await db.query(
          'UPDATE parents SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
          [resetToken, resetExpires, parent.id]
        );
        try {
          await sendPasswordResetEmail(email, resetToken);
        } catch (err) {
          console.error('Failed to send password reset email:', err);
        }
      }
      return sendJson(res, 200, { ok: true });
    }

    // --- Actually set a new password, from the link in that email ---
    if (req.method === 'POST' && url.pathname === '/api/reset-password') {
      const { token, password } = await readJsonBody(req);
      if (!password || password.length < 8) {
        return sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
      }

      const { rows } = await db.query(
        'SELECT id, reset_token_expires FROM parents WHERE reset_token = $1',
        [token]
      );
      const parent = rows[0];
      if (!parent) {
        return sendJson(res, 400, { error: 'This reset link is invalid or has already been used.' });
      }
      if (new Date(parent.reset_token_expires) < new Date()) {
        return sendJson(res, 400, { error: 'This reset link has expired. Please request a new one.' });
      }

      const passwordHash = hashPassword(password);
      await db.query(
        'UPDATE parents SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
        [passwordHash, parent.id]
      );
      return sendJson(res, 200, { ok: true });
    }

    // --- Change password (while logged in, from Profile Settings) ---
    if (req.method === 'POST' && url.pathname === '/api/change-password') {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const { currentPassword, newPassword } = await readJsonBody(req);
      if (!newPassword || newPassword.length < 8) {
        return sendJson(res, 400, { error: 'New password must be at least 8 characters.' });
      }

      const { rows } = await db.query('SELECT password_hash FROM parents WHERE id = $1', [parentId]);
      const parent = rows[0];
      if (!parent || !verifyPassword(currentPassword || '', parent.password_hash)) {
        return sendJson(res, 401, { error: 'Current password is incorrect.' });
      }

      const passwordHash = hashPassword(newPassword);
      await db.query('UPDATE parents SET password_hash = $1 WHERE id = $2', [passwordHash, parentId]);
      return sendJson(res, 200, { ok: true });
    }

    // --- Who am I? ---
    if (req.method === 'GET' && url.pathname === '/api/me') {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });
      const { rows } = await db.query('SELECT id, email, created_at FROM parents WHERE id = $1', [parentId]);
      if (!rows[0]) return sendJson(res, 401, { error: 'Not logged in.' });
      return sendJson(res, 200, rows[0]);
    }

    // --- Log out ---
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      const cookies = parseCookies(req);
      if (cookies.session) destroySession(cookies.session);
      res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      return sendJson(res, 200, { ok: true });
    }

    // --- Add a kid profile ---
    if (req.method === 'POST' && url.pathname === '/api/kids') {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const { name, age } = await readJsonBody(req);
      const ageNum = Number(age);
      if (!name || !name.trim()) return sendJson(res, 400, { error: "Please enter the kid's name." });
      if (!Number.isInteger(ageNum) || ageNum < 3 || ageNum > 10) {
        return sendJson(res, 400, { error: 'Please enter a valid age (3-10).' });
      }

      const inserted = await db.query(
        'INSERT INTO kids (parent_id, name, age) VALUES ($1, $2, $3) RETURNING id, name, age',
        [parentId, name.trim(), ageNum]
      );
      return sendJson(res, 201, inserted.rows[0]);
    }

    // --- List this parent's kid profiles ---
    if (req.method === 'GET' && url.pathname === '/api/kids') {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const { rows } = await db.query(
        'SELECT id, name, age FROM kids WHERE parent_id = $1 ORDER BY created_at',
        [parentId]
      );
      return sendJson(res, 200, rows);
    }

    // --- Delete a kid profile (their reading history goes with them —
    // ON DELETE CASCADE on reading_progress/reactions/quiz_attempts
    // handles that at the database level, see schema.sql) ---
    const deleteKidMatch = url.pathname.match(/^\/api\/kids\/(\d+)$/);
    if (req.method === 'DELETE' && deleteKidMatch) {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const kidId = Number(deleteKidMatch[1]);
      if (!(await kidBelongsToParent(kidId, parentId))) {
        return sendJson(res, 403, { error: "That kid profile isn't on your account." });
      }

      await db.query('DELETE FROM kids WHERE id = $1', [kidId]);
      return sendJson(res, 200, { ok: true });
    }

    // --- List stories/news/facts for one kid, with per-kid read status ---
    const kidStoriesMatch = url.pathname.match(/^\/api\/kids\/(\d+)\/stories$/);
    if (req.method === 'GET' && kidStoriesMatch) {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const kidId = Number(kidStoriesMatch[1]);
      const kid = await getOwnedKid(kidId, parentId);
      if (!kid) return sendJson(res, 403, { error: "That kid profile isn't on your account." });

      const requestedType = url.searchParams.get('type');
      const contentType = CONTENT_TYPES.includes(requestedType) ? requestedType : 'story';
      const ageBand = ageToBand(kid.age);

      // Only show content tagged for this kid's age band — a 4-year-old
      // and a 9-year-old looking at the same "Stories" tab see different
      // shelves of stories, matched to what they can actually read.
      const { rows } = await db.query(
        `SELECT s.id, s.title, s.category, s.read_minutes,
                CASE WHEN rp.id IS NOT NULL THEN 1 ELSE 0 END AS is_read
         FROM stories s
         LEFT JOIN reading_progress rp ON rp.story_id = s.id AND rp.kid_id = $1
         WHERE s.content_type = $2 AND s.age_band = $3
         ORDER BY s.created_at`,
        [kidId, contentType, ageBand]
      );
      return sendJson(res, 200, rows);
    }

    // --- Get one story's full text ---
    const storyDetailMatch = url.pathname.match(/^\/api\/stories\/(\d+)$/);
    if (req.method === 'GET' && storyDetailMatch) {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const { rows } = await db.query('SELECT * FROM stories WHERE id = $1', [Number(storyDetailMatch[1])]);
      const story = rows[0];
      if (!story) return sendJson(res, 404, { error: 'Story not found.' });

      // quiz/vocabulary are JSONB columns now, so pg already hands them
      // back as real arrays — no JSON.parse needed (unlike the SQLite
      // version, which stored them as plain TEXT).

      // Stories are shared content, but a reaction belongs to one
      // family — only ever look one up for a kid that belongs to the
      // requesting parent.
      const kidId = Number(url.searchParams.get('kid_id'));
      if (kidId && (await kidBelongsToParent(kidId, parentId))) {
        const reactionRes = await db.query(
          'SELECT reaction_type FROM reactions WHERE kid_id = $1 AND story_id = $2',
          [kidId, story.id]
        );
        story.my_reaction = reactionRes.rows[0] ? reactionRes.rows[0].reaction_type : null;
      }
      return sendJson(res, 200, story);
    }

    // --- Mark a story as read by a kid ---
    const progressMatch = url.pathname.match(/^\/api\/kids\/(\d+)\/progress$/);
    if (req.method === 'POST' && progressMatch) {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const kidId = Number(progressMatch[1]);
      if (!(await kidBelongsToParent(kidId, parentId))) {
        return sendJson(res, 403, { error: "That kid profile isn't on your account." });
      }

      const { story_id } = await readJsonBody(req);
      // "xmax = 0" is a Postgres trick for telling an INSERT from an
      // UPDATE inside the same "ON CONFLICT DO UPDATE" statement: it's
      // true only for a row that was just freshly inserted, not one that
      // already existed and got its completed_at touched. We still want
      // completed_at to update every time (so re-reading an old story
      // counts as today's activity on the parent's progress view), but a
      // sticker should only be awarded the FIRST time this kid finishes
      // this particular story/news/fact — otherwise re-opening the same
      // one over and over would be an easy way to farm stickers.
      const { rows: progressRows } = await db.query(
        `INSERT INTO reading_progress (kid_id, story_id) VALUES ($1, $2)
         ON CONFLICT (kid_id, story_id) DO UPDATE SET completed_at = NOW()
         RETURNING (xmax = 0) AS is_new`,
        [kidId, story_id]
      );
      const isFirstCompletion = progressRows[0].is_new;

      let sticker = null;
      let stickerCount = null;
      if (isFirstCompletion) {
        const { rows: catalog } = await db.query('SELECT id, code, emoji, name, rarity FROM stickers');
        const picked = pickRandomSticker(catalog);
        if (picked) {
          const { rows: awarded } = await db.query(
            `INSERT INTO kid_stickers (kid_id, sticker_id) VALUES ($1, $2)
             ON CONFLICT (kid_id, sticker_id)
               DO UPDATE SET count = kid_stickers.count + 1, last_earned_at = NOW()
             RETURNING count`,
            [kidId, picked.id]
          );
          sticker = { code: picked.code, emoji: picked.emoji, name: picked.name, rarity: picked.rarity };
          stickerCount = awarded[0].count;
        }
      }

      return sendJson(res, 200, { ok: true, sticker, sticker_count: stickerCount });
    }

    // --- A kid's sticker album: the full catalog, plus which ones (and
    // how many of each) this kid has actually earned so far ---
    const stickersMatch = url.pathname.match(/^\/api\/kids\/(\d+)\/stickers$/);
    if (req.method === 'GET' && stickersMatch) {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const kidId = Number(stickersMatch[1]);
      if (!(await kidBelongsToParent(kidId, parentId))) {
        return sendJson(res, 403, { error: "That kid profile isn't on your account." });
      }

      const { rows } = await db.query(
        `SELECT s.code, s.emoji, s.name, s.rarity,
                COALESCE(ks.count, 0) AS count
         FROM stickers s
         LEFT JOIN kid_stickers ks ON ks.sticker_id = s.id AND ks.kid_id = $1
         ORDER BY
           CASE s.rarity WHEN 'common' THEN 0 WHEN 'rare' THEN 1 ELSE 2 END,
           s.name`,
        [kidId]
      );
      return sendJson(res, 200, rows);
    }

    // --- Set (or change) a kid's reaction to a story ---
    const reactMatch = url.pathname.match(/^\/api\/kids\/(\d+)\/reactions$/);
    if (req.method === 'POST' && reactMatch) {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const kidId = Number(reactMatch[1]);
      if (!(await kidBelongsToParent(kidId, parentId))) {
        return sendJson(res, 403, { error: "That kid profile isn't on your account." });
      }

      const { story_id, reaction_type } = await readJsonBody(req);
      if (!REACTION_TYPES.includes(reaction_type)) {
        return sendJson(res, 400, { error: 'Not a valid reaction.' });
      }

      await db.query(
        `INSERT INTO reactions (kid_id, story_id, reaction_type) VALUES ($1, $2, $3)
         ON CONFLICT (kid_id, story_id) DO UPDATE SET reaction_type = excluded.reaction_type, created_at = NOW()`,
        [kidId, story_id, reaction_type]
      );
      return sendJson(res, 200, { reaction_type });
    }

    // --- Save a kid's quiz score for a story ---
    const quizAttemptMatch = url.pathname.match(/^\/api\/kids\/(\d+)\/quiz-attempts$/);
    if (req.method === 'POST' && quizAttemptMatch) {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const kidId = Number(quizAttemptMatch[1]);
      if (!(await kidBelongsToParent(kidId, parentId))) {
        return sendJson(res, 403, { error: "That kid profile isn't on your account." });
      }

      const { story_id, score, total } = await readJsonBody(req);
      if (!Number.isInteger(score) || !Number.isInteger(total) || score < 0 || score > total) {
        return sendJson(res, 400, { error: 'Invalid quiz score.' });
      }

      await db.query(
        `INSERT INTO quiz_attempts (kid_id, story_id, score, total) VALUES ($1, $2, $3, $4)
         ON CONFLICT (kid_id, story_id) DO UPDATE SET score = excluded.score, total = excluded.total, created_at = NOW()`,
        [kidId, story_id, score, total]
      );
      return sendJson(res, 200, { ok: true });
    }

    // --- Parent-facing progress summary for one kid ---
    const summaryMatch = url.pathname.match(/^\/api\/kids\/(\d+)\/summary$/);
    if (req.method === 'GET' && summaryMatch) {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const kidId = Number(summaryMatch[1]);
      const kid = await getOwnedKid(kidId, parentId);
      if (!kid) return sendJson(res, 403, { error: "That kid profile isn't on your account." });

      // "out of how many" should mean how many are actually on this
      // kid's shelf (their age band), not the total across every band.
      const totalAvailableRes = await db.query(
        'SELECT COUNT(*) AS c FROM stories WHERE age_band = $1',
        [ageToBand(kid.age)]
      );
      const totalReadRes = await db.query('SELECT COUNT(*) AS c FROM reading_progress WHERE kid_id = $1', [kidId]);

      const quizAttemptsRes = await db.query(
        `SELECT s.title, qa.score, qa.total
         FROM quiz_attempts qa JOIN stories s ON s.id = qa.story_id
         WHERE qa.kid_id = $1`,
        [kidId]
      );

      const reactionCountsRes = await db.query(
        'SELECT reaction_type, COUNT(*) AS c FROM reactions WHERE kid_id = $1 GROUP BY reaction_type',
        [kidId]
      );

      const recentActivityRes = await db.query(
        `SELECT s.title, s.category, s.content_type, rp.completed_at,
                r.reaction_type, qa.score, qa.total
         FROM reading_progress rp
         JOIN stories s ON s.id = rp.story_id
         LEFT JOIN reactions r ON r.story_id = s.id AND r.kid_id = rp.kid_id
         LEFT JOIN quiz_attempts qa ON qa.story_id = s.id AND qa.kid_id = rp.kid_id
         WHERE rp.kid_id = $1
         ORDER BY rp.completed_at DESC
         LIMIT 8`,
        [kidId]
      );

      // date(completed_at) in SQLite becomes completed_at::date here —
      // both truncate a timestamp down to just its calendar day so
      // multiple reads on the same day collapse to one entry.
      const readDatesRes = await db.query(
        `SELECT DISTINCT completed_at::date AS d FROM reading_progress WHERE kid_id = $1 ORDER BY d DESC`,
        [kidId]
      );
      const readDates = readDatesRes.rows.map((r) => r.d);

      let streak = 0;
      if (readDates.length) {
        streak = 1;
        for (let i = 1; i < readDates.length; i++) {
          const diffDays = Math.round((new Date(readDates[i - 1]) - new Date(readDates[i])) / 86400000);
          if (diffDays === 1) streak++;
          else break;
        }
      }

      // COUNT(*) comes back as a string from pg (Postgres BIGINT doesn't
      // fit safely in a JS number, so the driver plays it safe) — Number()
      // it here so the frontend gets a real number like the old SQLite
      // version always returned.
      return sendJson(res, 200, {
        totalRead: Number(totalReadRes.rows[0].c),
        totalAvailable: Number(totalAvailableRes.rows[0].c),
        streak,
        lastReadDate: readDates[0] || null,
        quizAttempts: quizAttemptsRes.rows,
        reactionCounts: reactionCountsRes.rows.map((r) => ({ ...r, c: Number(r.c) })),
        recentActivity: recentActivityRes.rows,
      });
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Something went wrong on our end.' });
  }
}

module.exports = { handleApiRequest };
