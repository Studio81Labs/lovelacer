# P1a-11 Add-on Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Lovelacer as a HA Add-on installable via custom repository URL. Users add `https://github.com/Studio81Labs/lovelacer` to HA's add-on store, install Lovelacer, and run the full Analyze → Apply flow on their real HA instance.

**Architecture:** A single `apps/addon/` directory holds the add-on definition (Dockerfile, build.yaml, config.yaml, run.sh, apparmor.txt, branding, docs). Multi-arch builds (aarch64, amd64, armv7) use `home-assistant/builder@2024.08.2` driven by two GitHub workflows: `build-addon.yml` (PR + main) and `release.yml` (tag → orchestrates build + GitHub Release). One backend change: `DASHBOARD_URL_PATH` env var is plumbed through `runApply` so the add-on's `dashboard_url_path` option overrides `applyDashboard`'s default.

**Tech Stack:** Bash (run.sh), Dockerfile (Alpine 3.21 + Node 22 LTS), HA add-on YAML schema, GitHub Actions, `home-assistant/builder` action, TypeScript (backend changes), zod (config schema), `pngjs` (placeholder asset generator). No new runtime deps.

**Spec reference:** [`docs/superpowers/specs/2026-05-01-p1a-11-addon-packaging-design.md`](../specs/2026-05-01-p1a-11-addon-packaging-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions even when importing TS source.
- Type-only imports use `import type { … } from '…'` (verbatimModuleSyntax).
- Tests use `import { describe, it, expect, vi } from 'vitest'`.
- All commands run from worktree: `pnpm --dir <worktree>` and `git -C <worktree>`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- If husky's lint-staged or `pnpm format:check` reports drift, run `pnpm --dir <worktree> format`, re-stage, and retry.
- When the HA builder action is invoked, it uses `--root .` so the Docker build context is the repo root and the Dockerfile (at `apps/addon/Dockerfile`) can `COPY` workspace files via repo-relative paths.

---

## Task 1: Backend `DASHBOARD_URL_PATH` plumbing + 2 new tests

**Files:**

- Modify: `packages/server/src/config.ts`
- Modify: `packages/server/src/pipeline.ts`
- Modify: `packages/server/src/routes/apply.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/main.ts`
- Modify: `packages/server/src/__tests__/pipeline.test.ts`

Threads a new env var (`DASHBOARD_URL_PATH`, default `'lovelacer-home'`) through the existing config → pipeline → route chain. The user's request body still wins per the existing hybrid-mode pattern.

- [ ] **Step 1: Write the new pipeline tests**

Read `packages/server/src/__tests__/pipeline.test.ts` first (around the existing `runApply` test block). Append two new tests inside the existing `describe('runApply', () => {...})` block:

```ts
it('forwards defaultOptions to applyDashboard when body has no options', async () => {
  const fake = makeFakeHa()
  const config: LovelaceConfig = {
    title: 'x',
    views: [
      {
        type: 'sections',
        title: 'Home',
        path: 'home',
        icon: 'mdi:home-variant',
        sections: [],
      },
    ],
  }
  fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'foo', created: true })

  await runApply(fake.client, { config }, { urlPath: 'foo' })

  expect(fake.applyDashboard).toHaveBeenCalledWith(config, { urlPath: 'foo' })
})

it('body.options overrides defaultOptions', async () => {
  const fake = makeFakeHa()
  const config: LovelaceConfig = {
    title: 'x',
    views: [
      {
        type: 'sections',
        title: 'Home',
        path: 'home',
        icon: 'mdi:home-variant',
        sections: [],
      },
    ],
  }
  fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'bar', created: true })

  await runApply(fake.client, { config, options: { urlPath: 'bar' } }, { urlPath: 'foo' })

  expect(fake.applyDashboard).toHaveBeenCalledWith(config, { urlPath: 'bar' })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/server/src/__tests__/pipeline.test.ts -t 'runApply'
```

Expected: FAIL — both new tests will fail because `runApply` currently takes only `(ha, body)` (2 args) and won't accept the third argument.

- [ ] **Step 3: Update `pipeline.ts` to accept defaults**

Read `packages/server/src/pipeline.ts` first. Find the `runApply` function and replace its signature + body:

```ts
export async function runApply(
  ha: HaClient,
  body: ApplyInput,
  defaultOptions: ApplyDashboardOptions = {},
): Promise<ApplyDashboardResult> {
  const options = { ...defaultOptions, ...body.options } // body wins
  if (body.config !== undefined) {
    if (typeof body.config.title !== 'string' || !Array.isArray(body.config.views)) {
      throw new InvalidConfigError('invalid_config: title must be string and views must be array')
    }
    return ha.applyDashboard(body.config, options)
  }

  const preview = await runPreview(ha)
  return ha.applyDashboard(preview.config, options)
}
```

The previous code passed `body.options` directly to `applyDashboard`. Now it merges `defaultOptions` with `body.options`, body keys winning.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/server/src/__tests__/pipeline.test.ts
```

Expected: PASS — all pipeline tests including the 2 new ones (~13 tests total).

- [ ] **Step 5: Add `DASHBOARD_URL_PATH` to config schema**

Read `packages/server/src/config.ts` first. Find the `ConfigSchema` and add the new field. The complete schema becomes:

```ts
const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  DATA_DIR: z.string().default('./data'),

  // HA connection — Add-on context uses SUPERVISOR_TOKEN against the in-network
  // `homeassistant` hostname (which home-assistant-js-websocket can reach via
  // its standard `/api/websocket` path). Standalone uses HA_TOKEN against
  // whatever HA_URL the user sets.
  HA_URL: z.string().url().default('http://homeassistant:8123'),
  HA_TOKEN: z.string().optional(),
  SUPERVISOR_TOKEN: z.string().optional(),

  // Add-on option exposed through HA's config UI. Lets the user customize
  // the generated dashboard's url_path without rebuilding the image.
  DASHBOARD_URL_PATH: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, {
      message: 'must be a valid HA URL path slug (lowercase alphanumeric + hyphen)',
    })
    .default('lovelacer-home'),
})
```

Then update the exported `config` object to surface it:

```ts
export const config = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  dataDir: parsed.DATA_DIR,
  ha: {
    url: parsed.HA_URL,
    token: haToken,
  },
  dashboardUrlPath: parsed.DASHBOARD_URL_PATH,
} as const
```

- [ ] **Step 6: Wire the config through `apply.ts` route**

Read `packages/server/src/routes/apply.ts` first. Replace the file with:

```ts
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import { HaApplyError } from '@lovelacer/ha-client'
import { InvalidConfigError, runApply, type ApplyInput } from '../pipeline.js'

