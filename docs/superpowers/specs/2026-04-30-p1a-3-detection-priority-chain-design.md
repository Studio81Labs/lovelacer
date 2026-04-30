# P1a-3 Detection Priority Chain — Design

**Status:** Draft v1 · **Date:** 2026-04-30 · **Ticket:** [P1a-3 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Wire `findRoom` (P1a-2) and `NormalizedEntity` (P1a-1) into the 5-level priority chain from [HEURISTICS.md](../../HEURISTICS.md), producing a `RoomAssignment` per entity with the signals that fired and a base confidence value. Ship the canonical `czech-tidy` fixture alongside, and prove both `english-cluttered` and `czech-tidy` route correctly.

## Non-goals

- **Priority 0 — User overrides.** Deferred to P1b-3 ("Override storage and API").
- **Confidence corroboration boost.** Deferred to P1a-4.
- **Filtering hidden/disabled/diagnostic entities out of the output.** Detection assigns everything; the generator (P1a-6, P1a-7) decides what to render.
- **Routing virtual/system domains** (`sun`, `weather`, `zone`, etc.) to a Home/Overview view. Detection treats them like any other entity; the generator decides domain-level routing.
- **Languages beyond EN+CS.** P1b-1 adds DE, etc.
- **A `detect` HTTP endpoint** or any wiring to `packages/server`. P1a-9 lights up `/api/analyze`.

## Approach summary

A pure function `detect({ entities, areas })` runs the priority chain over every input entity and returns one `RoomAssignment` per entity. Per-entity work is factored into `detectEntity(entity, ctx)` so individual entities can be re-detected in isolation by future tickets. The HA-area-name-to-canonical mapping is precomputed once via `buildDetectionContext(areas)` and cached in the context.

Every priority level produces at most one signal. Higher-priority signals do **not** short-circuit lower ones — every level runs and may contribute. Final `roomId` is the target of whichever signal fired at the highest weight; `confidence` is the max weight that fired. If nothing fires, `roomId` is `'misc'` and `confidence` is `0`.

## Architecture

```
packages/analyzer/src/
  detect.ts                          # detect, detectEntity, buildDetectionContext
  index.ts                           # re-export the public surface
  __tests__/
    detect.test.ts                   # unit tests for detectEntity, detect, context builder
    detect.fixtures.test.ts          # fixture-driven tests (english-cluttered + czech-tidy)

tests/fixtures/
  czech-tidy.ts                      # ~80 entities across 5 rooms, fully area-attributed
  __tests__/
    czech-tidy.test.ts               # self-tests for the "tidy" properties
```

## Components

### 1. Detection context — `buildDetectionContext(areas)`

Pure helper; runs once before bulk detection. Produces a `DetectionContext`:

```ts
export interface AreaIndexEntry {
  /** The HA area's name (used as `matchedValue` on priority-1/2 signals). */
  name: string
  /**
   * Canonical room the area's name maps to via findRoom, or null when the
   * area exists but its name doesn't match any of the 14 canonical patterns.
   */
  canonical: Exclude<CanonicalRoomId, 'misc'> | null
}

export interface DetectionContext {
  /**
   * Maps HA area_id → AreaIndexEntry.
   *
   * Absence from the map means the area_id doesn't exist in the input
   * areas list at all (stale registry); priorities 1/2 treat that the
   * same as a null `canonical` (they don't fire).
   */
  areaIndex: ReadonlyMap<string, AreaIndexEntry>
}

export function buildDetectionContext(areas: HaAreaRegistryEntry[]): DetectionContext
```

For each input area, the builder calls `findRoom(area.name)`:

- If a `RoomMatch` is returned → entry value is `{ name: area.name, canonical: match.canonical }`.
- If `null` is returned → entry value is `{ name: area.name, canonical: null }`.

### 2. Per-entity detection — `detectEntity(entity, ctx)`

```ts
export function detectEntity(entity: NormalizedEntity, ctx: DetectionContext): RoomAssignment
```

Runs each priority level in order. Each level either produces a `DetectionSignal` and pushes it to the `signals[]` array, or doesn't.

#### Priority 1 — entity_area (weight 1.0)

```
if entity.haAreaId !== null:
  entry = ctx.areaIndex.get(entity.haAreaId)
  if entry exists and entry.canonical !== null:
    fire signal { source: 'entity_area', weight: 1.0, matchedValue: entry.name }
    target room: entry.canonical
```

#### Priority 2 — device_area (weight 0.85)

Same as priority 1 but using `entity.device?.haAreaId`. Fires only when:

- `entity.device !== null`
- `entity.device.haAreaId !== null`
- `ctx.areaIndex.get(...)` returns an entry whose `canonical` is non-null

#### Priority 3 — friendly_name (weight 0.6)

```
match = findRoom(entity.friendlyName)
if match !== null:
  fire signal { source: 'friendly_name', weight: 0.6, matchedValue: match.pattern }
  target room: match.canonical
```

#### Priority 4 — entity_id (weight 0.5)

```
match = findRoom(entity.objectId)
if match !== null:
  fire signal { source: 'entity_id', weight: 0.5, matchedValue: match.pattern }
  target room: match.canonical
```

#### Priority 5 — device_name (weight 0.45)

For each of `entity.device?.nameByUser` and `entity.device?.name` (in that order, prefer user-set), call `findRoom`. Use the first hit:

```
candidates = [entity.device?.nameByUser, entity.device?.name].filter(non-null)
for name in candidates:
  match = findRoom(name)
  if match !== null:
    fire signal { source: 'device_name', weight: 0.45, matchedValue: match.pattern }
    target room: match.canonical
    break
```

#### Final assignment

After all five priorities have run:

```
firedSignals = signals collected above
if firedSignals is empty:
  return { entityId, roomId: 'misc', confidence: 0, signals: [] }

# Pick the signal with highest weight (priority order is also weight order, so
# this is just the first one — but compute via Math.max to be future-proof
# against weight changes).
winner = signal with max weight among fired signals
return {
  entityId: entity.entityId,
  roomId: winner's target canonical,
  confidence: winner.weight,
  signals: firedSignals,  # all fired, in priority order
}
```

When two signals tie on weight (shouldn't happen with the current weight table but possible in future), the earlier priority wins via stable iteration order.

### 3. Bulk detection — `detect(input)`

```ts
export interface DetectInput {
  entities: NormalizedEntity[]
  areas: HaAreaRegistryEntry[]
}

export function detect(input: DetectInput): RoomAssignment[]
```

Trivial implementation:

```ts
export function detect(input: DetectInput): RoomAssignment[] {
  const ctx = buildDetectionContext(input.areas)
  return input.entities.map((e) => detectEntity(e, ctx))
}
```

Output cardinality matches input entities exactly. Preserves order.

### 4. Re-exports

`packages/analyzer/src/index.ts` adds:

```ts
export { detect, detectEntity, buildDetectionContext } from './detect.js'
export type { AreaIndexEntry, DetectInput, DetectionContext } from './detect.js'
```

`RoomAssignment` and `DetectionSignal` are already re-exported via `@lovelacer/shared` (added in Phase 0).

### 5. `czech-tidy` fixture

`tests/fixtures/czech-tidy.ts` — built using the existing P0-2 builder helpers. ~80 entities, 5 rooms, 2 floors. Deliberately _tidy_: 100% of entities have `area` set on the entity itself; no hidden/disabled/ambiguous-named entries.

| Room (Czech name) | Floor   | Approx entities | Notes                            |
| ----------------- | ------- | --------------- | -------------------------------- |
| Obývací pokoj     | Přízemí | ~22             | lights, climate, sensors         |
| Kuchyně           | Přízemí | ~18             | lights, switches, fridge sensors |
| Koupelna          | Přízemí | ~10             | humidity, motion, fan            |
| Ložnice           | Patro   | ~18             | lights, climate, motion          |
| Kancelář          | Patro   | ~12             | lights, switches, sensors        |

A handful of entities have `entityCategory: 'diagnostic'` (e.g., `Aqara baterie`, `Tado signál`) — these still get assignments from detection; whether to display them is a generator concern.

Self-tests in `tests/fixtures/__tests__/czech-tidy.test.ts` mirror `english-cluttered.test.ts`'s structure to assert:

- Exactly 5 areas.
- Exactly 2 floors (Přízemí, Patro).
- ≥75 and ≤90 entities.
- 100% of entities have non-null `area`.
- 0 entities with `hidden: true`.
- 0 entities with `disabled: true`.
- All entity names contain at least one Czech-language word (≥1 character with diacritic, or matches a Czech keyword pattern).
- Validator passes (no dangling references, no duplicates).

The fixture is consumable via `pnpm fixtures:load czech-tidy` without any loader changes — the loader auto-discovers from `tests/fixtures/*.ts`.

## Data flow

```
input { entities: NormalizedEntity[], areas: HaAreaRegistryEntry[] }
  │
  ▼
detect()
  │
  ├─ buildDetectionContext(areas) → ctx
  │     • for each area: findRoom(area.name) → canonical or null
  │     • build areaToCanonical map
  │
  ▼
for each entity:
  detectEntity(entity, ctx)
    │
    ├─ Priority 1: entity.haAreaId → ctx → fire if mapped
    ├─ Priority 2: entity.device?.haAreaId → ctx → fire if mapped
    ├─ Priority 3: findRoom(entity.friendlyName) → fire if hit
    ├─ Priority 4: findRoom(entity.objectId) → fire if hit
    ├─ Priority 5: findRoom(entity.device?.nameByUser ?? device.name) → fire if hit
    │
    ├─ if no signals fired:
    │     return { roomId: 'misc', confidence: 0, signals: [] }
    │
    └─ winner = signal with max weight
       return { roomId: winner.target, confidence: winner.weight, signals: all fired }
```

## Error handling

| Condition                                                       | Behavior                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Empty `input.entities`                                          | Returns `[]`.                                                                      |
| Empty `input.areas`                                             | Context is empty; priorities 1/2 never fire; lower priorities still try.           |
| Entity with `haAreaId` referencing an area not in `input.areas` | Treat as unmapped; priority 1 doesn't fire.                                        |
| Entity with no device                                           | Priorities 2 and 5 don't fire.                                                     |
| Entity's `objectId` or `friendlyName` is the empty string       | `findRoom('')` returns null (already covered in P1a-2); the priority doesn't fire. |
| Multiple priorities fire pointing to _different_ rooms          | Highest weight wins as `roomId`. All fired signals stay in `signals[]`.            |

No throws. The function is total over its declared input space.

## Testing

### `packages/analyzer/src/__tests__/detect.test.ts` — unit tests

Use small inline `NormalizedEntity` and `HaAreaRegistryEntry` literals. Tests are organized by priority:

**`buildDetectionContext`:**

- Returns a map with one entry per input area.
- Maps area whose name matches a canonical (e.g., `name: 'Living Room'`) → `'living_room'`.
- Maps area whose name doesn't match (e.g., `name: "Bart's Den"`) → `null`.
- Czech name (e.g., `name: 'Ložnice'`) → `'bedroom'`.

**`detectEntity` per priority:**

- Priority 1 fires when entity has area whose name maps; signal `source: 'entity_area'`, `weight: 1.0`, `matchedValue` is area name; `roomId` is canonical.
- Priority 1 does NOT fire when area name doesn't map (`null` in context).
- Priority 1 does NOT fire when area_id is absent from context.
- Priority 1 does NOT fire when `entity.haAreaId` is null.
- Priority 2 fires from `entity.device.haAreaId` when entity has no own area.
- Priority 2 does NOT fire when `entity.device` is null.
- Priority 3 fires when `findRoom(entity.friendlyName)` matches.
- Priority 4 fires when `findRoom(entity.objectId)` matches.
- Priority 5 fires from `device.nameByUser` (preferred over `device.name`).
- Priority 5 falls back to `device.name` when `nameByUser` is null.

**`detectEntity` aggregation:**

- All 5 priorities fire pointing to the same room → `roomId` is that room, `confidence: 1.0` (max), `signals.length === 5`.
- Conflicting priorities (e.g., entity area says `kitchen` but friendly name says `bedroom`) → `roomId: 'kitchen'` (priority 1 wins), but BOTH signals appear in `signals[]`.
- No signals fire → `roomId: 'misc'`, `confidence: 0`, `signals: []`.

**`detect` bulk API:**

- Empty input → empty output.
- Output cardinality matches input.
- Output preserves input order.

### `packages/analyzer/src/__tests__/detect.fixtures.test.ts` — fixture-driven

For **`english-cluttered`** (the heuristic-stress fixture):

- Every input entity produces an assignment.
- Misc bucket size is ≥10% and ≤30% of entities. Deliberately wide window: the fixture has many orphan entities, but the chain rescues most via priorities 3-5.
- For entities with non-null `area` in the fixture: ≥80% land in their fixture-area's canonical (the same threshold P1a-2 used).

For **`czech-tidy`** (the contrast fixture):

- 0 entities in the misc bucket.
- 100% of entities land in their fixture-area's canonical.
- At least 50% of fired signals have a `matchedValue` that contains a Czech-language pattern (proves diacritic-stripping pipeline carries through end-to-end).

The fixture-driven tests use `fixtureToHaRegistries` (from P1a-1) to convert the fixture's structured form into the HA wire shape the analyzer expects, then feed that to `detect()`.

### `tests/fixtures/__tests__/czech-tidy.test.ts` — fixture self-tests

See § 5 above. Mirror `english-cluttered.test.ts`'s structure.

## File-by-file

| File                                                      | Action | Notes                         |
| --------------------------------------------------------- | ------ | ----------------------------- |
| `packages/analyzer/src/detect.ts`                         | Create | The chain                     |
| `packages/analyzer/src/index.ts`                          | Modify | Re-export public surface      |
| `packages/analyzer/src/__tests__/detect.test.ts`          | Create | Unit tests                    |
| `packages/analyzer/src/__tests__/detect.fixtures.test.ts` | Create | Fixture-driven tests          |
| `tests/fixtures/czech-tidy.ts`                            | Create | ~80-entity Czech tidy fixture |
| `tests/fixtures/__tests__/czech-tidy.test.ts`             | Create | Self-tests                    |

## Open questions resolved during brainstorming

- **HA areas with non-canonical names:** signal does not fire; lower priorities try; misc fallback only when nothing fires.
- **Confidence in this ticket:** `Math.max(...firedWeights)`. Corroboration boost is P1a-4.
- **All priorities run** (not short-circuit). Multiple signals can fire and all appear in the assignment's `signals[]`.
- **Hidden/disabled/diagnostic entities:** included in output. Filtering is the generator's concern.
- **Virtual/system domains** (`sun`, `weather`, `zone`, etc.): no special handling. They probably fall to misc with empty signals.
- **API split:** `detect` (bulk) + `detectEntity` (per-entity) + `buildDetectionContext` (one-time area→canonical map). All pure.
- **`czech-tidy` ships with this ticket** using existing P0-2 builder helpers.

## Risks

- **English-cluttered ≥80% threshold may need tuning.** P1a-2 already met this for friendly-name matching alone; with priorities 1-5 stacked, it should be easier — but corroboration is in P1a-4, not here. If the threshold ends up tight, widen it slightly (75%) rather than fudge the data.
- **Czech-tidy 100% threshold is strict.** That's intentional — the fixture is engineered to hit it. If a real edge case comes up (e.g., diacritic in the area name doesn't normalize the same way as in the entity name), fix the analyzer or fix the fixture, not the threshold.
- **`buildDetectionContext` runs `findRoom` once per area.** Cheap (O(areas × patterns)) but worth noting for very large installs (1000+ areas). Pre-computation puts the cost at startup, not per-entity.

## Acceptance

P1a-3 closes when:

- [ ] `detect`, `detectEntity`, `buildDetectionContext` exported from `@lovelacer/analyzer`.
- [ ] All unit tests in `detect.test.ts` pass.
- [ ] `czech-tidy.ts` fixture self-tests pass.
- [ ] Fixture-driven tests in `detect.fixtures.test.ts` pass for both `english-cluttered` and `czech-tidy`.
- [ ] `pnpm fixtures:load czech-tidy` runs end-to-end against the dev HA stack (manual verification — no automated test required for this in this ticket).
- [ ] `pnpm typecheck` clean.
- [ ] `pnpm test` green.
