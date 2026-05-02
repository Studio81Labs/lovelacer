# P2-3 Floor-Aware Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Rooms by floor" section to the dashboard's Home view when HA has floor data, organizing room navigation tiles into per-floor groups via heading + glance cards. ActiveRooms stays exactly as today; pure additive change.

**Architecture:** Three layers. The server pipeline gains a `getFloorRegistry()` fetch (with defensive try/catch for older HA versions) and threads `floors` + a per-room floor-assignment map through `runPreview`. A new pure `assignFloors()` in `@lovelacer/analyzer` maps each canonical room to its floor via `room.haAreaId → area.floor_id → floor`. The generator's `buildHomeView` gains a new `buildRoomsByFloorSection()` that consumes the assignment map and emits alternating `HeadingCard` + (widened) `GlanceCard` per floor. `GlanceCard.entities` widens to support per-entry `tap_action: navigate` so each room glance becomes tap-to-navigate.

**Tech Stack:** TypeScript strict (`verbatimModuleSyntax`, `exactOptionalPropertyTypes`), pnpm workspace monorepo, Vitest with `globals: false`, Vue 3 + Tailwind 4 (frontend untouched this ticket).

---

## Source of Truth

`docs/superpowers/specs/2026-05-02-p2-3-floor-aware-grouping-design.md` is the canonical spec. If anything in this plan contradicts that doc, the spec wins — fix the plan and re-run.

## Codebase Conventions (read before starting)

- ESM with explicit `.js` extensions on imports even when importing TS source.
- Vitest tests must `import { describe, it, expect } from 'vitest'` — `globals: false`.
- The `@lovelacer/shared` package exports types only (no value imports cross the boundary). Other packages import via `import type { ... } from '@lovelacer/shared'`.
- The fixture builder at `tests/fixtures/_builder/index.ts` already has full `floors` support — `fixtureToHaRegistries(fx)` returns `{ entities, devices, areas, floors }`. The `english-cluttered` fixture has `floors: [ground, upstairs]` so it can drive happy-path tests.
- Existing `makeHa()` helpers in route tests stub `getFloorRegistry: vi.fn(async () => [])`. They keep working as-is after Task 3 (empty floors → assignFloors all-null → section absent). New floor-aware tests in `preview.test.ts` need an updated helper that surfaces `ha.floors`.
- The home view's section composition lives in `buildHomeView()` at `packages/generator/src/home-view.ts:84`. Section order today: Welcome → QuickStats → People → ActiveRooms → Scenes → Cameras. The new section slots between People and ActiveRooms.

## File Structure

**New:**

| Path                                            | Responsibility                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/analyzer/src/floor.ts`                | Pure `assignFloors()` — input rooms+areas+floors, output Map<roomId, floor> |
| `packages/analyzer/src/__tests__/floor.test.ts` | 8 tests covering null/full/stale/multi-floor cases + misc exclusion         |

**Modified:**

| Path                                                   | Changes                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `packages/shared/src/types.ts`                         | Add `FloorAssignment { floorId, name, level, icon }`                                          |
| `packages/analyzer/src/index.ts`                       | Re-export `assignFloors` value + `AssignFloorsInput` type                                     |
| `packages/generator/src/lovelace-types.ts`             | Widen `GlanceCard.entities` to `(string \| GlanceEntityEntry)[]`; add `GlanceEntityEntry`     |
| `packages/generator/src/home-view.ts`                  | Add `pickPrimaryEntity` helper, `buildRoomsByFloorSection`; extend `BuildHomeViewInput`       |
| `packages/generator/src/index.ts`                      | Re-export `buildRoomsByFloorSection`, `BuildRoomsByFloorSectionInput`, `GlanceEntityEntry`    |
| `packages/generator/src/__tests__/home-view.test.ts`   | Add 8 cases for the new section                                                               |
| `packages/server/src/pipeline.ts`                      | Fetch floors (defensive try/catch); compute `floorAssignments`; thread to `buildHomeView`     |
| `packages/server/src/__tests__/pipeline.test.ts`       | Add test asserting `getFloorRegistry` is called + `runPreview` doesn't throw on its rejection |
| `packages/server/src/__tests__/routes/preview.test.ts` | Add floor-aware response tests (happy path, error-downgrade)                                  |

`packages/shared/src/index.ts` already uses `export * from './types.js'` so the new `FloorAssignment` type is automatically re-exported — no edit needed there.

---

## Setup

- [ ] **Step 0a: Create the worktree**

```bash
git fetch origin
git worktree add .worktrees/p2-3-floor-grouping -b feat/p2-3-floor-grouping origin/main
cd .worktrees/p2-3-floor-grouping
```

Expected: new worktree at `.worktrees/p2-3-floor-grouping/` on branch `feat/p2-3-floor-grouping` based on the latest `origin/main`. Spec file is present.

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

## Task 1: Foundation — Types + assignFloors

**Files:**

- Modify: `packages/shared/src/types.ts`
- Modify: `packages/generator/src/lovelace-types.ts`
- Create: `packages/analyzer/src/floor.ts`
- Create: `packages/analyzer/src/__tests__/floor.test.ts`
- Modify: `packages/analyzer/src/index.ts`
- Modify: `packages/generator/src/index.ts`

**Why this task:** Pure types and a pure function. No IO, no integration concerns. The route + generator pieces in Task 2 and Task 3 depend on these types and the `assignFloors` signature.

### Step 1: Add `FloorAssignment` to shared types

Append to `packages/shared/src/types.ts`:

```ts
/**
 * P2-3 — floor-aware grouping types.
 *
 * Captures the floor a canonical room is associated with via the chain
 * `room.haAreaId → area.floor_id → floor`. Surfaces in the dashboard
 * via `buildRoomsByFloorSection` (a new home-view section); does NOT
 * modify AnalyzedRoom — the room→floor map is a separate output of
 * `assignFloors()` from @lovelacer/analyzer.
 */