export interface ApplyRouteOptions {
  ha: HaClient
  /** Default url_path for the generated dashboard. Body.options.urlPath wins when present. */
  dashboardUrlPath: string
}

/**
 * POST /api/apply — pushes a Lovelace dashboard to HA via storage-mode WS.
 *
 * Hybrid mode: accepts an optional `config` body. If present, that config
 * is pushed directly. If absent, the server re-runs preview internally
 * and pushes its config. The route's `dashboardUrlPath` option provides
 * a server-config default that the request body can override.
 *
 * Errors:
 * - 400 invalid_config: body.config provided but malformed (non-string
 *   title or non-array views)
 * - 502 ha_apply_failed: HaApplyError thrown by applyDashboard
 *   (response includes `step: 'list' | 'create' | 'save'`)
 * - 503 ha_unavailable: HaClient not connected
 * - 500: anything else
 */
export const applyRoute: FastifyPluginAsync<ApplyRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post<{ Body: ApplyInput }>('/api/apply', async (req, reply) => {
    if (!opts.ha.isConnected()) {
      return reply
        .code(503)
        .send({ error: 'ha_unavailable', message: 'Home Assistant connection not ready' })
    }
    try {
      const body = (req.body ?? {}) as ApplyInput
      const result = await runApply(opts.ha, body, { urlPath: opts.dashboardUrlPath })
      return reply.code(200).send({ ok: true, ...result })
    } catch (err) {
      if (err instanceof HaApplyError) {
        req.log.error({ err, step: err.step }, 'ha apply failed')
        return reply.code(502).send({
          error: 'ha_apply_failed',
          step: err.step,
          message: err.message,
        })
      }
      if (err instanceof InvalidConfigError) {
        return reply.code(400).send({
          error: 'invalid_config',
          message: err.message,
        })
      }
      req.log.error({ err }, 'apply failed')
      return reply.code(500).send({ error: 'apply_failed', message: String(err) })
    }
  })
}
```

- [ ] **Step 7: Wire the config through `app.ts`**

Read `packages/server/src/app.ts` first. Find `CreateAppOptions` and the `applyRoute` registration. Update the interface to add `dashboardUrlPath`:

```ts
export interface CreateAppOptions {
  ha: HaClient
  isDev?: boolean
  logLevel?: string
  /** Pre-built pino logger (see existing comment). */
  logger?: Logger
  /** Default url_path for the generated dashboard. Forwarded to the apply route. */
  dashboardUrlPath: string
}
```

Update the `applyRoute` registration line:

```ts
await app.register(applyRoute, { ha: opts.ha, dashboardUrlPath: opts.dashboardUrlPath })
```

- [ ] **Step 8: Wire the config through `main.ts`**

Read `packages/server/src/main.ts` first. Find the `createApp` call and add the new option:

```ts
const app = await createApp({
  ha,
  isDev,
  logLevel: config.logLevel,
  logger,
  dashboardUrlPath: config.dashboardUrlPath,
})
```

- [ ] **Step 9: Run the full verification suite**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
pnpm --dir <worktree> format:check
pnpm --dir <worktree> lint
```

All four green. Note: the existing `apply.test.ts` route tests instantiate `createApp` — those need a `dashboardUrlPath: 'lovelacer-home'` (or any valid value) added to their `createApp({...})` calls. Also run:

```bash
pnpm --dir <worktree> vitest run packages/server/src/__tests__/routes/
```

If the route tests fail with "missing dashboardUrlPath", patch each call site to add it (the existing fixture-helper `createApp({ ha, logLevel: 'silent' })` calls — there are 3 across analyze.test.ts, preview.test.ts, apply.test.ts).

- [ ] **Step 10: Commit**

