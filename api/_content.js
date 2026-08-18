// Shared content layer for the portfolio + CMS.
//
// The content document is a single JSON blob in Vercel Blob storage. The portfolio
// reads it through GET /api/content; the CMS writes it through PUT /api/content.
// Defaults below are the source of truth for shape — anything missing from the
// stored document falls back to them, so the portfolio always renders.

const { put, head, list, del } = require('@vercel/blob');
const crypto = require('crypto');

// Legacy single-key location, still read if no versioned document exists yet.
const BLOB_PATH = 'content.json';

// Each save is written as a NEW object under this prefix rather than overwriting
// one key. Overwriting is eventually consistent in Blob — both the CDN body and
// head()'s metadata can lag — so a portfolio load right after publishing could
// read the previous document. A fresh key per save is immediately consistent and
// its URL has never been cached, which is what makes an edit show up at once.
// It also leaves the last few versions in place as history.
const CONTENT_PREFIX = 'content/';
const KEEP_VERSIONS = 10;

const versionKey = () =>
  `${CONTENT_PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto
    .randomBytes(3)
    .toString('hex')}.json`;

// ISO timestamps sort lexicographically, so the greatest pathname is the newest.
const newestFirst = (blobs) =>
  blobs.slice().sort((a, b) => (a.pathname < b.pathname ? 1 : a.pathname > b.pathname ? -1 : 0));

