# P1b-3 Overrides Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent SQLite-backed per-entity overrides (room reassignment + hide flag) with a GET/PUT API, applied transparently during analyze/preview/apply.

**Architecture:** New `OverrideStore` class (better-sqlite3) lives in `packages/server/src/storage/`. Free function `applyOverrides` mutates `RoomAssignment[]` and `NormalizedEntity[]` in `packages/server/src/pipeline.ts` between detect and group. New Fastify route plugin `overridesRoute` registered in `app.ts`. `runFullPipeline` gains a required `overrides: OverrideStore` parameter; existing routes thread it through.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), better-sqlite3 (already in `packages/server/package.json`), zod for request validation, Vitest (`globals: false`), Fastify plugins.

**Spec reference:** [`docs/superpowers/specs/2026-05-01-p1b-3-overrides-storage-design.md`](../specs/2026-05-01-p1b-3-overrides-storage-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions even when importing TS source.
- Type-only imports use `import type { … } from '…'` (verbatimModuleSyntax).
- Tests use `import { describe, it, expect } from 'vitest'`.
- All commands run from worktree: `pnpm --dir <worktree>` and `git -C <worktree>`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- After each task, run `pnpm typecheck && pnpm -r test` to verify nothing regressed.

---

## File structure

**New files:**

- `packages/shared/src/overrides.ts` — `Override` type
- `packages/server/src/storage/override-store.ts` — `OverrideStore` class
- `packages/server/src/storage/__tests__/override-store.test.ts` — store unit tests
- `packages/server/src/__tests__/apply-overrides.test.ts` — pipeline patch helper tests
- `packages/server/src/routes/overrides.ts` — Fastify route plugin
- `packages/server/src/__tests__/routes/overrides.test.ts` — route tests

**Modified files:**

- `packages/shared/src/types.ts` — add `manual?: boolean` to `RoomAssignment`
- `packages/shared/src/index.ts` — re-export `Override`
- `packages/server/src/pipeline.ts` — add `applyOverrides` helper, change `runFullPipeline` signature, thread store through `runAnalyze`/`runPreview`/`runApply`
- `packages/server/src/app.ts` — accept `overrides: OverrideStore` in options, register `overridesRoute`, pass `overrides` to existing route registrations
- `packages/server/src/main.ts` — instantiate `OverrideStore` from `config.dataDir`, pass to `createApp`
- `packages/server/src/routes/analyze.ts` — accept `overrides` in plugin opts, pass to `runAnalyze`
- `packages/server/src/routes/preview.ts` — same
- `packages/server/src/routes/apply.ts` — same
- `packages/server/src/__tests__/pipeline.test.ts` — update fake HA setup to pass a store; add override integration tests
- `packages/server/src/__tests__/routes/analyze.test.ts` — update `createApp` call to pass a store
- `packages/server/src/__tests__/routes/preview.test.ts` — same
- `packages/server/src/__tests__/routes/apply.test.ts` — same

---

## Task 1: Add `Override` shared type + `RoomAssignment.manual`

**Files:**

- Create: `packages/shared/src/overrides.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/types.ts`

Pure type additions. No runtime behavior, no tests beyond typecheck.

- [ ] **Step 1: Create the `Override` type file**

Create `packages/shared/src/overrides.ts`:

```ts
import type { CanonicalRoomId } from './constants.js'

/**
 * User-specified override for a single entity. At least one of `roomId`
 * or `hidden` must be set (enforced by API zod validator and DB CHECK
 * constraint).
 *
 * - `roomId` set: assignment is moved to that room (`confidence` becomes
 *   `1.0` and `manual: true` on the resulting `RoomAssignment`).
 * - `hidden: true`: entity is OR-merged into `NormalizedEntity.isHidden`
 *   so existing hidden filters drop it from views.
 *
 * P1b-3 storage in SQLite; P1b-4 frontend UI.
 */
export interface Override {
  entityId: string
  roomId?: CanonicalRoomId
  hidden?: boolean
}
```

- [ ] **Step 2: Re-export from the shared barrel**

Read `packages/shared/src/index.ts`. Add the `Override` type export. The file becomes:

```ts
export * from './constants.js'
export * from './types.js'
export type { Override } from './overrides.js'
export { ROOM_KEYWORDS } from './room-keywords.js'
```

- [ ] **Step 3: Add `manual?: boolean` to `RoomAssignment`**

Read `packages/shared/src/types.ts`. Find the existing `RoomAssignment` interface (around line 101). Replace it to add the `manual` field:

```ts
export interface RoomAssignment {
  entityId: string
  roomId: CanonicalRoomId
  confidence: number
  /**
   * True iff this assignment was overridden by user override (P1b-3).
   * Detector-produced assignments leave this undefined; the override
   * patch step in `runFullPipeline` sets it.
   */
  manual?: boolean
}
```

If the existing `RoomAssignment` has additional fields beyond `entityId/roomId/confidence`, preserve them — only ADD `manual?: boolean`.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides typecheck
```

Expected: PASS. Nothing emits `manual` yet; the optional field is structurally compatible with all existing call sites.

- [ ] **Step 5: Verify the broader build still passes**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides -r test
```

Expected: PASS. No tests reference `Override` or `manual` yet.

- [ ] **Step 6: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides add packages/shared/src/overrides.ts \
        packages/shared/src/index.ts \
        packages/shared/src/types.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides commit -m "$(cat <<'EOF'
feat(shared): add Override type and RoomAssignment.manual flag

Pure type additions for P1b-3. Override is the user-facing shape
({ entityId, roomId?, hidden? }) that the SQLite store and the
/api/overrides route exchange. RoomAssignment gains an optional
manual: boolean flag, set to true by the pipeline patch step when
a roomId override applies — lets the frontend distinguish "you set
this" from "the analyzer found this".

Re-exported from the package barrel as a type-only export.

P1b-3 layer 1 of 6 (shared types).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `OverrideStore` class + `:memory:` tests

**Files:**

- Create: `packages/server/src/storage/override-store.ts`
- Create: `packages/server/src/storage/__tests__/override-store.test.ts`

Wraps `better-sqlite3`. The class has three methods: `getAll`, `replaceAll`, and a `close` for tests.

- [ ] **Step 1: Write the failing test file (skeleton)**

Create `packages/server/src/storage/__tests__/override-store.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import type { Override } from '@lovelacer/shared'
import { OverrideStore } from '../override-store.js'

let store: OverrideStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

function makeStore(): OverrideStore {
  store = new OverrideStore(':memory:')
  return store
}

describe('OverrideStore', () => {
  it('getAll on empty DB returns empty array', () => {
    const s = makeStore()
    expect(s.getAll()).toEqual([])
  })

  it('replaceAll([]) on empty DB stays empty', () => {
    const s = makeStore()
    s.replaceAll([])
    expect(s.getAll()).toEqual([])
  })

  it('round-trip: roomId-only override', () => {
    const s = makeStore()
    const overrides: Override[] = [{ entityId: 'light.kitchen_ceiling', roomId: 'living_room' }]
    s.replaceAll(overrides)
    expect(s.getAll()).toEqual(overrides)
  })

  it('round-trip: hidden-only override', () => {
    const s = makeStore()
    const overrides: Override[] = [{ entityId: 'sensor.diagnostic', hidden: true }]
    s.replaceAll(overrides)
    expect(s.getAll()).toEqual(overrides)
  })

  it('round-trip: combined roomId + hidden override', () => {
    const s = makeStore()
    const overrides: Override[] = [{ entityId: 'media_player.tv', roomId: 'bedroom', hidden: true }]
    s.replaceAll(overrides)
    expect(s.getAll()).toEqual(overrides)
  })

  it('replaceAll wipes existing rows before inserting', () => {
    const s = makeStore()
    s.replaceAll([{ entityId: 'a.b', roomId: 'kitchen' }])
    s.replaceAll([{ entityId: 'c.d', hidden: true }])
    expect(s.getAll()).toEqual([{ entityId: 'c.d', hidden: true }])
  })

  it('replaceAll is atomic — rejects bad row, prior contents intact', () => {
    const s = makeStore()
    s.replaceAll([{ entityId: 'a.b', roomId: 'kitchen' }])
    expect(() =>
      // @ts-expect-error — deliberately bypass TS to trigger the SQL CHECK
      s.replaceAll([{ entityId: 'c.d', roomId: 'bedroom' }, { entityId: 'e.f' }]),
    ).toThrow()
    expect(s.getAll()).toEqual([{ entityId: 'a.b', roomId: 'kitchen' }])
  })

  it('does not return updated_at in the read shape', () => {
    const s = makeStore()
    s.replaceAll([{ entityId: 'a.b', roomId: 'kitchen' }])
    const result = s.getAll()
    expect(result[0]).toEqual({ entityId: 'a.b', roomId: 'kitchen' })
    expect(result[0]).not.toHaveProperty('updated_at')
    expect(result[0]).not.toHaveProperty('updatedAt')
  })

  it('returns multiple overrides ordered by entityId for deterministic API output', () => {
    const s = makeStore()
    s.replaceAll([
      { entityId: 'z.last', hidden: true },
      { entityId: 'a.first', roomId: 'kitchen' },
      { entityId: 'm.middle', roomId: 'bedroom' },
    ])
    const ids = s.getAll().map((o) => o.entityId)
    expect(ids).toEqual(['a.first', 'm.middle', 'z.last'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides vitest run packages/server/src/storage/__tests__/override-store.test.ts
```

Expected: FAIL with "Cannot find module '../override-store.js'".

- [ ] **Step 3: Create the `OverrideStore` class**

Create `packages/server/src/storage/override-store.ts`:

```ts
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database, { type Database as DatabaseType } from 'better-sqlite3'
import type { Override } from '@lovelacer/shared'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS overrides (
    entity_id   TEXT    PRIMARY KEY,
    room_id     TEXT,
    hidden      INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    CHECK (room_id IS NOT NULL OR hidden = 1)
  );
`

interface OverrideRow {
  entity_id: string
  room_id: string | null
  hidden: number
}

/**
 * SQLite-backed persistence for per-entity user overrides.
 *
 * Single-tenant — one DB file per add-on install. Methods are synchronous
 * because better-sqlite3 is synchronous; that's a deliberate library
 * choice for low-volume single-writer workloads.
 *
 * Constructor accepts ':memory:' for tests so each test gets an isolated
 * DB. For file paths, the parent dir is created if missing.
 */
export class OverrideStore {
  private readonly db: DatabaseType

  constructor(filename: string) {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true })
    }
    this.db = new Database(filename)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)
  }

  /**
   * Returns all overrides ordered by `entity_id` ascending so the API
   * response is deterministic and easy to diff in tests / by humans.
   */
  getAll(): Override[] {
    const rows = this.db
      .prepare<
        [],
        OverrideRow
      >('SELECT entity_id, room_id, hidden FROM overrides ORDER BY entity_id')
      .all()
    return rows.map((row) => rowToOverride(row))
  }

  /**
   * Replaces the entire `overrides` table contents in a single
   * transaction. If any insert fails (e.g., CHECK constraint violation),
   * the whole transaction rolls back and the previous contents are
   * preserved.
   */
  replaceAll(overrides: Override[]): void {
    const deleteAll = this.db.prepare('DELETE FROM overrides')
    const insert = this.db.prepare(`
      INSERT INTO overrides (entity_id, room_id, hidden)
      VALUES (@entity_id, @room_id, @hidden)
    `)
    const tx = this.db.transaction((items: Override[]) => {
      deleteAll.run()
      for (const o of items) {
        insert.run({
          entity_id: o.entityId,
          room_id: o.roomId ?? null,
          hidden: o.hidden === true ? 1 : 0,
        })
      }
    })
    tx(overrides)
  }

  /** Closes the underlying DB. Used in tests to release `:memory:` handles. */
  close(): void {
    this.db.close()
  }
}

