# P2-1 Re-analysis Diff View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show what changed (added/moved/removed entities) between the user's current analysis and the dashboard they last applied to Home Assistant.

**Architecture:** At apply time the frontend sends a `{ assignments, config }` snapshot in the existing `POST /api/apply` body; the server persists it into a single-row SQLite table after the HA push succeeds. At analyze time the preview route loads the snapshot, calls a pure `computeDiff()` in `@lovelacer/analyzer`, and ships the result on `PreviewOutput.diff`. The frontend renders three layers: top-level `DiffBanner`, per-room badges in `RoomList`, inline tags in `EntityRow`, plus a `RemovedEntitiesPanel` callout for entities removed from HA.

**Tech Stack:** TypeScript strict (verbatimModuleSyntax + exactOptionalPropertyTypes), Fastify route plugins with DI, better-sqlite3 (single-row pattern with `CHECK (id = 1)` and JSON columns, mirrors `InviteStore`), Zod body validation, Vue 3 + Pinia + Tailwind 4, Vitest with `globals: false`.

---

## Source of Truth

`docs/superpowers/specs/2026-05-02-p2-1-reanalysis-diff-view-design.md` is the canonical spec. If anything in this plan contradicts that doc, the spec wins — fix the plan and re-run.

## Codebase Conventions (read before starting)

- ESM with explicit `.js` extensions on imports even when importing TS source.
- Vitest tests must `import { describe, it, expect } from 'vitest'` — `globals: false`.
- Each SQLite store: prepared statements hoisted in the constructor, `journal_mode = WAL`, `mkdirSync(dirname, { recursive: true })` for file paths, accepts `:memory:` for tests.
- Existing stores both write to the same file (`config.dataDir + '/lovelacer.sqlite'`); each owns one or more tables. The new store does the same.
- Route plugins receive their dependencies via `opts`; tests use `createApp({ … :memory: stores })` with `app.inject({ method, url, payload })`.
- Frontend tests use `mount(Component, { global: { plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })] } })` and `vi.mock('../api/client.js')` for API mocks. The `App.test.ts` integration suite already covers the preview→apply loop; extend rather than create new files where possible.

## File Structure

**New:**

| Path | Responsibility |
|------|----------------|
| `packages/analyzer/src/diff.ts` | Pure `computeDiff()` — input snapshot + current, output `DiffResult` |
| `packages/analyzer/src/__tests__/diff.test.ts` | Diff algorithm tests (added/moved/removed/null/idempotent) |
| `packages/server/src/storage/applied-snapshot-store.ts` | Single-row SQLite table; `get()`/`save()`/`close()` |
| `packages/server/src/storage/__tests__/applied-snapshot-store.test.ts` | Store CRUD + JSON round-trip + dir-creation tests |
| `packages/web/src/components/DiffBanner.vue` | Top-of-screen summary; null/zero/nonzero render branches |
| `packages/web/src/components/RemovedEntitiesPanel.vue` | Amber/red callout listing removed entities |
| `packages/web/src/__tests__/components/DiffBanner.test.ts` | Banner render branches |
| `packages/web/src/__tests__/components/RemovedEntitiesPanel.test.ts` | Panel render + previous-room formatting |

**Modified:**

| Path | Changes |
|------|---------|
| `packages/shared/src/types.ts` | Add `SnapshotAssignment`, `AppliedSnapshot`, `DiffKind`, `EntityDiff`, `RoomDiffSummary`, `DiffResult` |
| `packages/shared/src/index.ts` | Re-export the new types |
| `packages/analyzer/src/index.ts` | Re-export `computeDiff` and types from `./diff.js` |
| `packages/server/src/pipeline.ts` | `runPreview()` accepts snapshot store, computes diff, attaches to `PreviewOutput.diff` |
| `packages/server/src/app.ts` | `CreateAppOptions.appliedSnapshot: AppliedSnapshotStore`; thread into preview + apply routes |
| `packages/server/src/routes/preview.ts` | Pass `appliedSnapshot` through to `runPreview()` |
| `packages/server/src/routes/apply.ts` | Accept body.snapshot, validate, persist after HA push success |
| `packages/server/src/main.ts` | Instantiate `AppliedSnapshotStore`; close on shutdown; pass into `createApp` |
| `packages/server/src/__tests__/routes/preview.test.ts` | Add cases: no snapshot, matching snapshot, snapshot with removed entity |
| `packages/server/src/__tests__/routes/apply.test.ts` | Add cases: with snapshot persists, malformed snapshot returns flag, no snapshot succeeds, HA failure does not persist |
| `packages/server/src/__tests__/routes/analyze.test.ts` | Update `createApp` calls to pass `appliedSnapshot: new AppliedSnapshotStore(':memory:')` |
| `packages/server/src/__tests__/routes/overrides.test.ts` | Same DI update |
| `packages/server/src/__tests__/routes/invite.test.ts` | Same DI update |
| `packages/server/src/__tests__/routes/invite-gate.test.ts` | Same DI update |
| `packages/web/src/api/types.ts` | Add `SnapshotAssignment`, `AppliedSnapshot`, `DiffKind`, `EntityDiff`, `RoomDiffSummary`, `DiffResult`; extend `PreviewOutput` and `ApplyResponse` |
| `packages/web/src/api/client.ts` | `postApply` accepts optional `snapshot` field |
| `packages/web/src/__tests__/api/client.test.ts` | New test: `postApply` forwards snapshot in body |
| `packages/web/src/stores/apply.ts` | `apply()` accepts optional snapshot and forwards to client |
| `packages/web/src/__tests__/stores/apply.test.ts` | New test: store passes snapshot through to client |
| `packages/web/src/components/ApplyBar.vue` | Build snapshot from `analyze.preview` and pass to `apply.apply()` |
| `packages/web/src/components/RoomList.vue` | `diffByRoom` prop + badge rendering |
| `packages/web/src/__tests__/components/RoomList.test.ts` | Add badge render cases |
| `packages/web/src/components/EntityRow.vue` | `diff` prop + inline tag rendering |
| `packages/web/src/__tests__/components/EntityRow.test.ts` | Add tag render cases |
| `packages/web/src/App.vue` | Wire `DiffBanner`, `RemovedEntitiesPanel`; build `diffByRoom` and `diffByEntityId` |
| `packages/web/src/__tests__/App.test.ts` | New test: preview returns diff → banner + badges + tags rendered |

---

## Setup

- [ ] **Step 0a: Create the worktree**

```bash
git fetch origin
git worktree add .worktrees/p2-1-diff-view -b feat/p2-1-diff-view origin/main
cd .worktrees/p2-1-diff-view
```

Expected: new worktree at `.worktrees/p2-1-diff-view/` on branch `feat/p2-1-diff-view` based on the latest `origin/main`. Spec and plan files are present (committed to main).

- [ ] **Step 0b: Verify baseline is green**

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass. If anything fails, fix before starting Task 1 — you don't want to debug pre-existing breakage layered under your changes.


---

## Task 1: Shared Types + AppliedSnapshotStore

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/server/src/storage/applied-snapshot-store.ts`
- Create: `packages/server/src/storage/__tests__/applied-snapshot-store.test.ts`

**Why this task:** Establish the persistence layer + type contract. Nothing else can be built without these types.

- [ ] **Step 1: Add shared types**

Append to `packages/shared/src/types.ts`:

```ts
/**
 * P2-1 — diff view types.
 *
 * `SnapshotAssignment.roomId` uses `null` to encode "this entity was/is in
 * the misc bucket" (no room view contains it). The diff treats null as just
 * another assignment value: misc-to-room and room-to-misc both surface as
 * `kind: 'moved'` with the appropriate side null.
 */
export interface SnapshotAssignment {
  entityId: string
  roomId: CanonicalRoomId | null
}

export interface AppliedSnapshot {
  assignments: SnapshotAssignment[]
  /**
   * Full LovelaceConfig that was pushed. Stored for archival — currently
   * not read by the diff (assignments are sufficient). Future tickets may
   * use it for YAML drift detection.
   *
   * Typed as `unknown` here because @lovelacer/shared can't depend on
   * @lovelacer/generator (cyclic). The server casts on read.
   */
  config: unknown
  appliedAt: number
}

export type DiffKind = 'added' | 'moved' | 'removed'

export interface EntityDiff {
  entityId: string
  kind: DiffKind
  /** Room (or misc=null) the entity occupied in the snapshot. Undefined for 'added'. */
  previousRoomId?: CanonicalRoomId | null
  /** Room (or misc=null) the entity is in now. Undefined for 'removed'. */
  currentRoomId?: CanonicalRoomId | null
}

export interface RoomDiffSummary {
  /** Entities new to this room — both fresh adds and moves-in. */
  added: number
  /** Subset of `added`: entities that were assigned to a different room before. */
  movedIn: number
  /** Entities that left this room — they are now in a different room (or misc, or removed). */
  movedOut: number
}

export interface DiffResult {
  entities: EntityDiff[]
  perRoom: Partial<Record<CanonicalRoomId, RoomDiffSummary>>
  totals: { added: number; moved: number; removed: number }
  /** Copied through from the snapshot — unix seconds. */
  appliedAt: number
}
```

- [ ] **Step 2: Re-export from shared index**

Edit `packages/shared/src/index.ts` — add to the existing type re-exports:

```ts
export type {
  SnapshotAssignment,
  AppliedSnapshot,
  DiffKind,
  EntityDiff,
  RoomDiffSummary,
  DiffResult,
} from './types.js'
```

If the existing file uses a single `export type { … } from './types.js'` block, append the new identifiers to that list instead of adding a second block.

- [ ] **Step 3: Write failing AppliedSnapshotStore test**

Create `packages/server/src/storage/__tests__/applied-snapshot-store.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppliedSnapshot } from '@lovelacer/shared'
import { AppliedSnapshotStore } from '../applied-snapshot-store.js'

