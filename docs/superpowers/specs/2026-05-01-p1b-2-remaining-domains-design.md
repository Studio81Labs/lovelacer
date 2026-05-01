# P1b-2 Remaining Domains (cover, media_player, lock, camera, vacuum, fan) — Design

**Status:** Draft v1 · **Date:** 2026-05-01 · **Ticket:** [P1b-2 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Wire the 6 domains the analyzer's `DomainGroupKey` already reserves but `domainGroup()` doesn't route — `cover`, `media_player`, `lock`, `camera`, `vacuum`, `fan` — through to their proper card mappings per [`docs/DASHBOARD_GENERATION.md`](../../DASHBOARD_GENERATION.md). Ship 3 new test fixtures (`security-rich`, `vacuum-heavy`, `kitchen-sink`) so the new card mappings are exercised by snapshot tests end-to-end.

## Non-goals

- Energy / power sensor grouping. Mentioned in DASHBOARD_GENERATION.md as a separate group; deferred to a future ticket. P1b-2 keeps `sensor` routing as it is (temperature/humidity → environment, everything else → other).
- Custom card types beyond what HA Lovelace ships natively. Picture-entity, media-control, tile, thermostat, entities, heading, markdown, glance — same set as today plus the two new types added here.
- Section ordering changes. The existing `GROUP_ORDER` in `grouping.ts` already declares all 11 keys in the right order. We just start populating the previously-empty groups.
- Entity-level deduplication. If a cover and a binary_sensor both report the same physical garage door, both render as separate cards. Future feature.
- Floor-aware section composition (e.g., putting cameras at the top of the home view). P1b-5 owns the home overview's full sections.
- Per-card UI customization (sliders, advanced features beyond open/close, brightness, fan-speed). Sticking to the docs' minimum-viable feature set.

## Approach summary

Three small, mechanical changes wired together:

1. **`grouping.ts`** — extend `domainGroup()` with 6 new explicit domain → group mappings. Order matters slightly (lights/climate/etc. checked first as today); the new mappings slot in cleanly.
2. **`lovelace-types.ts`** — add 2 new card types (`MediaControlCard`, `PictureEntityCard`) to the `LovelaceCard` discriminated union, plus 2 new `TileFeature` variants (`cover-open-close`, `fan-speed`).
3. **`room-view.ts`** — promote `GROUP_HEADINGS` from `Partial<Record<...>>` to `Record<...>` (compile-time exhaustiveness over `DomainGroupKey`), extend `buildSection()`'s switch to handle the 6 new keys with their respective card builders, extend `buildTileCard()` to attach `cover-open-close` for covers and `fan-speed` for fans.

Then snapshot regeneration: existing fixtures (`english-cluttered`, `german-massive`) have the relevant entities (cover, media_player, lock, fan) already in `'other'` — once `domainGroup()` routes them properly, snapshot tests detect the shift and we re-baseline.

Finally, three new fixtures dedicated to the new domains so the snapshot pipeline actually exercises camera + vacuum (which neither existing fixture has).

## Architecture

```
packages/analyzer/src/
  grouping.ts                              # MODIFY: 6 new explicit domain mappings in domainGroup()
  __tests__/grouping.test.ts               # MODIFY: 6 new domain-routing tests
  __tests__/grouping.fixtures.test.ts      # MODIFY: snapshots regenerate, 3 new fixture blocks
  __tests__/detect.fixtures.test.ts        # MODIFY: 3 new fixture pipe blocks

packages/generator/src/
  lovelace-types.ts                        # MODIFY: 2 new card types, 2 new TileFeature variants
  room-view.ts                             # MODIFY: GROUP_HEADINGS exhaustive, buildSection switch,
                                            #         buildTileCard adds cover + fan features
  index.ts                                 # MODIFY: re-export 2 new card types
  __tests__/room-view.test.ts              # MODIFY: card-mapping tests for each new domain
  __tests__/room-view.fixtures.test.ts     # MODIFY: snapshots regenerate
  __tests__/lovelace-config.fixtures.test.ts # MODIFY: snapshots regenerate

tests/fixtures/
  security-rich.ts                         # NEW: ~38 entities, 4 areas, focuses on locks + cameras
  vacuum-heavy.ts                          # NEW: ~26 entities, 3 areas, focuses on vacuums
  kitchen-sink.ts                          # NEW: ~40 entities, 4 areas, all 6 new domains
  __tests__/security-rich.test.ts          # NEW: structural assertions
  __tests__/vacuum-heavy.test.ts           # NEW: structural assertions
  __tests__/kitchen-sink.test.ts           # NEW: structural assertions
```

## Components

### 1. New card types (`lovelace-types.ts`)

```ts
export interface MediaControlCard {
  type: 'media-control'
  entity: string
}

export interface PictureEntityCard {
  type: 'picture-entity'
  entity: string
  camera_view?: 'live' | 'auto'
}

// Extended TileFeature union — new variants added alongside light-brightness.
export type TileFeature =
  | { type: 'light-brightness' }
  | { type: 'cover-open-close' }
  | { type: 'fan-speed' }

// LovelaceCard grows from 6 → 8 variants.
export type LovelaceCard =
  | HeadingCard
  | TileCard
  | ThermostatCard
  | EntitiesCard
  | MarkdownCard
  | GlanceCard
  | MediaControlCard
  | PictureEntityCard
```

`camera_view` is optional with two literal values per HA's picture-entity-card docs:

- `live` — streamed video (default we set explicitly for our generated cards).
- `auto` — snapshot, refreshed at HA's standard interval.

We always emit `camera_view: 'live'` since users adding cameras to a dashboard typically want streaming. The optional shape is preserved on the type so external consumers (P1b-3+ override storage, future config import) can omit it.

### 2. Analyzer routing (`grouping.ts`)

```ts
export function domainGroup(entity: NormalizedEntity): DomainGroupKey {
  if (entity.domain === 'light' || entity.domain === 'switch') return 'lights'
  if (entity.domain === 'climate') return 'climate'
  if (entity.domain === 'cover') return 'covers'
  if (entity.domain === 'media_player') return 'media'
  if (entity.domain === 'lock') return 'security'
  if (entity.domain === 'camera') return 'cameras'
  if (entity.domain === 'vacuum') return 'vacuum'
  if (entity.domain === 'fan') return 'fans'
  if (entity.domain === 'sensor' && entity.deviceClass !== null) {
    if (SENSOR_ENVIRONMENT_CLASSES.has(entity.deviceClass)) return 'environment'
  }
  if (entity.domain === 'binary_sensor' && entity.deviceClass !== null) {
    if (BINARY_SENSOR_ACTIVITY_CLASSES.has(entity.deviceClass)) return 'activity'
  }
  return 'other'
}
```

Order: lights/climate first (most-frequent fast path), then the new domain checks (still O(1) string compare per entity), then sensor/binary_sensor with device-class filters, then `other` fallback.

### 3. Generator card mapping (`room-view.ts`)

**`GROUP_HEADINGS` becomes exhaustive:**

```ts
const GROUP_HEADINGS: Record<DomainGroupKey, string> = {
  lights: 'Lights & Outlets',
  climate: 'Climate',
  covers: 'Covers',
  media: 'Media',
  cameras: 'Cameras',
  activity: 'Activity',
  environment: 'Environment',
  security: 'Security',
  vacuum: 'Vacuum',
  fans: 'Fans',
  other: 'Other',
}
```

The type tightens from `Partial<Record<DomainGroupKey, string>>` to `Record<DomainGroupKey, string>`. TypeScript fails compilation if `DomainGroupKey` ever grows without a corresponding heading.

**`buildSection()` switch — exhaustive over `DomainGroupKey`:**

```ts
function buildSection(group: DomainGroup): GridSection {
  const heading = GROUP_HEADINGS[group.key]
  const headingCard: HeadingCard = { type: 'heading', heading }

  let bodyCards: LovelaceCard[]
  switch (group.key) {
    case 'lights':
    case 'covers':
    case 'security':
    case 'vacuum':
    case 'fans':
      bodyCards = group.entities.map((e) => buildTileCard(e))
      break
    case 'climate':
      bodyCards = group.entities.map((e) => buildThermostatCard(e))
      break
    case 'media':
      bodyCards = group.entities.map((e) => ({
        type: 'media-control' as const,
        entity: e.entityId,
      }))
      break
    case 'cameras':
      bodyCards = group.entities.map((e) => ({
        type: 'picture-entity' as const,
        entity: e.entityId,
        camera_view: 'live' as const,
      }))
      break
    case 'environment':
    case 'activity':
    case 'other':
      bodyCards = [buildEntitiesCard(group.entities)]
      break
  }

  return { type: 'grid', cards: [headingCard, ...bodyCards] }
}
```

The `default` case + `throw new Error('unsupported group key')` are removed — the switch is exhaustive over `DomainGroupKey`, TypeScript enforces.

**`buildTileCard()` — feature mapping by domain:**

```ts
function buildTileCard(entity: NormalizedEntity): TileCard {
  if (entity.domain === 'light') {
    return {
      type: 'tile',
      entity: entity.entityId,
      features: [{ type: 'light-brightness' }],
    }
  }
  if (entity.domain === 'cover') {
    return {
      type: 'tile',
      entity: entity.entityId,
      features: [{ type: 'cover-open-close' }],
    }
  }
  if (entity.domain === 'fan') {
    return {
      type: 'tile',
      entity: entity.entityId,
      features: [{ type: 'fan-speed' }],
    }
  }
  // switch, lock, vacuum, scene, script — plain tile, no features
  return { type: 'tile', entity: entity.entityId }
}
```

### 4. New fixtures

**`security-rich.ts`** — exterior + interior security install. ~38 entities, 4 areas (Front Entry, Back Yard, Garage, Hallway), 1 floor.

| Area | Entity mix |
| --- | --- |
| Front Entry | lock × 1, camera × 1, motion × 1, door × 1, light × 1, doorbell binary_sensor × 1 |
| Back Yard | camera × 2, motion × 2, light × 2, gate door binary_sensor × 1 |
| Garage | lock × 1, camera × 1, motion × 1, garage-door cover × 1, light × 1 |
| Hallway | motion × 2, smoke binary_sensor × 1, light × 1 |
| (no area) | 4 perimeter cameras, 2 hidden disabled motion sensors |

Exercises `lock → security`, `camera → cameras`, multiple cameras within one area (`Cameras` section has 2+ picture-entity cards), `cover → covers` (garage door).

**`vacuum-heavy.ts`** — whole-house cleaning bots. ~26 entities, 3 areas (Living Room, Kitchen, Hallway), 1 floor.

| Area | Entity mix |
| --- | --- |
| Living Room | vacuum × 1 (Roomba), mop bot × 1, motion × 1, light × 2, temp × 1 |
| Kitchen | vacuum × 1 (Robot K7), light × 2, motion × 1, temp × 1, humidity × 1 |
| Hallway | vacuum × 1 (Mini), motion × 2, light × 1 |
| (no area) | 6 vacuum diagnostic sensors, 2 hidden battery sensors |

Exercises `vacuum → vacuum` group with three different vacuums in three different rooms. The "mop bot" is also a `vacuum` domain entity (HA's vacuum domain covers all robot cleaners regardless of action type).

**`kitchen-sink.ts`** — smoke fixture for the full domain matrix. ~40 entities, 4 areas (Living Room, Master Bedroom, Kitchen, Front Door), 1 floor.

| Area | Entity mix |
| --- | --- |
| Living Room | media_player × 1, cover × 1 (blinds), camera × 1, light × 2, motion × 1, temp × 1 |
| Master Bedroom | media_player × 1 (speaker), cover × 1 (blackout), fan × 1, light × 2, motion × 1 |
| Kitchen | vacuum × 1, fan × 1 (range hood), media_player × 1, light × 2, temp × 1, humidity × 1 |
| Front Door | lock × 1, camera × 1, doorbell × 1, light × 1 |
| (no area) | 4 floating diagnostics, 2 hidden, 2 disabled |

Validates the full 6-domain matrix in a single snapshot. If any of the 6 mappings regresses, this fixture's snapshot diff surfaces it instantly.

## Data flow

No data-flow changes. The existing pipeline:

```
HA registries → normalize → findRoom → detect → groupByDomain → buildRoomView → buildLovelaceConfig
```

After P1b-2, more entities flow through the non-`other` groups in `groupByDomain`'s output, and `buildRoomView` produces additional non-error sections. The `buildLovelaceConfig` envelope is unchanged.

## Error handling

| Layer | Failure | Behavior |
| --- | --- | --- |
| `domainGroup()` | Unknown domain | Returns `'other'` (existing fallback). |
| `buildSection()` | New `DomainGroupKey` added without case | TypeScript compilation fails (exhaustive switch). |
| `GROUP_HEADINGS` | New `DomainGroupKey` added without heading | TypeScript compilation fails (`Record<DomainGroupKey, string>`). |
| `buildTileCard()` | Domain doesn't have explicit feature mapping | Returns plain tile (no features). Acceptable for switch / lock / vacuum / scene / script. |
| Fixture | Camera entity has no actual stream URL | `picture-entity` card renders HA's "no preview" placeholder; not our concern at generator level. |

The removal of the runtime `throw new Error('unsupported group key')` is intentional — TypeScript catches that case at compile time now.

## Testing

### `grouping.test.ts` — 6 new tests

Append to existing `describe('domainGroup', ...)`:

- `routes cover to covers`
- `routes media_player to media`
- `routes lock to security`
- `routes camera to cameras`
- `routes vacuum to vacuum`
- `routes fan to fans`

Each ~3 lines, mirrors the existing `it('routes light to lights', ...)` pattern.

### `room-view.test.ts` — ~10 new card-mapping tests

For each new domain:

- Cover group → tile cards with `[{ type: 'cover-open-close' }]` feature.
- Fan group → tile cards with `[{ type: 'fan-speed' }]` feature.
- Lock group → plain tile cards (no `features`).
- Vacuum group → plain tile cards.
- Media group → `media-control` cards, one per entity.
- Cameras group → `picture-entity` cards with `camera_view: 'live'`, one per entity.
- Section heading text matches `GROUP_HEADINGS` for each new group.

### Fixture structural tests (3 new files, ~10 tests each)

`security-rich.test.ts`, `vacuum-heavy.test.ts`, `kitchen-sink.test.ts` — each mirrors `czech-tidy.test.ts`:

- Total entity count in expected range.
- Area count matches.
- Every device + area + floor reference resolves.
- Hidden + disabled entries present.
- Contains expected domains (varies per fixture).

### Pipeline tests — extend existing fixture-driven blocks

`detect.fixtures.test.ts` — append a `describe` block per new fixture, asserting the same shape as existing english-cluttered / czech-tidy / german-massive blocks: misc bucket size, ≥85% canonical accuracy.

`grouping.fixtures.test.ts` — append per-fixture snapshot block via the existing `pipe()` helper. Snapshots populate on first run with `-u`; subsequent runs verify stability.

### Snapshot regeneration

Existing snapshots that shift when `domainGroup()` starts routing the new domains:

- `grouping.fixtures.test.ts` — english-cluttered, german-massive blocks.
- `room-view.fixtures.test.ts` — both english-cluttered + czech-tidy blocks (czech-tidy may not shift if no new domains in the fixture, but verify).
- `lovelace-config.fixtures.test.ts` — same.

Re-baseline all of them with `-u`, visually inspect the diffs, commit.

**Total new test count:** ~6 routing + ~10 card-mapping + ~30 fixture-structural (3 × 10) + 6 fixture-pipe blocks (2 × 3 fixtures) + several snapshot updates = ~52+ new test cases.

## File-by-file

| File | Action | Notes |
| --- | --- | --- |
| `packages/analyzer/src/grouping.ts` | Modify | 6 new explicit domain mappings in `domainGroup()` |
| `packages/analyzer/src/__tests__/grouping.test.ts` | Modify | 6 new routing tests |
| `packages/analyzer/src/__tests__/grouping.fixtures.test.ts` | Modify | snapshots regenerate; 3 new fixture blocks |
| `packages/analyzer/src/__tests__/detect.fixtures.test.ts` | Modify | 3 new fixture pipe blocks |
| `packages/generator/src/lovelace-types.ts` | Modify | 2 new card types, 2 new TileFeature variants |
| `packages/generator/src/room-view.ts` | Modify | GROUP_HEADINGS exhaustive; switch handles 6 new keys; buildTileCard adds cover/fan features |
| `packages/generator/src/index.ts` | Modify | re-export `MediaControlCard`, `PictureEntityCard` |
| `packages/generator/src/__tests__/room-view.test.ts` | Modify | ~10 new card-mapping tests |
| `packages/generator/src/__tests__/room-view.fixtures.test.ts` | Modify | snapshots regenerate |
| `packages/generator/src/__tests__/lovelace-config.fixtures.test.ts` | Modify | snapshots regenerate |
| `tests/fixtures/security-rich.ts` | Create | ~38 entities, 4 areas |
| `tests/fixtures/vacuum-heavy.ts` | Create | ~26 entities, 3 areas |
| `tests/fixtures/kitchen-sink.ts` | Create | ~40 entities, 4 areas |
| `tests/fixtures/__tests__/security-rich.test.ts` | Create | structural |
| `tests/fixtures/__tests__/vacuum-heavy.test.ts` | Create | structural |
| `tests/fixtures/__tests__/kitchen-sink.test.ts` | Create | structural |

## Open questions resolved during brainstorming

- **Fixture coverage for camera + vacuum (Q1):** C — spin up new fixtures rather than adding to existing.
- **How many new fixtures (Q1a):** A2 + A3 — three fixtures: `security-rich`, `vacuum-heavy`, `kitchen-sink`.
- **Picture-entity `camera_view`:** Always emit `'live'` for generated cards; type stays optional for external consumers.
- **`GROUP_HEADINGS` typing:** Tighten to exhaustive `Record<DomainGroupKey, string>`. Compile-time enforcement of "every key has a heading."
- **`buildSection()` `default` throw:** Remove. Switch becomes exhaustive over `DomainGroupKey`.

## Risks

- **Snapshot churn.** ~6 inline snapshots regenerate. Manual review of each diff is required to confirm the new shape is sensible (cover → covers, media_player → media, etc.) and not a regression elsewhere. Mitigation: regenerate one fixture at a time, verify diff, commit.
- **`picture-entity` rendering on missing camera streams.** If a user has a `camera.foo` entity but the underlying integration is broken, the card renders an empty placeholder. Acceptable — same behavior HA would have anyway.
- **HA `picture-entity` card schema drift.** HA could rename `camera_view` or add required fields. Stable API for now; P1b-2 ships HA's documented shape; future tickets adjust if HA changes.
- **Fan / cover feature compatibility.** `fan-speed` requires the fan entity to support `set_percentage` / `set_preset_mode` services. Most fans do. If not, the slider renders disabled — graceful degradation, not a generator concern.
- **Lock card without explicit features.** Plain tile cards for locks render lock/unlock buttons via HA's default tile state semantics. Acceptable for P1b-2; per-domain feature additions land in P1b-4 / P2.

## Acceptance

P1b-2 closes when:

- [ ] `domainGroup()` routes cover, media_player, lock, camera, vacuum, fan to their respective groups.
- [ ] `MediaControlCard` and `PictureEntityCard` types exported from `@lovelacer/generator`.
- [ ] `cover-open-close` and `fan-speed` `TileFeature` variants exported.
- [ ] `buildSection()` switch is exhaustive over `DomainGroupKey` (no runtime throw).
- [ ] `GROUP_HEADINGS` is `Record<DomainGroupKey, string>` (compile-time exhaustiveness).
- [ ] `buildTileCard()` attaches `cover-open-close` for covers and `fan-speed` for fans.
- [ ] Three new fixtures (`security-rich`, `vacuum-heavy`, `kitchen-sink`) ship with structural tests.
- [ ] Detect + grouping fixture-pipe tests cover the three new fixtures.
- [ ] Existing snapshot tests regenerated; new shape verified.
- [ ] `pnpm typecheck`, `pnpm -r test`, `pnpm format:check`, `pnpm lint` clean.
