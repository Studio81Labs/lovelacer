# P1a-5 Domain Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `groupByDomain(input)` and the per-entity helper `domainGroup(entity)` in `@lovelacer/analyzer`, taking the detection chain's `RoomAssignment[]` + the corresponding `NormalizedEntity[]` and producing a per-room `RoomGrouping[]` with entities bucketed into the 5 P1a-supported categories (`lights`, `environment`, `activity`, `climate`, `other`).

**Architecture:** Pure function in a single new file (`packages/analyzer/src/grouping.ts`). Per-entity routing factored into `domainGroup(entity)` so consumers and tests can ask "what bucket would this entity land in?" without rebuilding the full output. Hidden + disabled entities filtered out; diagnostic preserved. Within-group entities sorted alphabetically by `friendlyName`; groups within a room ordered by an internal `GROUP_ORDER` array; rooms ordered lexicographically by `roomId` for snapshot stability.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), Vitest. No new runtime dependencies.

**Spec reference:** [`docs/superpowers/specs/2026-04-30-p1a-5-domain-grouping-design.md`](../specs/2026-04-30-p1a-5-domain-grouping-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions.
- Type-only imports use `import type { … } from '…'`.
- Tests use `import { describe, it, expect } from 'vitest'`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- Run `pnpm` from the worktree (`pnpm --dir <worktree>`); `git -C <worktree>`.

---

## Task 1: Types + `domainGroup` (per-entity routing) + unit tests

**Files:**

- Create: `packages/analyzer/src/grouping.ts`
- Create: `packages/analyzer/src/__tests__/grouping.test.ts`

This task lays down the types, the internal `GROUP_ORDER` constant, and the pure routing function `domainGroup`. Bulk grouping is Task 2.

- [ ] **Step 1: Write the failing tests**

Create `packages/analyzer/src/__tests__/grouping.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { NormalizedEntity } from '@lovelacer/shared'
import { domainGroup } from '../grouping.js'

const baseEntity: NormalizedEntity = {
  entityId: 'sensor.test',
  domain: 'sensor',
  objectId: 'test',
  friendlyName: 'Test',
  deviceClass: null,
  entityCategory: null,
  haAreaId: null,
  device: null,
  isHidden: false,
  isDisabled: false,
}

describe('domainGroup — routing', () => {
  it('routes light → lights', () => {
    expect(domainGroup({ ...baseEntity, domain: 'light' })).toBe('lights')
  })

  it('routes switch → lights', () => {
    expect(domainGroup({ ...baseEntity, domain: 'switch' })).toBe('lights')
  })

  it('routes climate → climate', () => {
    expect(domainGroup({ ...baseEntity, domain: 'climate' })).toBe('climate')
  })

  it('routes sensor with deviceClass=temperature → environment', () => {
    expect(domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: 'temperature' })).toBe(
      'environment',
    )
  })

  it('routes sensor with deviceClass=humidity → environment', () => {
    expect(domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: 'humidity' })).toBe(
      'environment',
    )
  })

  it('routes sensor with deviceClass=illuminance → other (not in P1a env filter)', () => {
    expect(domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: 'illuminance' })).toBe(
      'other',
    )
  })

  it('routes sensor with no deviceClass → other', () => {
    expect(domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: null })).toBe('other')
  })

  it('routes binary_sensor with deviceClass=motion → activity', () => {
    expect(domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'motion' })).toBe(
      'activity',
    )
  })

  it('routes binary_sensor with deviceClass=occupancy → activity', () => {
    expect(domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'occupancy' })).toBe(
      'activity',
    )
  })

  it('routes binary_sensor with deviceClass=door → activity', () => {
    expect(domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'door' })).toBe(
      'activity',
    )
  })

  it('routes binary_sensor with deviceClass=window → other (not in P1a activity filter)', () => {
    expect(domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'window' })).toBe(
      'other',
    )
  })

  it('routes binary_sensor with no deviceClass → other', () => {
    expect(domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: null })).toBe('other')
  })

  it('routes P1b-only domains → other (cover, media_player, lock, camera, vacuum, fan)', () => {
    for (const d of ['cover', 'media_player', 'lock', 'camera', 'vacuum', 'fan']) {
      expect(domainGroup({ ...baseEntity, domain: d })).toBe('other')
    }
  })

  it('routes unknown domain → other (e.g., lawn_mower)', () => {
    expect(domainGroup({ ...baseEntity, domain: 'lawn_mower' })).toBe('other')
  })

  it('routes diagnostic light → lights (entityCategory does not affect routing)', () => {
    expect(domainGroup({ ...baseEntity, domain: 'light', entityCategory: 'diagnostic' })).toBe(
      'lights',
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.test.ts
```

Expected: FAIL — module not found for `../grouping.js`.

- [ ] **Step 3: Implement types + `domainGroup`**

Create `packages/analyzer/src/grouping.ts`:

```ts
import type { CanonicalRoomId, NormalizedEntity, RoomAssignment } from '@lovelacer/shared'

/**
 * Display categories for the generator. P1a populates 5 of these
 * (lights, environment, activity, climate, other). The other 6 keys
 * are pre-declared for P1b-2 — `domainGroup` doesn't return them yet.
 */
export type DomainGroupKey =
  | 'lights' // P1a — light + switch
  | 'environment' // P1a — sensor (temperature, humidity)
  | 'activity' // P1a — binary_sensor (motion, occupancy, door)
  | 'climate' // P1a — climate
  | 'covers' // P1b
  | 'media' // P1b
  | 'security' // P1b — lock
  | 'cameras' // P1b
  | 'vacuum' // P1b
  | 'fans' // P1b
  | 'other' // fallback

export interface DomainGroup {
  key: DomainGroupKey
  /** Sorted alphabetically by friendlyName (case-insensitive). */
  entities: NormalizedEntity[]
}

export interface RoomGrouping {
  roomId: CanonicalRoomId
  /** Groups in GROUP_ORDER, with empty groups dropped. */
  groups: DomainGroup[]
}

export interface GroupByDomainInput {
  assignments: RoomAssignment[]
  entities: NormalizedEntity[]
}

const SENSOR_ENVIRONMENT_CLASSES = new Set(['temperature', 'humidity'])
const BINARY_SENSOR_ACTIVITY_CLASSES = new Set(['motion', 'occupancy', 'door'])

/**
 * Pure routing: given an entity, which display group does it belong to?
 *
 * Routes light/switch → lights, climate → climate, filtered sensor →
 * environment, filtered binary_sensor → activity, everything else →
 * other. `entityCategory` does not affect routing — diagnostic entities
 * still go to their natural group.
 */
export function domainGroup(entity: NormalizedEntity): DomainGroupKey {
  if (entity.domain === 'light' || entity.domain === 'switch') return 'lights'
  if (entity.domain === 'climate') return 'climate'
  if (entity.domain === 'sensor' && entity.deviceClass !== null) {
    if (SENSOR_ENVIRONMENT_CLASSES.has(entity.deviceClass)) return 'environment'
  }
  if (entity.domain === 'binary_sensor' && entity.deviceClass !== null) {
    if (BINARY_SENSOR_ACTIVITY_CLASSES.has(entity.deviceClass)) return 'activity'
  }
  return 'other'
}

/**
 * Display order for groups within a room. `lights` first because
 * they're the most-interacted control. `other` always last. P1b keys
 * have positions reserved so adding their data doesn't shift existing
 * orders in snapshots.
 */
const GROUP_ORDER: readonly DomainGroupKey[] = [
  'lights',
  'climate',
  'covers',
  'media',
  'cameras',
  'activity',
  'environment',
  'security',
  'vacuum',
  'fans',
  'other',
]

// groupByDomain lands in Task 2.
// The unused imports below are referenced via type re-exports so
// `noUnusedLocals` doesn't flag them.
export type _Internal_RoomAssignment = RoomAssignment
export type _Internal_GroupByDomainInput = GroupByDomainInput
export type _Internal_RoomGrouping = RoomGrouping
export type _Internal_DomainGroup = DomainGroup
```

> **Note on the placeholder `_Internal_*` re-exports:** TypeScript's `noUnusedLocals` flags imports + types not yet used in-module. `RoomAssignment` is imported but doesn't appear in `domainGroup` (it'll be used in Task 2's `groupByDomain`). `GroupByDomainInput`, `RoomGrouping`, `DomainGroup` are declared but not yet referenced. The placeholder re-exports keep typecheck green; Task 2 removes them when the consumers exist.

> Also note: `GROUP_ORDER` is used in Task 2; declaring it here keeps the constant near its sibling types. `noUnusedLocals` doesn't flag top-level `const` declarations the way it flags imports.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.test.ts
```

Expected: PASS (15 tests).

- [ ] **Step 5: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add packages/analyzer/src/grouping.ts \
        packages/analyzer/src/__tests__/grouping.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(analyzer): types + domainGroup (per-entity routing)

Pure routing function that maps NormalizedEntity to one of 5 P1a-
supported group keys (lights, environment, activity, climate) or to
the 'other' fallback. Routes light/switch → lights, climate → climate,
sensor (temperature|humidity) → environment, binary_sensor
(motion|occupancy|door) → activity. Everything else falls through to
other. entityCategory does not affect routing.

groupByDomain lands in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `groupByDomain` (bulk orchestration) + re-exports + unit tests

**Files:**

- Modify: `packages/analyzer/src/grouping.ts`
- Modify: `packages/analyzer/src/__tests__/grouping.test.ts`
- Modify: `packages/analyzer/src/index.ts`

Implements the bulk function: filter hidden/disabled, bucket by `domainGroup`, sort within buckets, order buckets via `GROUP_ORDER`, drop empty buckets, return `RoomGrouping[]` lex-sorted by `roomId`.

- [ ] **Step 1: Add the failing tests**

Append a new `describe` block to the bottom of `packages/analyzer/src/__tests__/grouping.test.ts`. First, extend the imports at the top to include `groupByDomain` and `RoomAssignment`:

```ts
import type { NormalizedEntity, RoomAssignment } from '@lovelacer/shared'
import { domainGroup, groupByDomain } from '../grouping.js'
```

Then append:

```ts
const ent = (id: string, overrides: Partial<NormalizedEntity> = {}): NormalizedEntity => ({
  ...baseEntity,
  entityId: id,
  domain: id.split('.')[0]!,
  objectId: id.split('.')[1]!,
  ...overrides,
})

const assignment = (entityId: string, roomId: string): RoomAssignment => ({
  entityId,
  roomId: roomId as RoomAssignment['roomId'],
  confidence: 1.0,
  signals: [],
})

describe('groupByDomain — orchestration', () => {
  it('returns empty array for empty input', () => {
    expect(groupByDomain({ assignments: [], entities: [] })).toEqual([])
  })

  it('produces one room with one group containing the single entity', () => {
    const e = ent('light.kitchen_ceiling', { friendlyName: 'Kitchen Ceiling' })
    const result = groupByDomain({
      assignments: [assignment('light.kitchen_ceiling', 'kitchen')],
      entities: [e],
    })
    expect(result).toEqual([
      {
        roomId: 'kitchen',
        groups: [{ key: 'lights', entities: [e] }],
      },
    ])
  })

  it('drops hidden entities', () => {
    const e = ent('light.kitchen_ceiling', { isHidden: true })
    const result = groupByDomain({
      assignments: [assignment('light.kitchen_ceiling', 'kitchen')],
      entities: [e],
    })
    expect(result).toEqual([])
  })

  it('drops disabled entities', () => {
    const e = ent('light.kitchen_ceiling', { isDisabled: true })
    const result = groupByDomain({
      assignments: [assignment('light.kitchen_ceiling', 'kitchen')],
      entities: [e],
    })
    expect(result).toEqual([])
  })

  it('preserves diagnostic entities in their natural group', () => {
    const e = ent('sensor.aqara_battery', {
      friendlyName: 'Aqara Battery',
      deviceClass: 'battery',
      entityCategory: 'diagnostic',
    })
    const result = groupByDomain({
      assignments: [assignment('sensor.aqara_battery', 'kitchen')],
      entities: [e],
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.groups[0]!.key).toBe('other') // battery deviceClass not in env filter
    expect(result[0]!.groups[0]!.entities[0]!.entityCategory).toBe('diagnostic')
  })

  it('drops empty groups (room with only lights → output has only lights group)', () => {
    const result = groupByDomain({
      assignments: [assignment('light.a', 'kitchen')],
      entities: [ent('light.a', { friendlyName: 'A' })],
    })
    expect(result[0]!.groups.map((g) => g.key)).toEqual(['lights'])
  })

  it('orders rooms lexicographically by roomId', () => {
    const result = groupByDomain({
      assignments: [
        assignment('light.a', 'kitchen'),
        assignment('light.b', 'bedroom'),
        assignment('light.c', 'living_room'),
      ],
      entities: [
        ent('light.a', { friendlyName: 'A' }),
        ent('light.b', { friendlyName: 'B' }),
        ent('light.c', { friendlyName: 'C' }),
      ],
    })
    expect(result.map((r) => r.roomId)).toEqual(['bedroom', 'kitchen', 'living_room'])
  })

  it('orders groups within a room via GROUP_ORDER (lights, climate, activity, environment, other)', () => {
    const result = groupByDomain({
      assignments: [
        assignment('binary_sensor.m', 'kitchen'),
        assignment('sensor.t', 'kitchen'),
        assignment('climate.c', 'kitchen'),
        assignment('light.l', 'kitchen'),
        assignment('cover.x', 'kitchen'),
      ],
      entities: [
        ent('binary_sensor.m', { friendlyName: 'M', deviceClass: 'motion' }),
        ent('sensor.t', { friendlyName: 'T', deviceClass: 'temperature' }),
        ent('climate.c', { friendlyName: 'C' }),
        ent('light.l', { friendlyName: 'L' }),
        ent('cover.x', { friendlyName: 'X' }),
      ],
    })
    expect(result[0]!.groups.map((g) => g.key)).toEqual([
      'lights',
      'climate',
      'activity',
      'environment',
      'other',
    ])
  })

  it('places `other` last when populated', () => {
    const result = groupByDomain({
      assignments: [assignment('cover.x', 'kitchen'), assignment('light.l', 'kitchen')],
      entities: [ent('cover.x', { friendlyName: 'X' }), ent('light.l', { friendlyName: 'L' })],
    })
    expect(result[0]!.groups.map((g) => g.key)).toEqual(['lights', 'other'])
  })

  it('sorts entities within a group alphabetically by friendlyName, case-insensitive', () => {
    const result = groupByDomain({
      assignments: [
        assignment('light.banana', 'kitchen'),
        assignment('light.apple', 'kitchen'),
        assignment('light.cherry', 'kitchen'),
      ],
      entities: [
        ent('light.banana', { friendlyName: 'Banana' }),
        ent('light.apple', { friendlyName: 'apple' }),
        ent('light.cherry', { friendlyName: 'cherry' }),
      ],
    })
    expect(result[0]!.groups[0]!.entities.map((e) => e.friendlyName)).toEqual([
      'apple',
      'Banana',
      'cherry',
    ])
  })

  it('silently skips assignments referencing entities not in the input', () => {
    const result = groupByDomain({
      assignments: [assignment('light.real', 'kitchen'), assignment('light.ghost', 'kitchen')],
      entities: [ent('light.real', { friendlyName: 'Real' })],
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.groups[0]!.entities).toHaveLength(1)
    expect(result[0]!.groups[0]!.entities[0]!.entityId).toBe('light.real')
  })

  it('handles empty entities with non-empty assignments → empty output', () => {
    const result = groupByDomain({
      assignments: [assignment('light.a', 'kitchen')],
      entities: [],
    })
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.test.ts
```

Expected: FAIL — `groupByDomain` not exported.

- [ ] **Step 3: Implement `groupByDomain`**

Edit `packages/analyzer/src/grouping.ts`. Remove the placeholder `_Internal_*` re-exports at the bottom. Append `groupByDomain`:

```ts
/**
 * Bulk grouping. Takes the detection chain's RoomAssignment[] paired
 * with the corresponding NormalizedEntity[], and produces a per-room
 * RoomGrouping[]:
 *
 *   - Hidden + disabled entities dropped before grouping.
 *   - Diagnostic entities preserved in their natural group.
 *   - Within-group entities sorted by friendlyName (case-insensitive).
 *   - Groups within a room ordered by GROUP_ORDER; empty groups dropped.
 *   - Rooms ordered lexicographically by roomId for snapshot stability.
 *
 * Assignments referencing entities not in the entity list are skipped
 * silently (defensive — shouldn't happen with the in-process pipeline).
 */
export function groupByDomain(input: GroupByDomainInput): RoomGrouping[] {
  const entityById = new Map(input.entities.map((e) => [e.entityId, e]))

  // roomId → groupKey → entities[]
  const buckets = new Map<string, Map<DomainGroupKey, NormalizedEntity[]>>()

  for (const assignment of input.assignments) {
    const entity = entityById.get(assignment.entityId)
    if (entity === undefined) continue
    if (entity.isHidden || entity.isDisabled) continue

    const key = domainGroup(entity)
    let roomBucket = buckets.get(assignment.roomId)
    if (roomBucket === undefined) {
      roomBucket = new Map()
      buckets.set(assignment.roomId, roomBucket)
    }
    let groupBucket = roomBucket.get(key)
    if (groupBucket === undefined) {
      groupBucket = []
      roomBucket.set(key, groupBucket)
    }
    groupBucket.push(entity)
  }

  const sortedRoomIds = [...buckets.keys()].sort()
  const result: RoomGrouping[] = []
  for (const roomId of sortedRoomIds) {
    const roomBucket = buckets.get(roomId)!
    const groups: DomainGroup[] = []
    for (const key of GROUP_ORDER) {
      const entities = roomBucket.get(key)
      if (entities === undefined || entities.length === 0) continue
      const sorted = [...entities].sort((a, b) =>
        a.friendlyName.toLowerCase().localeCompare(b.friendlyName.toLowerCase()),
      )
      groups.push({ key, entities: sorted })
    }
    result.push({ roomId: roomId as CanonicalRoomId, groups })
  }
  return result
}
```

- [ ] **Step 4: Re-export from the analyzer barrel**

Read `packages/analyzer/src/index.ts` first to confirm the existing pattern. Append:

```ts
export { domainGroup, groupByDomain } from './grouping.js'
export type { DomainGroupKey, DomainGroup, GroupByDomainInput, RoomGrouping } from './grouping.js'
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.test.ts
```

Expected: PASS — 15 (Task 1) + 12 (this task) = 27 tests in grouping.test.ts.

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add packages/analyzer/src/grouping.ts \
        packages/analyzer/src/__tests__/grouping.test.ts \
        packages/analyzer/src/index.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(analyzer): groupByDomain bulk orchestration + re-exports

Pure function that takes RoomAssignment[] paired with
NormalizedEntity[] and produces a per-room RoomGrouping[]. Hidden +
disabled entities dropped; diagnostic preserved. Within-group entities
sorted by friendlyName (case-insensitive). Groups ordered via internal
GROUP_ORDER, empty groups dropped. Rooms ordered lex-by-roomId for
snapshot stability.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Fixture-driven snapshot tests

**Files:**

- Create: `packages/analyzer/src/__tests__/grouping.fixtures.test.ts`

End-to-end runs against `english-cluttered` and `czech-tidy`. Pipes through `fixtureToHaRegistries → normalize → detect → groupByDomain` and locks the high-level shape via `toMatchInlineSnapshot`. Plus structural anti-regression assertions (filter behavior, sort behavior, empty-drop behavior).

- [ ] **Step 1: Write the test file**

Create `packages/analyzer/src/__tests__/grouping.fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { czechTidy } from '../../../../tests/fixtures/czech-tidy.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import { normalize } from '../normalize.js'
import { detect } from '../detect.js'
import { groupByDomain } from '../grouping.js'

function pipe(fixture: typeof englishCluttered) {
  const ha = fixtureToHaRegistries(fixture)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })
  const groupings = groupByDomain({ assignments, entities })
  return { entities, assignments, groupings }
}

function summarize(groupings: ReturnType<typeof pipe>['groupings']) {
  return groupings.map((g) => ({
    roomId: g.roomId,
    groups: g.groups.map((grp) => ({ key: grp.key, count: grp.entities.length })),
  }))
}

describe('groupByDomain — english-cluttered fixture', () => {
  const { entities, groupings } = pipe(englishCluttered)

  it('matches structural snapshot', () => {
    expect(summarize(groupings)).toMatchInlineSnapshot()
  })

  it('drops hidden + disabled entities from output', () => {
    const totalGrouped = groupings.reduce(
      (sum, room) => sum + room.groups.reduce((s, g) => s + g.entities.length, 0),
      0,
    )
    const expectedGrouped = entities.filter((e) => !e.isHidden && !e.isDisabled).length
    expect(totalGrouped).toBe(expectedGrouped)
  })

  it('contains no empty groups', () => {
    for (const room of groupings) {
      for (const group of room.groups) {
        expect(group.entities.length).toBeGreaterThan(0)
      }
    }
  })

  it('contains no hidden or disabled entities anywhere in output', () => {
    for (const room of groupings) {
      for (const group of room.groups) {
        for (const entity of group.entities) {
          expect(entity.isHidden).toBe(false)
          expect(entity.isDisabled).toBe(false)
        }
      }
    }
  })

  it('every `other` group contains at least one entity that is genuinely a fallback', () => {
    // A "genuine fallback" is an entity whose (domain, deviceClass) does not
    // match any P1a routing rule. This proves `other` is actually catching
    // the fallback path, not just collecting bugs.
    const isP1aRouted = (e: { domain: string; deviceClass: string | null }): boolean => {
      if (e.domain === 'light' || e.domain === 'switch') return true
      if (e.domain === 'climate') return true
      if (e.domain === 'sensor' && e.deviceClass !== null) {
        return ['temperature', 'humidity'].includes(e.deviceClass)
      }
      if (e.domain === 'binary_sensor' && e.deviceClass !== null) {
        return ['motion', 'occupancy', 'door'].includes(e.deviceClass)
      }
      return false
    }
    for (const room of groupings) {
      const other = room.groups.find((g) => g.key === 'other')
      if (other === undefined) continue
      const hasGenuineFallback = other.entities.some((e) => !isP1aRouted(e))
      expect(
        hasGenuineFallback,
        `room ${room.roomId} 'other' group has no fallback-routed entity`,
      ).toBe(true)
    }
  })

  it('within each group, entities are sorted alphabetically by friendlyName (case-insensitive)', () => {
    for (const room of groupings) {
      for (const group of room.groups) {
        const names = group.entities.map((e) => e.friendlyName.toLowerCase())
        const sorted = [...names].sort()
        expect(names).toEqual(sorted)
      }
    }
  })
})

describe('groupByDomain — czech-tidy fixture', () => {
  const { entities, groupings } = pipe(czechTidy)

  it('matches structural snapshot', () => {
    expect(summarize(groupings)).toMatchInlineSnapshot()
  })

  it('drops hidden + disabled entities (czech-tidy has none, so output count == input count)', () => {
    const totalGrouped = groupings.reduce(
      (sum, room) => sum + room.groups.reduce((s, g) => s + g.entities.length, 0),
      0,
    )
    expect(totalGrouped).toBe(entities.length)
  })

  it('contains no empty groups', () => {
    for (const room of groupings) {
      for (const group of room.groups) {
        expect(group.entities.length).toBeGreaterThan(0)
      }
    }
  })
})
```

> **Note about empty `toMatchInlineSnapshot()` calls:** Vitest's `--update` flag (or `-u`) will populate them on first run. Step 2 below runs the tests with `--update` to fill in the snapshots, then Step 3 re-runs without `--update` to confirm the populated snapshots are stable.

- [ ] **Step 2: Generate the snapshots**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.fixtures.test.ts --update
```

Expected: PASS. The two `toMatchInlineSnapshot()` calls in the file are now populated with the actual structural summaries. Open the file and inspect the snapshots:

- english-cluttered: ~6-7 rooms (the 6 fixture rooms + possibly `misc`), each with several groups. `other` should appear in most rooms (the fixture has cover, media_player, lock, fan entities), `lights` in most rooms, `environment` and `activity` where the fixture has temperature/humidity and motion/occupancy entities.
- czech-tidy: 5 rooms (the 5 Czech rooms), no `misc` (since the fixture is fully area-attributed and all area names map to canonicals). Groups: `lights`, `climate`, `activity`, `environment`, `other` (for diagnostic batteries, signal-strength sensors, etc.).

Sanity-check the snapshots make sense before continuing. If they don't (e.g., a room appears that shouldn't, or a group is empty in the snapshot — which would indicate the empty-drop logic broke), fix the implementation and rerun `--update`.

- [ ] **Step 3: Re-run without `--update` to lock the snapshots**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.fixtures.test.ts
```

Expected: PASS — all assertions including the (now populated) snapshots.

- [ ] **Step 4: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add packages/analyzer/src/__tests__/grouping.fixtures.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
test(analyzer): groupByDomain end-to-end on english-cluttered + czech-tidy

Pipes each fixture through fixtureToHaRegistries → normalize → detect
→ groupByDomain and locks the structural shape via inline snapshots.
Anti-regression assertions confirm filtering (hidden/disabled dropped),
empty-group dropping, sorting (alphabetical by friendlyName), and that
the 'other' group genuinely catches fallback-routed entities (not just
buggy fall-throughs).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1a-5 Acceptance Confirmation

- [ ] `domainGroup` and `groupByDomain` exported from `@lovelacer/analyzer` (Task 2 / Step 4).
- [ ] All unit tests in `grouping.test.ts` pass — 27 total (Tasks 1-2).
- [ ] Fixture snapshot tests in `grouping.fixtures.test.ts` pass for both `english-cluttered` and `czech-tidy` (Task 3).
- [ ] Snapshots reviewed for sanity (no empty groups, no hidden/disabled entities, `other` populated for both fixtures).
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm lint` clean.
