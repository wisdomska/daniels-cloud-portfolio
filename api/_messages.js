// Contact submissions, stored separately from the content document.
//
// Deliberately its own blob: the CMS PUTs the whole content document on save, so
// if messages lived inside it, one save with a stale copy would wipe the inbox.
//
// Like the content document, each write is a NEW key rather than an overwrite —
// overwriting a fixed key in Blob is eventually consistent, and a stale read here
// would drop or resurrect messages on the next read-modify-write.

const { put, head, list, del } = require('@vercel/blob');
const crypto = require('crypto');

const LEGACY_PATH = 'messages.json';
const PREFIX = 'messages/';
const KEEP_VERSIONS = 5;
const MAX_STORED = 200;

const token = () => process.env.BLOB_READ_WRITE_TOKEN;

const versionKey = () =>
  `${PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto
    .randomBytes(3)
    .toString('hex')}.json`;

const newestFirst = (blobs) =>
  blobs.slice().sort((a, b) => (a.pathname < b.pathname ? 1 : a.pathname > b.pathname ? -1 : 0));

const asList = (stored) =>
  Array.isArray(stored) ? stored : Array.isArray(stored && stored.messages) ? stored.messages : [];

async function readMessages() {
  if (!token()) return [];
  try {
    const { blobs } = await list({ prefix: PREFIX, token: token() });
    if (blobs.length) {
      const res = await fetch(newestFirst(blobs)[0].url, { cache: 'no-store' });
      if (!res.ok) throw new Error('blob fetch ' + res.status);
      return asList(await res.json());
    }

    // nothing versioned yet — carry over the original single-key inbox
    const meta = await head(LEGACY_PATH, { token: token() });
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) throw new Error('blob fetch ' + res.status);
    return asList(await res.json());
  } catch (err) {
    const name = (err && (err.name || (err.constructor && err.constructor.name))) || '';
    const msg = (err && err.message) || '';
    if (/BlobNotFound/i.test(name) || /does not exist|not found/i.test(msg)) return [];
    throw err;
  }
}

async function writeMessages(messages) {
  if (!token()) return;
  await put(versionKey(), JSON.stringify({ messages }, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 31536000,
    token: token(),
  });
  await prune();
}

async function prune() {
  try {
    const { blobs } = await list({ prefix: PREFIX, token: token() });
    const stale = newestFirst(blobs).slice(KEEP_VERSIONS);
    if (stale.length) await del(stale.map((b) => b.url), { token: token() });
  } catch (err) {
    console.error('[messages] could not prune old versions:', err);
  }
}

// Newest first, capped so the store can't grow without bound.
async function appendMessage(message) {
  const messages = await readMessages();
  messages.unshift(message);
  await writeMessages(messages.slice(0, MAX_STORED));
  return message;
}

module.exports = { readMessages, writeMessages, appendMessage };
