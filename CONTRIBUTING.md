# Contributing

## Prerequisites

- Node.js 20.10+
- pnpm 9.12+
- Docker (for the dev HA stack)

## First-time setup

```bash
git clone <repo-url>
cd <repo>
pnpm install
cp .env.example .env
```

Edit `.env` later when you have a HA token (after running `pnpm dev:ha` and going through the HA onboarding).

## Verifying Phase 0 is wired correctly

After install, these commands should all succeed:

```bash
pnpm typecheck    # All packages typecheck cleanly
pnpm lint         # ESLint passes
pnpm test         # Starter tests in packages/shared pass
pnpm build        # All packages build to dist/
pnpm format:check # Prettier formatting matches
```

To verify the dev runtime:

```bash
# Terminal 1 — HA dev container
pnpm dev:ha
# wait for HA to be reachable at http://localhost:8123, finish onboarding,
# create a long-lived token, paste into .env

# Terminal 2 — backend + frontend
pnpm dev

# Open http://localhost:5173 — the page should show:
#   HA connection: connected
# (Entity counts and other diagnostics will move to /api/status in P1a-9.)
```

If all of the above passes, Phase 0 is done.

## Working on a ticket

Tickets are tracked as GitHub issues with the ticket ID prefix from `docs/ROADMAP.md` (e.g., `P1a-3`).

Branch naming: `<ticket-id>-<slug>`, e.g., `p1a-3-detection-priority-chain`.

Commit style: conventional-commits-ish but pragmatic. `feat(analyzer): implement priority chain` is fine.

PR template: includes a checklist matching the ticket's acceptance criteria.

## Definition of done per ticket

- [ ] Code merged to `main`
- [ ] Tests passing (unit + relevant integration)
- [ ] Documented in code comments where non-obvious
- [ ] Type-safe (no `any` without justification)
- [ ] Manual smoke test on dev HA stack
- [ ] CHANGELOG.md updated for user-facing changes

## Project documents

Before contributing significant changes, skim:

- [`docs/PRD.md`](./docs/PRD.md) — product scope and target users
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — component structure
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — what's planned and when
