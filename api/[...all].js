// Vercel convention: a file named [...all].js inside /api catches every
// request under /api/* and hands it to this one function — that's why
// all our routes (which already start with "/api/...") can move here
// almost unchanged from the old server.js. All the actual route logic
// lives in ../lib/handler.js so it stays easy to read.
const { handleApiRequest } = require('../lib/handler');

module.exports = async (req, res) => {
  await handleApiRequest(req, res);
};
