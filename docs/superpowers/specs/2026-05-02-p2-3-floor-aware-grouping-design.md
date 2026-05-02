# P2-3 — Floor-Aware Grouping — Design

**Status:** Draft v1 · **Date:** 2026-05-02 · **Phase:** 2 (Polish & Release) · **Sizing:** S

## Goal

When the user's Home Assistant install has floor data (`floor_id` on areas + a populated floor registry), surface that physical structure in the generated dashboard. Add a new "Rooms by floor" section to the Home view that organizes navigation tiles by floor, distinct from the existing "Active Rooms" section (which shows currently-active rooms regardless of floor).

**Acceptance criteria** (from ROADMAP.md):

- Two-floor fixture renders with floor section dividers.
- Absent floor data falls back to flat list (i.e., the new section is omitted; ActiveRooms remains the only navigation surface, unchanged).

## Context

Phase 2 ticket 1 (P2-1) shipped re-analysis diff view; ticket 2 (P2-2) shipped YAML export. P2-3 is the third ticket — purely cosmetic, no new persistence, no API surface changes beyond the `PreviewOutput.config` body becoming richer when floor data is present.

Existing wiring this ticket builds on:

- `HaFloorRegistryEntry { floor_id, name, level, icon }` is fully typed in `@lovelacer/shared`.
- `HaAreaRegistryEntry.floor_id: string | null` is already on the area type.
- `HaClient.getFloorRegistry()` exists but is **not yet called** by `runFullPipeline` in `packages/server/src/pipeline.ts`. This ticket adds that call.
- `buildHomeView` in `@lovelacer/generator/home-view.ts` composes six grid sections: Welcome → QuickStats → People → ActiveRooms → Scenes → Cameras. The new section slots between People and ActiveRooms.

## Architecture & data flow

Three pieces:

1. **Server pipeline gains floor data.** `runFullPipeline` in `packages/server/src/pipeline.ts` adds `ha.getFloorRegistry()` to its existing `Promise.all` registry fetch. The internal `PipelineState` gains `floors: HaFloorRegistryEntry[]`. `runPreview` threads them into `buildHomeView`. The fetch is wrapped in a defensive `try/catch` so installs on older HA versions (where `config/floor_registry/list` may not exist) don't break analyze entirely — the catch logs a warning and treats as empty list.

2. **Analyzer associates rooms with floors.** New pure function `assignFloors()` in `packages/analyzer/src/floor.ts` takes `(rooms, areas, floors)` and emits `Map<CanonicalRoomId, FloorAssignment | null>` where `FloorAssignment = { floorId, name, level, icon }`. The map's value is `null` when the room has no dominant `haAreaId`, or that area has no `floor_id`, or the floor isn't in the registry. Pure logic, no IO. Re-exported from `@lovelacer/analyzer`.

3. **Generator emits the new section.** New `buildRoomsByFloorSection()` in `packages/generator/src/home-view.ts` consumes `(rooms, groupings, floorAssignments)` and emits a `GridSection` containing alternating `HeadingCard` + widened `GlanceCard` per floor. Returns `null` when no rooms are floored. Inserted between `buildPeopleSection` and `buildActiveRoomsSection` in `buildHomeView`.

The `misc` bucket is excluded everywhere (no view to navigate to). `assignFloors` skips it; the generator filters it out as a defensive second check.

## Type changes

**Widened `GlanceCard` in `packages/generator/src/lovelace-types.ts`.** HA's actual schema accepts each `entities[]` element as either a string or a per-entity object with overrides. The new shape:

```ts
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

Existing call sites (`buildPeopleSection`, `buildQuickStatsSection`) keep using plain `string[]` — the union accepts the narrower form unchanged. Only the new section uses the object form, where each entry has `entity`, `name: roomDisplayName`, `tap_action: navigate(roomPath)`.

**New `FloorAssignment` type in `packages/shared/src/types.ts`.** Crosses the analyzer/generator/pipeline boundary, so it lives in shared:

```ts
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

`AnalyzedRoom` is **not** modified — the room→floor association lives in a separate `Map<CanonicalRoomId, FloorAssignment | null>` returned by `assignFloors()`. Keeps `AnalyzedRoom` focused on entity-level analysis (no schema churn for downstream consumers like the diff types from P2-1).

## `assignFloors()` — analyzer side

New file `packages/analyzer/src/floor.ts`. Pure function.

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
 * misc bucket is excluded — it's not navigable.
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

Re-exported from `@lovelacer/analyzer` index alongside `computeDiff`, `detect`, etc.

## `buildRoomsByFloorSection()` — generator side

New function in `packages/generator/src/home-view.ts`.

**Algorithm:**

1. Walk `rooms`, filter out `misc`. For each remaining room, look up its assignment via the map.
2. Bucket rooms into a `Map<floorId | null, AnalyzedRoom[]>` keyed by floor id (or `null` for the unfloored bucket).
3. **Early exit:** if the only bucket is the `null` bucket, return `null`. The section adds no value when zero rooms are floored.
4. Build the ordered list of buckets:
   - All non-null buckets first, ordered by `(floor.level ?? Infinity, floor.name)`. `Infinity` for null `level` puts level-less floors at the end among themselves; ties break alphabetically by name.
   - The `null` bucket last (when present and non-empty).