```bash
git -C <worktree> add packages/server/src/config.ts \
        packages/server/src/pipeline.ts \
        packages/server/src/routes/apply.ts \
        packages/server/src/app.ts \
        packages/server/src/main.ts \
        packages/server/src/__tests__/pipeline.test.ts \
        packages/server/src/__tests__/routes/
git -C <worktree> commit -m "$(cat <<'EOF'
feat(server): plumb DASHBOARD_URL_PATH env var through runApply

Adds a new optional env var (default 'lovelacer-home') that the
add-on's `dashboard_url_path` option will populate at runtime. The
chain: config.ts (zod schema) → main.ts (createApp) → app.ts
(forwards to applyRoute) → routes/apply.ts (passes as defaultOptions
to runApply) → pipeline.ts (merges with body.options, body wins).

Existing hybrid mode preserved: a request body with options.urlPath
still wins over the server config, so P1b custom-frontend consumers
can target a different url_path without restarting the add-on.

Two new pipeline tests pin both directions: defaultOptions is used
when body has no options, and body.options overrides defaultOptions
when both are present. Existing route tests updated to include the
new dashboardUrlPath createApp option.

P1a-11 layer 1 of 6 (backend plumbing). Add-on infrastructure next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Dockerfile + run.sh + apparmor.txt + .dockerignore

**Files:**

- Create: `apps/addon/Dockerfile`
- Create: `apps/addon/run.sh`
- Create: `apps/addon/apparmor.txt`
- Create: `.dockerignore`

The runtime image. Single-stage multi-arch build. The Dockerfile expects to be built with `--root .` (repo root as build context) so it can `COPY` workspace files. Manual smoke verifies an amd64 build runs.

- [ ] **Step 1: Create `.dockerignore` at repo root**

Create `/Users/akadlec/Development/Studio81Labs/lovelacer/<worktree>/.dockerignore`:

```
# Build outputs that we recreate inside the container
**/dist
**/node_modules
**/.tsbuildinfo

# Worktrees, git, IDE
.worktrees
.git
.github
.vscode
.idea

# Tests + dev infrastructure
**/__tests__
**/*.test.ts
**/tests
dev
docs

# Addon assets that aren't part of the build context (the Dockerfile
# is referenced directly by the builder)
apps/addon/icon.png
apps/addon/logo.png
apps/addon/README.md
apps/addon/CHANGELOG.md

# OS noise
.DS_Store
Thumbs.db

# Coverage + reports
coverage
*.log
```

- [ ] **Step 2: Create `apps/addon/Dockerfile`**

```dockerfile
ARG BUILD_FROM
FROM ${BUILD_FROM}

# Alpine 3.21 ships Node 22 LTS in the main repo. nodejs-current pulls
# bleeding-edge — pin to the LTS package for stability across HA OS
# releases.
RUN apk add --no-cache nodejs npm jq

# Enable corepack so the workspace's pinned pnpm version (from package.json's
# `packageManager` field) is used at build time instead of npm-pulling latest.
RUN corepack enable

WORKDIR /app

# Copy lockfile + workspace manifests first for cache-friendly install.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/analyzer/package.json packages/analyzer/
COPY packages/generator/package.json packages/generator/
COPY packages/ha-client/package.json packages/ha-client/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

RUN pnpm install --frozen-lockfile

# Copy all source after the install layer so editing source doesn't bust
# the dep cache.
COPY packages packages

# Build server (TS → dist/) and web (Vite → dist/).
RUN pnpm --filter @lovelacer/server build \
 && pnpm --filter @lovelacer/web build

# Re-install with --prod to drop devDependencies from node_modules. The
# workspace symlinks remain intact so packages/server can resolve its
# workspace deps at runtime.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Entrypoint
COPY apps/addon/run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 3000

CMD ["/run.sh"]
```

- [ ] **Step 3: Create `apps/addon/run.sh`**

```bash
#!/usr/bin/env bash
set -e

# Read add-on options from /data/options.json if available. With
# `init: false` and no s6-overlay, we parse JSON directly with jq
# rather than using bashio.
OPTIONS_FILE="/data/options.json"
if [[ -f "$OPTIONS_FILE" ]]; then
  export LOG_LEVEL="$(jq -r '.log_level // "info"' "$OPTIONS_FILE")"
  export DASHBOARD_URL_PATH="$(jq -r '.dashboard_url_path // "lovelacer-home"' "$OPTIONS_FILE")"
fi

# Supervisor injects SUPERVISOR_TOKEN automatically when the add-on
# starts. HA_URL is the canonical hostname inside the add-on network;
# home-assistant-js-websocket connects to /api/websocket on that host.
export HA_URL="http://homeassistant:8123"
export DATA_DIR="/data"

cd /app
# `exec` replaces the shell so signals (SIGTERM from Supervisor on
# stop) reach Node directly without the bash wrapper swallowing them.
exec node packages/server/dist/main.js
```

- [ ] **Step 4: Create `apps/addon/apparmor.txt`**

```
#include <tunables/global>

