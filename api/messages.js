// GET   /api/messages        → { messages }  (CMS inbox; requires a bearer token)
// PATCH /api/messages        → { id, read }  mark one read/unread
// DELETE /api/messages?id=…  → remove one

const { verifyToken, bearer, applyCors } = require('./_content');
const { readMessages, writeMessages } = require('./_messages');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // the inbox is private — every method needs the CMS token
  if (!verifyToken(bearer(req))) {
    return res.status(401).json({ ok: false, error: 'Not signed in' });
  }

  try {
    if (req.method === 'GET') {
      const messages = await readMessages();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        ok: true,
        messages,
        unread: messages.filter((m) => !m.read).length,
      });
    }

    if (req.method === 'PATCH') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = null; }
      }
      const id = body && body.id;
      if (!id) return res.status(400).json({ ok: false, error: 'Expected a message id' });

      const messages = await readMessages();
      const found = messages.find((m) => m.id === id);
      if (!found) return res.status(404).json({ ok: false, error: 'No such message' });
      found.read = body.read !== false;
      await writeMessages(messages);
      return res.status(200).json({ ok: true, messages });
    }

    if (req.method === 'DELETE') {
      const id = req.query && req.query.id;
      if (!id) return res.status(400).json({ ok: false, error: 'Expected a message id' });

      const messages = await readMessages();
      const kept = messages.filter((m) => m.id !== id);
      if (kept.length === messages.length) {
        return res.status(404).json({ ok: false, error: 'No such message' });
      }
      await writeMessages(kept);
      return res.status(200).json({ ok: true, messages: kept });
    }
  } catch (err) {
    console.error('[messages] failed:', err);
    return res.status(500).json({ ok: false, error: 'Could not reach the message store' });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE, OPTIONS');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