export interface FloorAssignment {
  floorId: string
  /** Floor display name from the HA registry. */
  name: string
  /** HA's level number; null if not set. Used for sort order. */
  level: number | null
  /** Optional MDI icon from HA. Captured for forward compatibility — not yet rendered. */
  icon: string | null
}
```

The `packages/shared/src/index.ts` already does `export * from './types.js'` (added during P2-1) so the type is automatically re-exported — verify by reading that file but don't add anything.

### Step 2: Widen `GlanceCard` in lovelace-types

Edit `packages/generator/src/lovelace-types.ts`. Find the existing `GlanceCard`:

```ts
export interface GlanceCard {
  type: 'glance'
  title?: string
  entities: string[]
}
```

Replace with:

```ts
/**
 * P2-3 — per-entry overrides on a glance card. HA's actual schema accepts
 * each entries[] element as either a string or an object with overrides.
 * Used by `buildRoomsByFloorSection` to surface room display names + tap-
 * to-navigate on each room glance entry.
 */
export interface GlanceEntityEntry {
  entity: string
  /** Override for HA's friendly_name. Used to surface room names instead of entity names. */
  name?: string
  /** Click behavior. Only `navigate` is modeled today; matches TileCard.tap_action. */
  tap_action?: NavigateAction
}

export interface GlanceCard {
  type: 'glance'
  title?: string
  entities: (string | GlanceEntityEntry)[]
}
```

Existing call sites (`buildPeopleSection`, `buildQuickStatsSection`) keep using plain `string[]` — the union accepts the narrower form unchanged.

### Step 3: Re-export `GlanceEntityEntry` from generator index

Edit `packages/generator/src/index.ts`. Find the existing `lovelace-types` re-export block and append `GlanceEntityEntry`:

```ts
export type {
  // ... existing list
  GlanceEntityEntry,
  // ...
} from './lovelace-types.js'
```

(Place it alphabetically among the existing entries.)

### Step 4: Write the failing assignFloors test

Create `packages/analyzer/src/__tests__/floor.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { AnalyzedRoom, HaAreaRegistryEntry, HaFloorRegistryEntry } from '@lovelacer/shared'
import { assignFloors } from '../floor.js'

function room(id: AnalyzedRoom['id'], haAreaId: string | null): AnalyzedRoom {
  return {
    id,
    haAreaId,
    displayName: id === 'misc' ? 'Other' : id,
    entityCount: 0,
    averageConfidence: 0,
    assignments: [],
  }
}

function area(area_id: string, floor_id: string | null): HaAreaRegistryEntry {
  return { area_id, name: area_id, floor_id, icon: null }
}

function floor(floor_id: string, name: string, level: number | null = null): HaFloorRegistryEntry {
  return { floor_id, name, level, icon: null }
}

describe('assignFloors', () => {
  it('returns an empty map when given zero rooms', () => {
    const result = assignFloors({ rooms: [], areas: [], floors: [] })
    expect(result.size).toBe(0)
  })

  it('maps every room to null when the floors registry is empty', () => {
    const result = assignFloors({
      rooms: [room('kitchen', 'kitchen_area')],
      areas: [area('kitchen_area', 'ground')],
      floors: [],
    })
    expect(result.get('kitchen')).toBeNull()
  })

  it('maps a room with no haAreaId to null', () => {
    const result = assignFloors({
      rooms: [room('kitchen', null)],
      areas: [],
      floors: [floor('ground', 'Ground Floor', 0)],
    })
    expect(result.get('kitchen')).toBeNull()
  })

  it('maps a room whose area has no floor_id to null', () => {
    const result = assignFloors({
      rooms: [room('kitchen', 'kitchen_area')],
      areas: [area('kitchen_area', null)],
      floors: [floor('ground', 'Ground Floor', 0)],
    })
    expect(result.get('kitchen')).toBeNull()
  })

  it('maps a room whose floor_id is not in the registry to null (stale data)', () => {
    const result = assignFloors({
      rooms: [room('kitchen', 'kitchen_area')],
      areas: [area('kitchen_area', 'ghost_floor')],
      floors: [floor('ground', 'Ground Floor', 0)],
    })
    expect(result.get('kitchen')).toBeNull()
  })

  it('maps a room with a full chain to the correct FloorAssignment', () => {
    const result = assignFloors({
      rooms: [room('kitchen', 'kitchen_area')],
      areas: [area('kitchen_area', 'ground')],
      floors: [floor('ground', 'Ground Floor', 0)],
    })
    expect(result.get('kitchen')).toEqual({
      floorId: 'ground',
      name: 'Ground Floor',
      level: 0,
      icon: null,
    })
  })

  it('partitions multiple rooms across multiple floors correctly', () => {
    const result = assignFloors({
      rooms: [
        room('kitchen', 'kitchen_area'),
        room('living_room', 'living_area'),
        room('bedroom', 'bedroom_area'),
        room('office', 'office_area'),
      ],
      areas: [
        area('kitchen_area', 'ground'),
        area('living_area', 'ground'),
        area('bedroom_area', 'upstairs'),
        area('office_area', 'upstairs'),
      ],
      floors: [floor('ground', 'Ground', 0), floor('upstairs', 'Upstairs', 1)],
    })
    expect(result.get('kitchen')?.floorId).toBe('ground')
    expect(result.get('living_room')?.floorId).toBe('ground')
    expect(result.get('bedroom')?.floorId).toBe('upstairs')
    expect(result.get('office')?.floorId).toBe('upstairs')
  })

  it('excludes the misc room entirely (not in the result map)', () => {
    const result = assignFloors({
      rooms: [room('kitchen', 'kitchen_area'), room('misc', null)],
      areas: [area('kitchen_area', 'ground')],
      floors: [floor('ground', 'Ground', 0)],
    })
    expect(result.has('misc')).toBe(false)
    expect(result.has('kitchen')).toBe(true)
  })
})
```

### Step 5: Run test to verify it fails

```bash
pnpm --filter @lovelacer/analyzer test -- floor
```

Expected: FAIL — `floor.js` doesn't exist (module-not-found).

### Step 6: Implement `assignFloors`

Create `packages/analyzer/src/floor.ts`:

```ts
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  FloorAssignment,
  HaAreaRegistryEntry,
  HaFloorRegistryEntry,
} from '@lovelacer/shared'

