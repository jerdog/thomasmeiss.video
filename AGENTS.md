# AGENTS.md — Thomas Meiss Video

Guidance for AI coding agents working in this repository.

## Project summary

Single-page portfolio for **Thomas Meiss Video** at **thomasmeiss.video**. Noir Editorial design (dark cinema + magazine layout). Freelance video producer: documentary, weddings, commercial, aerial.

## Key decisions (do not reverse without asking)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hosting | **Cloudflare Workers + static assets** | Pages deprecated for new projects; SPA served via `not_found_handling: "single-page-application"` |
| Framework | **Vite + React 19 + TypeScript + Tailwind v4** | SPA with minimal JS; Tailwind v4 via `@tailwindcss/vite` |
| API | **Worker at `/api/contact` only** | `run_worker_first: ["/api/*"]` — assets-first for cost/performance |
| Email | **Cloudflare Email Service** (`send_email` binding) | Outbound from Worker; Email Routing verifies destination inbox |
| Analytics | **First-party beacons → D1 → `/admin`** | Owned data, conversion tracking, and Web Vitals; cookie-free so no consent banner. Cloudflare Web Analytics may run alongside as a cross-check |
| Web Vitals | **`web-vitals` library, p75 in D1** | Chosen over Cloudflare's RUM API: no account API token, no ~30-day retention ceiling, not blocked by ad blockers, and one query joins it with everything else |
| Admin auth | **Cloudflare Access** + Worker-side JWT verification | Edge SSO with no passwords in the app; the Worker never trusts the header alone |
| Storage | **Cloudflare D1** (`DB` binding) | Pageviews + contact submissions; schema in `migrations/` |
| Env vars | **`keep_vars: true`** + dashboard Variables | Production secrets/vars managed in Workers dashboard; local via `.dev.vars` |
| Scaffold | **Manual** (not create-cloudflare) | Folder name `thomasmeiss.video` breaks C3 project naming |
| Content | **`src/data/content.ts`** | Single source for copy and links — not inline in components |
| Pricing | **No published tiers** | Every project scoped individually; pricing copy merged into the contact section |
| Section titles | **`SectionHeading` → `h2` + `font-display`** | Matches hero `h1` typography; subtitle optional as muted `p` |
| Motion | **`motion` + `usePrefersReducedMotion`** | Respect `prefers-reduced-motion` globally in CSS too |

## Repository layout

```
worker/index.ts          Route table + scheduled prune; handlers live in routes/
worker/routes/           contact.ts, collect.ts, vitals.ts, admin.ts
worker/lib/              access.ts (Access JWT), db.ts, visitor.ts, http.ts
migrations/              D1 schema — never edit an applied migration, add a new one
scripts/                 deploy.sh; import-web-analytics.mjs (one-off history import)
src/main.tsx             Public site, or the lazy /admin bundle by pathname
src/App.tsx              Composes sections in order; skip link to #main
src/admin/               Dashboard app — not imported by the public site
src/lib/analytics.ts     Pageview beacon
src/data/content.ts      All site copy and structured data
src/index.css            @theme tokens, textures, reduced-motion, scroll-margin
src/components/          One file per section + ui/ primitives
wrangler.jsonc             Worker name: thomasmeiss-video
docs/plan.md               Human-readable roadmap and status
```

### Page sections (order in App.tsx)

1. Nav — sticky, mobile hamburger menu
2. Hero — sole `h1`; 2-col on `lg` with portrait placeholder (set `heroPortrait.src` to swap in a real image)
3. TrustMarquee — decorative, `aria-hidden`
4. Showreel — placeholder (no fake play button)
5. WorkGrid — 6-col bento, external project links
6. Services — ARIA tablist + tabpanel
7. Channels
8. About
9. ContactForm — merged pricing + contact section; POST `/api/contact`
10. Footer

## Design system

Tokens in `src/index.css` `@theme`:

- `--color-ground`: `#0a0a0b`
- `--color-bone`, `--color-bone-muted`
- `--color-ember`, `--color-ember-light`
- `--color-border`: ~24% white (WCAG UI contrast)
- `--font-display`: Bodoni Moda
- `--font-body`: Manrope

Utilities: `.texture-diagonal`, `.glow-ember`, `.link-underline`, `.animate-marquee`

**When adding a section:** use `SectionHeading` with the section name as `title` (e.g. `"Pricing"`), descriptive copy as optional `subtitle`. Do not reintroduce small-caps eyebrow-only labels without an `h2`.

## Cloudflare / Wrangler

- Config file: **`wrangler.jsonc`** (JSONC, not TOML)
- After binding changes: `npm run types` → updates `worker-configuration.d.ts`
- Use generated **`Env`** type — do not hand-write binding interfaces
- Deploy: `npm run deploy` (build + wrangler deploy)
- **Do not** add Netlify config or Pages assumptions
- **Do not** set `remote: true` on `send_email` by default (breaks local dev without auth)

### Contact Worker (`worker/index.ts`)

- `POST /api/contact` only; validate JSON; honeypot `bot-field`
- `env.EMAIL.send({ to: env.CONTACT_TO, from, replyTo, subject, html, text })`
- Returns `{ ok: true }` or `{ ok: false, error }`

**`CONTACT_TO` must be a verified Destination Address, not a routing rule.**
Email Routing (inbound) and Email Sending (outbound) are separate systems that
share a dashboard. A custom address like `contact@thomasmeiss.video` lives under
**Routes** and forwards to a real inbox — it is never a valid send target, and
using one fails at runtime with `destination address is not a verified address`
while the dashboard looks correct. Send to whatever is listed under **Email
Routing → Destination Addresses** with a verified timestamp. Onboarding the
domain for Email Sending removes this restriction.

### Skills to consult

- `wrangler`, `workers-best-practices`, `cloudflare-email-service` (Cloudflare plugin or `~/.claude/skills/`)
- `frontend-design`, `tailwind-css`, `accessibility`, `seo` for UI work
- Cloudflare Docs MCP for live API reference

## Accessibility requirements

Maintain WCAG 2.2 AA orientation. Already implemented — preserve when editing:

- Skip link to `#main` in App.tsx
- One `h1` (Hero); section names as `h2` via SectionHeading
- Mobile nav with `aria-expanded`, Escape to close, min 44px targets where possible
- Services: full tab pattern (`role="tablist"`, `tabpanel`, `aria-controls`, roving `tabIndex`)
- External links: `aria-label` includes “opens in new tab” where `target="_blank"`
- Form: associated labels, `aria-live` on success/error
- `scroll-margin-top` on sections for fixed header
- Showreel: no non-functional interactive controls
- Reduced motion: hook + global CSS; gate Motion hover/scroll effects

Run manual keyboard pass after nav/form changes.

## Development process

1. **Read** `src/data/content.ts` before changing copy
2. **Match** existing component patterns (imports, Tailwind, motion gating)
3. **Keep diffs focused** — one concern per change
4. **Verify** `npm run build` before finishing
5. **Do not commit** unless explicitly asked
6. **Do not** commit `.dev.vars`, secrets, or personal emails

### Adding content

- New projects, nav links, pricing copy, hero portrait → `content.ts`
- Placeholders (no media yet): `texture-diagonal` frame + `role="img"` + `aria-label`, never a fake interactive control — see `VimeoFacade` and the Hero portrait
- Interactive targets: `min-h-11` (44px). Sub-24px targets fail WCAG 2.2 SC 2.5.8 unless spaced apart
- New section → component in `src/components/`, import in `App.tsx`, add nav link if needed

### Adding Worker routes

- Add a handler in `worker/routes/` and register it in `worker/index.ts`; add the
  path to `run_worker_first` if it is not under `/api/*`
