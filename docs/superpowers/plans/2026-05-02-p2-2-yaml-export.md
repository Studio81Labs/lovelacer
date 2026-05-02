# P2-2 YAML Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /api/export.yaml` and a "Download YAML" button on the Preview screen so users can save the dashboard config as YAML for git, ui-mode dashboards, or support sharing.

**Architecture:** A new pure `configToYaml()` in `@lovelacer/generator` wraps `yaml.stringify()` with a minimal three-line header (version + timestamp + "manual edits will not be preserved" warning) and `lineWidth: 0` to keep long entity ids unbroken. A new `GET /api/export.yaml` route reuses `runPreview()` to get the current `LovelaceConfig`, runs it through `configToYaml`, and returns it with `Content-Type: application/yaml` + `Content-Disposition: attachment`. The frontend gets a plain `<a href download>` link in `DashboardPreview.vue` — pure browser-native download, zero JS.

**Tech Stack:** TypeScript strict (verbatimModuleSyntax + exactOptionalPropertyTypes), Fastify route plugins with DI, `yaml@^2.6.0` (already a direct dep of `@lovelacer/generator`), Vue 3 + Tailwind 4, Vitest with `globals: false`.

---

## Source of Truth

`docs/superpowers/specs/2026-05-02-p2-2-yaml-export-design.md` is the canonical spec. If anything in this plan contradicts that doc, the spec wins — fix the plan and re-run.

## Codebase Conventions (read before starting)

- ESM with explicit `.js` extensions on imports even when importing TS source.
- Vitest tests must `import { describe, it, expect } from 'vitest'` — `globals: false`.
- Route plugins receive their dependencies via `opts`; tests use `createApp({ … :memory: stores })` with `app.inject({ method, url })`.
- The web package has zero workspace dependencies — `LovelaceConfig` is mirrored locally in `packages/web/src/api/types.ts`. Don't add `@lovelacer/generator` as a dep; the YAML output is server-side only.
- `CreateAppOptions` already has `appliedSnapshot: AppliedSnapshotStore` and `dashboardUrlPath: string` from prior tickets — no new wiring beyond registering the new route.
- All existing route tests use a `makeAppliedSnapshot()` helper from P2-1; copy it into the new `export.test.ts`.

## File Structure

**New:**

| Path                                                   | Responsibility                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `packages/generator/src/yaml-export.ts`                | Pure `configToYaml()` — input config + options, output YAML string with header |
| `packages/generator/src/__tests__/yaml-export.test.ts` | Round-trip + header + lineWidth + default-options tests                        |
| `packages/server/src/routes/export.ts`                 | `GET /api/export.yaml` — runs preview, serializes, sets headers                |
| `packages/server/src/__tests__/routes/export.test.ts`  | HA-disconnected, happy-path, pipeline-failure, custom + invalid filename       |

**Modified:**

| Path                                                             | Changes                                                               |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/generator/src/index.ts`                                | Re-export `configToYaml` and `ConfigToYamlOptions`                    |
| `packages/server/src/app.ts`                                     | Register `exportRoute` between `applyRoute` and `overridesRoute`      |
| `packages/web/src/components/DashboardPreview.vue`               | Wrap title in flex header, add `<a href="/api/export.yaml" download>` |
| `packages/web/src/__tests__/components/DashboardPreview.test.ts` | Add link-render case                                                  |

---

## Setup

- [ ] **Step 0a: Create the worktree**

```bash
git fetch origin
git worktree add .worktrees/p2-2-yaml-export -b feat/p2-2-yaml-export origin/main
cd .worktrees/p2-2-yaml-export
```

Expected: new worktree at `.worktrees/p2-2-yaml-export/` on branch `feat/p2-2-yaml-export` based on the latest `origin/main`. Spec file is present (committed to main).

- [ ] **Step 0b: Verify baseline is green**

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass. If anything fails, fix before starting Task 1.

---

## Task 1: configToYaml Pure Module

**Files:**

- Create: `packages/generator/src/yaml-export.ts`
- Create: `packages/generator/src/__tests__/yaml-export.test.ts`
- Modify: `packages/generator/src/index.ts`

**Why this task:** Pure function with no IO. Easy to TDD comprehensively. The route + frontend pieces depend on its existence and signature.

- [ ] **Step 1: Write the failing test**

Create `packages/generator/src/__tests__/yaml-export.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parse as yamlParse } from 'yaml'
import { configToYaml } from '../yaml-export.js'
import { GENERATOR_VERSION } from '../index.js'
import type { LovelaceConfig } from '../lovelace-config.js'

