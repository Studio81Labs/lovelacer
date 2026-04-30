# P1a-5 Domain Grouping (limited domains) — Design

**Status:** Draft v1 · **Date:** 2026-04-30 · **Ticket:** [P1a-5 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Group each entity in `RoomAssignment[]` into a display category (`lights`, `environment`, `activity`, `climate`, or `other`) within its room. The output is the input to P1a-6's generator, which builds Lovelace cards from the groups.

## Non-goals

- Lovelace card-type selection. The analyzer outputs group keys only; the generator decides which Lovelace card to render for each group.
- The remaining group keys (`covers`, `media`, `security`, `cameras`, `vacuum`, `fans`). Pre-declared in the type union but not produced by `domainGroup` until P1b-2.
- Outlet-deviceClass routing for switches. HEURISTICS.md mentions splitting `switch` with `device_class: outlet` into a separate Lights & Outlets bucket; deferred. All `switch` entities go to `lights` for P1a.
- Filtering diagnostic entities. They flow through with their `entityCategory` flag; the generator's `include_diagnostic` setting (future) decides what renders.
- Modifying `AnalyzedRoom` or `AnalysisResult` in `packages/shared/src/types.ts`. P1a-5 ships its own `RoomGrouping` shape; the existing detection-shaped types stay as-is.

## Approach summary

A pure function `groupByDomain({ assignments, entities })` produces a `RoomGrouping[]`. Per-entity routing lives in a separate `domainGroup(entity): DomainGroupKey` so callers (and tests) can ask "what bucket would this entity land in?" without rebuilding the full output.

Hidden and disabled entities are dropped before grouping. Diagnostic entities pass through. Within each group, entities are sorted alphabetically by `friendlyName` (case-insensitive). Empty groups are dropped. Groups within a room are ordered by a fixed `GROUP_ORDER` array — lights first, `other` last.

## Architecture

```
packages/analyzer/src/
  grouping.ts                       # domainGroup, groupByDomain, types, GROUP_ORDER
  index.ts                          # re-export public surface
  __tests__/
    grouping.test.ts                # unit tests
    grouping.fixtures.test.ts       # snapshot tests against the canonical fixtures
```

## Components

### 1. Types

```ts
import type { CanonicalRoomId, NormalizedEntity, RoomAssignment } from '@lovelacer/shared'

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
  | 'other' // fallback for any unmapped (entity, deviceClass) combo

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
```

### 2. Per-entity routing — `domainGroup(entity)`

```ts
export function domainGroup(entity: NormalizedEntity): DomainGroupKey
```

Pure routing logic, no I/O, no state:

| Match                                                                            | Group         |
| -------------------------------------------------------------------------------- | ------------- |
| `domain === 'light'`                                                             | `lights`      |
| `domain === 'switch'`                                                            | `lights`      |
| `domain === 'climate'`                                                           | `climate`     |
| `domain === 'sensor'` AND `deviceClass ∈ {'temperature', 'humidity'}`            | `environment` |
| `domain === 'binary_sensor'` AND `deviceClass ∈ {'motion', 'occupancy', 'door'}` | `activity`    |
| Anything else                                                                    | `other`       |

`entityCategory` does not affect routing — diagnostic entities go to their natural group.

### 3. Bulk grouping — `groupByDomain(input)`

```ts
export function groupByDomain(input: GroupByDomainInput): RoomGrouping[]
```

Algorithm:

1. Build `entityById: Map<entityId, NormalizedEntity>` from `input.entities`.
2. Build `assignmentsByRoom: Map<CanonicalRoomId, RoomAssignment[]>` by walking `input.assignments`.
3. For each room (sorted lexicographically by `roomId` for determinism):
   - For each assignment in that room:
     - Look up the entity. If not found, skip silently (defensive — shouldn't happen).
     - If `entity.isHidden` or `entity.isDisabled`, drop the entity.
     - Otherwise, route via `domainGroup(entity)` and push the entity into the corresponding group bucket.
   - Sort each group's entities alphabetically by `friendlyName` (case-insensitive).
   - Order the populated groups via `GROUP_ORDER`. Drop empty groups.
4. Return `RoomGrouping[]` ordered by room.

```ts
const GROUP_ORDER: DomainGroupKey[] = [
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
```

`GROUP_ORDER` stays internal (file-level `const`). It's not part of the public surface — consumers shouldn't depend on the exact order, just on the fact that it's deterministic.

### 4. Re-exports — `packages/analyzer/src/index.ts`

```ts
export { domainGroup, groupByDomain } from './grouping.js'
export type { DomainGroupKey, DomainGroup, GroupByDomainInput, RoomGrouping } from './grouping.js'
```

## Data flow

```
input { assignments: RoomAssignment[], entities: NormalizedEntity[] }
  │
  ▼
groupByDomain()
  │
  ├─ entityById = Map(entities)
  ├─ for each assignment:
  │     entity = entityById.get(assignment.entityId)
  │     if entity isHidden|isDisabled → drop
  │     else: groups[assignment.roomId][domainGroup(entity)].push(entity)
  ├─ for each room:
  │     for each populated group: sort entities by friendlyName
  │     order groups by GROUP_ORDER, drop empty
  └─ return RoomGrouping[] ordered lexicographically by roomId
```

## Error handling

| Condition                                               | Behavior                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| Empty `assignments`                                     | Returns `[]`.                                                     |
| Empty `entities` (with non-empty assignments)           | Returns `[]`. Every entity lookup misses; no entity gets grouped. |
| Assignment references an entity not in `entities`       | Silently skipped.                                                 |
| Entity has unrecognized `domain` (e.g., `'lawn_mower'`) | Routes to `'other'` via the fallback rule.                        |
| Hidden + disabled together                              | Same as either: dropped.                                          |

No throws.

## Testing

### `grouping.test.ts` — unit

`domainGroup` per rule:

- `domain: 'light'` → `lights`
- `domain: 'switch'` → `lights`
- `domain: 'climate'` → `climate`
- `domain: 'sensor', deviceClass: 'temperature'` → `environment`
- `domain: 'sensor', deviceClass: 'humidity'` → `environment`
- `domain: 'sensor', deviceClass: 'illuminance'` → `other` (not in P1a's environment filter)
- `domain: 'sensor', deviceClass: null` → `other`
- `domain: 'binary_sensor', deviceClass: 'motion'` → `activity`
- `domain: 'binary_sensor', deviceClass: 'occupancy'` → `activity`
- `domain: 'binary_sensor', deviceClass: 'door'` → `activity`
- `domain: 'binary_sensor', deviceClass: 'window'` → `other` (not in P1a's activity filter)
- `domain: 'cover'`, `media_player`, `lock`, `camera`, `vacuum`, `fan` → `other` (P1b keys declared but unmapped here)
- `domain: 'light', entityCategory: 'diagnostic'` → `lights` (diagnostics route by domain, not category)

`groupByDomain`:

- Empty input → empty output
- Single entity → single room with single group containing that entity
- Hidden entity dropped from output entirely
- Disabled entity dropped from output entirely
- Diagnostic entity preserved in its natural group with `entityCategory: 'diagnostic'` intact
- Multi-room input → output ordered lexicographically by `roomId`
- Within-group entities sorted alphabetically by `friendlyName`, case-insensitive (`'apple'` before `'Banana'` before `'cherry'`)
- Empty groups dropped (room with only lights → output has only `lights` group)
- GROUP_ORDER respected: a room with `light + sensor.temp + binary_sensor.motion + climate` produces groups in order `lights, climate, activity, environment`
- `other` always last when present
- Assignment with no matching entity in `entities` → silently skipped (defensive)

### `grouping.fixtures.test.ts` — snapshot

For each canonical fixture (`english-cluttered`, `czech-tidy`):

1. Pipe through `fixtureToHaRegistries → normalize → detect → groupByDomain`.
2. Reduce the output to a structural snapshot via `toMatchInlineSnapshot`:

```ts
const summary = groupings.map((g) => ({
  roomId: g.roomId,
  groups: g.groups.map((grp) => ({
    key: grp.key,
    count: grp.entities.length,
  })),
}))
expect(summary).toMatchInlineSnapshot(`...`)
```

This locks the high-level structure (room count, groups per room, entity count per group) without snapshotting the full entity payloads (which would be brittle on every fixture tweak).

3. Anti-regression assertions (not snapshot-based):
   - Sum of all `entities.length` across all groups equals `total entities - hidden - disabled`. Proves filtering actually fires.
   - No room has a group with `entities.length === 0`. Proves empty-group drop fires.
   - No room contains an entity with `isHidden || isDisabled`. Proves the filter.
   - For each `other` group, at least one entity has a `domain ∉ {light, switch, climate}` AND not a sensor/binary_sensor with a P1a deviceClass. Proves `other` actually catches the fallback cases.

## File-by-file

| File                                                        | Action | Notes                                                  |
| ----------------------------------------------------------- | ------ | ------------------------------------------------------ |
| `packages/analyzer/src/grouping.ts`                         | Create | `domainGroup`, `groupByDomain`, types, GROUP_ORDER     |
| `packages/analyzer/src/index.ts`                            | Modify | Re-export public surface                               |
| `packages/analyzer/src/__tests__/grouping.test.ts`          | Create | Unit tests                                             |
| `packages/analyzer/src/__tests__/grouping.fixtures.test.ts` | Create | Snapshot + structural tests against canonical fixtures |

## Open questions resolved during brainstorming

- **Output shape:** new `RoomGrouping` shape (option A from brainstorming). `AnalyzedRoom` stays detection-only.
- **Card-type info:** not in analyzer's output. Generator decides cards from group keys.
- **Group keys:** all 11 declared (P1a + P1b), but only `lights/environment/activity/climate/other` populated.
- **Outlet device class:** all switches → `lights`. Refining for outlets is deferred.
- **Hidden/disabled:** dropped before grouping.
- **Diagnostic:** routed by domain, flag preserved on the entity. Generator filters at render time.
- **Ordering:** rooms lex-sorted by `roomId`; groups by `GROUP_ORDER`; entities by `friendlyName` (case-insensitive).
- **Empty groups:** dropped.

## Risks

- **Snapshot brittleness.** Inline snapshots break when fixtures change. Mitigated by reducing to a structural summary (room/group/count) instead of full payload. If the fixtures grow, update the snapshot — that's the regression signal.
- **Assignment/entity desync.** `groupByDomain` defensively skips entities not found in the entity list. If detection ever produces an `entityId` not in the entity list, that's a real bug — but it surfaces silently here. The unit test for "assignment with no matching entity" pins the behavior; if we want it to throw later, we change one line.

## Acceptance

P1a-5 closes when:

- [ ] `domainGroup` and `groupByDomain` exported from `@lovelacer/analyzer`.
- [ ] All unit tests in `grouping.test.ts` pass.
- [ ] Fixture snapshot tests in `grouping.fixtures.test.ts` pass for both `english-cluttered` and `czech-tidy`.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm lint` clean.
