# P1b-4 — Frontend per-entity override UI

**Status:** Design approved 2026-05-01

**Goal:** Surface the `/api/overrides` endpoints (shipped in P1b-3) in the Vue 3 SPA so users can reassign entities to a different room and hide entities from the generated dashboard. Overrides are edited inline in the Review screen, batched, and persisted via a single explicit save action that also re-runs the analyze pipeline.

**Out of scope:**

- Server-side overrides storage and `/api/overrides` endpoints — already shipped in P1b-3.
- Bulk operations (move all entities of a domain at once) — YAGNI for P1b-4.
- Drag-and-drop reassignment — keyboard-and-click only at MVP scope.
- Entity rename / friendly_name override — separate ticket if it ever lands.

---

## Architecture

The user flow gains one editing layer between Review and Apply:

```
Analyze → Preview → [edit overrides → Save & re-analyze]* → Apply
                       ↑                ↓
                       └── inline in Review screen ──┘
```

A new Pinia store owns override state. Two existing components (`RoomList`, `MiscBucket`) gain expansion to show per-entity rows. A new `EntityRow` component contains the per-entity controls. A new `OverridesBar` component shows pending-change count and the Save/Discard actions. The existing `App.vue` orchestrates the load-on-ready and the save-then-reanalyze sequence.

**Module boundaries:**

- `stores/overrides.ts` — owns server-state + dirty-state maps, exposes mutating actions, computes `effective(entityId)` and `dirtyCount`.
- `api/client.ts` — gains `getOverrides()` and `putOverrides()` functions.
- `api/types.ts` — gains the `Override` interface and the `RoomAssignment.manual` field.
- `components/EntityRow.vue` — single-entity row with dropdown + hide toggle + override-row treatment.
- `components/OverridesBar.vue` — pending-changes bar with Save & Discard buttons.
- `components/RoomList.vue` — modified: each room row becomes a `<details>` reveal containing `EntityRow` per assignment.
- `components/MiscBucket.vue` — modified: existing `<details>` reveal now lists `EntityRow` per misc entity.

The override store does NOT mutate the analyze store directly. After a successful PUT, it calls `useAnalyzeStore().analyze()` to refresh the preview — that's a clean dependency direction (overrides → analyze, not the reverse).

---

## Pinia store shape

```ts
// packages/web/src/stores/overrides.ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getOverrides, putOverrides } from '../api/client.js'
import { useAnalyzeStore } from './analyze.js'
import type { ApiError, Override } from '../api/types.js'

type Phase = 'idle' | 'loading' | 'saving' | 'error'

export const useOverridesStore = defineStore('overrides', () => {
  const phase = ref<Phase>('idle')
  const error = ref<ApiError | null>(null)

  const serverState = ref(new Map<string, Override>())
  const dirtyState = ref(new Map<string, Override | null>())

  const hasDirty = computed(() => dirtyState.value.size > 0)
  const dirtyCount = computed(() => dirtyState.value.size)

  function effective(entityId: string): Override | null {
    if (dirtyState.value.has(entityId)) {
      return dirtyState.value.get(entityId) ?? null
    }
    return serverState.value.get(entityId) ?? null
  }

  function setRoomId(entityId: string, roomId: string | null): void {
    /* ... */
  }
  function setHidden(entityId: string, hidden: boolean): void {
    /* ... */
  }
  function discardChanges(): void {
    dirtyState.value.clear()
  }
  async function loadFromServer(): Promise<void> {
    /* ... */
  }
  async function saveAndReanalyze(): Promise<void> {
    /* ... */
  }

  return {
    phase,
    error,
    hasDirty,
    dirtyCount,
    effective,
    setRoomId,
    setHidden,
    discardChanges,
    loadFromServer,
    saveAndReanalyze,
  }
})
```

**Two-map model:**

- `serverState: Map<entityId, Override>` — last-known server-saved overrides. Populated by `loadFromServer()`. Replaced wholesale by `saveAndReanalyze()` from the PUT response.
- `dirtyState: Map<entityId, Override | null>` — pending edits. Map value of `null` distinguishes "user opted out" (pending delete) from "user hasn't touched it" (key absent).

**Computed `effective(entityId)`** is the single source of truth for the UI. It hides the dirty/server distinction from consumers — components just ask "what's currently set for this entity?"

**Edit-then-revert collapses to "no edit":** `setDirty(entityId, next)` compares `next` to `serverState.get(entityId)`. If equal (including both being `undefined`), the entry is removed from `dirtyState` rather than added with the same value. This keeps `dirtyCount` honest — the user toggling hide on then off shouldn't show "1 pending change."

**Field preservation:** `setRoomId` doesn't clobber a previously-set `hidden`; `setHidden` doesn't clobber a previously-set `roomId`. Both build the next override from `effective(entityId)` then mutate the targeted field.

