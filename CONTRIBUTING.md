# Contributing & Development Flow

## Branch strategy

```
main          ← production (Vercel auto-deploys from here)
  └── feature/issue-N-short-description   (features)
  └── fix/issue-N-short-description       (bug fixes)
  └── chore/issue-N-short-description     (tooling, deps, config)
```

**main is locked** — no direct pushes. All changes go through a PR.

## Starting any piece of work

1. Pick a GitHub Issue (or create one if it doesn't exist)
2. Create a branch from main:
   ```bash
   git checkout main && git pull
   git checkout -b feature/5-ats-ingest-adapters
   ```
3. Do the work in small commits
4. Open a PR that references the issue:
   ```bash
   gh pr create --title "feat: ATS ingest adapters" --body "Closes #5"
   ```
5. PR must pass: `pnpm typecheck` + `pnpm lint` + `pnpm build`
6. Merge via **Squash and merge** to keep main history clean
7. Delete the branch after merge

## Branch naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/issue-N-<slug>` | `feature/issue-5-ats-adapters` |
| Bug fix | `fix/issue-N-<slug>` | `fix/issue-12-greenhouse-parse-error` |
| Chore | `chore/issue-N-<slug>` | `chore/issue-11-agile-conventions` |

**The issue number is mandatory in all branch names** — it must be traceable back to a GitHub Issue without reading git log. Create an issue first if one doesn't exist.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(phase-1): add Greenhouse adapter
fix(auth): handle missing Supabase env vars in proxy
chore: update pnpm lockfile
```

Types: `feat` · `fix` · `chore` · `docs` · `refactor` · `test`

## GitHub Issues & Labels

Every PR should close at least one issue. Use `Closes #N` in the PR body.

**Type labels** — apply one:
- `feature` — new functionality
- `bug` — something broken
- `enhancement` — improvement to existing feature
- `chore` — maintenance

**Phase labels** — apply one:
- `phase-0` through `phase-5`

**Status labels:**
- `in-progress` — add when you start
- `blocked` — add if waiting on something external

## Local development

```bash
cp .env.example apps/web/.env.local   # fill in Supabase values
pnpm dev                               # starts Next.js at localhost:3000
```

## Before opening a PR

```bash
pnpm --filter web typecheck   # zero TS errors
pnpm --filter web lint        # zero lint errors
pnpm --filter web build       # build must succeed
```
