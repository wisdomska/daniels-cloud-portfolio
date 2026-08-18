// Ports the Claude Design exports in this directory to standalone static pages.
//
//   Daniel Lotsu Portfolio.dc.html  ->  index.html
//   Portfolio CMS.dc.html           ->  cms.html
//
// The .dc.html files run on the Claude Design runtime (support.js), which pulls
// React + Babel from a CDN and transpiles in the browser on every load. This
// script rewrites them as plain HTML + a vanilla IIFE:
//
//   ref="{{ setFoo }}"      -> id="dc-setFoo"
//   onClick="{{ fn }}"      -> data-on-click="fn"   (bound below)
//   style-hover / -focus    -> applied by a small JS shim
//   <image-slot id="…">     -> <img src="…"> from SLOT_ART (portfolio only)
//   class Component         -> hand-ported vanilla logic
//
// Run after editing a .dc.html:  node tools/build-from-design.js .

const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || '.';

/* ------------------------------------------------------------------ *
 * The design ships <image-slot> elements — editor-time drop targets.
 * They carry no src and the export has no .image-slots.state.json
 * sidecar, so left alone every one renders an empty "Drop cover image"
 * placeholder. Each slot is filled here with art authored for that
 * slot's aspect ratio (24:9 featured, 4:3 thumb, 16:9 hero).
 * ------------------------------------------------------------------ */
const SLOT_ART = {
  'blog-cover-cold-starts': {
    file: 'assets/blog/cold-starts-cover.svg',
    alt: 'A tall 214ms cold start followed by warm invocations settling under 90ms',
  },
  'blog-cover-leave-api': {
    file: 'assets/blog/leave-api-thumb.svg',
    alt: 'Three stacked services — gateway, requests, balances — connected top to bottom',
  },
  'blog-cover-pooling': {
    file: 'assets/blog/pooling-thumb.svg',
    alt: 'Four Lambda containers funnelling through a proxy into one database',
  },
  'blog-cover-firstyear': {
    file: 'assets/blog/first-year-thumb.svg',
    alt: 'A rising curve from 2024 to 2025 ending in a star',
  },
  // the article frame: same slot as the card, so one upload serves both — only
  // the bundled default art differs, being drawn for this frame's shape
  'blog-hero-cold-starts': {
    as: 'blog-cover-cold-starts',
    file: 'assets/blog/cold-starts-hero.svg',
    alt: 'Chart of Lambda invocation latency: a 214ms cold start, then warm invocations under 90ms',
  },
  // the article frame: same slot as the card, so one upload serves both — only
  // the bundled default art differs, being drawn for this frame's shape
  'blog-hero-leave-api': {
    as: 'blog-cover-leave-api',
    file: 'assets/blog/leave-api-hero.svg',
    alt: 'Topology: API Gateway feeding request and balance services, joined by an event bus, writing to PostgreSQL',
  },
  // the article frame: same slot as the card, so one upload serves both — only
  // the bundled default art differs, being drawn for this frame's shape
  'blog-hero-pooling': {
    as: 'blog-cover-pooling',
    file: 'assets/blog/pooling-hero.svg',
    alt: 'Many Lambda containers multiplexed through RDS Proxy onto three stable PostgreSQL connections',
  },
  // the article frame: same slot as the card, so one upload serves both — only
  // the bundled default art differs, being drawn for this frame's shape
  'blog-hero-firstyear': {
    as: 'blog-cover-firstyear',
    file: 'assets/blog/first-year-hero.svg',
    alt: 'Rising timeline from National Service through two AWS certifications to Software Engineer',
  },
};

/* ---------------------------- helpers ---------------------------- */


/* ------------------------------------------------------------------ *
 * Service icons for the tech-stack tiles.
 *
 * The design used emoji, which render as a different picture on every
 * platform and read as clip-art beside the rest of the page. This is one
 * monoline set drawn on a 24px grid and stroked with currentColor, so the
 * tiles inherit the accent and rotate with the palette like everything
 * else.
 *
 * A stack item's `icon` is a slug from this map. Anything else — an emoji,
 * a letter — still renders as text, so the CMS can hold either and older
 * saved documents keep working.
 * ------------------------------------------------------------------ */
const ICON_HEAD =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" ' +
  'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">';
const iconDot = (x, y, r) =>
  '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="currentColor" stroke="none"/>';
const stroked = (inner) => ICON_HEAD + inner + '</svg>';

const SVC_ICONS = {
  // compute
  ec2: stroked(
    '<rect x="3" y="4.4" width="18" height="6.4" rx="1.6"/><rect x="3" y="13.2" width="18" height="6.4" rx="1.6"/>' +
      iconDot(6.6, 7.6, 0.95) + iconDot(6.6, 16.4, 0.95) + '<path d="M10 7.6h7M10 16.4h7"/>'
  ),
  lambda: stroked('<path d="M6.4 19.6 13 4.4"/><path d="M10.5 12.2 17.6 19.6"/>'),
  container: stroked('<rect x="3.4" y="7" width="17.2" height="10" rx="1.8"/><path d="M8 7v10M13 7v10"/>'),

  // storage + data
  s3: stroked(
    '<ellipse cx="12" cy="6.2" rx="7.4" ry="2.3"/>' +
      '<path d="M4.6 6.6 6.3 19a1.8 1.8 0 0 0 1.8 1.5h7.8a1.8 1.8 0 0 0 1.8-1.5l1.7-12.4"/>'
  ),
  rds: stroked(
    '<rect x="2.6" y="3.4" width="18.8" height="17.2" rx="3.2"/>' +
      '<ellipse cx="12" cy="8.6" rx="4.6" ry="1.8"/><path d="M7.4 8.6v6.2c0 1 2.06 1.8 4.6 1.8s4.6-.8 4.6-1.8V8.6"/>'
  ),
  postgres: stroked(
    '<ellipse cx="12" cy="5.6" rx="6.8" ry="2.4"/><path d="M5.2 5.6v12.8c0 1.33 3.04 2.4 6.8 2.4s6.8-1.07 6.8-2.4V5.6"/>' +
      '<path d="M5.2 10.2c0 1.33 3.04 2.4 6.8 2.4s6.8-1.07 6.8-2.4"/>' +
      '<path d="M5.2 14.8c0 1.33 3.04 2.4 6.8 2.4s6.8-1.07 6.8-2.4"/>'
  ),
  mysql: stroked(
    '<ellipse cx="12" cy="5.8" rx="6.8" ry="2.4"/><path d="M5.2 5.8v9.2c0 1.33 3.04 2.4 6.8 2.4s6.8-1.07 6.8-2.4V5.8"/>' +
      '<path d="M5.2 10.4c0 1.33 3.04 2.4 6.8 2.4s6.8-1.07 6.8-2.4"/>' +
      '<path d="M4.4 20.6c1.36-1.1 2.54-1.1 3.9 0s2.54 1.1 3.9 0 2.54-1.1 3.9 0"/>'
  ),

  // networking + observability
  apigw: stroked(
    '<circle cx="5" cy="12" r="2.1"/><circle cx="18.8" cy="6.4" r="1.7"/><circle cx="18.8" cy="12" r="1.7"/>' +
      '<circle cx="18.8" cy="17.6" r="1.7"/><path d="M7.1 12h3.1"/><path d="M10.2 12 17.1 6.9"/>' +
      '<path d="M10.2 12h6.9"/><path d="M10.2 12 17.1 17.1"/>'
  ),
  cloudwatch: stroked(
    '<path d="M3.6 4.2v13.6a1.8 1.8 0 0 0 1.8 1.8h15"/>' +
      '<path d="M6.6 15.6l3.5-4.4 2.9 2.3 3.1-4.8 2.9 3.5"/>' +
      iconDot(6.6, 15.6, 0.85) + iconDot(19, 12.2, 0.85)
  ),
  rest: stroked(
    '<circle cx="5.2" cy="7" r="1.5"/><circle cx="5.2" cy="12" r="1.5"/><circle cx="5.2" cy="17" r="1.5"/>' +
      '<path d="M8.2 7h10.6M8.2 12h7.4M8.2 17h9.2"/>'
  ),

  // languages + runtimes
  node: stroked('<path d="M12 2.9 20 7.45v9.1L12 21.1 4 16.55v-9.1z"/><path d="M9.2 15.1V9.5l5.6 5V9"/>'),
  javascript: stroked(
    '<path d="M9.6 4.6C6.9 4.6 7.8 10.3 4.9 12c2.9 1.7 2 7.4 4.7 7.4"/>' +
      '<path d="M14.4 4.6c2.7 0 1.8 5.7 4.7 7.4-2.9 1.7-2 7.4-4.7 7.4"/>'
  ),

  // tooling
  docker: stroked(
    '<rect x="3.2" y="12.4" width="3.5" height="3.5" rx=".6"/><rect x="7.5" y="12.4" width="3.5" height="3.5" rx=".6"/>' +
      '<rect x="11.8" y="12.4" width="3.5" height="3.5" rx=".6"/><rect x="7.5" y="8.3" width="3.5" height="3.5" rx=".6"/>' +
      '<rect x="11.8" y="8.3" width="3.5" height="3.5" rx=".6"/>' +
      '<path d="M2.6 17.8c1.7 2.3 4.6 3.2 7.5 3.2 4.9 0 8.5-2.3 9.5-6.3 1.2.6 2.4.4 3-.5-1-1.2-2.5-1.2-3.3-.7"/>'
  ),
  git: stroked(
    '<circle cx="7" cy="5.6" r="2.2"/><circle cx="7" cy="18.4" r="2.2"/><circle cx="17" cy="12" r="2.2"/>' +
      '<path d="M7 7.8v8.4"/><path d="M7 12h7.8"/>'
  ),
  github:
    '<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true" fill="currentColor">' +
    '<path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 016 0C17.4 5 18.4 5.3 18.4 5.3c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5A11.5 11.5 0 0023.5 12C23.5 5.7 18.3.5 12 .5z"/></svg>',

  // generic, for anything added in the CMS
  cloud: stroked('<path d="M7 18.4h9.6a4.1 4.1 0 0 0 .5-8.2 5.6 5.6 0 0 0-10.7 1.3A3.5 3.5 0 0 0 7 18.4z"/>'),
  shield: stroked(
    '<path d="M12 21.2s7.4-3.7 7.4-9.2V5.1L12 2.4 4.6 5.1v6.9c0 5.5 7.4 9.2 7.4 9.2z"/><path d="M9 12.1l2.2 2.2 4-4.4"/>'
  ),
  key: stroked('<circle cx="8.2" cy="15.8" r="3.4"/><path d="M10.6 13.4 19 5h2.4v2.6h-2.6v2.6h-2.6"/>'),
  cube: stroked('<path d="M12 2.9 20 7.45v9.1L12 21.1 4 16.55v-9.1z"/><path d="M4 7.45 12 12l8-4.55M12 12v9.1"/>'),
};

// Tiles are matched on the label beneath the icon, which is stable — unlike the
// emoji, which are multi-codepoint and easy to mistype.
const STACK_ICON_BY_LABEL = {
  EC2: 'ec2',
  Lambda: 'lambda',
  S3: 's3',
  RDS: 'rds',
  'API GW': 'apigw',
  CloudWatch: 'cloudwatch',
  'Node.js': 'node',
  JavaScript: 'javascript',
  'REST API': 'rest',
  PostgreSQL: 'postgres',
  MySQL: 'mysql',
  Docker: 'docker',
  Git: 'git',
  GitHub: 'github',
};

const ICON_SPAN_STYLE =
  'display:flex;align-items:center;justify-content:center;width:26px;height:26px;color:var(--primary)';

function iconSpan(svg) {
  return '<span style="' + ICON_SPAN_STYLE + '">' + svg + '</span>';
}

// Swap every tile's emoji span for its drawn icon. Throws on an unmapped label, so a
// re-synced design cannot quietly ship a tile with no icon.
function drawStackIcons(body) {
  let drawn = 0;
  const out = body.replace(/<div class="svc-tile"[^>]*>[\s\S]*?<\/div>/g, (tile) => {
    const spans = [...tile.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/g)];
    if (spans.length < 2) return tile;
    const label = spans[1][1].trim();
    const slug = STACK_ICON_BY_LABEL[label];
    if (!slug) throw new Error('no icon mapped for the "' + label + '" stack tile');
    drawn++;
    return tile.replace(spans[0][0], () => iconSpan(SVC_ICONS[slug]));
  });
  if (drawn !== 14) throw new Error('expected 14 stack tiles, drew ' + drawn);
  return out;
}


// The footer ships GitHub and LinkedIn. Add X and Instagram beside them, hidden
// until the content document has a URL for each, and tag all four so the hydrator
// can point them at whatever the CMS holds.
const SOCIAL_ICONS = {
  x:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  instagram:
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" aria-hidden="true">' +
    '<rect x="2.9" y="2.9" width="18.2" height="18.2" rx="5.2"/><circle cx="12" cy="12" r="4.1"/>' +
    '<circle cx="17.3" cy="6.7" r="1.15" fill="currentColor" stroke="none"/></svg>',
};

function addFooterSocials(body) {
  const footerAt = body.indexOf('<!-- ============ FOOTER');
  if (footerAt === -1) throw new Error('footer not found');

  const ghAt = body.indexOf('aria-label="GitHub"', footerAt);
  const liAt = body.indexOf('aria-label="LinkedIn"', footerAt);
  if (ghAt === -1 || liAt === -1) throw new Error('footer social links not found');

  const closeAt = body.indexOf('</a>', liAt);
  if (closeAt === -1) throw new Error('footer LinkedIn link is unclosed');

  const anchor = body.slice(liAt, closeAt);
  const style = (anchor.match(/style="([^"]+)"/) || [])[1];
  const hover = (anchor.match(/style-hover="([^"]+)"/) || [])[1];
  if (!style || !hover) throw new Error('could not read the footer link styling');

  const extra = ['x', 'instagram']
    .map(function (key) {
      const label = key === 'x' ? 'X' : 'Instagram';
      return (
        '<a data-social="' + key + '" href="#" target="_blank" rel="noopener" aria-label="' +
        label + '" style="' + style + ';display:none" style-hover="' + hover + '">' +
        SOCIAL_ICONS[key] + '</a>'
      );
    })
    .join('');

  let out = body.slice(0, closeAt + 4) + extra + body.slice(closeAt + 4);
  // tag the two the design already had, so all four are driven the same way
  out =
    out.slice(0, ghAt) +
    out.slice(ghAt).replace('aria-label="GitHub"', 'aria-label="GitHub" data-social="github"');
  const liTag = out.indexOf('aria-label="LinkedIn"', footerAt);
  out =
    out.slice(0, liTag) +
    out.slice(liTag).replace('aria-label="LinkedIn"', 'aria-label="LinkedIn" data-social="linkedin"');
  return out;
}


// The design's cover placeholder is a dashed box with Replace/Remove beside it and
// nothing behind them. Tag it so the runtime can turn it into a real preview.
function tagCoverControls(body) {
  const anchor = '<div style="width:172px;aspect-ratio:16/9;';
  const n = body.split(anchor).length - 1;
  if (n !== 1) throw new Error('CMS: expected 1 cover placeholder, found ' + n);
  return body.replace(anchor, '<div data-cover-preview style="width:172px;aspect-ratio:16/9;');
}

function extractParts(src) {
  const helmetStart = src.indexOf('<helmet>');
  const helmetEnd = src.indexOf('</helmet>');
  if (helmetStart === -1 || helmetEnd === -1) throw new Error('no <helmet> block found');
  return {
    helmet: src.slice(helmetStart + '<helmet>'.length, helmetEnd),
    body: src.slice(helmetEnd + '</helmet>'.length, src.indexOf('</x-dc>')).trim(),
  };
}

// The design system bundle is unused by these pages (no DS components, no
// --color-* tokens), and image-slot.js is moot once slots become <img>.
function stripUnusedScripts(helmet) {
  return helmet
    .split('\n')
    .filter(
      (l) => !l.includes('_ds_bundle.js') && !l.includes('colors_and_type.css') && !l.includes('image-slot.js')
    )
    .join('\n')
    .trim();
}

function transformBindings(body) {
  const refs = new Set();
  const events = new Set();

  body = body.replace(/\s*ref="\{\{\s*(\w+)\s*\}\}"/g, (_, name) => {
    refs.add(name);
    return ` id="dc-${name}"`;
  });

  body = body.replace(/\s*on([A-Z]\w*)="\{\{\s*(\w+)\s*\}\}"/g, (_, evt, fn) => {
    const type = evt.toLowerCase();
    events.add(type);
    return ` data-on-${type}="${fn}"`;
  });

  const leftover = body.match(/\{\{[^}]*\}\}/g);
  if (leftover) throw new Error('unconverted bindings: ' + leftover.join(', '));

  return { body, refs, events };
}

function fillImageSlots(body) {
  const filled = [];
  body = body.replace(/<image-slot\s([^>]*)><\/image-slot>/g, (whole, attrs) => {
    const id = (attrs.match(/id="([^"]+)"/) || [])[1];
    const art = SLOT_ART[id];
    if (!art) {
      throw new Error(
        `<image-slot id="${id}"> has no entry in SLOT_ART — add art for it, ` +
          'otherwise the page ships an empty placeholder.'
      );
    }
    filled.push(id);
    // data-slot keeps the slot's identity in the DOM so the CMS can swap this image
    // at runtime. Several frames can share one slot (the card cover and the article
    // header are the same picture), so each frame also carries the art drawn for its
    // own shape as its default — data-default-for records which slot that art belongs
    // to, so a frame re-pointed at another post falls back instead of lying.
    const slot = art.as || id;
    return (
      `<img data-slot="${slot}" data-default="${art.file}" data-default-for="${slot}" ` +
      `src="${art.file}" alt="${art.alt}" decoding="async" ` +
      'style="width:100%;height:100%;object-fit:cover;display:block">'
    );
  });

  const unfilled = Object.keys(SLOT_ART).filter((id) => !filled.includes(id));
  if (unfilled.length) throw new Error('SLOT_ART entries matched no slot: ' + unfilled.join(', '));
  return { body, filled };
}

/* ------------------------------------------------------------------ *
 * Content bindings.
 *
 * The CMS edits a JSON document (see api/_content.js DEFAULTS); the portfolio
 * hydrates from it at runtime. Rather than annotate the .dc.html by hand — which
 * a design re-sync would silently wipe — each binding is applied here, in memory,
 * keyed on a unique fragment of the target element. The design export stays
 * pristine, and if a re-sync moves or rewords a target the build throws instead
 * of quietly shipping a field the CMS can no longer reach.
 *
 * [ content path, unique fragment inside the target element's markup ]
 * ------------------------------------------------------------------ */
const BINDINGS = [
  ['hero.role', '// Backend &amp; Cloud Engineer'],
  ['hero.name', 'animation:shimmer 9s linear infinite'],
  ['hero.tagline', 'Architecting scalable, cloud-native systems from Kumasi'],
  ['hero.region', 'Region: kumasi-gh-west-1'],
  ['hero.availability', 'Open to work'],
  ['hero.location', 'Kumasi, Ghana 🇬🇭</div>'],
  ['hero.employerLabel', 'Engineer @</span>'],

  ['about.heading', 'The engineer behind the cloud'],
  ['about.body', 'Daniel is a backend &amp; cloud engineer at AmaliTech who turns'],

  // experience rows are rendered from experience.items[], so no single-field binding

  // anchors must not begin with '>' — that '>' is the target's own tag end, which
  // would resolve one level too high, to the parent
  ['blog.heading', 'Field notes</h2>'],
  ['blog.intro', '// writing about backend systems, AWS, and keeping things online'],

  ['resume.name', 'font-size:clamp(28px,4vw,40px);letter-spacing:-.02em'],
  ['resume.summary', 'Backend &amp; cloud engineer building scalable, cloud-native systems on AWS.'],

  ['contact.email', 'daniel.lotsu.jnr@gmail.com</a>'],
  ['contact.linkedin', 'linkedin.com/in/daniel-lotsu-jnr</a>'],
];