function rowToOverride(row: OverrideRow): Override {
  const o: Override = { entityId: row.entity_id }
  if (row.room_id !== null) o.roomId = row.room_id as Override['roomId']
  if (row.hidden === 1) o.hidden = true
  return o
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides vitest run packages/server/src/storage/__tests__/override-store.test.ts
```

Expected: PASS — 9 tests.

- [ ] **Step 5: Run full workspace tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides -r test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides add packages/server/src/storage/override-store.ts \
        packages/server/src/storage/__tests__/override-store.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides commit -m "$(cat <<'EOF'
feat(server): OverrideStore class for SQLite-backed override persistence

First module under packages/server/src/storage/. Wraps better-sqlite3
with a 3-method API: getAll() returns all overrides ordered by
entityId, replaceAll() atomically swaps the whole table contents in
one transaction, close() releases the DB handle (mainly for tests).

Schema: single overrides table with entity_id PK, nullable room_id,
hidden INTEGER (0/1), updated_at unixepoch, plus a CHECK constraint
that rejects no-op rows (room_id NULL AND hidden = 0). The CHECK is
defense-in-depth alongside the route's zod refine.

Constructor accepts ':memory:' for isolated test DBs; for file paths,
the parent dir is created if missing (mkdir -p semantics) so the
add-on first run on a fresh /data volume just works.

WAL journal mode for safe concurrent reads (HA panel + future cron
jobs) — single-writer pattern stays correct.

P1b-3 layer 2 of 6 (storage class).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `applyOverrides` helper + tests

**Files:**

- Modify: `packages/server/src/pipeline.ts` (add the helper; do NOT call it yet)
- Create: `packages/server/src/__tests__/apply-overrides.test.ts`

The helper is a pure function, exported from `pipeline.ts` for testability. Task 5 wires it into `runFullPipeline`.

- [ ] **Step 1: Write the failing test file**

Create `packages/server/src/__tests__/apply-overrides.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { NormalizedEntity, Override, RoomAssignment } from '@lovelacer/shared'
import { applyOverrides } from '../pipeline.js'

function makeAssignment(entityId: string, roomId: RoomAssignment['roomId']): RoomAssignment {
  return { entityId, roomId, confidence: 0.6 }
}

function makeEntity(entityId: string, isHidden = false): NormalizedEntity {
  return {
    entityId,
    domain: entityId.split('.')[0]!,
    objectId: entityId.split('.')[1]!,
    friendlyName: entityId,
    haAreaId: null,
    haDeviceId: null,
    deviceClass: null,
    isHidden,
    isDisabled: false,
    nameSignals: [],
  }
}

describe('applyOverrides', () => {
  it('empty overrides → no mutation', () => {
    const assignments = [makeAssignment('light.a', 'kitchen')]
    const entities = [makeEntity('light.a')]
    applyOverrides({ assignments, entities }, [])
    expect(assignments[0]!.roomId).toBe('kitchen')
    expect(assignments[0]!.confidence).toBe(0.6)
    expect(assignments[0]!.manual).toBeUndefined()
    expect(entities[0]!.isHidden).toBe(false)
  })

  it('roomId override updates roomId, sets confidence=1.0 and manual=true', () => {
    const assignments = [makeAssignment('light.a', 'kitchen')]
    const entities = [makeEntity('light.a')]
    const overrides: Override[] = [{ entityId: 'light.a', roomId: 'living_room' }]
    applyOverrides({ assignments, entities }, overrides)
    expect(assignments[0]!.roomId).toBe('living_room')
    expect(assignments[0]!.confidence).toBe(1.0)
    expect(assignments[0]!.manual).toBe(true)
  })

  it('hidden:true override OR-merges entity.isHidden', () => {
    const assignments = [makeAssignment('sensor.x', 'kitchen')]
    const entities = [makeEntity('sensor.x', false)]
    const overrides: Override[] = [{ entityId: 'sensor.x', hidden: true }]
    applyOverrides({ assignments, entities }, overrides)
    expect(entities[0]!.isHidden).toBe(true)
  })

  it('hidden:true does not flip isHidden=true back to false', () => {
    const assignments = [makeAssignment('sensor.x', 'kitchen')]
    const entities = [makeEntity('sensor.x', true)]
    const overrides: Override[] = [{ entityId: 'sensor.x', hidden: true }]
    applyOverrides({ assignments, entities }, overrides)
    expect(entities[0]!.isHidden).toBe(true)
  })

  it('hidden:false (explicit) does NOT flip isHidden=true to false', () => {
    // The patch only OR-merges hidden=true; we never un-hide via override.
    const assignments = [makeAssignment('sensor.x', 'kitchen')]
    const entities = [makeEntity('sensor.x', true)]
    const overrides: Override[] = [{ entityId: 'sensor.x', hidden: false, roomId: 'kitchen' }]
    applyOverrides({ assignments, entities }, overrides)
    expect(entities[0]!.isHidden).toBe(true) // stays hidden
  })

  it('combined override (roomId + hidden) applies both', () => {
    const assignments = [makeAssignment('media_player.tv', 'kitchen')]
    const entities = [makeEntity('media_player.tv')]
    const overrides: Override[] = [{ entityId: 'media_player.tv', roomId: 'bedroom', hidden: true }]
    applyOverrides({ assignments, entities }, overrides)
    expect(assignments[0]!.roomId).toBe('bedroom')
    expect(assignments[0]!.manual).toBe(true)
    expect(entities[0]!.isHidden).toBe(true)
  })

  it('orphaned override (entityId not in assignments) silently no-ops', () => {
    const assignments = [makeAssignment('light.a', 'kitchen')]
    const entities = [makeEntity('light.a')]
    const overrides: Override[] = [{ entityId: 'light.gone', roomId: 'bedroom' }]
    applyOverrides({ assignments, entities }, overrides)
    expect(assignments[0]!.roomId).toBe('kitchen')
    expect(assignments[0]!.manual).toBeUndefined()
    expect(entities).toHaveLength(1) // no entity added
  })

  it('multiple overrides at once — each applies to its target', () => {
    const assignments = [
      makeAssignment('light.a', 'kitchen'),
      makeAssignment('light.b', 'bedroom'),
      makeAssignment('sensor.c', 'kitchen'),
    ]
    const entities = [makeEntity('light.a'), makeEntity('light.b'), makeEntity('sensor.c')]
    const overrides: Override[] = [
      { entityId: 'light.a', roomId: 'living_room' },
      { entityId: 'sensor.c', hidden: true },
    ]
    applyOverrides({ assignments, entities }, overrides)
    expect(assignments[0]!.roomId).toBe('living_room')
    expect(assignments[0]!.manual).toBe(true)
    expect(assignments[1]!.roomId).toBe('bedroom') // untouched
    expect(assignments[1]!.manual).toBeUndefined()
    expect(entities[2]!.isHidden).toBe(true)
    expect(entities[0]!.isHidden).toBe(false) // untouched
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides vitest run packages/server/src/__tests__/apply-overrides.test.ts
```

Expected: FAIL with "applyOverrides is not exported from pipeline.ts" or similar.

- [ ] **Step 3: Add `applyOverrides` to `pipeline.ts`**

Read `packages/server/src/pipeline.ts`. Add the import for `Override` to the existing import block from `@lovelacer/shared`:

```ts
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  HaAreaRegistryEntry,
  NormalizedEntity,
  Override,
  RoomAssignment,
} from '@lovelacer/shared'
```

Then add the `applyOverrides` function at module scope (place it just above `runFullPipeline`, after the `CANONICAL_ROOM_NAMES` constant — anywhere before its first call site is fine, but keep it near the pipeline core):

```ts
/**
 * Patches detector output with user overrides. Mutates `assignments` and
 * `entities` in place. Called by `runFullPipeline` between `detect` and
 * `groupByDomain`.
 *
 * - Each override with `roomId` set: replace the matching assignment's
 *   `roomId`, set `confidence = 1.0` and `manual = true`.
 * - Each override with `hidden: true`: OR-merge into the matching
 *   entity's `isHidden` so existing hidden filters drop it from views.
 *
 * Orphaned overrides (entityId not in assignments) silently no-op so
 * stale overrides from a since-removed integration don't blow up the
 * pipeline.
 */
export function applyOverrides(
  state: { assignments: RoomAssignment[]; entities: NormalizedEntity[] },
  overrides: Override[],
): void {
  if (overrides.length === 0) return // hot path

  const byEntityId = new Map(overrides.map((o) => [o.entityId, o]))

  for (const a of state.assignments) {
    const o = byEntityId.get(a.entityId)
    if (o?.roomId !== undefined) {
      a.roomId = o.roomId
      a.confidence = 1.0
      a.manual = true
    }
  }
  for (const e of state.entities) {
    const o = byEntityId.get(e.entityId)
    if (o?.hidden === true) {
      e.isHidden = true
    }
  }
}
```

Do NOT modify `runFullPipeline` to call `applyOverrides` yet. Task 5 does the wiring.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides vitest run packages/server/src/__tests__/apply-overrides.test.ts
```

Expected: PASS — 8 tests.

- [ ] **Step 5: Run full workspace tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides -r test
```

Both green. Existing pipeline tests still pass because `applyOverrides` isn't called from `runFullPipeline` yet.

- [ ] **Step 6: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides add packages/server/src/pipeline.ts \
        packages/server/src/__tests__/apply-overrides.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides commit -m "$(cat <<'EOF'
feat(server): applyOverrides pipeline patch helper

Pure data-transform helper that mutates RoomAssignment[] and
NormalizedEntity[] in place from a list of Override entries. Called
by runFullPipeline between detect and groupByDomain (wired in the
next layer).

Behavior:
- roomId override: replace assignment.roomId, set confidence=1.0,
  set manual=true.
- hidden:true override: OR-merge into entity.isHidden. Never flips
  hidden=true back to false (no un-hide path).
- Orphaned override (entityId not in current registry): silently
  no-ops so a stale row from a removed integration doesn't blow up
  the pipeline.

Eight unit tests pin each behavior. The function is exported but not
yet called — Task 5 wires it into runFullPipeline.

P1b-3 layer 3 of 6 (pipeline patch helper).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `/api/overrides` GET + PUT routes

**Files:**

- Create: `packages/server/src/routes/overrides.ts`
- Create: `packages/server/src/__tests__/routes/overrides.test.ts`

The route plugin accepts `overrides: OverrideStore` in opts. The tests instantiate a real store with `:memory:` so they exercise the storage layer too (pseudo-integration).

- [ ] **Step 1: Write the failing test file**

Create `packages/server/src/__tests__/routes/overrides.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { OverrideStore } from '../../storage/override-store.js'
import { overridesRoute } from '../../routes/overrides.js'

let store: OverrideStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

async function makeApp() {
  store = new OverrideStore(':memory:')
  const app = Fastify({ logger: false })
  await app.register(sensible)
  await app.register(overridesRoute, { overrides: store })
  return app
}

describe('GET /api/overrides', () => {
  it('returns 200 with empty array on a fresh store', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/api/overrides' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ overrides: [] })
    } finally {
      await app.close()
    }
  })

  it('returns the rows the store contains', async () => {
    const app = await makeApp()
    try {
      store!.replaceAll([{ entityId: 'a.b', roomId: 'kitchen' }])
      const res = await app.inject({ method: 'GET', url: '/api/overrides' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
      })
    } finally {
      await app.close()
    }
  })
})

describe('PUT /api/overrides', () => {
  it('replaces the whole collection, returns 200 with the new array', async () => {
    const app = await makeApp()
    try {
      const body = {
        overrides: [
          { entityId: 'light.kitchen_ceiling', roomId: 'living_room' },
          { entityId: 'sensor.useless', hidden: true },
        ],
      }
      const res = await app.inject({ method: 'PUT', url: '/api/overrides', payload: body })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(body)

      // GET reflects the new state
      const get = await app.inject({ method: 'GET', url: '/api/overrides' })
      expect(get.json()).toEqual(body)
    } finally {
      await app.close()
    }
  })

  it('PUT with empty array clears the collection', async () => {
    const app = await makeApp()
    try {
      store!.replaceAll([{ entityId: 'a.b', roomId: 'kitchen' }])
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [] },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ overrides: [] })
      expect(store!.getAll()).toEqual([])
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body when entityId regex fails', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [{ entityId: 'NotAValidId', roomId: 'kitchen' }] },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 when roomId is not a CanonicalRoomId', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [{ entityId: 'light.a', roomId: 'NOT_A_ROOM' }] },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 when override has neither roomId nor hidden=true', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [{ entityId: 'light.a' }] },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 when override has hidden:false only (no-op)', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [{ entityId: 'light.a', hidden: false }] },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 on duplicate entityId in body', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: {
          overrides: [
            { entityId: 'light.a', roomId: 'kitchen' },
            { entityId: 'light.a', roomId: 'bedroom' },
          ],
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 on missing body', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'PUT', url: '/api/overrides' })
      expect(res.statusCode).toBe(400)
    } finally {
      await app.close()
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides vitest run packages/server/src/__tests__/routes/overrides.test.ts
```

Expected: FAIL with "Cannot find module '../../routes/overrides.js'".

- [ ] **Step 3: Create the route plugin**

Create `packages/server/src/routes/overrides.ts`:

```ts
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { CANONICAL_ROOMS } from '@lovelacer/shared'
import type { OverrideStore } from '../storage/override-store.js'

export interface OverridesRouteOptions {
  overrides: OverrideStore
}

const ENTITY_ID_RE = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/

const OverrideSchema = z
  .object({
    entityId: z.string().regex(ENTITY_ID_RE, 'must be a valid HA entity_id'),
    roomId: z.enum(CANONICAL_ROOMS).optional(),
    hidden: z.boolean().optional(),
  })
  .refine((o) => o.roomId !== undefined || o.hidden === true, {
    message: 'override must set roomId or hidden=true (or both)',
  })

const PutBodySchema = z.object({
  overrides: z
    .array(OverrideSchema)
    .refine((arr) => new Set(arr.map((o) => o.entityId)).size === arr.length, {
      message: 'duplicate entityId',
    }),
})

/**
 * GET  /api/overrides — return all overrides as `{ overrides: [...] }`.
 * PUT  /api/overrides — replace all overrides; body is `{ overrides: [...] }`.
 *
 * Validation via zod. Storage atomicity via OverrideStore.replaceAll's
 * single transaction.
 *
 * Errors:
 * - 400 invalid_body — body fails schema or refine validation
 * - 500 storage_error — better-sqlite3 threw
 */
export const overridesRoute: FastifyPluginAsync<OverridesRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.get('/api/overrides', async () => {
    return { overrides: opts.overrides.getAll() }
  })

  app.put('/api/overrides', async (req, reply) => {
    const parsed = PutBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      })
    }
    try {
      opts.overrides.replaceAll(parsed.data.overrides)
      return reply.code(200).send({ overrides: opts.overrides.getAll() })
    } catch (err) {
      req.log.error({ err }, 'override storage failed')
      return reply.code(500).send({ error: 'storage_error', message: String(err) })
    }
  })
}
```

If `CANONICAL_ROOMS` isn't exported from `@lovelacer/shared`, check `packages/shared/src/constants.ts` — it should be a `readonly` tuple of strings already. If it's exported as `CANONICAL_ROOMS`, the `z.enum(CANONICAL_ROOMS)` call needs the tuple-of-strings shape. If zod complains about type assignability, cast: `z.enum(CANONICAL_ROOMS as unknown as readonly [string, ...string[]])` is one workaround, or use `z.enum([...CANONICAL_ROOMS])` to spread into a fresh tuple.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides vitest run packages/server/src/__tests__/routes/overrides.test.ts
```

