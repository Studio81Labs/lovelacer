# P1a-10 Frontend: minimal Review + Preview + Apply — Design

**Status:** Draft v1 · **Date:** 2026-05-01 · **Ticket:** [P1a-10 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Ship a single-page Vue 3 + Pinia + Tailwind 4 flow inside `@lovelacer/web` that drives the Phase 1a alpha demo: click **Analyze** → see detected rooms with entity counts and confidence summaries → click **Apply** → new dashboard appears in HA. Everything we need to prove the heuristic core works on a real install.

## Non-goals

- Drag-and-drop room/entity reassignment. Reserved for P1b/P2.
- Per-entity overrides or per-card editing. The user accepts what the analyzer produced or doesn't apply.
- Diff against the existing dashboard. P1b can show "X views added, Y removed."
- Routing / multi-page. One `App.vue`, sections appear/disappear with the flow's state.
- i18n. English only for P1a (P2-9 owns SPA localization).
- Authentication / per-user state. Single-user assumption per P1a-8.
- E2E tests. P1a-11 add-on packaging owns the real-HA smoke test.

## Approach summary

A single-page top-down layout: `HealthBar` at the top, an `AnalyzeButton`, then a conditional review section (`RoomList` + `MiscBucket` + `DashboardPreview`) that appears once `analyzeStore.phase === 'ready'`, and an `ApplyBar` at the bottom. Two Pinia stores keep concerns separate — `analyzeStore` owns the `/api/preview` call (yes, we call `/api/preview` not `/api/analyze` because we need both the room list AND the config in one shot), `applyStore` owns the `/api/apply` call. The Apply call always passes the cached config from `analyzeStore.preview.config`, so what-the-user-saw is what gets pushed.

After Apply succeeds, both stores reset, returning the page to the initial "click Analyze" state. User can iterate by re-analyzing.

## Architecture

```
packages/web/src/
  api/
    client.ts                            # NEW: postAnalyze, postPreview, postApply
    types.ts                             # NEW: API response/request shapes (mirrors server pipeline)
  stores/
    analyze.ts                           # NEW: useAnalyzeStore (Pinia)
    apply.ts                             # NEW: useApplyStore (Pinia)
  components/
    HealthBar.vue                        # NEW: extracts existing health UI
    AnalyzeButton.vue                    # NEW
    RoomList.vue                         # NEW
    MiscBucket.vue                       # NEW
    DashboardPreview.vue                 # NEW: pill-card grid with @iconify/vue
    ApplyBar.vue                         # NEW: idle/applying/success/error states
  App.vue                                # MODIFY: composes all of the above
  main.ts                                # unchanged (Pinia already wired)
  __tests__/
    api/client.test.ts                   # NEW
    stores/analyze.test.ts               # NEW
    stores/apply.test.ts                 # NEW
    components/RoomList.test.ts          # NEW
    components/DashboardPreview.test.ts  # NEW
  vitest.config.ts                       # NEW (per the root config's "must ship local" rule)
  package.json                           # MODIFY: add @iconify/vue, @vue/test-utils, happy-dom
```

## Components

### 1. `HealthBar.vue`

Extracts the existing health-check UI from `App.vue` verbatim. Polls `/api/health` once on mount, displays version + HA connection badge. No interaction. Always visible at the top of the page regardless of flow state.

### 2. `AnalyzeButton.vue`

Single button bound to `analyzeStore.phase`:
- `idle` / `error` → "Analyze" label, enabled
- `loading` → "Analyzing…" label, disabled

On click, dispatches `analyzeStore.analyze()`. The button stays mounted across all states — when `phase === 'ready'` and the review section is visible below, the button still works (clicking it re-analyzes, replacing the cached preview with fresh data).

### 3. `RoomList.vue`

Receives `rooms: AnalyzedRoom[]` as a prop. One row per room:

```
[icon]  Kitchen                              22 entities · 95% avg confidence
[icon]  Living Room                          26 entities · 87% avg confidence
[icon]  Bedroom                              20 entities · 81% avg confidence
```

Icon comes from a small `roomIdToIcon(roomId)` helper that mirrors the canonical-room → icon mapping in `packages/generator/src/room-view.ts` (`ROOM_DISPLAY` table). Frontend duplicates ~14 lines rather than fetching from the server. P1b can DRY this up via a shared `@lovelacer/api-types` package.

Confidence pill colored by bucket:
- ≥0.8 → green (`bg-green-100 text-green-800`)
- 0.5–0.8 → amber (`bg-amber-100 text-amber-800`)
- <0.5 → red (`bg-red-100 text-red-800`)

If the input array is empty, renders "No rooms detected — check that your HA install has at least one area assigned to entities or device names matching room patterns."

### 4. `MiscBucket.vue`

Receives `misc: MiscEntity[]` as a prop. Header: "X entities not assigned to any room". Collapsed by default — a `<details>` element with the count in `<summary>`. Expanded shows the entity_id + friendlyName list, one row per entity. Read-only.

If the array is empty, the component renders nothing.

### 5. `DashboardPreview.vue`

Receives `config: LovelaceConfig` as a prop. Renders a horizontal flex-wrap grid of pill cards, one per view:

```
[ 🏠 Home ]  [ 🍳 Kitchen ]  [ 🛋 Living Room ]  [ 🛏 Bedroom ] …
```

Each pill is `<Icon :icon="view.icon" /> <span>{{ view.title }}</span>`. `Icon` comes from `@iconify/vue`. The `view.icon` strings are MDI prefixed (`mdi:silverware-fork-knife`, `mdi:home-variant`, etc.) which Iconify supports natively.

If `config.views` is empty (degenerate — never happens in production since home view is always present), renders nothing.

### 6. `ApplyBar.vue`

Bound to `applyStore.phase` + `applyStore.error` + `applyStore.result`. Four states:

| Phase | Render |
| --- | --- |
| `idle` | Big "Apply to Home Assistant" button. Click dispatches `applyStore.apply(analyzeStore.preview.config)`. |
| `applying` | Same button, disabled, "Applying…" label. |
| `success` | Green banner: "Dashboard `lovelacer-home` created" (or "updated" if `result.created === false`). "Done — start over" button → calls `analyzeStore.reset()` + `applyStore.reset()`. Auto-dismisses after 5s with the same reset effect. |
| `error` | Red banner with structured error message (see Error handling). "Retry" button re-dispatches `apply(config)` with the same cached config. |

When the success auto-dismiss fires, the page returns to the initial "click Analyze" state since both stores reset. The user can re-analyze immediately.

### 7. `App.vue`

Top-down conditional layout:

```vue
<HealthBar />
<AnalyzeButton />

<section v-if="analyze.phase === 'error'">
  <ErrorBanner :error="analyze.error" @retry="analyze.analyze()" />
</section>

<section v-if="analyze.phase === 'ready' && analyze.preview">
  <RoomList :rooms="analyze.preview.rooms" />
  <MiscBucket :misc="analyze.preview.misc" />
  <DashboardPreview :config="analyze.preview.config" />
  <ApplyBar />
</section>
```

The analyze-level error banner is inline in `App.vue` (not its own component) since it's only used here. ApplyBar reads/writes its own store but pulls `analyzeStore.preview.config` at click time — keeps the stores' import graph clean (apply doesn't import analyze).

## API client + types

### `api/types.ts`

```ts
export interface RoomAssignment {
  entityId: string
  roomId: string
  confidence: number
  signals: { source: string; weight: number; matchedValue?: string }[]
}

export interface AnalyzedRoom {
  id: string
  haAreaId: string | null
  displayName: string
  entityCount: number
  averageConfidence: number
  assignments: RoomAssignment[]
}

export interface MiscEntity {
  entityId: string
  friendlyName: string
  domain: string
}

export interface PreviewSummary {
  entityCount: number
  roomCount: number
  miscCount: number
}

export interface LovelaceView {
  type: string
  title: string
  path: string
  icon: string
  sections?: unknown[]
}

export interface LovelaceConfig {
  title: string
  views: LovelaceView[]
}

export interface PreviewOutput {
  rooms: AnalyzedRoom[]
  misc: MiscEntity[]
  summary: PreviewSummary
  config: LovelaceConfig
}

export interface ApplyResult {
  ok: true
  urlPath: string
  created: boolean
}

export interface ApiError {
  error: string         // 'ha_unavailable' | 'analyze_failed' | 'preview_failed' | 'invalid_config' | 'ha_apply_failed' | 'apply_failed' | 'network'
  step?: string         // 'list' | 'create' | 'save' for ha_apply_failed
  message: string
}
```

These mirror what the server returns. Defining them in the web package rather than importing from `@lovelacer/server` avoids dragging Fastify's deps into the browser bundle. P1b extracts these into `@lovelacer/api-types` (or expands `@lovelacer/shared`).

### `api/client.ts`

Three exports — `postAnalyze`, `postPreview`, `postApply`. Each is a thin wrapper around `fetch()`:

```ts
export async function postPreview(): Promise<PreviewOutput> {
  let res: Response
  try {
    res = await fetch('api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (cause) {
    throw { error: 'network', message: String(cause) } satisfies ApiError
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    if (body && typeof body.error === 'string') throw body satisfies ApiError
    throw {
      error: 'network',
      message: `HTTP ${res.status}`,
    } satisfies ApiError
  }

  return res.json()
}

export async function postApply(body: { config: LovelaceConfig }): Promise<ApplyResult> {
  let res: Response
  try {
    res = await fetch('api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (cause) {
    throw { error: 'network', message: String(cause) } satisfies ApiError
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    if (body && typeof body.error === 'string') throw body satisfies ApiError
    throw {
      error: 'network',
      message: `HTTP ${res.status}`,
    } satisfies ApiError
  }

  return res.json()
}
```

`postAnalyze` follows the same pattern. URL is document-relative (no leading slash) per the existing `App.vue` comment about HA add-on ingress prefixes.

`postPreview` is the call we actually use — `postAnalyze` is exported for symmetry but currently unused (P1b may want it for a "quick analyze without preview" affordance).

## Stores

### `stores/analyze.ts`

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { postPreview } from '../api/client.js'
import type { ApiError, PreviewOutput } from '../api/types.js'

type Phase = 'idle' | 'loading' | 'ready' | 'error'

export const useAnalyzeStore = defineStore('analyze', () => {
  const phase = ref<Phase>('idle')
  const preview = ref<PreviewOutput | null>(null)
  const error = ref<ApiError | null>(null)

  async function analyze() {
    phase.value = 'loading'
    error.value = null
    try {
      preview.value = await postPreview()
      phase.value = 'ready'
    } catch (err) {
      error.value = err as ApiError
      preview.value = null
      phase.value = 'error'
    }
  }

  function reset() {
    phase.value = 'idle'
    preview.value = null
    error.value = null
  }

  return { phase, preview, error, analyze, reset }
})
```

### `stores/apply.ts`

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { postApply } from '../api/client.js'
import type { ApiError, ApplyResult, LovelaceConfig } from '../api/types.js'

type Phase = 'idle' | 'applying' | 'success' | 'error'

export const useApplyStore = defineStore('apply', () => {
  const phase = ref<Phase>('idle')
  const result = ref<ApplyResult | null>(null)
  const error = ref<ApiError | null>(null)

  async function apply(config: LovelaceConfig) {
    phase.value = 'applying'
    error.value = null
    try {
      result.value = await postApply({ config })
      phase.value = 'success'
    } catch (err) {
      error.value = err as ApiError
      result.value = null
      phase.value = 'error'
    }
  }

  function reset() {
    phase.value = 'idle'
    result.value = null
    error.value = null
  }

  return { phase, result, error, apply, reset }
})
```

`applyStore` doesn't import `analyzeStore` — the component layer wires them together at click time.

## Data flow

```
Page mount
  HealthBar.vue → fetch('api/health') → render version + HA status

User clicks "Analyze"
  AnalyzeButton.vue → analyzeStore.analyze()
    phase = 'loading'
    api.postPreview() → POST /api/preview
                        ← { rooms, misc, summary, config }
    preview = response
    phase = 'ready'
  ↓
  App.vue's v-if section appears:
    RoomList renders preview.rooms
    MiscBucket renders preview.misc
    DashboardPreview renders preview.config.views
    ApplyBar renders 'idle' state

User clicks "Apply to Home Assistant"
  ApplyBar.vue → applyStore.apply(analyzeStore.preview.config)
    phase = 'applying'
    api.postApply({ config }) → POST /api/apply { config }
                                ← { ok: true, urlPath, created }
    result = response
    phase = 'success'
  ↓
  ApplyBar shows green banner with urlPath + Done button
  5s timer (or click Done) → analyzeStore.reset() + applyStore.reset()
  ↓
  Page back to initial state, AnalyzeButton ready again
```

**Cached config:** `applyStore.apply()` always receives the config from `analyzeStore.preview.config` — never re-fetches. What-you-saw-is-what-you-get. If the user wants fresh data they click "Done — start over" and re-analyze.

## Error handling

| Layer | Failure | Behavior |
| --- | --- | --- |
| `api/client` | Network error (fetch rejects) | Throws `ApiError({ error: 'network', message })`. |
| `api/client` | Non-2xx response with structured body | Parses server's `{ error, step?, message }` JSON; throws as-is. |
| `api/client` | Non-JSON response | Throws `ApiError({ error: 'network', message: 'HTTP <code>' })`. |
| `analyzeStore` | Any failure | `phase = 'error'`, `error = ApiError`, `preview = null`. |
| `applyStore` | Any failure | `phase = 'error'`, `error = ApiError`, `result = null`. |
| `App.vue` | `analyzeStore.phase === 'error'` | Inline red banner with `error.message`. "Retry" re-dispatches `analyze()`. |
| `ApplyBar` | `error.error === 'ha_unavailable'` (503) | Banner: "Home Assistant is not connected. Check the HA connection bar at the top." No retry button — user fixes connectivity, then clicks Apply themselves. |
| `ApplyBar` | `error.error === 'invalid_config'` (400) | Banner: "Cached config is invalid. Click 'Start over' to re-analyze." Click triggers both stores' `reset()`. |
| `ApplyBar` | `error.error === 'ha_apply_failed'` (502) | Banner: "Apply failed at step `<step>`: `<message>`". "Retry" re-dispatches `apply(config)` with the same cached config. |
| `ApplyBar` | Any other error | Generic banner with `error.message`. "Retry" re-dispatches. |
| `HealthBar` | `/api/health` fails | "Backend unreachable: <message>" (existing behavior preserved). |

No silent failures. Every error path produces a visible message with a clear next action.

## Testing

### `__tests__/api/client.test.ts` — unit (~6 tests)

Mock `globalThis.fetch` with `vi.fn()`.

- `postPreview` 200 → returns parsed body.
- `postPreview` 503 with `{ error: 'ha_unavailable' }` → throws `ApiError` with that shape.
- `postApply` sends the right body (`{ config }`) and the right URL/method/headers.
- `postApply` 502 with `{ error: 'ha_apply_failed', step: 'save', message }` → throws with `step` preserved.
- Network rejection (fetch throws) → throws `ApiError({ error: 'network' })`.
- Non-JSON 500 response → throws `ApiError({ error: 'network', message: 'HTTP 500' })`.

### `__tests__/stores/analyze.test.ts` — unit (~5 tests)

Pinia setup with `setActivePinia(createPinia())`. Mock the `api/client` module via `vi.mock`.

- Initial state: `phase === 'idle'`, `preview === null`, `error === null`.
- `analyze()` happy path → calls `postPreview`, transitions `loading → ready`, populates `preview`.
- `analyze()` error path → transitions `loading → error`, populates `error`, leaves `preview` null.
- `reset()` → returns to idle, clears all fields.
- Re-running `analyze()` after a prior error clears `error` before the new fetch.

### `__tests__/stores/apply.test.ts` — unit (~5 tests)

Same Pinia pattern.

- Initial state.
- `apply(config)` happy path → calls `postApply` with `{ config }`, transitions `applying → success`, populates `result`.
- `apply(config)` 502 path → transitions to `error`, error has `step: 'save'`.
- `apply(config)` 400 (invalid_config) path → error preserved, available to UI.
- `reset()` clears all fields.

### `__tests__/components/RoomList.test.ts` — `@vue/test-utils` (~4 tests)

- Renders one row per room.
- Confidence pill class flips by bucket (`>=0.8` → green, `0.5–0.8` → amber, `<0.5` → red).
- Shows `entityCount` formatted as "N entities".
- Empty rooms array → renders the placeholder string.

### `__tests__/components/DashboardPreview.test.ts` — `@vue/test-utils` (~3 tests)

- Renders one pill per view in input order.
- Pill contains the view title and an Iconify `<Icon>` with the correct `:icon` prop.
- Empty views → renders nothing (component still mounts without crashing).

### What's NOT tested

- `HealthBar.vue` — unchanged behavior, covered by manual testing.
- `AnalyzeButton.vue`, `MiscBucket.vue`, `ApplyBar.vue` — thin glue components covered by store tests + integration in P1a-11 smoke test.
- `App.vue` composition — covered by P1a-11 smoke test.
- E2E flow — P1a-11 (real HA, real browser).

**Total: ~23 tests across 5 files.** Vitest + `@vue/test-utils` + `happy-dom`. All packages already in workspace except `happy-dom` and `@vue/test-utils` (added to `packages/web/devDependencies`).

## File-by-file

| File | Action | Notes |
| --- | --- | --- |
| `packages/web/src/api/types.ts` | Create | API types (mirror server pipeline output) |
| `packages/web/src/api/client.ts` | Create | `postAnalyze`, `postPreview`, `postApply` |
| `packages/web/src/stores/analyze.ts` | Create | Pinia setup-style store |
| `packages/web/src/stores/apply.ts` | Create | Pinia setup-style store |
| `packages/web/src/components/HealthBar.vue` | Create | Existing health UI, extracted |
| `packages/web/src/components/AnalyzeButton.vue` | Create | |
| `packages/web/src/components/RoomList.vue` | Create | |
| `packages/web/src/components/MiscBucket.vue` | Create | |
| `packages/web/src/components/DashboardPreview.vue` | Create | Iconify pill grid |
| `packages/web/src/components/ApplyBar.vue` | Create | Idle/applying/success/error states |
| `packages/web/src/App.vue` | Modify | Compose components, add v-if sections |
| `packages/web/src/__tests__/api/client.test.ts` | Create | |
| `packages/web/src/__tests__/stores/analyze.test.ts` | Create | |
| `packages/web/src/__tests__/stores/apply.test.ts` | Create | |
| `packages/web/src/__tests__/components/RoomList.test.ts` | Create | |
| `packages/web/src/__tests__/components/DashboardPreview.test.ts` | Create | |
| `packages/web/vitest.config.ts` | Create | Per the root config's "must ship local" rule |
| `packages/web/package.json` | Modify | Add `@iconify/vue`, `@vue/test-utils`, `happy-dom` |

## Dependencies

New runtime dep: `@iconify/vue` (~30 KB gzip with on-demand icon loading from a CDN, or ~10 KB if we ship the MDI icon set as a static asset).

New devDeps:
- `@vue/test-utils` — Vue component testing
- `happy-dom` — fast DOM-in-Node implementation, faster than jsdom

No backend changes. The server's `/api/analyze`, `/api/preview`, `/api/apply` already return the shapes this design depends on (P1a-8 spec §AnalyzeOutput, §PreviewOutput).

## Open questions resolved during brainstorming

- **Page flow shape (Q1):** Single page with sections appearing as state advances. No router, no wizard, no tabs.
- **API call count (Q2):** Two calls — `/api/preview` (returns analyze output + config) then `/api/apply` with cached config. Stateless apply mode.
- **Preview UI shape (Q3):** Pill cards with Iconify icons rendering each view's `title` + `icon`.
- **Apply success UX (Q4):** Banner + auto-reset after 5s. User can re-analyze freely.
- **Pinia store structure (Q5):** Two stores (`analyzeStore`, `applyStore`), decoupled at the import level, wired together by the component layer.

## Risks

- **Iconify CDN at runtime.** `@iconify/vue` fetches MDI icons lazily from `api.iconify.design` by default. In an offline HA install this would fail to render icons. Mitigation: bundle the MDI icon set statically (`@iconify-json/mdi` package + `addCollection` at startup). Adds ~50 KB gzip but eliminates the CDN dependency. Decided in implementation; default to bundled.
- **API type drift.** The locally-defined `api/types.ts` can fall out of sync with the server's pipeline output. Mitigation: P1b extracts a shared `@lovelacer/api-types` package. For P1a, the snapshot tests on the server side catch shape changes; the frontend type errors caught during `pnpm typecheck` flag any drift in fields the components use.
- **Reset timing.** The 5-second auto-dismiss timer could surprise a user who's reading the success banner. Mitigation: the "Done — start over" button is always visible during success; if the user dismisses manually, the timer is cleared. Acceptable for P1a alpha.
- **Re-analyze while applying.** If the user clicks Analyze while `applyStore.phase === 'applying'`, the store resets analyze state but apply is still in flight. Mitigation: AnalyzeButton disables itself when `applyStore.phase === 'applying'` (component reads both stores).

## Acceptance

P1a-10 closes when:

- [ ] `npm run dev` against a running server (P1a-8) renders the full flow: Analyze → Review → Apply → success banner → auto-reset.
- [ ] All ~23 unit tests passing.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm lint` clean across the whole workspace.
- [ ] No real-HA integration test (P1a-11 owns that).
- [ ] Frontend types defined locally; no import from `@lovelacer/server`.