// HTML void elements never have a closing tag, so they must not be mistaken for
// the unmatched opening tag that encloses a text anchor.
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// Walk backwards from a text position to the opening tag of the element that
// contains it, stepping over any complete sibling elements on the way.
function enclosingOpenTag(body, index) {
  let pos = index;
  let depth = 0;

  while (pos > 0) {
    const gt = body.lastIndexOf('>', pos - 1);
    if (gt === -1) return -1;
    const lt = body.lastIndexOf('<', gt);
    if (lt === -1) return -1;

    const tag = body.slice(lt + 1, gt);
    const name = (tag.match(/^\/?\s*([\w-]+)/) || [])[1] || '';

    if (tag.startsWith('!')) {
      // comment or doctype — not part of the element tree
    } else if (tag.startsWith('/')) {
      depth++;
    } else if (tag.endsWith('/') || VOID_TAGS.has(name.toLowerCase())) {
      // self-closing or void: a complete sibling, not an ancestor
    } else if (depth === 0) {
      return lt;
    } else {
      depth--;
    }
    pos = lt;
  }
  return -1;
}

function injectAttr(body, index, attr) {
  // An anchor is either inside the target's opening tag (a style fragment, say) or
  // in its text. Decide which by asking whether the nearest '<' before the anchor
  // is more recent than the nearest '>': if so we're still inside a tag.
  const prevLt = body.lastIndexOf('<', index);
  const prevGt = body.lastIndexOf('>', index);

  const lt = prevLt > prevGt ? prevLt : enclosingOpenTag(body, index);
  if (lt === -1) throw new Error('could not find an opening tag for ' + attr);

  const gt = body.indexOf('>', lt);
  if (gt === -1) throw new Error('unterminated opening tag for ' + attr);

  const open = body.slice(lt + 1, gt);
  if (/^\/|^!/.test(open)) throw new Error('anchor resolved to a closing tag/comment for ' + attr);
  if (open.includes('data-content=')) return body; // already bound

  const patched = open.replace(/^([\w-]+)/, `$1 ${attr}`);
  return body.slice(0, lt + 1) + patched + body.slice(gt);
}

function annotateContent(body) {
  const bound = [];

  for (const [contentPath, fragment] of BINDINGS) {
    if (fragment.startsWith('>')) {
      throw new Error(
        `content binding "${contentPath}" starts its anchor with '>' — that '>' closes the ` +
          "target's own tag, so the binding would land on its parent. Drop the leading '>'."
      );
    }
    const first = body.indexOf(fragment);
    if (first === -1) {
      throw new Error(
        `content binding "${contentPath}" found no match for <<${fragment}>> — the design ` +
          'changed; update BINDINGS so the CMS can still reach this field.'
      );
    }
    if (body.indexOf(fragment, first + 1) !== -1) {
      throw new Error(
        `content binding "${contentPath}" is ambiguous — <<${fragment}>> matches more than ` +
          'once. Use a longer fragment.'
      );
    }
    body = injectAttr(body, first, `data-content="${contentPath}"`);
    bound.push(contentPath);
  }

  // Blog cards and articles: tag each region with its post id so the hydrator can
  // apply posts[] by identity rather than by position.
  body = body.replace(/(<div[^>]*\bdata-open="(post-[\w-]+)")/g, '$1 data-post="$2"');
  body = body.replace(
    /(<article[^>]*\bdata-blog="article"[^>]*\bdata-id="(post-[\w-]+)")/g,
    '$1 data-post="$2"'
  );

  const regions = (body.match(/data-post="post-[\w-]+"/g) || []).length;
  if (regions < 8) {
    throw new Error(`expected 8 blog regions (4 cards + 4 articles), tagged ${regions}`);
  }

  body = tagPostMeta(body);

  return { body, bound, regions };
}

/* Each post shows its category and a dateline in <span>s that carry no hook of
 * their own. Tag them so the hydrator can rewrite them. Scoped to the blog view,
 * because a bare category like "PostgreSQL" also appears in the tech-stack tiles
 * and resume chips over in the home view. */
const POST_META = [
  { category: 'AWS Lambda', datelines: ['12 Nov 2025 · 6 min read', '· 6 min read · Nov 2025'] },
  { category: 'Architecture', datelines: ['04 Oct 2025 · 8 min', '· 8 min read · Oct 2025'] },
  { category: 'PostgreSQL', datelines: ['19 Sep 2025 · 5 min', '· 5 min read · Sep 2025'] },
  { category: 'Career', datelines: ['28 Aug 2025 · 4 min', '· 4 min read · Aug 2025'] },
];