Expected: PASS — 10 tests.

- [ ] **Step 5: Run full workspace tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides -r test
```

Both green. The route isn't registered in `app.ts` yet — that's Task 5 — so the rest of the suite is unaffected.

- [ ] **Step 6: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides add packages/server/src/routes/overrides.ts \
        packages/server/src/__tests__/routes/overrides.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides commit -m "$(cat <<'EOF'
feat(server): /api/overrides GET + PUT route plugin

Fastify plugin with two endpoints. GET returns all overrides as
{ overrides: [...] }. PUT replaces the whole collection in a single
transaction (delegated to OverrideStore.replaceAll), returns the new
state on success, 400 on validation failure, 500 on DB error.

Validation via zod:
- entityId must match HA entity_id format regex.
- roomId, if present, must be one of the 15 CanonicalRoomId values.
- At least one of roomId or hidden=true must be set (refine guard
  rejects no-op rows in the API before they hit the DB CHECK).
- No duplicate entityId in the array.

Plugin opts: { overrides: OverrideStore } — same dependency-injection
pattern as the existing analyze/preview/apply routes get HaClient.

Ten route tests cover the empty/populated GETs, the happy-path PUT,
empty-array PUT, and each validation error path. Tests instantiate a
real OverrideStore with ':memory:' so they exercise the storage path
end-to-end without mocks.

Plugin not yet registered in app.ts — that's the next layer's job.

P1b-3 layer 4 of 6 (route plugin).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire `OverrideStore` through pipeline + app

**Files:**

- Modify: `packages/server/src/pipeline.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/main.ts`
- Modify: `packages/server/src/routes/analyze.ts`
- Modify: `packages/server/src/routes/preview.ts`
- Modify: `packages/server/src/routes/apply.ts`
- Modify: `packages/server/src/__tests__/pipeline.test.ts`
- Modify: `packages/server/src/__tests__/routes/analyze.test.ts`
- Modify: `packages/server/src/__tests__/routes/preview.test.ts`
- Modify: `packages/server/src/__tests__/routes/apply.test.ts`

Threads the store through the call chain. `runFullPipeline` calls `applyOverrides` between `detect` and `groupByDomain`. `createApp` accepts `overrides: OverrideStore` and registers `overridesRoute`. `main.ts` instantiates the store from `config.dataDir`. Existing test files create their own `:memory:` stores.

This task is a single atomic commit — the signature changes are coupled and the project must compile after each commit.

- [ ] **Step 1: Update `runFullPipeline` to call `applyOverrides`**

Read `packages/server/src/pipeline.ts`. Add an import for `OverrideStore`:

```ts
import type { OverrideStore } from './storage/override-store.js'
```

Change `runFullPipeline`'s signature and body:

```ts
async function runFullPipeline(
  ha: HaClient,
  overrides: OverrideStore,
): Promise<PipelineState> {
  const [entityRegistry, deviceRegistry, areaRegistry] = await Promise.all([
    ha.getEntityRegistry(),
    ha.getDeviceRegistry(),
    ha.getAreaRegistry(),
  ])

  const entities = normalize({
    entities: entityRegistry,
    devices: deviceRegistry,
  })
  const assignments = detect({ entities, areas: areaRegistry })
  applyOverrides({ assignments, entities }, overrides.getAll())
  const groupings = groupByDomain({ assignments, entities })
  // ... rest of the function unchanged
```

Change the three exported entry points to accept `overrides`:

```ts
export async function runAnalyze(ha: HaClient, overrides: OverrideStore): Promise<AnalyzeOutput> {
  const state = await runFullPipeline(ha, overrides)
  return { rooms: state.rooms, misc: state.misc, summary: state.summary }
}

export async function runPreview(ha: HaClient, overrides: OverrideStore): Promise<PreviewOutput> {
  const state = await runFullPipeline(ha, overrides)
  // ... rest unchanged
}

export async function runApply(
  ha: HaClient,
  overrides: OverrideStore,
  body: ApplyInput,
  defaultOptions: ApplyDashboardOptions = {},
): Promise<ApplyDashboardResult> {
  const options = { ...defaultOptions, ...body.options }
  if (body.config !== undefined) {
    if (typeof body.config.title !== 'string' || !Array.isArray(body.config.views)) {
      throw new InvalidConfigError('invalid_config: title must be string and views must be array')
    }
    return ha.applyDashboard(body.config, options)
  }
  const preview = await runPreview(ha, overrides)
  return ha.applyDashboard(preview.config, options)
}
```

- [ ] **Step 2: Update each route to thread `overrides`**

Read `packages/server/src/routes/analyze.ts`. Replace its contents:

```ts
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import type { OverrideStore } from '../storage/override-store.js'
import { runAnalyze } from '../pipeline.js'

export interface AnalyzeRouteOptions {
  ha: HaClient
  overrides: OverrideStore
}

/**
 * POST /api/analyze — pulls registries from HA, runs the full analyzer
 * pipeline (normalize → detect → applyOverrides → groupByDomain), and
 * returns a summary with rooms, misc bucket, and counts.
 *
 * Errors:
 * - 503 ha_unavailable: HaClient not connected
 * - 500 analyze_failed: registry fetch or analysis threw
 */
export const analyzeRoute: FastifyPluginAsync<AnalyzeRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post('/api/analyze', async (req, reply) => {
    if (!opts.ha.isConnected()) {
      return reply
        .code(503)
        .send({ error: 'ha_unavailable', message: 'Home Assistant connection not ready' })
    }
    try {
      const result = await runAnalyze(opts.ha, opts.overrides)
      return reply.code(200).send(result)
    } catch (err) {
      req.log.error({ err }, 'analyze failed')
      return reply.code(500).send({ error: 'analyze_failed', message: String(err) })
    }
  })
}
```

Repeat the same `overrides` threading in `packages/server/src/routes/preview.ts` (the route calls `runPreview(opts.ha, opts.overrides)`) and `packages/server/src/routes/apply.ts` (calls `runApply(opts.ha, opts.overrides, req.body, defaultOptions)`). Read each file first, add `overrides: OverrideStore` to its `*RouteOptions`, import `OverrideStore`, and pass it to the corresponding `run*` call.

- [ ] **Step 3: Update `app.ts` to accept the store and register the route**

Read `packages/server/src/app.ts`. Add the import:

```ts
import { overridesRoute } from './routes/overrides.js'
import type { OverrideStore } from './storage/override-store.js'
```

Add `overrides: OverrideStore` to `CreateAppOptions`:

```ts
export interface CreateAppOptions {
  ha: HaClient
  overrides: OverrideStore
  isDev?: boolean
  // ... rest unchanged
}
```

Update the `createApp` body to register the new route and pass `overrides` to existing route registrations. Find the existing route-registration block and replace it:

```ts
await app.register(analyzeRoute, { ha: opts.ha, overrides: opts.overrides })
await app.register(previewRoute, { ha: opts.ha, overrides: opts.overrides })
await app.register(applyRoute, {
  ha: opts.ha,
  overrides: opts.overrides,
  dashboardUrlPath: opts.dashboardUrlPath,
})
await app.register(overridesRoute, { overrides: opts.overrides })
```

(The exact existing options for `applyRoute` may differ; preserve any extras and add `overrides`.)

- [ ] **Step 4: Update `main.ts` to instantiate the store**

Read `packages/server/src/main.ts`. Add imports near the other imports:

```ts
import { resolve } from 'node:path'
import { OverrideStore } from './storage/override-store.js'
```

Inside `main()`, after the `HaClient` is constructed and before `createApp` is called, instantiate the store:

```ts
const overridesPath = resolve(config.dataDir, 'lovelacer.sqlite')
const overrides = new OverrideStore(overridesPath)
logger.info({ path: overridesPath }, 'override store opened')
```

Pass it into `createApp`:

```ts
const app = await createApp({
  ha,
  overrides,
  isDev,
  // ... rest unchanged
})
```

Add a `overrides.close()` line to the `shutdown` handler so it tears down cleanly on SIGINT/SIGTERM:

```ts
const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down')
  await ha.disconnect()
  await app.close()
  overrides.close()
  process.exit(0)
}
```

- [ ] **Step 5: Update `pipeline.test.ts` to pass a `:memory:` store**

Read `packages/server/src/__tests__/pipeline.test.ts`. Add the import:

```ts
import { OverrideStore } from '../storage/override-store.js'
```

The existing helper `makeFakeHa` returns the HA mock. Add a parallel helper:

```ts
function makeStore(): OverrideStore {
  return new OverrideStore(':memory:')
}
```

Walk through every existing `runAnalyze(fake.client)`, `runPreview(fake.client)`, `runApply(fake.client, ...)` call in the file. Update each to pass a store: `runAnalyze(fake.client, makeStore())`. For `runApply`, the new signature is `runApply(ha, overrides, body, defaults?)` — note that `overrides` slots in BEFORE `body`. Each test creates its own fresh `:memory:` store via `makeStore()`; `:memory:` SQLite handles are auto-released when the test scope exits, so no explicit `close()` needed in tests.

Example:

```ts
// Before:
const result = await runAnalyze(fake.client)
// After:
const result = await runAnalyze(fake.client, makeStore())
```

```ts
// Before:
const result = await runApply(fake.client, body)
// After:
const result = await runApply(fake.client, makeStore(), body)
```

- [ ] **Step 6: Update each route test file**

Read each of `packages/server/src/__tests__/routes/analyze.test.ts`, `preview.test.ts`, `apply.test.ts`. Each file has multiple `await createApp({ ha, ... })` call sites. Add `overrides: new OverrideStore(':memory:')` to each `createApp` options object. Add the import:

```ts
import { OverrideStore } from '../../storage/override-store.js'
```

For example, in `analyze.test.ts`:

```ts
// Before:
const app = await createApp({ ha, logLevel: 'silent', dashboardUrlPath: 'lovelacer-home' })
// After:
const app = await createApp({
  ha,
  overrides: new OverrideStore(':memory:'),
  logLevel: 'silent',
  dashboardUrlPath: 'lovelacer-home',
})
```

For test hygiene, store the `OverrideStore` instance in a variable inside each test and call `store.close()` in the `finally` block alongside `await app.close()` if the existing test wraps `createApp` in a try/finally. (`:memory:` DBs free on close anyway, but explicit cleanup avoids "open handle" warnings if the test runner reports them.)

- [ ] **Step 7: Verify typecheck**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides typecheck
```

