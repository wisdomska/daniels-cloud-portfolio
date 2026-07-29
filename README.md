# Daniel's Cloud Portfolio + CMS

Portfolio for **Daniel Ajayi Lotsu** — backend & cloud engineer at AmaliTech, Kumasi, Ghana —
with a content dashboard that publishes to it.

| | |
| --- | --- |
| Portfolio | https://daniels-cloud-portfolio.vercel.app |
| CMS | https://daniels-cloud-portfolio.vercel.app/cms |

Both ship from this one repo and one Vercel project, so the CMS is same-origin with the
content API it writes to.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | The portfolio — generated, do not edit by hand |
| `cms.html` | The content dashboard — generated, do not edit by hand |
| `tools/build-from-design.js` | Builds both pages from the two `.dc.html` design exports |
| `api/content.js` | `GET` (public) / `PUT` (authenticated) the content document |
| `api/login.js` | Password → short-lived HMAC bearer token |
| `api/upload.js` | Authenticated image upload to Vercel Blob |
| `api/messages.js` | The CMS inbox: list / mark read / delete |
| `api/contact.js` | Contact form: stores the message, then emails it |
| `api/_content.js` | Content schema + defaults, blob read/write, auth, CORS |
| `api/_messages.js` | Contact submissions store (a separate blob — see below) |
| `assets/blog/` | Default cover/hero art for the blog image slots |
| `*.dc.html`, `support.js`, `image-slot.js`, `_ds/` | The Claude Design exports and their editor runtime |

## The build

The designs are Claude Design exports that run on a browser-side React + Babel runtime.
`tools/build-from-design.js` rewrites them as plain HTML plus a vanilla IIFE:

- `ref="{{ setFoo }}"` → `id="dc-setFoo"`; `onClick="{{ fn }}"` → `data-on-click="fn"`
- `style-hover` / `style-focus` → applied by a small shim
- `<image-slot id="…">` → `<img data-slot="…">` with the bundled default art
- the `DCLogic` classes → hand-ported vanilla logic

```bash
npm run generate     # regenerate index.html and cms.html
```

**Content bindings are applied by the build, not stored in the design files.** The design
exports stay exactly as the design tool produced them, so re-syncing a design is safe. Every
binding is keyed on a unique fragment of its target element, and the build *throws* if a
fragment goes missing or becomes ambiguous — a re-sync that moves a field fails the build
instead of silently shipping a field the CMS can no longer reach. The same applies to the CMS:
its inputs carry no names, so `CMS_FIELDS` lists each pane's fields in document order and the
build asserts the counts.

## How a CMS edit reaches the portfolio

1. The CMS signs in (`POST /api/login`) and holds a 12-hour HMAC token in `sessionStorage`.
2. It loads the content document (`GET /api/content`) and fills every `data-field` input.
3. Save/Publish collects the fields and `PUT`s the document, which is written to Vercel Blob.
4. The portfolio fetches `/api/content` on every load — `Cache-Control: no-store` end to end,
   so there is no stale layer to wait out — and applies it to the elements the build annotated.
5. It also revalidates when the tab regains focus, so publishing in one tab and switching back
   to the portfolio in another shows the change without a manual reload.

Anything absent from the stored document falls back to `DEFAULTS` in `api/_content.js`, and the
static markup already contains the current copy — so if the API is unreachable the portfolio
still renders correctly rather than emptying out.

### What the CMS drives

Hero, About, Experience, Contact, Resume, Settings (page title, meta description, accent,
reduce-motion), the four blog posts (title, category, date, read time, image alt, excerpt, body),
per-post publish state, and the eight blog image slots via the Media pane.

### Known limits

- **The blog layout is built for four posts** — one featured plus three minis, each with its own
  image slot. The two extra drafts in the CMS are stored and editable, but publishing one does
  not add a fifth card; that needs a design change.
- **Certifications, Tech stack and Projects** have no editable inputs in the CMS design (they're
  static lists there), so those sections are not CMS-driven.
- An article's prose is only replaced when the CMS body field is non-empty; otherwise the copy
  written into the design stands.

## Environment

| Variable | Required for | Notes |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Saving content, uploads, inbox | Provisioned by the Vercel Blob store |
| `CMS_PASSWORD` | Signing in to the CMS | Without it, `/api/login` returns 503 |
| `CMS_SECRET` | optional | Token signing key; falls back to the blob token |
| `RESEND_API_KEY` | Emailing contact submissions | Without it, messages are still stored and shown in the inbox |
| `CONTACT_TO` / `CONTACT_FROM` | optional | Recipient and verified sender |
| `CMS_ORIGIN` | optional | Extra allowed origin, for driving the API from elsewhere |

Contact submissions live in their own blob, deliberately: the CMS `PUT`s the whole content
document on save, so a save holding a stale copy would otherwise wipe the inbox.

## Local development

```bash
npx vercel dev
```

Serves the pages *and* the API. A plain static server (`npm run serve`) renders both pages but
every `/api/*` call 404s — the portfolio falls back to its built-in copy and the CMS cannot
sign in.

## Deploy

Pushes to `main` deploy automatically via the Vercel Git integration.
