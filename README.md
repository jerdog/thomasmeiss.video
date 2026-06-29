# Thomas Meiss Video

Single-page portfolio for **Thomas Meiss Video** — a freelance video producer specializing in documentary, weddings, commercial short-form, and aerial work.

**Live domain:** [thomasmeiss.video](https://thomasmeiss.video)

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, [Motion](https://motion.dev/) |
| Build | Vite 7 + [@cloudflare/vite-plugin](https://developers.cloudflare.com/workers/vite-plugin/) |
| Hosting | Cloudflare Workers (static assets + SPA routing) |
| API | Worker at `POST /api/contact` |
| Email | Cloudflare Email Service (`send_email` binding) |
| Analytics | Cloudflare Web Analytics (enable at deploy) |

The site uses a **Noir Editorial** design direction: near-black ground, bone-white type, ember accent, Bodoni Moda + Manrope.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (22+ recommended)
- npm
- A [Cloudflare account](https://dash.cloudflare.com/) (for deploy)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (included as a dev dependency)

## Local development

```bash
# Install dependencies
npm install

# Start dev server (Workers runtime via Vite plugin)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Other scripts:

```bash
npm run build    # Typecheck + production build
npm run preview  # Preview production build locally
npm run types    # Regenerate Worker Env types from wrangler.jsonc
```

### Contact form in dev

The contact form posts to `/api/contact`, handled by the Worker in [`worker/index.ts`](worker/index.ts). In local dev, email sending is simulated unless you configure a live send binding.

To send real emails during development:

1. Run `npx wrangler login`
2. Add `"remote": true` to the `send_email` binding in [`wrangler.jsonc`](wrangler.jsonc)
3. Complete the email setup steps below

## Deploy to Cloudflare

### 1. Configure email (required for contact form)

Replace placeholder addresses in [`wrangler.jsonc`](wrangler.jsonc):

- `CONTACT_TO@example.com` → your verified personal inbox
- Update `allowed_destination_addresses` to match

Then run:

```bash
# Verify destination inbox (check email for confirmation link)
npx wrangler email routing addresses create you@example.com

# Enable routing + sending for the domain
npx wrangler email routing enable thomasmeiss.video
npx wrangler email sending enable thomasmeiss.video
```

Contact submissions are sent **from** `hello@thomasmeiss.video` **to** your verified `CONTACT_TO` address, with the submitter's email set as `replyTo`.

### 2. Authenticate and deploy

```bash
npx wrangler login
npm run deploy
```

This runs `tsc`, `vite build`, and `wrangler deploy` — uploading the SPA assets and Worker in one step.

### 3. Custom domain

In the Cloudflare dashboard, attach **thomasmeiss.video** (and optionally `www`) to the `thomasmeiss-video` Worker.

### 4. Web Analytics

After the domain is proxied through Cloudflare:

1. Go to **Analytics & logs → Web Analytics**
2. **Add a site** → select `thomasmeiss.video`

See [`docs/plan.md`](docs/plan.md) for beacon-snippet fallback if dashboard auto-injection is unavailable.

## Project structure

```
├── worker/index.ts       # Contact API (/api/contact)
├── src/
│   ├── components/       # Page sections + UI primitives
│   ├── data/content.ts   # Site copy, links, pricing
│   └── index.css         # Design tokens + utilities
├── wrangler.jsonc        # Worker + assets + email config
├── vite.config.ts
└── docs/plan.md          # Full project plan and roadmap
```

## Environment variables

Configured in [`wrangler.jsonc`](wrangler.jsonc) under `vars`:

| Variable | Purpose |
|----------|---------|
| `CONTACT_FROM` | Sender address for form notifications |
| `CONTACT_FROM_NAME` | Display name on outbound email |
| `CONTACT_TO` | Verified inbox that receives submissions |

Do not commit personal email addresses to a public repo if you prefer — use `wrangler secret` or environment-specific Wrangler configs instead.

## Further reading

- [docs/plan.md](docs/plan.md) — implementation status, design system, deploy checklist, future scope (CMS, multi-page routing, blog)