export interface AssignFloorsInput {
  rooms: AnalyzedRoom[]
  areas: HaAreaRegistryEntry[]
  floors: HaFloorRegistryEntry[]
}

/**
 * Map each canonical room to its floor assignment via:
 *   room.haAreaId → area.floor_id → floor.
 *
 * Returns `null` for rooms without a dominant haAreaId, or whose area
 * lacks a floor_id, or whose floor_id isn't in the floor registry. The
 * misc bucket is excluded from the result map entirely (not navigable;
 * distinct from "in the map with null").
 */
export function assignFloors(
  input: AssignFloorsInput,
): Map<CanonicalRoomId, FloorAssignment | null> {
  const areasById = new Map(input.areas.map((a) => [a.area_id, a]))
  const floorsById = new Map(input.floors.map((f) => [f.floor_id, f]))
  const result = new Map<CanonicalRoomId, FloorAssignment | null>()

  for (const room of input.rooms) {
    if (room.id === 'misc') continue
    if (room.haAreaId === null) {
      result.set(room.id, null)
      continue
    }
    const area = areasById.get(room.haAreaId)
    if (area === undefined || area.floor_id === null) {
      result.set(room.id, null)
      continue
    }
    const floor = floorsById.get(area.floor_id)
    if (floor === undefined) {
      result.set(room.id, null)
      continue
    }
    result.set(room.id, {
      floorId: floor.floor_id,
      name: floor.name,
      level: floor.level,
      icon: floor.icon,
    })
  }

  return result
}
```

### Step 7: Re-export from analyzer index

Edit `packages/analyzer/src/index.ts`. Append to the existing exports:

```ts
export { assignFloors } from './floor.js'
export type { AssignFloorsInput } from './floor.js'
```

### Step 8: Run tests + typecheck + lint + format

```bash
pnpm --filter @lovelacer/analyzer test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass. Analyzer test count grows by 8 (the new floor.test cases). Generator typecheck passes — the GlanceCard widening accepts `string[]` callers and the new `GlanceEntityEntry` is reachable.

### Step 9: Commit

```bash
git add packages/shared/src/types.ts \
  packages/generator/src/lovelace-types.ts \
  packages/generator/src/index.ts \
  packages/analyzer/src/floor.ts \
  packages/analyzer/src/__tests__/floor.test.ts \
  packages/analyzer/src/index.ts
git commit -m "feat(analyzer): assignFloors() + FloorAssignment type + widen GlanceCard"
```

---

## Task 2: Generator — buildRoomsByFloorSection + Wiring

**Files:**

- Modify: `packages/generator/src/home-view.ts`
- Modify: `packages/generator/src/__tests__/home-view.test.ts`
- Modify: `packages/generator/src/index.ts`

**Why this task:** Adds the consumer of the Task 1 types — the new section logic in the home view, plus the wiring through `BuildHomeViewInput`. Pure-function generator work; no server or pipeline integration yet.

### Step 1: Write failing tests for buildRoomsByFloorSection

Edit `packages/generator/src/__tests__/home-view.test.ts`. Append a new `describe`:

```ts
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  FloorAssignment,
  RoomGrouping,
} from '@lovelacer/shared'
import type { GlanceCard, HeadingCard } from '../lovelace-types.js'
import { buildRoomsByFloorSection } from '../home-view.js'

function makeRoom(id: AnalyzedRoom['id'], haAreaId: string | null): AnalyzedRoom {
  return {
    id,
    haAreaId,
    displayName: id === 'misc' ? 'Other' : id,
    entityCount: 1,
    averageConfidence: 0.9,
    assignments: [],
  }
}

function makeFloor(floorId: string, name: string, level: number | null = null): FloorAssignment {
  return { floorId, name, level, icon: null }
}

function makeGroupingWithLight(roomId: CanonicalRoomId, entityId: string): RoomGrouping {
  return {
    roomId,
    groups: [
      {
        key: 'lights',
        entities: [
          {
            entityId,
            domain: 'light',
            objectId: entityId.split('.')[1] ?? entityId,
            friendlyName: entityId,
            deviceClass: null,
            entityCategory: null,
            haAreaId: null,
            device: null,
            isHidden: false,
            isDisabled: false,
          },
        ],
      },
    ],
  }
}

describe('buildRoomsByFloorSection', () => {
  it('returns null when every room has a null floor (all-unfloored)', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', null)],
      groupings: [makeGroupingWithLight('kitchen', 'light.kitchen')],
      floorAssignments: new Map([['kitchen', null]]),
    })
    expect(result).toBeNull()
  })

  it('emits HeadingCard + GlanceCard for a single floor with one room', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area')],
      groupings: [makeGroupingWithLight('kitchen', 'light.kitchen')],
      floorAssignments: new Map([['kitchen', makeFloor('ground', 'Ground Floor', 0)]]),
    })
    expect(result).not.toBeNull()
    expect(result!.cards).toHaveLength(2)
    const heading = result!.cards[0] as HeadingCard
    const glance = result!.cards[1] as GlanceCard
    expect(heading.type).toBe('heading')
    expect(heading.heading).toBe('Ground Floor')
    expect(glance.type).toBe('glance')
    expect(glance.entities).toEqual([
      {
        entity: 'light.kitchen',
        name: 'Kitchen',
        tap_action: { action: 'navigate', navigation_path: 'kitchen' },
      },
    ])
  })

  it('emits two floor groups in level-ascending order', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area'), makeRoom('bedroom', 'bedroom_area')],
      groupings: [
        makeGroupingWithLight('kitchen', 'light.kitchen'),
        makeGroupingWithLight('bedroom', 'light.bedroom'),
      ],
      floorAssignments: new Map<CanonicalRoomId, FloorAssignment | null>([
        ['kitchen', makeFloor('ground', 'Ground', 0)],
        ['bedroom', makeFloor('upstairs', 'Upstairs', 1)],
      ]),
    })
    expect(result).not.toBeNull()
    expect(result!.cards).toHaveLength(4)
    const headings = result!.cards.filter((c) => c.type === 'heading') as HeadingCard[]
    expect(headings.map((h) => h.heading)).toEqual(['Ground', 'Upstairs'])
  })

  it('appends an "Other" heading + glance when some rooms are unfloored', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area'), makeRoom('garage', 'garage_area')],
      groupings: [
        makeGroupingWithLight('kitchen', 'light.kitchen'),
        makeGroupingWithLight('garage', 'light.garage'),
      ],
      floorAssignments: new Map<CanonicalRoomId, FloorAssignment | null>([
        ['kitchen', makeFloor('ground', 'Ground', 0)],
        ['garage', null],
      ]),
    })
    expect(result).not.toBeNull()
    expect(result!.cards).toHaveLength(4)
    const headings = result!.cards.filter((c) => c.type === 'heading') as HeadingCard[]
    expect(headings.map((h) => h.heading)).toEqual(['Ground', 'Other'])
  })

  it('returns null when the only assigned floor is null but the registry has entries', () => {
    // assignFloors emits null for all rooms when no area has a floor_id.
    // The section adds no value in that case.
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area')],
      groupings: [makeGroupingWithLight('kitchen', 'light.kitchen')],
      floorAssignments: new Map([['kitchen', null]]),
    })
    expect(result).toBeNull()
  })

  it('drops a room with no light or activity sensor from its glance', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area'), makeRoom('garden', 'garden_area')],
      groupings: [
        makeGroupingWithLight('kitchen', 'light.kitchen'),
        // garden has no lights or activity entities
        { roomId: 'garden', groups: [] },
      ],
      floorAssignments: new Map<CanonicalRoomId, FloorAssignment | null>([
        ['kitchen', makeFloor('ground', 'Ground', 0)],
        ['garden', makeFloor('ground', 'Ground', 0)],
      ]),
    })
    expect(result).not.toBeNull()
    const glance = result!.cards[1] as GlanceCard
    expect(glance.entities).toHaveLength(1)
    const entry = glance.entities[0] as { entity: string }
    expect(entry.entity).toBe('light.kitchen')
  })

  it('orders level-null floors after level-set floors, alphabetical within nulls', () => {
    const result = buildRoomsByFloorSection({
      rooms: [
        makeRoom('kitchen', 'kitchen_area'),
        makeRoom('bedroom', 'bedroom_area'),
        makeRoom('attic', 'attic_area'),
      ],
      groupings: [
        makeGroupingWithLight('kitchen', 'light.kitchen'),
        makeGroupingWithLight('bedroom', 'light.bedroom'),
        makeGroupingWithLight('attic', 'light.attic'),
      ],
      floorAssignments: new Map<CanonicalRoomId, FloorAssignment | null>([
        ['kitchen', makeFloor('ground', 'Ground', 0)],
        ['bedroom', makeFloor('zeta', 'Zeta', null)],
        ['attic', makeFloor('alpha', 'Alpha', null)],
      ]),
    })
    expect(result).not.toBeNull()
    const headings = result!.cards.filter((c) => c.type === 'heading') as HeadingCard[]
    expect(headings.map((h) => h.heading)).toEqual(['Ground', 'Alpha', 'Zeta'])
  })

  it('filters the misc room defensively even if present in the room list', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area'), makeRoom('misc', null)],
      groupings: [makeGroupingWithLight('kitchen', 'light.kitchen')],
      floorAssignments: new Map<CanonicalRoomId, FloorAssignment | null>([
        ['kitchen', makeFloor('ground', 'Ground', 0)],
      ]),
    })
    expect(result).not.toBeNull()
    const glance = result!.cards[1] as GlanceCard
    expect(glance.entities).toHaveLength(1)
    const entry = glance.entities[0] as { entity: string }
    expect(entry.entity).toBe('light.kitchen')
  })
})
```

### Step 2: Run tests to verify they fail

```bash
pnpm --filter @lovelacer/generator test -- home-view
```

Expected: FAIL — `buildRoomsByFloorSection` doesn't exist.

### Step 3: Extract the `pickPrimaryEntity` helper

Edit `packages/generator/src/home-view.ts`. Find `buildActiveRoomsSection` (around line 195). The current implementation has:

```ts
const lights = grouping.groups.find((g) => g.key === 'lights')?.entities ?? []
const activity = grouping.groups.find((g) => g.key === 'activity')?.entities ?? []
const candidates = [...lights, ...activity].filter((e) => !e.isHidden && !e.isDisabled)
if (candidates.length === 0) continue
const primary = candidates[0]!
```

Extract this into a private helper above `buildActiveRoomsSection`:

```ts
/**
 * Pick a room's "primary" navigable entity: first visible light if any,
 * else first visible activity sensor. Returns null if the room has no
 * lights and no activity sensors (or only hidden/disabled ones).
 *
 * Used by buildActiveRoomsSection (existing) and buildRoomsByFloorSection
 * (P2-3) — both surface a tile or glance per room and need a single
 * representative entity per room.
 */
function pickPrimaryEntity(grouping: RoomGrouping): NormalizedEntity | null {
  const lights = grouping.groups.find((g) => g.key === 'lights')?.entities ?? []
  const activity = grouping.groups.find((g) => g.key === 'activity')?.entities ?? []
  const candidates = [...lights, ...activity].filter((e) => !e.isHidden && !e.isDisabled)
  return candidates.length === 0 ? null : candidates[0]!
}
```

Then refactor `buildActiveRoomsSection` to use it. The current loop body becomes:

```ts
for (const grouping of groupings) {
  if (grouping.roomId === 'misc') continue
  const primary = pickPrimaryEntity(grouping)
  if (primary === null) continue
  // The remaining inline logic still needs the full candidates list to
  // build the OR condition. Keep that inline for now.
  const lights = grouping.groups.find((g) => g.key === 'lights')?.entities ?? []
  const activity = grouping.groups.find((g) => g.key === 'activity')?.entities ?? []
  const candidates = [...lights, ...activity].filter((e) => !e.isHidden && !e.isDisabled)
  // … rest of the existing implementation, unchanged
}
```

### Step 4: Implement `buildRoomsByFloorSection`

Still in `packages/generator/src/home-view.ts`. Add the new function after `buildCamerasSection` (or wherever fits the section-builder ordering). Add the new imports at the top of the file:

```ts
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  FloorAssignment,
  NormalizedEntity,
} from '@lovelacer/shared'
```

(Append `AnalyzedRoom`, `CanonicalRoomId`, `FloorAssignment`, `NormalizedEntity` to the existing `@lovelacer/shared` import list — `NormalizedEntity` is already imported, just add the others.)

Add the section-builder function:

```ts
export interface BuildRoomsByFloorSectionInput {
  rooms: AnalyzedRoom[]
  groupings: RoomGrouping[]
  floorAssignments: Map<CanonicalRoomId, FloorAssignment | null>
}

/**
 * Build the "Rooms by floor" section: per floor, a HeadingCard followed
 * by a GlanceCard whose entries each carry a tap_action: navigate to the
 * room view. Floors are ordered by `level` ascending (nulls last,
 * alphabetical within the null group). Rooms without a floor are
 * grouped under an "Other" heading at the bottom.
 *
 * Returns null when no rooms are floored (the section adds no value),
 * or when every room's primary entity is missing.
 *
 * Skips the misc room defensively (assignFloors already excludes it
 * from the map; this is a second layer).
 */
export function buildRoomsByFloorSection(input: BuildRoomsByFloorSectionInput): GridSection | null {
  // Index groupings by roomId for O(1) primary-entity lookup.
  const groupingByRoom = new Map<CanonicalRoomId, RoomGrouping>()
  for (const g of input.groupings) groupingByRoom.set(g.roomId, g)

  // Bucket rooms by their floor (or null for unfloored).
  const buckets = new Map<string | null, { floor: FloorAssignment | null; rooms: AnalyzedRoom[] }>()
  for (const room of input.rooms) {
    if (room.id === 'misc') continue
    const floor = input.floorAssignments.get(room.id) ?? null
    const key = floor === null ? null : floor.floorId
    const existing = buckets.get(key)
    if (existing === undefined) {
      buckets.set(key, { floor, rooms: [room] })
    } else {
      existing.rooms.push(room)
    }
  }

  // Early exit: only a null bucket means no rooms are floored.
  const hasFlooredBucket = Array.from(buckets.keys()).some((k) => k !== null)
  if (!hasFlooredBucket) return null

  // Order non-null buckets by (level ?? Infinity, name); null bucket last.
  const flooredEntries = Array.from(buckets.entries())
    .filter(([key]) => key !== null)
    .sort(([, a], [, b]) => {
      const la = a.floor?.level ?? Infinity
      const lb = b.floor?.level ?? Infinity
      if (la !== lb) return la - lb
      return (a.floor?.name ?? '').localeCompare(b.floor?.name ?? '', 'en')
    })
  const nullEntry = buckets.get(null)

  const cards: LovelaceCard[] = []
  for (const [, { floor, rooms }] of flooredEntries) {
    const glance = buildFloorGlance(rooms, groupingByRoom)
    if (glance === null) continue
    cards.push({ type: 'heading', heading: floor!.name })
    cards.push(glance)
  }
  if (nullEntry !== undefined) {
    const glance = buildFloorGlance(nullEntry.rooms, groupingByRoom)
    if (glance !== null) {
      cards.push({ type: 'heading', heading: 'Other' })
      cards.push(glance)
    }
  }

  if (cards.length === 0) return null
  return { type: 'grid', cards }
}

/**
 * Build a single floor's GlanceCard from its rooms. Skips rooms whose
 * primary entity is missing. Returns null if every room is skipped.
 */
function buildFloorGlance(
  rooms: AnalyzedRoom[],
  groupingByRoom: Map<CanonicalRoomId, RoomGrouping>,
): GlanceCard | null {
  const entries: GlanceEntityEntry[] = []
  for (const room of rooms) {
    const grouping = groupingByRoom.get(room.id)
    if (grouping === undefined) continue
    const primary = pickPrimaryEntity(grouping)
    if (primary === null) continue
    const display = roomIdToDisplay(room.id)
    entries.push({
      entity: primary.entityId,
      name: display.title,
      tap_action: { action: 'navigate', navigation_path: display.path },
    })
  }
  if (entries.length === 0) return null
  return { type: 'glance', entities: entries }
}
```

Add the necessary imports/local types:

- `LovelaceCard` from `./lovelace-types.js` (already imported via the existing block — verify and add if missing).
- `HeadingCard` and `GlanceEntityEntry` from `./lovelace-types.js` (add to the existing `import type` block).

The lovelace-types `import type` block at the top of `home-view.ts` already lists `ConditionalCard`, `ConditionEntry`, `GlanceCard`, `GridSection`, `MarkdownCard`, `PictureEntityCard`, `RoomView`, `StateCondition`, `TileCard`. Append `HeadingCard`, `GlanceEntityEntry`, `LovelaceCard` (all are already exported from `lovelace-types.ts`).

### Step 5: Extend `BuildHomeViewInput` and wire the new section

Still in `home-view.ts`. Update the existing interface:

```ts
export interface BuildHomeViewInput {
  entities: NormalizedEntity[]
  groupings: RoomGrouping[]
  rooms: AnalyzedRoom[] // NEW
  floorAssignments: Map<CanonicalRoomId, FloorAssignment | null> // NEW
}
```

