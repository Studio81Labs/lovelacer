# Contributing to Lovelacer

Human-facing contribution guide. For agent-specific instructions see [AGENTS.md](./AGENTS.md). For product scope see [docs/PRD.md](./docs/PRD.md) and [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Prerequisites

- Node.js 20.10+
- pnpm 9.12+
- Docker (for the dev Home Assistant stack)

## First-time setup

```bash
git clone git@github.com:Studio81Labs/lovelacer.git
cd lovelacer
pnpm install
cp .env.example .env
```

Edit `.env` once you have a long-lived HA token (after running `pnpm dev:ha` and finishing HA onboarding).

## Verifying the workspace

After install, these should succeed:

```bash
pnpm typecheck    # All packages typecheck cleanly
pnpm lint         # ESLint passes
pnpm test         # Vitest across packages
pnpm build        # All packages build to dist/
pnpm format:check # Prettier formatting matches
```

To run the dev runtime:

```bash
# Terminal 1 — HA dev container
pnpm dev:ha
# wait for HA to be reachable at http://localhost:8123, finish onboarding,
# create a long-lived token, paste into .env

# Terminal 2 — server + web
pnpm dev

# Open http://localhost:5173 — the page should show HA connection: connected.
```

## Picking work

- Work is tracked in **GitHub Issues**. Pick an issue with clear acceptance criteria.
- If nothing fits, open a new issue before starting work.
- Ticket IDs from `docs/ROADMAP.md` (e.g. `P1a-3`) may appear in branch names and commits — keep them for traceability.

## Branching

- Branch from `main`.
- Naming: `<type>/<short-slug>` (e.g. `feat/dashboard-rooms-grouping`) or `<ticket-id>-<slug>` (e.g. `p1a-3-detection-priority-chain`). Either is fine.

## Commit messages and PR titles

Conventional commits. One logical change per commit.

```
<type>(<scope>): <short description>
```

- **Types:** `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`, `perf`, `ci`, `build`, `revert`
- **Scopes:** `addon`, `server`, `web`, `shared`, `analyzer`, `generator`, `ha-client`, `ci`, `infra`, `docs`, `deps`, `cross`
- Scope is required on local commit messages and PR titles. `commitlint` enforces this via the husky `commit-msg` hook, and `lint-pr.yml` enforces it again on PR titles.
- Use `cross` for genuinely cross-cutting changes instead of omitting the scope.
- Subject must start **lowercase** (enforced by `lint-pr.yml`).

Examples:

- `feat(server): add /api/status endpoint`
- `fix(web): persist live room drag order`
- `refactor(analyzer): extract priority-chain detection`
- `chore(cross): align repo standards with org template`

## Before opening a PR

Run these locally and make sure they pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`lint-staged` runs on every commit via the husky `pre-commit` hook, so most formatting / lint issues are caught up front. If anything skipped, run `pnpm lint:fix && pnpm format`.

## Pull request flow

1. Push your branch and open a PR against `main`.
2. PR title must follow conventional commits with a required scope. Example: `feat(server): add dashboard generation endpoint`.
3. Link the GitHub issue your PR resolves.
4. Make sure the PR has the right scope label(s). `actions/labeler` applies common path-based labels automatically; add any missing labels manually.
5. Use the PR template fully: summarize the change, note the regression surface, record verification, and call out contract / schema / docs impact.
6. Request human review. Address comments with follow-up commits — don't force-push to shared branches mid-review.
7. Merge via **Squash and merge**. The squash commit message should be the final conventional-commit message.

## Definition of done

- [ ] Code merged to `main`
- [ ] Tests passing (unit + relevant integration)
- [ ] Type-safe (no `any` without justification)
- [ ] Manual smoke test on dev HA stack for runtime changes
- [ ] CHANGELOG.md (or `apps/addon/CHANGELOG.md` for add-on changes) updated for user-facing changes
- [ ] Docs updated when behavior, configuration, or contracts changed

## Secrets and security

**Never commit:**

- Real `.env` files (only `.env.example` goes in git)
- HA long-lived tokens, AI provider API keys, database credentials
- Anything under `dev/ha-config/` (the HA container's full `/config`, includes secrets and SQLite history)
- Any file matching the rough pattern `*-token*`, `*-secret*`, `*.pem`, `*.key`

**Rules of thumb:**

- If it looks like a credential, it probably is. Reach for an env var.
- Request production / shared secrets via the team — don't copy them to your laptop.
- If you accidentally commit a secret, rotate it immediately — even after reverting, assume it's public.

## Documentation

- Product scope → update [docs/PRD.md](./docs/PRD.md).
- Architecture → update [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
- Roadmap and tickets → [docs/ROADMAP.md](./docs/ROADMAP.md).
- Release process → [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md).
- Add-on install / usage → [docs/ADDON_INSTALL.md](./docs/ADDON_INSTALL.md).
- Anything you had to figure out from scratch is a documentation gap — file an issue or PR the fix.

## Getting help

- Open a GitHub issue with the `question` label.