Expected: PASS. Every call site of `runAnalyze`/`runPreview`/`runApply` and `createApp` has been updated.

- [ ] **Step 8: Run full workspace tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides -r test
```

Expected: PASS — all existing tests still green now that the wiring is complete. The new route `/api/overrides` is registered but isn't covered by integration tests yet; Task 6 adds those.

- [ ] **Step 9: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides add packages/server/src/pipeline.ts \
        packages/server/src/app.ts \
        packages/server/src/main.ts \
        packages/server/src/routes/analyze.ts \
        packages/server/src/routes/preview.ts \
        packages/server/src/routes/apply.ts \
        packages/server/src/__tests__/pipeline.test.ts \
        packages/server/src/__tests__/routes/analyze.test.ts \
        packages/server/src/__tests__/routes/preview.test.ts \
        packages/server/src/__tests__/routes/apply.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides commit -m "$(cat <<'EOF'
feat(server): wire OverrideStore through pipeline + routes + app

Threads the store through the call chain so user overrides are
applied during analyze / preview / apply:

- runFullPipeline calls applyOverrides between detect and group.
- runAnalyze / runPreview / runApply gain a required overrides:
  OverrideStore parameter (slots in after ha, before any body).
- analyzeRoute / previewRoute / applyRoute accept overrides in
  plugin opts and pass it through.
- createApp accepts overrides in CreateAppOptions and registers the
  new overridesRoute alongside the existing routes.
- main.ts instantiates a single OverrideStore from
  config.dataDir + lovelacer.sqlite, passes it to createApp, and
  closes it in the shutdown handler.

Existing pipeline + route tests updated to pass a fresh ':memory:'
OverrideStore. No behavior change for users who haven't set any
overrides — empty getAll() returns [] and applyOverrides hot-paths
the empty case.

P1b-3 layer 5 of 6 (wiring).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Pipeline integration tests

**Files:**

- Modify: `packages/server/src/__tests__/pipeline.test.ts`

End-to-end tests that drive a real override through `runAnalyze` / `runPreview` and verify the room reassignment + hide behavior.

- [ ] **Step 1: Find a target entity in the english-cluttered fixture**

Read `tests/fixtures/english-cluttered.ts`. Pick an entity that the analyzer reliably routes to a specific canonical room (e.g., a kitchen light). Write its full `entityId` and the canonical it lands in.

If english-cluttered's exact entity_ids are awkward, use one of the new fixtures (e.g., `tests/fixtures/kitchen-sink.ts` from P1b-2) — it has entities clearly bound to canonical area names.

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides/tests/fixtures/english-cluttered.ts
```