function tagPostMeta(body) {
  const start = body.indexOf('data-view="blog"');
  if (start === -1) throw new Error('blog view not found');
  const endMarker = '<!-- ============ FOOTER';
  const end = body.indexOf(endMarker, start);
  if (end === -1) throw new Error('footer marker not found after the blog view');

  let slice = body.slice(start, end);
  let categories = 0;
  let datelines = 0;

  for (const meta of POST_META) {
    const catRe = new RegExp(`(<span\\b[^>]*?)(>${escapeRe(meta.category)}</span>)`, 'g');
    slice = slice.replace(catRe, (_, open, rest) => {
      categories++;
      return `${open} data-cms-category${rest}`;
    });

    for (const dateline of meta.datelines) {
      const dateRe = new RegExp(`(<span\\b[^>]*?)(>${escapeRe(dateline)}</span>)`, 'g');
      slice = slice.replace(dateRe, (_, open, rest) => {
        datelines++;
        return `${open} data-cms-dateline${rest}`;
      });
    }
  }

  // 4 posts x (card + article) for each of category and dateline
  if (categories !== 8) throw new Error(`expected 8 post categories to tag, tagged ${categories}`);
  if (datelines !== 8) throw new Error(`expected 8 post datelines to tag, tagged ${datelines}`);

  // each article's prose container, so the CMS body field can replace it
  const bodyStyle = 'color:var(--text-2);font-size:15px;line-height:1.8';
  let bodies = 0;
  slice = slice.replace(new RegExp(`(<div style="${escapeRe(bodyStyle)}")`, 'g'), (open) => {
    bodies++;
    return `${open.slice(0, 4)} data-cms-body${open.slice(4)}`;
  });
  if (bodies !== 4) throw new Error(`expected 4 article bodies to tag, tagged ${bodies}`);

  return body.slice(0, start) + slice + body.slice(end);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ *
 * CMS field bindings.
 *
 * The CMS design is a mockup: its inputs carry no name or id, so nothing
 * identifies which content field each one edits. Each pane's fields are listed
 * here in document order and annotated with data-field, keyed to the same content
 * paths the portfolio hydrates from. A null entry is a control with no content
 * behind it (the post search box, the two decorative range sliders).
 *
 * Counts are asserted, so if the design gains or loses a field the build stops
 * rather than silently shifting every binding after it by one.
 * ------------------------------------------------------------------ */
const CMS_FIELDS = {
  hero: [
    'hero.name',
    'hero.role',
    'hero.tagline',
    'hero.location',
    'hero.availability',
    'hero.chips.0',
    'hero.chips.1',
    'hero.chips.2',
    null, // range: nebula intensity, presentation only
    null, // range: grain, presentation only
  ],
  about: ['about.heading', 'about.body', 'about.region', 'about.timezone', 'about.years'],
  // These edit the most recent role; the rest of the timeline is the list editor.
  experience: [
    'experience.items.0.role',
    'experience.items.0.company',
    'experience.items.0.start',
    'experience.items.0.end',
    'experience.items.0.location',
    'experience.items.0.description',
  ],
  contact: ['contact.email', 'contact.linkedin', 'contact.github', 'contact.successMessage'],
  resume: ['resume.name', 'resume.title', 'resume.summary', 'resume.filename'],
  // these edit whichever post is selected, so they are bound to post-relative paths
  blog: [
    null, // search box, filters the list only
    'post.title',
    'post.readTime',
    'post.date',
    'post.alt',
    'post.excerpt',
    'post.body',
  ],
  settings: ['settings.pageTitle', 'settings.metaDescription', 'settings.domain'],
};

/* The mockup's switches, accent swatches and sliders carry no identity either.
 * Toggles are listed per pane in document order, like CMS_FIELDS. */
const CMS_TOGGLES = {
  hero: ['hero.showCodeLines', 'settings.reduceMotion'],
  contact: ['contact.confetti', 'contact.emailOnMessage'],
  resume: [
    'resume.sections.summary',
    'resume.sections.experience',
    'resume.sections.education',
    'resume.sections.certifications',
    'resume.sections.skills',
    'resume.sections.references',
    'resume.showDownload',
  ],
};

// data-range names already exist in the design (density, pull) — map them to paths.
const CMS_RANGES = { density: 'hero.starDensity', pull: 'hero.cursorPull' };

function annotateCmsControls(body) {
  const panes = [];
  const re = /data-panel="([a-z]+)"/g;
  let m;
  while ((m = re.exec(body))) panes.push({ name: m[1], start: m.index });
  panes.push({ name: '__end', start: body.length });

  let toggles = 0;
  for (let i = panes.length - 2; i >= 0; i--) {
    const expected = CMS_TOGGLES[panes[i].name];
    const slice = body.slice(panes[i].start, panes[i + 1].start);
    const found = [...slice.matchAll(/<button\b[^>]*\bdata-toggle=/g)];

    if (!expected) {
      if (found.length) throw new Error(`CMS pane "${panes[i].name}" has unmapped toggles`);
      continue;
    }
    if (found.length !== expected.length) {
      throw new Error(
        `CMS pane "${panes[i].name}" has ${found.length} toggles but CMS_TOGGLES lists ${expected.length}`
      );
    }

    let patched = slice;
    for (let f = found.length - 1; f >= 0; f--) {
      const at = found[f].index + '<button'.length;
      patched = patched.slice(0, at) + ` data-toggle-field="${expected[f]}"` + patched.slice(at);
      toggles++;
    }
    body = body.slice(0, panes[i].start) + patched + body.slice(panes[i + 1].start);
  }

  // Accent swatches: the colour each one selects is only in its inline background.
  let swatches = 0;
  body = body.replace(/<button\b([^>]*\bdata-swatch=[^>]*)>/g, (whole, attrs) => {
    const colour = (attrs.match(/background:\s*(#[0-9A-Fa-f]{3,8})/) || [])[1];
    if (!colour) return whole;
    swatches++;
    return `<button data-swatch-value="${colour}"${attrs}>`;
  });

  // Sliders map to content paths by their existing data-range name.
  let ranges = 0;
  body = body.replace(/<input\b([^>]*\bdata-range="([a-z]+)"[^>]*)>/g, (whole, attrs, name) => {
    const contentPath = CMS_RANGES[name];
    if (!contentPath) throw new Error(`CMS: no content path for slider "${name}"`);
    ranges++;
    return `<input data-range-field="${contentPath}"${attrs}>`;
  });

  if (toggles !== 11) throw new Error(`CMS: expected 11 toggles, bound ${toggles}`);
  if (swatches !== 4) throw new Error(`CMS: expected 4 accent swatches, bound ${swatches}`);
  if (ranges !== 2) throw new Error(`CMS: expected 2 sliders, bound ${ranges}`);

  return { body, toggles, swatches, ranges };
}

function annotateCmsFields(body) {
  const panes = [];
  const re = /data-panel="([a-z]+)"/g;
  let m;
  while ((m = re.exec(body))) panes.push({ name: m[1], start: m.index });
  if (!panes.length) throw new Error('no CMS panels found');
  panes.push({ name: '__end', start: body.length });

  let bound = 0;
  // rebuild back-to-front so earlier offsets stay valid as we splice
  for (let i = panes.length - 2; i >= 0; i--) {
    const pane = panes[i].name;
    const expected = CMS_FIELDS[pane];
    const slice = body.slice(panes[i].start, panes[i + 1].start);
    const found = [...slice.matchAll(/<(input|textarea)\b/g)];

    if (!expected) {
      if (found.length) {
        throw new Error(
          `CMS pane "${pane}" has ${found.length} field(s) but no CMS_FIELDS entry — ` +
            'add one so they can be bound.'
        );
      }
      continue;
    }
    if (found.length !== expected.length) {
      throw new Error(
        `CMS pane "${pane}" has ${found.length} fields but CMS_FIELDS lists ${expected.length}. ` +
          'The design changed — re-check the order and update CMS_FIELDS.'
      );
    }

    let patched = slice;
    for (let f = found.length - 1; f >= 0; f--) {
      const contentPath = expected[f];
      if (!contentPath) continue;
      const at = found[f].index + found[f][0].length;
      patched = patched.slice(0, at) + ` data-field="${contentPath}"` + patched.slice(at);
      bound++;
    }

    body = body.slice(0, panes[i].start) + patched + body.slice(panes[i + 1].start);
  }

  return { body: tagCmsPostRows(body), bound };
}

/* The CMS post list is six hardcoded rows (four live, two drafts) carrying only
 * data-post="1..6". Give each the id of the post it stands for — in document
 * order, matching the content document's posts[] — so selecting a row edits the
 * right post. The two drafts are stored and editable but have no markup in the
 * portfolio's blog layout, which is built around four posts. */
const CMS_POST_IDS = [
  'post-cold-starts',
  'post-leave-api',
  'post-pooling',
  'post-firstyear',
  'post-terraform-modules',
  'post-cloudwatch-logs',
];

function tagCmsPostRows(body) {
  let i = 0;
  const out = body.replace(/<(\w+)([^>]*\bdata-post="\d+"[^>]*)>/g, (whole, tag, attrs) => {
    if (i >= CMS_POST_IDS.length) return whole;
    return `<${tag}${attrs} data-post-id="${CMS_POST_IDS[i++]}">`;
  });
  if (i !== CMS_POST_IDS.length) {
    throw new Error(`CMS: expected ${CMS_POST_IDS.length} post rows to tag, tagged ${i}`);
  }
  return out;
}

// The design hides .nav-links below 760px without providing a menu, which
// strands the resume and blog views on phones. Compact + wrap them instead.
function fixMobileNav(helmet) {
  const rule = '    .nav-links{display:none!important}';
  if (!helmet.includes(rule)) throw new Error('mobile nav rule not found — check the source CSS');
  return helmet.replace(
    rule,
    [
      '    /* keep the resume/blog views reachable on phones (design hid these outright) */',
      '    nav[aria-label="Primary"]{flex-wrap:wrap!important;gap:10px!important}',
      '    .nav-links{gap:3px!important;flex-wrap:wrap!important}',
      '    .nav-links .nav-chip{font-size:11px!important;padding:6px 8px!important}',
    ].join('\n')
  );
}

/* The CMS rail buttons carry inline `background:none; color:var(--text-2);
 * border-left:2px solid transparent`, and inline styles beat stylesheet rules —
 * so the design's own `.rail-item[data-active="1"]` rule never applied and the
 * selected pane looked pixel-identical to every other one. These overrides need
 * !important to get past the inline styles.
 *
 * The transparent border is on every item, not just the active one, so revealing
 * it cannot shift the rail's layout as you move between panes. */
function markCmsActiveNav(helmet) {
  const rule = '.rail-item[data-active="1"]{background:var(--fill);color:var(--primary);border-left-color:var(--primary)}';
  if (!helmet.includes(rule)) {
    throw new Error(
      "CMS: the .rail-item active rule wasn't found — the design changed, so re-check " +
        'how the active nav item is styled before overriding it.'
    );
  }

  const overrides = [
    '',
    '  /* active nav item: bordered so it reads as selected (see markCmsActiveNav) */',
    '  .rail-item{',
    '    border:1px solid transparent!important;border-left-width:2px!important;',
    '    border-radius:8px!important;margin:0 8px!important;width:auto!important;',
    '  }',
    '  .rail-item[data-active="1"]{',
    '    background:var(--fill)!important;color:var(--primary)!important;',
    '    border-color:var(--primary)!important;',
    '    box-shadow:0 0 0 1px rgba(106,255,0,.18),0 6px 18px -12px var(--primary)!important;',
    '  }',
    '  .rail-item:hover:not([data-active="1"]){',
    '    background:var(--fill)!important;color:var(--text)!important;',
    '    border-color:var(--border)!important;',
    '  }',
  ].join('\n');

  return helmet.replace(rule, rule + overrides);
}


/* ------------------- first-paint theming -------------------
 * The accent lives in the content document, which only arrives after the first
 * paint — so a saved colour used to flash the design's original green on every
 * reload. This remembers the last accent seen on this device and hides the page
 * for the few milliseconds it takes to apply it, revealing as soon as the content
 * document has been applied. It reveals on a timer and on load as well, so a
 * failed fetch or a script error can never leave a blank page behind.
 *
 * Only devices that have seen a non-default accent are ever hidden; a first-time
 * visitor paints immediately.
 * ---------------------------------------------------------- */
const THEME_GUARD = `
<script>
(function () {
  'use strict';
  var saved = null;
  try { saved = localStorage.getItem('dc.accent'); } catch (e) { saved = null; }
  if (!saved || !/^#[0-9a-fA-F]{3,6}$/.test(saved) || saved.toLowerCase() === '#6aff00') return;

  window.__cachedAccent = saved;

  var guard = document.createElement('style');
  guard.id = 'theme-guard';
  guard.textContent = 'html{visibility:hidden}';
  document.head.appendChild(guard);

  window.__themeReveal = function () {
    var el = document.getElementById('theme-guard');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  };
  setTimeout(window.__themeReveal, 1200);
  window.addEventListener('load', window.__themeReveal);
})();
</script>
`;

function page({ helmet, body, runtime, head }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${THEME_GUARD}
${head}
${helmet}
</head>
<body>
${body}
${runtime}
</body>
</html>
`;
}

/* ------------------- theming -------------------
 * Setting --primary alone themed almost nothing: the design hardcodes its greens
 * in inline styles, derives --glow/--accent-fill/--card-bg/the nebula gradients
 * from literal rgba(106,255,0,…), paints the hero canvas with colour strings in
 * JS, and lists confetti colours in an array.
 *
 * So instead of swapping one variable, every green-family colour in the page is
 * rotated to the accent's hue — stylesheets, inline styles, hover/focus
 * attributes, SVG fill/stroke attributes, canvas strokes and confetti. Saturation
 * and lightness are preserved, which keeps the design's contrast relationships
 * intact while moving the whole palette onto the new hue.
 *
 * Originals are cached on the first run so repeated changes always recompute from
 * the design's own values rather than compounding.
 * ----------------------------------------------- */
const THEME_RUNTIME = `
<script>
(function () {
  'use strict';

  var BASE_HEX = '#6AFF00';           // the accent the design was drawn with
  var GREEN_MIN = 55, GREEN_MAX = 178; // hues treated as "the theme colour"

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s, l: l };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (!s) { var v = Math.round(l * 255); return { r: v, g: v, b: v }; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    function hue(t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return {
      r: Math.round(hue(h + 1 / 3) * 255),
      g: Math.round(hue(h) * 255),
      b: Math.round(hue(h - 1 / 3) * 255),
    };
  }

  var delta = 0;

  function shift(r, g, b) {
    var hsl = rgbToHsl(r, g, b);
    // leave anything outside the green family alone — status ambers, error pinks,
    // the near-black background and pure greys keep their meaning
    if (hsl.s < 0.12) return null;
    if (hsl.h < GREEN_MIN || hsl.h > GREEN_MAX) return null;
    return hslToRgb(hsl.h + delta, hsl.s, hsl.l);
  }

  var HEX_RE = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/g;
  var RGB_RE = /rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*(?:,\\s*([\\d.]+)\\s*)?\\)/g;

  // Concrete replacements for var(--x) references, filled once the originals are
  // known. Inline styles get the concrete value substituted rather than left as a
  // var(): the design's tiles kept their old border colour even after --border was
  // updated on the declaring element, so relying on var resolution here is not
  // dependable. Substituting removes the indirection.
  var varValues = {};

  function substituteVars(text) {
    if (!text || !text.indexOf) return text;
    return text.replace(/var\\(\\s*(--[a-z0-9-]+)\\s*(?:,[^()]*)?\\)/gi, function (whole, name) {
      var value = varValues[name];
      return value ? value : whole;
    });
  }

  // rewrite every colour token in an arbitrary CSS/attribute string
  function recolour(text) {
    if (!text || delta === 0) return text;
    return text
      .replace(HEX_RE, function (whole, body) {
        var rgb = hexToRgb(body);
        var out = shift(rgb.r, rgb.g, rgb.b);
        if (!out) return whole;
        return 'rgb(' + out.r + ',' + out.g + ',' + out.b + ')';
      })
      .replace(RGB_RE, function (whole, r, g, b, a) {
        var out = shift(+r, +g, +b);
        if (!out) return whole;
        return a === undefined
          ? 'rgb(' + out.r + ',' + out.g + ',' + out.b + ')'
          : 'rgba(' + out.r + ',' + out.g + ',' + out.b + ',' + a + ')';
      });
  }

  var ATTRS = ['style', 'style-hover', 'style-focus', 'fill', 'stroke', 'data-tip'];
  var cached = false;

  // Every custom property either page themes from. Rewriting the stylesheet text
  // alone proved unreliable — elements using var(--border) kept their old computed
  // colour — so the rotated values are also set inline on the elements that declare
  // them, which forces the cascade to recompute.
  var THEME_VARS = [
    '--bg', '--surface', '--surface-elev', '--surface-2', '--text', '--text-2', '--text-3',
    '--border', '--border-hi', '--primary', '--glow', '--card-bg', '--accent-fill', '--fill',
    '--neb1', '--neb2', '--neb3', '--grid-line', '--hair',
  ];
  var varHosts = [];
  var origVars = [];

  function cacheVarHosts() {
    varHosts = [document.documentElement, document.body].concat(
      Array.prototype.slice.call(document.querySelectorAll('[data-theme]'))
    ).filter(Boolean);

    origVars = varHosts.map(function (host) {
      var computed = getComputedStyle(host);
      var values = {};
      THEME_VARS.forEach(function (name) {
        var value = computed.getPropertyValue(name);
        if (value && value.trim()) values[name] = value.trim();
      });
      return values;
    });
  }

  function repaintVars() {
    varValues = {};
    varHosts.forEach(function (host, i) {
      var values = origVars[i] || {};
      Object.keys(values).forEach(function (name) {
        var next = recolour(values[name]);
        host.style.setProperty(name, next);
        // last host wins, which is the innermost [data-theme] element
        varValues[name] = next;
      });
    });
  }

  // Captures anything not yet captured. Called on every accent change, because the
  // content hydrator clones cards and rows after the first theming pass and those
  // clones need their own originals recorded.
  function cacheNewElements() {
    document.querySelectorAll('[style],[style-hover],[style-focus],[fill],[stroke]').forEach(function (el) {
      ATTRS.forEach(function (name) {
        if (name === 'data-tip') return;
        var value = el.getAttribute(name);
        if (value && !el.hasAttribute('data-orig-' + name)) {
          el.setAttribute('data-orig-' + name, value);
        }
      });
    });
  }

  function cacheOriginals() {
    if (!cached) {
      cached = true;
      cacheVarHosts();
      document.querySelectorAll('style').forEach(function (el) {
        if (!el.id) el.setAttribute('data-theme-src', el.textContent);
      });
    }
    cacheNewElements();
  }

  function repaint() {
    document.querySelectorAll('style[data-theme-src]').forEach(function (el) {
      var src = el.getAttribute('data-theme-src');
      var next = recolour(src);
      if (el.textContent !== next) el.textContent = next;
    });
    ATTRS.forEach(function (name) {
      if (name === 'data-tip') return;
      document.querySelectorAll('[data-orig-' + name + ']').forEach(function (el) {
        var src = el.getAttribute('data-orig-' + name);
        var next = recolour(substituteVars(src));
        if (el.getAttribute(name) !== next) el.setAttribute(name, next);
      });
    });
  }

  // The bundled blog art is a separate SVG document, so its colours can't be
  // rewritten from here — rotate it with a filter instead so it matches.
  function paintArt() {
    var id = 'theme-art-filter';
    var el = document.getElementById(id);
    if (!delta) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent =
      'img[data-slot],img[data-media-preview]{filter:hue-rotate(' + delta.toFixed(1) + 'deg)}';
  }

  // Belt to the braces above. Rewriting stylesheets, inline styles and the custom
  // properties covers nearly everything, but a few elements kept resolving
  // var(--border) to the original green whatever was done to the declaring element.
  // This pass reads what is actually painted and rotates anything still in the green
  // band, which is verifiable rather than hopeful. Safe to repeat: once rotated, a
  // colour is out of the band and gets skipped.
  var PAINTED = [
    'color', 'background-color', 'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color', 'outline-color', 'fill', 'stroke',
  ];

  function forcePainted() {
    if (!delta) return 0;
    var fixed = 0;
    document.querySelectorAll('*').forEach(function (el) {
      if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') return;
      var cs = getComputedStyle(el);
      PAINTED.forEach(function (prop) {
        var value = cs.getPropertyValue(prop);
        var m = value && value.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
        if (!m) return;
        var out = shift(+m[1], +m[2], +m[3]);
        if (!out) return;
        var next = m[4] === undefined
          ? 'rgb(' + out.r + ',' + out.g + ',' + out.b + ')'
          : 'rgba(' + out.r + ',' + out.g + ',' + out.b + ',' + m[4] + ')';
        el.style.setProperty(prop, next, 'important');
        fixed++;
      });
    });
    return fixed;
  }

  window.__applyAccent = function (hex) {
    if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{3,6}$/.test(hex)) return;
    var base = hexToRgb(BASE_HEX);
    var target = hexToRgb(hex);
    var from = rgbToHsl(base.r, base.g, base.b);
    var to = rgbToHsl(target.r, target.g, target.b);

    cacheOriginals();
    delta = to.h - from.h;

    repaintVars(); // fills the var -> concrete map that repaint() substitutes with
    repaint();
    paintArt();
    window.__themeForced = forcePainted();

    // canvas paints with colour strings in JS, so hand it the rotated values
    var node = hslToRgb(to.h, 0.85, 0.65);
    window.__accentLine = to.h;
    window.__accentNode = node.r + ',' + node.g + ',' + node.b;
    window.__accentHex = hex;
    if (window.__heroRebuild) window.__heroRebuild();
  };

  // Paint the accent this device saw last before the first frame, so the page is
  // never briefly the wrong colour. The authoritative value arrives with the
  // content document and is applied again there — normally the same value, so
  // nothing moves. The guard in <head> is what was hiding the page until now.
  if (window.__cachedAccent) {
    try { window.__applyAccent(window.__cachedAccent); } catch (e) {}
  }
})();
</script>
`;

/* ------------------- shared runtime preamble ------------------- */
// style-hover / style-focus shim + data-on-* binding, used by both pages.
const SHARED_RUNTIME = `
  function styleShim() {
    // Values are read at event time, not cached at bind time: theming rewrites
    // these attributes later, and a cached copy would revert the new colours on
    // the next mouseleave.
    function pair(selector, extra, on, off) {
      document.querySelectorAll(selector).forEach(function (el) {
        el.addEventListener(on, function () {
          var base = el.getAttribute('style') || '';
          el.setAttribute('data-style-base', base);
          el.setAttribute('style', base + ';' + (el.getAttribute(extra) || ''));
        });
        el.addEventListener(off, function () {
          el.setAttribute('style', el.getAttribute('data-style-base') || '');
        });
      });
    }
    pair('[style-hover]', 'style-hover', 'mouseenter', 'mouseleave');
    pair('[style-focus]', 'style-focus', 'focus', 'blur');
  }

  function bindHandlers(handlers, types) {
    types.forEach(function (type) {
      document.querySelectorAll('[data-on-' + type + ']').forEach(function (el) {
        var fn = handlers[el.getAttribute('data-on-' + type)];
        if (fn) el.addEventListener(type, fn);
      });
    });
  }
`;

/* ===================== page 1: the portfolio ===================== */

const PORTFOLIO_RUNTIME = `
<script>
/* Vanilla port of the Claude Design (dc) component logic for this page.
   Refs are ids (dc-setX), handlers are data-on-<event> attributes. */
(function () {
  'use strict';
${SHARED_RUNTIME}
  var byId = function (n) { return document.getElementById('dc-' + n); };
  var root = byId('setRoot');
  var cursorRing = byId('setCursorRing');
  var cursorDot = byId('setCursorDot');
  var heroCanvas = byId('setHeroCanvas');
  var heroPar = byId('setHeroParallax');
  var stack = byId('setStack');
  var scan = byId('setScan');
  var contact = byId('setContact');
  var form = byId('setForm');
  var status = byId('setStatus');

  function onScroll(fn) {
    window.addEventListener('scroll', fn, { passive: true });
    document.addEventListener('scroll', fn, { passive: true, capture: true });
    window.addEventListener('resize', fn);
  }

  /* ---------- animated counters ---------- */
  function initCounters() {
    if (!root) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var run = function (el) {
      if (el.dataset.ran) return;
      el.dataset.ran = '1';
      var target = parseFloat(el.dataset.count);
      var suffix = el.dataset.suffix || '';
      if (reduce) { el.textContent = target + suffix; return; }
      var dur = 1500, start = Date.now(), timer;
      var tick = function () {
        var p = Math.min(1, (Date.now() - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        if (p >= 1) { el.textContent = target + suffix; clearInterval(timer); }
        else el.textContent = Math.round(eased * target) + '';
      };
      timer = setInterval(tick, 33);
      tick();
    };
    var counters = [].slice.call(root.querySelectorAll('[data-count]'));
    var check = function () {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      counters.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) run(el);
      });
    };
    try {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) run(e.target); });
      }, { threshold: 0.5 });
      counters.forEach(function (el) { io.observe(el); });
    } catch (_) {}
    check();
    onScroll(check);
    setTimeout(function () { counters.forEach(run); }, 1700);
  }

  /* ---------- tech-stack scan sweep ---------- */
  function initScan() {
    if (!stack || !scan) return;
    var done = false;
    var trigger = function () {
      if (done) return;
      done = true;
      scan.style.animation = 'scanSweep 1.5s ease-out forwards';
    };
    var check = function () {
      var r = stack.getBoundingClientRect();
      if (r.top < (window.innerHeight || 800) * 0.8 && r.bottom > 0) trigger();
    };
    try {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) trigger(); });
      }, { threshold: 0.3 });
      io.observe(stack);
    } catch (_) {}
    check();
    onScroll(check);
    setTimeout(trigger, 1900);
  }

  /* ---------- confetti burst on form success ---------- */
  function burst(ox, oy) {
    var host = contact;
    if (!host) return;
    // CMS: Contact -> "Confetti on submit"
    if (window.__contactConfetti === false) return;
    var accent = window.__accentHex || '#6AFF00';
    var colors = [accent, accent, '#3aa300', '#06b6d4', '#ffffff'];
    for (var i = 0; i < 46; i++) {
      var p = document.createElement('div');
      var size = 5 + Math.random() * 6;
      p.style.cssText = 'position:absolute;z-index:6;pointer-events:none;border-radius:2px;left:' + ox +
        'px;top:' + oy + 'px;width:' + size + 'px;height:' + size + 'px;background:' + colors[i % colors.length] +
        ';box-shadow:0 0 8px ' + colors[i % colors.length];
      host.appendChild(p);
      var ang = Math.random() * Math.PI * 2;
      var dist = 80 + Math.random() * 220;
      var dx = Math.cos(ang) * dist;
      var dy = Math.sin(ang) * dist - 120;
      (function (el) {
        if (el.animate) {
          var anim = el.animate([
            { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.3) rotate(' + (Math.random() * 540) + 'deg)', opacity: 0 }
          ], { duration: 900 + Math.random() * 700, easing: 'cubic-bezier(.16,1,.3,1)' });
          anim.onfinish = function () { el.remove(); };
        }
        setTimeout(function () { el.remove(); }, 1900);
      })(p);
    }
  }

  /* ---------- custom cursor ---------- */
  function initCursor() {
    var fine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
    if (!fine || !cursorRing || !root) return;
    root.classList.add('cur-custom');
    var place = function (x, y) {
      var t = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
      cursorRing.style.transform = t;
      if (cursorDot) cursorDot.style.transform = t;
    };
    document.addEventListener('mousemove', function (e) {
      cursorRing.style.opacity = '1';
      if (cursorDot) cursorDot.style.opacity = '1';
      place(e.clientX, e.clientY);
      var t = e.target;
      var textField = t && t.closest && t.closest('input,textarea,[contenteditable]');
      if (textField) {
        cursorRing.style.opacity = '0';
        if (cursorDot) cursorDot.style.opacity = '0';
        return;
      }
      var hot = t && t.closest && t.closest('a,button,[role="button"],[tabindex],.svc-tile,.proj-card,.cert-card,.nav-chip,[data-ct-row],label');
      cursorRing.dataset.cursorHover = hot ? '1' : '';
    }, { passive: true });
    document.addEventListener('mousedown', function () { cursorRing.dataset.cursorDown = '1'; });
    document.addEventListener('mouseup', function () { cursorRing.dataset.cursorDown = ''; });
    var hide = function () {
      cursorRing.style.opacity = '0';
      if (cursorDot) cursorDot.style.opacity = '0';
    };
    document.addEventListener('mouseleave', hide);
    window.addEventListener('blur', hide);
  }

  /* ---------- hero constellation canvas ---------- */
  function initHero() {
    var c = heroCanvas;
    if (!c) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ctx = c.getContext('2d');
    var host = c.parentElement;
    var w = 0, h = 0;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var nodes = [];
    var mouse = { x: -9999, y: -9999 };
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    var build = function () {
      var r = host.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = w * dpr; c.height = h * dpr;
      c.style.width = w + 'px'; c.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // area-derived count, scaled by the CMS star-density setting (64 = as designed)
      var density = typeof window.__heroStarDensity === 'number' ? window.__heroStarDensity : 64;
      var base = Math.round(w * h / 15000);
      var count = Math.max(12, Math.min(220, Math.round(base * (density / 64))));
      nodes = [];
      for (var k = 0; k < count; k++) {
        var z = rnd(0.35, 1);
        nodes.push({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.22, 0.22) * z, vy: rnd(-0.22, 0.22) * z, z: z });
      }
    };
    var D = 145, DM = 200;
    var frame = function () {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < -24) n.x = w + 24;
        if (n.x > w + 24) n.x = -24;
        if (n.y < -24) n.y = h + 24;
        if (n.y > h + 24) n.y = -24;
      }
      for (var a = 0; a < nodes.length; a++) {
        var p = nodes[a];
        for (var b = a + 1; b < nodes.length; b++) {
          var q = nodes[b];
          var dx = p.x - q.x, dy = p.y - q.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < D) {
            var al = (1 - d / D) * 0.5 * Math.min(p.z, q.z);
            ctx.strokeStyle = 'rgba(' + (window.__accentLink || '106,255,0') + ',' + al.toFixed(3) + ')';
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        var mdx = p.x - mouse.x, mdy = p.y - mouse.y, md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < DM) {
          var ml = (1 - md / DM) * 0.65;
          ctx.strokeStyle = 'rgba(' + (window.__accentNode || '150,255,80') + ',' + ml.toFixed(3) + ')';
          ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          // pull strength is CMS-controlled (42 = as designed, 0 = no attraction)
          var pull = typeof window.__heroCursorPull === 'number' ? window.__heroCursorPull : 42;
          var k = (pull / 42) * 0.7;
          p.x -= (mdx / (md || 1)) * (1 - md / DM) * k;
          p.y -= (mdy / (md || 1)) * (1 - md / DM) * k;
        }
      }
      for (var j = 0; j < nodes.length; j++) {
        var nn = nodes[j];
        var rr = 1.1 + nn.z * 1.9;
        ctx.beginPath(); ctx.arc(nn.x, nn.y, rr, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + (window.__accentNode || '150,255,80') + ',' + (0.45 + nn.z * 0.55).toFixed(2) + ')';
        ctx.fill();
      }
    };
    var rebuild = function () {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      build(); frame();
      return true;
    };
    // The dc runtime mounted after layout settled; running inline we may measure the
    // hero before it has a size (background tab, restored page). Poll briefly until
    // it reports one, then keep it in step with resizes.
    if (!rebuild()) {
      var tries = 0;
      var poll = setInterval(function () {
        if (rebuild() || ++tries > 100) clearInterval(poll);
      }, 100);
    }
    window.addEventListener('resize', rebuild);
    window.addEventListener('load', rebuild);
    if (window.ResizeObserver) new ResizeObserver(rebuild).observe(host);

    // lets the content hydrator re-seed the field after a density change
    window.__heroRebuild = rebuild;
    if (!reduce) setInterval(frame, 33);
    document.addEventListener('mousemove', function (e) {
      var r = host.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      var nx = (e.clientX / window.innerWidth - 0.5) * 2;
      var ny = (e.clientY / window.innerHeight - 0.5) * 2;
      if (heroPar) heroPar.style.transform = 'translate(' + (nx * -16).toFixed(1) + 'px,' + (ny * -13).toFixed(1) + 'px)';
      host.querySelectorAll('.hero-float').forEach(function (f, i) {
        var kf = (i % 2 ? 1.1 : 1.7);
        f.style.transform = 'translate(' + (nx * 24 * kf).toFixed(1) + 'px,' + (ny * 20 * kf).toFixed(1) + 'px)';
      });
    }, { passive: true });
    host.addEventListener('mouseleave', function () { mouse.x = -9999; mouse.y = -9999; });
  }

  /* ---------- views: home / resume / blog ---------- */
  function showView(v) {
    if (!root) return;
    root.querySelectorAll('.view').forEach(function (el) {
      el.style.display = (el.dataset.view === v) ? '' : 'none';
    });
    if (v === 'blog') showBlogList();
  }
  function openPost(id) {
    if (!root) return;
    var list = root.querySelector('[data-blog="list"]');
    if (list) list.style.display = 'none';
    root.querySelectorAll('[data-blog="article"]').forEach(function (a) {
      a.style.display = (a.dataset.id === id) ? 'block' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  function showBlogList() {
    if (!root) return;
    var list = root.querySelector('[data-blog="list"]');
    if (list) list.style.display = '';
    root.querySelectorAll('[data-blog="article"]').forEach(function (a) { a.style.display = 'none'; });
  }

  /* ---------- handlers ---------- */
  var handlers = {
    onNav: function (e) {
      var el = e.target.closest('[data-goto]');
      if (!el) return;
      e.preventDefault();
      var goto = el.dataset.goto;
      var href = el.getAttribute && el.getAttribute('href');
      showView(goto);
      if (goto === 'home' && href && href.charAt(0) === '#' && href.length > 1) {
        var t = root.querySelector(href);
        if (t) {
          setTimeout(function () {
            window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - 72, behavior: 'smooth' });
          }, 60);
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    },

    onBlog: function (e) {
      var o = e.target.closest('[data-open]');
      if (o) { openPost(o.dataset.open); return; }
      var b = e.target.closest('[data-blog-back]');
      if (b) { showBlogList(); window.scrollTo({ top: 0, behavior: 'auto' }); }
    },

    onBlogKey: function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var o = e.target.closest('[data-open]');
      if (o) { e.preventDefault(); openPost(o.dataset.open); return; }
      var b = e.target.closest('[data-blog-back]');
      if (b) { e.preventDefault(); showBlogList(); window.scrollTo({ top: 0, behavior: 'auto' }); }
    },

    downloadResume: function () {
      showView('resume');
      setTimeout(function () { window.print(); }, 60);
    },

    onCardMove: function (e) {
      var c = e.currentTarget, r = c.getBoundingClientRect();
      c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    },

    toggleRow: function (e) {
      var row = e.currentTarget;
      var detail = row.querySelector('[data-ct-detail]');
      var chev = row.querySelector('[data-chev]');
      if (!detail) return;
      var open = detail.style.maxHeight && detail.style.maxHeight !== '0px';
      if (open) {
        detail.style.maxHeight = '0px';
        if (chev) chev.style.transform = 'rotate(0deg)';
      } else {
        detail.style.maxHeight = detail.scrollHeight + 'px';
        if (chev) chev.style.transform = 'rotate(180deg)';
      }
    },

    sendMessage: function (e) {
      e.preventDefault();
      var f = form, host = contact;
      if (!f) return;
      var name = f.querySelector('#cf-name'), email = f.querySelector('#cf-email'), msg = f.querySelector('#cf-msg');
      var emailRe = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      var fail = function (m, el) {
        if (status) { status.textContent = m; status.style.color = '#ff8aa0'; }
        if (el) el.focus();
      };
      if (!name.value.trim()) return fail('Please add your name so I know who I\\u2019m talking to.', name);
      if (!email.value.trim() || !emailRe.test(email.value.trim())) return fail('Please enter a valid email so I can reply.', email);
      if (!msg.value.trim()) return fail('Add a short message and you\\u2019re good to go.', msg);

      var btn = f.querySelector('button[type="submit"]');
      var succeed = function () {
        if (status) status.textContent = '';
        if (!host) return;
        var r = host.getBoundingClientRect();
        var b = btn ? btn.getBoundingClientRect() : r;
        burst(b.left - r.left + b.width / 2, b.top - r.top + b.height / 2);
        var success = host.querySelector('[data-cf-success]');
        f.style.display = 'none';
        if (success) {
          success.style.display = 'block';
          var who = success.querySelector('[data-cf-name]');
          if (who) who.textContent = name.value.trim().split(' ')[0] || 'there';
        }
      };

      if (status) { status.style.color = '#7fcc66'; status.textContent = 'Deploying message\\u2026'; }
      if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
      var release = function () { if (btn) { btn.disabled = false; btn.style.opacity = ''; } };

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.value.trim(), email: email.value.trim(), message: msg.value.trim() })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.ok) throw new Error((data && data.error) || 'Request failed');
          release();
          succeed();
        });
      }).catch(function () {
        release();
        fail('Couldn\\u2019t send that \\u2014 please email daniel.lotsu.jnr@gmail.com directly.');
      });
    }
  };

  /* ---------- boot ---------- */
  if (root) root.dataset.theme = 'dark';
  styleShim();
  bindHandlers(handlers, ['click', 'mousemove', 'submit', 'keydown']);

  // the content hydrator clones experience rows, which need this handler attached
  window.__toggleCtRow = handlers.toggleRow;
  initCounters();
  initScan();
  initCursor();
  initHero();

  window.__showView = showView;
  window.__openPost = openPost;

  // /?post=<id> opens that post directly — what the CMS Preview button links to.
  // Called again after the content loads, because a post added in the CMS has no
  // article in the static markup to open yet.
  window.__openFromQuery = function () {
    var m = (location.search || '').match(/[?&]post=([^&]+)/);
    if (!m) return false;
    var id = decodeURIComponent(m[1]);
    if (!document.querySelector('[data-blog="article"][data-id="' + id + '"]')) return false;
    showView('blog');
    openPost(id);
    return true;
  };

  if (!window.__openFromQuery()) {
    var hash = (location.hash || '').replace('#', '');
    if (hash === 'resume' || hash === 'blog') showView(hash);
  }
})();
</script>
`;

/* ======================== page 2: the CMS ======================== */

/* ------------------- portfolio content hydration ------------------- *
 * Applies the CMS-managed document to the page. The markup already carries the
 * current values, so this only overwrites what the stored document actually
 * changes — if the API is unreachable the page stands on its own.
 * ------------------------------------------------------------------- */
const HYDRATE_RUNTIME = `
<script>
(function () {
  'use strict';

  var root = document.getElementById('dc-setRoot');

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) {
      return o == null ? undefined : o[k];
    }, obj);
  }

  // Several targets wrap an icon or a status dot alongside their label (the
  // availability pill, the email and LinkedIn links). Writing textContent would
  // delete those children, so when the element has element children only its
  // last text node is rewritten.
  function setText(el, value) {
    if (!el || typeof value !== 'string' || value === '') return;

    if (el.firstElementChild) {
      var lastText = null;
      for (var i = el.childNodes.length - 1; i >= 0; i--) {
        var node = el.childNodes[i];
        if (node.nodeType === 3 && node.nodeValue.trim() !== '') { lastText = node; break; }
      }
      if (lastText) {
        if (lastText.nodeValue !== value) lastText.nodeValue = value;
        return;
      }
      el.appendChild(document.createTextNode(value));
      return;
    }

    if (el.textContent !== value) el.textContent = value;
  }

  function applyScalars(content) {
    document.querySelectorAll('[data-content]').forEach(function (el) {
      var value = get(content, el.getAttribute('data-content'));
      if (typeof value !== 'string' || !value) return;
      setText(el, value);
      // keep mailto:/https: targets in step with the label they display
      if (el.tagName === 'A') {
        var path = el.getAttribute('data-content');
        if (path === 'contact.email') el.href = 'mailto:' + value;
        if (path === 'contact.linkedin') {
          el.href = /^https?:/.test(value) ? value : 'https://' + value.replace(/^\\/+/, '');
        }
      }
    });
  }

  function applyVisibility(content) {
    var hero = content.hero || {};
    var avail = document.querySelector('[data-content="hero.availability"]');
    if (avail && hero.showAvailability === false) {
      var badge = avail.closest('.hero-float') || avail;
      badge.style.display = 'none';
    }

    // the scrolling code columns behind the page
    if (hero.showCodeLines === false) {
      var codeLayer = document.querySelector('pre[style*="codeRise"]');
      var layer = codeLayer && codeLayer.parentElement;
      if (layer) layer.style.display = 'none';
    }

    if (content.contact && content.contact.showForm === false) {
      var form = document.getElementById('dc-setForm');
      if (form) form.style.display = 'none';
    }

    var contactCfg = content.contact || {};
    window.__contactConfetti = contactCfg.confetti !== false;
    if (contactCfg.showSocials === false) {
      var socials = document.querySelector('footer div[style*="display:flex;gap:10px"]');
      if (socials) socials.style.display = 'none';
    }

    var resume = content.resume || {};
    var dl = document.querySelector('[data-download-resume]');
    if (dl && resume.showDownload === false) dl.style.display = 'none';

    // Resume sections, hidden by their heading's text. The sheet's <section>s carry
    // no ids, so match on the uppercase label the design gives each one.
    var sections = resume.sections || {};
    var labels = {
      summary: 'summary', experience: 'experience', education: 'education',
      certifications: 'certifications', skills: 'technical skills', references: 'references',
    };
    var sheet = document.querySelector('.r-sheet');
    if (sheet) {
      Object.keys(labels).forEach(function (key) {
        if (sections[key] !== false) return;
        var heads = sheet.querySelectorAll('h3');
        for (var i = 0; i < heads.length; i++) {
          if ((heads[i].textContent || '').trim().toLowerCase() === labels[key]) {
            var section = heads[i].closest('section');
            if (section) section.style.display = 'none';
            break;
          }
        }
      });
    }
  }

  // The hero canvas reads these on each frame, so a published change to either
  // slider changes the constellation without a reload.
  function applyCanvas(content) {
    var hero = content.hero || {};
    if (typeof hero.starDensity === 'number') window.__heroStarDensity = hero.starDensity;
    if (typeof hero.cursorPull === 'number') window.__heroCursorPull = hero.cursorPull;
    if (window.__heroRebuild) window.__heroRebuild();
  }

  // Slot ids follow the design's own naming, so the four original posts keep the
  // art already bundled for them and new posts get their own slots.
  function slotId(kind, postId) {
    return kind + '-' + String(postId || '').replace(/^post-/, '');
  }

  function fillCard(card, post, kind) {
    card.setAttribute('data-open', post.id);
    card.setAttribute('data-post', post.id);
    setText(card.querySelector('.blog-title'), post.title);

    var cat = card.querySelector('[data-cms-category]');
    if (cat) setText(cat, post.category);

    var dateline = card.querySelector('[data-cms-dateline]');
    if (dateline) setText(dateline, [post.date, post.readTime].filter(Boolean).join(' · '));

    // the featured card also carries an excerpt
    var excerpt = card.querySelector('p');
    if (excerpt && post.excerpt) setText(excerpt, post.excerpt);

    var img = card.querySelector('img[data-slot]');
    if (img) {
      img.setAttribute('data-slot', slotId(kind, post.id));
      if (post.alt) img.alt = post.alt;
    }
  }

  function applyPosts(content) {
    var all = content.blog && content.blog.posts;
    if (!Array.isArray(all) || !all.length) return;
    // the CMS preview link asks for drafts as well
    var preview = /[?&]preview=1(?:&|$)/.test(location.search || '');
    var posts = all.filter(function (p) {
      return p && p.id && (preview || p.published !== false);
    });
    if (!posts.length) return;

    var list = document.querySelector('[data-blog="list"]');
    var feat = list && list.querySelector('.blog-feat');
    var miniRow = list && list.querySelector('.blog-mini-row');
    if (!list || !feat || !miniRow) return;

    template('blogFeat', feat);
    template('blogMini', miniRow.querySelector('.blog-mini'));

    // newest post is the featured one; the rest flow through the 4-column grid,
    // wrapping into as many rows as it takes
    fillCard(feat, posts[0], 'blog-cover');

    var minis = reflow(miniRow, 'blogMini', posts.length - 1, miniRow.querySelector('.blog-mini'));
    minis.forEach(function (card, i) { fillCard(card, posts[i + 1], 'blog-cover'); });

    // the two counters above the list
    var entries = list.querySelector('span');
    if (entries && /entries/.test(entries.textContent || '')) {
      setText(entries, posts.length + (posts.length === 1 ? ' entry' : ' entries') + ' · newest first');
    }
    var earlier = miniRow.parentElement && miniRow.parentElement.querySelector('span:last-child');
    if (earlier && /^\\d+$/.test((earlier.textContent || '').trim())) {
      setText(earlier, String(minis.length).padStart(2, '0'));
    }

    applyArticles(content, posts);
  }

  // Supporting media: extra images shown only in the expanded article, never on the
  // card. Uploads rather than bundled art, so they are laid out at their own aspect
  // ratio and left out of the theme's hue rotation.
  function renderGallery(article, post) {
    var items = (Array.isArray(post.gallery) ? post.gallery : []).filter(function (g) {
      return g && typeof g.url === 'string' && g.url;
    });
    var host = article.querySelector('[data-gallery]');

    if (!items.length) {
      if (host && host.parentNode) host.parentNode.removeChild(host);
      return;
    }

    if (!host) {
      host = document.createElement('div');
      host.setAttribute('data-gallery', '');
      host.style.cssText = 'display:grid;gap:18px;margin:32px 0 0';
      var prose = article.querySelector('[data-cms-body]');
      if (prose && prose.parentNode) prose.parentNode.insertBefore(host, prose.nextSibling);
      else article.appendChild(host);
    }

    // a single image gets the full column; several share a responsive grid
    host.style.gridTemplateColumns = items.length > 1 ? 'repeat(auto-fit,minmax(250px,1fr))' : '1fr';
    host.textContent = '';

    items.forEach(function (item) {
      var figure = document.createElement('figure');
      figure.style.cssText = 'margin:0;display:flex;flex-direction:column;gap:9px';

      // Reserve the picture's own shape when its dimensions are known, so the article
      // does not reflow as it loads and the image is never cropped. Not lazy: the
      // article sits inside a view that starts display:none, where lazy loading does
      // not reliably kick in, and a reader who opened the post wants these anyway.
      var frame = document.createElement('div');
      var ratio = Number(item.w) > 0 && Number(item.h) > 0 ? Number(item.w) / Number(item.h) : 0;
      frame.style.cssText =
        'overflow:hidden;border-radius:12px;border:1px solid var(--border);' +
        'background:var(--surface)' +
        (ratio ? ';aspect-ratio:' + item.w + '/' + item.h : '');
      var img = document.createElement('img');
      img.src = item.url;
      img.alt = item.caption || '';
      img.decoding = 'async';
      img.style.cssText = ratio
        ? 'width:100%;height:100%;object-fit:cover;display:block'
        : 'width:100%;height:auto;display:block';
      frame.appendChild(img);
      figure.appendChild(frame);

      if (item.caption) {
        var caption = document.createElement('figcaption');
        caption.textContent = item.caption;
        caption.style.cssText =
          "font-family:'Syne Mono',monospace;font-size:11.5px;line-height:1.6;color:var(--text-3)";
        figure.appendChild(caption);
      }
      host.appendChild(figure);
    });
  }

  // One article per published post: the four the design ships keep their written
  // prose, and any post added in the CMS gets a cloned article filled from its body.
  function applyArticles(content, posts) {
    var host = document.querySelector('[data-view="blog"] section');
    if (!host) return;
    var existing = Array.prototype.slice.call(document.querySelectorAll('[data-blog="article"]'));
    if (!existing.length) return;
    template('blogArticle', existing[0]);

    posts.forEach(function (post) {
      var article = document.querySelector('[data-blog="article"][data-id="' + post.id + '"]');
      var isNew = false;

      if (!article) {
        article = templates.blogArticle.cloneNode(true);
        article.setAttribute('data-id', post.id);
        article.setAttribute('data-post', post.id);
        article.style.display = 'none';
        host.appendChild(article);
        isNew = true;
      }

      setText(article.querySelector('h1'), post.title);
      var cat = article.querySelector('[data-cms-category]');
      if (cat) setText(cat, post.category);
      var dateline = article.querySelector('[data-cms-dateline]');
      if (dateline) setText(dateline, [post.readTime, post.date].filter(Boolean).join(' · '));

      var img = article.querySelector('img[data-slot]');
      if (img) {
        // the same picture as the card: one image per post
        img.setAttribute('data-slot', slotId('blog-cover', post.id));
        if (post.alt) img.alt = post.alt;
      }

      renderGallery(article, post);

      var prose = article.querySelector('[data-cms-body]');
      var body = typeof post.body === 'string' ? post.body.trim() : '';

      // Replace the prose when the CMS holds a body. A cloned article starts with
      // the template's copy, which belongs to a different post, so it must always
      // be replaced — with the excerpt if there's no body yet.
      if (prose && (body || isNew)) {
        prose.textContent = '';
        var text = body || post.excerpt || '';
        if (!text) {
          var placeholder = document.createElement('p');
          placeholder.textContent = 'This post has no body yet.';
          placeholder.style.opacity = '.75';
          prose.appendChild(placeholder);
        } else {
          text.split(/\\n\\s*\\n/).forEach(function (para) {
            var trimmed = para.trim();
            if (!trimmed) return;
            var p = document.createElement('p');
            p.textContent = trimmed;
            prose.appendChild(p);
          });
        }
      }
    });

    // articles whose post was unpublished or deleted must not be reachable
    var live = posts.map(function (p) { return p.id; });
    existing.concat([]).forEach(function (article) {
      var id = article.getAttribute('data-id');
      if (live.indexOf(id) === -1) article.remove();
    });
  }

  /* ---------------- editable collections ----------------
   * Certifications, tech stack, projects and the experience timeline are rendered
   * from the content lists. The design's own first item is kept as a template and
   * cloned, so CMS-added entries inherit the exact styling — including the
   * per-position transforms on the certificate cards.
   * ------------------------------------------------------ */

  var templates = {};

  function template(name, node) {
    if (!templates[name] && node) templates[name] = node.cloneNode(true);
    return templates[name];
  }

  // grow or shrink a container to hold exactly count clones of its template
  function reflow(container, name, count, first) {
    var tpl = template(name, first);
    if (!container || !tpl) return [];
    var existing = Array.prototype.slice.call(container.children).filter(function (c) {
      return c.matches(tpl.tagName + (tpl.className ? '.' + tpl.className.split(' ')[0] : ''));
    });
    while (existing.length > count) container.removeChild(existing.pop());
    while (existing.length < count) {
      var clone = tpl.cloneNode(true);
      container.appendChild(clone);
      existing.push(clone);
    }
    return existing;
  }

  function applyCerts(content) {
    var certs = content.certs;
    if (!Array.isArray(certs) || !certs.length) return;
    var grid = document.querySelector('.cert-grid');
    if (!grid) return;
    var cards = reflow(grid, 'cert', certs.length, grid.querySelector('.cert-card'));

    cards.forEach(function (card, i) {
      var cert = certs[i];
      var level = card.querySelector('div[style*="text-transform:uppercase"]');
      var title = card.querySelector('h3');
      var meta = card.querySelector('p');
      if (level) setText(level, cert.level);
      if (title) setText(title, cert.title);
      if (meta) {
        meta.textContent = [cert.issuer, cert.year].filter(Boolean).join(' · ');
      }
    });
  }

  // A stack item's icon is a slug from the drawn set; anything else (an emoji, a
  // letter) is shown as-is, so documents saved before the set existed still render.
  var SVC_ICONS = __SVC_ICONS__;

  // Emoji from documents saved before the drawn set existed. Keys carry no
  // variation selector; lookups strip it.
  var LEGACY_ICONS = {
    '\u{1F5A5}': 'ec2', '\u03BB': 'lambda', '\u{1FAA3}': 's3', '\u{1F5C4}': 'rds',
    '\u{1F6AA}': 'apigw', '\u{1F4CA}': 'cloudwatch', '\u{1F7E9}': 'node',
    '\u{1F7E8}': 'javascript', '\u{1F50C}': 'rest', '\u{1F418}': 'postgres',
    '\u{1F42C}': 'mysql', '\u{1F433}': 'docker', '\u{1F33F}': 'git',
    '\u{1F419}': 'github', '\u2B22': 'cube',
  };

  function iconSlug(value) {
    var key = String(value).trim().replace(/\uFE0F/g, '');
    if (SVC_ICONS[key.toLowerCase()]) return key.toLowerCase();
    return LEGACY_ICONS[key] || '';
  }

  function setIcon(el, value) {
    if (!el || typeof value !== 'string' || !value) return;
    var slug = iconSlug(value);
    if (slug) {
      if (el.getAttribute('data-icon') === slug) return;
      el.setAttribute('data-icon', slug);
      el.innerHTML = SVC_ICONS[slug];
      return;
    }
    // not a drawn icon: show it as text, replacing any icon already there — using
    // setText here would leave the <svg> in place and append the glyph beside it
    el.removeAttribute('data-icon');
    var text = String(value).trim();
    if (el.textContent !== text || el.firstElementChild) el.textContent = text;
  }

  function applyStack(content) {
    var groups = content.stack;
    if (!Array.isArray(groups) || !groups.length) return;

    // every group heading + its tile grid, in document order
    var stackRoot = document.getElementById('dc-setStack');
    if (!stackRoot) return;
    var tileGrids = Array.prototype.slice.call(
      stackRoot.querySelectorAll('div[style*="repeat(auto-fill"]')
    );
    if (!tileGrids.length) return;

    var firstTile = stackRoot.querySelector('.svc-tile');
    template('tile', firstTile);

    groups.forEach(function (group, gi) {
      var grid = tileGrids[gi];
      if (!grid || !Array.isArray(group.items)) return;

      // group label sits just above its grid
      var heading = grid.previousElementSibling;
      if (heading && group.group) setText(heading, group.group);

      var tiles = reflow(grid, 'tile', group.items.length, firstTile);
      tiles.forEach(function (tile, i) {
        var item = group.items[i];
        var spans = tile.querySelectorAll('span');
        if (spans[0]) setIcon(spans[0], item.icon);
        if (spans[1]) setText(spans[1], item.label);
        var tip = tile.querySelector('.svc-tip');
        if (tip) setText(tip, item.tip);
        if (item.tip) tile.setAttribute('data-tip', item.tip);
      });
    });

    // drop any group the content no longer has
    tileGrids.slice(groups.length).forEach(function (grid) {
      if (grid.previousElementSibling) grid.previousElementSibling.style.display = 'none';
      grid.style.display = 'none';
    });
  }

  var LIVE_ICON =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14 4h6v6"/><path d="M20 4 11 13"/>' +
    '<path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>';

  function applyProjects(content) {
    var projects = content.projects;
    if (!Array.isArray(projects) || !projects.length) return;
    var grid = document.querySelector('.proj-grid');
    if (!grid) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('article.proj-card'));
    if (!cards.length) return;
    // the featured card is its own shape; the rest share one
    template('projFeat', cards[0]);
    template('projSmall', cards[1] || cards[0]);

    while (cards.length > projects.length) grid.removeChild(cards.pop());
    while (cards.length < projects.length) {
      var clone = templates.projSmall.cloneNode(true);
      grid.appendChild(clone);
      cards.push(clone);
    }

    cards.forEach(function (card, i) {
      var project = projects[i];
      var title = card.querySelector('h3');
      var desc = card.querySelector('p:not([style*="Syne Mono"])') || card.querySelector('p');
      if (title) setText(title, project.title);
      if (desc) setText(desc, project.description);

      // status chip: first span, recoloured for in-development entries
      var chip = card.querySelector('span');
      if (chip && project.status) {
        setText(chip, project.status);
        var live = project.live !== false;
        chip.style.color = live ? '#34d17e' : '#f0a020';
        chip.style.background = live ? 'rgba(40,200,120,.1)' : 'rgba(240,160,32,.1)';
        chip.style.borderColor = live ? 'rgba(40,200,120,.35)' : 'rgba(240,160,32,.35)';
      }

      // tags: the row of chips inside the card's footer
      if (Array.isArray(project.tags)) {
        var tagRow = card.querySelector('div[style*="flex-wrap:wrap"]');
        if (tagRow) {
          var tagTpl = tagRow.querySelector('span');
          if (tagTpl) {
            var proto = tagTpl.cloneNode(true);
            tagRow.textContent = '';
            project.tags.forEach(function (tag) {
              var span = proto.cloneNode(true);
              span.textContent = tag;
              tagRow.appendChild(span);
            });
          }
        }
      }

      // repo + live-site links, each hidden when there is nothing to point at
      var link = card.querySelector('a[data-repo], a[aria-label="GitHub"], a[href="#"], a[href^="http"]');
      if (link) {
        link.setAttribute('data-repo', '');
        if (project.repo) {
          link.href = project.repo;
          link.target = '_blank';
          link.rel = 'noopener';
          link.style.display = '';
        } else {
          link.style.display = 'none';
        }

        // the featured card labels its link in words, the compact cards are
        // icon-only — match whichever this card is
        var labelled = (link.textContent || '').trim().length > 0;
        var live = card.querySelector('a[data-live]');
        if (project.liveUrl) {
          if (!live) {
            live = link.cloneNode(false); // attributes only: keeps the inline styling
            live.removeAttribute('data-repo'); // or the selector above would find this one
            live.setAttribute('data-live', '');
            live.setAttribute('aria-label', 'Live site');
            live.innerHTML = LIVE_ICON + (labelled ? ' Visit live site' : '');
            link.parentElement.insertBefore(live, link);
          }
          var url = String(project.liveUrl).trim();
          live.href = /^https?:/i.test(url) ? url : 'https://' + url.replace(/^\\/+/, '');
          live.target = '_blank';
          live.rel = 'noopener';
          live.style.display = '';
        } else if (live) {
          live.style.display = 'none';
        }
      }
    });
  }

  function applyExperience(content) {
    var items = content.experience && content.experience.items;
    if (!Array.isArray(items) || !items.length) return;
    var card = document.querySelector('.ct-card');
    if (!card) return;

    var rows = Array.prototype.slice.call(card.querySelectorAll('[data-ct-row]'));
    if (!rows.length) return;
    template('ctRow', rows[0]);

    while (rows.length > items.length) card.removeChild(rows.pop());
    while (rows.length < items.length) {
      var clone = templates.ctRow.cloneNode(true);
      // cloned rows need the expand handler the ported runtime binds by attribute
      clone.setAttribute('data-on-click', 'toggleRow');
      clone.addEventListener('click', window.__toggleCtRow || function () {});
      card.appendChild(clone);
      rows.push(clone);
    }

    rows.forEach(function (row, i) {
      var item = items[i];
      var cells = row.querySelectorAll(':scope > div:first-child > span');
      if (cells[0]) setText(cells[0], [item.start, item.end].filter(Boolean).join(' → '));
      if (cells[1]) setText(cells[1], item.company);
      if (cells[2]) setText(cells[2], item.role);
      if (cells[3]) {
        setText(cells[3], item.status || 'COMPLETED');
        var active = (item.status || '').toUpperCase() === 'ACTIVE';
        cells[3].style.color = active ? '#34d17e' : 'var(--text-2)';
        var dot = cells[3].querySelector('span');
        if (dot) dot.style.display = active ? '' : 'none';
      }
      var detail = row.querySelector('[data-ct-detail] p');
      if (detail) setText(detail, item.description);
      // collapse a freshly cloned row
      var panel = row.querySelector('[data-ct-detail]');
      if (panel && !panel.style.maxHeight) panel.style.maxHeight = '0px';
    });
  }

  // Precedence: a CMS upload, else the art bundled for that slot, else the shared
  // placeholder. The last case matters for CMS-added posts — their cards are clones,
  // so without this they would show the template post's picture.
  var SLOT_ART = __SLOT_ART__;
  var PLACEHOLDER = 'assets/blog/placeholder.svg';

  function applyMedia(content) {
    var media = content.media || {};
    document.querySelectorAll('img[data-slot]').forEach(function (img) {
      var slot = img.getAttribute('data-slot');
      // an upload wins; then this frame's own bundled art, but only while the frame
      // still belongs to that slot; then the slot's art; then the shared placeholder
      var own = img.getAttribute('data-default-for') === slot ? img.getAttribute('data-default') : '';
      var url = media[slot] || own || SLOT_ART[slot] || PLACEHOLDER;
      var current = img.getAttribute('src');
      if (current !== url) img.src = url;
    });
  }

  // The badge reads "Engineer @" followed by the AmaliTech wordmark. That logo only
  // tells the truth for AmaliTech, so any other employer is rendered as text.
  // Footer social links. An empty URL hides its icon rather than pointing nowhere.
  var SOCIAL_PATHS = {
    github: 'contact.github',
    linkedin: 'contact.linkedin',
    x: 'contact.x',
    instagram: 'contact.instagram',
  };

  function applySocials(content) {
    Object.keys(SOCIAL_PATHS).forEach(function (key) {
      var link = document.querySelector('footer a[data-social="' + key + '"]');
      if (!link) return;
      var value = get(content, SOCIAL_PATHS[key]);
      value = typeof value === 'string' ? value.trim() : '';
      if (!value) { link.style.display = 'none'; return; }
      link.href = /^https?:/i.test(value) ? value : 'https://' + value.replace(/^\\/+/, '');
      link.style.display = 'flex';
    });
  }

  function applyEmployer(content) {
    var hero = content.hero || {};
    var label = document.querySelector('[data-content="hero.employerLabel"]');
    var badge = label && label.parentElement;
    if (!badge) return;

    var name = typeof hero.employer === 'string' ? hero.employer.trim() : '';
    var wordmark = !name || name.toLowerCase() === 'amalitech';
    var marks = badge.querySelectorAll('img.wm-white, img.wm-default');
    Array.prototype.forEach.call(marks, function (img) {
      img.style.display = wordmark ? '' : 'none'; // '' restores the stylesheet's choice
    });

    var custom = badge.querySelector('[data-employer-text]');
    if (wordmark) {
      if (custom) custom.style.display = 'none';
      return;
    }
    if (!custom) {
      custom = document.createElement('span');
      custom.setAttribute('data-employer-text', '');
      custom.style.cssText =
        "font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--primary)";
      badge.appendChild(custom);
    }
    custom.style.display = '';
    setText(custom, name);
  }

  function applySettings(content) {
    var s = content.settings || {};
    if (s.pageTitle) document.title = s.pageTitle;
    if (s.metaDescription) {
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', s.metaDescription);
    }
    // rotates the whole palette onto the accent's hue, not just --primary
    if (s.accent) {
      if (window.__applyAccent) window.__applyAccent(s.accent);
      // remembered for the next load's first paint (see THEME_GUARD)
      try {
        if (s.accent.toLowerCase() === '#6aff00') localStorage.removeItem('dc.accent');
        else localStorage.setItem('dc.accent', s.accent);
      } catch (e) {}
    }
    if (s.reduceMotion && root) root.dataset.motion = 'off';
  }

  function hydrate(content) {
    if (!content || typeof content !== 'object') return;
    applyScalars(content);
    applyCerts(content);
    applyStack(content);
    applyProjects(content);
    applyExperience(content);
    applyPosts(content);
    applyMedia(content);
    applyVisibility(content);
    applyCanvas(content);
    applySettings(content); // themes the page, last so it covers everything above
    applyEmployer(content);
    applySocials(content);
    document.documentElement.setAttribute('data-content-loaded', '1');
    // the page is themed now, so it is safe to show
    if (window.__themeReveal) window.__themeReveal();
    // a post opened by ?post= may only exist once the posts have been rendered
    if (window.__openFromQuery) window.__openFromQuery();
  }

  function load() {
    return fetch('/api/content', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data && data.ok) hydrate(data.content); })
      .catch(function () {
        /* offline or API down: the static markup already reads correctly */
        if (window.__themeReveal) window.__themeReveal();
      });
  }

  load();

  // Revalidate when the tab is looked at again, so publishing in the CMS and
  // switching back to the portfolio shows the change without a manual reload.
  var last = Date.now();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - last < 2000) return; // don't refetch on rapid tab flicking
    last = Date.now();
    load();
  });
})();
</script>
`;

const CMS_RUNTIME = `
<script>
/* Vanilla port of the Portfolio CMS design. A front-end mockup: state lives in
   the DOM only, nothing is persisted and there is no backend behind it. */
