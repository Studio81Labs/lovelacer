# P1a-8 Storage-mode Apply (combines original P1a-8 + P1a-9) — Design

**Status:** Draft v1 · **Date:** 2026-05-01 · **Ticket:** [P1a-8 + P1a-9 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Ship the apply pipeline end-to-end. Wrap the analyzer + generator output into a full HA Lovelace dashboard config and push it to a running HA instance via storage-mode WebSocket calls. Wire three Fastify routes (`/api/analyze`, `/api/preview`, `/api/apply`) so a frontend (P1a-10) can drive the full flow.

This collapses the original P1a-8 ("Storage-mode apply") and P1a-9 ("API routes") into one ticket — they're tightly coupled and there's no value in shipping the apply mechanics without the routes that exercise them.

## Non-goals

- Frontend UI. P1a-10 builds the minimal Review + Preview + Apply screen on top of these routes.
- YAML mode export. P1a-9's secondary path lives in P2.
- Idempotency beyond "update existing dashboard with same `url_path`". P1b can add diff/preview-of-changes.
- Per-card validation of the user-supplied `LovelaceConfig` on `/api/apply`. We do a minimal shape check (`title: string`, `views: array`); HA itself rejects malformed cards in `config/save`.
- Rollback when `config/save` fails on a freshly-created dashboard. The dashboard exists empty; the user re-runs Apply or deletes it manually. Rollback adds risk for an alpha.
- Authentication / multi-tenant. Single-user assumption. The HA token comes from server config (`HA_TOKEN` or supervisor-injected `SUPERVISOR_TOKEN`).
- Retry/backoff inside apply. The HaClient's `setupRetry: -1` already handles connection drops; if a WS call fails mid-apply the route returns 502 and the user retries.

## Approach summary

`buildLovelaceConfig({ home, rooms })` in `@lovelacer/generator` produces the `{ title, views }` envelope HA expects. Rooms are sorted alphabetically by view title using `localeCompare(_, 'en')` (matching the P1a-5 comparator). The home view always goes first.

`HaClient.applyDashboard(config, options)` in `@lovelacer/ha-client` performs the three-call WS sequence (`lovelace/dashboards/list` → `dashboards/create` if missing → `config/save`). Returns `{ urlPath, created: boolean }`. Throws `HaApplyError({ step, cause })` on first failure.

A shared `pipeline.ts` in `@lovelacer/server` exposes `runAnalyze`, `runPreview`, `runApply` that route handlers wrap thinly. `/api/apply` accepts an optional `config` body — if present, it's pushed directly; if absent, the server re-runs `runPreview` and pushes its output. This hybrid mode lets P1a-10 either preview-then-apply (stateless, edit-friendly) or one-click apply.

## Architecture

```
packages/generator/src/
  lovelace-config.ts                                 # NEW
  __tests__/lovelace-config.test.ts                  # NEW
  __tests__/lovelace-config.fixtures.test.ts         # NEW
  index.ts                                           # MODIFY: re-export

packages/ha-client/src/
  dashboards.ts                                      # NEW: types + HaApplyError
  client.ts                                          # MODIFY: add applyDashboard, listDashboards
  __tests__/dashboards.test.ts                       # NEW
  index.ts                                           # MODIFY: re-export

packages/server/src/
  pipeline.ts                                        # NEW: runAnalyze, runPreview, runApply
  routes/
    analyze.ts                                       # NEW
    preview.ts                                       # NEW
    apply.ts                                         # NEW
  main.ts                                            # MODIFY: wire routes
  __tests__/
    pipeline.test.ts                                 # NEW
    routes/analyze.test.ts                           # NEW
    routes/preview.test.ts                           # NEW
    routes/apply.test.ts                             # NEW
```

## Components

### 1. `LovelaceConfig` type and `buildLovelaceConfig` in generator

```ts
import type { HomeView } from './home-view.js'
import type { RoomView } from './lovelace-types.js'

export interface LovelaceConfig {
  title: string
  views: (HomeView | RoomView)[]
}

export interface BuildLovelaceConfigInput {
  home: HomeView
  rooms: RoomView[]
}

export function buildLovelaceConfig(input: BuildLovelaceConfigInput): LovelaceConfig {
  const sortedRooms = [...input.rooms].sort((a, b) => a.title.localeCompare(b.title, 'en'))
  return {
    title: 'Lovelacer — Home',
    views: [input.home, ...sortedRooms],
  }
}
```

Pure function. Title constant is the literal `'Lovelacer — Home'` (em dash, U+2014). Rooms sorted alphabetically by view title; home always first.

### 2. `HaClient.applyDashboard` + `listDashboards` in ha-client

```ts
// dashboards.ts (new file)
export interface ApplyDashboardOptions {
  urlPath?: string         // default 'lovelacer-home'
  title?: string           // default 'Lovelacer — Home'
  icon?: string            // default 'mdi:home-variant'
  showInSidebar?: boolean  // default true
  requireAdmin?: boolean   // default false
}

export interface ApplyDashboardResult {
  urlPath: string
  created: boolean   // true: freshly created, false: updated existing
}

export interface HaDashboardEntry {
  id: string
  url_path: string
  title: string
  icon: string | null
  show_in_sidebar: boolean
  require_admin: boolean
  mode: 'storage' | 'yaml'
}

export class HaApplyError extends Error {
  readonly step: 'list' | 'create' | 'save'
  readonly cause: unknown
  constructor(step: HaApplyError['step'], message: string, cause: unknown) {
    super(message)
    this.name = 'HaApplyError'
    this.step = step
    this.cause = cause
  }
}

const DEFAULT_OPTIONS = {
  urlPath: 'lovelacer-home',
  title: 'Lovelacer — Home',
  icon: 'mdi:home-variant',
  showInSidebar: true,
  requireAdmin: false,
} as const
```

```ts
// client.ts (additions to HaClient class)
async listDashboards(): Promise<HaDashboardEntry[]> {
  return this.send<HaDashboardEntry[]>({ type: 'lovelace/dashboards/list' })
}

async applyDashboard(
  config: LovelaceConfig,
  options?: ApplyDashboardOptions,
): Promise<ApplyDashboardResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  let dashboards: HaDashboardEntry[]
  try {
    dashboards = await this.listDashboards()
  } catch (cause) {
    throw new HaApplyError('list', 'failed to list HA dashboards', cause)
  }

  const existing = dashboards.find((d) => d.url_path === opts.urlPath)
  if (existing === undefined) {
    try {
      await this.send({
        type: 'lovelace/dashboards/create',
        url_path: opts.urlPath,
        title: opts.title,
        icon: opts.icon,
        show_in_sidebar: opts.showInSidebar,
        require_admin: opts.requireAdmin,
        mode: 'storage',
      })
    } catch (cause) {
      throw new HaApplyError('create', `failed to create dashboard ${opts.urlPath}`, cause)
    }
  }

  try {
    await this.send({
      type: 'lovelace/config/save',
      url_path: opts.urlPath,
      config,
    })
  } catch (cause) {
    throw new HaApplyError('save', `failed to save dashboard config for ${opts.urlPath}`, cause)
  }

  return { urlPath: opts.urlPath, created: existing === undefined }
}
```

### 3. Pipeline functions (`packages/server/src/pipeline.ts`)

```ts
import type { HaClient } from '@lovelacer/ha-client'
import type { ApplyDashboardOptions, ApplyDashboardResult } from '@lovelacer/ha-client'
import type { LovelaceConfig } from '@lovelacer/generator'
import type { AnalyzedRoom } from '@lovelacer/shared'

export interface AnalyzeOutput {
  rooms: AnalyzedRoom[]                                    // alphabetical by displayName
  misc: { entityId: string; friendlyName: string; domain: string }[]
  summary: { entityCount: number; roomCount: number; miscCount: number }
}

export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
}

export interface ApplyInput {
  config?: LovelaceConfig
  options?: ApplyDashboardOptions
}

export async function runAnalyze(ha: HaClient): Promise<AnalyzeOutput>
export async function runPreview(ha: HaClient): Promise<PreviewOutput>
export async function runApply(ha: HaClient, body: ApplyInput): Promise<ApplyDashboardResult>
```

Implementations:

`runAnalyze`:
1. Parallel fetch entity/device/area registries via `HaClient`.
2. `normalize({ entities, devices })`.
3. Build `DetectionContext` from areas + assignments-from-entity-areas; run `detect({ entities, context })`.
4. `groupByDomain({ assignments, entities })` → produces `RoomGrouping[]`.
5. Map `RoomGrouping[]` to `AnalyzedRoom[]` (one per room with assignments expanded). `displayName` comes from the area registry; `entityCount` and `averageConfidence` are computed from the assignments.
6. Identify the misc bucket: entities whose `RoomAssignment.roomId === 'misc'` (the analyzer's existing fallback room id). These are returned as a separate `misc[]` array on the response — they don't get their own dashboard view.
7. Sort rooms by `displayName` using `localeCompare(_, 'en')`. Filter out the misc room from the rooms array (it surfaces only via the `misc[]` field).

`runPreview`:
1. Call `runAnalyze`.
2. `buildHomeView({ entities: <flat list of all normalized entities> })`.
3. `buildRoomViews(<RoomGrouping[]>)`.
4. `buildLovelaceConfig({ home, rooms })`.
5. Return `{ ...analyzeOutput, config }`.

`runApply`:
1. `finalConfig = body.config ?? (await runPreview(ha)).config`.
2. `return ha.applyDashboard(finalConfig, body.options)`.

`runApply` validates `body.config` if provided: throws `400` (caught by route → `400 invalid_config`) if `typeof config.title !== 'string' || !Array.isArray(config.views)`.

### 4. Routes (`packages/server/src/routes/`)

Each route is a thin Fastify plugin: validate request → call pipeline → shape response.

**`analyze.ts`:**

```ts
app.post('/api/analyze', async (req, reply) => {
  if (!ha.isConnected()) return reply.code(503).send({ error: 'ha_unavailable', message: '...' })
  try {
    const result = await runAnalyze(ha)
    return reply.code(200).send(result)
  } catch (err) {
    req.log.error({ err }, 'analyze failed')
    return reply.code(500).send({ error: 'analyze_failed', message: String(err) })
  }
})
```

**`preview.ts`:** same shape, calls `runPreview`.

**`apply.ts`:** accepts optional body `{ config?, options? }`, validates shape if config present, calls `runApply`, branches on `HaApplyError` to return `502 ha_apply_failed` with `step`.

### 5. `main.ts` integration

Drop the three `notImplemented()` placeholders. Register the route plugins, passing the HaClient instance. The HaClient is shared across the process; routes don't reconnect.

## Data flow

```
POST /api/analyze
  ┌─────────────────────────────────────┐
  │ ha.getEntityRegistry()              │ Promise.all
  │ ha.getDeviceRegistry()              │
  │ ha.getAreaRegistry()                │
  └────────────┬────────────────────────┘
               ↓
         normalize
               ↓
   buildDetectionContext + detect (per-entity, with corroboration boost)
               ↓
        groupByDomain
               ↓
   map RoomGrouping → AnalyzedRoom[] (alphabetical)
               ↓
         compute misc bucket, summary
               ↓
   { rooms, misc, summary }


POST /api/preview
   runAnalyze → { rooms, misc, summary, allEntities }
               ↓
   buildHomeView({ entities: allEntities })
   buildRoomViews(<RoomGrouping[]>)
               ↓
   buildLovelaceConfig({ home, rooms }) → LovelaceConfig
               ↓
   { rooms, misc, summary, config }


POST /api/apply { config?, options? }
   if config: validate shape (title: string, views: array)
   else:      runPreview → use its config
               ↓
   ha.applyDashboard(finalConfig, options)
     listDashboards()
     if !exists: dashboards/create
     config/save
               ↓
   { ok: true, urlPath, created }
```

## Error handling

| Layer | Failure | Behavior |
| --- | --- | --- |
| HaClient WS calls | Connection drop mid-call | `sendMessagePromise` rejects → caller catches and re-throws as `HaApplyError(step, cause)` |
| HaClient WS calls | HA returns error response | Same — rejects with HA's error message |
| `applyDashboard` | First failure of any of 3 calls | Throws `HaApplyError({ step, cause })`. No retry, no rollback. |
| `runAnalyze` | Registry call fails | Bubbles up. Route returns 503 `{ error: 'ha_unavailable', message }`. |
| `runApply` | `body.config` provided but malformed | Route returns 400 `{ error: 'invalid_config', message }`. Manual shape check; no zod. |
| `runApply` | HaClient not connected | 503 `{ error: 'ha_unavailable' }`. |
| Route | Pipeline throws `HaApplyError` | 502 `{ error: 'ha_apply_failed', step, message }`. |
| Route | Anything else | Fastify default 500. |

No silent failures. Every error path produces a structured response with a discriminator the frontend can branch on.

**Config validation on `/api/apply`:**
- `typeof body.config.title === 'string'`
- `Array.isArray(body.config.views)`
- (Card-level shape: not validated here; HA rejects in `config/save` and bubbles up as `step: 'save'`.)

## Testing

### `generator/src/__tests__/lovelace-config.test.ts` — unit (~10 tests)

- Empty rooms → `{ title: 'Lovelacer — Home', views: [home] }`.
- 3 rooms with titles 'Bedroom', 'Kitchen', 'Living Room' → home first, rooms in order Bedroom, Kitchen, Living Room.
- Mixed-case titles sort case-insensitive via `localeCompare(_, 'en')`.
- Czech-ish titles ('Žofie', 'Anička') sort with English locale rules (sorts after 'Z' for 'Žofie' since 'en' locale treats Ž as 'Z').
- Title constant is exactly `'Lovelacer — Home'` (em dash).
- Pure function: same input → identical output.
- Doesn't mutate input arrays (original `rooms` order preserved after call).

### `generator/src/__tests__/lovelace-config.fixtures.test.ts` — fixture snapshot (~3 tests)

Pipe `english-cluttered` and `czech-tidy` through the full pipeline:
`fixtureToHaRegistries → normalize → detect → groupByDomain → buildHomeView + buildRoomViews → buildLovelaceConfig`.

Lock structural snapshot per fixture: title, view count, view titles + paths. Anti-regression: every view path is unique.

### `ha-client/src/__tests__/dashboards.test.ts` — unit with mocked Connection (~12 tests)

Strategy: stub `connection.sendMessagePromise(msg)` with `vi.fn().mockResolvedValueOnce(...)` per WS call. Tests verify both the messages sent and the result.

- `applyDashboard` when dashboard missing → sends `dashboards/list`, then `dashboards/create` with the right options object, then `config/save`. Returns `{ urlPath, created: true }`.
- `applyDashboard` when dashboard exists (matching `url_path`) → skips create, just `config/save`. Returns `{ created: false }`.
- Custom options override defaults (`urlPath`, `title`, `icon`, `showInSidebar`, `requireAdmin`).
- Default options applied when `options` is undefined.
- Default options applied for omitted-but-not-undefined fields (e.g., `{ urlPath: 'foo' }` keeps default `title`).
- WS error on `dashboards/list` → throws `HaApplyError({ step: 'list', cause })`. No further calls made.
- WS error on `dashboards/create` → throws `HaApplyError({ step: 'create' })`. No `config/save` called.
- WS error on `config/save` → throws `HaApplyError({ step: 'save' })`.
- `HaApplyError` exposes `step` and `cause`.
- Not connected → throws "not connected" before any WS call.
- `listDashboards` returns the array as-is from HA.

### `server/src/__tests__/pipeline.test.ts` — unit with fake HaClient (~6 tests)

Strategy: fake HaClient with `vi.fn()` for each registry getter + `applyDashboard`. Inject canned registry data (a small synthetic fixture or one of the existing fixtures via `fixtureToHaRegistries`).

- `runAnalyze` returns rooms (alphabetical by `displayName`), misc, summary counts match.
- `runPreview` includes `config` with `views[0]` being the home view (`path === 'home'`) and remaining views in alphabetical order by title.
- `runApply` with `body.config` → calls `applyDashboard` with that config, doesn't call any registry getters.
- `runApply` without `body.config` → calls registry getters (re-runs preview), then `applyDashboard`.
- `runApply` propagates `HaApplyError` (re-throws unchanged for the route to catch).
- `runApply` with malformed `body.config` (missing `views`) → throws a typed validation error before calling `applyDashboard`.

### `server/src/__tests__/routes/{analyze,preview,apply}.test.ts` — Fastify inject (~12 tests total)

Strategy: build a Fastify app instance with a fake HaClient (same pattern as pipeline tests). Use `app.inject({ method, url, payload })`.

**`analyze.test.ts`:**
- `POST /api/analyze` happy path → 200 with `{ rooms, misc, summary }`.
- HA disconnected → 503 `{ error: 'ha_unavailable' }`.
- Pipeline throws → 500 `{ error: 'analyze_failed' }`.

**`preview.test.ts`:**
- `POST /api/preview` happy path → 200 with `{ rooms, misc, summary, config }`. `config.views[0].path === 'home'`.
- HA disconnected → 503.

**`apply.test.ts`:**
- `POST /api/apply` with no body → 200 (re-runs preview, applies its config). `applyDashboard` called once.
- `POST /api/apply` with `{ config: validConfig }` → 200, `applyDashboard` called with that config (registry getters NOT called).
- `POST /api/apply` with `{ config: { title: 123 } }` → 400 `{ error: 'invalid_config' }`.
- `POST /api/apply` with `HaApplyError({ step: 'save' })` → 502 `{ error: 'ha_apply_failed', step: 'save' }`.
- HA disconnected → 503.

**Total: ~40 tests across 6 files.** No real HA, no integration tests. P1a-11 (add-on packaging) covers the real-HA smoke test during demo.

## File-by-file

| File | Action | Notes |
| --- | --- | --- |
| `packages/generator/src/lovelace-config.ts` | Create | `LovelaceConfig`, `BuildLovelaceConfigInput`, `buildLovelaceConfig` |
| `packages/generator/src/__tests__/lovelace-config.test.ts` | Create | Unit tests |
| `packages/generator/src/__tests__/lovelace-config.fixtures.test.ts` | Create | Fixture-driven snapshot |
| `packages/generator/src/index.ts` | Modify | Re-export new types/functions |
| `packages/ha-client/src/dashboards.ts` | Create | Apply types, `HaApplyError`, `DEFAULT_OPTIONS` constant |
| `packages/ha-client/src/client.ts` | Modify | Add `listDashboards` and `applyDashboard` methods |
| `packages/ha-client/src/__tests__/dashboards.test.ts` | Create | Unit tests with mocked Connection |
| `packages/ha-client/src/index.ts` | Modify | Re-export public surface |
| `packages/server/src/pipeline.ts` | Create | `runAnalyze`, `runPreview`, `runApply`, output types |
| `packages/server/src/routes/analyze.ts` | Create | Fastify plugin |
| `packages/server/src/routes/preview.ts` | Create | Fastify plugin |
| `packages/server/src/routes/apply.ts` | Create | Fastify plugin (with config validation) |
| `packages/server/src/main.ts` | Modify | Wire route plugins, drop `notImplemented` stubs |
| `packages/server/src/__tests__/pipeline.test.ts` | Create | Pipeline unit tests with fake HaClient |
| `packages/server/src/__tests__/routes/analyze.test.ts` | Create | Fastify inject |
| `packages/server/src/__tests__/routes/preview.test.ts` | Create | Fastify inject |
| `packages/server/src/__tests__/routes/apply.test.ts` | Create | Fastify inject |

## Dependencies

- `@lovelacer/shared` — `AnalyzedRoom`, `RoomAssignment`, `NormalizedEntity` types (already exists).
- `@lovelacer/analyzer` — `normalize`, `detect`, `buildDetectionContext`, `groupByDomain` (already exists; pipeline composes these).
- `@lovelacer/generator` — `buildHomeView`, `buildRoomViews`, plus the new `buildLovelaceConfig` (this ticket).
- `@lovelacer/ha-client` — existing registry getters, plus the new `applyDashboard` and `listDashboards` (this ticket).
- No new runtime deps. Vitest is already in the workspace; Fastify's `inject()` is built-in. `@lovelacer/generator` is already in `packages/server/package.json`.
- `zod` is already in server deps but we don't use it here — the apply config check is two fields and manual is simpler. Future per-card validation (P1b) can adopt zod or refine the existing types.

## Open questions resolved during brainstorming

- **Scope (Q1):** P1a-8 + P1a-9 collapse into one ticket. The two tickets are tightly coupled.
- **Apply mode (Q2):** Hybrid. `/api/apply` accepts optional config body OR re-runs server-side.
- **Testing (Q3):** Unit tests with mocked `Connection`. No real HA in CI.
- **Dashboard identity (Q4):** Configurable via `ApplyDashboardOptions`, with sensible defaults.
- **Room ordering (Q5):** Alphabetical by view title, `localeCompare(_, 'en')`.
- **Response shape (Q6):** Full entity list per room (no second call needed for details).
- **Error handling (Q7):** Fail-fast with structured `HaApplyError({ step, cause })`.

## Risks

- **HA storage-mode WS schema changes.** `lovelace/dashboards/create` and `config/save` are stable APIs but HA can rev them. Mitigation: P1a-11 add-on packaging includes a manual smoke test on a real HA dev instance. If the schema drifts, the unit tests still pass (mocked Connection) but the smoke test catches it.
- **Misc bucket > 30%.** The roadmap calls this out as a hard signal: if our heuristic core can't classify > 70% of a real install, we stop and rework. P1a-11 demo is the test.
- **Pipeline orchestration coupling.** `runAnalyze` composes 4 analyzer functions in order. If any of them changes signature later, the pipeline breaks. Mitigation: pipeline is small (~50 LOC), and the analyzer's exported types catch most signature drift at compile time.
- **`applyDashboard` partial-failure: dashboard created but `config/save` fails.** The dashboard exists empty; the user re-runs and the next attempt skips create and saves. We documented this as acceptable above; the alternative (rolling back via `dashboards/delete`) adds risk for an alpha.

## Acceptance

P1a-8 closes when:

- [ ] `buildLovelaceConfig`, `LovelaceConfig`, `BuildLovelaceConfigInput` exported from `@lovelacer/generator`.
- [ ] `applyDashboard`, `listDashboards`, `ApplyDashboardOptions`, `ApplyDashboardResult`, `HaDashboardEntry`, `HaApplyError` exported from `@lovelacer/ha-client`.
- [ ] `/api/analyze`, `/api/preview`, `/api/apply` routes wired and returning the documented shapes.
- [ ] All ~40 unit tests passing.
- [ ] Fixture snapshot tests passing for both `english-cluttered` and `czech-tidy`.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm lint` clean.
- [ ] No real-HA test infrastructure introduced (P1a-11 owns that).