profile lovelacer flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  #include <abstractions/openssl>

  capability net_bind_service,
  capability dac_override,
  capability setgid,
  capability setuid,

  network inet stream,
  network inet6 stream,
  network unix stream,

  /usr/bin/node ix,
  /usr/bin/jq ix,
  /usr/bin/bash ix,
  /usr/bin/sh ix,
  /usr/bin/env ix,

  /run.sh r,
  /app/** r,
  /data/** rw,
  /tmp/** rwk,
  /proc/sys/kernel/random/uuid r,
  /proc/*/status r,
  /proc/*/stat r,
  /etc/passwd r,
  /etc/group r,
  /etc/nsswitch.conf r,
  /etc/resolv.conf r,
  /etc/ssl/** r,
  /etc/hosts r,
}
```

- [ ] **Step 5: Manual local Docker build smoke test**

This step assumes Docker is available locally. If running in agentic context without Docker, skip and note "no Docker available — skipped local build smoke" in the report. The CI workflow in Task 6 covers the cross-arch build verification.

```bash
docker build \
  -f /Users/akadlec/Development/Studio81Labs/lovelacer/<worktree>/apps/addon/Dockerfile \
  --build-arg BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21 \
  -t lovelacer-addon-local \
  /Users/akadlec/Development/Studio81Labs/lovelacer/<worktree>
```

Expected: build succeeds. The image is ~250 MB.

Optional: run it standalone against the dev HA (assumes `dev/.env` has HA_TOKEN):

```bash
docker run --rm -p 3000:3000 \
  -e HA_URL=http://host.docker.internal:8123 \
  -e HA_TOKEN=$(grep HA_TOKEN /Users/akadlec/Development/Studio81Labs/lovelacer/<worktree>/.env | cut -d= -f2) \
  -e LOG_LEVEL=debug \
  -v /tmp/lovelacer-addon-data:/data \
  lovelacer-addon-local
```

Open `http://localhost:3000`. The SPA should load and `/api/health` should return JSON.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add apps/addon/Dockerfile \
        apps/addon/run.sh \
        apps/addon/apparmor.txt \
        .dockerignore
git -C <worktree> commit -m "$(cat <<'EOF'
feat(addon): Dockerfile + run.sh + apparmor.txt + .dockerignore

Single-stage multi-arch Dockerfile (BUILD_FROM ARG, alpine:3.21 +
nodejs/npm/jq from apk). Builds both server and web via pnpm, then
prunes devDependencies with --prod re-install. The home-assistant/
builder action will invoke this with --root . so the build context
is the repo root (not apps/addon/).

run.sh parses /data/options.json with jq into LOG_LEVEL and
DASHBOARD_URL_PATH env vars, sets HA_URL to the in-network
homeassistant:8123 hostname (Supervisor injects SUPERVISOR_TOKEN
separately), then exec's node so SIGTERM reaches the process directly.

apparmor.txt is a strict profile allowing Node + jq + bash to read
/app, read/write /data and /tmp, and bind :3000. Everything else
denied by default.

.dockerignore at repo root excludes worktrees, tests, dev/, docs/,
and other non-runtime paths to keep the build context tight.

P1a-11 layer 2 of 6 (runtime image).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `config.yaml` + `build.yaml` + `CHANGELOG.md`

**Files:**

- Create: `apps/addon/config.yaml`
- Create: `apps/addon/build.yaml`
- Create: `apps/addon/CHANGELOG.md`

Add-on metadata that HA Supervisor reads. `config.yaml` describes the add-on (options schema, ingress, security profile); `build.yaml` maps architectures to base images for the HA builder action; `CHANGELOG.md` is required by the add-on store schema.

- [ ] **Step 1: Create `apps/addon/config.yaml`**

```yaml
name: Lovelacer
version: '0.0.1'
slug: lovelacer
description: Generate a Lovelace dashboard from your Home Assistant entities
url: https://github.com/Studio81Labs/lovelacer
arch:
  - aarch64
  - amd64
  - armv7
init: false
ingress: true
ingress_port: 3000
panel_icon: mdi:home-variant
panel_title: Lovelacer
homeassistant_api: false
hassio_api: false
host_network: false
apparmor: true
options:
  log_level: info
  dashboard_url_path: lovelacer-home
schema:
  log_level: list(trace|debug|info|warn|error|fatal)
  dashboard_url_path: match(^[a-z0-9][a-z0-9-]*$)
image: ghcr.io/studio81labs/lovelacer-{arch}
```

- [ ] **Step 2: Create `apps/addon/build.yaml`**

```yaml
build_from:
  aarch64: ghcr.io/home-assistant/aarch64-base:3.21
  amd64: ghcr.io/home-assistant/amd64-base:3.21
  armv7: ghcr.io/home-assistant/armv7-base:3.21
labels:
  org.opencontainers.image.source: https://github.com/Studio81Labs/lovelacer
  org.opencontainers.image.licenses: MIT
```

- [ ] **Step 3: Create `apps/addon/CHANGELOG.md`**

```markdown
# Changelog

All notable changes to the Lovelacer add-on are documented here.

## [0.0.1] — Phase 1a alpha (unreleased)

Initial add-on packaging.

- Multi-arch images (aarch64, amd64, armv7) published to GitHub Container Registry.
- HA Supervisor ingress so Lovelacer opens through the HA sidebar.
- Two add-on options: `log_level` and `dashboard_url_path`.
- Bundled SPA + Fastify backend wired through `SUPERVISOR_TOKEN`.
- No persistence yet (`/data` is mounted but unused; placeholder for P1b).
```

- [ ] **Step 4: Verify `config.yaml` is well-formed**

```bash
# Quick syntax check via Python's PyYAML (or any YAML linter you have)
python3 -c "import yaml; yaml.safe_load(open('apps/addon/config.yaml'))"
python3 -c "import yaml; yaml.safe_load(open('apps/addon/build.yaml'))"
```

Expected: both run silently with exit code 0. If `python3` isn't available, use `node -e "require('yaml').parse(require('fs').readFileSync('apps/addon/config.yaml', 'utf8'))"` instead.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add apps/addon/config.yaml \
        apps/addon/build.yaml \
        apps/addon/CHANGELOG.md
git -C <worktree> commit -m "$(cat <<'EOF'
feat(addon): config.yaml + build.yaml + CHANGELOG.md

config.yaml: HA add-on metadata. arch=[aarch64, amd64, armv7],
init: false, ingress on :3000, panel_icon mdi:home-variant for the
sidebar entry. No homeassistant_api/hassio_api/host_network — minimal
blast radius. options: log_level (trace…fatal enum) +
dashboard_url_path (HA URL slug regex).

build.yaml: arch → ghcr.io/home-assistant/<arch>-base:3.21 mapping
for the home-assistant/builder action. OCI labels for source/license.

CHANGELOG.md: required by HA add-on store; v0.0.1 alpha entry.

P1a-11 layer 3 of 6 (HA add-on metadata).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: PNG generation script + committed `icon.png` + `logo.png`

**Files:**

- Create: `dev/scripts/generate-addon-assets.ts`
- Create: `apps/addon/icon.png`
- Create: `apps/addon/logo.png`
- Modify: `package.json` (add `pngjs` to root devDeps + a script)

Reproducibly generates the placeholder PNGs from a hardcoded config so a future logo update is a one-command run. Uses `pngjs` (small, pure-JS PNG encoder) — no native deps.

- [ ] **Step 1: Add `pngjs` and a script alias to root `package.json`**

Read `package.json` at repo root first. Add `pngjs` and `@types/pngjs` to the root `devDependencies` (alphabetical), and add a script alias under `scripts`:

```json
{
  "scripts": {
    "...": "...",
    "generate:addon-assets": "tsx dev/scripts/generate-addon-assets.ts"
  },
  "devDependencies": {
    "...": "...",
    "@types/pngjs": "^6.0.5",
    "pngjs": "^7.0.0"
  }
}
```

The repo already uses `tsx` for `dev/scripts/*.ts` (check the existing scripts block — there's a similar pattern). If `tsx` isn't already in devDeps, also add `"tsx": "^4.19.0"`.

- [ ] **Step 2: Create `dev/scripts/generate-addon-assets.ts`**

```ts
/**
 * Reproducibly generate placeholder add-on branding (icon.png + logo.png)
 * from a hardcoded color + text config. Re-run when the brand changes.
 *
 * Output paths are committed to git — HA Supervisor needs the PNGs at
 * install time. P1b/P2 swap them for designed assets.
 *
 * Usage:
 *   pnpm generate:addon-assets
 *
 * Implementation: pure-JS PNG via pngjs. No native deps, no canvas
 * rendering — we draw a flat background and a centered glyph by writing
 * RGBA pixels into a buffer.
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const here = dirname(fileURLToPath(import.meta.url))
const addonDir = resolve(here, '../../apps/addon')

// Brand orange from packages/web/src/styles.css (oklch(0.62 0.19 35)
// converted to sRGB ≈ #e0653f).
const BRAND_RGB: [number, number, number] = [0xe0, 0x65, 0x3f]
const WHITE_RGB: [number, number, number] = [0xff, 0xff, 0xff]

interface PngConfig {
  width: number
  height: number
  outPath: string
  /**
   * For each pixel position, return the RGBA color. Pixels outside the
   * image bounds aren't queried.
   */
  shade: (x: number, y: number) => [number, number, number, number]
}