The test below uses a helper `pickEntityIn(result, canonical)` that picks the first entity in a room dynamically — no hardcoded entityId needed.

- [ ] **Step 2: Add the override integration tests**

In `packages/server/src/__tests__/pipeline.test.ts`, append new describe blocks below the existing tests (after `describe('runApply', ...)`):

```ts
describe('runAnalyze with overrides', () => {
  it('roomId override moves an entity from its detected room to the override room', async () => {
    const fake = makeFakeHa()
    const store = makeStore()

    // Baseline run — record where the entity lands without any overrides.
    const baseline = await runAnalyze(fake.client, store)
    const targetEntityId = pickEntityIn(baseline, 'kitchen')
    expect(targetEntityId, 'fixture must have at least one entity routed to kitchen').not.toBeNull()

    // Set an override moving the entity to living_room.
    store.replaceAll([{ entityId: targetEntityId!, roomId: 'living_room' }])

    const overridden = await runAnalyze(fake.client, store)
    const livingRoom = overridden.rooms.find((r) => r.id === 'living_room')
    expect(livingRoom, 'living_room must exist in overridden output').toBeDefined()
    const movedAssignment = livingRoom!.assignments.find((a) => a.entityId === targetEntityId)
    expect(movedAssignment).toBeDefined()
    expect(movedAssignment!.confidence).toBe(1.0)
    expect(movedAssignment!.manual).toBe(true)

    // Original kitchen room no longer contains it.
    const kitchen = overridden.rooms.find((r) => r.id === 'kitchen')
    if (kitchen !== undefined) {
      expect(kitchen.assignments.find((a) => a.entityId === targetEntityId)).toBeUndefined()
    }
  })

  it('hidden override drops an entity from the analyze output', async () => {
    const fake = makeFakeHa()
    const store = makeStore()

    const baseline = await runAnalyze(fake.client, store)
    const baselineEntityCount = baseline.summary.entityCount

    const targetEntityId = pickEntityIn(baseline, 'kitchen')
    expect(targetEntityId).not.toBeNull()

    store.replaceAll([{ entityId: targetEntityId!, hidden: true }])

    const filtered = await runAnalyze(fake.client, store)
    expect(filtered.summary.entityCount).toBe(baselineEntityCount - 1)

    // The entity is in NO room and NOT in misc.
    const inAnyRoom = filtered.rooms.some((r) =>
      r.assignments.some((a) => a.entityId === targetEntityId),
    )
    expect(inAnyRoom).toBe(false)
    expect(filtered.misc.find((m) => m.entityId === targetEntityId)).toBeUndefined()
  })

  it('combined override applies both room move and hide simultaneously', async () => {
    const fake = makeFakeHa()
    const store = makeStore()

    const baseline = await runAnalyze(fake.client, store)
    const targetEntityId = pickEntityIn(baseline, 'kitchen')
    expect(targetEntityId).not.toBeNull()

    store.replaceAll([{ entityId: targetEntityId!, roomId: 'living_room', hidden: true }])

    const result = await runAnalyze(fake.client, store)
    // Hidden takes precedence over room move at the visibility level.
    const inAnyRoom = result.rooms.some((r) =>
      r.assignments.some((a) => a.entityId === targetEntityId),
    )
    expect(inAnyRoom).toBe(false)
    expect(result.misc.find((m) => m.entityId === targetEntityId)).toBeUndefined()
  })

  it('orphaned override (entityId not in registry) silently no-ops', async () => {
    const fake = makeFakeHa()
    const store = makeStore()

    store.replaceAll([{ entityId: 'light.does_not_exist', roomId: 'bedroom' }])

    const result = await runAnalyze(fake.client, store)
    // Same shape as a baseline run — no errors thrown.
    expect(result.summary.entityCount).toBeGreaterThan(0)
  })
})

describe('runPreview with overrides', () => {
  it('roomId override is reflected in the generated config views', async () => {
    const fake = makeFakeHa()
    const store = makeStore()

    const baseline = await runPreview(fake.client, store)
    const targetEntityId = pickEntityIn(baseline, 'kitchen')
    expect(targetEntityId).not.toBeNull()

    store.replaceAll([{ entityId: targetEntityId!, roomId: 'living_room' }])

    const overridden = await runPreview(fake.client, store)
    const livingRoomView = overridden.config.views.find((v) => v.path === 'living_room')
    expect(livingRoomView).toBeDefined()
    // The entityId should appear somewhere in the living_room view's cards.
    const json = JSON.stringify(livingRoomView)
    expect(json).toContain(targetEntityId)
  })
})

/**
 * Helper: pick the first entityId in the analyze result that's bound to
 * the given canonical room, or null if none exists.
 */
function pickEntityIn(
  result: { rooms: { id: string; assignments: { entityId: string }[] }[] },
  canonical: string,
): string | null {
  const room = result.rooms.find((r) => r.id === canonical)
  if (room === undefined || room.assignments.length === 0) return null
  return room.assignments[0]!.entityId
}
```

