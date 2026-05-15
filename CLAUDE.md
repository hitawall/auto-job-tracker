# Auto Job Tracker — Claude Code Context

Multi-tenant job tracking SaaS. Users get early visibility of new postings, curated alerts, and ATS-optimised resume variants. Runs entirely on free-tier infrastructure.

## Stack

| Layer | Choice |
|---|---|
| Frontend / API | Next.js 16 App Router (TypeScript, RSC, Server Actions) |
| UI | Tailwind v4 + shadcn/ui — Material Design 3 pastel theme |
| Auth / DB / Storage | Supabase (Postgres + RLS + Auth + Vault) |
| Hosting | Vercel (Root Dir: `apps/web`) |
| Scraping worker | Python 3.12 + Playwright (GitHub Actions cron) |
| Email | Resend |
| Alerts | Twilio WhatsApp sandbox + Telegram Bot API |
| LLM (resume) | BYOK — user's own Anthropic / OpenAI key, stored in Supabase Vault |

## Monorepo layout

```
apps/web/          Next.js app (the only deployed app)
packages/types/    Zod schemas + TS types shared across web + worker
packages/ingest/   ATS feed adapters (Greenhouse, Lever, Ashby…)
packages/match/    Pure scoring fn: (job, prefs) → {score, reasons}
packages/resume/   Parse + prompt + ATS-check helpers
worker/            Python Playwright scraper (runs on GitHub Actions)
supabase/migrations/
```

## Commands

```bash
pnpm dev                        # start Next.js at localhost:3000
pnpm --filter web build         # production build check
pnpm --filter web typecheck     # tsc --noEmit
pnpm --filter web lint          # eslint
```

## Database

All tables have RLS. Per-user rows use `auth.uid() = user_id`. The `jobs` table is shared (read-only to users, write via service role only).

Migrations live in `supabase/migrations/` and must be run manually in the Supabase SQL editor in order.

## Git flow

```
main  ← protected, production, Vercel auto-deploys
  └── feature/issue-N-<slug>
  └── fix/issue-N-<slug>
  └── chore/issue-N-<slug>
```

- One issue per branch. **Issue number is mandatory in all branch names** — create an issue first.
- PR body must contain `Closes #N`.
- Squash and merge only.
- `pnpm typecheck + lint + build` must pass before merging.
- Never push directly to main.

## Code rules

- **No comments** unless the WHY is non-obvious (hidden constraint, workaround, subtle invariant).
- **No docstrings** or multi-line comment blocks.
- **No unsolicited refactoring** — fix what was asked, nothing else.
- **No new abstractions** unless the task explicitly requires them.
- **No error handling** for impossible scenarios — trust framework guarantees.
- Validate only at system boundaries (user input, external APIs).
- Prefer editing existing files over creating new ones.
- Never create markdown files unless explicitly asked.

## Design system

See `docs/design-system.md` for the full UI spec.

Summary: **Material Design 3 + pastel palette + happy vibe.**
Component library: shadcn/ui. Always check `components/ui/` before building new components. Token definitions live in `apps/web/app/globals.css`.

## Phases

| Phase | Status | Scope |
|---|---|---|
| 0 | ✅ Done | Auth, dashboard shell, Vercel deploy |
| 1 | 🔄 Next | ATS feed ingestion, jobs table, /jobs page |
| 2 | — | Preferences + email alerts |
| 3 | — | Resume upload + BYOK LLM optimisation |
| 4 | — | Watchlist scraping (LinkedIn opt-in + company portals) |
| 5 | — | WhatsApp / Telegram alerts + kanban tracker |

## Key decisions (locked)

- Job sources: ATS feeds (broad) + LinkedIn/portal scraping scoped to user's company watchlist (opt-in only)
- Resume LLM: BYOK — user provides their own key, zero platform cost
- Playwright scraping runs on GitHub Actions (free 2000 min/month), NOT on Vercel
- LinkedIn scraping is opt-in with explicit consent — ToS risk owned by user
- WhatsApp via Twilio sandbox for MVP; Telegram bot is the cost-free alternative