const DEFAULTS = {
  hero: {
    name: 'Daniel Ajayi Lotsu',
    role: 'Backend & Cloud Engineer',
    tagline:
      'Architecting scalable, cloud-native systems from Kumasi — interconnected services, precisely composed like constellations. AWS-certified, building reliable backends that just stay online.',
    location: 'Kumasi, Ghana',
    availability: 'Open to work',
    employerLabel: 'Engineer @',
    employer: 'AmaliTech',
    region: 'Region: kumasi-gh-west-1',
    chips: ['uptime 99.98%', 'p99 · 42ms', 'region · eu-west-1'],
    showAvailability: true,
    showCodeLines: true,
    // hero canvas, driven by the CMS sliders
    starDensity: 64, // 20-140; scales the node count
    cursorPull: 42, // 0-100; how strongly nodes lean toward the cursor
  },
  about: {
    heading: 'The engineer behind the cloud',
    body:
      'Daniel is a backend & cloud engineer at AmaliTech who turns complex infrastructure into reliable, well-architected services. He designs APIs, models data, and ships serverless and containerised systems on AWS — focused on the kind of quiet engineering that keeps products online and teams shipping. Building the future of African tech, one well-provisioned region at a time.',
    region: 'af-south-1',
    timezone: 'GMT+0',
    years: '2+',
  },
  // Editable collections. Each renders its portfolio section wholesale, so adding,
  // reordering or removing an entry in the CMS changes the site.
  certs: [
    { level: 'Associate', title: 'AWS Certified Developer', issuer: 'Amazon Web Services', year: '2025' },
    { level: 'Foundational', title: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services', year: '2024' },
    { level: 'Badge', title: 'Data Protection & DR', issuer: 'Amazon Web Services', year: '2025' },
  ],
  stack: [
    {
      group: 'Cloud · AWS',
      items: [
        { icon: 'ec2', label: 'EC2', tip: 'Core compute for AmaliTech services' },
        { icon: 'lambda', label: 'Lambda', tip: 'Serverless APIs & background jobs' },
        { icon: 's3', label: 'S3', tip: 'Static assets & media storage' },
        { icon: 'rds', label: 'RDS', tip: 'Managed relational databases' },
        { icon: 'apigw', label: 'API GW', tip: 'Request routing & throttling' },
        { icon: 'cloudwatch', label: 'CloudWatch', tip: 'Observability, logs & alarms' },
      ],
    },
    {
      group: 'Backend & Languages',
      items: [
        { icon: 'node', label: 'Node.js', tip: 'Primary runtime for APIs & services' },
        { icon: 'javascript', label: 'JavaScript', tip: 'Core language across the stack' },
        { icon: 'rest', label: 'REST API', tip: 'Designing clean, versioned REST APIs' },
      ],
    },
    {
      group: 'Database & DevOps',
      items: [
        { icon: 'postgres', label: 'PostgreSQL', tip: 'Primary relational store' },
        { icon: 'mysql', label: 'MySQL', tip: 'Relational workloads & reporting' },
        { icon: 'docker', label: 'Docker', tip: 'Containerising services for deploy' },
        { icon: 'git', label: 'Git', tip: 'Version control, daily' },
        { icon: 'github', label: 'GitHub', tip: 'Collaboration, PRs & CI' },
      ],
    },
  ],
  projects: [
    {
      title: 'Leave Management API',
      status: 'Deployed: Production',
      live: true,
      description:
        "Serverless leave-request platform — approvals, balances and notifications running on Lambda + API Gateway with a PostgreSQL store. Designed for AmaliTech's internal tooling.",
      tags: ['NODE.JS', 'AWS LAMBDA', 'POSTGRESQL', 'API GATEWAY'],
      repo: '',
      liveUrl: '',
    },
    {
      title: 'Incident Service',
      status: 'Deployed: Production',
      live: true,
      description: 'REST microservice for tracking and routing incidents — containerised and observable.',
      tags: ['NODE.JS', 'MYSQL', 'DOCKER'],
      repo: '',
      liveUrl: '',
    },
    {
      title: 'S3 Media Pipeline',
      status: 'Status: In Development',
      live: false,
      description: 'Event-driven upload & transform pipeline — S3 triggers Lambda, metrics flow to CloudWatch.',
      tags: ['AWS S3', 'LAMBDA', 'NODE.JS'],
      repo: '',
      liveUrl: '',
    },
    {
      title: 'Auth & Identity Gateway',
      status: 'Deployed: Production',
      live: true,
      description: 'JWT-based authentication service with role-based access, powering downstream APIs.',
      tags: ['NODE.JS', 'POSTGRESQL', 'REST'],
      repo: '',
      liveUrl: '',
    },
  ],
  experience: {
    items: [
      {
        role: 'Software Engineer',
        company: 'AmaliTech',
        start: 'Oct 2025',
        end: 'Now',
        location: 'Kumasi, Ghana',
        status: 'ACTIVE',
        description:
          "Building and maintaining backend services on AWS — designing REST APIs, modelling data in PostgreSQL/MySQL, and shipping serverless and containerised workloads. Working across the full delivery lifecycle with AmaliTech's product teams.",
      },
      {
        role: 'Back End Developer · NSP',
        company: 'AmaliTech',
        start: 'Oct 2024',
        end: 'Sep 2025',
        location: 'Kumasi, Ghana',
        status: 'COMPLETED',
        description:
          'National Service placement as a backend developer — contributed to internal APIs and services, gained hands-on AWS experience, and earned AWS certifications while shipping production features.',
      },
      {
        role: 'BSc Computer Science',
        company: 'Accra Institute of Tech',
        start: '2020',
        end: '2024',
        location: 'Accra, Ghana',
        status: 'GRADUATED',
        description:
          'BSc in Computer Science — foundations in algorithms, data structures, databases and software engineering that underpin the backend and cloud work today.',
      },
    ],
  },
  contact: {
    email: 'daniel.lotsu.jnr@gmail.com',
    linkedin: 'linkedin.com/in/daniel-lotsu-jnr',
    github: 'github.com/daniel-lotsu',
    x: '', // footer icons stay hidden until these are filled in from the CMS
    instagram: '',
    successMessage: "Message received — I'll reply within a day",
    showForm: true,
    showSocials: true,
    confetti: true, // the burst on successful submit
    emailOnMessage: true, // email as well as storing in the inbox
  },
  resume: {
    name: 'Daniel Ajayi Lotsu',
    title: 'Backend & Cloud Engineer',
    summary:
      'Backend & cloud engineer building scalable, cloud-native systems on AWS. I design REST APIs, model data, and ship serverless and containerised services that stay online — the quiet, well-architected engineering that keeps products and teams moving. AWS-certified, currently at AmaliTech in Kumasi, Ghana.',
    filename: 'daniel-lotsu-resume.pdf',
    showDownload: true,
    sections: {
      summary: true,
      experience: true,
      education: true,
      certifications: true,
      skills: true,
      references: false,
    },
  },
  blog: {
    heading: 'Field notes',
    intro: '// writing about backend systems, AWS, and keeping things online',
    posts: [
      {
        id: 'post-cold-starts',
        title: "Cold starts aren't the enemy — trimming Lambda latency by 60%",
        category: 'AWS Lambda',
        date: '12 Nov 2025',
        readTime: '6 min read',
        alt: 'Lambda console showing init duration',
        excerpt:
          "Everyone panics about cold starts. Here's what actually moved the needle on our serverless APIs — and what turned out to be noise.",
        published: true,
      },
      {
        id: 'post-leave-api',
        title: 'Designing a leave-management API that scales quietly',
        category: 'Architecture',
        date: '04 Oct 2025',
        readTime: '8 min read',
        alt: 'Service topology for the leave-management API',
        excerpt:
          'Approvals, balances and notifications sound simple until real teams use them. The design decisions that kept it calm under load.',
        published: true,
      },
      {
        id: 'post-pooling',
        title: 'Connection pooling in serverless: what finally worked',
        category: 'PostgreSQL',
        date: '19 Sep 2025',
        readTime: '5 min read',
        alt: 'Lambda containers multiplexed through RDS Proxy',
        excerpt:
          'Lambda + a relational database is a classic footgun. How I stopped exhausting connections without rewriting everything.',
        published: true,
      },
      {
        id: 'post-firstyear',
        title: 'From National Service to AWS-certified: my first year',
        category: 'Career',
        date: '28 Aug 2025',
        readTime: '4 min read',
        alt: 'A first-year trajectory through two AWS certifications',
        excerpt:
          "What I'd tell a new backend engineer starting out at AmaliTech — the habits that compounded fastest.",
        published: true,
      },
      // Drafts. Editable and stored, but the portfolio's blog layout is built for
      // four posts, so publishing one of these needs a matching design change.
      {
        id: 'post-terraform-modules',
        title: 'Terraform modules I actually reuse',
        category: 'Infrastructure',
        date: '',
        readTime: '',
        alt: '',
        excerpt: '',
        published: false,
      },
      {
        id: 'post-cloudwatch-logs',
        title: 'Reading CloudWatch logs like a detective',
        category: 'Observability',
        date: '',
        readTime: '',
        alt: '',
        excerpt: '',
        published: false,
      },
    ],
  },
  // Slot id -> image URL, overriding the art bundled at that slot. Slot ids come
  // from the design's <image-slot> elements and survive into the page as
  // <img data-slot="…">, so the CMS media pane can retarget any of them.
  media: {
    'blog-cover-cold-starts': '',
    'blog-cover-leave-api': '',
    'blog-cover-pooling': '',
    'blog-cover-firstyear': '',
    'blog-hero-cold-starts': '',
    'blog-hero-leave-api': '',
    'blog-hero-pooling': '',
    'blog-hero-firstyear': '',
  },
  settings: {
    pageTitle: 'Daniel Ajayi Lotsu — Backend & Cloud Engineer',
    metaDescription:
      'Backend & cloud engineer at AmaliTech in Kumasi, Ghana. AWS-certified, architecting scalable cloud-native systems, REST APIs and serverless workloads.',
    domain: 'daniels-cloud-portfolio.vercel.app',
    accent: '#6AFF00',
    reduceMotion: false,
  },
};

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Fill in anything the stored document is missing, recursively. Arrays are taken
// wholesale from the stored value (a CMS edit owns the whole list).
function withDefaults(stored, defaults = DEFAULTS) {
  if (!isPlain(stored)) return defaults;
  const out = Array.isArray(defaults) ? [] : {};
  for (const key of Object.keys(defaults)) {
    const d = defaults[key];
    const s = stored[key];
    if (isPlain(d)) out[key] = withDefaults(s, d);
    else if (s === undefined) out[key] = d;
    // A stored value of a different shape than the default is from an older
    // schema — e.g. projects used to be an object of statuses and is now a list.
    // Take the default so the new shape wins instead of shipping the old one.
    else if (Array.isArray(d) !== Array.isArray(s)) out[key] = d;
    else out[key] = s;
  }
  // preserve extra keys the CMS may add ahead of this file
  for (const key of Object.keys(stored)) if (!(key in out)) out[key] = stored[key];
  return out;
}

async function readContent() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { content: withDefaults(null), source: 'defaults', updatedAt: null };
  }
  try {
    const { blobs } = await list({
      prefix: CONTENT_PREFIX,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (blobs.length) {
      const newest = newestFirst(blobs)[0];
      const res = await fetch(newest.url, { cache: 'no-store' });
      if (!res.ok) throw new Error('blob fetch ' + res.status);
      const stored = await res.json();
      return {
        content: withDefaults(stored.content || stored),
        source: 'blob',
        updatedAt: stored.updatedAt || newest.uploadedAt || null,
      };
    }

    // nothing versioned yet — fall back to the original single-key document so an
    // existing deployment's content survives the switch
    const meta = await head(BLOB_PATH, { token: process.env.BLOB_READ_WRITE_TOKEN });
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) throw new Error('blob fetch ' + res.status);
    const stored = await res.json();
    return {
      content: withDefaults(stored.content || stored),
      source: 'blob-legacy',
      updatedAt: stored.updatedAt || meta.uploadedAt || null,
    };
  } catch (err) {
    // Nothing stored yet (first run, or the blob was cleared) — serve defaults so
    // the portfolio still renders instead of erroring.
    const name = (err && (err.name || (err.constructor && err.constructor.name))) || '';
    const msg = (err && err.message) || '';
    if (/BlobNotFound/i.test(name) || /does not exist|not found/i.test(msg)) {
      return { content: withDefaults(null), source: 'defaults', updatedAt: null };
    }
    throw err;
  }
}

