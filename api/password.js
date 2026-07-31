// POST /api/password  { currentPassword, newPassword } → { ok, token }
//
// Changing the password requires the CURRENT password as well as a valid session.
// A stolen token alone must not be enough to lock the owner out of their own CMS.
//
// GET /api/password → { custom } — whether a password has been set from the
// dashboard yet, so the settings pane can say where the current one comes from.

const { verifyPassword, writeCredential, isCustomSet } = require('./_auth');
const { issueToken, verifyToken, bearer, applyCors } = require('./_content');

const MIN_LENGTH = 8;

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!verifyToken(bearer(req))) {
    return res.status(401).json({ ok: false, error: 'Not signed in' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, custom: await isCustomSet() });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid request body' });
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!(await verifyPassword(currentPassword))) {
    return res.status(401).json({ ok: false, error: 'Current password is incorrect' });
  }

  if (newPassword.length < MIN_LENGTH) {
    return res.status(400).json({
      ok: false,
      error: `New password must be at least ${MIN_LENGTH} characters`,
    });
  }
  if (newPassword.length > 200) {
    return res.status(400).json({ ok: false, error: 'New password is too long' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ ok: false, error: 'That is already your password' });
  }

  try {
    const { updatedAt } = await writeCredential(newPassword);
    // hand back a fresh token so the open session stays signed in
    return res.status(200).json({ ok: true, updatedAt, token: issueToken() });
  } catch (err) {
    console.error('[password] could not store the new password:', err);
    return res.status(err.statusCode || 500).json({ ok: false, error: 'Could not save the new password' });
  }
};
