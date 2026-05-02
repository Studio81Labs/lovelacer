# P1b-4 Frontend Per-Entity Override UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the `/api/overrides` endpoints (shipped in P1b-3) into the Vue 3 SPA so users can reassign entities to a different room and hide entities from the generated dashboard. Edits are batched, persisted via a single explicit save action that also re-runs the analyze pipeline.

**Architecture:** A new `useOverridesStore` Pinia store owns a two-map state model (server-known vs dirty edits) with a computed `effective(entityId)` getter as the single source of truth. New `EntityRow` component contains the per-entity controls (room dropdown + hide toggle + override-row treatment); used by both `RoomList` (each room becomes a `<details>` reveal) and `MiscBucket`. New `OverridesBar` component shows pending-changes count + Save/Discard buttons. `App.vue` adds a watcher that triggers `loadFromServer()` when analyze becomes ready.

**Tech Stack:** Vue 3 Composition API + `<script setup>`, Pinia (setup-style stores), Tailwind 4, Vitest (`globals: false`), `@vue/test-utils`, `@iconify/vue` for icons.

**Spec reference:** [`docs/superpowers/specs/2026-05-01-p1b-4-frontend-overrides-ui-design.md`](../specs/2026-05-01-p1b-4-frontend-overrides-ui-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions even when importing TS source.
- Type-only imports use `import type { … } from '…'`.
- Tests use `import { describe, it, expect, vi, beforeEach } from 'vitest'` (no globals).
- All commands run from worktree: `pnpm --dir <worktree>` and `git -C <worktree>`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- After each task, run `pnpm typecheck && pnpm -r test` to verify nothing regressed.
- Tailwind classes used: existing `border-stone-*`, `bg-stone-*`, `text-stone-*`, `rounded`, `border-amber-*`, `bg-amber-*` — all from the existing palette in `RoomList.vue` / `ApplyBar.vue`.

---

## File structure

**New files:**

- `packages/web/src/rooms.ts` — assignable canonical rooms list + display-name helper
- `packages/web/src/stores/overrides.ts` — Pinia store
- `packages/web/src/components/EntityRow.vue` — per-entity row with controls
- `packages/web/src/components/OverridesBar.vue` — pending-changes bar
- `packages/web/src/__tests__/stores/overrides.test.ts`
- `packages/web/src/__tests__/components/EntityRow.test.ts`
- `packages/web/src/__tests__/components/OverridesBar.test.ts`
- `packages/web/src/__tests__/components/MiscBucket.test.ts`
- `packages/web/src/__tests__/App.test.ts`

**Modified files:**

- `packages/web/src/api/types.ts` — add `Override` + `RoomAssignment.manual`
- `packages/web/src/api/client.ts` — refactor `postJson` → `fetchJson`, add GET/PUT helpers
- `packages/web/src/components/RoomList.vue` — `<details>` reveal per room with `EntityRow`s
- `packages/web/src/components/MiscBucket.vue` — uses `EntityRow` instead of bare `<li>`
- `packages/web/src/App.vue` — `OverridesBar` slot + `loadFromServer` watcher
- `packages/web/src/__tests__/api/client.test.ts` — extend with override functions
- `packages/web/src/__tests__/components/RoomList.test.ts` — extend with `<details>` + `EntityRow` checks

---

## Task 1: Foundation — types, rooms helper, API client refactor

**Files:**

- Modify: `packages/web/src/api/types.ts`
- Modify: `packages/web/src/api/client.ts`
- Create: `packages/web/src/rooms.ts`
- Modify: `packages/web/src/__tests__/api/client.test.ts`

Adds the `Override` shape, refactors the API helper to support GET + PUT, and ships `getOverrides`/`putOverrides`. Pure foundation — no UI changes yet.

- [ ] **Step 1: Read the existing types file**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides/packages/web/src/api/types.ts
```

Note the existing `RoomAssignment` and `ApiError` definitions.

- [ ] **Step 2: Add `Override` and extend `RoomAssignment`**

In `packages/web/src/api/types.ts`, add `Override` and `manual?: boolean` to `RoomAssignment`. Also extend `ApiError.error` to include `'invalid_body'` and `'storage_error'`.

```ts
/**
 * User-specified override for a single entity. Mirrors the server-side
 * shape from @lovelacer/shared (duplicated here to keep the web package
 * independent — the server's shape evolves in lockstep).
 */
export interface Override {
  entityId: string
  /** CanonicalRoomId at runtime; widened to string to avoid duplicating the union here. */
  roomId?: string
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

export interface ApiError {
  error:
    | 'ha_unavailable'
    | 'analyze_failed'
    | 'preview_failed'
    | 'invalid_config'
    | 'ha_apply_failed'
    | 'apply_failed'
    | 'invalid_body'
    | 'storage_error'
    | 'network'
  step?: 'list' | 'create' | 'save'
  message: string
}
```

(Keep the existing JSDoc on `ApiError`. Only the union list changes.)

- [ ] **Step 3: Create `rooms.ts` helper**

Create `packages/web/src/rooms.ts`:

```ts
/**
 * Assignable canonical rooms (mirrors the server's CANONICAL_ROOMS set
 * minus 'misc' — the analyzer's unclassified bucket is not a user-
 * assignable target). Plus a display-name lookup used by the override
 * dropdown in EntityRow.vue.
 */

export const ASSIGNABLE_ROOMS = [
  'kitchen',
  'living_room',
  'bedroom',
  'bathroom',
  'office',
  'hallway',
  'garage',
  'garden',
  'dining_room',
  'laundry',
  'basement',
  'attic',
  'kids_room',
  'guest_room',
] as const

export type AssignableRoomId = (typeof ASSIGNABLE_ROOMS)[number]

const ROOM_DISPLAY: Record<string, string> = {
  kitchen: 'Kitchen',
  living_room: 'Living Room',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  office: 'Office',
  hallway: 'Hallway',
  garage: 'Garage',
  garden: 'Garden',
  dining_room: 'Dining Room',
  laundry: 'Laundry',
  basement: 'Basement',
  attic: 'Attic',
  kids_room: "Kids' Room",
  guest_room: 'Guest Room',
  misc: 'Other',
}

export function roomIdToDisplay(roomId: string): string {
  return ROOM_DISPLAY[roomId] ?? roomId
}
```

- [ ] **Step 4: Refactor `postJson` → `fetchJson` and add new helpers**

Read `packages/web/src/api/client.ts`. Replace its contents:

```ts
import type {
  AnalyzeOutput,
  ApiError,
  ApplyResult,
  LovelaceConfig,
  Override,
  PreviewOutput,
} from './types.js'

/**
 * Wraps a `fetch()` to a backend route in the standard error envelope.
 * URL is document-relative (no leading slash) so the request stays inside
 * the add-on path under HA Supervisor ingress (`/api/hassio_ingress/<token>/`).
 * Vite's dev proxy resolves the same path to the backend at :3000.
 */
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
    const parsed: unknown = await res.json().catch(() => null)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof (parsed as { error?: unknown }).error === 'string' &&
      typeof (parsed as { message?: unknown }).message === 'string'
    ) {
      throw parsed as ApiError
    }
    throw {
      error: 'network',
      message: `HTTP ${res.status}`,
    } satisfies ApiError
  }

  return res.json() as Promise<T>
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