If `english-cluttered` doesn't reliably produce a `kitchen` room (the fixture might evolve), pick another canonical that the fixture is known to populate — `living_room` is also a safe choice; just adapt the override target accordingly. The tests' assertions are written so the underlying fixture's exact entity-ids don't matter, only that AT LEAST ONE entity routes to a known canonical.

- [ ] **Step 3: Run the new tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides vitest run packages/server/src/__tests__/pipeline.test.ts -t 'with overrides'
```

Expected: PASS — 5 new tests.

- [ ] **Step 4: Run full workspace tests + typecheck + format + lint**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides -r test
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides format:check
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides lint
```

All four green. If `format:check` fails, run `pnpm --dir <worktree> format`, re-stage, and retry.

- [ ] **Step 5: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides add packages/server/src/__tests__/pipeline.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-3-overrides commit -m "$(cat <<'EOF'
test(server): pipeline integration tests for overrides

End-to-end tests through runAnalyze and runPreview that drive real
overrides through the OverrideStore → applyOverrides → groupByDomain
chain:

- roomId override moves an entity to the target room with
  confidence=1.0 and manual=true.
- hidden:true override drops the entity from the analyze output
  entirely (not in any room, not in misc, summary.entityCount-1).
- Combined override (move + hide) — hidden wins at visibility level.
- Orphaned override (entityId not in registry) silently no-ops.
- runPreview: roomId override is reflected in the generated config
  view JSON for the target canonical.