(function () {
  'use strict';
${SHARED_RUNTIME}
  var root = document.getElementById('dc-setRoot');
  if (!root) return;
  var dirtyState = false;
  var toastTimer;

  var q = function (sel) { return root.querySelector(sel); };
  var qa = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };

  function sync() {
    qa('[data-counter]').forEach(function (el) {
      var lab = el.closest('label');
      if (!lab) return;
      var f = lab.querySelector('textarea,input');
      if (!f) return;
      el.textContent = f.value.length + ' / ' + el.dataset.counter;
      el.style.color = f.value.length > +el.dataset.counter ? 'var(--danger)' : 'var(--text-3)';
    });
    var body = q('[data-body]'), wc = q('[data-wordcount]');
    if (body && wc) wc.textContent = body.value.trim().split(/\\s+/).filter(Boolean).length + ' words';
  }

  function setDirty(on) {
    dirtyState = on;
    var bar = q('[data-savebar]');
    if (bar) bar.style.transform = on ? 'translate(-50%,0)' : 'translate(-50%,140%)';
    var st = q('[data-savestate]');
    if (st) {
      if (st.childNodes[1]) st.childNodes[1].textContent = on ? 'Unsaved changes' : 'All changes saved';
      st.style.color = on ? 'var(--warn)' : 'var(--text-3)';
      var dot = st.firstElementChild;
      if (dot) dot.style.background = on ? 'var(--warn)' : 'var(--text-3)';
    }
  }

  function toast(msg) {
    var t = q('[data-toast]');
    if (!t) return;
    var m = q('[data-toast-msg]');
    if (m) m.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateY(0)';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.style.opacity = '0';
      t.style.transform = 'translateY(14px)';
    }, 2200);
  }

  function go(panel) {
    qa('.panel').forEach(function (p) { p.style.display = p.dataset.panel === panel ? '' : 'none'; });
    qa('.rail-item').forEach(function (b) { b.dataset.active = b.dataset.nav === panel ? '1' : ''; });
    var c = q('[data-crumb]');
    if (c) c.textContent = panel;
    window.scrollTo({ top: 0, behavior: 'auto' });
    sync();
  }

  var handlers = {
    onInput: function (e) {
      var t = e.target;
      if (t.dataset.range) {
        var out = q('[data-out="' + t.dataset.range + '"]');
        if (out) out.textContent = t.value;
      }
      if (t.dataset.search) {
        var term = t.value.toLowerCase();
        qa('[data-post]').forEach(function (b) {
          b.style.display = b.textContent.toLowerCase().indexOf(term) !== -1 ? '' : 'none';
        });
        return;
      }
      sync();
      if (t.hasAttribute('data-dirty') && !dirtyState) setDirty(true);
    },

    onClick: function (e) {
      var nav = e.target.closest('[data-nav]');
      if (nav) { go(nav.dataset.nav); return; }

      var tab = e.target.closest('[data-tab]');
      if (tab) {
        var g = tab.dataset.tabgroup;
        qa('[data-tabgroup="' + g + '"][data-tab]').forEach(function (b) {
          var on = b === tab;
          b.dataset.active = on ? '1' : '';
          b.style.color = on ? 'var(--primary)' : 'var(--text-3)';
        });
        qa('[data-tabgroup="' + g + '"][data-tabpanel]').forEach(function (p) {
          p.style.display = p.dataset.tabpanel === tab.dataset.tab ? 'flex' : 'none';
        });
        return;
      }

      var post = e.target.closest('[data-post]');
      if (post) {
        qa('[data-post]').forEach(function (b) {
          var on = b === post;
          b.dataset.active = on ? '1' : '';
          b.style.background = on ? 'var(--fill)' : 'none';
          b.style.borderLeftColor = on ? 'var(--primary)' : 'transparent';
        });
        return;
      }

      var tg = e.target.closest('[data-toggle]');
      if (tg) {
        var on2 = tg.dataset.toggle !== '1';
        tg.dataset.toggle = on2 ? '1' : '0';
        var knob = tg.firstElementChild;
        var w = tg.offsetWidth, kw = knob ? knob.offsetWidth : 16;
        if (knob) {
          knob.style.left = on2 ? (w - kw - 3) + 'px' : '2px';
          knob.style.background = on2 ? 'var(--primary)' : 'var(--text-3)';
        }
        tg.style.borderColor = on2 ? 'var(--primary)' : 'var(--border-hi)';
        tg.style.background = on2 ? 'var(--fill)' : 'var(--surface)';
        var row = tg.parentElement;
        var lbl = row && row.querySelector('span[style*="10.5px"]');
        if (lbl && (lbl.textContent === 'visible' || lbl.textContent === 'hidden')) {
          lbl.textContent = on2 ? 'visible' : 'hidden';
          lbl.style.color = on2 ? 'var(--primary)' : 'var(--text-3)';
          row.style.opacity = on2 ? '1' : '.55';
        }
        setDirty(true);
        return;
      }

      var sw = e.target.closest('[data-swatch]');
      if (sw) {
        qa('[data-swatch]').forEach(function (b) { b.dataset.swatch = '0'; b.style.borderColor = 'transparent'; });
        sw.dataset.swatch = '1';
        sw.style.borderColor = 'var(--text)';
        setDirty(true);
        return;
      }

      if (e.target.closest('[data-save]')) { setDirty(false); toast('Draft saved'); return; }
      if (e.target.closest('[data-discard]')) { setDirty(false); toast('Changes discarded'); return; }
      if (e.target.closest('[data-publish]')) { setDirty(false); toast('Published to daniellotsu.dev'); return; }
      if (e.target.closest('[data-preview]')) { toast('Opening preview\\u2026'); return; }
      if (e.target.closest('[data-new-post]')) { toast('New draft created'); return; }
      if (e.target.closest('[data-add]')) { toast('Added \\u2014 fill in the details'); return; }

      var un = e.target.closest('[data-unpublish]');
      if (un) {
        var pill = q('[data-status-pill]');
        var live = un.textContent.trim() === 'Unpublish';
        un.textContent = live ? 'Publish' : 'Unpublish';
        if (pill) {
          pill.textContent = live ? 'DRAFT' : 'PUBLISHED';
          pill.style.color = live ? 'var(--warn)' : 'var(--primary)';
          pill.style.borderColor = live ? 'var(--warn)' : 'var(--primary)';
        }
        toast(live ? 'Moved to drafts' : 'Post published');
        return;
      }
    }
  };

  styleShim();
  bindHandlers(handlers, ['click', 'input']);
  sync();

  // Exposed for the data layer, which reuses this UI's dirty bar and toast rather
  // than inventing a second set of feedback affordances.
  window.cmsToast = toast;
  window.cmsDirty = setDirty;
  window.cmsIsDirty = function () { return dirtyState; };
  window.cmsSync = sync;
  window.cmsGo = go;
})();
</script>
`;

/* ============================= build ============================= */

/* ---------------------- CMS data layer ----------------------
 * Turns the ported mockup into a working dashboard: sign in, load the content
 * document, drive the annotated data-field inputs from it, and PUT it back. The
 * mockup's own toast/dirty-bar behaviour is reused, so saving looks the same — it
 * just reaches the API now.
 * ------------------------------------------------------------ */
const CMS_DATA_RUNTIME = `
<script>
(function () {
  'use strict';

  var root = document.getElementById('dc-setRoot');
  if (!root) return;

  var TOKEN_KEY = 'cms.token';
  var token = '';
  try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}

  var content = null;
  var selectedPost = null;

  var qa = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };

  function api(path, options) {
    var opts = options || {};
    var headers = opts.headers || {};
    headers.Accept = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    return fetch(path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body,
      cache: 'no-store'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok || data.ok === false) {
          throw new Error((data && data.error) || (r.status + ' ' + r.statusText));
        }
        return data;
      });
    });
  }

  /* ---------------- content document access ---------------- */

  function get(path) {
    return path.split('.').reduce(function (o, k) {
      return o == null ? undefined : o[k];
    }, content);
  }

  function set(path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var target = keys.reduce(function (o, k) {
      if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\\d+$/.test(k) ? [] : {};
      return o[k];
    }, content);
    target[last] = value;
  }

  function currentPost() {
    var posts = (content && content.blog && content.blog.posts) || [];
    if (!posts.length) return null;
    var found = posts.filter(function (p) { return p.id === selectedPost; })[0];
    return found || posts[0];
  }

  /* ---------------- form <-> document ---------------- */

  function fieldValue(el) {
    return el.type === 'checkbox' ? el.checked : el.value;
  }

  function populate() {
    if (!content) return;
    buildExtraFields(); // before the [data-field] walk below, so they populate too
    var post = currentPost();
    if (post) selectedPost = post.id;

    qa('[data-field]').forEach(function (el) {
      var path = el.getAttribute('data-field');
      var value;

      if (path.indexOf('post.') === 0) {
        value = post ? post[path.slice(5)] : '';
      } else {
        value = get(path);
      }
      if (value === undefined || value === null) value = '';
      if (typeof value !== 'string') value = String(value);
      if (el.value !== value) el.value = value;
    });

    populateToggles();
    populateSwatches();
    populateRanges();
    populateCounts();
    populatePostList();
    renderMedia();
    renderPostImages();
    if (window.cmsSync) window.cmsSync();
  }

  // ---- switches ----------------------------------------------------------
  // The mockup's toggle handler moves the knob and recolours the track; this only
  // has to put each switch in the state the document says, then let that run.
  function setToggle(el, on) {
    el.dataset.toggle = on ? '1' : '0';
    var knob = el.firstElementChild;
    if (knob) {
      var w = el.offsetWidth || 40;
      var kw = knob.offsetWidth || 16;
      knob.style.left = on ? w - kw - 3 + 'px' : '2px';
      knob.style.background = on ? 'var(--primary)' : 'var(--text-3)';
    }
    el.style.borderColor = on ? 'var(--primary)' : 'var(--border-hi)';
    el.style.background = on ? 'var(--fill)' : 'var(--surface)';

    // the design pairs some switches with a visible/hidden label
    var row = el.parentElement;
    var label = row && row.querySelector('span[style*="10.5px"]');
    if (label && (label.textContent === 'visible' || label.textContent === 'hidden')) {
      label.textContent = on ? 'visible' : 'hidden';
      label.style.color = on ? 'var(--primary)' : 'var(--text-3)';
      row.style.opacity = on ? '1' : '.55';
    }
  }

  function populateToggles() {
    qa('[data-toggle-field]').forEach(function (el) {
      setToggle(el, get(el.getAttribute('data-toggle-field')) !== false);
    });
  }

  // ---- accent swatches ---------------------------------------------------
  function populateSwatches() {
    var accent = (get('settings.accent') || '').toLowerCase();
    qa('[data-swatch-value]').forEach(function (el) {
      var on = el.getAttribute('data-swatch-value').toLowerCase() === accent;
      el.dataset.swatch = on ? '1' : '0';
      el.style.borderColor = on ? 'var(--text)' : 'transparent';
    });
    // the dashboard wears the theme too, so the choice can be judged in place
    if (accent && window.__applyAccent) window.__applyAccent(accent);
  }

  // ---- sliders -----------------------------------------------------------
  function populateRanges() {
    qa('[data-range-field]').forEach(function (el) {
      var value = get(el.getAttribute('data-range-field'));
      if (value !== undefined && value !== null) el.value = String(value);
      var out = root.querySelector('[data-out="' + el.getAttribute('data-range') + '"]');
      if (out) out.textContent = el.value;
    });
  }

  // ---- sidebar counts ----------------------------------------------------
  function populateCounts() {
    var posts = (content.blog && content.blog.posts) || [];
    var stackGroups = get('stack') || [];
    var counts = {
      posts: posts.filter(function (p) { return p.published !== false; }).length,
      certs: (get('certs') || []).length,
      projects: (get('projects') || []).length,
      experience: (get('experience.items') || []).length,
      stack: stackGroups.reduce(function (n, g) { return n + ((g.items && g.items.length) || 0); }, 0),
    };
    qa('[data-count]').forEach(function (el) {
      var key = el.getAttribute('data-count');
      if (counts[key] !== undefined) el.textContent = String(counts[key]);
    });
  }

  // ---- post list ---------------------------------------------------------
  // The design ships six fixed rows; the blog can hold any number of posts, so the
  // list is rendered from the data with the first row kept as the template.
  var postRowTemplate = null;

  function populatePostList() {
    var posts = (content.blog && content.blog.posts) || [];
    var listHost = root.querySelector('[data-postlist]');

    if (listHost) {
      var rows = qa('[data-postlist] [data-post-id]');
      if (!postRowTemplate && rows.length) postRowTemplate = rows[0].cloneNode(true);

      if (postRowTemplate) {
        while (rows.length > posts.length) {
          var extra = rows.pop();
          if (extra.parentElement) extra.parentElement.removeChild(extra);
        }
        while (rows.length < posts.length) {
          var clone = postRowTemplate.cloneNode(true);
          listHost.appendChild(clone);
          rows.push(clone);
        }
        rows.forEach(function (row, i) { row.setAttribute('data-post-id', posts[i].id); });
      }
    }

    qa('[data-post-id]').forEach(function (row) {
      var id = row.getAttribute('data-post-id');
      var post = posts.filter(function (p) { return p.id === id; })[0];
      var on = id === selectedPost;
      row.dataset.active = on ? '1' : '';
      row.style.background = on ? 'var(--fill)' : 'none';
      row.style.borderLeftColor = on ? 'var(--primary)' : 'transparent';
      if (!post) { row.style.display = 'none'; return; }
      row.style.display = '';

      // keep each row's title and LIVE/DRAFT pill honest
      var title = row.querySelector('div:last-child, span:last-child');
      var pill = row.querySelector('span');
      if (pill && /^(LIVE|DRAFT)$/.test(pill.textContent.trim())) {
        var live = post.published !== false;
        pill.textContent = live ? 'LIVE' : 'DRAFT';
        pill.style.color = live ? 'var(--primary)' : 'var(--warn)';
      }
      if (title && title !== pill && post.title) title.textContent = post.title;

      // a delete affordance, which the mockup's rows never had
      if (!row.querySelector('[data-del-post]')) {
        var del = document.createElement('button');
        del.type = 'button';
        del.setAttribute('data-del-post', '');
        del.textContent = '×';
        del.title = 'Delete this post';
        del.style.cssText =
          'position:absolute;top:6px;right:6px;background:none;border:none;cursor:pointer;' +
          "color:var(--text-3,#4d8c3c);font-size:15px;line-height:1;padding:2px 5px;font-family:'Syne Mono',monospace";
        del.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (!window.confirm('Delete “' + (post.title || 'this post') + '”? This cannot be undone.')) return;
          var idx = posts.indexOf(post);
          if (idx > -1) posts.splice(idx, 1);
          if (selectedPost === post.id) selectedPost = posts.length ? posts[0].id : null;
          populate();
          window.cmsDirty(true);
          window.cmsToast('Post deleted — save to apply');
        });
        if (getComputedStyle(row).position === 'static') row.style.position = 'relative';
        row.appendChild(del);
      }
    });

    // the publish/unpublish button + status pill reflect the selected post
    var post = currentPost();
    var btn = root.querySelector('[data-unpublish]');
    var statusPill = root.querySelector('[data-status-pill]');
    if (post && btn) btn.textContent = post.published === false ? 'Publish' : 'Unpublish';
    if (post && statusPill) {
      var live = post.published !== false;
      statusPill.textContent = live ? 'PUBLISHED' : 'DRAFT';
      statusPill.style.color = live ? 'var(--primary)' : 'var(--warn)';
      statusPill.style.borderColor = live ? 'var(--primary)' : 'var(--warn)';
    }
  }

  function collect() {
    qa('[data-field]').forEach(function (el) {
      var path = el.getAttribute('data-field');
      var value = fieldValue(el);
      if (path.indexOf('post.') === 0) {
        var post = currentPost();
        if (post) post[path.slice(5)] = value;
      } else {
        set(path, value);
      }
    });

    qa('[data-toggle-field]').forEach(function (el) {
      set(el.getAttribute('data-toggle-field'), el.dataset.toggle === '1');
    });

    qa('[data-range-field]').forEach(function (el) {
      var n = parseInt(el.value, 10);
      if (!isNaN(n)) set(el.getAttribute('data-range-field'), n);
    });

    var chosen = qa('[data-swatch-value]').filter(function (el) { return el.dataset.swatch === '1'; })[0];
    if (chosen) set('settings.accent', chosen.getAttribute('data-swatch-value'));
  }

  /* ---------------- cover + article image (blog pane) ----------------
   * The design draws a dashed placeholder with Replace/Remove beside it, but
   * nothing behind it: a new post could not be given a picture without leaving for
   * the Media pane, and the Media pane only lists posts that have already been
   * saved. This wires the placeholder to the selected post's cover slot and adds
   * the same control for the article's header image.
   * ------------------------------------------------------------------- */
  var pendingKind = 'blog-cover';
  var postFileInput = null;

  function postSlot(kind) {
    var post = currentPost();
    if (!post || !post.id) return null;
    return kind + '-' + String(post.id).replace(/^post-/, '');
  }

  function postImageEl(kind) {
    return root.querySelector('[data-post-img="' + kind + '"]');
  }

  function pickPostImage(kind) {
    if (!currentPost()) { window.cmsToast('Create or select a post first'); return; }
    pendingKind = kind;
    if (!postFileInput) {
      postFileInput = document.createElement('input');
      postFileInput.type = 'file';
      postFileInput.accept = 'image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml';
      postFileInput.style.display = 'none';
      postFileInput.addEventListener('change', function () {
        var file = postFileInput.files && postFileInput.files[0];
        var slot = postSlot(pendingKind);
        if (file && slot) uploadTo(slot, file, postImageEl(pendingKind));
        postFileInput.value = '';
      });
      root.appendChild(postFileInput);
    }
    postFileInput.click();
  }

  function removePostImage(kind) {
    var slot = postSlot(kind);
    if (!slot || !content.media || !content.media[slot]) { window.cmsToast('No uploaded image to remove'); return; }
    delete content.media[slot];
    renderPostImages();
    window.cmsDirty(true);
    window.cmsToast('Image removed — save to publish');
  }

  // A hero image uploaded before the article shared the cover would otherwise just
  // disappear. Move it to supporting media, where it still shows in the article, and
  // drop the dead slot. Not marked dirty — it rides along with the next save.
  function migrateHeroUpload() {
    var post = currentPost();
    if (!post || !post.id || !content.media) return;
    var legacy = 'blog-hero-' + String(post.id).replace(/^post-/, '');
    var url = content.media[legacy];
    if (!url) return;
    if (!Array.isArray(post.gallery)) post.gallery = [];
    var already = post.gallery.some(function (g) { return g && g.url === url; });
    if (!already) post.gallery.push({ url: url, caption: '' });
    delete content.media[legacy];
  }

  function renderPostImages() {
    migrateHeroUpload();
    var box = root.querySelector('[data-cover-preview]');
    if (!box) return;
    var row = box.parentElement;

    // the design's dashed box becomes the cover preview
    if (!box.querySelector('[data-post-img]')) {
      box.textContent = '';
      box.style.overflow = 'hidden';
      box.style.display = 'block';
      var cover = document.createElement('img');
      cover.setAttribute('data-post-img', 'blog-cover');
      cover.alt = '';
      cover.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      box.appendChild(cover);
    }

    // its Remove button — Replace is the design's [data-add], handled with the rest
    if (!row.hasAttribute('data-cover-wired')) {
      row.setAttribute('data-cover-wired', '');
      Array.prototype.slice.call(row.querySelectorAll('button')).forEach(function (btn) {
        if ((btn.textContent || '').trim().toLowerCase() !== 'remove') return;
        btn.addEventListener('click', function (e) { e.stopPropagation(); removePostImage('blog-cover'); });
      });
    }

    // one image per post: the card and the article share this cover
    var note = row.querySelector('[data-cover-note]');
    if (!note) {
      note = document.createElement('span');
      note.setAttribute('data-cover-note', '');
      note.textContent = 'Used on the card and at the top of the article.';
      note.style.cssText =
        "flex-basis:100%;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-3,#4d8c3c)";
      row.appendChild(note);
    }

    var img = postImageEl('blog-cover');
    if (img) {
      var slot = postSlot('blog-cover');
      var url = slot ? (content.media && content.media[slot]) || defaultArt(slot) : '';
      if (url && img.getAttribute('src') !== url) img.src = url;
    }

    renderGalleryEditor();
  }

  /* ---------------- supporting media (blog pane) ----------------
   * Extra images for the expanded article only — the card keeps showing the cover.
   * These are plain URLs on the post rather than named slots: there is no bundled
   * default to fall back to, and the list is any length.
   * -------------------------------------------------------------- */
  var galleryInput = null;

  function postGallery() {
    var post = currentPost();
    if (!post) return null;
    if (!Array.isArray(post.gallery)) post.gallery = [];
    return post.gallery;
  }

  function addGalleryImage() {
    var gallery = postGallery();
    if (!gallery) { window.cmsToast('Create or select a post first'); return; }
    if (!galleryInput) {
      galleryInput = document.createElement('input');
      galleryInput.type = 'file';
      galleryInput.accept = 'image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml';
      galleryInput.multiple = true;
      galleryInput.style.display = 'none';
      galleryInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(galleryInput.files || []);
        galleryInput.value = '';
        var target = postGallery();
        if (!target || !files.length) return;
        files.reduce(function (chain, file) {
          return chain.then(function () {
            return uploadRaw(file)
              .then(measure)
              .then(function (item) {
                target.push(item);
                window.cmsDirty(true);
                renderGalleryEditor();
              });
          });
        }, Promise.resolve())
          .then(function () { window.cmsToast('Added — save to publish'); })
          .catch(function (err) { window.cmsToast(err.message); });
      });
      root.appendChild(galleryInput);
    }
    galleryInput.click();
  }

  // Reads the uploaded image's natural size so the article can reserve its shape.
  // A failure here is not worth blocking on — the portfolio falls back to letting the
  // image size itself.
  function measure(url) {
    return new Promise(function (resolve) {
      var probe = new Image();
      var done = function (w, h) { resolve({ url: url, caption: '', w: w, h: h }); };
      probe.onload = function () { done(probe.naturalWidth || 0, probe.naturalHeight || 0); };
      probe.onerror = function () { done(0, 0); };
      probe.src = url;
    });
  }

  function renderGalleryEditor() {
    var pane = root.querySelector('[data-panel="blog"]');
    if (!pane) return;

    var box = pane.querySelector('[data-gallery-editor]');
    if (!box) {
      box = document.createElement('div');
      box.setAttribute('data-gallery-editor', '');
      box.style.cssText =
        'display:flex;flex-direction:column;gap:11px;margin-top:18px;padding:15px;border:1px solid ' +
        'var(--border-hi,#173311);border-radius:12px;background:var(--surface,#06140a)';

      var head = document.createElement('div');
      head.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:10px';
      var title = document.createElement('span');
      title.textContent = 'Supporting media';
      title.style.cssText =
        "font-family:'Clash Display',sans-serif;font-weight:600;font-size:13px;color:var(--text,#eefff0)";
      var add = document.createElement('button');
      add.type = 'button';
      add.setAttribute('data-gallery-add', '');
      add.textContent = '+ Add image';
      add.style.cssText = miniBtnCss;
      add.addEventListener('click', function (e) { e.stopPropagation(); addGalleryImage(); });
      head.appendChild(title);
      head.appendChild(add);

      var note = document.createElement('span');
      note.textContent =
        'Shown inside the expanded article, under the text — never on the card. Add as many as you like.';
      note.style.cssText =
        "font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6;color:var(--text-3,#4d8c3c)";

      var list = document.createElement('div');
      list.setAttribute('data-gallery-list', '');
      list.style.cssText = 'display:flex;flex-direction:column;gap:10px';

      box.appendChild(head);
      box.appendChild(note);
      box.appendChild(list);
      pane.appendChild(box);
    }

    var host = box.querySelector('[data-gallery-list]');
    host.textContent = '';
    var gallery = postGallery() || [];

    if (!gallery.length) {
      var empty = document.createElement('p');
      empty.textContent = 'No supporting images on this post.';
      empty.style.cssText =
        "margin:0;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-3,#4d8c3c)";
      host.appendChild(empty);
      return;
    }

    gallery.forEach(function (item, index) {
      var row = document.createElement('div');
      row.style.cssText =
        'display:grid;grid-template-columns:96px 1fr auto;gap:11px;align-items:center;padding:10px;' +
        'border:1px solid var(--border-hi,#173311);border-radius:10px';

      var thumb = document.createElement('img');
      thumb.src = item.url;
      thumb.alt = '';
      thumb.style.cssText =
        'width:96px;aspect-ratio:16/9;object-fit:cover;border-radius:7px;display:block;background:var(--bg,#020a02)';

      var caption = document.createElement('input');
      caption.type = 'text';
      caption.value = item.caption || '';
      caption.placeholder = 'Caption (optional) — also used as the alt text';
      caption.style.cssText = inputCss;
      caption.addEventListener('input', function () {
        item.caption = caption.value;
        window.cmsDirty(true);
      });

      var tools = document.createElement('div');
      tools.style.cssText = 'display:flex;gap:6px';
      var button = function (label, title, onClick) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.title = title;
        b.style.cssText = miniBtnCss;
        b.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
        return b;
      };
      if (index > 0) {
        tools.appendChild(button('\u2191', 'Move up', function () {
          gallery.splice(index - 1, 0, gallery.splice(index, 1)[0]);
          window.cmsDirty(true);
          renderGalleryEditor();
        }));
      }
      if (index < gallery.length - 1) {
        tools.appendChild(button('\u2193', 'Move down', function () {
          gallery.splice(index + 1, 0, gallery.splice(index, 1)[0]);
          window.cmsDirty(true);
          renderGalleryEditor();
        }));
      }
      tools.appendChild(button('Remove', 'Remove this image', function () {
        gallery.splice(index, 1);
        window.cmsDirty(true);
        renderGalleryEditor();
        window.cmsToast('Removed — save to publish');
      }));

      row.appendChild(thumb);
      row.appendChild(caption);
      row.appendChild(tools);
      host.appendChild(row);
    });
  }

  /* ---------------- fields the mockup has no input for ----------------
   * The design's panes are fixed, so anything in the content document without an
   * input gets one appended here — same [data-field] contract as the ported
   * inputs, so populate() and collect() need no special case.
   * -------------------------------------------------------------------- */
  var EXTRA_FIELDS = [
    {
      pane: 'hero',
      title: 'Employer badge',
      note: 'The floating badge in the hero. The AmaliTech wordmark shows while the employer is AmaliTech; any other name renders as text.',
      fields: [
        { path: 'hero.employerLabel', label: 'Badge label', placeholder: 'Engineer @' },
        { path: 'hero.employer', label: 'Employer', placeholder: 'AmaliTech' },
      ],
    },
    {
      pane: 'contact',
      title: 'Socials',
      note: 'Shown in the footer. Leave one empty to hide its icon.',
      fields: [
        { path: 'contact.x', label: 'X', placeholder: 'https://x.com/yourhandle' },
        { path: 'contact.instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
      ],
    },
  ];

  function buildExtraFields() {
    EXTRA_FIELDS.forEach(function (group) {
      var pane = root.querySelector('[data-panel="' + group.pane + '"]');
      if (!pane || pane.querySelector('[data-extra="' + group.title + '"]')) return;

      var box = document.createElement('div');
      box.setAttribute('data-extra', group.title);
      box.style.cssText =
        'display:flex;flex-direction:column;gap:11px;margin-top:18px;padding:15px;border:1px solid ' +
        'var(--border-hi,#173311);border-radius:12px;background:var(--surface,#06140a)';

      var head = document.createElement('span');
      head.textContent = group.title;
      head.style.cssText =
        "font-family:'Clash Display',sans-serif;font-weight:600;font-size:13px;color:var(--text,#eefff0)";
      box.appendChild(head);

      if (group.note) {
        var note = document.createElement('span');
        note.textContent = group.note;
        note.style.cssText =
          "font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6;color:var(--text-3,#4d8c3c)";
        box.appendChild(note);
      }

      var grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:11px';
      group.fields.forEach(function (field) {
        var wrap = document.createElement('label');
        wrap.style.cssText =
          "display:flex;flex-direction:column;gap:5px;font-family:'Syne Mono',monospace;" +
          'font-size:11px;color:var(--text-2,#7fcc66)';
        var span = document.createElement('span');
        span.textContent = field.label;
        var input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('data-field', field.path);
        input.placeholder = field.placeholder || '';
        input.style.cssText = inputCss;
        wrap.appendChild(span);
        wrap.appendChild(input);
        grid.appendChild(wrap);
      });
      box.appendChild(grid);
      pane.appendChild(box);
    });
  }

  /* ---------------- media pane ---------------- */

  // The media pane in the design is a static gallery. Give each known image slot a
  // labelled file input so a new image can actually be attached to it.
  // Every post has a cover and a hero slot, so the list is derived from the posts
  // rather than from whichever slots happen to have an image already.
  function mediaSlots() {
    var slots = [];
    var posts = (content && content.blog && content.blog.posts) || [];
    posts.forEach(function (post) {
      // one image per post now: the card and the article share the cover slot
      slots.push('blog-cover-' + String(post.id || '').replace(/^post-/, ''));
    });
    Object.keys((content && content.media) || {}).forEach(function (slot) {
      if (slots.indexOf(slot) === -1) slots.push(slot);
    });
    return slots;
  }

  function buildMediaPane() {
    var pane = root.querySelector('[data-panel="media"]');
    if (!pane) return;
    var existing = pane.querySelector('[data-media-editor]');
    if (existing) {
      // posts may have been added or removed since this was built
      if (existing.getAttribute('data-slots') === mediaSlots().join(',')) return;
      existing.remove();
    }

    var slots = mediaSlots();
    if (!slots.length) return;

    var wrap = document.createElement('div');
    wrap.setAttribute('data-media-editor', '');
    wrap.setAttribute('data-slots', slots.join(','));
    wrap.style.cssText =
      'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-top:20px';

    slots.forEach(function (slot) {
      var card = document.createElement('label');
      card.style.cssText =
        'display:flex;flex-direction:column;gap:9px;padding:12px;border:1px solid var(--border-hi,#173311);' +
        'border-radius:12px;background:var(--surface,#06140a);cursor:pointer';

      var title = document.createElement('span');
      title.textContent = slot;
      title.style.cssText =
        "font-family:'Syne Mono',monospace;font-size:11px;color:var(--text-3,#4d8c3c);word-break:break-all";

      var preview = document.createElement('img');
      preview.setAttribute('data-media-preview', slot);
      preview.alt = '';
      preview.style.cssText =
        'width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:var(--fill,rgba(106,255,0,.06))';

      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml';
      input.style.cssText = 'font-size:11px;color:var(--text-3,#4d8c3c)';
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (file) uploadTo(slot, file, preview);
      });

      card.appendChild(title);
      card.appendChild(preview);
      card.appendChild(input);
      wrap.appendChild(card);
    });

    pane.appendChild(wrap);
  }

  function renderMedia() {
    buildMediaPane();
    if (!content || !content.media) return;
    qa('[data-media-preview]').forEach(function (img) {
      var slot = img.getAttribute('data-media-preview');
      var url = content.media[slot];
      img.src = url || defaultArt(slot);
    });
  }

  // When a slot has no override, show the art the portfolio ships for it. This map
  // is injected from the build's SLOT_ART, so it can't drift from what index.html
  // actually references.
  var SLOT_ART = __SLOT_ART__;

  function defaultArt(slot) {
    return SLOT_ART[slot] || 'assets/blog/placeholder.svg';
  }

  // Uploads the file and resolves with its URL. Slots and the supporting-media
  // gallery both go through here; only what is done with the URL afterwards differs.
  function uploadRaw(file) {
    if (!token) return Promise.reject(new Error('Sign in first'));
    window.cmsToast('Uploading ' + file.name + '\\u2026');
    return fetch('/api/upload?filename=' + encodeURIComponent(file.name), {
      method: 'POST',
      headers: { 'Content-Type': file.type, Authorization: 'Bearer ' + token },
      body: file
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || !d.ok) throw new Error(d.error || 'Upload failed');
        return d.url;
      });
    });
  }

  function uploadTo(slot, file, preview) {
    if (!token) { window.cmsToast('Sign in first'); return; }
    window.cmsToast('Uploading ' + file.name + '\\u2026');
    fetch('/api/upload?filename=' + encodeURIComponent(file.name), {
      method: 'POST',
      headers: { 'Content-Type': file.type, Authorization: 'Bearer ' + token },
      body: file
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || !d.ok) throw new Error(d.error || 'Upload failed');
        return d;
      }); })
      .then(function (d) {
        content.media[slot] = d.url;
        if (preview) preview.src = d.url;
        window.cmsDirty(true);
        window.cmsToast('Image attached — save to publish it');
      })
      .catch(function (err) { window.cmsToast(err.message); });
  }

  /* ---------------- collection editors ----------------
   * Certifications, tech stack, projects and the experience timeline are lists in
   * the content document but static markup in the design. Each pane gets a real
   * editor: one row per entry, add and remove, reorder — and the portfolio renders
   * whatever ends up here.
   * ---------------------------------------------------- */

  var COLLECTIONS = {
    certs: {
      pane: 'certs',
      path: 'certs',
      label: 'certification',
      fields: [
        { key: 'title', label: 'Certification', width: '2fr' },
        { key: 'level', label: 'Level', width: '1fr' },
        { key: 'issuer', label: 'Issuer', width: '1.5fr' },
        { key: 'year', label: 'Year', width: '.6fr' },
      ],
      blank: { title: '', level: 'Associate', issuer: 'Amazon Web Services', year: '' },
    },
    projects: {
      pane: 'projects',
      path: 'projects',
      label: 'project',
      fields: [
        { key: 'title', label: 'Project', width: '1.4fr' },
        { key: 'status', label: 'Status', width: '1fr' },
        { key: 'description', label: 'Description', width: '2.4fr', textarea: true },
        { key: 'tags', label: 'Tags (comma separated)', width: '1.4fr', list: true },
        { key: 'liveUrl', label: 'Live URL', width: '1.2fr' },
        { key: 'repo', label: 'Repo URL', width: '1.2fr' },
      ],
      blank: {
        title: '', status: 'Status: In Development', live: false, description: '',
        tags: [], liveUrl: '', repo: '',
      },
    },
    experience: {
      pane: 'experience',
      path: 'experience.items',
      label: 'timeline entry',
      fields: [
        { key: 'role', label: 'Role', width: '1.4fr' },
        { key: 'company', label: 'Organisation', width: '1.2fr' },
        { key: 'start', label: 'From', width: '.8fr' },
        { key: 'end', label: 'To', width: '.8fr' },
        { key: 'status', label: 'Status', width: '.9fr' },
        { key: 'description', label: 'Detail', width: '2.4fr', textarea: true },
      ],
      blank: { role: '', company: '', start: '', end: '', location: '', status: 'COMPLETED', description: '' },
    },
  };

  var inputCss =
    "font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text,#eefff0);" +
    'background:var(--bg,#020a02);border:1px solid var(--border-hi,#173311);border-radius:7px;' +
    'padding:8px 10px;outline:none;width:100%;box-sizing:border-box';
  var miniBtnCss =
    "font-family:'Syne Mono',monospace;font-size:11px;padding:6px 9px;border-radius:6px;cursor:pointer;" +
    'background:none;border:1px solid var(--border-hi,#173311);color:var(--text-2,#7fcc66)';

  function collectionArray(spec) {
    var arr = get(spec.path);
    if (!Array.isArray(arr)) {
      arr = [];
      set(spec.path, arr);
    }
    return arr;
  }

  function buildCollectionEditor(spec) {
    var pane = root.querySelector('[data-panel="' + spec.pane + '"]');
    if (!pane) return;

    var host = pane.querySelector('[data-collection]');
    if (!host) {
      host = document.createElement('div');
      host.setAttribute('data-collection', spec.path);
      host.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-top:18px';
      // the design's static rows are a mockup of this data — hide them so there's
      // one obvious place to edit
      Array.prototype.slice.call(pane.children).forEach(function (child) {
        if (child.querySelector && child.querySelector('[data-add]')) return; // keep the Add button row
        if (child === host) return;
        if (child.tagName === 'H2' || child.tagName === 'H3') return;
        if (child.querySelector && (child.querySelector('input') || child.querySelector('textarea'))) return;
        child.style.display = 'none';
      });
      pane.appendChild(host);
    }
    renderCollection(spec, host);
  }

  function renderCollection(spec, host) {
    var arr = collectionArray(spec);
    host.textContent = '';

    if (!arr.length) {
      var empty = document.createElement('p');
      empty.textContent = 'Nothing here yet — use “+ Add” below.';
      empty.style.cssText =
        "margin:0;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-3,#4d8c3c)";
      host.appendChild(empty);
    }

    arr.forEach(function (item, index) {
      var row = document.createElement('div');
      row.style.cssText =
        'display:grid;grid-template-columns:' +
        spec.fields.map(function (f) { return f.width; }).join(' ') +
        ' auto;gap:9px;align-items:end;padding:12px;border:1px solid var(--border-hi,#173311);' +
        'border-radius:10px;background:var(--surface,#06140a)';

      spec.fields.forEach(function (field) {
        var wrap = document.createElement('label');
        wrap.style.cssText =
          "display:flex;flex-direction:column;gap:4px;font-family:'Syne Mono',monospace;" +
          'font-size:10px;letter-spacing:.05em;color:var(--text-3,#4d8c3c);min-width:0';
        var span = document.createElement('span');
        span.textContent = field.label;

        var input = document.createElement(field.textarea ? 'textarea' : 'input');
        if (field.textarea) input.rows = 2;
        input.style.cssText = inputCss + (field.textarea ? ';resize:vertical' : '');
        var value = item[field.key];
        input.value = field.list ? (Array.isArray(value) ? value.join(', ') : '') : value == null ? '' : value;

        input.addEventListener('input', function () {
          if (field.list) {
            item[field.key] = input.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
          } else {
            item[field.key] = input.value;
          }
          // keep the status chip colour honest for projects
          if (spec.path === 'projects' && field.key === 'status') {
            item.live = !/development|draft|planned|wip/i.test(input.value);
          }
          window.cmsDirty(true);
        });

        wrap.appendChild(span);
        wrap.appendChild(input);
        row.appendChild(wrap);
      });

      var tools = document.createElement('div');
      tools.style.cssText = 'display:flex;gap:6px';

      function toolBtn(label, title, onClick) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.title = title;
        b.style.cssText = miniBtnCss;
        b.addEventListener('click', onClick);
        return b;
      }

      if (index > 0) {
        tools.appendChild(toolBtn('↑', 'Move up', function () {
          arr.splice(index - 1, 0, arr.splice(index, 1)[0]);
          window.cmsDirty(true);
          renderCollection(spec, host);
        }));
      }
      if (index < arr.length - 1) {
        tools.appendChild(toolBtn('↓', 'Move down', function () {
          arr.splice(index + 1, 0, arr.splice(index, 1)[0]);
          window.cmsDirty(true);
          renderCollection(spec, host);
        }));
      }
      var del = toolBtn('Remove', 'Remove this entry', function () {
        if (!window.confirm('Remove “' + (item.title || item.role || 'this entry') + '”?')) return;
        arr.splice(index, 1);
        window.cmsDirty(true);
        renderCollection(spec, host);
        populateCounts();
      });
      del.style.cssText = miniBtnCss + ';border-color:rgba(255,138,160,.4);color:#ff8aa0';
      tools.appendChild(del);

      row.appendChild(tools);
      host.appendChild(row);
    });
  }

  // The tech stack is groups of tiles, so it gets its own editor shape.
  function buildStackEditor() {
    var pane = root.querySelector('[data-panel="stack"]');
    if (!pane) return;
    var host = pane.querySelector('[data-collection="stack"]');
    if (!host) {
      host = document.createElement('div');
      host.setAttribute('data-collection', 'stack');
      host.style.cssText = 'display:flex;flex-direction:column;gap:16px;margin-top:18px';
      Array.prototype.slice.call(pane.children).forEach(function (child) {
        if (child.querySelector && child.querySelector('[data-add]')) return;
        if (child.tagName === 'H2' || child.tagName === 'H3') return;
        child.style.display = 'none';
      });
      pane.appendChild(host);
    }
    renderStack(host);
  }

  var SVC_ICONS = __SVC_ICONS__;

  // Offer the drawn icons by name, and show what each one looks like, so picking
  // one doesn't mean guessing from a slug.
  function ensureIconList(host) {
    if (root.querySelector('#svc-icon-slugs')) return;
    var list = document.createElement('datalist');
    list.id = 'svc-icon-slugs';
    Object.keys(SVC_ICONS).forEach(function (slug) {
      var opt = document.createElement('option');
      opt.value = slug;
      list.appendChild(opt);
    });
    host.appendChild(list);

    var legend = document.createElement('div');
    legend.style.cssText =
      'display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:11px 13px;border:1px dashed ' +
      'var(--border-hi,#173311);border-radius:10px';
    var intro = document.createElement('span');
    intro.textContent = 'Icons:';
    intro.style.cssText =
      "font-family:'Syne Mono',monospace;font-size:10.5px;color:var(--text-3,#4d8c3c)";
    legend.appendChild(intro);
    Object.keys(SVC_ICONS).forEach(function (slug) {
      var chip = document.createElement('span');
      chip.title = slug;
      chip.style.cssText =
        "display:inline-flex;align-items:center;gap:5px;font-family:'Syne Mono',monospace;" +
        'font-size:10px;color:var(--text-2,#7fcc66)';
      var glyph = document.createElement('span');
      glyph.style.cssText =
        'display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center;color:var(--primary)';
      glyph.innerHTML = SVC_ICONS[slug];
      var svg = glyph.firstElementChild;
      if (svg) { svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); }
      chip.appendChild(glyph);
      chip.appendChild(document.createTextNode(slug));
      legend.appendChild(chip);
    });
    host.appendChild(legend);
  }

  // Emoji from documents saved before the drawn set existed. Keys carry no
  // variation selector; lookups strip it.
  var LEGACY_ICONS = {
    '\u{1F5A5}': 'ec2', '\u03BB': 'lambda', '\u{1FAA3}': 's3', '\u{1F5C4}': 'rds',
    '\u{1F6AA}': 'apigw', '\u{1F4CA}': 'cloudwatch', '\u{1F7E9}': 'node',
    '\u{1F7E8}': 'javascript', '\u{1F50C}': 'rest', '\u{1F418}': 'postgres',
    '\u{1F42C}': 'mysql', '\u{1F433}': 'docker', '\u{1F33F}': 'git',
    '\u{1F419}': 'github', '\u2B22': 'cube',
  };

  function iconSlug(value) {
    var key = String(value).trim().replace(/\uFE0F/g, '');
    if (SVC_ICONS[key.toLowerCase()]) return key.toLowerCase();
    return LEGACY_ICONS[key] || '';
  }

  function renderStack(host) {
    var groups = get('stack');
    if (!Array.isArray(groups)) { groups = []; set('stack', groups); }
    // migrate the emoji a stored document may still carry, so the field shows the
    // name of the icon actually being drawn. Not marked dirty: it rides along with
    // the next save.
    groups.forEach(function (group) {
      (group.items || []).forEach(function (item) {
        var slug = iconSlug(item.icon || '');
        if (slug && item.icon !== slug) item.icon = slug;
      });
    });
    host.textContent = '';
    ensureIconList(host);

    groups.forEach(function (group, gi) {
      var box = document.createElement('div');
      box.style.cssText =
        'display:flex;flex-direction:column;gap:9px;padding:13px;border:1px solid var(--border-hi,#173311);' +
        'border-radius:10px;background:var(--surface,#06140a)';

      var head = document.createElement('div');
      head.style.cssText = 'display:flex;gap:8px;align-items:center';
      var name = document.createElement('input');
      name.value = group.group || '';
      name.style.cssText = inputCss + ';font-weight:600';
      name.addEventListener('input', function () { group.group = name.value; window.cmsDirty(true); });

      var addTile = document.createElement('button');
      addTile.type = 'button';
      addTile.textContent = '+ Service';
      addTile.style.cssText = miniBtnCss;
      addTile.addEventListener('click', function () {
        if (!Array.isArray(group.items)) group.items = [];
        group.items.push({ icon: 'cube', label: '', tip: '' });
        window.cmsDirty(true);
        renderStack(host);
      });

      var delGroup = document.createElement('button');
      delGroup.type = 'button';
      delGroup.textContent = 'Remove group';
      delGroup.style.cssText = miniBtnCss + ';border-color:rgba(255,138,160,.4);color:#ff8aa0';
      delGroup.addEventListener('click', function () {
        if (!window.confirm('Remove the “' + (group.group || 'untitled') + '” group and its services?')) return;
        groups.splice(gi, 1);
        window.cmsDirty(true);
        renderStack(host);
      });

      head.appendChild(name);
      head.appendChild(addTile);
      head.appendChild(delGroup);
      box.appendChild(head);

      (group.items || []).forEach(function (item, ii) {
        var row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:60px 1.2fr 2.4fr auto;gap:8px;align-items:center';

        ['icon', 'label', 'tip'].forEach(function (key) {
          var input = document.createElement('input');
          input.value = item[key] == null ? '' : item[key];
          input.placeholder = key === 'icon' ? 'lambda' : key === 'label' ? 'EC2' : 'Tooltip shown on hover';
          input.style.cssText = inputCss + (key === 'icon' ? ';text-align:center' : '');
          // the drawn icons are chosen by name; typing anything else still renders
          // as text, so an emoji remains a valid answer
          if (key === 'icon') input.setAttribute('list', 'svc-icon-slugs');
          input.addEventListener('input', function () { item[key] = input.value; window.cmsDirty(true); });
          row.appendChild(input);
        });

        var rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '×';
        rm.title = 'Remove service';
        rm.style.cssText = miniBtnCss + ';border-color:rgba(255,138,160,.4);color:#ff8aa0';
        rm.addEventListener('click', function () {
          group.items.splice(ii, 1);
          window.cmsDirty(true);
          renderStack(host);
        });
        row.appendChild(rm);
        box.appendChild(row);
      });

      host.appendChild(box);
    });
  }

  function buildCollectionEditors() {
    Object.keys(COLLECTIONS).forEach(function (key) { buildCollectionEditor(COLLECTIONS[key]); });
    buildStackEditor();
  }

  function refreshCollections() {
    Object.keys(COLLECTIONS).forEach(function (key) {
      var spec = COLLECTIONS[key];
      var pane = root.querySelector('[data-panel="' + spec.pane + '"]');
      var host = pane && pane.querySelector('[data-collection]');
      if (host) renderCollection(spec, host);
    });
    var stackHost = root.querySelector('[data-collection="stack"]');
    if (stackHost) renderStack(stackHost);
  }

  /* ---------------- change password (settings pane) ---------------- */

  // The design's settings pane has no security section, so build one. Kept out of
  // the content document entirely: the password is stored hashed by /api/password.
  function buildPasswordCard() {
    var pane = root.querySelector('[data-panel="settings"]');
    if (!pane || pane.querySelector('[data-password-card]')) return;

    var card = document.createElement('form');
    card.setAttribute('data-password-card', '');
    card.style.cssText =
      'display:flex;flex-direction:column;gap:12px;max-width:420px;margin-top:26px;padding:18px;' +
      'border:1px solid var(--border-hi,#173311);border-radius:12px;background:var(--surface,#06140a)';

    var title = document.createElement('div');
    title.textContent = 'CMS password';
    title.style.cssText =
      "font-family:'Clash Display',sans-serif;font-weight:600;font-size:15px;color:var(--text,#eefff0)";

    var hint = document.createElement('p');
    hint.setAttribute('data-password-hint', '');
    hint.style.cssText =
      "margin:0;font-family:'JetBrains Mono',monospace;font-size:11.5px;line-height:1.6;color:var(--text-3,#4d8c3c)";

    var labelStyle =
      "display:flex;flex-direction:column;gap:5px;font-family:'JetBrains Mono',monospace;" +
      'font-size:11.5px;color:var(--text-2,#7fcc66)';
    var inputStyle =
      "font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text,#eefff0);" +
      'background:var(--bg,#020a02);border:1px solid var(--border-hi,#173311);border-radius:8px;' +
      'padding:10px 12px;outline:none';

    function field(labelText, autocomplete) {
      var wrap = document.createElement('label');
      wrap.style.cssText = labelStyle;
      var span = document.createElement('span');
      span.textContent = labelText;
      var input = document.createElement('input');
      input.type = 'password';
      input.autocomplete = autocomplete;
      input.required = true;
      input.style.cssText = inputStyle;
      wrap.appendChild(span);
      wrap.appendChild(input);
      return { wrap: wrap, input: input };
    }

    var current = field('Current password', 'current-password');
    var next = field('New password (8+ characters)', 'new-password');
    var confirm = field('Confirm new password', 'new-password');

    var submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Change password';
    submit.style.cssText =
      "align-self:flex-start;font-family:'Clash Display',sans-serif;font-weight:600;font-size:13px;" +
      'color:#04120a;background:var(--primary,#6AFF00);border:none;border-radius:8px;padding:10px 18px;cursor:pointer';

    var note = document.createElement('span');
    note.setAttribute('role', 'status');
    note.style.cssText =
      "font-family:'JetBrains Mono',monospace;font-size:11.5px;min-height:15px;color:var(--text-3,#4d8c3c)";

    card.appendChild(title);
    card.appendChild(hint);
    card.appendChild(current.wrap);
    card.appendChild(next.wrap);
    card.appendChild(confirm.wrap);
    card.appendChild(submit);
    card.appendChild(note);
    pane.appendChild(card);

    // say where the current password comes from
    api('/api/password')
      .then(function (d) {
        hint.textContent = d.custom
          ? 'Changed from here previously. Deleting the stored credential falls back to the CMS_PASSWORD environment variable.'
          : 'Currently the CMS_PASSWORD environment variable. Changing it here stores it instead — no redeploy needed.';
      })
      .catch(function () { hint.textContent = ''; });

    card.addEventListener('submit', function (e) {
      e.preventDefault();
      note.style.color = 'var(--text-3,#4d8c3c)';

      if (next.input.value !== confirm.input.value) {
        note.style.color = '#ff8aa0';
        note.textContent = "The two new passwords don't match.";
        confirm.input.focus();
        return;
      }

      submit.disabled = true;
      note.textContent = 'Saving\\u2026';

      api('/api/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: current.input.value,
          newPassword: next.input.value,
        }),
      })
        .then(function (d) {
          if (d.token) {
            token = d.token;
            try { sessionStorage.setItem(TOKEN_KEY, token); } catch (err) {}
          }
          card.reset();
          submit.disabled = false;
          note.style.color = 'var(--primary,#6AFF00)';
          note.textContent = 'Password changed. Use it next time you sign in.';
          hint.textContent =
            'Changed from here previously. Deleting the stored credential falls back to the CMS_PASSWORD environment variable.';
          window.cmsToast('Password changed');
        })
        .catch(function (err) {
          submit.disabled = false;
          note.style.color = '#ff8aa0';
          note.textContent = err.message;
        });
    });
  }

  /* ---------------- inbox ---------------- */

  function loadInbox() {
    if (!token) return;
    api('/api/messages')
      .then(function (data) { renderInbox(data.messages || []); })
      .catch(function () { /* inbox is a bonus pane; leave the mockup rows in place */ });
  }

  function renderInbox(messages) {
    var panel = root.querySelector('[data-tabpanel="inbox"]');
    if (!panel) return;

    var list = panel.querySelector('[data-inbox-list]');
    if (!list) {
      list = document.createElement('div');
      list.setAttribute('data-inbox-list', '');
      list.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%';
      // replace the mockup's sample rows with real data
      Array.prototype.slice.call(panel.children).forEach(function (c) { c.style.display = 'none'; });
      panel.appendChild(list);
    }
    list.textContent = '';

    if (!messages.length) {
      var empty = document.createElement('p');
      empty.textContent = 'No messages yet.';
      empty.style.cssText = "font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-3,#4d8c3c)";
      list.appendChild(empty);
      return;
    }

    messages.forEach(function (msg) {
      var row = document.createElement('article');
      row.style.cssText =
        'display:flex;flex-direction:column;gap:6px;padding:14px;border:1px solid var(--border-hi,#173311);' +
        'border-radius:12px;background:var(--surface,#06140a)' + (msg.read ? ';opacity:.6' : '');

      var head = document.createElement('div');
      head.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;justify-content:space-between';

      var who = document.createElement('strong');
      who.textContent = msg.name + ' · ' + msg.email;
      who.style.cssText = "font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text,#eefff0);font-weight:600";

      var when = document.createElement('span');
      when.textContent = new Date(msg.receivedAt).toLocaleString();
      when.style.cssText = "font-family:'Syne Mono',monospace;font-size:11px;color:var(--text-3,#4d8c3c)";

      var body = document.createElement('p');
      body.textContent = msg.message;
      body.style.cssText =
        "margin:0;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;" +
        'color:var(--text-2,#7fcc66);white-space:pre-wrap';

      head.appendChild(who);
      head.appendChild(when);

      var actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;margin-top:4px';

      var btnStyle =
        "font-family:'Syne Mono',monospace;font-size:11px;padding:5px 10px;border-radius:6px;" +
        'cursor:pointer;background:none;border:1px solid var(--border-hi,#173311);color:var(--text-2,#7fcc66)';

      var readBtn = document.createElement('button');
      readBtn.type = 'button';
      readBtn.textContent = msg.read ? 'Mark unread' : 'Mark read';
      readBtn.style.cssText = btnStyle;
      readBtn.addEventListener('click', function () {
        readBtn.disabled = true;
        api('/api/messages', { method: 'PATCH', body: JSON.stringify({ id: msg.id, read: !msg.read }) })
          .then(function (d) { renderInbox(d.messages || []); })
          .catch(function (err) { readBtn.disabled = false; window.cmsToast(err.message); });
      });

      var replyBtn = document.createElement('a');
      replyBtn.textContent = 'Reply';
      replyBtn.href = 'mailto:' + msg.email + '?subject=' + encodeURIComponent('Re: your message');
      replyBtn.style.cssText = btnStyle + ';text-decoration:none';

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = 'Delete';
      delBtn.style.cssText = btnStyle + ';border-color:rgba(255,138,160,.4);color:#ff8aa0';
      delBtn.addEventListener('click', function () {
        if (!window.confirm('Delete this message from ' + msg.name + '? This cannot be undone.')) return;
        delBtn.disabled = true;
        api('/api/messages?id=' + encodeURIComponent(msg.id), { method: 'DELETE' })
          .then(function (d) { renderInbox(d.messages || []); window.cmsToast('Message deleted'); })
          .catch(function (err) { delBtn.disabled = false; window.cmsToast(err.message); });
      });

      actions.appendChild(readBtn);
      actions.appendChild(replyBtn);
      actions.appendChild(delBtn);

      row.appendChild(head);
      row.appendChild(body);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  /* ---------------- sign in ---------------- */

  function gate() {
    var overlay = document.createElement('div');
    overlay.setAttribute('data-cms-gate', '');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(2,10,2,.94);backdrop-filter:blur(6px)';

    var form = document.createElement('form');
    form.style.cssText =
      'display:flex;flex-direction:column;gap:14px;width:min(360px,90vw);padding:28px;' +
      'border:1px solid #173311;border-radius:16px;background:#06140a';

    var title = document.createElement('h1');
    title.textContent = 'Portfolio CMS';
    title.style.cssText = "margin:0;font-family:'Clash Display',sans-serif;font-size:22px;color:#eefff0";

    var hint = document.createElement('p');
    hint.textContent = 'Sign in to edit the live site.';
    hint.style.cssText = "margin:0;font-family:'JetBrains Mono',monospace;font-size:12.5px;color:#7fcc66";

    var input = document.createElement('input');
    input.type = 'password';
    input.autocomplete = 'current-password';
    input.placeholder = 'Password';
    input.required = true;
    input.style.cssText =
      "font-family:'JetBrains Mono',monospace;font-size:14px;color:#eefff0;background:#0b1f0a;" +
      'border:1px solid #173311;border-radius:10px;padding:12px 14px;outline:none';

    var button = document.createElement('button');
    button.type = 'submit';
    button.textContent = 'Sign in';
    button.style.cssText =
      "font-family:'Clash Display',sans-serif;font-weight:600;font-size:15px;color:#04120a;background:#6AFF00;" +
      'border:none;border-radius:999px;padding:12px 22px;cursor:pointer';

    var error = document.createElement('span');
    error.setAttribute('role', 'alert');
    error.style.cssText = "font-family:'JetBrains Mono',monospace;font-size:12px;color:#ff8aa0;min-height:16px";

    form.appendChild(title);
    form.appendChild(hint);
    form.appendChild(input);
    form.appendChild(button);
    form.appendChild(error);
    overlay.appendChild(form);
    document.body.appendChild(overlay);
    setTimeout(function () { input.focus(); }, 60);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      error.textContent = '';
      button.disabled = true;
      fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: input.value })
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok || !d.ok) throw new Error(d.error || 'Sign-in failed');
          return d;
        }); })
        .then(function (d) {
          token = d.token;
          try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e) {}
          overlay.remove();
          start();
        })
        .catch(function (err) {
          button.disabled = false;
          error.textContent = err.message;
          input.select();
        });
    });
  }

  /* ---------------- save ---------------- */

  function save() {
    collect();
    window.cmsToast('Publishing\\u2026');
    return api('/api/content', { method: 'PUT', body: JSON.stringify({ content: content }) })
      .then(function (data) {
        content = data.content || content;
        window.cmsDirty(false);
        window.cmsToast('Published — the site is updated');
        populate();
      })
      .catch(function (err) {
        window.cmsToast(err.message === 'Not signed in' ? 'Session expired — reload to sign in' : err.message);
      });
  }

  function start() {
    api('/api/content')
      .then(function (data) {
        content = data.content;
        populate();
        buildCollectionEditors();
        loadInbox();
        buildPasswordCard();
      })
      .catch(function (err) { window.cmsToast('Could not load content: ' + err.message); });
  }

  /* ---------------- hook into the ported UI ---------------- */

  // Capture phase, so these run before the ported mockup's cosmetic handlers.
  // For the actions the mockup only fakes, propagation stops here — otherwise it
  // would fire its own "Draft saved" toast over the real result.
  root.addEventListener('click', function (e) {
    if (e.target.closest('[data-save]') || e.target.closest('[data-publish]')) {
      e.stopPropagation();
      save();
      return;
    }
    if (e.target.closest('[data-discard]')) {
      e.stopPropagation();
      window.cmsDirty(false);
      window.cmsToast('Reloaded from the published version');
      start();
      return;
    }
    if (e.target.closest('[data-preview]')) {
      e.stopPropagation();
      collect();
      // go() is the only writer of the breadcrumb, and it is what the header shows
      var crumb = root.querySelector('[data-crumb]');
      var pane = crumb ? (crumb.textContent || '').trim().toLowerCase() : '';
      if (!pane) {
        var active = qa('.rail-item').filter(function (b) { return b.dataset.active === '1'; })[0];
        pane = active ? active.getAttribute('data-nav') : '';
      }
      var post = currentPost();
      // preview=1 renders drafts too, so an unpublished post can still be read
      var url =
        pane === 'blog' && post
          ? '/?post=' + encodeURIComponent(post.id) + '&preview=1'
          : '/';
      window.open(url, '_blank', 'noopener');
      if (window.cmsIsDirty && window.cmsIsDirty()) {
        window.cmsToast('Preview shows the published version — save to include your edits');
      }
      return;
    }

    // Publish / unpublish the selected post, for real.
    var unpub = e.target.closest('[data-unpublish]');
    if (unpub) {
      e.stopPropagation();
      var post = currentPost();
      if (post) {
        post.published = post.published === false;
        populatePostList();
        populateCounts();
        window.cmsDirty(true);
        window.cmsToast(post.published ? 'Marked for publishing — save to apply' : 'Moved to drafts — save to apply');
      }
      return;
    }

    // New post: create one and select it, rather than toasting about it.
    if (e.target.closest('[data-new-post]')) {
      e.stopPropagation();
      var posts = (content.blog && content.blog.posts) || [];
      var id = 'post-' + Date.now().toString(36);
      // newest first: the blog's featured slot shows posts[0]
      posts.unshift({
        id: id, title: 'Untitled post', category: '', date: '', readTime: '',
        alt: '', excerpt: '', body: '', published: false,
      });
      selectedPost = id;
      populate();
      window.cmsDirty(true);
      window.cmsToast('Draft created — fill it in, then save');
      return;
    }

    // Accent swatches: record the choice so collect() can persist it.
    var swatch = e.target.closest('[data-swatch-value]');
    if (swatch) {
      e.stopPropagation();
      var chosenColour = swatch.getAttribute('data-swatch-value');
      qa('[data-swatch-value]').forEach(function (el) {
        var on = el === swatch;
        el.dataset.swatch = on ? '1' : '0';
        el.style.borderColor = on ? 'var(--text)' : 'transparent';
      });
      set('settings.accent', chosenColour);
      // retheme immediately so the choice is visible before saving
      if (window.__applyAccent) window.__applyAccent(chosenColour);
      window.cmsDirty(true);
      return;
    }

    // "+ Add" appends a real entry to whichever collection this pane edits.
    var add = e.target.closest('[data-add]');
    if (add) {
      e.stopPropagation();
      var pane = add.closest('[data-panel]');
      var paneName = pane && pane.getAttribute('data-panel');

      if (paneName === 'blog') {
        pickPostImage('blog-cover');
        return;
      }

      if (paneName === 'media') {
        if (window.cmsGo) window.cmsGo('media');
        window.cmsToast('Pick a slot and choose an image');
        return;
      }

      if (paneName === 'stack') {
        var groups = get('stack') || [];
        groups.push({ group: 'New group', items: [{ icon: 'cube', label: '', tip: '' }] });
        set('stack', groups);
        renderStack(root.querySelector('[data-collection="stack"]'));
        window.cmsDirty(true);
        window.cmsToast('Group added — name it, then save');
        return;
      }

      var spec = null;
      Object.keys(COLLECTIONS).forEach(function (key) {
        if (COLLECTIONS[key].pane === paneName) spec = COLLECTIONS[key];
      });
      if (spec) {
        var arr = collectionArray(spec);
        arr.push(JSON.parse(JSON.stringify(spec.blank)));
        renderCollection(spec, root.querySelector('[data-panel="' + spec.pane + '"] [data-collection]'));
        populateCounts();
        window.cmsDirty(true);
        window.cmsToast('Added a ' + spec.label + ' — fill it in, then save');
        return;
      }

      // resume "version history": the real versions are the stored content snapshots
      if (paneName === 'resume') {
        if (window.cmsGo) window.cmsGo('media');
        window.cmsToast('Upload a resume PDF in Media, then link it in Settings');
        return;
      }

      window.cmsToast('Nothing to add here');
      return;
    }

    // post selection: let the mockup's highlight logic run too, so don't stop here
    var postRow = e.target.closest('[data-post-id]');
    if (postRow) {
      collect();                          // keep edits made to the post being left
      selectedPost = postRow.getAttribute('data-post-id');
      populate();
    }
  }, true);

  // Toggles and sliders: let the mockup animate them, then record the new value.
  root.addEventListener('click', function (e) {
    var toggle = e.target.closest('[data-toggle-field]');
    if (toggle) {
      set(toggle.getAttribute('data-toggle-field'), toggle.dataset.toggle === '1');
      window.cmsDirty(true);
    }
  });

  root.addEventListener('input', function (e) {
    var slider = e.target.closest && e.target.closest('[data-range-field]');
    if (slider) {
      var n = parseInt(slider.value, 10);
      if (!isNaN(n)) set(slider.getAttribute('data-range-field'), n);
      window.cmsDirty(true);
    }
  });

  root.addEventListener('input', function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute('data-field')) window.cmsDirty(true);
  });

  // warn before losing unsaved edits
  window.addEventListener('beforeunload', function (e) {
    if (window.cmsIsDirty && window.cmsIsDirty()) { e.preventDefault(); e.returnValue = ''; }
  });

  if (token) {
    // verify the stored token before trusting it
    fetch('/api/login', { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.valid) start(); else { token = ''; gate(); } })
      .catch(function () { gate(); });
  } else {
    gate();
  }
})();
</script>
`;

function buildPortfolio() {
  const src = fs.readFileSync(path.join(dir, 'Daniel Lotsu Portfolio.dc.html'), 'utf8');
  const parts = extractParts(src);
  const helmet = fixMobileNav(stripUnusedScripts(parts.helmet));

  const slots = fillImageSlots(parts.body);
  const annotated = annotateContent(addFooterSocials(drawStackIcons(slots.body)));
  const t = transformBindings(annotated.body);

  const expectedRefs = [
    'setRoot', 'setCursorRing', 'setCursorDot', 'setHeroCanvas', 'setHeroParallax',
    'setStack', 'setScan', 'setContact', 'setForm', 'setStatus',
  ];
  for (const r of expectedRefs) if (!t.refs.has(r)) throw new Error('missing ref: ' + r);

  const head = `<title>Daniel Ajayi Lotsu — Backend &amp; Cloud Engineer</title>
