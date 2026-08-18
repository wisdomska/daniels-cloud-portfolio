// GET  /api/content  → public. The portfolio reads this on every load.
// PUT  /api/content  → requires a bearer token from POST /api/login. The CMS writes this.

const { readContent, writeContent, verifyToken, bearer, applyCors } = require('./_content');

module.exports = async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    try {
      const { content, source, updatedAt } = await readContent();

      // Drafts are not public. The front end hid them, but the payload still carried
      // every unpublished post — title, body and all — to anyone who asked for it.
      // A signed-in CMS session gets the whole document; nobody else does.
      const signedIn = verifyToken(bearer(req));
      let out = content;
      if (!signedIn && out && out.blog && Array.isArray(out.blog.posts)) {
        out = { ...out, blog: { ...out.blog, posts: out.blog.posts.filter((p) => p && p.published !== false) } };
      }
      // the CMS dashboard reports when the site was last published
      if (updatedAt && out) out = { ...out, updatedAt };

      // never cache: an edit in the CMS must show on the next portfolio load
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
      return res.status(200).json({ ok: true, content: out, source, updatedAt });
    } catch (err) {
      console.error('[content] read failed:', err);
      return res.status(500).json({ ok: false, error: 'Could not read content' });
    }
  }

  if (req.method === 'PUT') {
    if (!verifyToken(bearer(req))) {
      return res.status(401).json({ ok: false, error: 'Not signed in' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = null; }
    }
    const content = body && (body.content || body);
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      return res.status(400).json({ ok: false, error: 'Expected a content object' });
    }
    if (JSON.stringify(content).length > 512 * 1024) {
      return res.status(413).json({ ok: false, error: 'Content document is too large' });
    }

    try {
      const doc = await writeContent(content);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, updatedAt: doc.updatedAt, content: doc.content });
    } catch (err) {
      console.error('[content] write failed:', err);
      return res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'Could not save content' });
    }
  }

  res.setHeader('Allow', 'GET, PUT, OPTIONS');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