function writePng(cfg: PngConfig): void {
  const png = new PNG({ width: cfg.width, height: cfg.height, colorType: 6 })
  for (let y = 0; y < cfg.height; y++) {
    for (let x = 0; x < cfg.width; x++) {
      const idx = (cfg.width * y + x) << 2
      const [r, g, b, a] = cfg.shade(x, y)
      png.data[idx] = r
      png.data[idx + 1] = g
      png.data[idx + 2] = b
      png.data[idx + 3] = a
    }
  }
  writeFileSync(cfg.outPath, PNG.sync.write(png))
  console.log(`wrote ${cfg.outPath} (${cfg.width}x${cfg.height})`)
}

/**
 * Stamp an "L" glyph by filling pixels inside a hand-tuned rectangle
 * pattern. Returns true when (x, y) is inside the glyph.
 *
 * Coordinates are normalized 0..1 within the glyph bounding box so the
 * same routine scales for icon (128×128) and logo (250×100).
 */
function isInsideL(nx: number, ny: number, thickness: number): boolean {
  // Vertical stroke: 0..thickness on x, 0..1 on y
  if (nx >= 0 && nx <= thickness && ny >= 0 && ny <= 1) return true
  // Horizontal stroke at the bottom: 0..1 on x, 1-thickness..1 on y
  if (nx >= 0 && nx <= 1 && ny >= 1 - thickness && ny <= 1) return true
  return false
}

