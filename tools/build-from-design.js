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
  'blog-hero-cold-starts': {
    file: 'assets/blog/cold-starts-hero.svg',
    alt: 'Chart of Lambda invocation latency: a 214ms cold start, then warm invocations under 90ms',
  },
  'blog-hero-leave-api': {
    file: 'assets/blog/leave-api-hero.svg',
    alt: 'Topology: API Gateway feeding request and balance services, joined by an event bus, writing to PostgreSQL',
  },
  'blog-hero-pooling': {
    file: 'assets/blog/pooling-hero.svg',
    alt: 'Many Lambda containers multiplexed through RDS Proxy onto three stable PostgreSQL connections',
  },
  'blog-hero-firstyear': {
    file: 'assets/blog/first-year-hero.svg',
    alt: 'Rising timeline from National Service through two AWS certifications to Software Engineer',
  },
};

/* ---------------------------- helpers ---------------------------- */

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
    // data-slot keeps the slot's identity in the DOM so the CMS's media pane can
    // swap this image at runtime; the bundled art is the default when none is set.
    return (
      `<img data-slot="${id}" src="${art.file}" alt="${art.alt}" decoding="async" ` +
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

  ['about.heading', 'The engineer behind the cloud'],
  ['about.body', 'Daniel is a backend &amp; cloud engineer at AmaliTech who turns'],

  ['experience.description', 'Building and maintaining backend services on AWS'],

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
  experience: [
    'experience.role',
    'experience.company',
    'experience.start',
    'experience.end',
    'experience.location',
    'experience.description',
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

function page({ helmet, body, runtime, head }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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

/* ------------------- shared runtime preamble ------------------- */
// style-hover / style-focus shim + data-on-* binding, used by both pages.
const SHARED_RUNTIME = `
  function styleShim() {
    document.querySelectorAll('[style-hover]').forEach(function (el) {
      var base = el.getAttribute('style') || '';
      var hover = el.getAttribute('style-hover') || '';
      el.addEventListener('mouseenter', function () { el.setAttribute('style', base + ';' + hover); });
      el.addEventListener('mouseleave', function () { el.setAttribute('style', base); });
    });
    document.querySelectorAll('[style-focus]').forEach(function (el) {
      var base = el.getAttribute('style') || '';
      var focus = el.getAttribute('style-focus') || '';
      el.addEventListener('focus', function () { el.setAttribute('style', base + ';' + focus); });
      el.addEventListener('blur', function () { el.setAttribute('style', base); });
    });
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
    var colors = ['#6AFF00', '#9dff5c', '#3aa300', '#06b6d4', '#ffffff'];
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
      var count = Math.max(42, Math.min(94, Math.round(w * h / 15000)));
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
            ctx.strokeStyle = 'rgba(106,255,0,' + al.toFixed(3) + ')';
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        var mdx = p.x - mouse.x, mdy = p.y - mouse.y, md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < DM) {
          var ml = (1 - md / DM) * 0.65;
          ctx.strokeStyle = 'rgba(150,255,80,' + ml.toFixed(3) + ')';
          ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          p.x -= (mdx / (md || 1)) * (1 - md / DM) * 0.7;
          p.y -= (mdy / (md || 1)) * (1 - md / DM) * 0.7;
        }
      }
      for (var j = 0; j < nodes.length; j++) {
        var nn = nodes[j];
        var rr = 1.1 + nn.z * 1.9;
        ctx.beginPath(); ctx.arc(nn.x, nn.y, rr, 0, 6.2832);
        ctx.fillStyle = 'rgba(150,255,80,' + (0.45 + nn.z * 0.55).toFixed(2) + ')';
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
  initCounters();
  initScan();
  initCursor();
  initHero();

  var hash = (location.hash || '').replace('#', '');
  if (hash === 'resume' || hash === 'blog') showView(hash);
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
    var avail = document.querySelector('[data-content="hero.availability"]');
    if (avail && content.hero && content.hero.showAvailability === false) {
      var badge = avail.closest('.hero-float') || avail;
      badge.style.display = 'none';
    }
    if (content.contact && content.contact.showForm === false) {
      var form = document.getElementById('dc-setForm');
      if (form) form.style.display = 'none';
    }
    var dl = document.querySelector('[data-download-resume]');
    if (dl && content.resume && content.resume.showDownload === false) dl.style.display = 'none';
  }

  function applyPosts(content) {
    var posts = content.blog && content.blog.posts;
    if (!Array.isArray(posts)) return;

    posts.forEach(function (post) {
      if (!post || !post.id) return;
      document.querySelectorAll('[data-post="' + post.id + '"]').forEach(function (region) {
        var isArticle = region.getAttribute('data-blog') === 'article';

        setText(region.querySelector(isArticle ? 'h1' : '.blog-title'), post.title);

        var cat = region.querySelector('[data-cms-category]');
        if (cat) setText(cat, post.category);

        var dateline = region.querySelector('[data-cms-dateline]');
        if (dateline) {
          setText(dateline, [post.date, post.readTime].filter(Boolean).join(' · '));
        }

        var img = region.querySelector('img[data-slot]');
        if (img && post.alt) img.alt = post.alt;

        // Only replace the article's prose when the CMS actually holds a body —
        // otherwise the copy written into the design stands.
        if (isArticle && typeof post.body === 'string' && post.body.trim()) {
          var prose = region.querySelector('[data-cms-body]');
          if (prose) {
            prose.textContent = '';
            post.body.split(/\\n\\s*\\n/).forEach(function (para) {
              var text = para.trim();
              if (!text) return;
              var p = document.createElement('p');
              p.textContent = text;
              prose.appendChild(p);
            });
          }
        }

        // an unpublished post disappears from the list and can't be opened
        if (post.published === false && !isArticle) region.style.display = 'none';
      });
    });
  }

  function applyMedia(content) {
    var media = content.media || {};
    document.querySelectorAll('img[data-slot]').forEach(function (img) {
      var url = media[img.getAttribute('data-slot')];
      if (typeof url === 'string' && url) img.src = url;
    });
  }

  function applySettings(content) {
    var s = content.settings || {};
    if (s.pageTitle) document.title = s.pageTitle;
    if (s.metaDescription) {
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', s.metaDescription);
    }
    if (s.accent && root) root.style.setProperty('--primary', s.accent);
    if (s.reduceMotion && root) root.dataset.motion = 'off';
  }

  function hydrate(content) {
    if (!content || typeof content !== 'object') return;
    applyScalars(content);
    applyPosts(content);
    applyMedia(content);
    applyVisibility(content);
    applySettings(content);
    document.documentElement.setAttribute('data-content-loaded', '1');
  }

  function load() {
    return fetch('/api/content', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data && data.ok) hydrate(data.content); })
      .catch(function () { /* offline or API down: the static markup already reads correctly */ });
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

    // reflect the selected post in the list
    qa('[data-post]').forEach(function (b) {
      var on = b.getAttribute('data-post-id') === selectedPost;
      if (b.hasAttribute('data-post-id')) b.dataset.active = on ? '1' : '';
    });

    renderMedia();
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
  }

  /* ---------------- media pane ---------------- */

  // The media pane in the design is a static gallery. Give each known image slot a
  // labelled file input so a new image can actually be attached to it.
  function buildMediaPane() {
    var pane = root.querySelector('[data-panel="media"]');
    if (!pane || pane.querySelector('[data-media-editor]')) return;

    var slots = (content && content.media) ? Object.keys(content.media) : [];
    if (!slots.length) return;

    var wrap = document.createElement('div');
    wrap.setAttribute('data-media-editor', '');
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
    return SLOT_ART[slot] || '';
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
      row.appendChild(head);
      row.appendChild(body);
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
        loadInbox();
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
      window.open('/', '_blank', 'noopener');
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
  const annotated = annotateContent(slots.body);
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

  fs.writeFileSync(
    path.join(dir, 'index.html'),
    page({ helmet, body: t.body, runtime: PORTFOLIO_RUNTIME + HYDRATE_RUNTIME, head })
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
  const helmet = stripUnusedScripts(parts.helmet);
  const fields = annotateCmsFields(parts.body);
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
  const dataRuntime = CMS_DATA_RUNTIME.replace('__SLOT_ART__', JSON.stringify(slotArt));
  if (dataRuntime.includes('__SLOT_ART__')) throw new Error('CMS: slot art placeholder not replaced');

  fs.writeFileSync(
    path.join(dir, 'cms.html'),
    page({ helmet, body: t.body, runtime: CMS_RUNTIME + dataRuntime, head })
  );
  console.log(
    'wrote cms.html    · refs:', t.refs.size,
    '· events:', [...t.events].join(','),
    '· fields bound:', fields.bound
  );
}

buildPortfolio();
buildCms();