<meta name="description" content="Backend &amp; cloud engineer at AmaliTech in Kumasi, Ghana. AWS-certified, architecting scalable cloud-native systems, REST APIs and serverless workloads.">
<meta name="author" content="Daniel Ajayi Lotsu">
<meta name="theme-color" content="#020a02">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:title" content="Daniel Ajayi Lotsu — Backend &amp; Cloud Engineer">
<meta property="og:description" content="AWS-certified backend &amp; cloud engineer building reliable, well-architected services from Kumasi, Ghana.">
<meta name="twitter:card" content="summary_large_image">`;

  // the hydrator needs the slot -> bundled art map to fall back correctly
  const slotArt = {};
  for (const [id, art] of Object.entries(SLOT_ART)) slotArt[id] = art.file;
  const hydrate = HYDRATE_RUNTIME.replace('__SLOT_ART__', JSON.stringify(slotArt)).replace(
    '__SVC_ICONS__',
    JSON.stringify(SVC_ICONS)
  );
  if (hydrate.includes('__SLOT_ART__') || hydrate.includes('__SVC_ICONS__')) {
    throw new Error('a hydrator placeholder was not replaced');
  }

  fs.writeFileSync(
    path.join(dir, 'index.html'),
    page({ helmet, body: t.body, runtime: THEME_RUNTIME + PORTFOLIO_RUNTIME + hydrate, head })
  );
  console.log(
    'wrote index.html  · refs:', t.refs.size,
    '· events:', [...t.events].join(','),
    '· slots filled:', slots.filled.length,
    '· content bindings:', annotated.bound.length,
    '· blog regions:', annotated.regions
  );
}

function buildCms() {
  const src = fs.readFileSync(path.join(dir, 'Portfolio CMS.dc.html'), 'utf8');
  const parts = extractParts(src);
  const helmet = markCmsActiveNav(stripUnusedScripts(parts.helmet));
  const controls = annotateCmsControls(tagCoverControls(parts.body));
  const fields = annotateCmsFields(controls.body);
  const t = transformBindings(fields.body);
  if (!t.refs.has('setRoot')) throw new Error('CMS: missing setRoot ref');

  const head = `<title>Portfolio CMS — Daniel Ajayi Lotsu</title>
<meta name="description" content="Content dashboard for this portfolio. Sign-in required; edits publish to the live site.">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#020a02">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">`;

  // hand the CMS the same slot -> default art map the portfolio is built with
  const slotArt = {};
  for (const [id, art] of Object.entries(SLOT_ART)) slotArt[id] = art.file;
  const dataRuntime = CMS_DATA_RUNTIME.replace('__SLOT_ART__', JSON.stringify(slotArt)).replace(
    '__SVC_ICONS__',
    JSON.stringify(SVC_ICONS)
  );
  if (dataRuntime.includes('__SLOT_ART__') || dataRuntime.includes('__SVC_ICONS__')) {
    throw new Error('CMS: a placeholder was not replaced');
  }

  fs.writeFileSync(
    path.join(dir, 'cms.html'),
    page({ helmet, body: t.body, runtime: THEME_RUNTIME + CMS_RUNTIME + dataRuntime, head })
  );
  console.log(
    'wrote cms.html    · refs:', t.refs.size,
    '· events:', [...t.events].join(','),
    '· fields:', fields.bound,
    '· toggles:', controls.toggles,
    '· swatches:', controls.swatches,
    '· sliders:', controls.ranges
  );
}

buildPortfolio();
buildCms();