Update `buildHomeView` to call the new section between People and ActiveRooms:

```ts
export function buildHomeView(input: BuildHomeViewInput): HomeView {
  const sections: GridSection[] = [buildWelcomeSection(input.entities)]

  const quickStats = buildQuickStatsSection(input.entities)
  if (quickStats !== null) sections.push(quickStats)

  const people = buildPeopleSection(input.entities)
  if (people !== null) sections.push(people)

  const roomsByFloor = buildRoomsByFloorSection({
    rooms: input.rooms,
    groupings: input.groupings,
    floorAssignments: input.floorAssignments,
  })
  if (roomsByFloor !== null) sections.push(roomsByFloor)

  const activeRooms = buildActiveRoomsSection(input.groupings)
  if (activeRooms !== null) sections.push(activeRooms)

  const scenes = buildScenesSection(input.entities)
  if (scenes !== null) sections.push(scenes)

  const cameras = buildCamerasSection(input.entities)
  if (cameras !== null) sections.push(cameras)

  return {
    type: 'sections',
    title: 'Home',
    path: 'home',
    icon: 'mdi:home-variant',
    sections,
  }
}
```

### Step 6: Re-export from generator index

Edit `packages/generator/src/index.ts`. Add:

```ts
export { buildRoomsByFloorSection } from './home-view.js'
export type { BuildRoomsByFloorSectionInput } from './home-view.js'
```

(Place near the existing `buildHomeView` export.)

### Step 7: Update existing buildHomeView call sites

Search for `buildHomeView(` callers:

```bash
grep -rn "buildHomeView(" packages/ tests/ 2>&1 | grep -v node_modules | grep -v dist
```

Expected callers:

- `packages/server/src/pipeline.ts` — `runPreview` calls `buildHomeView`. Will be fixed in Task 3.
- `packages/generator/src/__tests__/home-view.test.ts` — existing tests for `buildHomeView` directly.

For the existing test file's calls to `buildHomeView`, every call site needs the two new fields. Add minimal defaults (`rooms: []`, `floorAssignments: new Map()`) to each existing call to preserve test semantics — these tests don't exercise the new section. Find and update each one.

### Step 8: Run tests + typecheck + lint + format

```bash
pnpm --filter @lovelacer/generator test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass. Generator test count grows by 8 (the new `buildRoomsByFloorSection` cases). Typecheck flags `pipeline.ts` because `buildHomeView` now requires two more fields — that's expected and gets fixed in Task 3.

If typecheck fails on `pipeline.ts` only, that's the expected state — proceed to commit. The pipeline fix is the next task.

If typecheck fails anywhere ELSE, stop and fix.

Actually — typecheck failing is bad even for the expected `pipeline.ts` case. Address it now: edit `packages/server/src/pipeline.ts` and add temporary defaults to the `buildHomeView` call:

```ts
// Find the existing call:
const home = buildHomeView({ entities: state.entities, groupings: dashboardGroupings })

// Replace with (Task 3 will replace these defaults with real values):
const home = buildHomeView({
  entities: state.entities,
  groupings: dashboardGroupings,
  rooms: state.rooms,
  floorAssignments: new Map(), // Task 3 fills this in via assignFloors
})
```

This unblocks typecheck for Task 2 commit. Task 3 replaces `new Map()` with the real `assignFloors` output.

### Step 9: Re-run typecheck after the temporary pipeline fix

```bash
pnpm typecheck
```

Expected: clean.

### Step 10: Commit

```bash
git add packages/generator/src/home-view.ts \
  packages/generator/src/__tests__/home-view.test.ts \
  packages/generator/src/index.ts \
  packages/server/src/pipeline.ts
git commit -m "feat(generator): buildRoomsByFloorSection + extract pickPrimaryEntity"
```

---

## Task 3: Server Pipeline + Route Tests

**Files:**

- Modify: `packages/server/src/pipeline.ts`
- Modify: `packages/server/src/__tests__/pipeline.test.ts`
- Modify: `packages/server/src/__tests__/routes/preview.test.ts`

**Why this task:** Wire the floors registry through the pipeline. The defensive try/catch ensures older HA versions (where `config/floor_registry/list` may not exist) don't break analyze entirely.

### Step 1: Fetch floors with defensive try/catch

Edit `packages/server/src/pipeline.ts`. Find `runFullPipeline`. The current registry fetch:

```ts
const [entityRegistry, deviceRegistry, areaRegistry] = await Promise.all([
  ha.getEntityRegistry(),
  ha.getDeviceRegistry(),
  ha.getAreaRegistry(),
])
```

Replace with:

```ts
// Floor registry is opportunistic — older HA versions may not expose
// `config/floor_registry/list`. If it errors, we treat as empty and
// proceed; the rest of analyze must not depend on floor data.
const [entityRegistry, deviceRegistry, areaRegistry, floorRegistry] = await Promise.all([
  ha.getEntityRegistry(),
  ha.getDeviceRegistry(),
  ha.getAreaRegistry(),
  ha.getFloorRegistry().catch((err: unknown) => {
    // Don't have access to a logger here; return empty list quietly.
    // Route-layer logging picks up the absent section if needed.
    void err
    return [] as Awaited<ReturnType<typeof ha.getFloorRegistry>>
  }),
])
```

Find the `import` from `@lovelacer/analyzer`:

```ts
import {
  computeDiff,
  detect,
  groupByDomain,
  normalize,
  type RoomGrouping,
} from '@lovelacer/analyzer'
```

Add `assignFloors`:

```ts
import {
  assignFloors,
  computeDiff,
  detect,
  groupByDomain,
  normalize,
  type RoomGrouping,
} from '@lovelacer/analyzer'
```

Find the `import type` from `@lovelacer/shared`:

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

Add `FloorAssignment`, `HaFloorRegistryEntry`:

```ts
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  DiffResult,
  FloorAssignment,
  HaAreaRegistryEntry,
  HaFloorRegistryEntry,
  NormalizedEntity,
  Override,
  RoomAssignment,
  SnapshotAssignment,
} from '@lovelacer/shared'
```

### Step 2: Compute floor assignments and pass to buildHomeView

Still in `runFullPipeline`. After the existing `rooms` and `state.rooms` build, compute the floor assignments. Find this block (after groupings are built and rooms are populated):

```ts
return {
  entities,
  groupings,
  rooms,
  misc,
  summary: {
    entityCount: visibleEntityCount,
    roomCount: rooms.length,
    miscCount: misc.length,
  },
}
```

Update the function's return shape to include `floors` and `floorAssignments`. First, update the `PipelineState` interface:

```ts
interface PipelineState {
  entities: NormalizedEntity[]
  groupings: RoomGrouping[]
  rooms: AnalyzedRoom[]
  misc: AnalyzeOutput['misc']
  summary: AnalyzeOutput['summary']
  floors: HaFloorRegistryEntry[]
  floorAssignments: Map<CanonicalRoomId, FloorAssignment | null>
}
```

Then build the assignments inside `runFullPipeline` and add to the return:

```ts
const floorAssignments = assignFloors({
  rooms,
  areas: areaRegistry,
  floors: floorRegistry,
})