async function writeContent(content) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const e = new Error('Content store is not configured (BLOB_READ_WRITE_TOKEN missing)');
    e.statusCode = 503;
    throw e;
  }
  const doc = { content: withDefaults(content), updatedAt: new Date().toISOString() };

  // A brand-new key each save: immutable, so it can be cached hard, and readable
  // immediately because nothing has ever been served from this URL before.
  await put(versionKey(), JSON.stringify(doc, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 31536000,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  await pruneVersions();
  return doc;
}

// Keep a short history and drop the rest, so the store doesn't grow per save.
async function pruneVersions() {
  try {
    const { blobs } = await list({
      prefix: CONTENT_PREFIX,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    const stale = newestFirst(blobs).slice(KEEP_VERSIONS);
    if (stale.length) {
      await del(stale.map((b) => b.url), { token: process.env.BLOB_READ_WRITE_TOKEN });
    }
  } catch (err) {
    // pruning is housekeeping — never fail a save because old versions lingered
    console.error('[content] could not prune old versions:', err);
  }
}

/* ---------------- auth: short HMAC-signed bearer tokens ---------------- */

function authSecret() {
  return process.env.CMS_SECRET || process.env.BLOB_READ_WRITE_TOKEN || '';
}

function issueToken(ttlSeconds = 60 * 60 * 12) {
  const exp = Date.now() + ttlSeconds * 1000;
  const sig = crypto.createHmac('sha256', authSecret()).update(String(exp)).digest('hex');
  return exp + '.' + sig;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = crypto.createHmac('sha256', authSecret()).update(String(exp)).digest('hex');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/* ---------------- CORS ----------------
 * The CMS ships in this same project at /cms, so it is same-origin and needs no
 * CORS at all. These headers only exist so the pages can also be driven from a
 * local static server during development, plus any origin named in CMS_ORIGIN. */

function allowedOrigins() {
  const extra = (process.env.CMS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ['http://localhost:5066', 'http://localhost:5067', ...extra];
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = {
  DEFAULTS,
  withDefaults,
  readContent,
  writeContent,
  issueToken,
  verifyToken,
  bearer,
  applyCors,
};
