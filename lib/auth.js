// Password hashing. We never store a password itself — only a salted
// hash of it — so that even a full database leak doesn't expose real
// passwords.
const crypto = require('node:crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  // We store salt and hash together (separated by ':') so verification
  // later knows which salt was used for this particular password.
  return `${salt}:${derivedKey.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  const [salt, keyHex] = storedHash.split(':');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  const storedKey = Buffer.from(keyHex, 'hex');
  // timingSafeEqual compares bytes in constant time, regardless of how
  // many characters match. A normal === comparison can leak, via tiny
  // timing differences, how many leading characters were correct —
  // this closes that door.
  return crypto.timingSafeEqual(derivedKey, storedKey);
}

module.exports = { hashPassword, verifyPassword };