- Regenerate types after wrangler.jsonc changes

## Admin dashboard (`/admin`)

Private analytics + contact-inbox dashboard. Setup steps are in the README.

**Security model — do not weaken:**

- Cloudflare Access guards `/admin` **and** `/api/admin` at the edge; the Worker
  re-verifies the `Cf-Access-Jwt-Assertion` JWT (signature against the team JWKS,
  `aud`, `iss`, `exp`/`nbf`, email allow-list) on every admin request.
  Never accept an Access header without verifying it.
- Missing config, bad signature, or wrong audience → **401**. Fail closed, always.
- Mutations require a same-origin `Origin` header — the Access session is a cookie.
- `ADMIN_DEV_BYPASS_EMAIL` is a `.dev.vars`-only switch. Never document it as a
  production variable, never reference it outside `worker/lib/access.ts`.

**Web Vitals:** collected by `web-vitals` (dynamically imported, so it stays out
of the initial bundle) and reported at **p75** — never an average, which hides
the slow tail the thresholds exist to catch. Each metric is its own nullable
column, so a visit that reports only some metrics is a partial row and each
metric's percentile skips NULLs. That is what makes it safe for the client to
send whatever is new at each lifecycle event: metrics are never double-counted.
`web-vitals` finalizes CLS and INP from a **capture-phase** `visibilitychange`
listener on `window`, so the flush listeners in `src/lib/analytics.ts` must stay
bubble-phase and registered after the `on*` calls — reorder them and CLS and INP
silently vanish.

**Imported history — do not merge into `page_views`.** Pre-launch data from
Cloudflare Web Analytics lives in `imported_daily` as daily aggregates
(`scripts/import-web-analytics.mjs`). It is a different instrument measuring a
different population, and it carries no visitor identity, so folding it into the
event table would mean inventing rows and corrupting the unique-visitor count on
both sides of the cutover. The dashboard shows it as a dashed line and keeps the
tiles, breakdowns and inquiry rate on tracked data only.

Two related rules the chart depends on, both about not drawing a zero where
there was no measurement: `importedViews` is `null` (not `0`) for a day
Cloudflare has no record of, and the tracked lines start at `trackingStartDay`
rather than running along the baseline through days this site could not see.

**Privacy model — do not weaken:** no cookies, no local storage, no stored IP or
user-agent string. `visitor_hash` is `SHA-256(salt | UTC day | IP | UA)`, so it
rotates daily. `web_vitals` rows carry no visitor identifier at all — performance
data needs no notion of who. Anything that would make a visitor identifiable across days (a
persistent id, a cookie, storing the raw IP) needs a consent banner and is a
product decision, not a refactor.

**Charts** (`src/admin/components/`) are hand-rolled inline SVG — no chart
library. Series colours are `--color-chart-views` / `--color-chart-visitors`,
validated for contrast and colour-vision deficiency against the `--color-surface`
card. If either token or the card colour changes, re-validate the pair rather
than eyeballing it. Every chart keeps a legend (2+ series), a table view or
`aria-label` summary, and hover *and* keyboard access to values.

## Out of scope (unless requested)

- Multi-page routing / React Router (the `/admin` split in `main.tsx` is a
  pathname check, not a router — keep it that way)
- CMS / headless backend
- Real showreel embed (placeholder until media provided)
- Cloudflare Turnstile (honeypot only for now)
- Netlify, Auth0, ORMs (D1 is used directly via prepared statements)

## Future scope (see docs/plan.md)

- Blog (markdown in repo or CMS + routing)
- CMS for non-dev content edits
- Multi-page routes for project detail pages
- Email/push digest of new inquiries (the data is already in D1)
- Workers Analytics Engine if pageview volume outgrows D1's write budget

## Reference

- [`README.md`](README.md) — setup, deploy, env vars
- [`docs/plan.md`](docs/plan.md) — detailed plan and todo status
