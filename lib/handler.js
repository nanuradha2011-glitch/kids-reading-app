// This is the same route logic that used to live directly in server.js,
// moved here so it can be reused by both the Vercel entry point
// (api/[...all].js) and any local dev tooling. The biggest structural
// change from the dev version: node:sqlite's db.prepare(...).get()/.run()
// were SYNCHRONOUS (they just blocked until done); pg's pool.query(...)
// is ASYNCHRONOUS (it returns a Promise), because it's talking to a
// database over the network now instead of reading a local file. That's
// why every route below is `await`-ing its queries.
const db = require('./db');
const { hashPassword, verifyPassword } = require('./auth');
const { createSession, getParentIdFromToken, destroySession } = require('./sessions');
const { sendJson, readJsonBody, parseCookies } = require('./http-helpers');

function getLoggedInParentId(req) {
  const cookies = parseCookies(req);
  return getParentIdFromToken(cookies.session) || null;
}

async function kidBelongsToParent(kidId, parentId) {
  const { rows } = await db.query('SELECT id FROM kids WHERE id = $1 AND parent_id = $2', [kidId, parentId]);
  return rows.length > 0;
}

const REACTION_TYPES = ['like', 'dislike', 'love', 'inspiring'];

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
      const inserted = await db.query(
        'INSERT INTO parents (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, passwordHash]
      );

      const token = createSession(inserted.rows[0].id);
      res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; SameSite=Lax; Secure`);
      return sendJson(res, 201, { email });
    }

    // --- Log in an existing parent ---
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const { email, password } = await readJsonBody(req);
      const { rows } = await db.query('SELECT * FROM parents WHERE email = $1', [email]);
      const parent = rows[0];

      if (!parent || !verifyPassword(password, parent.password_hash)) {
        return sendJson(res, 401, { error: 'Invalid email or password.' });
      }

      const token = createSession(parent.id);
      res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; SameSite=Lax; Secure`);
      return sendJson(res, 200, { email: parent.email });
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
      if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 17) {
        return sendJson(res, 400, { error: 'Please enter a valid age (1-17).' });
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

    // --- List stories/news for one kid, with per-kid read status ---
    const kidStoriesMatch = url.pathname.match(/^\/api\/kids\/(\d+)\/stories$/);
    if (req.method === 'GET' && kidStoriesMatch) {
      const parentId = getLoggedInParentId(req);
      if (!parentId) return sendJson(res, 401, { error: 'Not logged in.' });

      const kidId = Number(kidStoriesMatch[1]);
      if (!(await kidBelongsToParent(kidId, parentId))) {
        return sendJson(res, 403, { error: "That kid profile isn't on your account." });
      }

      const contentType = url.searchParams.get('type') === 'news' ? 'news' : 'story';
      const { rows } = await db.query(
        `SELECT s.id, s.title, s.category, s.read_minutes,
                CASE WHEN rp.id IS NOT NULL THEN 1 ELSE 0 END AS is_read
         FROM stories s
         LEFT JOIN reading_progress rp ON rp.story_id = s.id AND rp.kid_id = $1
         WHERE s.content_type = $2
         ORDER BY s.created_at`,
        [kidId, contentType]
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
      await db.query(
        `INSERT INTO reading_progress (kid_id, story_id) VALUES ($1, $2)
         ON CONFLICT (kid_id, story_id) DO UPDATE SET completed_at = NOW()`,
        [kidId, story_id]
      );
      return sendJson(res, 200, { ok: true });
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
      if (!(await kidBelongsToParent(kidId, parentId))) {
        return sendJson(res, 403, { error: "That kid profile isn't on your account." });
      }

      const totalAvailableRes = await db.query('SELECT COUNT(*) AS c FROM stories');
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