const sample: Omit<AppliedSnapshot, 'appliedAt'> = {
  assignments: [
    { entityId: 'light.kitchen_ceiling', roomId: 'kitchen' },
    { entityId: 'sensor.outdoor_temp', roomId: null },
  ],
  config: { title: 'Lovelacer — Home', views: [] },
}

describe('AppliedSnapshotStore', () => {
  const tempDirs: string[] = []
  afterEach(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
    tempDirs.length = 0
  })

  it('returns null before any save', () => {
    const store = new AppliedSnapshotStore(':memory:')
    try {
      expect(store.get()).toBeNull()
    } finally {
      store.close()
    }
  })

  it('save then get round-trips assignments and config', () => {
    const store = new AppliedSnapshotStore(':memory:')
    try {
      store.save(sample)
      const got = store.get()
      expect(got).not.toBeNull()
      expect(got?.assignments).toEqual(sample.assignments)
      expect(got?.config).toEqual(sample.config)
      expect(got?.appliedAt).toBeGreaterThan(0)
      expect(got?.appliedAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1)
    } finally {
      store.close()
    }
  })

  it('save twice — second overwrites first (last write wins)', () => {
    const store = new AppliedSnapshotStore(':memory:')
    try {
      store.save(sample)
      const updated = {
        assignments: [{ entityId: 'light.bedroom_lamp', roomId: 'bedroom' as const }],
        config: { title: 'After', views: [] },
      }
      store.save(updated)
      const got = store.get()
      expect(got?.assignments).toEqual(updated.assignments)
      expect(got?.config).toEqual(updated.config)
    } finally {
      store.close()
    }
  })

  it('preserves config shape across complex JSON payloads', () => {
    const store = new AppliedSnapshotStore(':memory:')
    try {
      const config = {
        title: 'Lovelacer — Home',
        views: [
          {
            type: 'sections',
            title: 'Kitchen',
            path: 'kitchen',
            icon: 'mdi:silverware-fork-knife',
            sections: [{ type: 'grid', cards: [{ type: 'tile', entity: 'light.kitchen' }] }],
          },
        ],
      }
      store.save({ assignments: sample.assignments, config })
      expect(store.get()?.config).toEqual(config)
    } finally {
      store.close()
    }
  })

  it('creates parent directory for file paths', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'lovelacer-snap-'))
    tempDirs.push(baseDir)
    const dbPath = join(baseDir, 'nested', 'subdir', 'lovelacer.sqlite')
    const store = new AppliedSnapshotStore(dbPath)
    try {
      expect(existsSync(dbPath)).toBe(true)
      store.save(sample)
      expect(store.get()?.assignments).toEqual(sample.assignments)
    } finally {
      store.close()
    }
  })
})
```

- [ ] **Step 4: Run test to confirm it fails**

```bash
pnpm --filter @lovelacer/server test -- applied-snapshot-store
```

Expected: FAIL — `AppliedSnapshotStore` doesn't exist yet (module-not-found).

- [ ] **Step 5: Implement AppliedSnapshotStore**

Create `packages/server/src/storage/applied-snapshot-store.ts`:

```ts
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { Database as DatabaseType, Statement } from 'better-sqlite3'
import type { AppliedSnapshot, SnapshotAssignment } from '@lovelacer/shared'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS applied_snapshot (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    assignments TEXT    NOT NULL,
    config      TEXT    NOT NULL,
    applied_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
`

interface SnapshotRow {
  assignments: string
  config: string
  applied_at: number
}

/**
 * SQLite-backed persistence for the last-applied dashboard snapshot.
 *
 * Single-row table (CHECK id=1) — only the most recent apply is retained.
 * Diff history is out of scope for P2-1 (see spec "Out of scope").
 *
 * Constructor accepts ':memory:' for tests; for file paths, the parent
 * directory is created if missing. Mirrors `InviteStore`.
 */
export class AppliedSnapshotStore {
  private readonly db: DatabaseType
  private readonly stmtGet: Statement
  private readonly stmtSave: Statement

  constructor(filename: string) {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true })
    }
    this.db = new Database(filename)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)

    this.stmtGet = this.db.prepare(
      'SELECT assignments, config, applied_at FROM applied_snapshot WHERE id = 1',
    )
    this.stmtSave = this.db.prepare(
      'INSERT OR REPLACE INTO applied_snapshot (id, assignments, config, applied_at) ' +
        'VALUES (1, ?, ?, unixepoch())',
    )
  }

  get(): AppliedSnapshot | null {
    const row = this.stmtGet.get() as SnapshotRow | undefined
    if (row === undefined) return null
    return {
      assignments: JSON.parse(row.assignments) as SnapshotAssignment[],
      config: JSON.parse(row.config) as unknown,
      appliedAt: row.applied_at,
    }
  }

  save(snapshot: Omit<AppliedSnapshot, 'appliedAt'>): void {
    this.stmtSave.run(JSON.stringify(snapshot.assignments), JSON.stringify(snapshot.config))
  }

  close(): void {
    this.db.close()
  }
}
```

- [ ] **Step 6: Run tests to confirm pass**

```bash
pnpm --filter @lovelacer/server test -- applied-snapshot-store
```

Expected: PASS — 5/5 tests green.

- [ ] **Step 7: Run full server tests + typecheck + lint to confirm no collateral damage**

```bash
pnpm --filter @lovelacer/server test
pnpm typecheck
pnpm lint
```

Expected: all pass. As of Task 1, no existing test should break (DI changes come in Task 3).

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/index.ts \
  packages/server/src/storage/applied-snapshot-store.ts \
  packages/server/src/storage/__tests__/applied-snapshot-store.test.ts
git commit -m "feat(server): AppliedSnapshotStore + diff types in @lovelacer/shared"
```


---

## Task 2: computeDiff Pure Module

**Files:**
- Create: `packages/analyzer/src/diff.ts`
- Create: `packages/analyzer/src/__tests__/diff.test.ts`
- Modify: `packages/analyzer/src/index.ts`

**Why this task:** Pure logic with no IO. Easy to TDD comprehensively. Other layers depend on the function signature and types.

- [ ] **Step 1: Write the failing test**

Create `packages/analyzer/src/__tests__/diff.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { AppliedSnapshot, SnapshotAssignment } from '@lovelacer/shared'
import { computeDiff } from '../diff.js'

function snap(assignments: SnapshotAssignment[], appliedAt = 1_700_000_000): AppliedSnapshot {
  return { assignments, config: { title: 'x', views: [] }, appliedAt }
}

describe('computeDiff', () => {
  it('empty snapshot vs empty current → all-zero diff', () => {
    const result = computeDiff({ snapshot: snap([]), current: { assignments: [] } })
    expect(result.entities).toEqual([])
    expect(result.totals).toEqual({ added: 0, moved: 0, removed: 0 })
    expect(result.perRoom).toEqual({})
    expect(result.appliedAt).toBe(1_700_000_000)
  })

  it('entity in current but not snapshot → kind: added', () => {
    const result = computeDiff({
      snapshot: snap([]),
      current: { assignments: [{ entityId: 'light.kitchen_ceiling', roomId: 'kitchen' }] },
    })
    expect(result.entities).toEqual([
      { entityId: 'light.kitchen_ceiling', kind: 'added', currentRoomId: 'kitchen' },
    ])
    expect(result.totals).toEqual({ added: 1, moved: 0, removed: 0 })
    expect(result.perRoom.kitchen).toEqual({ added: 1, movedIn: 0, movedOut: 0 })
  })

  it('entity in snapshot but not current → kind: removed', () => {
    const result = computeDiff({
      snapshot: snap([{ entityId: 'light.guest_lamp', roomId: 'guest_room' }]),
      current: { assignments: [] },
    })
    expect(result.entities).toEqual([
      { entityId: 'light.guest_lamp', kind: 'removed', previousRoomId: 'guest_room' },
    ])
    expect(result.totals).toEqual({ added: 0, moved: 0, removed: 1 })
    expect(result.perRoom).toEqual({})
  })

  it('entity in both with different roomId → kind: moved', () => {
    const result = computeDiff({
      snapshot: snap([{ entityId: 'light.lamp', roomId: 'living_room' }]),
      current: { assignments: [{ entityId: 'light.lamp', roomId: 'bedroom' }] },
    })
    expect(result.entities).toEqual([
      {
        entityId: 'light.lamp',
        kind: 'moved',
        previousRoomId: 'living_room',
        currentRoomId: 'bedroom',
      },
    ])
    expect(result.totals).toEqual({ added: 0, moved: 1, removed: 0 })
    expect(result.perRoom.living_room).toEqual({ added: 0, movedIn: 0, movedOut: 1 })
    expect(result.perRoom.bedroom).toEqual({ added: 1, movedIn: 1, movedOut: 0 })
  })

  it('misc → room and room → misc both surface as moved with null on the right side', () => {
    const result = computeDiff({
      snapshot: snap([
        { entityId: 'light.was_misc', roomId: null },
        { entityId: 'light.was_kitchen', roomId: 'kitchen' },
      ]),
      current: {
        assignments: [
          { entityId: 'light.was_misc', roomId: 'kitchen' },
          { entityId: 'light.was_kitchen', roomId: null },
        ],
      },
    })
    const byEntity = new Map(result.entities.map((d) => [d.entityId, d]))
    expect(byEntity.get('light.was_misc')).toEqual({
      entityId: 'light.was_misc',
      kind: 'moved',
      previousRoomId: null,
      currentRoomId: 'kitchen',
    })
    expect(byEntity.get('light.was_kitchen')).toEqual({
      entityId: 'light.was_kitchen',
      kind: 'moved',
      previousRoomId: 'kitchen',
      currentRoomId: null,
    })
    expect(result.totals).toEqual({ added: 0, moved: 2, removed: 0 })
    expect(result.perRoom.kitchen).toEqual({ added: 1, movedIn: 1, movedOut: 1 })
  })

  it('entity unchanged in same room → not in entities[]', () => {
    const result = computeDiff({
      snapshot: snap([{ entityId: 'light.lamp', roomId: 'kitchen' }]),
      current: { assignments: [{ entityId: 'light.lamp', roomId: 'kitchen' }] },
    })
    expect(result.entities).toEqual([])
    expect(result.totals).toEqual({ added: 0, moved: 0, removed: 0 })
    expect(result.perRoom).toEqual({})
  })

  it('mixed scenario rolls up correctly across three rooms', () => {
    const result = computeDiff({
      snapshot: snap([
        { entityId: 'light.k1', roomId: 'kitchen' },
        { entityId: 'light.k2', roomId: 'kitchen' },
        { entityId: 'light.l1', roomId: 'living_room' },
        { entityId: 'light.gone', roomId: 'office' },
      ]),
      current: {
        assignments: [
          { entityId: 'light.k1', roomId: 'kitchen' },
          { entityId: 'light.k2', roomId: 'bedroom' },
          { entityId: 'light.l1', roomId: 'bedroom' },
          { entityId: 'light.new', roomId: 'kitchen' },
        ],
      },
    })
    expect(result.totals).toEqual({ added: 1, moved: 2, removed: 1 })
    expect(result.perRoom.kitchen).toEqual({ added: 1, movedIn: 0, movedOut: 1 })
    expect(result.perRoom.living_room).toEqual({ added: 0, movedIn: 0, movedOut: 1 })
    expect(result.perRoom.bedroom).toEqual({ added: 2, movedIn: 2, movedOut: 0 })
    expect(result.perRoom.office).toBeUndefined()
  })

  it('idempotent on identical snapshot/current', () => {
    const assignments: SnapshotAssignment[] = [
      { entityId: 'light.a', roomId: 'kitchen' },
      { entityId: 'light.b', roomId: 'bedroom' },
      { entityId: 'sensor.x', roomId: null },
    ]
    const result = computeDiff({ snapshot: snap(assignments), current: { assignments } })
    expect(result.entities).toEqual([])
    expect(result.totals).toEqual({ added: 0, moved: 0, removed: 0 })
    expect(result.perRoom).toEqual({})
  })

  it('appliedAt copied from snapshot to result', () => {
    const result = computeDiff({ snapshot: snap([], 1_700_999_999), current: { assignments: [] } })
    expect(result.appliedAt).toBe(1_700_999_999)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @lovelacer/analyzer test -- diff
```

Expected: FAIL — `computeDiff` doesn't exist.

- [ ] **Step 3: Implement computeDiff**

Create `packages/analyzer/src/diff.ts`:

```ts
import type {
  AppliedSnapshot,
  CanonicalRoomId,
  DiffResult,
  EntityDiff,
  RoomDiffSummary,
  SnapshotAssignment,
} from '@lovelacer/shared'

export interface ComputeDiffInput {
  snapshot: AppliedSnapshot
  current: { assignments: SnapshotAssignment[] }
}

/**
 * Compute the diff between a previously-applied dashboard snapshot and the
 * current analysis. Pure — no IO, no HA, no SQLite. Caller is responsible
 * for converting analyzed rooms + misc into the flat assignments list.
 *
 * Misc entities are encoded as `roomId: null` on both sides; misc↔room
 * transitions surface as `kind: 'moved'` with the appropriate side null.
 *
 * Removed entities (in snapshot, not in current) intentionally do NOT
 * accumulate into `perRoom` — they have no current room. The frontend
 * surfaces them in a dedicated `RemovedEntitiesPanel`.
 */
export function computeDiff(input: ComputeDiffInput): DiffResult {
  const prev = new Map<string, CanonicalRoomId | null>()
  for (const a of input.snapshot.assignments) prev.set(a.entityId, a.roomId)

  const curr = new Map<string, CanonicalRoomId | null>()
  for (const a of input.current.assignments) curr.set(a.entityId, a.roomId)

  const entities: EntityDiff[] = []
  let added = 0
  let moved = 0
  let removed = 0
  const perRoom: Partial<Record<CanonicalRoomId, RoomDiffSummary>> = {}

  function bucket(roomId: CanonicalRoomId): RoomDiffSummary {
    const existing = perRoom[roomId]
    if (existing !== undefined) return existing
    const fresh: RoomDiffSummary = { added: 0, movedIn: 0, movedOut: 0 }
    perRoom[roomId] = fresh
    return fresh
  }

  for (const [entityId, currRoom] of curr) {
    if (!prev.has(entityId)) {
      entities.push({ entityId, kind: 'added', currentRoomId: currRoom })
      added++
      if (currRoom !== null) bucket(currRoom).added++
      continue
    }
    const prevRoom = prev.get(entityId) as CanonicalRoomId | null
    if (prevRoom !== currRoom) {
      entities.push({
        entityId,
        kind: 'moved',
        previousRoomId: prevRoom,
        currentRoomId: currRoom,
      })
      moved++
      if (currRoom !== null) {
        const dest = bucket(currRoom)
        dest.added++
        dest.movedIn++
      }
      if (prevRoom !== null) bucket(prevRoom).movedOut++
    }
  }

  for (const [entityId, prevRoom] of prev) {
    if (!curr.has(entityId)) {
      entities.push({ entityId, kind: 'removed', previousRoomId: prevRoom })
      removed++
    }
  }

  return {
    entities,
    perRoom,
    totals: { added, moved, removed },
    appliedAt: input.snapshot.appliedAt,
  }
}
```

- [ ] **Step 4: Re-export from analyzer index**

Edit `packages/analyzer/src/index.ts`. Append to the existing exports:

```ts
export { computeDiff } from './diff.js'
export type { ComputeDiffInput } from './diff.js'
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
pnpm --filter @lovelacer/analyzer test -- diff
pnpm --filter @lovelacer/analyzer test
```

Expected: 9/9 diff tests pass; full analyzer suite still green.

- [ ] **Step 6: Typecheck + lint**

```bash
pnpm typecheck
pnpm lint
```

Expected: pass. With `exactOptionalPropertyTypes`, never assign `undefined` — the implementation above only sets fields when they have a real value.

- [ ] **Step 7: Commit**

```bash
git add packages/analyzer/src/diff.ts \
  packages/analyzer/src/__tests__/diff.test.ts \
  packages/analyzer/src/index.ts
git commit -m "feat(analyzer): computeDiff() pure module for re-analysis diff"
```


---

## Task 3: Server Preview Path — Pipeline + Route + DI

**Files:**
- Modify: `packages/server/src/pipeline.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/routes/preview.ts`
- Modify: `packages/server/src/main.ts`
- Modify: `packages/server/src/__tests__/routes/preview.test.ts`
- Modify: `packages/server/src/__tests__/routes/analyze.test.ts`
- Modify: `packages/server/src/__tests__/routes/overrides.test.ts`
- Modify: `packages/server/src/__tests__/routes/invite.test.ts`
- Modify: `packages/server/src/__tests__/routes/invite-gate.test.ts`
- Modify: `packages/server/src/__tests__/routes/apply.test.ts` (DI thread only — body assertions stay)

**Why this task:** Plumb the snapshot store into the request lifecycle and surface `diff` on `PreviewOutput`. Doing the read path before the write path keeps Task 4's tests focused on persistence semantics.

- [ ] **Step 1: Extend `PreviewOutput` and update `runPreview`**

Edit `packages/server/src/pipeline.ts`. Find the existing `PreviewOutput` interface:

```ts
export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
}
```

Replace with:

```ts
export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
  /** Null when no snapshot has been saved yet (first-run case). */
  diff: DiffResult | null
}
```

Add `DiffResult` and `SnapshotAssignment` to the existing `@lovelacer/shared` import:

```ts
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  DiffResult,
  HaAreaRegistryEntry,
  NormalizedEntity,
  Override,
  RoomAssignment,
  SnapshotAssignment,
} from '@lovelacer/shared'
```

Add `computeDiff` to the existing `@lovelacer/analyzer` import:

```ts
import { computeDiff, detect, groupByDomain, normalize, type RoomGrouping } from '@lovelacer/analyzer'
```

Add an import for the new store at the top of the file:

```ts
import type { AppliedSnapshotStore } from './storage/applied-snapshot-store.js'
```

Find the existing `runPreview` and replace with:

```ts
export async function runPreview(
  ha: HaClient,
  overrides: OverrideStore,
  appliedSnapshot: AppliedSnapshotStore,
): Promise<PreviewOutput> {
  const state = await runFullPipeline(ha, overrides)

  const dashboardGroupings = state.groupings.filter((g) => g.roomId !== 'misc')

  const home = buildHomeView({ entities: state.entities, groupings: dashboardGroupings })
  const rooms = buildRoomViews(dashboardGroupings)
  const config = buildLovelaceConfig({ home, rooms })

  // Build the flat assignments list the diff expects: every visible
  // entity → its assigned room (or null for misc). Mirrors what the
  // frontend will send back at apply time.
  const currentAssignments: SnapshotAssignment[] = []
  for (const room of state.rooms) {
    for (const a of room.assignments) {
      currentAssignments.push({ entityId: a.entityId, roomId: room.id })
    }
  }
  for (const m of state.misc) {
    currentAssignments.push({ entityId: m.entityId, roomId: null })
  }

  const snapshot = appliedSnapshot.get()
  const diff =
    snapshot === null
      ? null
      : computeDiff({ snapshot, current: { assignments: currentAssignments } })

  return {
    rooms: state.rooms,
    misc: state.misc,
    summary: state.summary,
    config,
    diff,
  }
}
```

Update `runApply` signature to thread the new store (real persist logic comes in Task 4):

```ts
export async function runApply(
  ha: HaClient,
  overrides: OverrideStore,
  appliedSnapshot: AppliedSnapshotStore,
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
  const preview = await runPreview(ha, overrides, appliedSnapshot)
  return ha.applyDashboard(preview.config, options)
}
```

- [ ] **Step 2: Extend `CreateAppOptions` and route DI**

Edit `packages/server/src/app.ts`. Add the import:

```ts
import type { AppliedSnapshotStore } from './storage/applied-snapshot-store.js'
```

Update `CreateAppOptions`:

```ts
export interface CreateAppOptions {
  ha: HaClient
  overrides: OverrideStore
  invite: InviteStore
  appliedSnapshot: AppliedSnapshotStore  // NEW
  // … existing fields
}
```

Update the route registrations:

```ts
await app.register(previewRoute, {
  ha: opts.ha,
  overrides: opts.overrides,
  appliedSnapshot: opts.appliedSnapshot,
})
await app.register(applyRoute, {
  ha: opts.ha,
  overrides: opts.overrides,
  appliedSnapshot: opts.appliedSnapshot,
  dashboardUrlPath: opts.dashboardUrlPath,
})
```

- [ ] **Step 3: Update preview route**

Edit `packages/server/src/routes/preview.ts`:

```ts
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import type { OverrideStore } from '../storage/override-store.js'
import type { AppliedSnapshotStore } from '../storage/applied-snapshot-store.js'
import { runPreview } from '../pipeline.js'

export interface PreviewRouteOptions {
  ha: HaClient
  overrides: OverrideStore
  appliedSnapshot: AppliedSnapshotStore
}

export const previewRoute: FastifyPluginAsync<PreviewRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post('/api/preview', async (req, reply) => {
    if (!opts.ha.isConnected()) {
      return reply
        .code(503)
        .send({ error: 'ha_unavailable', message: 'Home Assistant connection not ready' })
    }
    try {
      const result = await runPreview(opts.ha, opts.overrides, opts.appliedSnapshot)
      return reply.code(200).send(result)
    } catch (err) {
      req.log.error({ err }, 'preview failed')
      return reply.code(500).send({ error: 'preview_failed', message: String(err) })
    }
  })
}
```

- [ ] **Step 4: Update apply route DI (body changes come in Task 4)**

Edit `packages/server/src/routes/apply.ts`. Add the import:

```ts
import type { AppliedSnapshotStore } from '../storage/applied-snapshot-store.js'
```

Add `appliedSnapshot` to `ApplyRouteOptions`:

```ts
export interface ApplyRouteOptions {
  ha: HaClient
  overrides: OverrideStore
  appliedSnapshot: AppliedSnapshotStore  // NEW
  dashboardUrlPath: string
}
```

Update the existing `runApply` call so it threads the store:

```ts
const result = await runApply(opts.ha, opts.overrides, opts.appliedSnapshot, body, {
  urlPath: opts.dashboardUrlPath,
})
```

(No body shape changes yet — that's Task 4.)

- [ ] **Step 5: Wire `main.ts`**

Edit `packages/server/src/main.ts`. Add the import:

```ts
import { AppliedSnapshotStore } from './storage/applied-snapshot-store.js'
```

After the existing `OverrideStore` and `InviteStore` instantiations:

```ts
const appliedSnapshotPath = resolve(config.dataDir, 'lovelacer.sqlite')
const appliedSnapshot = new AppliedSnapshotStore(appliedSnapshotPath)
logger.info({ path: appliedSnapshotPath }, 'applied-snapshot store opened')
```

Pass it into `createApp`:

```ts
const app = await createApp({
  ha,
  overrides,
  invite,
  appliedSnapshot,
  isDev,
  // … existing fields
})
```

Update the `shutdown` block's `finally`:

```ts
} finally {
  overrides.close()
  invite.close()
  appliedSnapshot.close()
}
```

- [ ] **Step 6: Add the snapshot helper to existing route tests**

For each of these files, find every `createApp({ … })` call and add `appliedSnapshot: makeAppliedSnapshot(),`. Add the helper near the file's existing helpers (`makeStore`, `makeAcceptedInvite`, etc.):

```ts
import { AppliedSnapshotStore } from '../../storage/applied-snapshot-store.js'