**No-op collapse:** when both `roomId` and `hidden` are unset (i.e., the user reverted the override entirely), the dirty entry is set to `null` (pending delete) — UNLESS no server entry exists, in which case the dirty key is removed entirely.

**Action signatures:**

- `loadFromServer()`: GET `/api/overrides`, replace `serverState`, clear `dirtyState`. Sets `phase` to `'loading'` then `'idle'`/`'error'`.
- `saveAndReanalyze()`: compose merged list (server entries not in dirty + non-null dirty entries), PUT `/api/overrides`, replace `serverState` from response, clear `dirtyState`. Then call `useAnalyzeStore().analyze()`. Sets `phase` to `'saving'` → `'idle'`/`'error'`.

---

## API contract

### Type additions in `packages/web/src/api/types.ts`

```ts
export interface Override {
  entityId: string
  roomId?: string // CanonicalRoomId at runtime; widened for client to avoid duplicating the union
  hidden?: boolean
}

export interface RoomAssignment {
  entityId: string
  roomId: string
  confidence: number
  signals: DetectionSignal[]
  /** Set to true by the server's pipeline patch when an override moved this entity. */
  manual?: boolean
}
```

The web's `Override.roomId` is typed as `string` rather than the canonical-rooms union. The web package doesn't import server-side type unions (per the existing `api/types.ts` comment). The dropdown options are hardcoded to the 14 assignable rooms anyway, so the widening is safe at the call site.

### Client functions in `packages/web/src/api/client.ts`

Following the existing `postJson` pattern, but extended for GET + PUT:

```ts
async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch (cause) {
    throw {
      error: 'network',
      message: cause instanceof Error ? cause.message : String(cause),
    } satisfies ApiError
  }
  if (!res.ok) {
    // ... same envelope-validation as existing postJson
  }
  return res.json() as Promise<T>
}

export function getOverrides(): Promise<{ overrides: Override[] }> {
  return fetchJson('api/overrides')
}

export function putOverrides(body: { overrides: Override[] }): Promise<{ overrides: Override[] }> {
  return fetchJson('api/overrides', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
```

The existing `postJson` is method-locked to POST and doesn't fit GET/PUT. Refactoring into a shared `fetchJson` helper is in-scope; both `postAnalyze`/`postPreview`/`postApply` are rebased on it.

### Error envelope additions

`ApiError.error` gains `'invalid_body'` and `'storage_error'` (both from the server-side route plugin). The existing `'network'` and HTTP-status fallback shapes still apply.

---

## UI / components

### `EntityRow.vue` (new)

Props:

- `assignment: { entityId: string; friendlyName: string; roomId: string; manual?: boolean }`

Reads from `useOverridesStore()` via `effective(entityId)`. Renders:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ light.kitchen_ceiling          [ Living Room ▼ ]      [ ☐ Hide ]             │
│ Kitchen Ceiling Light                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

When `effective(entityId) !== null` OR `assignment.manual === true`:

```
┃ light.kitchen_ceiling          [ Living Room ▼ ]      [ ☑ Hide ]             ┃
┃ Kitchen Ceiling Light                                                         ┃
```

(amber left border, faint amber background)

Tailwind classes for the override treatment: `border-l-2 border-amber-400 bg-amber-50/40`.

**Dropdown options:** an `<option>` per assignable canonical room (14 entries — `kitchen`, `living_room`, `bedroom`, `bathroom`, `office`, `garage`, `garden`, `dining_room`, `laundry`, `basement`, `attic`, `kids_room`, `guest_room`, `hallway`). Plus a top sentinel option `"— let detector decide —"` with value `''` (empty string) which dispatches `setRoomId(entityId, null)`.

Display value: `effective(entityId)?.roomId ?? assignment.roomId`. So when no override is set, the dropdown reflects the detector's choice (allowing the user to override OR leave as-is); when an override is set, it reflects the override.

**Hide toggle:** a styled checkbox bound to `effective(entityId)?.hidden === true`. Click dispatches `setHidden(entityId, !current)`.

**Hidden-but-shown rendering:** when `effective.hidden === true`, the row remains in the list with `opacity-60` and "(hidden)" appended after `entityId` so the user can see + un-hide their hidden entries.

**Disabled state:** `:disabled="overrides.phase === 'saving'"` on both controls — prevents racing edits during a PUT.

### `RoomList.vue` modifications

Each room row becomes a `<details>` element. The summary row (the existing icon + name + count + confidence pill) is the `<summary>`; expanded content is a list of `<EntityRow>` for `room.assignments`. The disclosure caret (`▶`/`▼`) is a small inline arrow on the left of the summary row.

