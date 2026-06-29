# Thomas Meiss Video

Single-page portfolio for **Thomas Meiss Video** — a freelance video producer specializing in documentary, weddings, commercial short-form, and aerial work.

**Live domain:** [thomasmeiss.video](https://thomasmeiss.video)

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, [Motion](https://motion.dev/) |
| Build | Vite 7 + [@cloudflare/vite-plugin](https://developers.cloudflare.com/workers/vite-plugin/) |
| Hosting | **Cloudflare Workers** (static assets + SPA routing — not Pages) |
| API | Worker at `POST /api/contact` |
| Email | Cloudflare Email Service (`send_email` binding) |
| Analytics | Cloudflare Web Analytics (enable in dashboard after deploy) |

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
| `npm run deploy` | Build + `wrangler deploy` |
| `npm run preview` | Preview production build locally |
| `npm run types` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |

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

```bash
npx wrangler login
npm run deploy
```

### 4. Custom domain

Attach **thomasmeiss.video** (and optionally `www`) to the `thomasmeiss-video` Worker in the Cloudflare dashboard.

### 5. Web Analytics

After the domain is proxied through Cloudflare:

1. **Analytics & logs → Web Analytics → Add a site** → `thomasmeiss.video`

See [`docs/plan.md`](docs/plan.md) for beacon-snippet fallback.

## Project structure

```
thomasmeiss.video/
├── worker/index.ts              # POST /api/contact + Email Sending
├── src/
│   ├── App.tsx                    # Section composition + skip link
│   ├── index.css                  # Design tokens, a11y, motion utilities
│   ├── data/content.ts            # All copy, links, pricing (single source)
│   ├── hooks/usePrefersReducedMotion.ts
│   └── components/
│       ├── Nav.tsx                # Sticky nav + mobile menu
│       ├── Hero.tsx … Footer.tsx  # 11 page sections
│       └── ui/
│           ├── SectionHeading.tsx # h2 section titles (font-display)
│           ├── PillButton.tsx
│           └── AnimatedLink.tsx
├── wrangler.jsonc                 # Worker, assets, email, keep_vars
├── vite.config.ts
├── docs/plan.md                   # Roadmap and implementation status
└── AGENTS.md                      # Guidance for AI coding agents
```

## Architecture

```text
Browser → Cloudflare edge
  GET / (navigate)  → static SPA assets (index.html)
  POST /api/contact → worker/index.ts → Email Sending → inbox
```

- SPA routing: `assets.not_found_handling: "single-page-application"`
- API-only Worker invocations: `run_worker_first: ["/api/*"]`

## Content and UI conventions

- **Copy** lives in [`src/data/content.ts`](src/data/content.ts) — avoid hardcoding strings in components.
- **Section titles** use [`SectionHeading`](src/components/ui/SectionHeading.tsx): an `h2` in `font-display` (matches hero `h1` family) plus optional subtitle.
- **Animations** use `motion` with `usePrefersReducedMotion`; global reduced-motion rules in `index.css`.
- **Accessibility** — skip link, form labels, ARIA tabs in Services, mobile nav, external link labels, `scroll-margin-top` for fixed header. See [`AGENTS.md`](AGENTS.md) for agent-facing a11y rules.

## Pending (post-v1)

- Cloudflare Web Analytics (dashboard setup)
- Real showreel video embed
- Optional: multi-page routing, CMS, blog — see [`docs/plan.md`](docs/plan.md)

## Further reading

- [`AGENTS.md`](AGENTS.md) — decisions, conventions, and process for AI agents
- [`docs/plan.md`](docs/plan.md) — full plan, deploy checklist, future scope