export function postAnalyze(): Promise<AnalyzeOutput> {
  return fetchJson<AnalyzeOutput>('api/analyze', { method: 'POST', headers: JSON_HEADERS })
}

export function postPreview(): Promise<PreviewOutput> {
  return fetchJson<PreviewOutput>('api/preview', { method: 'POST', headers: JSON_HEADERS })
}

export function postApply(body: { config: LovelaceConfig }): Promise<ApplyResult> {
  return fetchJson<ApplyResult>('api/apply', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

export function getOverrides(): Promise<{ overrides: Override[] }> {
  return fetchJson('api/overrides')
}

export function putOverrides(body: { overrides: Override[] }): Promise<{ overrides: Override[] }> {
  return fetchJson('api/overrides', {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}
```

- [ ] **Step 5: Verify the refactor doesn't break existing client tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides vitest run packages/web/src/__tests__/api/client.test.ts
```

Expected: PASS — the existing `postPreview` / `postApply` tests still pass because the refactor preserves observable behavior.

If any test fails, the refactor changed something it shouldn't have. Common issue: `headers: { 'Content-Type': 'application/json' }` placement — POST routes still need it; GET doesn't (and shouldn't send it). The existing tests check the exact second argument shape (`{ method: 'POST', headers: { 'Content-Type': 'application/json' } }`).

- [ ] **Step 6: Extend `client.test.ts` with override function tests**

Append the following describe blocks at the end of `packages/web/src/__tests__/api/client.test.ts` (after the last existing describe):

```ts
import { getOverrides, putOverrides } from '../../api/client.js'
import type { Override } from '../../api/types.js'

describe('getOverrides', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed body on 200', async () => {
    const mockResponse = {
      overrides: [{ entityId: 'light.kitchen_ceiling', roomId: 'living_room' }],
    }
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as unknown as Response)

    const result = await getOverrides()
    expect(result).toEqual(mockResponse)
    expect(globalThis.fetch).toHaveBeenCalledWith('api/overrides', {})
  })

  it('throws ApiError on storage_error 500', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () =>
        Promise.resolve({
          error: 'storage_error',
          message: 'disk full',
        }),
    } as unknown as Response)

    await expect(getOverrides()).rejects.toMatchObject({
      error: 'storage_error',
      message: 'disk full',
    } satisfies ApiError)
  })
})

describe('putOverrides', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends PUT with the body and returns the echoed list on 200', async () => {
    const body = {
      overrides: [{ entityId: 'light.a', roomId: 'kitchen' }] as Override[],
    }
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(body),
    } as unknown as Response)

    const result = await putOverrides(body)
    expect(result).toEqual(body)
    expect(globalThis.fetch).toHaveBeenCalledWith('api/overrides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  })

  it('throws ApiError on invalid_body 400', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'invalid_body',
          message: 'duplicate entityId',
        }),
    } as unknown as Response)

    await expect(putOverrides({ overrides: [] })).rejects.toMatchObject({
      error: 'invalid_body',
      message: 'duplicate entityId',
    } satisfies ApiError)
  })
})
```

If `Override` and `ApiError` are already imported earlier in the file, don't re-import — just reuse. Same for `vi`/`describe`/`it`/`expect`/`beforeEach`. The plan-shown imports are illustrative; consolidate into the existing imports.

- [ ] **Step 7: Run all client tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides vitest run packages/web/src/__tests__/api/client.test.ts
```

Expected: PASS — original tests + 4 new tests.

- [ ] **Step 8: Verify the broader build**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides -r test
```

Both green.

- [ ] **Step 9: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides add packages/web/src/api/types.ts packages/web/src/api/client.ts packages/web/src/rooms.ts packages/web/src/__tests__/api/client.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides commit -m "$(cat <<'EOF'
feat(web): Override types + rooms helper + getOverrides/putOverrides client

Foundation for P1b-4. Types (Override + RoomAssignment.manual) mirror
the P1b-3 server shapes; the web copy stays independent of @lovelacer/
shared so the browser bundle doesn't drag server deps. ApiError gains
'invalid_body' and 'storage_error' for the new endpoints.

Client refactor: replaced postJson with method-agnostic fetchJson so
GET /api/overrides works without a method-locked POST helper. The
existing post* helpers rebase on fetchJson with explicit method +
headers — observable behavior identical (existing tests untouched).

New rooms.ts module with ASSIGNABLE_ROOMS (14 canonical rooms minus
'misc') + roomIdToDisplay() — used by the dropdown component in the
next layer.

Four new client tests pin the override endpoints' happy path + 400
invalid_body + 500 storage_error envelopes.

P1b-4 layer 1 of 6 (foundation).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pinia overrides store

**Files:**

- Create: `packages/web/src/stores/overrides.ts`
- Create: `packages/web/src/__tests__/stores/overrides.test.ts`

Two-map state with computed `effective(entityId)`. Tests pin every behavior described in the spec's pinia section.

- [ ] **Step 1: Write the failing test file**

Create `packages/web/src/__tests__/stores/overrides.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useOverridesStore } from '../../stores/overrides.js'
import { useAnalyzeStore } from '../../stores/analyze.js'
import type { ApiError, Override } from '../../api/types.js'

vi.mock('../../api/client.js', () => ({
  getOverrides: vi.fn(),
  putOverrides: vi.fn(),
  postPreview: vi.fn(),
}))

const { getOverrides, putOverrides, postPreview } = await import('../../api/client.js')

describe('useOverridesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getOverrides).mockReset()
    vi.mocked(putOverrides).mockReset()
    vi.mocked(postPreview).mockReset()
  })

  it('starts with empty server + dirty state and idle phase', () => {
    const store = useOverridesStore()
    expect(store.phase).toBe('idle')
    expect(store.hasDirty).toBe(false)
    expect(store.dirtyCount).toBe(0)
    expect(store.error).toBeNull()
  })

  it('loadFromServer populates serverState and clears dirty', async () => {
    const overrides: Override[] = [{ entityId: 'a.b', roomId: 'kitchen' }]
    vi.mocked(getOverrides).mockResolvedValueOnce({ overrides })

    const store = useOverridesStore()
    store.setRoomId('a.b', 'bedroom') // create some dirty state to verify it clears
    expect(store.hasDirty).toBe(true)

    await store.loadFromServer()

    expect(store.effective('a.b')).toEqual({ entityId: 'a.b', roomId: 'kitchen' })
    expect(store.hasDirty).toBe(false)
    expect(store.phase).toBe('idle')
  })

  it('setRoomId adds an entry to dirtyState and effective() returns it', () => {
    const store = useOverridesStore()
    store.setRoomId('light.a', 'bedroom')

    expect(store.effective('light.a')).toEqual({ entityId: 'light.a', roomId: 'bedroom' })
    expect(store.hasDirty).toBe(true)
    expect(store.dirtyCount).toBe(1)
  })

  it('setRoomId(entityId, null) clears roomId but preserves hidden if set', () => {
    const store = useOverridesStore()
    store.setHidden('sensor.x', true)
    store.setRoomId('sensor.x', 'kitchen')
    store.setRoomId('sensor.x', null) // clear roomId

    expect(store.effective('sensor.x')).toEqual({ entityId: 'sensor.x', hidden: true })
  })

  it('setHidden preserves an existing roomId from server state', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    const store = useOverridesStore()
    await store.loadFromServer()

    store.setHidden('a.b', true)

    expect(store.effective('a.b')).toEqual({ entityId: 'a.b', roomId: 'kitchen', hidden: true })
    expect(store.hasDirty).toBe(true)
  })

  it('reverting an edit back to the server value collapses dirtyState', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    const store = useOverridesStore()
    await store.loadFromServer()

    store.setRoomId('a.b', 'bedroom') // dirty
    expect(store.hasDirty).toBe(true)
    store.setRoomId('a.b', 'kitchen') // back to server value

    expect(store.hasDirty).toBe(false)
    expect(store.dirtyCount).toBe(0)
  })

  it('setting both fields to no-override marks pending delete when server has an entry', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    const store = useOverridesStore()
    await store.loadFromServer()

    store.setRoomId('a.b', null) // both fields now unset
    expect(store.effective('a.b')).toBeNull() // pending delete
    expect(store.hasDirty).toBe(true)
    expect(store.dirtyCount).toBe(1)
  })

  it('setting an already-clean entity to no-op leaves dirtyState clean', () => {
    const store = useOverridesStore()
    // Server has nothing; user clicks something then clicks back to nothing
    store.setRoomId('a.b', 'kitchen')
    store.setRoomId('a.b', null)

    expect(store.effective('a.b')).toBeNull()
    expect(store.hasDirty).toBe(false)
  })

  it('saveAndReanalyze PUTs merged list, replaces serverState, calls analyze', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    vi.mocked(putOverrides).mockResolvedValueOnce({
      overrides: [
        { entityId: 'a.b', roomId: 'bedroom' },
        { entityId: 'c.d', hidden: true },
      ],
    })
    vi.mocked(postPreview).mockResolvedValueOnce({
      rooms: [],
      misc: [],
      summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
      config: { title: 'Lovelacer — Home', views: [] },
    })

    const store = useOverridesStore()
    await store.loadFromServer()

    store.setRoomId('a.b', 'bedroom')
    store.setHidden('c.d', true)

    await store.saveAndReanalyze()

    expect(putOverrides).toHaveBeenCalledWith({
      overrides: [
        { entityId: 'a.b', roomId: 'bedroom' },
        { entityId: 'c.d', hidden: true },
      ],
    })
    expect(store.hasDirty).toBe(false)
    expect(store.effective('a.b')).toEqual({ entityId: 'a.b', roomId: 'bedroom' })
    expect(store.effective('c.d')).toEqual({ entityId: 'c.d', hidden: true })
    expect(store.phase).toBe('idle')

    // Re-analyze called as part of the save flow
    expect(postPreview).toHaveBeenCalledOnce()
  })

  it('saveAndReanalyze with pending-delete entry omits it from the PUT body', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    vi.mocked(putOverrides).mockResolvedValueOnce({ overrides: [] })
    vi.mocked(postPreview).mockResolvedValueOnce({
      rooms: [],
      misc: [],
      summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
      config: { title: 'Lovelacer — Home', views: [] },
    })

    const store = useOverridesStore()
    await store.loadFromServer()
    store.setRoomId('a.b', null) // pending delete

    await store.saveAndReanalyze()

    expect(putOverrides).toHaveBeenCalledWith({ overrides: [] })
    expect(store.effective('a.b')).toBeNull() // gone after save too
  })

  it('saveAndReanalyze on 500 preserves dirtyState and sets phase=error', async () => {
    const apiError: ApiError = { error: 'storage_error', message: 'disk full' }
    vi.mocked(putOverrides).mockRejectedValueOnce(apiError)

    const store = useOverridesStore()
    store.setRoomId('a.b', 'bedroom')

    await store.saveAndReanalyze()

    expect(store.hasDirty).toBe(true) // preserved
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiError)
    // Re-analyze NOT called — save failed
    expect(postPreview).not.toHaveBeenCalled()
  })

  it('discardChanges clears dirtyState without touching serverState', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    const store = useOverridesStore()
    await store.loadFromServer()
    store.setRoomId('a.b', 'bedroom')

    store.discardChanges()

    expect(store.hasDirty).toBe(false)
    expect(store.effective('a.b')).toEqual({ entityId: 'a.b', roomId: 'kitchen' }) // server value
  })

  it('loadFromServer on 500 sets phase=error and preserves dirtyState', async () => {
    const apiError: ApiError = { error: 'storage_error', message: 'disk full' }
    vi.mocked(getOverrides).mockRejectedValueOnce(apiError)

    const store = useOverridesStore()
    store.setRoomId('a.b', 'bedroom') // pre-existing dirty
    await store.loadFromServer()

    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiError)
    expect(store.hasDirty).toBe(true) // not cleared on error
  })
})
```

Above we use `vi.mock('../../api/client.js', ...)` to stub the network calls. The `useAnalyzeStore` import is needed because `saveAndReanalyze` will call `useAnalyzeStore().analyze()` — but since we mock `postPreview` (which `useAnalyzeStore.analyze` calls), the analyze store works against mocked data.

If the `useAnalyzeStore` import shows as unused at lint time, remove it — it's only here to make the mock chain explicit.

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides vitest run packages/web/src/__tests__/stores/overrides.test.ts
```

Expected: FAIL with "Cannot find module '../../stores/overrides.js'".

- [ ] **Step 3: Create the Pinia store**

Create `packages/web/src/stores/overrides.ts`:

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getOverrides, putOverrides } from '../api/client.js'
import type { ApiError, Override } from '../api/types.js'
import { useAnalyzeStore } from './analyze.js'

type Phase = 'idle' | 'loading' | 'saving' | 'error'

/**
 * Per-entity override edit state.
 *
 * Two parallel maps:
 *   - serverState: last-known server-saved overrides, populated by
 *     loadFromServer() and replaced wholesale by saveAndReanalyze().
 *   - dirtyState: pending edits. Map value of `null` means "delete this
 *     override on save" (distinguishes opt-out from "user hasn't touched
 *     it" where the key is absent).
 *
 * effective(entityId) is the single source of truth for the UI.
 */
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
    const current = effective(entityId)
    const next: Override = { entityId }
    if (roomId !== null) next.roomId = roomId
    if (current?.hidden === true) next.hidden = true
    setDirtyOrCollapse(entityId, next)
  }

  function setHidden(entityId: string, hidden: boolean): void {
    const current = effective(entityId)
    const next: Override = { entityId }
    if (current?.roomId !== undefined) next.roomId = current.roomId
    if (hidden) next.hidden = true
    setDirtyOrCollapse(entityId, next)
  }

  /**
   * Internal: lift `next` to dirtyState, but collapse to "no edit" if
   * the result equals the server value, or to pending-delete (`null`)
   * if the override is now meaningless and a server entry exists.
   */
  function setDirtyOrCollapse(entityId: string, next: Override): void {
    const meaningful = next.roomId !== undefined || next.hidden === true
    const server = serverState.value.get(entityId) ?? null

    if (!meaningful) {
      // Override no longer says anything. If server has it, schedule a
      // delete; if server doesn't have it, we're back to no-state.
      if (server !== null) {
        dirtyState.value.set(entityId, null)
      } else {
        dirtyState.value.delete(entityId)
      }
      return
    }

    if (overridesEqual(next, server)) {
      dirtyState.value.delete(entityId) // back to server value
      return
    }
    dirtyState.value.set(entityId, next)
  }

  function discardChanges(): void {
    dirtyState.value.clear()
  }

  async function loadFromServer(): Promise<void> {
    phase.value = 'loading'
    error.value = null
    try {
      const result = await getOverrides()
      const next = new Map<string, Override>()
      for (const o of result.overrides) {
        next.set(o.entityId, o)
      }
      serverState.value = next
      dirtyState.value.clear()
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
    }
  }

  async function saveAndReanalyze(): Promise<void> {
    phase.value = 'saving'
    error.value = null

    // Compose the merged list: server entries the user didn't touch +
    // dirty entries that aren't pending deletes.
    const merged: Override[] = []
    for (const [entityId, server] of serverState.value) {
      if (!dirtyState.value.has(entityId)) {
        merged.push(server)
      }
    }
    for (const [entityId, dirty] of dirtyState.value) {
      if (dirty !== null) {
        merged.push({ ...dirty, entityId })
      }
      // null entries skipped — that's a pending delete
    }

    try {
      const result = await putOverrides({ overrides: merged })
      const next = new Map<string, Override>()
      for (const o of result.overrides) {
        next.set(o.entityId, o)
      }
      serverState.value = next
      dirtyState.value.clear()

      // Refresh the analyzer preview so the UI reflects the new overrides.
      const analyze = useAnalyzeStore()
      await analyze.analyze()

      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
    }
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

function overridesEqual(a: Override | null, b: Override | null): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return a.entityId === b.entityId && a.roomId === b.roomId && a.hidden === b.hidden
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides vitest run packages/web/src/__tests__/stores/overrides.test.ts
```

Expected: PASS — 13 tests.

- [ ] **Step 5: Run full workspace tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides -r test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides add packages/web/src/stores/overrides.ts packages/web/src/__tests__/stores/overrides.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides commit -m "$(cat <<'EOF'
feat(web): useOverridesStore Pinia store

Two-map state model: serverState (last-known) + dirtyState (pending
edits). Computed effective(entityId) returns the override the UI
should display. setRoomId/setHidden preserve the other field. Edits
that revert to the server value collapse out of dirtyState; edits
that leave the override meaningless become pending-deletes (Map
value=null) when a server entry exists.

saveAndReanalyze composes the merged list (server entries the user
didn't touch + non-null dirty entries), PUTs to /api/overrides,
replaces serverState from the response, clears dirtyState, then
calls useAnalyzeStore().analyze() to refresh the preview. On error,
dirtyState is preserved so the user can retry.

13 unit tests cover load, edit, revert, pending-delete, save happy
path, save with pending-delete, save error, discard, and load error.

P1b-4 layer 2 of 6 (overrides store).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `EntityRow` component

**Files:**

- Create: `packages/web/src/components/EntityRow.vue`
- Create: `packages/web/src/__tests__/components/EntityRow.test.ts`

Single per-entity row with room dropdown + hide toggle + override-row treatment. Used by both `RoomList` and `MiscBucket` in Task 4.

- [ ] **Step 1: Write the failing test file**

Create `packages/web/src/__tests__/components/EntityRow.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import EntityRow from '../../components/EntityRow.vue'
import { useOverridesStore } from '../../stores/overrides.js'

interface RowProps {
  entityId: string
  friendlyName: string
  roomId: string
  manual?: boolean
}

function makeProps(overrides: Partial<RowProps> = {}): RowProps {
  return {
    entityId: 'light.kitchen_ceiling',
    friendlyName: 'Kitchen Ceiling Light',
    roomId: 'kitchen',
    ...overrides,
  }
}

function mountRow(props: RowProps) {
  return mount(EntityRow, {
    props,
    global: {
      plugins: [createTestingPinia({ stubActions: false })],
    },
  })
}

describe('EntityRow', () => {
  beforeEach(() => {
    // Each test gets a fresh pinia via createTestingPinia
  })

  it('renders entityId and friendlyName', () => {
    const wrapper = mountRow(makeProps())
    expect(wrapper.text()).toContain('light.kitchen_ceiling')
    expect(wrapper.text()).toContain('Kitchen Ceiling Light')
  })

  it('dropdown reflects detector roomId when no override is set', () => {
    const wrapper = mountRow(makeProps())
    const select = wrapper.find('[data-testid="room-select"]')
    expect((select.element as HTMLSelectElement).value).toBe('kitchen')
  })

  it('dropdown reflects effective.roomId when an override is set', () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.setRoomId('light.kitchen_ceiling', 'living_room')

    return wrapper.vm.$nextTick().then(() => {
      const select = wrapper.find('[data-testid="room-select"]')
      expect((select.element as HTMLSelectElement).value).toBe('living_room')
    })
  })

  it('hide toggle reflects effective.hidden when set', () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.setHidden('light.kitchen_ceiling', true)

    return wrapper.vm.$nextTick().then(() => {
      const toggle = wrapper.find('[data-testid="hide-toggle"]')
      expect((toggle.element as HTMLInputElement).checked).toBe(true)
    })
  })

  it('applies override-row treatment when effective is non-null', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.setRoomId('light.kitchen_ceiling', 'bedroom')

    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).toContain('border-l-2')
    expect(wrapper.classes()).toContain('border-amber-400')
  })

  it('applies override-row treatment when assignment.manual is true', () => {
    const wrapper = mountRow(makeProps({ manual: true }))
    expect(wrapper.classes()).toContain('border-l-2')
    expect(wrapper.classes()).toContain('border-amber-400')
  })

  it('dropdown change calls setRoomId with the new value', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()

    await wrapper.find('[data-testid="room-select"]').setValue('bedroom')

    expect(store.effective('light.kitchen_ceiling')).toEqual({
      entityId: 'light.kitchen_ceiling',
      roomId: 'bedroom',
    })
  })

  it('dropdown change to "" (let detector decide) calls setRoomId(null)', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.setRoomId('light.kitchen_ceiling', 'bedroom') // set up dirty state

    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="room-select"]').setValue('')

    // null roomId, no hidden → effective is null (no entry)
    expect(store.effective('light.kitchen_ceiling')).toBeNull()
  })

  it('hide toggle change calls setHidden', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()

    await wrapper.find('[data-testid="hide-toggle"]').setValue(true)

    expect(store.effective('light.kitchen_ceiling')).toEqual({
      entityId: 'light.kitchen_ceiling',
      hidden: true,
    })
  })

  it('controls are disabled when phase is saving', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.$patch({ phase: 'saving' })

    await wrapper.vm.$nextTick()
    const select = wrapper.find('[data-testid="room-select"]')
    const toggle = wrapper.find('[data-testid="hide-toggle"]')
    expect((select.element as HTMLSelectElement).disabled).toBe(true)
    expect((toggle.element as HTMLInputElement).disabled).toBe(true)
  })

  it('hidden entities show "(hidden)" suffix and reduced opacity', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.setHidden('light.kitchen_ceiling', true)

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('(hidden)')
    expect(wrapper.classes()).toContain('opacity-60')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides vitest run packages/web/src/__tests__/components/EntityRow.test.ts
```

Expected: FAIL with "Cannot find module '../../components/EntityRow.vue'".

- [ ] **Step 3: Create the component**

Create `packages/web/src/components/EntityRow.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useOverridesStore } from '../stores/overrides.js'
import { ASSIGNABLE_ROOMS, roomIdToDisplay } from '../rooms.js'

interface Props {
  entityId: string
  friendlyName: string
  roomId: string
  manual?: boolean
}

const props = defineProps<Props>()
const overrides = useOverridesStore()

const eff = computed(() => overrides.effective(props.entityId))

/** Dropdown's current value: override's roomId, or detector's, or '' for misc. */
const selectedRoom = computed(() => {
  const override = eff.value
  if (override?.roomId !== undefined) return override.roomId
  // Detector's roomId. Misc maps to '' so the dropdown shows "let detector decide".
  return props.roomId === 'misc' ? '' : props.roomId
})

const isHidden = computed(() => eff.value?.hidden === true)

const isOverridden = computed(() => eff.value !== null || props.manual === true)

const isSaving = computed(() => overrides.phase === 'saving')

function onRoomChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  overrides.setRoomId(props.entityId, value === '' ? null : value)
}

function onHideChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  overrides.setHidden(props.entityId, checked)
}

const rowClass = computed(() => {
  const classes: string[] = ['flex', 'items-center', 'justify-between', 'gap-3', 'px-5', 'py-2']
  if (isOverridden.value) {
    classes.push('border-l-2', 'border-amber-400', 'bg-amber-50/40')
  }
  if (isHidden.value) {
    classes.push('opacity-60')
  }
  return classes
})
</script>

<template>
  <div :class="rowClass" data-testid="entity-row">
    <div class="flex min-w-0 flex-col">
      <span class="truncate font-mono text-xs text-stone-700">
        {{ entityId }}<span v-if="isHidden"> (hidden)</span>
      </span>
      <span class="truncate text-xs text-stone-500">{{ friendlyName }}</span>
    </div>

    <div class="flex items-center gap-3">
      <select
        data-testid="room-select"
        class="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
        :value="selectedRoom"
        :disabled="isSaving"
        @change="onRoomChange"
      >
        <option value="">— let detector decide —</option>
        <option v-for="rid in ASSIGNABLE_ROOMS" :key="rid" :value="rid">
          {{ roomIdToDisplay(rid) }}
        </option>
      </select>

      <label class="flex items-center gap-1 text-xs text-stone-700">
        <input
          data-testid="hide-toggle"
          type="checkbox"
          class="h-4 w-4 rounded border-stone-300 disabled:cursor-not-allowed disabled:opacity-50"
          :checked="isHidden"
          :disabled="isSaving"
          @change="onHideChange"
        />
        Hide
      </label>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Verify the component compiles**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides typecheck
```

Expected: PASS.

- [ ] **Step 5: Run the EntityRow tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides vitest run packages/web/src/__tests__/components/EntityRow.test.ts
```

Expected: PASS — 11 tests.

- [ ] **Step 6: Run full workspace tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides -r test
```

Green.

- [ ] **Step 7: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides add packages/web/src/components/EntityRow.vue packages/web/src/__tests__/components/EntityRow.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides commit -m "$(cat <<'EOF'
feat(web): EntityRow component with room dropdown + hide toggle

Single per-entity row used by RoomList (in expanded room) and
MiscBucket. Renders entityId + friendlyName, a 14-room canonical
dropdown with a top "— let detector decide —" sentinel, and a hide
checkbox. Reads from useOverridesStore.effective() so dirty edits
appear immediately; writes via setRoomId/setHidden actions.

Override-row treatment (left amber border + faint amber background)
applied when effective !== null OR assignment.manual === true. When
hidden, the row stays in the list with opacity-60 and a "(hidden)"
suffix so the user can un-hide.

Controls are disabled while phase === 'saving' to block races
during the PUT.

Eleven component tests pin every behavior: rendering, dropdown
defaults, override-row treatment trigger conditions, change-event
dispatch, and disabled state.

P1b-4 layer 3 of 6 (entity row).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `RoomList` + `MiscBucket` integration

**Files:**

- Modify: `packages/web/src/components/RoomList.vue`
- Modify: `packages/web/src/components/MiscBucket.vue`
- Modify: `packages/web/src/__tests__/components/RoomList.test.ts`
- Create: `packages/web/src/__tests__/components/MiscBucket.test.ts`

Both consumer components shift to using `EntityRow` with a `<details>` reveal.

- [ ] **Step 1: Read the existing RoomList**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides/packages/web/src/components/RoomList.vue
```

- [ ] **Step 2: Modify `RoomList.vue` to use `<details>` + `EntityRow`**

Replace the contents of `packages/web/src/components/RoomList.vue`:

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { roomIdToIcon } from '../icons.js'
import EntityRow from './EntityRow.vue'
import type { AnalyzedRoom } from '../api/types.js'

defineProps<{ rooms: AnalyzedRoom[] }>()

function confidencePillClass(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800'
  if (confidence >= 0.5) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}% avg confidence`
}
</script>

<template>
  <div
    v-if="rooms.length === 0"
    class="rounded border border-stone-200 bg-stone-50 p-6 text-sm text-stone-600"
  >
    No rooms detected — check that your HA install has at least one area assigned to entities or
    device names matching room patterns.
  </div>

  <ul v-else class="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
    <li v-for="room in rooms" :key="room.id" data-testid="room-row">
      <details class="group">
        <summary
          class="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 hover:bg-stone-50"
        >
          <div class="flex items-center gap-3">
            <Icon :icon="roomIdToIcon(room.id)" class="h-5 w-5 text-stone-700" />
            <span class="text-sm font-medium text-stone-900">{{ room.displayName }}</span>
          </div>

          <div class="flex items-center gap-3 text-xs text-stone-600">
            <span>{{ room.entityCount }} entities</span>
            <span
              data-testid="confidence-pill"
              class="rounded px-2 py-0.5 text-xs font-medium"
              :class="confidencePillClass(room.averageConfidence)"
            >
              {{ confidenceLabel(room.averageConfidence) }}
            </span>
          </div>
        </summary>

        <ul class="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/30">
          <li v-for="a in room.assignments" :key="a.entityId">
            <EntityRow
              :entity-id="a.entityId"
              :friendly-name="entityIdToFriendly(a.entityId, room.assignments)"
              :room-id="a.roomId"
              :manual="a.manual"
            />
          </li>
        </ul>
      </details>
    </li>
  </ul>
</template>

<script lang="ts">
/**
 * `RoomAssignment` doesn't carry `friendlyName`. The misc bucket has
 * its own field for that (it comes from a different server type).
 * Until the API surfaces friendlyName on assignments, derive a fallback
 * from the entityId — readable enough for the alpha demo.
 */
function entityIdToFriendly(entityId: string, _all: { entityId: string }[]): string {
  // light.kitchen_ceiling → Kitchen Ceiling
  const parts = entityId.split('.')
  if (parts.length < 2) return entityId
  const objectId = parts.slice(1).join('.')
  return objectId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
</script>
```

Note the second `<script>` block — it provides the `entityIdToFriendly` helper at module scope so the template can call it. Vue 3 SFCs allow one `<script setup>` plus one optional `<script>` block.

- [ ] **Step 3: Modify `MiscBucket.vue` to use `EntityRow`**

Replace `packages/web/src/components/MiscBucket.vue`:

```vue
<script setup lang="ts">
import EntityRow from './EntityRow.vue'
import type { MiscEntity } from '../api/types.js'

defineProps<{ misc: MiscEntity[] }>()
</script>

<template>
  <details v-if="misc.length > 0" class="rounded-lg border border-stone-200 bg-white">
    <summary class="cursor-pointer px-5 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">
      {{ misc.length }} entities not assigned to any room
    </summary>
    <ul class="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/30">
      <li v-for="entity in misc" :key="entity.entityId">
        <EntityRow
          :entity-id="entity.entityId"
          :friendly-name="entity.friendlyName"
          room-id="misc"
        />
      </li>
    </ul>
  </details>
</template>
```

- [ ] **Step 4: Update `RoomList.test.ts`**

Read `packages/web/src/__tests__/components/RoomList.test.ts` first to see the existing structure. Add a new test verifying the `<details>` reveal renders `EntityRow`s when expanded.

Append to the existing describe block (and add the necessary imports at the top):

```ts
// Append the imports if missing:
import { createTestingPinia } from '@pinia/testing'
import type { AnalyzedRoom } from '../../api/types.js'

// Append in the describe('RoomList', ...) block:

it('expands to show one EntityRow per assignment', () => {
  const room: AnalyzedRoom = {
    id: 'kitchen',
    haAreaId: 'kitchen',
    displayName: 'Kitchen',
    entityCount: 2,
    averageConfidence: 0.9,
    assignments: [
      { entityId: 'light.a', roomId: 'kitchen', confidence: 0.9, signals: [] },
      { entityId: 'sensor.b', roomId: 'kitchen', confidence: 0.85, signals: [] },
    ],
  }
  const wrapper = mount(RoomList, {
    props: { rooms: [room] },
    global: {
      plugins: [createTestingPinia({ stubActions: false })],
    },
  })

  // <details> exists with the room as summary
  expect(wrapper.find('details').exists()).toBe(true)
  // Two EntityRows inside
  const rows = wrapper.findAll('[data-testid="entity-row"]')
  expect(rows).toHaveLength(2)
  expect(rows[0]!.text()).toContain('light.a')
  expect(rows[1]!.text()).toContain('sensor.b')
})
```

If the existing test file doesn't import `mount` from `@vue/test-utils`, add it. If it doesn't have `RoomList` imported, add the import. The plan shows the additive snippet — adapt to the existing file's structure.

- [ ] **Step 5: Create `MiscBucket.test.ts`**

Create `packages/web/src/__tests__/components/MiscBucket.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import MiscBucket from '../../components/MiscBucket.vue'
import type { MiscEntity } from '../../api/types.js'

function mountBucket(misc: MiscEntity[]) {
  return mount(MiscBucket, {
    props: { misc },
    global: {
      plugins: [createTestingPinia({ stubActions: false })],
    },
  })
}

describe('MiscBucket', () => {
  it('does not render when misc is empty', () => {
    const wrapper = mountBucket([])
    expect(wrapper.find('details').exists()).toBe(false)
  })

  it('renders summary count when misc is non-empty', () => {
    const wrapper = mountBucket([
      { entityId: 'a.b', friendlyName: 'A', domain: 'sensor' },
      { entityId: 'c.d', friendlyName: 'B', domain: 'sensor' },
    ])
    expect(wrapper.find('summary').text()).toContain('2')
  })

  it('renders one EntityRow per misc entity', () => {
    const wrapper = mountBucket([
      { entityId: 'a.b', friendlyName: 'Entity A', domain: 'sensor' },
      { entityId: 'c.d', friendlyName: 'Entity B', domain: 'sensor' },
    ])
    const rows = wrapper.findAll('[data-testid="entity-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('a.b')
    expect(rows[0]!.text()).toContain('Entity A')
    expect(rows[1]!.text()).toContain('c.d')
    expect(rows[1]!.text()).toContain('Entity B')
  })
})
```

- [ ] **Step 6: Run the affected component tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides vitest run packages/web/src/__tests__/components/RoomList.test.ts packages/web/src/__tests__/components/MiscBucket.test.ts
```

Expected: PASS — RoomList tests (existing + 1 new) and MiscBucket tests (3 new) all green.

- [ ] **Step 7: Run full workspace tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides -r test
```

Both green.

- [ ] **Step 8: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides add packages/web/src/components/RoomList.vue packages/web/src/components/MiscBucket.vue packages/web/src/__tests__/components/RoomList.test.ts packages/web/src/__tests__/components/MiscBucket.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides commit -m "$(cat <<'EOF'
feat(web): RoomList + MiscBucket use EntityRow inside <details> reveals

RoomList: each room row becomes a <details> element. Summary stays
the icon + name + count + confidence pill (unchanged collapsed
layout). Expanded content lists one EntityRow per assignment.
A small entityIdToFriendly helper produces a Title-Case label from
the entity_id since the assignment payload doesn't carry
friendlyName yet — good-enough fallback for the alpha demo.

MiscBucket: existing <details> reveal kept; bare <li> list replaced
with EntityRow per misc entity. Misc entities pass roomId='misc' so
the dropdown shows "— let detector decide —" by default.

One new RoomList test (expands to N EntityRows). New MiscBucket
test file with three tests (empty, count summary, EntityRow
rendering).

P1b-4 layer 4 of 6 (RoomList + MiscBucket integration).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `OverridesBar` component

**Files:**

- Create: `packages/web/src/components/OverridesBar.vue`
- Create: `packages/web/src/__tests__/components/OverridesBar.test.ts`

The pending-changes bar between MiscBucket and DashboardPreview.

- [ ] **Step 1: Write the failing test file**

Create `packages/web/src/__tests__/components/OverridesBar.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import OverridesBar from '../../components/OverridesBar.vue'
import { useOverridesStore } from '../../stores/overrides.js'
import type { ApiError } from '../../api/types.js'

function mountBar() {
  return mount(OverridesBar, {
    global: {
      plugins: [createTestingPinia({ stubActions: false })],
    },
  })
}

describe('OverridesBar', () => {
  it('does not render when hasDirty is false', () => {
    const wrapper = mountBar()
    expect(wrapper.find('[data-testid="overrides-bar"]').exists()).toBe(false)
  })

  it('renders dirty count when hasDirty is true', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    store.setRoomId('a.b', 'kitchen')
    store.setRoomId('c.d', 'bedroom')

    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="overrides-bar"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('2 pending changes')
  })

  it('renders "1 pending change" (singular) for a single edit', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    store.setRoomId('a.b', 'kitchen')

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('1 pending change')
    expect(wrapper.text()).not.toContain('1 pending changes')
  })

  it('Discard button calls discardChanges', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    store.setRoomId('a.b', 'kitchen')

    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="discard-button"]').trigger('click')

    expect(store.hasDirty).toBe(false)
  })

  it('Save button calls saveAndReanalyze', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    const saveSpy = vi.spyOn(store, 'saveAndReanalyze').mockResolvedValueOnce(undefined)
    store.setRoomId('a.b', 'kitchen')

    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(saveSpy).toHaveBeenCalledOnce()
  })

  it('shows "Saving…" and disables both buttons during phase=saving', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    store.setRoomId('a.b', 'kitchen')
    store.$patch({ phase: 'saving' })

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Saving…')
    const saveBtn = wrapper.find('[data-testid="save-button"]')
    const discardBtn = wrapper.find('[data-testid="discard-button"]')
    expect((saveBtn.element as HTMLButtonElement).disabled).toBe(true)
    expect((discardBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows error message and Retry button on phase=error', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    store.setRoomId('a.b', 'kitchen')
    const apiError: ApiError = { error: 'storage_error', message: 'disk full' }
    store.$patch({ phase: 'error', error: apiError })

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('disk full')
    expect(wrapper.find('[data-testid="retry-button"]').exists()).toBe(true)
  })

  it('Retry button calls saveAndReanalyze', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    const saveSpy = vi.spyOn(store, 'saveAndReanalyze').mockResolvedValueOnce(undefined)
    store.setRoomId('a.b', 'kitchen')
    store.$patch({ phase: 'error', error: { error: 'storage_error', message: 'oops' } })

    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="retry-button"]').trigger('click')

    expect(saveSpy).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides vitest run packages/web/src/__tests__/components/OverridesBar.test.ts
```

Expected: FAIL with "Cannot find module '../../components/OverridesBar.vue'".

- [ ] **Step 3: Create the component**

Create `packages/web/src/components/OverridesBar.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useOverridesStore } from '../stores/overrides.js'

const overrides = useOverridesStore()

const countLabel = computed(() => {
  const n = overrides.dirtyCount
  return `${n} pending change${n === 1 ? '' : 's'}`
})

const isSaving = computed(() => overrides.phase === 'saving')
const isError = computed(() => overrides.phase === 'error')

function onDiscard() {
  overrides.discardChanges()
}

function onSave() {
  void overrides.saveAndReanalyze()
}
</script>

<template>
  <section
    v-if="overrides.hasDirty"
    data-testid="overrides-bar"
    class="flex flex-col gap-3 rounded-lg border px-5 py-3 text-sm"
    :class="
      isError
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-amber-200 bg-amber-50 text-amber-900'
    "
  >
    <div class="flex items-center justify-between gap-3">
      <span class="font-medium">
        {{ isSaving ? 'Saving…' : countLabel }}
      </span>

      <div v-if="!isError" class="flex gap-2">
        <button
          data-testid="discard-button"
          type="button"
          class="rounded bg-stone-600 px-3 py-1 text-xs font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isSaving"
          @click="onDiscard"
        >
          Discard
        </button>
        <button
          data-testid="save-button"
          type="button"
          class="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isSaving"
          @click="onSave"
        >
          {{ isSaving ? 'Saving…' : 'Save & re-analyze' }}
        </button>
      </div>
    </div>

    <div v-if="isError && overrides.error !== null" class="flex items-center justify-between gap-3">
      <span>{{ overrides.error.message }}</span>
      <button
        data-testid="retry-button"
        type="button"
        class="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
        @click="onSave"
      >
        Retry
      </button>
    </div>
  </section>
</template>
```

- [ ] **Step 4: Run the OverridesBar tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides vitest run packages/web/src/__tests__/components/OverridesBar.test.ts
```

Expected: PASS — 8 tests.

- [ ] **Step 5: Run full workspace tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides -r test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides add packages/web/src/components/OverridesBar.vue packages/web/src/__tests__/components/OverridesBar.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides commit -m "$(cat <<'EOF'
feat(web): OverridesBar pending-changes bar

Sits between MiscBucket and DashboardPreview, visible only when
overrides.hasDirty is true. Shows "N pending change(s)" + Discard
and Save & re-analyze buttons. Pluralization is correct for both
singular and plural cases.

While saving: both buttons disabled, label shows "Saving…".
On save error: bar turns red, error message shown, Retry button
calls saveAndReanalyze again. Mirrors the existing ApplyBar's
error/retry pattern for visual consistency.

Eight tests cover all visible states: hidden when clean, count
display (singular + plural), discard/save dispatch, saving state,
error display, and retry.

P1b-4 layer 5 of 6 (overrides bar).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `App.vue` wiring + integration test

**Files:**

- Modify: `packages/web/src/App.vue`
- Create: `packages/web/src/__tests__/App.test.ts`

Last layer — wire `OverridesBar` into the layout and add the `loadFromServer` watcher.

- [ ] **Step 1: Modify `App.vue`**

Replace `packages/web/src/App.vue`:

```vue
<script setup lang="ts">
import { watch } from 'vue'
import HealthBar from './components/HealthBar.vue'
import AnalyzeButton from './components/AnalyzeButton.vue'
import RoomList from './components/RoomList.vue'
import MiscBucket from './components/MiscBucket.vue'
import OverridesBar from './components/OverridesBar.vue'
import DashboardPreview from './components/DashboardPreview.vue'
import ApplyBar from './components/ApplyBar.vue'
import { useAnalyzeStore } from './stores/analyze.js'
import { useOverridesStore } from './stores/overrides.js'

const analyze = useAnalyzeStore()
const overrides = useOverridesStore()

// First time analyze.phase becomes 'ready', load the user's saved
// overrides so the UI reflects them. Subsequent re-analyzes (triggered
// by saveAndReanalyze) don't need to re-load — the store's serverState
// is kept in sync by the save flow.
let loadedOnce = false
watch(
  () => analyze.phase,
  (phase) => {
    if (phase === 'ready' && !loadedOnce) {
      loadedOnce = true
      void overrides.loadFromServer()
    }
  },
)
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-6 p-8">
    <header>
      <h1 class="text-3xl font-semibold text-stone-900">Lovelacer</h1>
      <p class="text-sm text-stone-600">Home Assistant dashboard generator · alpha</p>
    </header>

    <HealthBar />

    <section class="flex justify-center">
      <AnalyzeButton />
    </section>

    <section
      v-if="analyze.phase === 'error' && analyze.error !== null"
      class="rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-900"
    >
      <div class="flex items-center justify-between">
        <span>{{ analyze.error.message }}</span>
        <button
          type="button"
          class="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          @click="analyze.analyze()"
        >
          Retry
        </button>
      </div>
    </section>

    <section v-if="analyze.phase === 'ready' && analyze.preview !== null" class="space-y-4">
      <RoomList :rooms="analyze.preview.rooms" />
      <MiscBucket :misc="analyze.preview.misc" />
      <OverridesBar />
      <DashboardPreview :config="analyze.preview.config" />
      <ApplyBar />
    </section>
  </main>
</template>
```

- [ ] **Step 2: Create `App.test.ts`**

Create `packages/web/src/__tests__/App.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import App from '../App.vue'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useOverridesStore } from '../stores/overrides.js'
import type { PreviewOutput } from '../api/types.js'

vi.mock('../api/client.js', () => ({
  postPreview: vi.fn(),
  postApply: vi.fn(),
  getOverrides: vi.fn(),
  putOverrides: vi.fn(),
}))

const { postPreview, getOverrides, putOverrides } = await import('../api/client.js')

const mockPreview: PreviewOutput = {
  rooms: [
    {
      id: 'kitchen',
      haAreaId: 'kitchen',
      displayName: 'Kitchen',
      entityCount: 1,
      averageConfidence: 0.9,
      assignments: [
        { entityId: 'light.kitchen_ceiling', roomId: 'kitchen', confidence: 0.9, signals: [] },
      ],
    },
  ],
  misc: [],
  summary: { entityCount: 1, roomCount: 1, miscCount: 0 },
  config: { title: 'Lovelacer — Home', views: [] },
}

describe('App integration', () => {
  beforeEach(() => {
    vi.mocked(postPreview).mockReset()
    vi.mocked(getOverrides).mockReset()
    vi.mocked(putOverrides).mockReset()
  })

  it('triggers loadFromServer when analyze.phase transitions to ready', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({ overrides: [] })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false })],
      },
    })
    const analyze = useAnalyzeStore()

    // Simulate a successful analyze
    analyze.$patch({ phase: 'ready', preview: mockPreview })
    await wrapper.vm.$nextTick()

    expect(getOverrides).toHaveBeenCalledOnce()
  })

  it('loadFromServer fires once even on multiple ready transitions', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({ overrides: [] })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false })],
      },
    })
    const analyze = useAnalyzeStore()

    analyze.$patch({ phase: 'ready', preview: mockPreview })
    await wrapper.vm.$nextTick()
    analyze.$patch({ phase: 'loading' })
    await wrapper.vm.$nextTick()
    analyze.$patch({ phase: 'ready' })
    await wrapper.vm.$nextTick()

    // Only the first ready transition triggers the load.
    expect(getOverrides).toHaveBeenCalledOnce()
  })

  it('end-to-end: edit → save → re-analyze flow', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({ overrides: [] })
    vi.mocked(putOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'light.kitchen_ceiling', roomId: 'living_room' }],
    })
    vi.mocked(postPreview).mockResolvedValueOnce(mockPreview)

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false })],
      },
    })
    const analyze = useAnalyzeStore()
    const overrides = useOverridesStore()

    // Bring app to ready state
    analyze.$patch({ phase: 'ready', preview: mockPreview })
    await wrapper.vm.$nextTick()

    // User edits
    overrides.setRoomId('light.kitchen_ceiling', 'living_room')
    await wrapper.vm.$nextTick()

    // OverridesBar visible with 1 pending change
    expect(wrapper.find('[data-testid="overrides-bar"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('1 pending change')

    // User clicks Save
    await wrapper.find('[data-testid="save-button"]').trigger('click')
    // Wait for async save + reanalyze chain
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(putOverrides).toHaveBeenCalledWith({
      overrides: [{ entityId: 'light.kitchen_ceiling', roomId: 'living_room' }],
    })
    expect(postPreview).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run the new App tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides vitest run packages/web/src/__tests__/App.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 4: Run full workspace tests + format + lint**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides -r test
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides format:check
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides lint
```

All four green. If `format:check` fails, run `pnpm --dir <worktree> format`, re-stage, and retry.

- [ ] **Step 5: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides add packages/web/src/App.vue packages/web/src/__tests__/App.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-4-frontend-overrides commit -m "$(cat <<'EOF'
feat(web): wire OverridesBar into App + loadFromServer on first ready

Final P1b-4 layer. App.vue gains a watcher on analyze.phase that
calls overrides.loadFromServer() the first time phase becomes
'ready'. Subsequent re-analyzes (triggered by saveAndReanalyze)
don't re-load — the store's serverState is kept in sync by the
save flow itself.

OverridesBar slotted between MiscBucket and DashboardPreview, so
the user-edit flow naturally reads top-to-bottom: rooms → misc →
pending changes → preview → apply.

Three integration tests through the App component:
- loadFromServer fires when phase transitions to ready
- loadFromServer fires only once across multiple ready transitions
- End-to-end: edit dropdown → click Save → PUT + re-analyze called

Closes P1b-4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1b-4 Acceptance Confirmation

- [ ] `Override` type + `RoomAssignment.manual?: boolean` in web's `api/types.ts`.
- [ ] `getOverrides()` and `putOverrides()` in API client.
- [ ] `useOverridesStore()` Pinia store with two-map model and computed `effective(entityId)`.
- [ ] `EntityRow.vue` renders dropdown + hide toggle + override-row treatment; controls disabled during save; hidden entities show "(hidden)" with reduced opacity.
- [ ] `RoomList.vue` rooms expand via `<details>` to reveal one `EntityRow` per assignment.
- [ ] `MiscBucket.vue` uses `EntityRow` per misc entity.
- [ ] `OverridesBar.vue` shows pending count + Discard + Save buttons; visible only when `hasDirty`; saving + error states handled.
- [ ] `App.vue` triggers `loadFromServer()` on first `analyze.phase === 'ready'`.
- [ ] Save flow PUTs the merged list, refreshes `serverState`, clears `dirtyState`, calls `analyze.analyze()`.
- [ ] Discard flow clears `dirtyState` without server contact.
- [ ] Override-row treatment applied when `effective !== null` OR `assignment.manual === true`.
- [ ] Tests: 13 store tests, 4 API client tests, 11 EntityRow tests, 1 RoomList addition, 3 MiscBucket tests, 8 OverridesBar tests, 3 App integration tests.
- [ ] `pnpm typecheck`, `pnpm -r test`, `pnpm format:check`, `pnpm lint` all clean.