function makeAppliedSnapshot(): AppliedSnapshotStore {
  return new AppliedSnapshotStore(':memory:')
}
```

Files:
- `packages/server/src/__tests__/routes/analyze.test.ts`
- `packages/server/src/__tests__/routes/overrides.test.ts`
- `packages/server/src/__tests__/routes/invite.test.ts`
- `packages/server/src/__tests__/routes/invite-gate.test.ts`
- `packages/server/src/__tests__/routes/apply.test.ts` (DI thread only; body assertions don't change yet)

- [ ] **Step 7: Add diff cases to `preview.test.ts`**

Edit `packages/server/src/__tests__/routes/preview.test.ts`. Add the helper from Step 6 (with an extra overload to plant initial state):

```ts
import { AppliedSnapshotStore } from '../../storage/applied-snapshot-store.js'
import type { AppliedSnapshot } from '@lovelacer/shared'

function makeAppliedSnapshot(initial?: Omit<AppliedSnapshot, 'appliedAt'>): AppliedSnapshotStore {
  const s = new AppliedSnapshotStore(':memory:')
  if (initial !== undefined) s.save(initial)
  return s
}
```

Thread `appliedSnapshot: makeAppliedSnapshot()` into all existing `createApp({ … })` calls in this file.

Append three new tests to the existing `describe`:

```ts
it('returns diff: null when no snapshot exists yet', async () => {
  const ha = makeHa(true)
  const app = await createApp({
    ha,
    overrides: makeStore(),
    invite: makeAcceptedInvite(),
    appliedSnapshot: makeAppliedSnapshot(),
    logLevel: 'silent',
    dashboardUrlPath: 'lovelacer-home',
  })
  try {
    const res = await app.inject({ method: 'POST', url: '/api/preview' })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { diff: unknown }).diff).toBeNull()
  } finally {
    await app.close()
  }
})