5. Emit alternating cards into a single `GridSection`:
   - Each bucket → one `HeadingCard` (text: floor `name`, or literal `"Other"` for the `null` bucket).
   - Followed by one widened `GlanceCard` whose `entities` is one `GlanceEntityEntry` per room on that floor:
     - `entity`: the room's primary entity (first light if any, else first activity sensor — same picker logic as `buildActiveRoomsSection`). If a room has neither, skip it.
     - `name`: room display title (from `roomIdToDisplay(roomId).title`).
     - `tap_action`: `{ action: 'navigate', navigation_path: roomIdToDisplay(roomId).path }`.
6. Skip a bucket entirely if it produces zero glance entries (every room in it had no light + no activity sensor → nothing tappable).
7. If after step 6 the section ends up empty, return `null`.

```ts
export interface BuildRoomsByFloorSectionInput {
  rooms: AnalyzedRoom[]
  groupings: RoomGrouping[]
  floorAssignments: Map<CanonicalRoomId, FloorAssignment | null>
}

export function buildRoomsByFloorSection(input: BuildRoomsByFloorSectionInput): GridSection | null
```

The function imports `roomIdToDisplay` (already used by `buildActiveRoomsSection`) for the room name + path. Picking the primary entity reuses the same lights-then-activity logic as `buildActiveRoomsSection` — extract a private helper `pickPrimaryEntity(grouping)` to share between both functions instead of duplicating the inline code.

**`buildHomeView` composition** in `home-view.ts` adds one new step, between people and active rooms:

```ts
const sections: GridSection[] = [buildWelcomeSection(...)]
if (quickStats !== null) sections.push(quickStats)
if (people !== null) sections.push(people)
const roomsByFloor = buildRoomsByFloorSection({
  rooms: input.rooms,
  groupings: input.groupings,
  floorAssignments: input.floorAssignments,
})
if (roomsByFloor !== null) sections.push(roomsByFloor)
const activeRooms = buildActiveRoomsSection(input.groupings)
if (activeRooms !== null) sections.push(activeRooms)
// ... scenes, cameras unchanged
```

`BuildHomeViewInput` adds `rooms: AnalyzedRoom[]` and `floorAssignments: Map<CanonicalRoomId, FloorAssignment | null>` fields. The pipeline (`runPreview`) builds the assignments via `assignFloors` and passes them through.

## Edge cases & error handling

- **HA's `config/floor_registry/list` not supported** (older HA versions). `runFullPipeline` wraps the floor-registry fetch in `try/catch`, logs a warning, treats as empty list. The rest of analyze proceeds normally. The new section is absent.
- **`getFloorRegistry()` returns empty array.** Same as no floors defined — `assignFloors` returns all-null map → `buildRoomsByFloorSection` early-exit. Section absent.
- **HA returns floor entries but no area references any of them.** Stale floor data. `assignFloors` maps every room to `null`. Section absent.
- **Room has `haAreaId` but the area object is missing from the registry.** Race condition (extremely unlikely with `Promise.all` snapshot). Treated as null-floor → room goes to "Other".
- **Floor `level` is `null` for all floors.** Sort falls back to alphabetical by name. No special-case needed.
- **Floor `level` collisions** (e.g., two floors both at `level: 0`). Stable sort breaks ties by name; deterministic output.
- **Room has no light + no activity sensor.** `pickPrimaryEntity` returns `null`. Room is silently dropped from the new section. Same behavior as `buildActiveRoomsSection`.
- **`misc` room in the floor map.** Defense-in-depth: `assignFloors` already excludes it; `buildRoomsByFloorSection` filters it again before bucketing.
- **Localization.** `"Other"` is hardcoded English. Consistent with `roomIdToDisplay` which currently emits English-only labels. P2-9 (multi-language UI strings) i18ns the whole UI surface together.
- **Floor `icon`** is captured in `FloorAssignment` but unused by the generator. Future ticket may put it on the heading card. YAGNI for P2-3.
- **Snapshot diff (P2-1).** No interaction. The diff operates on entity→room assignments; floor data is purely presentational. Lovelace config view structure is identical apart from the new section.
- **YAML export (P2-2).** No interaction beyond serializing the new section's cards through the existing `configToYaml` path. The widened `GlanceCard.entities` (string | object) round-trips through `yaml.stringify` without issue.

## Testing strategy

**`packages/analyzer/src/__tests__/floor.test.ts`** — pure-function tests:

- Empty input (zero rooms) → empty map.
- Empty floors registry → all rooms map to `null`.
- Room with `haAreaId === null` → `null`.
- Room whose area has `floor_id: null` → `null`.
- Room whose `floor_id` isn't in the floor registry → `null` (stale data).
- Room with full chain → maps to `FloorAssignment` with all four fields populated.
- Multi-floor partition: 4 rooms across 2 floors, verify per-floor bucketing.
- Misc room (`id: 'misc'`) → not in the result map at all (distinct from "in the map with null").

