// POST /api/upload?filename=cover.webp  → { url }
//
// Media uploads for the CMS. The raw image is streamed straight into Vercel Blob
// and the public URL comes back; the CMS then stores that URL against a slot id in
// the content document, which the portfolio applies to <img data-slot="…">.
//
// Requires a bearer token from POST /api/login — an open upload endpoint on a
// public URL would be an invitation.

const { put } = require('@vercel/blob');
const { verifyToken, bearer, applyCors } = require('./_content');

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        reject(Object.assign(new Error('Image is larger than 4MB'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'upload';

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!verifyToken(bearer(req))) {
    return res.status(401).json({ ok: false, error: 'Not signed in' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ ok: false, error: 'Media store is not configured' });
  }

  const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const ext = ALLOWED[contentType];
  if (!ext) {
    return res.status(415).json({
      ok: false,
      error: 'Unsupported image type — use PNG, JPEG, WebP, AVIF, GIF or SVG',
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ ok: false, error: err.message });
  }
  if (!body.length) return res.status(400).json({ ok: false, error: 'Empty upload' });

  // a random suffix keeps a re-upload under the same name from being cached as the old image
  const base = slug((req.query && req.query.filename) || 'upload').replace(/\.[a-z0-9]+$/, '');

  try {
    const blob = await put(`media/${base}.${ext}`, body, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return res.status(200).json({ ok: true, url: blob.url, pathname: blob.pathname });
  } catch (err) {
    console.error('[upload] failed:', err);
    return res.status(502).json({ ok: false, error: 'Upload failed' });
  }
};
