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
| Analytics | **Cloudflare Web Analytics** | Dashboard setup post-deploy; no third-party cookie banner |
| Env vars | **`keep_vars: true`** + dashboard Variables | Production secrets/vars managed in Workers dashboard; local via `.dev.vars` |
| Scaffold | **Manual** (not create-cloudflare) | Folder name `thomasmeiss.video` breaks C3 project naming |
| Content | **`src/data/content.ts`** | Single source for copy, links, pricing — not inline in components |
| Section titles | **`SectionHeading` → `h2` + `font-display`** | Matches hero `h1` typography; subtitle optional as muted `p` |
| Motion | **`motion` + `usePrefersReducedMotion`** | Respect `prefers-reduced-motion` globally in CSS too |

## Repository layout

```
worker/index.ts          Contact API only
src/App.tsx              Composes sections in order; skip link to #main
src/data/content.ts      All site copy and structured data
src/index.css            @theme tokens, textures, reduced-motion, scroll-margin
src/components/          One file per section + ui/ primitives
wrangler.jsonc             Worker name: thomasmeiss-video
docs/plan.md               Human-readable roadmap and status
```

### Page sections (order in App.tsx)

1. Nav — sticky, mobile hamburger menu
2. Hero — sole `h1`
3. TrustMarquee — decorative, `aria-hidden`
4. Showreel — placeholder (no fake play button)
5. WorkGrid — 6-col bento, external project links
6. Services — ARIA tablist + tabpanel
7. Channels
8. About
9. Pricing
10. ContactForm — POST `/api/contact`
11. Footer

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

- New projects, pricing tiers, nav links → `content.ts`
- New section → component in `src/components/`, import in `App.tsx`, add nav link if needed

### Adding Worker routes

- Extend `worker/index.ts`; add path to `run_worker_first` if not under `/api/*`
- Regenerate types after wrangler.jsonc changes

## Out of scope (unless requested)

- Multi-page routing / React Router
- CMS / headless backend
- Real showreel embed (placeholder until media provided)
- Cloudflare Turnstile (honeypot only for now)
- Netlify, Auth0, database (D1/Prisma)

## Future scope (see docs/plan.md)

- Blog (markdown in repo or CMS + routing)
- CMS for non-dev content edits
- Multi-page routes for project detail pages
- Custom conversion analytics (Workers Analytics Engine)

## Reference

- [`README.md`](README.md) — setup, deploy, env vars
- [`docs/plan.md`](docs/plan.md) — detailed plan and todo status