The existing `confidencePillClass` and `confidenceLabel` helpers stay unchanged — the room-level summary is still computed from the analyzer's last-run output.

### `MiscBucket.vue` modifications

Existing `<details>` reveal stays. Replace the bare `<li>` with `<EntityRow>` per misc entity. Misc entities pass `roomId: 'misc'` as the assignment's current room (sentinel; not in the dropdown options). Selecting a real room from the dropdown moves the entity out of misc on the next re-analyze.

### `OverridesBar.vue` (new)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 3 pending changes                            [ Discard ]  [ Save & re-analyze ] │
└──────────────────────────────────────────────────────────────────────────────┘
```

`v-if="overrides.hasDirty"`. While `overrides.phase === 'saving'`, the bar shows `Saving…` and disables both buttons. On `phase === 'error'`, shows the error message and a Retry button (parallels `ApplyBar`).

Sits between `MiscBucket` and `DashboardPreview` in `App.vue`.

### `App.vue` wiring

A `watch` on `analyze.phase` triggers `overrides.loadFromServer()` when phase becomes `'ready'`. Mounted location: just below the existing `analyze` setup.

```ts
watch(
  () => analyze.phase,
  (phase) => {
    if (phase === 'ready') {
      void overrides.loadFromServer()
    }
  },
)
```

Layout addition — `<OverridesBar />` between `<MiscBucket>` and `<DashboardPreview>`:

```html
<section v-if="analyze.phase === 'ready' && analyze.preview !== null" class="space-y-4">
  <RoomList :rooms="analyze.preview.rooms" />
  <MiscBucket :misc="analyze.preview.misc" />
  <OverridesBar />
  <DashboardPreview :config="analyze.preview.config" />
  <ApplyBar />
</section>
```

---

## Data flow

**Initial load** — when `analyze.phase` transitions to `'ready'` for the first time:

```
analyze.analyze() resolves
   → analyze.phase = 'ready'
   → watcher fires
   → overrides.loadFromServer()
       → GET /api/overrides
       → serverState populated; dirtyState clear
```

**Edit flow** — user changes a dropdown or toggles hide:

```
User picks 'bedroom' for light.kitchen_ceiling
   → overrides.setRoomId('light.kitchen_ceiling', 'bedroom')
   → dirtyState gains entry
   → OverridesBar appears (dirtyCount > 0)
   → EntityRow for that entity gets amber border (effective() returns the new override)
```

The room-summary counts in `RoomList` do NOT update yet — they reflect the last-analyzed state. This is intentional: batched-save means the user sees a stale summary until they Save.

**Save flow** — user clicks "Save & re-analyze":

```
overrides.saveAndReanalyze()
   → phase = 'saving'
   → Compose merged list:
        for each entityId in serverState ∪ dirtyState.keys:
          if dirtyState.has(entityId):
            if dirtyState.get(entityId) === null: skip (pending delete)
            else: include dirtyState.get(entityId)
          else:
            include serverState.get(entityId)
   → PUT /api/overrides { overrides: [...] }
       → 200: serverState replaced with response body; dirtyState cleared
              → analyze.analyze()  ← refresh preview
                  → 'ready': UI updates with new room assignments + dashboard preview
                  → 'error': preview stale; analyze error shown via existing channel; overrides ARE saved
              → phase = 'idle'
       → 400/500: phase = 'error'; error preserved; dirtyState preserved; user can Retry
```

**Discard flow:**

```
overrides.discardChanges()
   → dirtyState.clear()
   → OverridesBar disappears
   → all EntityRows revert to serverState values