// --- icon.png: 128×128 brand-orange square with a centered white "L" ---
{
  const SIZE = 128
  const GLYPH_BOX = 64 // L sits inside a 64×64 box, centered
  const GLYPH_OFFSET = (SIZE - GLYPH_BOX) / 2
  const STROKE_THICKNESS = 0.28 // fraction of the bounding box

  writePng({
    width: SIZE,
    height: SIZE,
    outPath: resolve(addonDir, 'icon.png'),
    shade: (x, y) => {
      const gx = (x - GLYPH_OFFSET) / GLYPH_BOX
      const gy = (y - GLYPH_OFFSET) / GLYPH_BOX
      if (gx >= 0 && gx <= 1 && gy >= 0 && gy <= 1 && isInsideL(gx, gy, STROKE_THICKNESS)) {
        return [...WHITE_RGB, 0xff]
      }
      return [...BRAND_RGB, 0xff]
    },
  })
}

// --- logo.png: 250×100 brand-orange with white "L" + "ovelacer" text ---
// We don't render arbitrary text without a glyph table (out of scope for
// pure-JS), so the logo is just the icon stamp scaled into a rectangle.
// The wordmark lands when we have a real designed asset.
{
  const W = 250
  const H = 100
  const GLYPH_H = 60
  const GLYPH_W = 60
  const OFFSET_X = 30
  const OFFSET_Y = (H - GLYPH_H) / 2
  const STROKE_THICKNESS = 0.28

  writePng({
    width: W,
    height: H,
    outPath: resolve(addonDir, 'logo.png'),
    shade: (x, y) => {
      const gx = (x - OFFSET_X) / GLYPH_W
      const gy = (y - OFFSET_Y) / GLYPH_H
      if (gx >= 0 && gx <= 1 && gy >= 0 && gy <= 1 && isInsideL(gx, gy, STROKE_THICKNESS)) {
        return [...WHITE_RGB, 0xff]
      }
      return [...BRAND_RGB, 0xff]
    },
  })
}
```

- [ ] **Step 3: Install + run**

```bash
pnpm --dir <worktree> install
pnpm --dir <worktree> generate:addon-assets
```

Expected output:

```
wrote .../apps/addon/icon.png (128x128)
wrote .../apps/addon/logo.png (250x100)
```

The two PNGs are now in `apps/addon/`.

- [ ] **Step 4: Verify the PNGs are valid**

```bash
file apps/addon/icon.png apps/addon/logo.png
```

Expected:

```
apps/addon/icon.png: PNG image data, 128 x 128, 8-bit/color RGBA, non-interlaced
apps/addon/logo.png: PNG image data, 250 x 100, 8-bit/color RGBA, non-interlaced
```

- [ ] **Step 5: Verify the broader build still passes**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
```

