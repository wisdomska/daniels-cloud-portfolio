// POST /api/login  { password } → { token }
//
// The CMS is a public URL, so writes must be gated. The password comes from the
// store if one has been set from the dashboard, otherwise from the CMS_PASSWORD
// env var (see _auth.js). The token returned is an HMAC of its own expiry, so no
// session state is stored anywhere.

const { issueToken, verifyToken, bearer, applyCors } = require('./_content');
const { verifyPassword, isConfigured } = require('./_auth');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // lets the CMS check whether a stored token is still valid on reload
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, valid: verifyToken(bearer(req)) });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isConfigured()) {
    return res.status(503).json({ ok: false, error: 'CMS_PASSWORD is not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const password = body && typeof body.password === 'string' ? body.password : '';
  if (!(await verifyPassword(password))) {
    return res.status(401).json({ ok: false, error: 'Incorrect password' });
  }

  return res.status(200).json({ ok: true, token: issueToken() });
};