const sampleConfig: LovelaceConfig = {
  title: 'Lovelacer — Home',
  views: [
    {
      type: 'sections',
      title: 'Home',
      path: 'home',
      icon: 'mdi:home-variant',
      sections: [],
    },
    {
      type: 'sections',
      title: 'Kitchen',
      path: 'kitchen',
      icon: 'mdi:silverware-fork-knife',
      sections: [],
    },
  ],
}

function bodyAfterHeader(yaml: string): string {
  // Header is exactly 3 comment lines + 1 blank line. Drop them so the
  // remaining string is pure YAML for parsing.
  const lines = yaml.split('\n')
  return lines.slice(4).join('\n')
}

describe('configToYaml', () => {
  it('returns header + valid YAML for an empty config', () => {
    const empty: LovelaceConfig = { title: 'x', views: [] }
    const result = configToYaml(empty)
    expect(result).toContain('# Generated by Lovelacer')
    const parsed = yamlParse(bodyAfterHeader(result)) as LovelaceConfig
    expect(parsed).toEqual(empty)
  })

  it('round-trips a multi-view config via yaml.parse', () => {
    const result = configToYaml(sampleConfig)
    const parsed = yamlParse(bodyAfterHeader(result)) as LovelaceConfig
    expect(parsed).toEqual(sampleConfig)
  })

  it('pins the header format with explicit version and timestamp', () => {
    const result = configToYaml(sampleConfig, {
      version: 'test-1.2.3',
      generatedAt: new Date('2026-05-02T17:00:00.000Z'),
    })
    const lines = result.split('\n')
    expect(lines[0]).toBe('# Generated by Lovelacer vtest-1.2.3 on 2026-05-02T17:00:00.000Z')
    expect(lines[1]).toBe('# This file is regenerated each time you click Apply or Download YAML.')
    expect(lines[2]).toBe('# Manual edits to this file will NOT be preserved on the next run.')
    expect(lines[3]).toBe('')
  })

  it('uses GENERATOR_VERSION and a recent timestamp by default', () => {
    const before = Date.now()
    const result = configToYaml(sampleConfig)
    const after = Date.now()
    const firstLine = result.split('\n')[0]!
    expect(firstLine).toContain(`# Generated by Lovelacer v${GENERATOR_VERSION} on `)
    // Extract the ISO timestamp at the end of line 1 and verify it falls
    // within the test window. ISO 8601 length is fixed (24 chars).
    const tsMatch = firstLine.match(/on (\S+)$/)
    expect(tsMatch).not.toBeNull()
    const ts = new Date(tsMatch![1]!).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('keeps long entity ids on a single line (lineWidth: 0)', () => {
    const longId = 'light.kitchen_under_cabinet_strip_with_a_very_long_name_indeed'
    const config: LovelaceConfig = {
      title: 'x',
      views: [
        {
          type: 'sections',
          title: 'K',
          path: 'k',
          icon: 'mdi:home',
          sections: [
            {
              type: 'grid',
              cards: [{ type: 'tile', entity: longId }],
            },
          ],
        },
      ],
    }
    const result = configToYaml(config)
    // The entity id appears exactly once and is not split across lines.
    const lines = result.split('\n')
    const linesContainingId = lines.filter((line) => line.includes(longId))
    expect(linesContainingId).toHaveLength(1)
    // The line containing the id should NOT contain a trailing backslash
    // or a YAML continuation marker — meaning the value isn't wrapped.
    expect(linesContainingId[0]).not.toMatch(/\\$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @lovelacer/generator test -- yaml-export
```

Expected: FAIL — `yaml-export.js` doesn't exist (module-not-found).

- [ ] **Step 3: Implement configToYaml**

Create `packages/generator/src/yaml-export.ts`:

```ts
import { stringify } from 'yaml'
import { GENERATOR_VERSION } from './index.js'
import type { LovelaceConfig } from './lovelace-config.js'

export interface ConfigToYamlOptions {
  /** Tool version printed in the header. Defaults to GENERATOR_VERSION. */
  version?: string
  /** Generation timestamp. Defaults to `new Date()` — caller can pin for tests. */
  generatedAt?: Date
}

/**
 * Serialize a LovelaceConfig as a YAML string with a minimal three-line
 * header comment. Stable output: same input + same options → byte-identical
 * string (modulo `generatedAt` if not pinned).
 *
 * `lineWidth: 0` disables yaml.stringify's default 80-char wrap so long
 * entity ids (e.g. `light.kitchen_under_cabinet_strip_with_a_very_long_name`)
 * stay on one line — visually cleaner and easier to grep.
 */
export function configToYaml(config: LovelaceConfig, options?: ConfigToYamlOptions): string {
  const version = options?.version ?? GENERATOR_VERSION
  const generatedAt = (options?.generatedAt ?? new Date()).toISOString()
  const header =
    `# Generated by Lovelacer v${version} on ${generatedAt}\n` +
    `# This file is regenerated each time you click Apply or Download YAML.\n` +
    `# Manual edits to this file will NOT be preserved on the next run.\n` +
    `\n`
  const body = stringify(config, {
    indent: 2,
    lineWidth: 0,
    minContentWidth: 0,
  })
  return header + body
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @lovelacer/generator test -- yaml-export
```

Expected: 5/5 tests pass.

- [ ] **Step 5: Re-export from generator index**

Edit `packages/generator/src/index.ts`. Append to the existing exports:

```ts
export { configToYaml } from './yaml-export.js'
export type { ConfigToYamlOptions } from './yaml-export.js'
```

- [ ] **Step 6: Verify full generator suite + typecheck + lint**

```bash
pnpm --filter @lovelacer/generator test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass. The generator's test count grows by 5.

- [ ] **Step 7: Commit**

```bash
git add packages/generator/src/yaml-export.ts \
  packages/generator/src/__tests__/yaml-export.test.ts \
  packages/generator/src/index.ts
git commit -m "feat(generator): configToYaml pure module for YAML export"
```

---

## Task 2: Export Route

**Files:**

- Create: `packages/server/src/routes/export.ts`
- Create: `packages/server/src/__tests__/routes/export.test.ts`
- Modify: `packages/server/src/app.ts`

**Why this task:** Wire the YAML serializer into a real HTTP endpoint so the frontend has something to link to. Defense-in-depth filename validation lives here (the route is the trust boundary).

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/__tests__/routes/export.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { parse as yamlParse } from 'yaml'
import type { HaClient } from '@lovelacer/ha-client'
import { englishCluttered } from '../../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../../tests/fixtures/_builder/index.js'
import { createApp } from '../../app.js'
import { AppliedSnapshotStore } from '../../storage/applied-snapshot-store.js'
import { InviteStore } from '../../storage/invite-store.js'
import { OverrideStore } from '../../storage/override-store.js'

function makeStore(): OverrideStore {
  return new OverrideStore(':memory:')
}

function makeAcceptedInvite(): InviteStore {
  const s = new InviteStore(':memory:')
  s.accept('BETA-2026-ALPHA')
  return s
}

function makeAppliedSnapshot(): AppliedSnapshotStore {
  return new AppliedSnapshotStore(':memory:')
}

function makeHa(connected = true): HaClient {
  const ha = fixtureToHaRegistries(englishCluttered)
  return {
    isConnected: () => connected,
    getEntityRegistry: vi.fn(async () => ha.entities),
    getDeviceRegistry: vi.fn(async () => ha.devices),
    getAreaRegistry: vi.fn(async () => ha.areas),
    getFloorRegistry: vi.fn(async () => []),
  } as unknown as HaClient
}

describe('GET /api/export.yaml', () => {
  it('returns 503 ha_unavailable when HA is disconnected', async () => {
    const app = await createApp({
      ha: makeHa(false),
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/export.yaml' })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({ error: 'ha_unavailable' })
    } finally {
      await app.close()
    }
  })

  it('returns 200 with valid YAML body and the right headers', async () => {
    const app = await createApp({
      ha: makeHa(true),
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/export.yaml' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('application/yaml; charset=utf-8')
      expect(res.headers['content-disposition']).toBe('attachment; filename="lovelacer-home.yaml"')
      // Body parses as YAML and has the expected top-level shape.
      const body = res.body
      expect(body).toContain('# Generated by Lovelacer')
      const lines = body.split('\n')
      const yamlBody = lines.slice(4).join('\n')
      const parsed = yamlParse(yamlBody) as { title: unknown; views: unknown[] }
      expect(typeof parsed.title).toBe('string')
      expect(Array.isArray(parsed.views)).toBe(true)
      expect(parsed.views.length).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })

  it('returns 500 export_failed when the registry fetch throws', async () => {
    const ha = {
      isConnected: () => true,
      getEntityRegistry: vi.fn(async () => {
        throw new Error('boom')
      }),
      getDeviceRegistry: vi.fn(async () => []),
      getAreaRegistry: vi.fn(async () => []),
      getFloorRegistry: vi.fn(async () => []),
    } as unknown as HaClient
    const app = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/export.yaml' })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toMatchObject({ error: 'export_failed' })
    } finally {
      await app.close()
    }
  })

  it('uses dashboardUrlPath for the Content-Disposition filename', async () => {
    const app = await createApp({
      ha: makeHa(true),
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      logLevel: 'silent',
      dashboardUrlPath: 'my-dash',
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/export.yaml' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-disposition']).toBe('attachment; filename="my-dash.yaml"')
    } finally {
      await app.close()
    }
  })

  it('falls back to lovelacer-home.yaml when dashboardUrlPath is unsafe', async () => {
    // dashboardUrlPath would normally be validated by HA's storage-mode
    // schema upstream; this exercises the route's defense-in-depth fallback
    // for hypothetical future schema loosening.
    const app = await createApp({
      ha: makeHa(true),
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      logLevel: 'silent',
      dashboardUrlPath: '../etc/passwd',
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/export.yaml' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-disposition']).toBe('attachment; filename="lovelacer-home.yaml"')
    } finally {
      await app.close()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @lovelacer/server test -- export
```

Expected: FAIL — route doesn't exist (404 or registration error).

- [ ] **Step 3: Implement the route**

Create `packages/server/src/routes/export.ts`:

```ts
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import { configToYaml } from '@lovelacer/generator'
import type { OverrideStore } from '../storage/override-store.js'
import type { AppliedSnapshotStore } from '../storage/applied-snapshot-store.js'
import { runPreview } from '../pipeline.js'

export interface ExportRouteOptions {
  ha: HaClient
  overrides: OverrideStore
  appliedSnapshot: AppliedSnapshotStore
  /** Filename suggested via Content-Disposition. Matches dashboardUrlPath. */
  dashboardUrlPath: string
}

const SAFE_FILENAME = /^[a-zA-Z0-9_-]+$/

/**
 * GET /api/export.yaml — runs the preview pipeline, serializes the
 * resulting LovelaceConfig as YAML, and returns it as an attachment.
 *
 * Errors:
 * - 503 ha_unavailable: HaClient not connected
 * - 500 export_failed: pipeline or serialization threw
 */
export const exportRoute: FastifyPluginAsync<ExportRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.get('/api/export.yaml', async (req, reply) => {
    if (!opts.ha.isConnected()) {
      return reply
        .code(503)
        .send({ error: 'ha_unavailable', message: 'Home Assistant connection not ready' })
    }
    try {
      const preview = await runPreview(opts.ha, opts.overrides, opts.appliedSnapshot)
      const yaml = configToYaml(preview.config)
      const safeStem = SAFE_FILENAME.test(opts.dashboardUrlPath)
        ? opts.dashboardUrlPath
        : 'lovelacer-home'
      return reply
        .code(200)
        .header('Content-Type', 'application/yaml; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${safeStem}.yaml"`)
        .send(yaml)
    } catch (err) {
      req.log.error({ err }, 'export failed')
      return reply.code(500).send({ error: 'export_failed', message: String(err) })
    }
  })
}
```

- [ ] **Step 4: Register the route in app.ts**

Edit `packages/server/src/app.ts`. Add the import near the existing route imports:

```ts
import { exportRoute } from './routes/export.js'
```

In `createApp`, register `exportRoute` between `applyRoute` and `overridesRoute`:

```ts
await app.register(exportRoute, {
  ha: opts.ha,
  overrides: opts.overrides,
  appliedSnapshot: opts.appliedSnapshot,
  dashboardUrlPath: opts.dashboardUrlPath,
})
```

(Insert after the `applyRoute` block; before `overridesRoute`.)

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @lovelacer/server test -- export
```

Expected: 5/5 export tests pass.

- [ ] **Step 6: Run full server suite + typecheck + lint + format**

```bash
pnpm --filter @lovelacer/server test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass. Server test count grows by 5.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/routes/export.ts \
  packages/server/src/__tests__/routes/export.test.ts \
  packages/server/src/app.ts
git commit -m "feat(server): GET /api/export.yaml endpoint"
```

---

## Task 3: Frontend Download Button

**Files:**

- Modify: `packages/web/src/components/DashboardPreview.vue`
- Modify: `packages/web/src/__tests__/components/DashboardPreview.test.ts`

**Why this task:** Surface the new endpoint in the UI. Pure declarative anchor — no JS needed.

- [ ] **Step 1: Write the failing test**

Edit `packages/web/src/__tests__/components/DashboardPreview.test.ts`. Append a new `it` inside the existing `describe`:

```ts
it('renders a Download YAML link pointing at /api/export.yaml when views are present', () => {
  const wrapper = mount(DashboardPreview, { props: { config } })
  const link = wrapper.find('[data-testid="export-yaml-link"]')
  expect(link.exists()).toBe(true)
  expect(link.attributes('href')).toBe('/api/export.yaml')
  expect(link.attributes('download')).toBeDefined()
  expect(link.text()).toContain('Download YAML')
})

it('does not render the Download YAML link when views are empty', () => {
  const empty: LovelaceConfig = { title: 'x', views: [] }
  const wrapper = mount(DashboardPreview, { props: { config: empty } })
  expect(wrapper.find('[data-testid="export-yaml-link"]').exists()).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @lovelacer/web test -- DashboardPreview
```

Expected: FAIL — `[data-testid="export-yaml-link"]` doesn't exist.

- [ ] **Step 3: Update the component template**

Edit `packages/web/src/components/DashboardPreview.vue`. Replace the existing template with:

```vue
<template>
  <section v-if="config.views.length > 0">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-medium text-stone-700">
        Will create {{ config.views.length }} dashboard
        {{ config.views.length === 1 ? 'view' : 'views' }}
      </h3>
      <a
        href="/api/export.yaml"
        download
        data-testid="export-yaml-link"
        class="rounded border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
      >
        Download YAML
      </a>
    </div>
    <ul class="flex flex-wrap gap-2">
      <li
        v-for="view in config.views"
        :key="view.path"
        data-testid="view-pill"
        class="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700"
      >
        <Icon :icon="view.icon" class="h-4 w-4" />
        <span>{{ view.title }}</span>
      </li>
    </ul>
  </section>
</template>
```

The `<script setup>` block is unchanged. Only the template gets a new flex header wrapping the existing `<h3>` plus the new `<a>`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @lovelacer/web test -- DashboardPreview
```

Expected: 5/5 DashboardPreview tests pass (3 existing + 2 new).

- [ ] **Step 5: Full web suite + typecheck + lint + format**

```bash
pnpm --filter @lovelacer/web test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass.

- [ ] **Step 6: Full workspace test suite**

```bash
pnpm test
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/DashboardPreview.vue \
  packages/web/src/__tests__/components/DashboardPreview.test.ts
git commit -m "feat(web): Download YAML button on Preview screen"
```

---

## Final Verification

- [ ] **Step F1: Full workspace test suite**

```bash
pnpm test
```

Expected: all packages green. Total test count grows by ~12 (5 yaml-export + 5 export route + 2 DashboardPreview).

- [ ] **Step F2: Typecheck + lint + format-check**

```bash
pnpm typecheck && pnpm lint && pnpm format:check
```

Expected: all pass.

- [ ] **Step F3: Manual smoke test (per ROADMAP DoD)**

```bash
pnpm dev:ha   # bring up the dev HA container if not already running
pnpm dev      # start the server + web dev stack
```

In the browser:

1. Open the SPA. Accept the invite if not already accepted.
2. Click Analyze. The Preview section appears with view pills + the new "Download YAML" link.
3. Click Download YAML. Browser downloads `lovelacer-home.yaml`.
4. Open the file in an editor. Verify:
   - Header has three comment lines (version + warning).
   - YAML body has `title:` and `views:`.
   - Long entity ids are unbroken (no line continuation).
5. Either run `ha core check` against the file directly (if `ha` CLI is available), or paste the contents into HA's `lovelace.yaml` (ui-mode) and reload — verify HA accepts the config without parse errors.

That's the AC.

- [ ] **Step F4: Push branch + open PR**

```bash
git push -u origin feat/p2-2-yaml-export
gh pr create --title "feat: P2-2 YAML export" --body "$(cat <<'EOF'
## Summary

- New pure `configToYaml()` in `@lovelacer/generator` wraps `yaml.stringify` with a minimal three-line header and `lineWidth: 0` to keep long entity ids unbroken.
- New `GET /api/export.yaml` reuses `runPreview()` to serialize the current dashboard config as YAML, with `Content-Disposition: attachment; filename="<dashboardUrlPath>.yaml"`.
- Defense-in-depth: route falls back to `lovelacer-home.yaml` if `dashboardUrlPath` doesn't match `^[a-zA-Z0-9_-]+$` (HA's schema already validates upstream; this guards against future schema changes).
- Frontend gets a plain `<a href download>` link in `DashboardPreview.vue` — pure browser-native download, zero JS.

Closes the AC from ROADMAP P2-2: "Downloaded file is valid YAML, equivalent to applied storage config; tested against `ha core check`."

## Test plan

- [x] `pnpm test` — full workspace suite green
- [x] `pnpm typecheck && pnpm lint && pnpm format:check` — all clean
- [ ] Manual smoke per the plan's Step F3 (analyze → download → verify YAML structure → `ha core check` or paste into ui-mode)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope (per spec)

- Export the last-applied snapshot config (separate route or `?source=snapshot` query — future ticket).
- Diff-aware export (header noise; complicates re-export consistency).
- Multi-format export (JSON, Markdown summary).
- Server-side filename customization beyond `dashboardUrlPath`.