Closes P1b-3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1b-3 Acceptance Confirmation

- [ ] `Override` type exported from `@lovelacer/shared`.
- [ ] `RoomAssignment.manual?: boolean` added (optional, defaults undefined).
- [ ] `OverrideStore` class with `getAll`, `replaceAll`, `close` methods, backed by SQLite via `better-sqlite3`. WAL journal mode. CHECK constraint enforces meaningful rows.
- [ ] `OverrideStore` accepts `:memory:` for tests; creates the parent dir for file paths.
- [ ] `applyOverrides` helper mutates `RoomAssignment[]` and `NormalizedEntity[]` in place; orphaned overrides no-op silently.
- [ ] `GET /api/overrides` returns `{ overrides: [...] }` (deterministic order by `entityId`).
- [ ] `PUT /api/overrides` validates with zod (entity-id regex, CanonicalRoomId enum, no-op refine, no-duplicate refine), replaces atomically, echoes new state.
- [ ] 400 `invalid_body` on bad input; 500 `storage_error` on DB exceptions.
- [ ] `runFullPipeline` calls `applyOverrides` between `detect` and `groupByDomain`.
- [ ] `runAnalyze` / `runPreview` / `runApply` accept `overrides: OverrideStore` parameter.
- [ ] `createApp` accepts `overrides` and registers `overridesRoute`.
- [ ] `main.ts` instantiates a single store from `${config.dataDir}/lovelacer.sqlite`, closes on shutdown.
- [ ] Add-on persistence verified — `apps/addon/run.sh` already sets `DATA_DIR=/data` (no work, just confirm).
- [ ] Storage layer tests (9), pipeline patch tests (8), route tests (10), pipeline integration tests (5) — total 32 new tests.
- [ ] `pnpm typecheck`, `pnpm -r test`, `pnpm format:check`, `pnpm lint` all clean.