return {
  entities,
  groupings,
  rooms,
  misc,
  summary: {
    entityCount: visibleEntityCount,
    roomCount: rooms.length,
    miscCount: misc.length,
  },
  floors: floorRegistry,
  floorAssignments,
}
```

### Step 3: Pass floors to buildHomeView

Still in `pipeline.ts`. Find the `buildHomeView` call inside `runPreview` (the one with the `new Map()` placeholder from Task 2 Step 8):

```ts
const home = buildHomeView({
  entities: state.entities,
  groupings: dashboardGroupings,
  rooms: state.rooms,
  floorAssignments: new Map(),
})
```

Replace with:

```ts
const home = buildHomeView({
  entities: state.entities,
  groupings: dashboardGroupings,
  rooms: state.rooms,
  floorAssignments: state.floorAssignments,
})
```

### Step 4: Add pipeline test for floor wiring

Edit `packages/server/src/__tests__/pipeline.test.ts`. Find an existing test that mocks the HA registries. Add two new tests after the existing block:

```ts
it('calls getFloorRegistry and threads floors through PipelineState (via runPreview)', async () => {
  const ha = makeHa(true)
  const overrides = makeStore()
  const appliedSnapshot = makeAppliedSnapshot()
  const result = await runPreview(ha, overrides, appliedSnapshot)
  // The fake HA's `getFloorRegistry` is called by runFullPipeline. We
  // can't directly assert on the spy here without exposing it, but
  // we CAN verify the home view's section count varies based on the
  // fixture's floor data. The englishCluttered fixture has two floors
  // with multiple rooms; the home view should have the new section.
  const home = result.config.views[0]
  expect(home).not.toBeUndefined()
  expect(home!.path).toBe('home')
  // Expect at least one heading card whose text is a floor name from
  // the fixture (Ground / Upstairs from englishCluttered).
  const allCards = (home!.sections ?? []).flatMap((s) => s.cards ?? [])
  const headingTexts = allCards
    .filter((c): c is { type: 'heading'; heading: string } => c.type === 'heading')
    .map((c) => c.heading)
  expect(headingTexts.length).toBeGreaterThan(0)
})