```

**Apply flow** (existing, unchanged): user clicks "Apply to HA" → uses `analyze.preview.config` which now reflects the latest saved overrides because re-analyze ran after the save.

**Race condition prevention:** `saveAndReanalyze` is the only flow where the user could race their own edits. EntityRow controls are disabled while `phase === 'saving'`, blocking the race at the UI layer.

**Error envelope handling for save:**

- `400 invalid_body`: shouldn't happen at MVP scope (the dropdown only emits valid values + hidden is a strict bool). If it does, treat as a programmer error: log to console + show "Could not save: invalid override data" in OverridesBar with a Retry button.
- `500 storage_error`: SQLite-level failure. "Could not save your changes: <message>" + Retry.
- `network`: "Could not reach the server" + Retry.

---

## Testing strategy

### Pinia store tests — `packages/web/src/__tests__/stores/overrides.test.ts` (new)

Use `createTestingPinia` with `stubActions: false` and mock the API client functions:

- `loadFromServer` populates `serverState` from a mocked GET response; `dirtyState` stays empty after.
- `setRoomId` adds an entry to `dirtyState`; `effective(entityId)` returns the new value; `hasDirty` becomes true; `dirtyCount` reflects the count.
- `setRoomId(entityId, null)` clears the roomId field but preserves `hidden` if it was set.
- `setHidden(entityId, true)` preserves the existing `roomId` from server.
- Combined edits (`setRoomId` then `setHidden`) round-trip correctly — both fields end up in the final override.
- Reverting an edit back to the server value collapses the entry out of `dirtyState` (`hasDirty` returns false).
- Setting both fields to "no override" produces a `null` map value (pending delete) when a server entry exists, OR removes the dirty key entirely when no server entry exists.
- `saveAndReanalyze` calls `putOverrides` with the merged list (verified by mock spy); after success, `serverState` is replaced from the response, `dirtyState` is cleared, and `analyze.analyze()` is called.
- `saveAndReanalyze` on 500 preserves `dirtyState`; phase ends in `'error'`; error shape forwarded.
- `discardChanges` empties `dirtyState` without touching `serverState`.

### API client tests — extend `packages/web/src/__tests__/api/client.test.ts`

- `getOverrides()` parses `{ overrides: [...] }` shape from a mocked Response.
- `getOverrides()` on 500 throws an `ApiError` with the storage_error envelope.
- `putOverrides()` sends the correct method (PUT), Content-Type, and body.
- `putOverrides()` on 400 throws an `ApiError` with `error: 'invalid_body'`.

### Component tests — Vitest + `@vue/test-utils`

- **`__tests__/components/EntityRow.test.ts`** — renders entityId + friendlyName. Dropdown reflects `effective.roomId ?? assignment.roomId`. Hide toggle reflects `effective.hidden === true`. Override row treatment (`border-l-2 border-amber-400`) applied when `effective !== null` OR `assignment.manual === true`. Dropdown change emits `setRoomId(entityId, value)`. Hide click emits `setHidden(entityId, newValue)`. Controls disabled during `phase === 'saving'`.

- **`__tests__/components/RoomList.test.ts`** (extend existing) — `<details>` reveal works; expanded room renders one `EntityRow` per assignment.

- **`__tests__/components/MiscBucket.test.ts`** (new) — uses `EntityRow` inside the existing `<details>` reveal.

- **`__tests__/components/OverridesBar.test.ts`** (new) — visible only when `hasDirty === true`. Shows correct dirty count. Discard button calls `discardChanges`. Save button calls `saveAndReanalyze`. Disabled + "Saving…" label during `phase === 'saving'`. Error message rendered on `phase === 'error'`.

- **`__tests__/App.test.ts`** (new) — verify `overrides.loadFromServer` is called when `analyze.phase` transitions to `'ready'`.

### End-to-end happy path

A single integration test that mounts `<App>` with `createTestingPinia`. Set `analyze.preview` to a fixture with a known room assignment. User opens the room (click `<summary>`), picks a different room from the dropdown, clicks Save & re-analyze. Assert: `putOverrides` called with the right body; `analyze.analyze` called after success; OverridesBar disappears.

### What's NOT tested in P1b-4

- Server-side override persistence (covered by P1b-3 tests).
- Server-side pipeline patch behavior (covered by P1b-3 integration tests).
- HA-level dashboard rendering (out of scope; HA's frontend handles the resulting config).
- Visual snapshot tests — the existing web tests don't use snapshots; we won't introduce them here.

---

## Acceptance

- [ ] `Override` type re-exported from `@lovelacer/web/api/types`; `RoomAssignment.manual?: boolean` added.
- [ ] `getOverrides()` and `putOverrides()` in the API client, both with proper error envelope handling.
- [ ] `useOverridesStore()` Pinia store with two-map model and `effective()` getter.
- [ ] `EntityRow.vue` component renders dropdown + hide toggle + override-row treatment; controls disabled during save.
- [ ] `RoomList.vue` rooms expand via `<details>` to reveal `EntityRow`s; existing summary row unchanged.
- [ ] `MiscBucket.vue` uses `EntityRow`; misc entities can be reassigned via the same controls.
- [ ] `OverridesBar.vue` shows dirty count + Discard + Save buttons; visible only when `hasDirty`.
- [ ] `App.vue` triggers `loadFromServer()` on first `analyze.phase === 'ready'`.
- [ ] Save flow PUTs the merged list, refreshes `serverState`, clears `dirtyState`, and calls `analyze.analyze()`.
- [ ] Discard flow clears `dirtyState` without server contact.
- [ ] Override-row treatment applied when `effective !== null` OR `assignment.manual === true`.
- [ ] Hidden entities still appear (with `opacity-60` + "(hidden)" suffix) so they can be un-hidden.
- [ ] Pinia store tests, API client tests, and component tests for all new components.
- [ ] One end-to-end happy-path test through `<App>`.
- [ ] `pnpm typecheck`, `pnpm -r test`, `pnpm format:check`, `pnpm lint` all clean.
