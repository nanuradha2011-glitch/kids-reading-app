// Small utilities for working with raw Node http requests/responses —
// the bits a framework like Express would normally hide from you.

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(body);
}

// Requests arrive as a stream of chunks, not one neat string — we have
// to collect the whole body ourselves before we can JSON.parse it.
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// The browser sends all cookies in one header like "a=1; b=2" — this
// splits that into a usable object: { a: '1', b: '2' }.
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const pair of header.split(';')) {
    if (!pair.trim()) continue;
    const [key, ...rest] = pair.trim().split('=');
    out[key] = decodeURIComponent(rest.join('='));
  }
  return out;
}

module.exports = { sendJson, readJsonBody, parseCookies };