it('runPreview does not throw when getFloorRegistry rejects (defensive catch)', async () => {
  const fixture = fixtureToHaRegistries(englishCluttered)
  const ha = {
    isConnected: () => true,
    getEntityRegistry: vi.fn(async () => fixture.entities),
    getDeviceRegistry: vi.fn(async () => fixture.devices),
    getAreaRegistry: vi.fn(async () => fixture.areas),
    getFloorRegistry: vi.fn(async () => {
      throw new Error('not supported on this HA version')
    }),
  } as unknown as HaClient
  const overrides = makeStore()
  const appliedSnapshot = makeAppliedSnapshot()
  // Should not throw — the catch in runFullPipeline downgrades the
  // rejection to an empty floor list.
  await expect(runPreview(ha, overrides, appliedSnapshot)).resolves.toBeDefined()
})
```

(Adjust imports at the top of `pipeline.test.ts` to ensure `englishCluttered`, `fixtureToHaRegistries`, `vi`, `HaClient`, `runPreview` are available. The existing route-test files in this same directory already import them — copy the import paths.)

### Step 5: Update preview route tests

Edit `packages/server/src/__tests__/routes/preview.test.ts`. The existing `makeHa()` helper stubs `getFloorRegistry: vi.fn(async () => [])`. Update it to surface the fixture's actual floor list:

Find:

```ts
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
```

Replace with:

```ts
function makeHa(connected = true): HaClient {
  const ha = fixtureToHaRegistries(englishCluttered)
  return {
    isConnected: () => connected,
    getEntityRegistry: vi.fn(async () => ha.entities),
    getDeviceRegistry: vi.fn(async () => ha.devices),
    getAreaRegistry: vi.fn(async () => ha.areas),
    getFloorRegistry: vi.fn(async () => ha.floors),
  } as unknown as HaClient
}
```

This change makes existing tests see floor data automatically. Verify by running the existing tests:

```bash
pnpm --filter @lovelacer/server test -- preview
```

Expected: existing tests still pass — they don't assert on the home view's section structure beyond `views.length > 0` etc.

Append two new tests to the existing `describe('POST /api/preview')`:

```ts
it('home view contains a "Rooms by floor" section when fixture has floor data', async () => {
  const app = await createApp({
    ha: makeHa(true),
    overrides: makeStore(),
    invite: makeAcceptedInvite(),
    appliedSnapshot: makeAppliedSnapshot(),
    logLevel: 'silent',
    dashboardUrlPath: 'lovelacer-home',
  })
  try {
    const res = await app.inject({ method: 'POST', url: '/api/preview' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      config: {
        views: { path: string; sections: { cards: { type: string; heading?: string }[] }[] }[]
      }
    }
    const home = body.config.views.find((v) => v.path === 'home')
    expect(home).toBeDefined()
    const headings = home!.sections
      .flatMap((s) => s.cards)
      .filter((c) => c.type === 'heading')
      .map((c) => c.heading)
    // englishCluttered has two floors: Ground and Upstairs.
    expect(headings).toContain('Ground')
    expect(headings).toContain('Upstairs')
  } finally {
    await app.close()
  }
})

it('home view omits the "Rooms by floor" section when getFloorRegistry rejects (defensive)', async () => {
  const ha = fixtureToHaRegistries(englishCluttered)
  const fakeHa = {
    isConnected: () => true,
    getEntityRegistry: vi.fn(async () => ha.entities),
    getDeviceRegistry: vi.fn(async () => ha.devices),
    getAreaRegistry: vi.fn(async () => ha.areas),
    getFloorRegistry: vi.fn(async () => {
      throw new Error('not supported')
    }),
  } as unknown as HaClient
  const app = await createApp({
    ha: fakeHa,
    overrides: makeStore(),
    invite: makeAcceptedInvite(),
    appliedSnapshot: makeAppliedSnapshot(),
    logLevel: 'silent',
    dashboardUrlPath: 'lovelacer-home',
  })
  try {
    const res = await app.inject({ method: 'POST', url: '/api/preview' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      config: {
        views: { path: string; sections: { cards: { type: string; heading?: string }[] }[] }[]
      }
    }
    const home = body.config.views.find((v) => v.path === 'home')
    expect(home).toBeDefined()
    // No floor data → no headings on the home view.
    const headings = home!.sections.flatMap((s) => s.cards).filter((c) => c.type === 'heading')
    expect(headings).toHaveLength(0)
  } finally {
    await app.close()
  }
})
```

### Step 6: Run full suite + typecheck + lint + format

```bash
pnpm --filter @lovelacer/server test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass. Server test count grows by ~4 (2 in pipeline.test, 2 in preview.test). The route tests for analyze/apply/export/invite/invite-gate/overrides remain green — their `makeHa()` helpers still stub `getFloorRegistry` to empty (or aren't affected at all), so the new pipeline code runs through `assignFloors([])` → all-null map → section absent.

### Step 7: Run the full workspace test suite

```bash
pnpm test
```

Expected: all green.

### Step 8: Commit

```bash
git add packages/server/src/pipeline.ts \
  packages/server/src/__tests__/pipeline.test.ts \
  packages/server/src/__tests__/routes/preview.test.ts
git commit -m "feat(server): wire floor registry into pipeline + home-view"
```

---

## Final Verification

- [ ] **Step F1: Run the full workspace test suite**

```bash
pnpm test
```

Expected: all packages green. Total test count grows by ~20 (8 floor.test + 8 home-view.test additions + 2 pipeline.test + 2 preview.test).

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

In the dev HA's setup, ensure at least two floors are defined and at least two areas have `floor_id` set. The `englishCluttered` fixture loader (if used as the dev HA's seed) already includes `floors: [ground, upstairs]`.

In the browser:

1. Open the SPA. Accept invite if not already.
2. Click Analyze. Click Apply.
3. Open the dashboard in HA. Navigate to the "Home" view.
4. Verify a section titled "Rooms by floor" appears between People and Active Rooms (or near the top if some sections are skipped due to missing entities).
5. The section shows alternating headings ("Ground", "Upstairs") and glance rows. Each room icon in the glance row is tappable and navigates to the room view.
6. If you have any areas without `floor_id`, an "Other" heading appears at the bottom of the section.
7. As a negative test: temporarily remove all `floor_id` from areas in HA's UI (or use a fixture without floors). Re-analyze + re-apply. Verify the "Rooms by floor" section disappears entirely.

That satisfies the AC: "Two-floor fixture renders with floor section dividers; absent floor data falls back to flat list."

- [ ] **Step F4: Push branch + open PR**

```bash
git push -u origin feat/p2-3-floor-grouping
gh pr create --title "feat: P2-3 floor-aware grouping" --body "$(cat <<'EOF'
## Summary

- New "Rooms by floor" section in the Home view when HA has floor data. Renders one HeadingCard per floor followed by a (widened) GlanceCard whose entries each carry a `tap_action: navigate` to the room view. ActiveRooms stays exactly as today — pure additive change.
- New pure `assignFloors()` in `@lovelacer/analyzer` maps each canonical room to its floor via `room.haAreaId → area.floor_id → floor`. Misc room excluded.
- `GlanceCard.entities` widens from `string[]` to `(string | GlanceEntityEntry)[]` to support per-entry `name` + `tap_action`. Existing call sites (People, QuickStats) keep using plain strings.
- Pipeline gains a defensive `getFloorRegistry()` fetch — if HA doesn't support `config/floor_registry/list` (older versions), the rejection is downgraded to an empty list and the rest of analyze proceeds unchanged.
- Floors ordered by `level` ascending (nulls last, alphabetical within nulls). Unfloored rooms grouped under "Other" at the bottom in mixed-data installs. Section omitted entirely when no rooms are floored.

Closes the AC from ROADMAP P2-3: "Two-floor fixture renders with floor section dividers; absent floor data falls back to flat list."

## Test plan

- [x] `pnpm test` — full workspace suite green
- [x] `pnpm typecheck && pnpm lint && pnpm format:check` — all clean
- [ ] Manual smoke per the plan's Step F3 (analyze + apply + verify floor headings in HA)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope (per spec)

- Floor icons (captured in `FloorAssignment` but not rendered).
- Per-room view modifications (no floor crumbs, no parent-floor link).
- Floor-aware navigation reorganization of the HA top tab bar (not possible via storage-mode config).
- Localization of `"Other"` (deferred to P2-9).
- ActiveRooms section integration (stays as today).
