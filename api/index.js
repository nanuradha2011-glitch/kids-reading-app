// All our API routes live behind this single function. Rather than
// relying on Vercel's bracket-filename convention (api/[...all].js) to
// automatically catch every /api/* request — which turned out not to
// route multi-segment paths like /api/kids/2/stories the way we needed —
// vercel.json now explicitly rewrites every /api/* request to this exact
// function. That's a more explicit, guaranteed way to say "send
// everything under /api/ here," instead of hoping a filename convention
// is interpreted the way we expect.
const { handleApiRequest } = require('../lib/handler');

module.exports = async (req, res) => {
  await handleApiRequest(req, res);
};
