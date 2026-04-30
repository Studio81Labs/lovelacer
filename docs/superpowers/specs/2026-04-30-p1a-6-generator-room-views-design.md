# P1a-6 Generator: Room Views (basic) — Design

**Status:** Draft v1 · **Date:** 2026-04-30 · **Ticket:** [P1a-6 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Convert the analyzer's `RoomGrouping[]` into a `RoomView[]` — one Lovelace `type: 'sections'` view per room, with one grid section per group, each section starting with a heading card followed by per-entity cards (or a grouped entities card, depending on the group). Defines the public Lovelace types we own (room view, grid section, the four card types we construct).

## Non-goals

- The home overview view (Welcome / Quick stats / People / Active rooms / Scenes / Cameras). P1a-7.
- Storage-mode apply via WebSocket. P1a-8 wraps these views into a full `LovelaceConfig` and pushes via `lovelace/config/save`.
- Card types beyond `tile`, `thermostat`, `entities`, `heading`. P1b-2 adds `media-control`, `picture-glance`, etc.
- Outlet vs non-outlet `switch` distinction. All switches → plain `tile` card per HEURISTICS.md and P1a-5's grouping decision.
- Validation against HA's actual schema. The generator emits well-typed structures; HA accepts or rejects when P1a-8 pushes them. (TypeScript types catch shape errors at compile time.)
- HA-side icon support beyond the canonical room set. New canonical rooms get added to the table.
- Localization of titles/headings. English-only for P1a; P2-9 handles SPA i18n.

## Approach summary

`buildRoomView(grouping)` is the unit; `buildRoomViews(groupings)` is the bulk wrapper that filters out groupings with no groups and maps the rest. Internal `ROOM_DISPLAY` and `GROUP_HEADINGS` tables hold the per-room (title, path, icon) metadata and per-group heading text — both sourced directly from [DASHBOARD_GENERATION.md](../../DASHBOARD_GENERATION.md).

A single `buildSection(group)` function with a switch on `group.key` constructs each grid section. Per the heuristics doc:

| Group key | Card layout |
| --- | --- |
| `lights` | heading + one `TileCard` per entity (lights get `features: [{ type: 'light-brightness' }]`, switches don't) |
| `climate` | heading + one `ThermostatCard` per entity |
| `environment` | heading + a single `EntitiesCard` listing all entityIds |
| `activity` | heading + a single `EntitiesCard` listing all entityIds |
| `other` | heading + a single `EntitiesCard` listing all entityIds |

P1a-5's `groupByDomain` already sorted entities within each group; the generator preserves that order.

## Architecture

```
packages/generator/src/
  lovelace-types.ts             # discriminated card union + RoomView/GridSection
  room-view.ts                  # buildRoomView, buildRoomViews, ROOM_DISPLAY, GROUP_HEADINGS
  index.ts                      # re-export public surface
  __tests__/
    room-view.test.ts           # unit tests
    room-view.fixtures.test.ts  # snapshot tests against the canonical fixtures
```

## Components

### 1. Lovelace types (`lovelace-types.ts`)

Discriminated card union plus the structural types we construct. Strongly typed at every level.

```ts
export interface RoomView {
  type: 'sections'
  title: string
  path: string
  icon: string
  sections: GridSection[]
}

export interface GridSection {
  type: 'grid'
  cards: LovelaceCard[]
}

export type LovelaceCard = HeadingCard | TileCard | ThermostatCard | EntitiesCard

export interface HeadingCard {
  type: 'heading'
  heading: string
}

export interface TileCard {
  type: 'tile'
  entity: string
  features?: TileFeature[]
}

export type TileFeature = { type: 'light-brightness' }

export interface ThermostatCard {
  type: 'thermostat'
  entity: string
}

export interface EntitiesCard {
  type: 'entities'
  title?: string
  entities: string[]
}
```

`LovelaceCard` is a discriminated union on `type`, so `card.type === 'tile'` narrows to `TileCard` without casts. New card kinds (`media-control`, `picture-glance`, …) get added to the union in P1b-2.

### 2. Public surface (`room-view.ts`)

```ts
import type { CanonicalRoomId, NormalizedEntity } from '@lovelacer/shared'
import type { DomainGroupKey, RoomGrouping } from '@lovelacer/analyzer'
import type {
  EntitiesCard,
  GridSection,
  HeadingCard,
  LovelaceCard,
  RoomView,
  ThermostatCard,
  TileCard,
} from './lovelace-types.js'

export function buildRoomView(grouping: RoomGrouping): RoomView
export function buildRoomViews(groupings: RoomGrouping[]): RoomView[]
```

(`RoomGrouping` and `DomainGroupKey` re-exported from analyzer; `CanonicalRoomId` and `NormalizedEntity` are shared-package types that analyzer doesn't re-export.)

`buildRoomViews` filters out groupings with `groups.length === 0` before mapping — no point producing an empty-sections view that HA would render as a blank page. (`groupByDomain` already drops empty groups, so this defensive filter rarely triggers.)

### 3. Per-room metadata table

Internal `ROOM_DISPLAY: Record<CanonicalRoomId, RoomDisplay>` mirrors [DASHBOARD_GENERATION.md § Icon selection](../../DASHBOARD_GENERATION.md):

```ts
interface RoomDisplay {
  title: string
  path: string
  icon: string
}

const ROOM_DISPLAY: Record<CanonicalRoomId, RoomDisplay> = {
  kitchen: { title: 'Kitchen', path: 'kitchen', icon: 'mdi:silverware-fork-knife' },
  living_room: { title: 'Living Room', path: 'living_room', icon: 'mdi:sofa' },
  bedroom: { title: 'Bedroom', path: 'bedroom', icon: 'mdi:bed' },
  bathroom: { title: 'Bathroom', path: 'bathroom', icon: 'mdi:shower-head' },
  office: { title: 'Office', path: 'office', icon: 'mdi:desk' },
  garage: { title: 'Garage', path: 'garage', icon: 'mdi:garage-variant' },
  garden: { title: 'Garden', path: 'garden', icon: 'mdi:flower-tulip' },
  dining_room: { title: 'Dining Room', path: 'dining_room', icon: 'mdi:silverware' },
  laundry: { title: 'Laundry', path: 'laundry', icon: 'mdi:washing-machine' },
  basement: { title: 'Basement', path: 'basement', icon: 'mdi:stairs-down' },
  attic: { title: 'Attic', path: 'attic', icon: 'mdi:home-roof' },
  kids_room: { title: "Kids' Room", path: 'kids_room', icon: 'mdi:teddy-bear' },
  guest_room: { title: 'Guest Room', path: 'guest_room', icon: 'mdi:bed-empty' },
  hallway: { title: 'Hallway', path: 'hallway', icon: 'mdi:door' },
  misc: { title: 'Other', path: 'other', icon: 'mdi:dots-horizontal' },
}
```

The misc row is the only one where `path !== canonicalRoomId` (`'other'` per the doc).

### 4. Per-group heading table

```ts
const GROUP_HEADINGS: Partial<Record<DomainGroupKey, string>> = {
  lights: 'Lights & Outlets',
  climate: 'Climate',
  activity: 'Activity',
  environment: 'Environment',
  other: 'Other',
}
```

`Partial<>` because P1b-only group keys (`covers`, `media`, `security`, `cameras`, `vacuum`, `fans`) don't need entries until P1b-2 — `domainGroup` doesn't return them yet, so the lookup never misses in practice.

### 5. Section construction — `buildSection(group)`

```ts
function buildSection(group: DomainGroup): GridSection
```

Switches on `group.key`:

- **`lights`**: heading card + one `TileCard` per entity. `entity.domain === 'light'` adds `features: [{ type: 'light-brightness' }]`; `entity.domain === 'switch'` produces a tile without features. Per HEURISTICS.md, all switches go to this group regardless of their `device_class`.
- **`climate`**: heading card + one `ThermostatCard` per entity (`entity: entity.entityId`).
- **`environment`**: heading card + a single `EntitiesCard` whose `entities` is the array of `entityId`s in the group's `entities` order. No `title` on the entities card — the heading card already labels the section.
- **`activity`**: same pattern as `environment`.
- **`other`**: same pattern as `environment`.
- **Unknown key (defensive default):** `throw new Error('unsupported group key: ' + key)`. Should be unreachable given the current `DomainGroupKey` union and the fact that `domainGroup` only returns the 5 P1a keys today.

### 6. View construction — `buildRoomView(grouping)`

```ts
function buildRoomView(grouping: RoomGrouping): RoomView {
  const display = ROOM_DISPLAY[grouping.roomId]
  return {
    type: 'sections',
    title: display.title,
    path: display.path,
    icon: display.icon,
    sections: grouping.groups.map(buildSection),
  }
}
```

`grouping.groups` is already sorted by P1a-5's `GROUP_ORDER`; `buildRoomView` doesn't re-sort.

## Data flow

```
input: RoomGrouping
  │
  ▼
buildRoomView()
  │
  ├─ display = ROOM_DISPLAY[grouping.roomId]
  ├─ sections = grouping.groups.map(buildSection)
  │     buildSection(group):
  │       headingCard = { type: 'heading', heading: GROUP_HEADINGS[group.key] }
  │       cards = headingCard + per-group cards
  │       return { type: 'grid', cards }
  └─ return { type: 'sections', title, path, icon, sections }
```

## Error handling

| Condition | Behavior |
| --- | --- |
| `grouping.roomId` not in `ROOM_DISPLAY` | TypeScript prevents this at compile time (the `Record<CanonicalRoomId, …>` type means missing keys are a type error). |
| `group.key` not in `GROUP_HEADINGS` | Lookup returns `undefined`; `buildSection` throws on the unknown-key default. With current `domainGroup` outputs, unreachable. |
| `group.entities` empty | Cannot occur: P1a-5 drops empty groups before producing the `RoomGrouping`. |
| `groupings.length === 0` | `buildRoomViews` returns `[]`. |
| Grouping with no groups (defensive) | `buildRoomViews` filters it out before mapping. |

No I/O, no async. Pure functions throughout.

## Testing

### `room-view.test.ts` — unit tests

Use small inline `RoomGrouping` literals.

**Per-room metadata:**

- Kitchen grouping → `title: 'Kitchen'`, `path: 'kitchen'`, `icon: 'mdi:silverware-fork-knife'`.
- Misc grouping → `title: 'Other'`, `path: 'other'`, `icon: 'mdi:dots-horizontal'` (path differs from canonical ID).
- Iterate every key of `ROOM_DISPLAY` and assert `buildRoomView` produces the expected `(title, path, icon)`. Snapshot all 15 in one test.

**Per-group section structure:**

- `lights` group with one `light` entity → section `cards`: `[{type: 'heading', heading: 'Lights & Outlets'}, {type: 'tile', entity: '...', features: [{type: 'light-brightness'}]}]`.
- `lights` group with one `switch` entity → tile card has NO `features` key.
- `lights` group with mixed light + switch entities → each gets the right tile shape.
- `climate` group with one entity → heading + thermostat card.
- `environment` group with three entities → heading + single entities card with three entityIds in input order.
- `activity` group with three entities → heading + single entities card.
- `other` group with three entities → heading + single entities card.

**View shape:**

- Empty grouping (`groups: []`) → returned via `buildRoomView` produces `sections: []` (the function doesn't filter; `buildRoomViews` does).
- `buildRoomViews([])` → `[]`.
- `buildRoomViews([groupingWithEmptyGroups])` → `[]` (filter applies).
- `buildRoomViews` preserves input order for non-empty groupings.

**Section ordering inside a room:**

- Input grouping with `groups` in `GROUP_ORDER` (lights, climate, activity, environment, other) → sections in same order. The generator doesn't sort; it relies on P1a-5 already having sorted.

### `room-view.fixtures.test.ts` — snapshot + structural

For each of `english-cluttered` and `czech-tidy`:

1. Pipe through `fixtureToHaRegistries → normalize → detect → groupByDomain → buildRoomViews`.
2. Reduce to a structural summary (room title/path/icon + per-section heading + card-type counts) and `toMatchInlineSnapshot`.
3. Anti-regression assertions:
   - **Entity referential integrity:** every input entity that survived `groupByDomain` (i.e., not hidden, not disabled) appears in exactly one card across one view.
   - **No empty cards:** every `EntitiesCard.entities.length > 0`; every `TileCard.entity` and `ThermostatCard.entity` is a non-empty string.
   - **Path uniqueness:** all view paths are distinct within the output.
   - **Card-type-per-group invariant:** in every section, the card-type pattern matches the group key (lights → heading + tiles; climate → heading + thermostats; environment/activity/other → heading + one entities card).

The snapshot serves as the regression baseline. The structural assertions catch silent regressions that wouldn't move the snapshot's reduced summary (e.g., a tile card with no entity, or two views sharing a path).

## File-by-file

| File | Action | Notes |
| --- | --- | --- |
| `packages/generator/src/lovelace-types.ts` | Create | Type declarations |
| `packages/generator/src/room-view.ts` | Create | `buildRoomView`, `buildRoomViews`, internal tables |
| `packages/generator/src/index.ts` | Modify | Re-export public surface |
| `packages/generator/src/__tests__/room-view.test.ts` | Create | Unit tests |
| `packages/generator/src/__tests__/room-view.fixtures.test.ts` | Create | Fixture snapshot + structural tests |
| `packages/generator/vitest.config.ts` | Create | Mirror `packages/analyzer/vitest.config.ts` so tests are discoverable (same orphan-test pattern from P1a-1) |
| `packages/generator/package.json` | Modify | Add `@lovelacer/analyzer` workspace dependency (shared is already there) |
| `packages/generator/tsconfig.json` | Modify | Add `references` entry for `../analyzer` (shared reference is already there) |

## Open questions resolved during brainstorming

- **Type fidelity:** Strongly typed (option A). Discriminated union for cards; structural types for views/sections.
- **Card type per group:** light/switch → tile; light gets `light-brightness` feature; climate → thermostat; environment/activity/other → single entities card per group.
- **Section heading:** separate `HeadingCard` at the start of each grid section (per dashboard doc).
- **Entity ordering:** preserve P1a-5's friendlyName-sorted order; don't re-sort.
- **Group ordering:** preserve P1a-5's `GROUP_ORDER`; don't re-sort.
- **Empty-grouping filter:** in `buildRoomViews`, defensively drop groupings with no groups.
- **Localization:** English-only for P1a. Localized titles/headings is P2-9 territory.

## Risks

- **HA Lovelace schema drift.** Our `RoomView` and card types reflect HA's current sections-view schema. If HA changes (e.g., renames `type: 'sections'`), the generator's output stops being valid even though our TypeScript still compiles. Mitigation: P1a-8's manual smoke test (apply via storage mode, render in dev HA) catches drift end-to-end.
- **DOMAIN_GROUP_KEYs vs GROUP_HEADINGS sync.** The `Partial<Record<DomainGroupKey, string>>` type permits missing entries. If a future P1b-2 lands new domain group keys without adding heading entries, `buildSection` will throw at runtime. The unit test that iterates `domainGroup`'s actual return values would catch this; we add it explicitly.
- **`misc` path special case.** The fact that `misc` maps to path `'other'` is a doc-driven decision. If a future ticket wants the URL to match the canonical ID for consistency, this becomes a one-line change.

## Acceptance

P1a-6 closes when:

- [ ] `buildRoomView`, `buildRoomViews`, and the public Lovelace types exported from `@lovelacer/generator`.
- [ ] All unit tests in `room-view.test.ts` pass.
- [ ] Fixture snapshot tests in `room-view.fixtures.test.ts` pass for both fixtures.
- [ ] Snapshots reviewed for sanity (rooms, sections, card-type counts make sense for each fixture).
- [ ] `packages/generator/vitest.config.ts` added; analyzer dep wired in package.json + tsconfig.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm lint` clean.