it('returns diff with totals all zero when snapshot matches current analysis', async () => {
  const ha = makeHa(true)
  const learner = await createApp({
    ha,
    overrides: makeStore(),
    invite: makeAcceptedInvite(),
    appliedSnapshot: makeAppliedSnapshot(),
    logLevel: 'silent',
    dashboardUrlPath: 'lovelacer-home',
  })
  const assignments: { entityId: string; roomId: string | null }[] = []
  try {
    const res = await learner.inject({ method: 'POST', url: '/api/preview' })
    const body = res.json() as {
      rooms: { id: string; assignments: { entityId: string }[] }[]
      misc: { entityId: string }[]
    }
    for (const r of body.rooms) {
      for (const a of r.assignments) assignments.push({ entityId: a.entityId, roomId: r.id })
    }
    for (const m of body.misc) assignments.push({ entityId: m.entityId, roomId: null })
  } finally {
    await learner.close()
  }

  const app = await createApp({
    ha,
    overrides: makeStore(),
    invite: makeAcceptedInvite(),
    appliedSnapshot: makeAppliedSnapshot({
      assignments: assignments as { entityId: string; roomId: 'kitchen' | null }[],
      config: { title: 'x', views: [] },
    }),
    logLevel: 'silent',
    dashboardUrlPath: 'lovelacer-home',
  })
  try {
    const res = await app.inject({ method: 'POST', url: '/api/preview' })
    const body = res.json() as { diff: { entities: unknown[]; totals: Record<string, number> } }
    expect(body.diff).not.toBeNull()
    expect(body.diff.totals).toEqual({ added: 0, moved: 0, removed: 0 })
    expect(body.diff.entities).toEqual([])
  } finally {
    await app.close()
  }
})

it('flags removed entities when snapshot has an entity that is no longer in HA', async () => {
  const ha = makeHa(true)
  const app = await createApp({
    ha,
    overrides: makeStore(),
    invite: makeAcceptedInvite(),
    appliedSnapshot: makeAppliedSnapshot({
      assignments: [{ entityId: 'light.long_gone_entity', roomId: 'living_room' }],
      config: { title: 'x', views: [] },
    }),
    logLevel: 'silent',
    dashboardUrlPath: 'lovelacer-home',
  })
  try {
    const res = await app.inject({ method: 'POST', url: '/api/preview' })
    const body = res.json() as {
      diff: {
        entities: { entityId: string; kind: string; previousRoomId?: string | null }[]
        totals: Record<string, number>
      }
    }
    expect(body.diff.totals.removed).toBe(1)
    const removed = body.diff.entities.find((e) => e.kind === 'removed')
    expect(removed).toMatchObject({
      entityId: 'light.long_gone_entity',
      kind: 'removed',
      previousRoomId: 'living_room',
    })
  } finally {
    await app.close()
  }
})
```

- [ ] **Step 8: Run tests + typecheck + lint**

```bash
pnpm --filter @lovelacer/server test
pnpm typecheck
pnpm lint
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/pipeline.ts \
  packages/server/src/app.ts \
  packages/server/src/routes/preview.ts \
  packages/server/src/routes/apply.ts \
  packages/server/src/main.ts \
  packages/server/src/__tests__/routes/
git commit -m "feat(server): wire AppliedSnapshotStore + diff into preview route"
```


---

## Task 4: Server Apply Path — Accept + Persist Snapshot

**Files:**
- Modify: `packages/server/src/pipeline.ts`
- Modify: `packages/server/src/routes/apply.ts`
- Modify: `packages/server/src/__tests__/routes/apply.test.ts`

**Why this task:** Frontend → server snapshot persistence. The route must validate the body, persist only after the HA push succeeds, and degrade gracefully when validation or persistence fails.

- [ ] **Step 1: Extend `ApplyInput` and add validator**

Edit `packages/server/src/pipeline.ts`. Find the existing `ApplyInput`:

```ts
export interface ApplyInput {
  config?: LovelaceConfig
  options?: ApplyDashboardOptions
}
```

Replace with:

```ts
export interface ApplyInput {
  config?: LovelaceConfig
  options?: ApplyDashboardOptions
  /**
   * Optional. When present and valid, the server persists this as the
   * "last applied" snapshot AFTER the HA push succeeds. The production
   * frontend always sends it; scripts and tests may omit.
   */
  snapshot?: {
    assignments: SnapshotAssignment[]
    config: unknown
  }
}
```

(`SnapshotAssignment` is already imported from Task 3.)

Add a return type and a validator above the existing `runApply`:

```ts
export interface RunApplyResult extends ApplyDashboardResult {
  /** Set when a snapshot field was sent but rejected by validation. */
  snapshotSkipped?: 'invalid'
  /** Set when persistence threw (SQLite write failure, etc). */
  snapshotPersisted?: false
}

