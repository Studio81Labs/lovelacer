# Repository Agent Instructions

These instructions are for agents working in the Lovelacer repository. Use them together with the product docs in `docs/`, the contributor guide in `CONTRIBUTING.md`, and the release / process docs under `docs/`.

## Working style

- Act as an autonomous senior engineer.
- Do not ask follow-up questions unless you are truly blocked by missing credentials, missing repository access, or conflicting product requirements.
- Make reasonable assumptions, continue, and call out important assumptions in your final summary.
- Complete work end-to-end: analysis, implementation, validation, final diff review, and any PR or issue updates that available tooling supports.

## Scope discipline

- Solve the issue fully, but do not perform unrelated refactors.
- Preserve the existing architecture and conventions unless the issue explicitly requires a change.
- Prefer minimal, safe changes with clear reasoning.
- Keep issues and PRs focused on a single deliverable.

## Codebase conventions

- Follow existing naming, file structure, typing, validation, and error-handling patterns.
- Reuse existing helpers and shared contracts before adding new abstractions.
- Do not introduce broad `try/catch` blocks, silent fallbacks, or behavior that hides failures.
- Keep server contracts, shared types, and web consumers aligned when contracts change.
- When schema or API behavior changes, include the required migration, docs, and follow-up contract updates in the same change.

## Validation

Before considering work complete:

- run relevant unit, integration, or e2e tests for the touched area
- run lint, typecheck, and build commands that meaningfully cover the change when available
- inspect the final diff for regressions, dead code, debug leftovers, accidental formatting churn, and missing tests
- verify the issue acceptance criteria and definition of done are satisfied
- say clearly what you did not validate, if anything could not be run

## Git, issue, and PR workflow

- GitHub Issues are the source of truth for active work. Start from an issue with clear acceptance criteria whenever possible.
- Branch from `main`.
- Use conventional commits and PR titles in the form `<type>(<scope>): <short description>`.
- Scope is required. Valid scopes: `addon`, `server`, `web`, `shared`, `analyzer`, `generator`, `ha-client`, `ci`, `infra`, `docs`, `deps`, `cross`.
- Use `cross` for genuinely cross-cutting work instead of omitting the scope.
- Keep PRs focused, linked to the issue, and aligned with the issue scope.

## Pull request rules

When creating or updating a PR:

- use a concise title aligned with the issue and repo commit conventions
- include a short summary, implementation notes, risks or regression surface, and test evidence
- call out contract, schema, migration, or docs impact explicitly
- link the issue
- make sure the PR carries the right scope labels when automation or repo tooling supports it

## Review handling

If review comments arrive:

- address all actionable comments
- do not argue with style guidance unless it conflicts with correctness, safety, or repo conventions
- rerun relevant checks after changes
- update the PR description if behavior, scope, or risk changed

## Merge readiness

A branch is merge-ready only when:

- required CI checks pass
- no unresolved review comments remain
- the branch is up to date with the base branch or rebased as required by repo policy
- there are no merge conflicts

## Issue handling

When tooling or repository automation supports it:

- when work starts, move or update the issue status
- when a PR is opened, comment with the PR link and a short progress note
- when the PR is merged, update the issue status, post a concise delivery note, and close the issue if that matches the repo workflow

## Project

Lovelacer is a Home Assistant dashboard generator: it inspects a user's HA instance, analyses entities and areas, and produces a Lovelace dashboard configuration. It ships as a Home Assistant add-on (Docker image) and as a standalone dev runtime. The repo is a pnpm workspace monorepo with TypeScript packages for analysis, generation, an HA client, a Fastify server, and a Vue web UI.

## Repository layout

- `apps/addon/` - Home Assistant add-on packaging (Dockerfile, `config.yaml`, `build.yaml`, run script)
- `packages/server/` - Fastify server exposing the generator API (`@lovelacer/server`)
- `packages/web/` - Vue + Vite web UI served by the server (`@lovelacer/web`)
- `packages/analyzer/` - Entity / area analysis pipeline (`@lovelacer/analyzer`)
- `packages/generator/` - Dashboard YAML generator (`@lovelacer/generator`)
- `packages/ha-client/` - Home Assistant WebSocket / REST client (`@lovelacer/ha-client`)
- `packages/shared/` - Shared types, constants, fixtures (`@lovelacer/shared`)
- `dev/` - Local HA dev stack (`ha-stack.yml`), fixtures, helper scripts
- `tests/` - Cross-package integration tests
- `docs/` - PRD, architecture, roadmap, release checklist, AI features, brand

## Tech stack

- Runtime: Node 20.10+, pnpm workspaces (`pnpm@9.12+`)
- Server: Fastify, TypeScript strict mode, better-sqlite3
- Web: Vue 3, Vite, TypeScript
- HA integration: WebSocket + REST via custom client
- Packaging: Home Assistant add-on (Docker, S6 overlay, AppArmor)
- Testing: Vitest

## Common commands

```bash
pnpm install              # Install all workspace deps
pnpm dev:ha               # Start Home Assistant dev container (docker compose)
pnpm dev:ha:down          # Stop HA dev container
pnpm dev:ha:logs          # Tail HA logs
pnpm dev                  # Build deps, then run server + web in watch mode
pnpm build                # Build all packages
pnpm test                 # Run all package tests + root vitest
pnpm lint                 # ESLint across the workspace
pnpm typecheck            # Recursive typecheck + tools tsconfig
pnpm format               # Prettier write
pnpm format:check         # Prettier check
pnpm fixtures:load        # Load HA fixture into the dev container
```

## Repository-specific conventions

- Package names use the `@lovelacer/` scope.
- Call the server package `server`, not `api` or `backend`.
- TypeScript strict mode is expected everywhere.
- Shared types, fixtures, and constants belong in `packages/shared`.
- Home Assistant access goes through `@lovelacer/ha-client` — no ad-hoc REST or WebSocket calls in other packages.
- Dashboard generation lives in `@lovelacer/generator`; classification / detection lives in `@lovelacer/analyzer`. Keep generation deterministic and easy to diff.
- The HA dev container persists state under `dev/ha-config/` — this directory is gitignored and contains secrets, never commit anything from it.
- The add-on under `apps/addon/` uses Home Assistant's `SUPERVISOR_TOKEN` at runtime; standalone dev uses `HA_URL` + `HA_TOKEN` from `.env`. Keep both paths working.
- AI features are optional and off by default. Anything that calls a model must respect `AI_ENABLED`, the confidence threshold, and the per-run cost / call caps already wired through config.

## Review guidance

- During code review, do not limit findings to only obvious critical bugs. Surface medium-risk regressions when the user impact or cleanup cost is real.
- Treat these as review-worthy findings, not optional nits:
  - missing or weak tests for behavior changes, edge cases, null or error paths, or regression-prone logic
  - contract drift between server responses, shared types, and web consumers
  - missing migrations, docs, or follow-up contract updates when schema or API behavior changes
  - changes that break the add-on packaging (Dockerfile, `config.yaml`, `build.yaml`, `run.sh`) or the supervisor / standalone parity
  - changes that touch HA entity classification or dashboard generation without regression fixtures
  - AI-call paths that ignore the `AI_*` config caps, leak provider keys, or run unbounded loops
  - performance risks such as N+1 HA calls, unbounded entity scans, or expensive work in request handlers
  - error-handling, observability, auth, privacy, and secret-handling gaps that would make incidents or data leaks more likely
- Prefer high-signal findings with a concrete failure mode, regression path, or operational risk.
- Skip pure formatting or style comments unless they hide a real defect.
