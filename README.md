# Thomas Meiss Video

Single-page portfolio for **Thomas Meiss Video** — a freelance video producer specializing in documentary, weddings, commercial short-form, and aerial work.

**Live domain:** [thomasmeiss.video](https://thomasmeiss.video)

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, [Motion](https://motion.dev/) |
| Build | Vite 7 + [@cloudflare/vite-plugin](https://developers.cloudflare.com/workers/vite-plugin/) |
| Hosting | **Cloudflare Workers** (static assets + SPA routing — not Pages) |
| API | Worker at `/api/contact`, `/api/collect`, `/api/admin/*` |
| Email | Cloudflare Email Service (`send_email` binding) |
| Analytics | First-party beacon → **Cloudflare D1** → `/admin` dashboard |
| Admin auth | **Cloudflare Access** (Zero Trust), re-verified in the Worker |

**Design:** Noir Editorial — near-black ground (`#0a0a0b`), bone text, ember accent, Bodoni Moda + Manrope.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (22+ recommended)
- npm
- A [Cloudflare account](https://dash.cloudflare.com/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (dev dependency)

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server (Workers runtime via Cloudflare plugin) |
| `npm run build` | Typecheck + production build |
| `npm run deploy` | Build + deploy via [`scripts/deploy.sh`](scripts/deploy.sh) (pins the Cloudflare account) |
| `npm run preview` | Preview production build locally |
| `npm run types` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `npm run db:migrate` | Apply D1 migrations to the local database |
| `npm run db:migrate:remote` | Apply D1 migrations to the production database |

### Contact form in dev

The form posts to `/api/contact`, handled by [`worker/index.ts`](worker/index.ts). Email is simulated locally unless you configure a remote send binding.

For real email in dev:

1. `npx wrangler login`
2. Add `"remote": true` to the `send_email` binding in [`wrangler.jsonc`](wrangler.jsonc)
3. Set contact env vars (see below)

### Local environment variables

Production contact vars can live in the **Cloudflare Workers dashboard** (see Deploy). For local dev, create a gitignored [`.dev.vars`](.dev.vars) file:

```bash
CONTACT_FROM=hello@thomasmeiss.video
CONTACT_FROM_NAME=Thomas Meiss Video
CONTACT_TO=your-verified-inbox@example.com
```

Run `npm run types` after changing bindings or vars in `wrangler.jsonc`.

### Dashboard in dev

```bash
npm run db:migrate     # create the local D1 tables (once)
npm run dev            # then open http://localhost:5173/admin
```

Cloudflare Access does not run locally. Set `ADMIN_DEV_BYPASS_EMAIL` in
`.dev.vars` to work on the dashboard — it skips verification and treats every
admin request as that user. It is a `.dev.vars`-only switch: never set it in the
Cloudflare dashboard, and with it unset locally every `/api/admin/*` call
correctly returns 401.

## Admin dashboard

`/admin` is a private dashboard with two views:

- **Analytics** — visitors, page views, inquiries and inquiry rate for the last
  7 / 30 / 90 / 365 days (each against the preceding period), traffic over time,
  inquiries per day, and top pages / referrers / countries / devices.
- **Inquiries** — every contact-form submission, filterable by new / read /
  archived, with reply-by-email, status changes, and delete.

Analytics come from a first-party beacon (`POST /api/collect`) rather than a
third-party script: **no cookies, no local storage, no IP or user-agent stored.**
A visitor is counted via a salted hash of IP + user agent that mixes in the UTC
date, so it rotates every 24 hours and cannot follow anyone across days.
Known bots and the `/admin` paths themselves are excluded.

Submissions are written to D1 *and* emailed. If email delivery fails the inquiry
is still recorded and flagged in the dashboard, so a bounced send never loses a lead.

### 1. Create the database

```bash
npx wrangler d1 create thomasmeiss-video
```

Paste the returned `database_id` into `d1_databases[0].database_id` in
[`wrangler.jsonc`](wrangler.jsonc), then create the tables:

```bash
npm run db:migrate          # local
npm run db:migrate:remote   # production
```

### 2. Protect it with Cloudflare Access

In **Zero Trust → Access → Applications → Add an application → Self-hosted**:

1. Add **two** public hostnames to the same application:
   `thomasmeiss.video/admin` and `thomasmeiss.video/api/admin` — the second one
   matters, since the dashboard's data comes from that path.
2. Add a policy: **Allow**, include **Emails** → your address (one-time PIN or a
   Google/GitHub identity provider both work).
3. Copy the **Application Audience (AUD) tag** from the application's overview.
4. Your **team domain** is under **Zero Trust → Settings → Custom Pages**
   (`your-team.cloudflareaccess.com`).

Access authenticates at the edge; the Worker independently verifies the signed
`Cf-Access-Jwt-Assertion` JWT against your team's public keys on every admin API
call, so a request that reaches the Worker by any other route (a preview URL, a
misconfigured policy) is still rejected. Missing configuration fails closed.

### 3. Worker variables and secrets

In **Workers → thomasmeiss-video → Settings → Variables and Secrets**:

| Name | Type | Purpose |
|------|------|---------|
| `CF_ACCESS_TEAM_DOMAIN` | Variable | `your-team.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Variable | Access application audience tag |
| `ADMIN_EMAILS` | Variable | Optional allow-list on top of the Access policy |
| `ANALYTICS_SALT` | **Secret** | Salt for the daily visitor hash — `npx wrangler secret put ANALYTICS_SALT` |
| `ANALYTICS_RETENTION_DAYS` | Variable | Optional; pageview retention, default 400 |

A daily cron (`23 4 * * *`) deletes pageviews past the retention window.
Contact submissions are never auto-deleted.

`/api/collect` is public by necessity (the site itself calls it) and only
same-origin, non-bot requests are recorded. That bounds accidental noise, not a
deliberate flood — if one ever shows up, add a Cloudflare **WAF rate-limiting
rule** on `/api/collect` (e.g. 60 requests per minute per IP) rather than
changing the Worker.

The deploy token in `.dev.vars` needs **D1:Edit** in addition to
**Workers Scripts:Edit**.

## Deploy to Cloudflare

### 1. Email (required for contact form)

```bash
# Verify destination inbox (confirm via email)
npx wrangler email routing addresses create you@example.com

# Enable routing + sending for the domain
npx wrangler email routing enable thomasmeiss.video
npx wrangler email sending enable thomasmeiss.video
```

Ensure `allowed_destination_addresses` in [`wrangler.jsonc`](wrangler.jsonc) matches where mail is sent.

Submissions send **from** `hello@thomasmeiss.video` **to** `CONTACT_TO`, with the submitter's address as `replyTo`.

### 2. Worker variables

This project uses `"keep_vars": true` in `wrangler.jsonc` so dashboard-managed variables are **not wiped** on deploy.

Set these in **Workers → thomasmeiss-video → Settings → Variables and Secrets**:

| Variable | Purpose |
|----------|---------|
| `CONTACT_FROM` | Sender address (e.g. `hello@thomasmeiss.video`) |
| `CONTACT_FROM_NAME` | Display name (`Thomas Meiss Video`) |
| `CONTACT_TO` | Verified inbox that receives form submissions |

Alternatively, uncomment the `vars` block in `wrangler.jsonc` for config-as-code (Wrangler will override dashboard values on deploy unless `keep_vars` is true).

### 3. Deploy

Deploys run through [`scripts/deploy.sh`](scripts/deploy.sh), which reads credentials from `.dev.vars` and exports them for Wrangler. This pins the target account explicitly — necessary on a machine signed into more than one Cloudflare account, where `wrangler login` state would otherwise decide where the Worker lands.

Add to your gitignored `.dev.vars`:

```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token   # needs Workers Scripts:Edit
```

Then:

```bash
npm run deploy              # build + deploy
npm run deploy -- --dry-run # extra args pass through to `wrangler deploy`
```

No `wrangler login` needed. The script fails fast with a clear message if either value is missing.

These two keys are read **only** by the deploy script. Wrangler does not upload `.dev.vars` on deploy, and `dist/client/.assetsignore` keeps it out of the static-asset upload, so the token never reaches the Worker or the public site. It *is* injected into the local dev Worker's `env` like any other `.dev.vars` entry, and `npm run types` will add both names (not values) to the tracked `worker-configuration.d.ts`.

### 4. Custom domain

Attach **thomasmeiss.video** (and optionally `www`) to the `thomasmeiss-video` Worker in the Cloudflare dashboard.

### 5. Analytics

Traffic data comes from the built-in beacon and appears at `/admin` — see
[Admin dashboard](#admin-dashboard) above. Cloudflare **Web Analytics**
(**Analytics & logs → Web Analytics → Add a site**) can be enabled alongside it
for Core Web Vitals; the two do not conflict.

## Project structure

```
thomasmeiss.video/
├── worker/
│   ├── index.ts                   # Router + daily prune cron
│   ├── routes/
│   │   ├── contact.ts             # POST /api/contact → email + D1
│   │   ├── collect.ts             # POST /api/collect  → pageview beacon
│   │   └── admin.ts               # GET/PATCH/DELETE /api/admin/* (authenticated)
│   └── lib/
│       ├── access.ts              # Cloudflare Access JWT verification
│       ├── db.ts                  # D1 queries + retention prune
│       ├── visitor.ts             # Daily-rotating visitor hash, bot + device rules
│       └── http.ts                # JSON responses, same-origin guard
├── migrations/                    # D1 schema (wrangler d1 migrations apply)
├── src/
│   ├── main.tsx                   # Public site, or lazy-loaded /admin bundle
│   ├── App.tsx                    # Section composition + skip link
│   ├── index.css                  # Design tokens, a11y, motion utilities
│   ├── data/content.ts            # All copy, links, pricing (single source)
│   ├── lib/analytics.ts           # Pageview beacon
│   ├── hooks/usePrefersReducedMotion.ts
│   ├── admin/
│   │   ├── AdminApp.tsx           # Dashboard shell (Analytics | Inquiries)
│   │   ├── api.ts, format.ts
│   │   └── components/            # StatTile, TrendChart, InquiryColumns, BarList, …
│   └── components/
│       ├── Nav.tsx                # Sticky nav + mobile menu
│       ├── Hero.tsx … Footer.tsx  # 11 page sections
│       └── ui/
│           ├── SectionHeading.tsx # h2 section titles (font-display)
│           ├── PillButton.tsx
│           └── AnimatedLink.tsx
├── wrangler.jsonc                 # Worker, assets, email, D1, cron, keep_vars
├── vite.config.ts
├── docs/plan.md                   # Roadmap and implementation status
└── AGENTS.md                      # Guidance for AI coding agents
```

## Architecture

```text
Browser → Cloudflare edge
  GET /  (navigate)   → static SPA assets (index.html)
  POST /api/contact   → worker → Email Sending → inbox
                              └→ D1 contact_submissions
  POST /api/collect   → worker → D1 page_views

Browser → Cloudflare Access (login) → /admin        → static SPA assets
                                    → /api/admin/*  → worker (re-verifies JWT) → D1
```

- SPA routing: `assets.not_found_handling: "single-page-application"`
- API-only Worker invocations: `run_worker_first: ["/api/*"]`
- The `/admin` bundle is a lazy chunk — the public site never downloads it

## Content and UI conventions

- **Copy** lives in [`src/data/content.ts`](src/data/content.ts) — avoid hardcoding strings in components.
- **Section titles** use [`SectionHeading`](src/components/ui/SectionHeading.tsx): an `h2` in `font-display` (matches hero `h1` family) plus optional subtitle.
- **Animations** use `motion` with `usePrefersReducedMotion`; global reduced-motion rules in `index.css`.
- **Accessibility** — skip link, form labels, ARIA tabs in Services, mobile nav, external link labels, `scroll-margin-top` for fixed header. See [`AGENTS.md`](AGENTS.md) for agent-facing a11y rules.

## Pending (post-v1)

- D1 database id + Cloudflare Access application (see [Admin dashboard](#admin-dashboard))
- Real showreel video embed
- Optional: multi-page routing, CMS, blog — see [`docs/plan.md`](docs/plan.md)

## Further reading

- [`AGENTS.md`](AGENTS.md) — decisions, conventions, and process for AI agents
- [`docs/plan.md`](docs/plan.md) — full plan, deploy checklist, future scope