/**
 * Validates the snapshot body. Returns true iff `assignments` is an array
 * of `{ entityId: string, roomId: string|null }` and `config` is an object.
 * Defense-in-depth — the route is the trust boundary.
 */
function isValidSnapshotShape(value: unknown): value is NonNullable<ApplyInput['snapshot']> {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (!Array.isArray(v.assignments)) return false
  for (const a of v.assignments) {
    if (typeof a !== 'object' || a === null) return false
    const r = a as Record<string, unknown>
    if (typeof r.entityId !== 'string') return false
    if (r.roomId !== null && typeof r.roomId !== 'string') return false
  }
  if (typeof v.config !== 'object' || v.config === null) return false
  return true
}
```

- [ ] **Step 2: Update `runApply` body to persist snapshot on success**

Replace the existing `runApply` body:

```ts
export async function runApply(
  ha: HaClient,
  overrides: OverrideStore,
  appliedSnapshot: AppliedSnapshotStore,
  body: ApplyInput,
  defaultOptions: ApplyDashboardOptions = {},
): Promise<RunApplyResult> {
  const options = { ...defaultOptions, ...body.options }

  let result: ApplyDashboardResult
  if (body.config !== undefined) {
    if (typeof body.config.title !== 'string' || !Array.isArray(body.config.views)) {
      throw new InvalidConfigError('invalid_config: title must be string and views must be array')
    }
    result = await ha.applyDashboard(body.config, options)
  } else {
    const preview = await runPreview(ha, overrides, appliedSnapshot)
    result = await ha.applyDashboard(preview.config, options)
  }

  // Snapshot persistence happens AFTER the HA push succeeds. A push
  // failure throws above and we never reach this — that's deliberate
  // (we don't want to snapshot a config that didn't actually land).
  if (body.snapshot === undefined) {
    return result
  }
  if (!isValidSnapshotShape(body.snapshot)) {
    return { ...result, snapshotSkipped: 'invalid' }
  }
  try {
    appliedSnapshot.save({
      assignments: body.snapshot.assignments,
      config: body.snapshot.config,
    })
    return result
  } catch {
    // SQLite write failed (disk full, IO error). The dashboard is live in
    // HA; the user just doesn't get a fresh diff baseline this time.
    return { ...result, snapshotPersisted: false }
  }
}
```

- [ ] **Step 3: Update apply route to surface the new fields**

Edit `packages/server/src/routes/apply.ts`. Find the existing response build (it currently sends `{ ok: true, ...result }`). Replace with an explicit response builder that maps camelCase → snake_case for the API contract:

```ts
const result = await runApply(opts.ha, opts.overrides, opts.appliedSnapshot, body, {
  urlPath: opts.dashboardUrlPath,
})
if (result.snapshotPersisted === false) {
  req.log.error({ urlPath: result.urlPath }, 'snapshot persistence failed after successful apply')
}
const responseBody: Record<string, unknown> = {
  ok: true,
  urlPath: result.urlPath,
  created: result.created,
}
if (result.snapshotSkipped !== undefined) responseBody.snapshot_skipped = result.snapshotSkipped
if (result.snapshotPersisted === false) responseBody.snapshot_persisted = false
return reply.code(200).send(responseBody)
```

(Replace any pre-existing `{ ok: true, ...result }` line so we don't accidentally leak `snapshotSkipped` / `snapshotPersisted` camelCase into the API.)

- [ ] **Step 4: Write the failing apply tests**

Edit `packages/server/src/__tests__/routes/apply.test.ts`. The DI helper from Task 3 is already in place. Append a new `describe`:

```ts
describe('POST /api/apply — snapshot persistence', () => {
  it('persists snapshot after successful HA push', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'lovelacer-home', created: false })
    const snap = makeAppliedSnapshot()
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: snap,
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const body = {
        config: validConfig,
        snapshot: {
          assignments: [{ entityId: 'light.kitchen_ceiling', roomId: 'kitchen' }],
          config: validConfig,
        },
      }
      const res = await app.inject({ method: 'POST', url: '/api/apply', payload: body })
      expect(res.statusCode).toBe(200)
      const json = res.json() as Record<string, unknown>
      expect(json.snapshot_skipped).toBeUndefined()
      expect(json.snapshot_persisted).toBeUndefined()
      const stored = snap.get()
      expect(stored).not.toBeNull()
      expect(stored?.assignments).toEqual([
        { entityId: 'light.kitchen_ceiling', roomId: 'kitchen' },
      ])
    } finally {
      await app.close()
    }
  })

  it('returns snapshot_skipped: invalid when snapshot shape is malformed (push still succeeds)', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'lovelacer-home', created: false })
    const snap = makeAppliedSnapshot()
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: snap,
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const body = {
        config: validConfig,
        snapshot: { assignments: 'not-an-array', config: validConfig },
      }
      const res = await app.inject({ method: 'POST', url: '/api/apply', payload: body })
      expect(res.statusCode).toBe(200)
      expect((res.json() as Record<string, unknown>).snapshot_skipped).toBe('invalid')
      expect(snap.get()).toBeNull()
    } finally {
      await app.close()
    }
  })

  it('does not persist snapshot when no snapshot field is sent', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'lovelacer-home', created: false })
    const snap = makeAppliedSnapshot()
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: snap,
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: validConfig },
      })
      expect(res.statusCode).toBe(200)
      const json = res.json() as Record<string, unknown>
      expect(json.snapshot_skipped).toBeUndefined()
      expect(json.snapshot_persisted).toBeUndefined()
      expect(snap.get()).toBeNull()
    } finally {
      await app.close()
    }
  })

  it('does NOT persist snapshot when HA push fails', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockRejectedValueOnce(new HaApplyError('save', 'boom'))
    const snap = makeAppliedSnapshot()
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: snap,
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const body = {
        config: validConfig,
        snapshot: {
          assignments: [{ entityId: 'light.kitchen_ceiling', roomId: 'kitchen' }],
          config: validConfig,
        },
      }
      const res = await app.inject({ method: 'POST', url: '/api/apply', payload: body })
      expect(res.statusCode).toBe(502)
      expect(snap.get()).toBeNull()
    } finally {
      await app.close()
    }
  })
})
```

- [ ] **Step 5: Run tests + typecheck + lint**

```bash
pnpm --filter @lovelacer/server test -- apply
pnpm --filter @lovelacer/server test
pnpm typecheck
pnpm lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/apply.ts \
  packages/server/src/pipeline.ts \
  packages/server/src/__tests__/routes/apply.test.ts
git commit -m "feat(server): persist applied snapshot after successful HA push"
```


---

## Task 5: Web Foundation — Types + Client + Apply Store + ApplyBar

**Files:**
- Modify: `packages/web/src/api/types.ts`
- Modify: `packages/web/src/api/client.ts`
- Modify: `packages/web/src/__tests__/api/client.test.ts`
- Modify: `packages/web/src/stores/apply.ts`
- Modify: `packages/web/src/__tests__/stores/apply.test.ts`
- Modify: `packages/web/src/components/ApplyBar.vue`

**Why this task:** Mirror the server types in the web layer, plumb the snapshot through the apply call. After this, applying from the UI will start writing snapshots, and the next `/api/preview` will start returning a non-null `diff`. UI components in Tasks 6 & 7 render that.

- [ ] **Step 1: Mirror types in `web/src/api/types.ts`**

Append to the existing types file:

```ts
import type { CanonicalRoomId } from '@lovelacer/shared'

export interface SnapshotAssignment {
  entityId: string
  roomId: CanonicalRoomId | null
}

export interface AppliedSnapshot {
  assignments: SnapshotAssignment[]
  config: unknown
  appliedAt: number
}

export type DiffKind = 'added' | 'moved' | 'removed'

export interface EntityDiff {
  entityId: string
  kind: DiffKind
  previousRoomId?: CanonicalRoomId | null
  currentRoomId?: CanonicalRoomId | null
}

export interface RoomDiffSummary {
  added: number
  movedIn: number
  movedOut: number
}

export interface DiffResult {
  entities: EntityDiff[]
  perRoom: Partial<Record<CanonicalRoomId, RoomDiffSummary>>
  totals: { added: number; moved: number; removed: number }
  appliedAt: number
}
```

Find the existing `PreviewOutput` interface and add `diff`:

```ts
export interface PreviewOutput {
  rooms: AnalyzedRoom[]
  misc: { entityId: string; friendlyName: string; domain: string }[]
  summary: { entityCount: number; roomCount: number; miscCount: number }
  config: LovelaceConfig
  diff: DiffResult | null  // NEW
}
```

Find the existing apply response interface (look for the type that `postApply` returns). Add the optional fields:

```ts
export interface ApplyResponse {
  ok: true
  urlPath: string
  created: boolean
  snapshot_skipped?: 'invalid'
  snapshot_persisted?: false
}
```

(Match the existing field names exactly. If the existing interface uses different naming, adapt — but keep `snapshot_skipped` / `snapshot_persisted` snake_case since that's the API contract.)

- [ ] **Step 2: Update `postApply` in `web/src/api/client.ts`**

Find the existing `postApply` and extend the signature:

```ts
import type { ApplyResponse, SnapshotAssignment } from './types.js'
import type { LovelaceConfig } from '@lovelacer/generator'

export interface PostApplyInput {
  config: LovelaceConfig
  snapshot?: {
    assignments: SnapshotAssignment[]
    config: LovelaceConfig
  }
}