**`packages/generator/src/__tests__/home-view.test.ts`** — extends existing, adds `buildRoomsByFloorSection` cases:

- All-null floor map → returns `null` (early exit).
- One floor with one room (1 light) → emits `[HeadingCard, GlanceCard]`. Heading text is the floor name; glance has one entry with `name: 'Kitchen'`, `tap_action: navigate('kitchen')`.
- Two floors with two rooms each → emits 4 cards in alternation: `[Heading 1F, Glance 1F, Heading 2F, Glance 2F]`. Verify floor order is by `level` ascending.
- Mixed: 2 floored + 1 unfloored room → emits `[Heading 1F, Glance 1F, Heading "Other", Glance Other]`. "Other" comes last.
- 100% unfloored (floors registry has entries but no rooms reference them) → returns `null`.
- Room without light or activity sensor → silently dropped from its glance card. If that's the only room on a floor, the floor's heading is also dropped.
- Floor sort order: `level: null` floors after `level`-set floors, alphabetical within the null group.
- Misc room is filtered (defensive second-layer check beyond `assignFloors`).

**Type-level test for the widened `GlanceCard`.** Add an exported `satisfies` example or an inline type-check assertion that confirms both `string` and `GlanceEntityEntry` shapes are accepted by `entities[]`. Existing `buildPeopleSection`/`buildQuickStatsSection` tests continue to use plain strings — they're the regression check that the narrower form still works.

**`packages/server/src/__tests__/routes/preview.test.ts`** — extends existing:

- Add a fixture floor registry to `makeHa()` so `getFloorRegistry()` returns realistic data. Either add a per-test override or extend the fixture builder. Verify the preview response's `config.views[0]` (home view) contains a section with `[HeadingCard, GlanceCard]` cards reflecting the floor partition.
- Floor-registry fetch throws → analyze still succeeds. The new section is absent. Asserts the defensive catch in `runFullPipeline`.

**`packages/server/src/__tests__/pipeline.test.ts`** — extend to confirm `runFullPipeline` calls `getFloorRegistry()` and threads `floors` through `PipelineState`.

**Test fixtures.** `tests/fixtures/_builder/index.ts` currently exposes `fixtureToHaRegistries(fixture)` returning `{ entities, devices, areas }`. Extend the builder to also emit `floors` (default empty). Add a `floors` field to the fixture types so individual fixtures can opt into floor data. Update `makeHa()` helpers in route tests to expose `getFloorRegistry: vi.fn(async () => fixture.floors ?? [])`.

Two new fixture variants (or extensions to existing ones):

- A two-floor variant where every room has a `floor_id` (proves the happy path).
- A mixed variant where some rooms are floored and some aren't (proves the "Other" bucket).

**Manual smoke (per ROADMAP DoD).** Run dev stack with the dev HA container's fixture set up to have two floors. Analyze, apply, open the dashboard, verify the home view's "Rooms by floor" section renders with floor headings and tappable room glances.

## File summary

**New:**

- `packages/analyzer/src/floor.ts`
- `packages/analyzer/src/__tests__/floor.test.ts`

**Modified:**

- `packages/shared/src/types.ts` — add `FloorAssignment`
- `packages/shared/src/index.ts` — re-export `FloorAssignment`
- `packages/analyzer/src/index.ts` — re-export `assignFloors` and `AssignFloorsInput`
- `packages/generator/src/lovelace-types.ts` — widen `GlanceCard.entities`, add `GlanceEntityEntry`
- `packages/generator/src/home-view.ts` — add `buildRoomsByFloorSection`, extract `pickPrimaryEntity` helper, extend `BuildHomeViewInput`
- `packages/generator/src/index.ts` — re-export `buildRoomsByFloorSection`, `BuildRoomsByFloorSectionInput`, `GlanceEntityEntry`
- `packages/generator/src/__tests__/home-view.test.ts` — add section cases
- `packages/server/src/pipeline.ts` — fetch floors, build assignments, thread through `runPreview`
- `packages/server/src/__tests__/pipeline.test.ts` — assert floor-registry call + threading
- `packages/server/src/__tests__/routes/preview.test.ts` — add floor-aware response cases + downgrade-on-error case
- `tests/fixtures/_builder/index.ts` — extend builder + fixture types with `floors`
- One or two existing fixtures (e.g., `english-cluttered.ts`) — add a two-floor variant or new fixture file

## Out of scope (deferred)

- **Floor icons.** Captured in `FloorAssignment` but not rendered. A future ticket can widen `HeadingCard` to support `icon` and surface them.
- **Per-room view modifications.** Each room view (Kitchen, Living Room, etc.) is unchanged — no floor crumbs, no parent-floor link. The floor surface lives only in the home view's new section.
- **Floor-aware navigation reorganization** (e.g., grouping the HA-rendered top tab bar by floor). Not possible via Lovelace storage-mode config — HA's tab UI is a fixed render of `views[]` order.
- **Localization of `"Other"`.** Phase 2 ticket P2-9 i18ns the whole UI surface.
- **`ActiveRooms` integration.** ActiveRooms remains exactly as today — flat alphabetical, conditional on activity. The new section is additive, not a replacement.
