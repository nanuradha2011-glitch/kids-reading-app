// In the dev version of this app, sessions lived in an in-memory Map —
// fine on one long-running server process, but useless in production:
// Vercel runs your code as short-lived serverless functions, and there's
// no guarantee two requests (like "log in" and "check who's logged in")
// even hit the same running instance, let alone one that remembers a Map
// from five minutes ago.
//
// The fix is a SIGNED, STATELESS cookie: instead of the server
// remembering "token X belongs to parent 7", the cookie itself carries
// "parent 7, expires at time T" plus a cryptographic signature over that
// text. Anyone can read the cookie's contents, but only someone who
// knows SESSION_SECRET can produce a signature that verifies — so a kid
// (or anyone else) can't hand-edit the cookie to claim to be a different
// parent, because they can't forge a matching signature.
//
// Trade-off worth knowing: because nothing is stored server-side, there
// is no way to force-expire ONE token early (e.g. an instant "log out
// everywhere" button) short of rotating SESSION_SECRET, which would log
// EVERYONE out. That's an acceptable trade for an app this size; a
// larger app might keep a small "revoked tokens" table in the database
// for that case.
const crypto = require('node:crypto');

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET environment variable is not set. Generate one with ' +
        '`node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"` ' +
        'and set it in your environment (locally in .env, and in the Vercel project settings).'
    );
  }
  return secret;
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

// A token looks like "7.1799999999999.aBcD..." — parentId, expiry
// timestamp, and signature, joined with '.'. It's not encrypted (no
// secret data lives in a parent id or a timestamp), just tamper-proof.
function createSession(parentId) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
  const payload = `${parentId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function getParentIdFromToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [parentIdStr, expiresAtStr, signature] = parts;

  const expected = sign(`${parentIdStr}.${expiresAtStr}`);
  const givenBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  // Different-length buffers would make timingSafeEqual throw, so check
  // length first — and because length itself leaking isn't a meaningful
  // timing side-channel here (signatures are always a fixed length).
  if (givenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(givenBuf, expectedBuf)) {
    return null;
  }

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const parentId = Number(parentIdStr);
  return Number.isInteger(parentId) ? parentId : null;
}

// Nothing to delete server-side for a stateless token — logging out is
// handled entirely by server.js clearing the cookie in the response. This
// function stays so the rest of the app doesn't need to know that.
function destroySession() {}

module.exports = { createSession, getParentIdFromToken, destroySession };