export async function postApply(input: PostApplyInput): Promise<ApplyResponse> {
  const body: Record<string, unknown> = { config: input.config }
  if (input.snapshot !== undefined) body.snapshot = input.snapshot
  const res = await fetch('/api/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw await readApiError(res)
  }
  return (await res.json()) as ApplyResponse
}
```

(Use whatever the existing module's `readApiError` / error helper is named — copy from any other client function.)

- [ ] **Step 3: Add a client test for snapshot pass-through**

Edit `packages/web/src/__tests__/api/client.test.ts`. Append:

```ts
describe('postApply with snapshot', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('forwards snapshot in the request body when provided', async () => {
    const json = vi.fn().mockResolvedValue({ ok: true, urlPath: 'home', created: false })
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json } as unknown as Response)
    const config = { title: 'x', views: [] }
    const snapshot = {
      assignments: [{ entityId: 'light.k', roomId: 'kitchen' as const }],
      config,
    }
    await postApply({ config, snapshot })
    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string,
    ) as Record<string, unknown>
    expect(callBody.config).toEqual(config)
    expect(callBody.snapshot).toEqual(snapshot)
  })

  it('omits snapshot from the body when not provided', async () => {
    const json = vi.fn().mockResolvedValue({ ok: true, urlPath: 'home', created: false })
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json } as unknown as Response)
    await postApply({ config: { title: 'x', views: [] } })
    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string,
    ) as Record<string, unknown>
    expect(callBody.snapshot).toBeUndefined()
  })
})
```

If `postApply`'s existing tests already use a different fetch mocking pattern, follow that pattern instead.

- [ ] **Step 4: Update `useApplyStore`**

Edit `packages/web/src/stores/apply.ts`. Find the existing `apply()` action and update:

```ts
import type { LovelaceConfig } from '@lovelacer/generator'
import type { SnapshotAssignment } from '../api/types.js'
import type { PostApplyInput } from '../api/client.js'

async function apply(input: {
  config: LovelaceConfig
  snapshot?: { assignments: SnapshotAssignment[]; config: LovelaceConfig }
}) {
  phase.value = 'applying'
  error.value = null
  try {
    const fetchInput: PostApplyInput = { config: input.config }
    if (input.snapshot !== undefined) fetchInput.snapshot = input.snapshot
    result.value = await postApply(fetchInput)
    phase.value = 'success'
  } catch (err) {
    error.value = err as ApiError
    phase.value = 'error'
  }
}
```

Keep the existing `phase`, `result`, `error` refs and `reset()`.

- [ ] **Step 5: Add an apply-store test**

Edit `packages/web/src/__tests__/stores/apply.test.ts`. Append:

```ts
it('passes snapshot through to postApply when provided', async () => {
  const config = { title: 'x', views: [] }
  const snapshot = {
    assignments: [{ entityId: 'light.k', roomId: 'kitchen' as const }],
    config,
  }
  vi.mocked(postApply).mockResolvedValueOnce({ ok: true, urlPath: 'home', created: false })
  const store = useApplyStore()
  await store.apply({ config, snapshot })
  expect(postApply).toHaveBeenCalledWith({ config, snapshot })
})
```

(Adapt to the existing test file's mocking pattern — it already mocks `postApply`.)

- [ ] **Step 6: Update `ApplyBar.vue` to derive snapshot**

Edit `packages/web/src/components/ApplyBar.vue`. Find the existing `applyClicked` function:

```ts
function applyClicked() {
  if (analyze.preview === null) return
  void apply.apply(analyze.preview.config)
}
```

Replace with:

```ts
import type { SnapshotAssignment } from '../api/types.js'

function applyClicked() {
  if (analyze.preview === null) return
  // Build the assignments list the server expects: every visible entity →
  // its assigned room (or null for misc). Mirrors the server's preview
  // route, so what the user sees IS what gets snapshotted.
  const assignments: SnapshotAssignment[] = []
  for (const room of analyze.preview.rooms) {
    for (const a of room.assignments) {
      assignments.push({ entityId: a.entityId, roomId: room.id })
    }
  }
  for (const m of analyze.preview.misc) {
    assignments.push({ entityId: m.entityId, roomId: null })
  }
  void apply.apply({
    config: analyze.preview.config,
    snapshot: { assignments, config: analyze.preview.config },
  })
}
```

- [ ] **Step 7: Run all web tests + typecheck + lint**

```bash
pnpm --filter @lovelacer/web test
pnpm typecheck
pnpm lint
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/api/types.ts \
  packages/web/src/api/client.ts \
  packages/web/src/__tests__/api/client.test.ts \
  packages/web/src/stores/apply.ts \
  packages/web/src/__tests__/stores/apply.test.ts \
  packages/web/src/components/ApplyBar.vue
git commit -m "feat(web): apply path ships snapshot to server"
```


---

## Task 6: DiffBanner + RemovedEntitiesPanel Components

**Files:**
- Create: `packages/web/src/components/DiffBanner.vue`
- Create: `packages/web/src/components/RemovedEntitiesPanel.vue`
- Create: `packages/web/src/__tests__/components/DiffBanner.test.ts`
- Create: `packages/web/src/__tests__/components/RemovedEntitiesPanel.test.ts`

**Why this task:** Two new UI components, each with focused render branches. They're standalone (no extra wiring) and easy to test in isolation before touching `App.vue` in Task 7.

- [ ] **Step 1: Write failing DiffBanner test**

Create `packages/web/src/__tests__/components/DiffBanner.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DiffBanner from '../../components/DiffBanner.vue'
import type { DiffResult } from '../../api/types.js'

function mountBanner(diff: DiffResult | null) {
  return mount(DiffBanner, { props: { diff } })
}

