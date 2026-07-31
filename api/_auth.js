// Where the CMS password actually lives.
//
// CMS_PASSWORD is only the bootstrap: it applies until a password is set from the
// dashboard, after which the stored credential wins. That's what makes "change
// password" possible without touching env vars and redeploying.
//
// Only a scrypt hash is ever stored — never the password itself. Deleting the
// stored credential falls back to CMS_PASSWORD, which is the recovery path if the
// password is ever forgotten.

const crypto = require('crypto');
const { put, list, del } = require('@vercel/blob');

const PREFIX = 'auth/';
const KEEP_VERSIONS = 3;

// scrypt parameters — deliberately slow enough to make guessing expensive.
const KEYLEN = 64;
const COST = { N: 16384, r: 8, p: 1 };

const token = () => process.env.BLOB_READ_WRITE_TOKEN;

const versionKey = () =>
  `${PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto
    .randomBytes(3)
    .toString('hex')}.json`;

const newestFirst = (blobs) =>
  blobs.slice().sort((a, b) => (a.pathname < b.pathname ? 1 : a.pathname > b.pathname ? -1 : 0));

function hash(password, salt) {
  return crypto.scryptSync(password, salt, KEYLEN, COST).toString('hex');
}

const equal = (a, b) => {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  // hash first so a length difference can't throw or leak via timingSafeEqual
  const ha = crypto.createHash('sha256').update(ba).digest();
  const hb = crypto.createHash('sha256').update(bb).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// Same new-key-per-write approach as the content store: overwriting one key in Blob
// is eventually consistent, and a stale read here would accept a retired password.
async function readCredential() {
  if (!token()) return null;
  try {
    const { blobs } = await list({ prefix: PREFIX, token: token() });
    if (!blobs.length) return null;
    const res = await fetch(newestFirst(blobs)[0].url, { cache: 'no-store' });
    if (!res.ok) throw new Error('blob fetch ' + res.status);
    const stored = await res.json();
    return stored && stored.hash && stored.salt ? stored : null;
  } catch (err) {
    const name = (err && (err.name || (err.constructor && err.constructor.name))) || '';
    if (/BlobNotFound/i.test(name)) return null;
    console.error('[auth] could not read the stored credential:', err);
    return null;
  }
}

async function writeCredential(password) {
  if (!token()) {
    const e = new Error('Credential store is not configured');
    e.statusCode = 503;
    throw e;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const doc = {
    algo: 'scrypt',
    keylen: KEYLEN,
    cost: COST,
    salt,
    hash: hash(password, salt),
    updatedAt: new Date().toISOString(),
  };
  await put(versionKey(), JSON.stringify(doc, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
    token: token(),
  });
  await prune();
  return { updatedAt: doc.updatedAt };
}

async function prune() {
  try {
    const { blobs } = await list({ prefix: PREFIX, token: token() });
    const stale = newestFirst(blobs).slice(KEEP_VERSIONS);
    if (stale.length) await del(stale.map((b) => b.url), { token: token() });
  } catch (err) {
    console.error('[auth] could not prune old credentials:', err);
  }
}

// True if `password` is the current one — the stored credential if there is one,
// otherwise the CMS_PASSWORD bootstrap.
async function verifyPassword(password) {
  if (typeof password !== 'string' || !password) return false;

  const stored = await readCredential();
  if (stored) return equal(hash(password, stored.salt), stored.hash);

  const bootstrap = process.env.CMS_PASSWORD;
  return bootstrap ? equal(password, bootstrap) : false;
}

// Has a password been set from the dashboard yet?
async function isCustomSet() {
  return !!(await readCredential());
}

function isConfigured() {
  return !!(process.env.CMS_PASSWORD || token());
}

module.exports = { verifyPassword, writeCredential, isCustomSet, isConfigured };