Both green. (`tsconfig.tools.json` covers `dev/scripts/`; the new script's TS check runs there.)

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add dev/scripts/generate-addon-assets.ts \
        apps/addon/icon.png \
        apps/addon/logo.png \
        package.json \
        pnpm-lock.yaml
git -C <worktree> commit -m "$(cat <<'EOF'
feat(addon): generate placeholder icon.png + logo.png via pure-JS script

dev/scripts/generate-addon-assets.ts uses pngjs (small, no native deps)
to write a 128×128 icon and 250×100 logo from the brand orange + white
"L" glyph. Reproducible — re-run pnpm generate:addon-assets after a
brand change. Output PNGs are committed to git because HA Supervisor
needs them at install time.

The "L" is stamped by a hand-tuned isInsideL function that draws a
vertical stroke + a horizontal bottom stroke. No glyph table support
yet (would require shipping a font); the wordmark "ovelacer" text
lands when we have a real designed asset.

P1a-11 layer 4 of 6 (branding).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `apps/addon/README.md` + `docs/ADDON_INSTALL.md`

**Files:**

- Modify: `apps/addon/README.md` (replace placeholder)
- Create: `docs/ADDON_INSTALL.md`

The add-on store renders `apps/addon/README.md` directly inside the HA UI when a user clicks the add-on. `docs/ADDON_INSTALL.md` is the longer install guide we link to from the project's main README.

- [ ] **Step 1: Replace `apps/addon/README.md`**

Read the existing file first (it's a 600-byte placeholder). Write:

```markdown
# Lovelacer

Generate a Home Assistant Lovelace dashboard from your existing entities.

## What it does

1. Click **Analyze** — Lovelacer reads your HA entity, device, and area registries.
2. See a list of detected rooms with entity counts and confidence summaries.
3. Click **Apply** — Lovelacer generates a `lovelacer-home` Lovelace dashboard and pushes it to HA via the storage-mode WebSocket.

The dashboard is a regular HA dashboard you can edit, copy, or delete from HA's UI like any other.

## Configuration

Two options:

| Key                  | Default          | Notes                                                                                                                                                   |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `log_level`          | `info`           | One of `trace, debug, info, warn, error, fatal`. Set `debug` to see why entities did or didn't get classified into a room.                              |
| `dashboard_url_path` | `lovelacer-home` | The `url_path` segment HA uses for the generated dashboard. Lower-case alphanumeric + hyphens. Change if you want a different URL or a second instance. |

## Logs

The add-on writes Pino-formatted JSON to stdout. View them in **Settings → Add-ons → Lovelacer → Logs**.

## Privacy + scope

Lovelacer reads your HA registries and writes a single Lovelace dashboard back. It doesn't:

- Send any data outside your HA instance.
- Modify your existing automations, scripts, or other dashboards.
- Persist anything to disk yet (Phase 1a). The `/data` volume is mounted but unused.

## Status

This is **Phase 1a alpha**. Things you should know:

- Only English + Czech room name patterns are supported. German lands in 1b.
- Only light, switch, sensor (temperature/humidity), binary_sensor (motion/occupancy/door), and climate entities get proper card mapping. Everything else lands in a generic "Other" view.
- No drag-and-drop. No per-entity overrides. No diff against existing dashboards.

## Source + reporting bugs

- Source: <https://github.com/Studio81Labs/lovelacer>
- Bug reports: <https://github.com/Studio81Labs/lovelacer/issues>
- Architecture + design docs: see `docs/` in the source repo.
```

- [ ] **Step 2: Create `docs/ADDON_INSTALL.md`**

```markdown
# Installing the Lovelacer add-on

Phase 1a alpha — install via custom add-on repository on your own HA instance.

## Prerequisites

- HA OS or HA Supervised (the add-on store isn't available in HA Core or HA Container).
- Internet access from the HA host to `ghcr.io` (Lovelacer images live there).

## Install

1. In HA, open **Settings → Add-ons → Add-on Store**.
2. Click the **⋮** menu (top right) → **Repositories**.
3. Add `https://github.com/Studio81Labs/lovelacer` and click **Add**.
4. Close the repositories dialog. Scroll down — you'll see a **Lovelacer** section.
5. Click **Lovelacer** → **Install**. The first install pulls the multi-arch image (~50 MB compressed) for your HA host's architecture.
6. After install, click **Start**. The add-on status should turn green within ~10 seconds.
7. Click **Open Web UI** (or use the new sidebar entry) to open the SPA via Supervisor ingress.

## Configuration

The defaults work out of the box. To change them:

1. Open the add-on's **Configuration** tab.
2. Edit `log_level` (default `info`) or `dashboard_url_path` (default `lovelacer-home`).
3. Click **Save** and **Restart**.

## Updating

Lovelacer publishes two channels:

- **`latest` / `vX.Y.Z`** — tagged releases. Recommended.
- **`main` / `sha-<short>`** — bleeding edge from `main`. For our own dogfood; the add-on store always installs `latest`.

When a new tagged release is published, HA's add-on store shows an **Update available** banner. Click it to pull the new image.

## Uninstalling

1. Open the add-on, click **Uninstall**. The container is removed; the `lovelacer-home` dashboard is **not** deleted from HA — that's a separate cleanup.
2. To delete the dashboard: **Settings → Dashboards → Lovelacer — Home → ⋮ → Delete**.

## Troubleshooting

- **"Backend unreachable" in the SPA**: the Fastify server inside the add-on is starting up. Wait 10s and reload, or check **Logs** for a startup error.
- **HA shows "disconnected" in the SPA's HealthBar**: the add-on can reach the network but not HA. Usually means `SUPERVISOR_TOKEN` is missing — try restarting the add-on.
- **Apply fails with `ha_apply_failed` step `save`**: HA rejected the generated config. Often happens when an existing dashboard at the same `url_path` was modified manually. Either delete it from HA's UI first or change `dashboard_url_path`.
- **"No rooms detected"**: your HA install doesn't have areas assigned to entities, or the device / entity names don't match Lovelacer's English + Czech room patterns. Open `log_level: debug` and re-run Analyze; the add-on log shows which patterns matched what.

## Architecture summary

The add-on packages two services into one container:

- A **Fastify backend** (`@lovelacer/server`) that holds the analysis pipeline, generator, and HA WebSocket client. Listens on `:3000`.
- A **Vue 3 SPA** (`@lovelacer/web`) served as static assets by the same Fastify server. Loaded into the HA UI via Supervisor ingress.

The backend uses `SUPERVISOR_TOKEN` to talk to HA Core's WS API at `ws://homeassistant:8123/api/websocket`. No internet access is needed at runtime once the image is pulled.

For the full architecture, see `docs/ARCHITECTURE.md` in the source repo.
```

- [ ] **Step 3: Commit**

```bash
git -C <worktree> add apps/addon/README.md \
        docs/ADDON_INSTALL.md
git -C <worktree> commit -m "$(cat <<'EOF'
docs(addon): replace placeholder README with real one + install guide

apps/addon/README.md is what HA renders inside the add-on store, so
it's user-facing: what Lovelacer does, the two configurable options,
where logs go, privacy/scope disclosure, and Phase 1a alpha caveats.

docs/ADDON_INSTALL.md is the longer install guide we link from the
project's main README — prerequisites, step-by-step custom-repo
install, update channels, uninstall, common troubleshooting paths.

P1a-11 layer 5 of 6 (user docs).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: CI workflows — `build-addon.yml` + `release.yml`

**Files:**

- Create: `.github/workflows/build-addon.yml`
- Create: `.github/workflows/release.yml`

`build-addon.yml` is the runtime — builds + (sometimes) publishes images. `release.yml` is the orchestrator on tag pushes (calls `build-addon.yml` + creates a GitHub Release). PR builds verify the Dockerfile compiles for all 3 arches without publishing.

- [ ] **Step 1: Create `.github/workflows/build-addon.yml`**

```yaml
name: Build add-on

on:
  push:
    branches: [main]
    paths:
      - 'apps/addon/**'
      - 'packages/**'
      - 'pnpm-lock.yaml'
      - 'package.json'
      - 'pnpm-workspace.yaml'
      - 'tsconfig.base.json'
      - '.dockerignore'
      - '.github/workflows/build-addon.yml'
  pull_request:
    paths:
      - 'apps/addon/**'
      - 'packages/**'
      - 'pnpm-lock.yaml'
      - 'package.json'
      - 'pnpm-workspace.yaml'
      - 'tsconfig.base.json'
      - '.dockerignore'
      - '.github/workflows/build-addon.yml'
  workflow_call:
    inputs:
      version:
        type: string
        required: true
      tags:
        type: string
        required: true
        description: 'Comma-separated additional image tags'

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        arch: [aarch64, amd64, armv7]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Login to GHCR
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Resolve build metadata
        id: meta
        run: |
          if [[ "${{ github.event_name }}" == "workflow_call" ]]; then
            echo "version=${{ inputs.version }}" >> "$GITHUB_OUTPUT"
            echo "tags=${{ inputs.tags }}" >> "$GITHUB_OUTPUT"
          elif [[ "${{ github.event_name }}" == "pull_request" ]]; then
            SHA="${GITHUB_SHA::7}"
            echo "version=0.0.0-pr.${{ github.event.number }}.${SHA}" >> "$GITHUB_OUTPUT"
            echo "tags=" >> "$GITHUB_OUTPUT"
          else
            SHA="${GITHUB_SHA::7}"
            echo "version=0.0.0-main.${SHA}" >> "$GITHUB_OUTPUT"
            echo "tags=main,sha-${SHA}" >> "$GITHUB_OUTPUT"
          fi

      - name: Build add-on (${{ matrix.arch }})
        uses: home-assistant/builder@2024.08.2
        with:
          args: |
            --${{ matrix.arch }}
            --target apps/addon
            --image ghcr.io/studio81labs/lovelacer-{arch}
            --version ${{ steps.meta.outputs.version }}
            ${{ steps.meta.outputs.tags != '' && format('--addtional-tag {0}', steps.meta.outputs.tags) || '' }}
            ${{ github.event_name == 'pull_request' && '--test' || '' }}
            --root .
```

The `--test` flag on PR builds tells the HA builder to skip the `docker push` step. The `--root .` flag sets the Docker build context to the repo root so the Dockerfile's `COPY pnpm-lock.yaml` (etc.) resolve.

- [ ] **Step 2: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: write
  packages: write

jobs:
  build:
    uses: ./.github/workflows/build-addon.yml
    secrets: inherit
    with:
      version: ${{ github.ref_name }}
      tags: ${{ format('latest,{0}', github.ref_name) }}

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          tag_name: ${{ github.ref_name }}
```

- [ ] **Step 3: Verify workflow syntax locally**

If `actionlint` is installed:

```bash
actionlint .github/workflows/build-addon.yml .github/workflows/release.yml
```

Expected: no output (clean). If `actionlint` isn't installed, skip — GitHub will surface syntax errors when the workflow runs.

If `yq` is available, sanity-check the YAML parses:

```bash
yq . .github/workflows/build-addon.yml >/dev/null
yq . .github/workflows/release.yml >/dev/null
```

- [ ] **Step 4: Run the full verification suite one more time**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
pnpm --dir <worktree> format:check
pnpm --dir <worktree> lint
```

All four green.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add .github/workflows/build-addon.yml \
        .github/workflows/release.yml
git -C <worktree> commit -m "$(cat <<'EOF'
ci(addon): build-addon.yml + release.yml — multi-arch GHCR pipeline

build-addon.yml runs on PR, push-to-main, and workflow_call. PR builds
verify the Dockerfile compiles for all 3 arches but skip docker push
via --test. Push-to-main publishes images tagged 'main' + 'sha-<short>'
for our dogfood. workflow_call accepts version + tags inputs so
release.yml can drive a tagged release.

release.yml runs on tag pushes (v*). It calls build-addon.yml with
the tag name as version + 'latest,vX.Y.Z' tags, then creates a GitHub
Release with auto-generated notes via softprops/action-gh-release.

home-assistant/builder@2024.08.2 is pinned. --root . overrides the
default build context so the Dockerfile's repo-root COPYs work.

P1a-11 layer 6 of 6 (CI). End of P1a-11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1a-11 Acceptance Confirmation

- [ ] `apps/addon/` ships Dockerfile, build.yaml, config.yaml, run.sh, apparmor.txt, icon.png, logo.png, README.md, CHANGELOG.md.
- [ ] `.github/workflows/build-addon.yml` and `.github/workflows/release.yml` exist and the PR build is green.
- [ ] `pnpm typecheck`, `pnpm -r test` (incl. 2 new pipeline tests), `pnpm format:check`, `pnpm lint` clean.
- [ ] If Docker is available locally: `docker build` for amd64 succeeds + the image starts and serves the SPA + `/api/health` responds.
- [ ] No real-HA install verified yet; that gate is a post-merge ship task before tagging `v0.0.1`.