describe('DiffBanner', () => {
  it('does not render anything when diff is null (first-run case)', () => {
    const wrapper = mountBanner(null)
    expect(wrapper.find('[data-testid="diff-banner"]').exists()).toBe(false)
  })

  it('renders the muted "no changes" line when totals are all zero', () => {
    const diff: DiffResult = {
      entities: [],
      perRoom: {},
      totals: { added: 0, moved: 0, removed: 0 },
      appliedAt: Math.floor(Date.now() / 1000),
    }
    const wrapper = mountBanner(diff)
    const banner = wrapper.find('[data-testid="diff-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('No changes since last apply')
  })

  it('renders pill counts when totals are non-zero', () => {
    const diff: DiffResult = {
      entities: [],
      perRoom: {},
      totals: { added: 5, moved: 2, removed: 1 },
      appliedAt: Math.floor(Date.now() / 1000),
    }
    const wrapper = mountBanner(diff)
    const banner = wrapper.find('[data-testid="diff-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.find('[data-testid="diff-banner-added"]').text()).toContain('5')
    expect(banner.find('[data-testid="diff-banner-moved"]').text()).toContain('2')
    expect(banner.find('[data-testid="diff-banner-removed"]').text()).toContain('1')
  })

  it('omits zero-count pills', () => {
    const diff: DiffResult = {
      entities: [],
      perRoom: {},
      totals: { added: 3, moved: 0, removed: 0 },
      appliedAt: Math.floor(Date.now() / 1000),
    }
    const wrapper = mountBanner(diff)
    expect(wrapper.find('[data-testid="diff-banner-added"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diff-banner-moved"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="diff-banner-removed"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @lovelacer/web test -- DiffBanner
```

Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement DiffBanner**

Create `packages/web/src/components/DiffBanner.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { DiffResult } from '../api/types.js'

const props = defineProps<{ diff: DiffResult | null }>()

const isZero = computed(
  () =>
    props.diff !== null &&
    props.diff.totals.added === 0 &&
    props.diff.totals.moved === 0 &&
    props.diff.totals.removed === 0,
)

/**
 * Format the snapshot's appliedAt as "today", "yesterday", or an absolute
 * date. Avoids importing a date library — the formatting is local-only.
 */
function formatApplied(unixSeconds: number): string {
  const applied = new Date(unixSeconds * 1000)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  return applied.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <section
    v-if="diff !== null"
    data-testid="diff-banner"
    class="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-5 py-2 text-sm"
  >
    <div v-if="isZero" class="text-stone-600">
      No changes since last apply {{ formatApplied(diff.appliedAt) }}.
    </div>
    <div v-else class="flex items-center gap-2">
      <span class="text-stone-600">Since last apply:</span>
      <span
        v-if="diff.totals.added > 0"
        data-testid="diff-banner-added"
        class="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
        >+{{ diff.totals.added }} added</span
      >
      <span
        v-if="diff.totals.moved > 0"
        data-testid="diff-banner-moved"
        class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
        >↻ {{ diff.totals.moved }} moved</span
      >
      <span
        v-if="diff.totals.removed > 0"
        data-testid="diff-banner-removed"
        class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
        >✗ {{ diff.totals.removed }} removed</span
      >
    </div>
    <span class="text-xs text-stone-500">{{ formatApplied(diff.appliedAt) }}</span>
  </section>
</template>
```

- [ ] **Step 4: Run DiffBanner tests to confirm pass**

```bash
pnpm --filter @lovelacer/web test -- DiffBanner
```

Expected: 4/4 pass.

- [ ] **Step 5: Write failing RemovedEntitiesPanel test**

Create `packages/web/src/__tests__/components/RemovedEntitiesPanel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RemovedEntitiesPanel from '../../components/RemovedEntitiesPanel.vue'
import type { DiffResult } from '../../api/types.js'

function mountPanel(diff: DiffResult) {
  return mount(RemovedEntitiesPanel, { props: { diff } })
}

describe('RemovedEntitiesPanel', () => {
  it('renders nothing when no removed entities', () => {
    const wrapper = mountPanel({
      entities: [],
      perRoom: {},
      totals: { added: 1, moved: 0, removed: 0 },
      appliedAt: 0,
    })
    expect(wrapper.find('[data-testid="removed-panel"]').exists()).toBe(false)
  })

  it('lists each removed entity with its previous room name', () => {
    const wrapper = mountPanel({
      entities: [
        { entityId: 'light.guest_lamp', kind: 'removed', previousRoomId: 'guest_room' },
        { entityId: 'sensor.gone', kind: 'removed', previousRoomId: 'kitchen' },
      ],
      perRoom: {},
      totals: { added: 0, moved: 0, removed: 2 },
      appliedAt: 0,
    })
    const panel = wrapper.find('[data-testid="removed-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('light.guest_lamp')
    expect(panel.text()).toContain('Guest Room')
    expect(panel.text()).toContain('sensor.gone')
    expect(panel.text()).toContain('Kitchen')
  })

  it('renders "Misc" when previousRoomId is null', () => {
    const wrapper = mountPanel({
      entities: [{ entityId: 'sensor.was_misc', kind: 'removed', previousRoomId: null }],
      perRoom: {},
      totals: { added: 0, moved: 0, removed: 1 },
      appliedAt: 0,
    })
    const panel = wrapper.find('[data-testid="removed-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('Misc')
  })

  it('only renders entities with kind=removed (ignores added/moved that may share the diff)', () => {
    const wrapper = mountPanel({
      entities: [
        { entityId: 'light.added', kind: 'added', currentRoomId: 'kitchen' },
        { entityId: 'light.gone', kind: 'removed', previousRoomId: 'office' },
      ],
      perRoom: {},
      totals: { added: 1, moved: 0, removed: 1 },
      appliedAt: 0,
    })
    const panel = wrapper.find('[data-testid="removed-panel"]')
    expect(panel.text()).toContain('light.gone')
    expect(panel.text()).not.toContain('light.added')
  })
})
```

- [ ] **Step 6: Run test to confirm it fails**

```bash
pnpm --filter @lovelacer/web test -- RemovedEntitiesPanel
```

Expected: FAIL — component doesn't exist.

- [ ] **Step 7: Implement RemovedEntitiesPanel**

Create `packages/web/src/components/RemovedEntitiesPanel.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { CanonicalRoomId } from '@lovelacer/shared'
import type { DiffResult, EntityDiff } from '../api/types.js'
import { roomIdToDisplay } from '../rooms.js'

const props = defineProps<{ diff: DiffResult }>()

const removed = computed<EntityDiff[]>(() =>
  props.diff.entities.filter((e) => e.kind === 'removed'),
)

function formatPrevious(roomId: CanonicalRoomId | null | undefined): string {
  if (roomId === null || roomId === undefined) return 'Misc'
  return roomIdToDisplay(roomId)
}
</script>

<template>
  <section
    v-if="removed.length > 0"
    data-testid="removed-panel"
    class="rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900"
  >
    <p class="font-medium">
      {{ removed.length }} entit{{ removed.length === 1 ? 'y' : 'ies' }} removed since last apply
    </p>
    <ul class="mt-2 space-y-1">
      <li
        v-for="entity in removed"
        :key="entity.entityId"
        data-testid="removed-entity"
        class="flex items-center gap-3 text-xs"
      >
        <span class="font-mono">{{ entity.entityId }}</span>
        <span class="text-amber-700">· was in {{ formatPrevious(entity.previousRoomId) }}</span>
      </li>
    </ul>
  </section>
</template>
```

`roomIdToDisplay` is already exported from `packages/web/src/rooms.ts` — verify before importing. If its signature is `(roomId: string) => string` (not `CanonicalRoomId`), the call site is still fine since `CanonicalRoomId` widens to `string`.

- [ ] **Step 8: Run RemovedEntitiesPanel tests to confirm pass**

```bash
pnpm --filter @lovelacer/web test -- RemovedEntitiesPanel
```

Expected: 4/4 pass.

- [ ] **Step 9: Run all web tests + typecheck + lint**

```bash
pnpm --filter @lovelacer/web test
pnpm typecheck
pnpm lint
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add packages/web/src/components/DiffBanner.vue \
  packages/web/src/components/RemovedEntitiesPanel.vue \
  packages/web/src/__tests__/components/DiffBanner.test.ts \
  packages/web/src/__tests__/components/RemovedEntitiesPanel.test.ts
git commit -m "feat(web): DiffBanner + RemovedEntitiesPanel components"
```


---

## Task 7: RoomList Badges + EntityRow Tags + App.vue Wiring

**Files:**
- Modify: `packages/web/src/components/RoomList.vue`
- Modify: `packages/web/src/components/EntityRow.vue`
- Modify: `packages/web/src/App.vue`
- Modify: `packages/web/src/__tests__/components/RoomList.test.ts`
- Modify: `packages/web/src/__tests__/components/EntityRow.test.ts`
- Modify: `packages/web/src/__tests__/App.test.ts`

**Why this task:** Surface the diff at every level: per-room badges, per-entity inline tags, and the integration between `App.vue` and the new `DiffBanner` / `RemovedEntitiesPanel`.

- [ ] **Step 1: Write failing RoomList badge tests**

Edit `packages/web/src/__tests__/components/RoomList.test.ts`. Append a new `describe`:

```ts
describe('RoomList diff badges', () => {
  const baseRoom = {
    id: 'kitchen' as const,
    haAreaId: 'kitchen',
    displayName: 'Kitchen',
    entityCount: 1,
    averageConfidence: 0.9,
    assignments: [
      { entityId: 'light.kitchen_ceiling', roomId: 'kitchen' as const, confidence: 0.9, signals: [] },
    ],
  }

  it('renders no badges when diffByRoom prop is empty', () => {
    const wrapper = mount(RoomList, { props: { rooms: [baseRoom], diffByRoom: {} } })
    expect(wrapper.find('[data-testid="room-diff-added"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="room-diff-moved-out"]').exists()).toBe(false)
  })

  it('renders +N new pill when room has additions', () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [baseRoom],
        diffByRoom: { kitchen: { added: 3, movedIn: 1, movedOut: 0 } },
      },
    })
    expect(wrapper.find('[data-testid="room-diff-added"]').text()).toContain('3')
  })

  it('renders moved-out badge when entities left the room', () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [baseRoom],
        diffByRoom: { kitchen: { added: 0, movedIn: 0, movedOut: 2 } },
      },
    })
    expect(wrapper.find('[data-testid="room-diff-moved-out"]').text()).toContain('2')
  })
})
```

- [ ] **Step 2: Update `RoomList.vue` to accept `diffByRoom` and render badges**

Edit `packages/web/src/components/RoomList.vue`. Update the `defineProps`:

```ts
import type { AnalyzedRoom, EntityDiff, RoomDiffSummary } from '../api/types.js'
import type { CanonicalRoomId } from '@lovelacer/shared'

defineProps<{
  rooms: AnalyzedRoom[]
  diffByRoom?: Partial<Record<CanonicalRoomId, RoomDiffSummary>>
  diffByEntityId?: Map<string, EntityDiff>
}>()
```

Inside the existing room row's right-hand cluster (`<div class="flex items-center gap-3 text-xs text-stone-600">`), add badges before the confidence pill:

```vue
<template v-if="(diffByRoom ?? {})[room.id]">
  <span
    v-if="(diffByRoom ?? {})[room.id]!.added > 0"
    data-testid="room-diff-added"
    class="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
    >+{{ (diffByRoom ?? {})[room.id]!.added }} new</span
  >
  <span
    v-if="(diffByRoom ?? {})[room.id]!.movedOut > 0"
    data-testid="room-diff-moved-out"
    class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
    >↻ {{ (diffByRoom ?? {})[room.id]!.movedOut }} left</span
  >
</template>
```

- [ ] **Step 3: Run RoomList tests to confirm pass**

```bash
pnpm --filter @lovelacer/web test -- RoomList
```

Expected: 3/3 new tests pass; existing tests still pass.

- [ ] **Step 4: Write failing EntityRow tag tests**

Edit `packages/web/src/__tests__/components/EntityRow.test.ts`. Append:

```ts
describe('EntityRow diff tag', () => {
  it('renders no tag when diff prop is undefined', () => {
    const wrapper = mount(EntityRow, {
      props: {
        entityId: 'light.kitchen_ceiling',
        friendlyName: 'Kitchen Ceiling',
        roomId: 'kitchen' as const,
      },
    })
    expect(wrapper.find('[data-testid="entity-diff-tag"]').exists()).toBe(false)
  })

  it('renders "New" pill when diff.kind is added', () => {
    const wrapper = mount(EntityRow, {
      props: {
        entityId: 'light.new_lamp',
        friendlyName: 'New Lamp',
        roomId: 'kitchen' as const,
        diff: {
          entityId: 'light.new_lamp',
          kind: 'added' as const,
          currentRoomId: 'kitchen' as const,
        },
      },
    })
    const tag = wrapper.find('[data-testid="entity-diff-tag"]')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toBe('New')
  })

  it('renders "Moved from {previous}" when diff.kind is moved', () => {
    const wrapper = mount(EntityRow, {
      props: {
        entityId: 'light.lamp',
        friendlyName: 'Lamp',
        roomId: 'bedroom' as const,
        diff: {
          entityId: 'light.lamp',
          kind: 'moved' as const,
          previousRoomId: 'living_room' as const,
          currentRoomId: 'bedroom' as const,
        },
      },
    })
    const tag = wrapper.find('[data-testid="entity-diff-tag"]')
    expect(tag.text()).toContain('Moved from')
    expect(tag.text()).toContain('Living Room')
  })

  it('renders "Moved from Misc" when previousRoomId is null', () => {
    const wrapper = mount(EntityRow, {
      props: {
        entityId: 'light.was_misc',
        friendlyName: 'Was Misc',
        roomId: 'kitchen' as const,
        diff: {
          entityId: 'light.was_misc',
          kind: 'moved' as const,
          previousRoomId: null,
          currentRoomId: 'kitchen' as const,
        },
      },
    })
    expect(wrapper.find('[data-testid="entity-diff-tag"]').text()).toContain('Misc')
  })
})
```

- [ ] **Step 5: Update `EntityRow.vue` to accept `diff` and render tag**

Edit `packages/web/src/components/EntityRow.vue`. If the existing component uses inline `defineProps<…>()` without binding to a name, refactor to `const props = defineProps<…>()` first.

```ts
import { computed } from 'vue'
import type { CanonicalRoomId } from '@lovelacer/shared'
import type { EntityDiff } from '../api/types.js'
import { roomIdToDisplay } from '../rooms.js'

const props = defineProps<{
  entityId: string
  friendlyName: string
  roomId: CanonicalRoomId
  manual?: boolean
  diff?: EntityDiff
}>()

const diffTagText = computed<string | null>(() => {
  if (props.diff === undefined) return null
  if (props.diff.kind === 'added') return 'New'
  if (props.diff.kind === 'moved') {
    const prev = props.diff.previousRoomId
    const label = prev === null || prev === undefined ? 'Misc' : roomIdToDisplay(prev)
    return `Moved from ${label}`
  }
  return null
})

const diffTagClass = computed<string>(() => {
  if (props.diff?.kind === 'added') return 'bg-green-100 text-green-800'
  if (props.diff?.kind === 'moved') return 'bg-blue-100 text-blue-800'
  return ''
})
```

In the template, add the tag next to the friendly name (placement depends on the existing layout — adjacent to the entity-name span is natural):

```vue
<span
  v-if="diffTagText !== null"
  data-testid="entity-diff-tag"
  class="ml-2 rounded px-2 py-0.5 text-xs font-medium"
  :class="diffTagClass"
  >{{ diffTagText }}</span
>
```

- [ ] **Step 6: Run EntityRow tests to confirm pass**

```bash
pnpm --filter @lovelacer/web test -- EntityRow
```

Expected: 4/4 new tests pass; existing tests still pass.

- [ ] **Step 7: Pipe `diffByEntityId` through `RoomList` to `EntityRow`**

Still in `RoomList.vue`, find the existing `<EntityRow>` invocation:

```vue
<EntityRow
  :entity-id="a.entityId"
  :friendly-name="entityIdToFriendly(a.entityId)"
  :room-id="a.roomId"
  v-bind="a.manual !== undefined ? { manual: a.manual } : {}"
/>
```

Append the diff binding (Vue allows multiple `v-bind` directives; with `exactOptionalPropertyTypes`, omit the prop entirely when there's no diff rather than passing `undefined`):

```vue
<EntityRow
  :entity-id="a.entityId"
  :friendly-name="entityIdToFriendly(a.entityId)"
  :room-id="a.roomId"
  v-bind="a.manual !== undefined ? { manual: a.manual } : {}"
  v-bind="(diffByEntityId ?? new Map()).has(a.entityId) ? { diff: (diffByEntityId ?? new Map()).get(a.entityId) } : {}"
/>
```

- [ ] **Step 8: Wire `App.vue`**

Edit `packages/web/src/App.vue`. Add imports:

```ts
import { computed } from 'vue'
import DiffBanner from './components/DiffBanner.vue'
import RemovedEntitiesPanel from './components/RemovedEntitiesPanel.vue'
import type { CanonicalRoomId } from '@lovelacer/shared'
import type { EntityDiff, RoomDiffSummary } from './api/types.js'
```

Add computeds for the diff maps. Place after the existing store assignments:

```ts
const diffByRoom = computed<Partial<Record<CanonicalRoomId, RoomDiffSummary>>>(
  () => analyze.preview?.diff?.perRoom ?? {},
)

const diffByEntityId = computed<Map<string, EntityDiff>>(() => {
  const map = new Map<string, EntityDiff>()
  const entities = analyze.preview?.diff?.entities ?? []
  for (const e of entities) map.set(e.entityId, e)
  return map
})
```

In the template, find the existing `<RoomList :rooms="analyze.preview.rooms" />` and update the surrounding section so `DiffBanner` + `RemovedEntitiesPanel` render above it and the maps thread through:

```vue
<section v-if="analyze.phase === 'ready' && analyze.preview !== null" class="space-y-4">
  <DiffBanner :diff="analyze.preview.diff" />
  <RemovedEntitiesPanel
    v-if="analyze.preview.diff !== null && analyze.preview.diff.totals.removed > 0"
    :diff="analyze.preview.diff"
  />
  <RoomList
    :rooms="analyze.preview.rooms"
    :diff-by-room="diffByRoom"
    :diff-by-entity-id="diffByEntityId"
  />
  <MiscBucket :misc="analyze.preview.misc" />
  <OverridesBar />
  <DashboardPreview :config="analyze.preview.config" />
  <ApplyBar />
</section>
```

- [ ] **Step 9: Add an App integration test for the diff render path**

Edit `packages/web/src/__tests__/App.test.ts`. Inside the existing `describe('App integration')` (which already mocks `getInvite` to `accepted: true`):

```ts
it('renders DiffBanner, room badges, and entity tags when preview includes a diff', async () => {
  const previewWithDiff: PreviewOutput = {
    rooms: [
      {
        id: 'kitchen',
        haAreaId: 'kitchen',
        displayName: 'Kitchen',
        entityCount: 2,
        averageConfidence: 0.9,
        assignments: [
          {
            entityId: 'light.kitchen_ceiling',
            roomId: 'kitchen',
            confidence: 0.9,
            signals: [],
          },
          { entityId: 'light.new_lamp', roomId: 'kitchen', confidence: 0.9, signals: [] },
        ],
      },
    ],
    misc: [],
    summary: { entityCount: 2, roomCount: 1, miscCount: 0 },
    config: { title: 'x', views: [] },
    diff: {
      entities: [
        {
          entityId: 'light.new_lamp',
          kind: 'added',
          currentRoomId: 'kitchen',
        },
        {
          entityId: 'light.guest_lamp',
          kind: 'removed',
          previousRoomId: 'guest_room',
        },
      ],
      perRoom: { kitchen: { added: 1, movedIn: 0, movedOut: 0 } },
      totals: { added: 1, moved: 0, removed: 1 },
      appliedAt: Math.floor(Date.now() / 1000),
    },
  }

  const wrapper = mount(App, {
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
    },
  })
  const analyze = useAnalyzeStore()
  analyze.$patch({ phase: 'ready', preview: previewWithDiff })
  await wrapper.vm.$nextTick()

  expect(wrapper.find('[data-testid="diff-banner"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="diff-banner-added"]').text()).toContain('1')
  expect(wrapper.find('[data-testid="diff-banner-removed"]').text()).toContain('1')
  expect(wrapper.find('[data-testid="removed-panel"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="room-diff-added"]').text()).toContain('1')
  // Open the room details to render the entity rows
  await wrapper.find('details').trigger('click')
  const tags = wrapper.findAll('[data-testid="entity-diff-tag"]')
  expect(tags.some((t) => t.text() === 'New')).toBe(true)
})
```

- [ ] **Step 10: Run all web tests + typecheck + lint + format-check**

```bash
pnpm --filter @lovelacer/web test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass. If `format:check` flags files, run `pnpm exec prettier --write <file>` and re-stage.

- [ ] **Step 11: Run the full workspace test suite**

```bash
pnpm test
```

Expected: all green.

- [ ] **Step 12: Commit**

```bash
git add packages/web/src/components/RoomList.vue \
  packages/web/src/components/EntityRow.vue \
  packages/web/src/App.vue \
  packages/web/src/__tests__/components/RoomList.test.ts \
  packages/web/src/__tests__/components/EntityRow.test.ts \
  packages/web/src/__tests__/App.test.ts
git commit -m "feat(web): wire diff into RoomList badges, EntityRow tags, App"
```

---

## Final Verification

- [ ] **Step F1: Run the full workspace test suite**

```bash
pnpm test
```

Expected: all packages green. Total test count grows by ~25 across analyzer, server, and web.

- [ ] **Step F2: Typecheck + lint + format-check**

```bash
pnpm typecheck && pnpm lint && pnpm format:check
```

Expected: all pass with no warnings or errors.

- [ ] **Step F3: Manual smoke test (per ROADMAP DoD)**

```bash
pnpm dev:ha   # bring up the dev HA container if not already running
pnpm dev      # start the server + web dev stack
```

In the browser:

1. Open the SPA, click Analyze. Expect: no `DiffBanner`, no badges (first-run).
2. Click Apply. Expect: dashboard appears in HA, ApplyBar shows success.
3. Click Start over to dismiss, then Analyze again. Expect: muted "No changes since last apply today" banner.
4. In the dev HA's fixture YAML, add 5 new entities. Restart the HA container.
5. Click Analyze. Expect: banner says `+5 added`, the affected rooms show `+N new` badges, each new entity has a green "New" tag.
6. In the dev HA fixture, remove one of the original entities. Restart HA.
7. Click Analyze. Expect: banner now says `+5 added · ✗ 1 removed`. `RemovedEntitiesPanel` lists the removed entity with its previous room.

Roll back the fixture changes when done.

- [ ] **Step F4: Push branch + open PR**

```bash
git push -u origin feat/p2-1-diff-view
gh pr create --title "feat: P2-1 re-analysis diff view" --body "$(cat <<'EOF'
## Summary

- Captures a {assignments, config} snapshot at apply time and persists it in a new single-row SQLite table (AppliedSnapshotStore, mirrors InviteStore).
- New pure computeDiff() in @lovelacer/analyzer that compares the persisted snapshot against the current analysis and emits structured added/moved/removed entries plus per-room rollups.
- Surfaces the diff at three levels in the UI: top DiffBanner (with date), per-room badges in RoomList, inline tags in EntityRow. Removed entities get a dedicated RemovedEntitiesPanel callout.
- First-run is silent; no-change re-analyzes show a muted "no changes" line; persistence + validation failures are non-fatal (push always wins).

## Test plan

- [ ] pnpm test — full workspace suite green
- [ ] pnpm typecheck && pnpm lint && pnpm format:check — all clean
- [ ] Manual smoke test per the plan's Step F3 (apply, no-change re-analyze, add 5 entities, remove 1)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope (per spec)

- Diff history beyond the most recent apply.
- YAML drift detection (the config column is archival; nothing reads it yet).
- Per-card diffs.
- Diff suppression / dismissal UI.
- Confidence-change tracking.
