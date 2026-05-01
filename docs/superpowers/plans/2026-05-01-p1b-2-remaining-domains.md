# P1b-2 Remaining Domains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire 6 reserved `DomainGroupKey` slots (covers, media, security, cameras, vacuum, fans) through to proper card mappings: cover/lock/vacuum/fan → tile (with domain-specific features), media_player → media-control, camera → picture-entity. Tighten `GROUP_HEADINGS` to an exhaustive `Record` for compile-time safety. Ship three new fixtures (`security-rich`, `vacuum-heavy`, `kitchen-sink`) that exercise the new mappings via the snapshot pipeline.

**Architecture:** Two new card types (`MediaControlCard`, `PictureEntityCard`) and two new `TileFeature` variants (`cover-open-close`, `fan-speed`) extend the discriminated `LovelaceCard` union. `domainGroup()` adds 6 explicit early-return checks. `GROUP_HEADINGS` becomes `Record<DomainGroupKey, string>` (was `Partial<...>`); `buildSection()`'s switch becomes exhaustive over the key, and the runtime `throw` goes away. `buildTileCard()` attaches the right feature per domain.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), Vitest (`globals: false`), the existing `tests/fixtures/_builder/` helpers.

**Spec reference:** [`docs/superpowers/specs/2026-05-01-p1b-2-remaining-domains-design.md`](../specs/2026-05-01-p1b-2-remaining-domains-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions even when importing TS source.
- Type-only imports use `import type { … } from '…'` (verbatimModuleSyntax).
- Tests use `import { describe, it, expect } from 'vitest'`.
- All commands run from worktree: `pnpm --dir <worktree>` and `git -C <worktree>`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- If husky's lint-staged or `pnpm format:check` reports drift, run `pnpm --dir <worktree> format`, re-stage, and retry.
- After each task, run `pnpm typecheck && pnpm -r test` to verify nothing regressed.

---

## Task 1: Add `MediaControlCard`, `PictureEntityCard`, and 2 new `TileFeature` variants

**Files:**
- Modify: `packages/generator/src/lovelace-types.ts`
- Modify: `packages/generator/src/index.ts`

Pure type additions. No runtime behavior changes. The new types compile cleanly because nothing emits them yet (Task 3 wires them up).

- [ ] **Step 1: Read the existing file**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/<worktree>/packages/generator/src/lovelace-types.ts
```

Find the `LovelaceCard` union and the `TileFeature` type alias.

- [ ] **Step 2: Extend `TileFeature` with two new variants**

Replace the existing `TileFeature` declaration in `lovelace-types.ts`:

```ts
export type TileFeature =
  | { type: 'light-brightness' }
  | { type: 'cover-open-close' }
  | { type: 'fan-speed' }
```

- [ ] **Step 3: Add the two new card interfaces**

Append to `lovelace-types.ts` (place them in the same section as the existing card interfaces, alphabetical or after the existing media/picture-related entries — whichever matches the existing convention; the file currently lists them after `GlanceCard`):

```ts
export interface MediaControlCard {
  type: 'media-control'
  entity: string
}

export interface PictureEntityCard {
  type: 'picture-entity'
  entity: string
  /** `live` streams the camera; `auto` shows a refreshing snapshot. */
  camera_view?: 'live' | 'auto'
}
```

- [ ] **Step 4: Extend the `LovelaceCard` discriminated union**

Find the `LovelaceCard` type declaration. Add `MediaControlCard` and `PictureEntityCard` to the union:

```ts
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

- [ ] **Step 5: Re-export from the package barrel**

Read `packages/generator/src/index.ts`. Find the `export type { … } from './lovelace-types.js'` block. Add `MediaControlCard` and `PictureEntityCard` (alphabetical with the others). The block becomes:

```ts
export type {
  EntitiesCard,
  GlanceCard,
  GridSection,
  HeadingCard,
  LovelaceCard,
  MarkdownCard,
  MediaControlCard,
  PictureEntityCard,
  RoomView,
  ThermostatCard,
  TileCard,
  TileFeature,
} from './lovelace-types.js'
```

- [ ] **Step 6: Verify typecheck**

```bash
pnpm --dir <worktree> typecheck
```

Expected: PASS. The new types compile; nothing emits them yet.

- [ ] **Step 7: Verify the broader build still passes**

```bash
pnpm --dir <worktree> -r test
```

Expected: PASS. No tests reference the new types yet.

- [ ] **Step 8: Commit**

```bash
git -C <worktree> add packages/generator/src/lovelace-types.ts \
        packages/generator/src/index.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(generator): add MediaControlCard, PictureEntityCard, and 2 new TileFeature variants

Pure type additions to extend the LovelaceCard discriminated union for
P1b-2's domain → card mappings. Two new interfaces:

- MediaControlCard: media_player → HA's `media-control` card
- PictureEntityCard: camera → HA's `picture-entity` card with optional
  camera_view ('live' | 'auto')

Two new TileFeature variants used by buildTileCard in Task 3:
- cover-open-close: open/close buttons on cover tiles
- fan-speed: speed slider on fan tiles

Re-exported from the package barrel alphabetically. No runtime behavior
yet — Task 3 wires the room-view switch to emit them.

P1b-2 layer 1 of 7 (card types).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extend `domainGroup()` routing + 6 new tests + regenerate analyzer fixture snapshots

**Files:**
- Modify: `packages/analyzer/src/grouping.ts`
- Modify: `packages/analyzer/src/__tests__/grouping.test.ts`
- Modify: `packages/analyzer/src/__tests__/grouping.fixtures.test.ts` (snapshot regeneration)

Adds 6 explicit early-return checks to `domainGroup()` for the new domains. The existing `routes P1b-only domains → other (cover, media_player, lock, camera, vacuum, fan)` test gets replaced with 6 specific positive-routing tests. Existing fixture snapshots in `english-cluttered` and `german-massive` will shift (those fixtures already have cover, media_player, lock, fan entities that previously bucketed into 'other').

- [ ] **Step 1: Replace the negative routing test with 6 positive ones**

Read `packages/analyzer/src/__tests__/grouping.test.ts` first. Find the existing test:

```ts
it('routes P1b-only domains → other (cover, media_player, lock, camera, vacuum, fan)', () => {
  for (const d of ['cover', 'media_player', 'lock', 'camera', 'vacuum', 'fan']) {
    expect(domainGroup({ ...baseEntity, domain: d })).toBe('other')
  }
})
```

Replace it with 6 positive routing tests (place them in order, before the `routes unknown domain → other` test):

```ts
it('routes cover → covers', () => {
  expect(domainGroup({ ...baseEntity, domain: 'cover' })).toBe('covers')
})

it('routes media_player → media', () => {
  expect(domainGroup({ ...baseEntity, domain: 'media_player' })).toBe('media')
})

it('routes lock → security', () => {
  expect(domainGroup({ ...baseEntity, domain: 'lock' })).toBe('security')
})

it('routes camera → cameras', () => {
  expect(domainGroup({ ...baseEntity, domain: 'camera' })).toBe('cameras')
})

it('routes vacuum → vacuum', () => {
  expect(domainGroup({ ...baseEntity, domain: 'vacuum' })).toBe('vacuum')
})

it('routes fan → fans', () => {
  expect(domainGroup({ ...baseEntity, domain: 'fan' })).toBe('fans')
})
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.test.ts -t 'routes'
```

Expected: 6 failures (each new test gets `'other'` instead of the new group). Existing tests still pass.

- [ ] **Step 3: Update `domainGroup()` to route the 6 new domains**

Read `packages/analyzer/src/grouping.ts`. Find the `domainGroup` function and replace its body:

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

- [ ] **Step 4: Run the routing tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.test.ts
```

Expected: PASS — all routing tests including the 6 new ones.

- [ ] **Step 5: Run all analyzer tests to find snapshot drift**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.fixtures.test.ts
```

Expected: FAILURES on the english-cluttered and german-massive snapshot tests — those fixtures have cover, media_player, lock, fan entities that previously landed in 'other' but now land in their proper groups, so the snapshot output shifts. The czech-tidy fixture has none of those domains; its snapshot should be unaffected.

- [ ] **Step 6: Regenerate analyzer fixture snapshots**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.fixtures.test.ts -u
```

Expected: PASS. The snapshots regenerate.

Open `packages/analyzer/src/__tests__/grouping.fixtures.test.ts` and inspect the diffs. Sanity-check:

- english-cluttered's Living Room block now has a `media` group (was missing — TV was in 'other').
- english-cluttered's Garage now has a `covers` group (garage door + Kitchen Blinds).
- english-cluttered's Office now has a `fans` group (Office Floor Fan).
- english-cluttered's Garage now has a `security` group (Side Door Lock).
- german-massive's Wohnzimmer now has a `media` group (Samsung TV).
- german-massive's Garage and Schlafzimmer now have `covers` groups.

If any of those expected-new groups DON'T appear, the routing change is broken; debug at the keyword-pattern level (Task 1) or the `domainGroup` switch.

- [ ] **Step 7: Re-run without `-u` to confirm stability**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.fixtures.test.ts
```

Expected: PASS — snapshots committed inline match the regenerated output.

- [ ] **Step 8: Run full analyzer suite + workspace tests**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
```

Expected: analyzer + shared green. Generator may now have failures (room-view.fixtures.test.ts, lovelace-config.fixtures.test.ts) because the routing changed but `room-view.ts`'s switch hasn't been updated to handle the 6 new keys yet — Task 3 fixes that. **For this commit, ALL non-generator tests must pass; generator failures from snapshot drift OR unhandled-key throws are expected and addressed in Task 3.**

If a generator test throws `Error: unsupported group key: covers` (or similar), that's the expected `buildSection` default-throw firing. It will be removed in Task 3.

- [ ] **Step 9: Commit**

```bash
git -C <worktree> add packages/analyzer/src/grouping.ts \
        packages/analyzer/src/__tests__/grouping.test.ts \
        packages/analyzer/src/__tests__/grouping.fixtures.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(analyzer): route cover/media_player/lock/camera/vacuum/fan to their groups

Six explicit early-return checks added to domainGroup() so the 6 P1b
domains stop landing in 'other'. Replace the previous negative test
('routes P1b-only domains → other') with 6 specific positive tests
(one per domain, asserting the expected group key).

Snapshot churn: english-cluttered + german-massive grouping.fixtures
snapshots regenerate. Visible new groups in those snapshots:
- english-cluttered: Living Room media (TV), Garage covers (door +
  Kitchen Blinds), Garage security (lock), Office fans (Floor Fan).
- german-massive: Wohnzimmer media (Samsung TV), Garage covers (Tor),
  Schlafzimmer covers (Rollladen).
- czech-tidy unchanged (no P1b-domain entities).

Generator's room-view will throw `unsupported group key: covers` until
Task 3 extends its switch — that lands in the next commit.

P1b-2 layer 2 of 7 (analyzer routing).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Make `room-view.ts` exhaustive over `DomainGroupKey` + ~10 card-mapping tests + regenerate generator snapshots

**Files:**
- Modify: `packages/generator/src/room-view.ts`
- Modify: `packages/generator/src/__tests__/room-view.test.ts`
- Modify: `packages/generator/src/__tests__/room-view.fixtures.test.ts` (snapshot regeneration)
- Modify: `packages/generator/src/__tests__/lovelace-config.fixtures.test.ts` (snapshot regeneration)

`GROUP_HEADINGS` becomes an exhaustive `Record<DomainGroupKey, string>`. `buildSection`'s switch handles all 11 keys (no default-throw). `buildTileCard` attaches `cover-open-close` for covers and `fan-speed` for fans. New unit tests pin each card-mapping behavior.

- [ ] **Step 1: Read the existing file**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/<worktree>/packages/generator/src/room-view.ts
```

- [ ] **Step 2: Tighten `GROUP_HEADINGS` to exhaustive `Record`**

Replace the existing `GROUP_HEADINGS` constant in `room-view.ts`:

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

The type tightens from `Partial<Record<DomainGroupKey, string>>` to `Record<DomainGroupKey, string>`. TypeScript fails compilation if `DomainGroupKey` ever grows a new key without a heading.

- [ ] **Step 3: Replace `buildSection()` with the exhaustive switch**

Find `buildSection`. Replace its entire body:

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

The `default: throw new Error('unsupported group key: ...')` is removed. The switch is exhaustive over `DomainGroupKey`; TypeScript will fail compilation if a key is missed.

If TypeScript complains about non-exhaustive switch, double-check the `case 'climate':` is on its own (separate from the tile-bucket fall-throughs).

- [ ] **Step 4: Extend `buildTileCard()` with cover + fan features**

Find `buildTileCard`. Replace its body:

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

- [ ] **Step 5: Verify typecheck (catches non-exhaustive switch)**

```bash
pnpm --dir <worktree> typecheck
```

Expected: PASS. If TypeScript complains "Type 'string' is not assignable to type 'never'" inside the switch, the switch isn't exhaustive — re-check that all 11 `DomainGroupKey` cases are handled.

- [ ] **Step 6: Add card-mapping unit tests**

Read `packages/generator/src/__tests__/room-view.test.ts`. Find the existing `describe('buildRoomView — environment / activity / other groups', ...)` block and append new describe blocks below it. Add the following tests verbatim (before the file's closing brace, after the existing group tests):

```ts
describe('buildRoomView — covers group', () => {
  it('produces heading + tile per cover with cover-open-close feature', () => {
    const grouping: RoomGrouping = {
      roomId: 'living_room',
      groups: [
        {
          key: 'covers',
          entities: [
            makeEntity('cover.kitchen_blinds', 'cover'),
            makeEntity('cover.bedroom_curtains', 'cover'),
          ],
        },
      ],
    }
    const view = buildRoomView(grouping)
    const section = view.sections[0]!
    expect(section.cards[0]).toEqual({ type: 'heading', heading: 'Covers' })
    expect(section.cards[1]).toEqual({
      type: 'tile',
      entity: 'cover.kitchen_blinds',
      features: [{ type: 'cover-open-close' }],
    })
    expect(section.cards[2]).toEqual({
      type: 'tile',
      entity: 'cover.bedroom_curtains',
      features: [{ type: 'cover-open-close' }],
    })
  })
})

describe('buildRoomView — fans group', () => {
  it('produces heading + tile per fan with fan-speed feature', () => {
    const grouping: RoomGrouping = {
      roomId: 'bedroom',
      groups: [
        {
          key: 'fans',
          entities: [makeEntity('fan.ceiling_fan', 'fan')],
        },
      ],
    }
    const view = buildRoomView(grouping)
    const section = view.sections[0]!
    expect(section.cards[0]).toEqual({ type: 'heading', heading: 'Fans' })
    expect(section.cards[1]).toEqual({
      type: 'tile',
      entity: 'fan.ceiling_fan',
      features: [{ type: 'fan-speed' }],
    })
  })
})

describe('buildRoomView — security group (lock)', () => {
  it('produces heading + plain tile per lock (no features)', () => {
    const grouping: RoomGrouping = {
      roomId: 'hallway',
      groups: [
        {
          key: 'security',
          entities: [makeEntity('lock.front_door', 'lock')],
        },
      ],
    }
    const view = buildRoomView(grouping)
    const section = view.sections[0]!
    expect(section.cards[0]).toEqual({ type: 'heading', heading: 'Security' })
    expect(section.cards[1]).toEqual({
      type: 'tile',
      entity: 'lock.front_door',
    })
  })
})

describe('buildRoomView — vacuum group', () => {
  it('produces heading + plain tile per vacuum (no features)', () => {
    const grouping: RoomGrouping = {
      roomId: 'living_room',
      groups: [
        {
          key: 'vacuum',
          entities: [makeEntity('vacuum.roomba', 'vacuum')],
        },
      ],
    }
    const view = buildRoomView(grouping)
    const section = view.sections[0]!
    expect(section.cards[0]).toEqual({ type: 'heading', heading: 'Vacuum' })
    expect(section.cards[1]).toEqual({
      type: 'tile',
      entity: 'vacuum.roomba',
    })
  })
})

describe('buildRoomView — media group', () => {
  it('produces heading + media-control card per media_player', () => {
    const grouping: RoomGrouping = {
      roomId: 'living_room',
      groups: [
        {
          key: 'media',
          entities: [
            makeEntity('media_player.tv', 'media_player'),
            makeEntity('media_player.speaker', 'media_player'),
          ],
        },
      ],
    }
    const view = buildRoomView(grouping)
    const section = view.sections[0]!
    expect(section.cards[0]).toEqual({ type: 'heading', heading: 'Media' })
    expect(section.cards[1]).toEqual({
      type: 'media-control',
      entity: 'media_player.tv',
    })
    expect(section.cards[2]).toEqual({
      type: 'media-control',
      entity: 'media_player.speaker',
    })
  })
})

describe('buildRoomView — cameras group', () => {
  it('produces heading + picture-entity card per camera with camera_view: live', () => {
    const grouping: RoomGrouping = {
      roomId: 'misc',
      groups: [
        {
          key: 'cameras',
          entities: [
            makeEntity('camera.front_door', 'camera'),
            makeEntity('camera.back_yard', 'camera'),
          ],
        },
      ],
    }
    const view = buildRoomView(grouping)
    const section = view.sections[0]!
    expect(section.cards[0]).toEqual({ type: 'heading', heading: 'Cameras' })
    expect(section.cards[1]).toEqual({
      type: 'picture-entity',
      entity: 'camera.front_door',
      camera_view: 'live',
    })
    expect(section.cards[2]).toEqual({
      type: 'picture-entity',
      entity: 'camera.back_yard',
      camera_view: 'live',
    })
  })
})
```

If `makeEntity` doesn't yet accept a domain argument in `room-view.test.ts`, look at the existing helper at the top of the file. The existing helper signature is something like `function makeEntity(entityId: string, domain?: string): NormalizedEntity`. Use it the same way.

- [ ] **Step 7: Run the new room-view tests**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/room-view.test.ts
```

Expected: PASS — all card-mapping tests including the 6 new groups.

- [ ] **Step 8: Run room-view.fixtures + lovelace-config.fixtures snapshot tests**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/room-view.fixtures.test.ts
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/lovelace-config.fixtures.test.ts
```

Expected: FAILURES on snapshot mismatches for english-cluttered + german-massive (analyzer's grouping changed in Task 2; the generator now produces additional non-`other` cards for those fixtures). czech-tidy should be unaffected.

- [ ] **Step 9: Regenerate the snapshots**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/room-view.fixtures.test.ts -u
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/lovelace-config.fixtures.test.ts -u
```

Expected: PASS. Open both files and inspect the diffs. Sanity-check:

- english-cluttered's Living Room view now has a `Media` section with `media-control` cards for the TV.
- english-cluttered's Garage view has `Covers` (with `cover-open-close` features), `Security` (lock as plain tile).
- english-cluttered's Office view has `Fans` (with `fan-speed` feature).
- german-massive's Wohnzimmer has `Media` for the Samsung TV.
- german-massive's Garage + Schlafzimmer have `Covers`.

- [ ] **Step 10: Re-run without `-u` to confirm stability**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/room-view.fixtures.test.ts
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/lovelace-config.fixtures.test.ts
```

Expected: PASS.

- [ ] **Step 11: Run full workspace tests**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
```

Expected: all green.

- [ ] **Step 12: Commit**

```bash
git -C <worktree> add packages/generator/src/room-view.ts \
        packages/generator/src/__tests__/room-view.test.ts \
        packages/generator/src/__tests__/room-view.fixtures.test.ts \
        packages/generator/src/__tests__/lovelace-config.fixtures.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(generator): card mappings for cover/media_player/lock/camera/vacuum/fan

Three changes to room-view.ts wire the 6 new domain groups end-to-end:

- GROUP_HEADINGS tightens from Partial<Record<...>> to exhaustive
  Record<DomainGroupKey, string>. TypeScript now fails compilation if
  a new key gets added without a heading.

- buildSection() switch handles all 11 keys explicitly. The runtime
  `throw new Error('unsupported group key')` is gone — the switch is
  exhaustive over DomainGroupKey.

- buildTileCard() attaches cover-open-close for covers and fan-speed
  for fans. Switch/lock/vacuum/scene/script remain plain tiles.

Six new card-mapping unit tests pin the exact card shape per group.
Snapshot regeneration: english-cluttered + german-massive shift in
both room-view.fixtures and lovelace-config.fixtures. Visible
additions: Media sections (media-control cards), Covers (tiles with
cover-open-close), Security (lock tiles), Fans (tiles with fan-speed).

P1b-2 layer 3 of 7 (generator card mappings).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `security-rich` fixture + structural test

**Files:**
- Create: `tests/fixtures/security-rich.ts`
- Create: `tests/fixtures/__tests__/security-rich.test.ts`

Exterior + interior security install. ~38 entities, 4 areas (Front Entry, Back Yard, Garage, Hallway), 1 floor.

- [ ] **Step 1: Read `czech-tidy.ts` for the fixture pattern**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/<worktree>/tests/fixtures/czech-tidy.ts
```

Note the structure: imports → constants → floor/area declarations → device declarations → per-room entity arrays → final `fixture({...})` export.

- [ ] **Step 2: Create the fixture file**

Create `tests/fixtures/security-rich.ts` with this exact content:

```ts
import {
  area,
  device,
  door,
  fixture,
  floor,
  light,
  motion,
  registryEntry,
} from './_builder/index.js'

const FX = 'security-rich'

const ground = floor('Ground', { level: 0, icon: 'mdi:home-floor-g' })

const frontEntry = area('Front Entry', { floor: ground.id, icon: 'mdi:door' })
const backYard = area('Back Yard', { floor: ground.id, icon: 'mdi:flower-tulip' })
const garage = area('Garage', { floor: ground.id, icon: 'mdi:garage-variant' })
const hallway = area('Hallway', { floor: ground.id, icon: 'mdi:door' })

const frontHue = device('Front Entry Hue', { manufacturer: 'Philips', area: frontEntry.id })
const frontSchlage = device('Front Door Schlage', { manufacturer: 'Schlage', area: frontEntry.id })
const frontReolink = device('Front Door Reolink', { manufacturer: 'Reolink', area: frontEntry.id })

const backReolink = device('Back Yard Reolink', { manufacturer: 'Reolink', area: backYard.id })
const backHue = device('Back Yard Hue', { manufacturer: 'Philips', area: backYard.id })

const garageSchlage = device('Garage Schlage', { manufacturer: 'Schlage', area: garage.id })
const garageReolink = device('Garage Reolink', { manufacturer: 'Reolink', area: garage.id })
const garageOpener = device('Garage Door Opener', { manufacturer: 'Chamberlain', area: garage.id })

const hallwayHue = device('Hallway Hue', { manufacturer: 'Philips', area: hallway.id })

const perimeterReolink1 = device('Perimeter Reolink 1', { manufacturer: 'Reolink' })
const perimeterReolink2 = device('Perimeter Reolink 2', { manufacturer: 'Reolink' })

const frontEntryEntities = [
  registryEntry(FX, 'lock', 'Front Door Lock', { area: frontEntry.id, device: frontSchlage.id }),
  registryEntry(FX, 'camera', 'Front Door Camera', {
    area: frontEntry.id,
    device: frontReolink.id,
  }),
  motion(FX, 'Front Entry Motion', { area: frontEntry.id }),
  door(FX, 'Front Door Sensor', { area: frontEntry.id }),
  light(FX, 'Front Porch Light', { area: frontEntry.id, device: frontHue.id }),
  registryEntry(FX, 'binary_sensor', 'Front Doorbell', {
    area: frontEntry.id,
    deviceClass: 'occupancy',
  }),
]

const backYardEntities = [
  registryEntry(FX, 'camera', 'Back Yard Camera North', {
    area: backYard.id,
    device: backReolink.id,
  }),
  registryEntry(FX, 'camera', 'Back Yard Camera South', {
    area: backYard.id,
    device: backReolink.id,
  }),
  motion(FX, 'Back Yard Motion North', { area: backYard.id }),
  motion(FX, 'Back Yard Motion South', { area: backYard.id }),
  light(FX, 'Back Yard Flood Light 1', { area: backYard.id, device: backHue.id }),
  light(FX, 'Back Yard Flood Light 2', { area: backYard.id, device: backHue.id }),
  door(FX, 'Back Yard Gate', { area: backYard.id }),
]

const garageEntities = [
  registryEntry(FX, 'lock', 'Garage Side Door Lock', { area: garage.id, device: garageSchlage.id }),
  registryEntry(FX, 'camera', 'Garage Camera', { area: garage.id, device: garageReolink.id }),
  motion(FX, 'Garage Motion', { area: garage.id }),
  registryEntry(FX, 'cover', 'Garage Door', { area: garage.id, device: garageOpener.id }),
  light(FX, 'Garage Light', { area: garage.id }),
]

const hallwayEntities = [
  motion(FX, 'Hallway Motion 1', { area: hallway.id }),
  motion(FX, 'Hallway Motion 2', { area: hallway.id }),
  registryEntry(FX, 'binary_sensor', 'Hallway Smoke Detector', {
    area: hallway.id,
    deviceClass: 'smoke',
  }),
  light(FX, 'Hallway Light', { area: hallway.id, device: hallwayHue.id }),
]

const floatingEntities = [
  registryEntry(FX, 'camera', 'Perimeter Camera North', { device: perimeterReolink1.id }),
  registryEntry(FX, 'camera', 'Perimeter Camera South', { device: perimeterReolink1.id }),
  registryEntry(FX, 'camera', 'Perimeter Camera East', { device: perimeterReolink2.id }),
  registryEntry(FX, 'camera', 'Perimeter Camera West', { device: perimeterReolink2.id }),
  motion(FX, 'Disabled Old PIR 1', { hidden: true }),
  motion(FX, 'Disabled Old PIR 2', { disabled: true }),
]

export const securityRich = fixture({
  meta: {
    name: 'security-rich',
    description:
      '~38 entities across 4 areas (Front Entry, Back Yard, Garage, ' +
      'Hallway). Security-themed install with locks, cameras, motion + door ' +
      'sensors, plus 4 perimeter cameras with no area_id. Validates the new ' +
      'lock → security and camera → cameras card mappings, and exercises ' +
      'multiple cameras within a single area.',
  },
  floors: [ground],
  areas: [frontEntry, backYard, garage, hallway],
  devices: [
    frontHue,
    frontSchlage,
    frontReolink,
    backReolink,
    backHue,
    garageSchlage,
    garageReolink,
    garageOpener,
    hallwayHue,
    perimeterReolink1,
    perimeterReolink2,
  ],
  entities: [
    ...frontEntryEntities,
    ...backYardEntities,
    ...garageEntities,
    ...hallwayEntities,
    ...floatingEntities,
  ],
})
```

- [ ] **Step 3: Verify the fixture compiles**

```bash
pnpm --dir <worktree> typecheck
```

Expected: PASS.

- [ ] **Step 4: Create the structural test**

Create `tests/fixtures/__tests__/security-rich.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { securityRich } from '../security-rich.js'

const fx = securityRich

describe('security-rich fixture', () => {
  it('has four rooms (areas)', () => {
    expect(fx.areas).toHaveLength(4)
  })

  it('has between 30 and 45 entities', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(30)
    expect(fx.entities.length).toBeLessThanOrEqual(45)
  })

  it('declares one floor (Ground)', () => {
    expect(fx.floors).toHaveLength(1)
    expect(fx.floors[0]!.name).toBe('Ground')
  })

  it('all expected security area names present', () => {
    const names = fx.areas.map((a) => a.name)
    expect(names).toContain('Front Entry')
    expect(names).toContain('Back Yard')
    expect(names).toContain('Garage')
    expect(names).toContain('Hallway')
  })

  it('contains lock, camera, cover, light, binary_sensor domains', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['lock', 'camera', 'cover', 'light', 'binary_sensor'] as const) {
      expect(domains).toContain(d)
    }
  })

  it('has at least 5 cameras', () => {
    const cameras = fx.entities.filter((e) => e.domain === 'camera').length
    expect(cameras).toBeGreaterThanOrEqual(5)
  })

  it('has at least 2 locks', () => {
    const locks = fx.entities.filter((e) => e.domain === 'lock').length
    expect(locks).toBeGreaterThanOrEqual(2)
  })

  it('has at least 1 hidden entity', () => {
    expect(fx.entities.some((e) => e.hidden)).toBe(true)
  })

  it('has at least 1 disabled entity', () => {
    expect(fx.entities.some((e) => e.disabled)).toBe(true)
  })

  it('every entity referencing a device points at an existing device', () => {
    const deviceIds = new Set(fx.devices.map((d) => d.id))
    for (const e of fx.entities) {
      if (e.device !== null) {
        expect(deviceIds).toContain(e.device)
      }
    }
  })
})
```

- [ ] **Step 5: Run the structural test**

```bash
pnpm --dir <worktree> vitest run tests/fixtures/__tests__/security-rich.test.ts
```

Expected: PASS — about 10 tests.

- [ ] **Step 6: Run full workspace tests**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
```

Both green.

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add tests/fixtures/security-rich.ts \
        tests/fixtures/__tests__/security-rich.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(fixtures): security-rich — locks + cameras + motion sensors

~38 entities across Front Entry, Back Yard, Garage, Hallway. Security-
themed install: 7 cameras (3 area-attributed + 4 perimeter), 2 locks
(front + garage side door), 1 cover (garage door), motion + door
sensors throughout. Plus 1 hidden + 1 disabled motion sensor for
filter testing.

Validates the new lock → security and camera → cameras card mappings
in P1b-2 Task 3. Multiple cameras within Back Yard exercise the
"section with N picture-entity cards" path.

P1b-2 layer 4 of 7 (security-rich fixture).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `vacuum-heavy` fixture + structural test

**Files:**
- Create: `tests/fixtures/vacuum-heavy.ts`
- Create: `tests/fixtures/__tests__/vacuum-heavy.test.ts`

Whole-house cleaning bots install. ~26 entities, 3 areas (Living Room, Kitchen, Hallway), 1 floor.

- [ ] **Step 1: Create the fixture file**

Create `tests/fixtures/vacuum-heavy.ts`:

```ts
import {
  area,
  device,
  fixture,
  floor,
  humiditySensor,
  light,
  motion,
  registryEntry,
  tempSensor,
} from './_builder/index.js'

const FX = 'vacuum-heavy'

const ground = floor('Ground', { level: 0, icon: 'mdi:home-floor-g' })

const livingRoom = area('Living Room', { floor: ground.id, icon: 'mdi:sofa' })
const kitchen = area('Kitchen', { floor: ground.id, icon: 'mdi:silverware-fork-knife' })
const hallway = area('Hallway', { floor: ground.id, icon: 'mdi:door' })

const lrIRobot = device('Living Room iRobot', { manufacturer: 'iRobot', area: livingRoom.id })
const lrEcovacs = device('Living Room Ecovacs', { manufacturer: 'Ecovacs', area: livingRoom.id })
const lrHue = device('Living Room Hue', { manufacturer: 'Philips', area: livingRoom.id })

const kitchenRoborock = device('Kitchen Roborock', { manufacturer: 'Roborock', area: kitchen.id })
const kitchenHue = device('Kitchen Hue', { manufacturer: 'Philips', area: kitchen.id })

const hallwayDreame = device('Hallway Dreame', { manufacturer: 'Dreame', area: hallway.id })
const hallwayHue = device('Hallway Hue', { manufacturer: 'Philips', area: hallway.id })

const livingRoomEntities = [
  registryEntry(FX, 'vacuum', 'Living Room Roomba', {
    area: livingRoom.id,
    device: lrIRobot.id,
  }),
  registryEntry(FX, 'vacuum', 'Living Room Mop Bot', {
    area: livingRoom.id,
    device: lrEcovacs.id,
  }),
  motion(FX, 'Living Room Motion', { area: livingRoom.id }),
  light(FX, 'Living Room Ceiling Light', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Living Room Floor Lamp', { area: livingRoom.id, device: lrHue.id }),
  tempSensor(FX, 'Living Room Temperature', { area: livingRoom.id }),
]

const kitchenEntities = [
  registryEntry(FX, 'vacuum', 'Kitchen Robot K7', { area: kitchen.id, device: kitchenRoborock.id }),
  light(FX, 'Kitchen Ceiling Light', { area: kitchen.id, device: kitchenHue.id }),
  light(FX, 'Kitchen Counter Light', { area: kitchen.id, device: kitchenHue.id }),
  motion(FX, 'Kitchen Motion', { area: kitchen.id }),
  tempSensor(FX, 'Kitchen Temperature', { area: kitchen.id }),
  humiditySensor(FX, 'Kitchen Humidity', { area: kitchen.id }),
]

const hallwayEntities = [
  registryEntry(FX, 'vacuum', 'Hallway Mini Bot', { area: hallway.id, device: hallwayDreame.id }),
  motion(FX, 'Hallway Motion 1', { area: hallway.id }),
  motion(FX, 'Hallway Motion 2', { area: hallway.id }),
  light(FX, 'Hallway Light', { area: hallway.id, device: hallwayHue.id }),
]

const floatingEntities = [
  registryEntry(FX, 'sensor', 'Roomba Battery', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Roomba Error Count', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Roborock Battery', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Roborock Cleaning Time', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Dreame Battery', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Ecovacs Mop Status', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Old Vacuum Battery 1', { hidden: true }),
  registryEntry(FX, 'sensor', 'Old Vacuum Battery 2', { hidden: true }),
]

export const vacuumHeavy = fixture({
  meta: {
    name: 'vacuum-heavy',
    description:
      '~26 entities across Living Room, Kitchen, Hallway with 4 vacuum ' +
      'entities (Roomba, mop bot, Roborock, Dreame mini). 6 floating ' +
      'diagnostic battery + status sensors and 2 hidden legacy battery ' +
      'sensors round it out. Validates vacuum → vacuum group routing and ' +
      'that diagnostic + hidden vacuum sensors stay out of the visible ' +
      'grouping output.',
  },
  floors: [ground],
  areas: [livingRoom, kitchen, hallway],
  devices: [lrIRobot, lrEcovacs, lrHue, kitchenRoborock, kitchenHue, hallwayDreame, hallwayHue],
  entities: [
    ...livingRoomEntities,
    ...kitchenEntities,
    ...hallwayEntities,
    ...floatingEntities,
  ],
})
```

- [ ] **Step 2: Verify the fixture compiles**

```bash
pnpm --dir <worktree> typecheck
```

Expected: PASS.

- [ ] **Step 3: Create the structural test**

Create `tests/fixtures/__tests__/vacuum-heavy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { vacuumHeavy } from '../vacuum-heavy.js'

const fx = vacuumHeavy

describe('vacuum-heavy fixture', () => {
  it('has three rooms (areas)', () => {
    expect(fx.areas).toHaveLength(3)
  })

  it('has between 22 and 32 entities', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(22)
    expect(fx.entities.length).toBeLessThanOrEqual(32)
  })

  it('declares one floor (Ground)', () => {
    expect(fx.floors).toHaveLength(1)
    expect(fx.floors[0]!.name).toBe('Ground')
  })

  it('all expected area names present', () => {
    const names = fx.areas.map((a) => a.name)
    expect(names).toContain('Living Room')
    expect(names).toContain('Kitchen')
    expect(names).toContain('Hallway')
  })

  it('contains vacuum, light, sensor, binary_sensor domains', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['vacuum', 'light', 'sensor', 'binary_sensor'] as const) {
      expect(domains).toContain(d)
    }
  })

  it('has at least 4 vacuums', () => {
    const vacuums = fx.entities.filter((e) => e.domain === 'vacuum').length
    expect(vacuums).toBeGreaterThanOrEqual(4)
  })

  it('has at least 4 diagnostic sensors', () => {
    const diagnostic = fx.entities.filter((e) => e.entityCategory === 'diagnostic').length
    expect(diagnostic).toBeGreaterThanOrEqual(4)
  })

  it('has at least 1 hidden entity', () => {
    expect(fx.entities.some((e) => e.hidden)).toBe(true)
  })

  it('every entity referencing a device points at an existing device', () => {
    const deviceIds = new Set(fx.devices.map((d) => d.id))
    for (const e of fx.entities) {
      if (e.device !== null) {
        expect(deviceIds).toContain(e.device)
      }
    }
  })
})
```

- [ ] **Step 4: Run the structural test**

```bash
pnpm --dir <worktree> vitest run tests/fixtures/__tests__/vacuum-heavy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add tests/fixtures/vacuum-heavy.ts \
        tests/fixtures/__tests__/vacuum-heavy.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(fixtures): vacuum-heavy — multiple cleaning bots across rooms

~26 entities across Living Room, Kitchen, Hallway. Four vacuums in
three rooms (Roomba, Ecovacs mop bot, Roborock K7, Dreame mini), plus
6 floating diagnostic battery + status sensors and 2 hidden legacy
battery sensors.

Validates vacuum → vacuum group routing in three different rooms.
Diagnostic and hidden sensors verify they're filtered out of the
visible grouping output (existing behavior, regression-tested here).

P1b-2 layer 5 of 7 (vacuum-heavy fixture).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `kitchen-sink` fixture + structural test

**Files:**
- Create: `tests/fixtures/kitchen-sink.ts`
- Create: `tests/fixtures/__tests__/kitchen-sink.test.ts`

Smoke fixture — at least one entity from each of the 6 new domains in the same install. ~40 entities, 4 areas, 1 floor.

- [ ] **Step 1: Create the fixture file**

Create `tests/fixtures/kitchen-sink.ts`:

```ts
import {
  area,
  device,
  fixture,
  floor,
  humiditySensor,
  light,
  motion,
  registryEntry,
  tempSensor,
} from './_builder/index.js'

const FX = 'kitchen-sink'

const ground = floor('Ground', { level: 0, icon: 'mdi:home-floor-g' })

const livingRoom = area('Living Room', { floor: ground.id, icon: 'mdi:sofa' })
const masterBedroom = area('Master Bedroom', { floor: ground.id, icon: 'mdi:bed' })
const kitchen = area('Kitchen', { floor: ground.id, icon: 'mdi:silverware-fork-knife' })
const frontDoor = area('Front Door', { floor: ground.id, icon: 'mdi:door' })

const lrSamsung = device('Living Room Samsung TV', { manufacturer: 'Samsung', area: livingRoom.id })
const lrShelly = device('Living Room Shelly Blinds', { manufacturer: 'Shelly', area: livingRoom.id })
const lrReolink = device('Living Room Reolink', { manufacturer: 'Reolink', area: livingRoom.id })
const lrHue = device('Living Room Hue', { manufacturer: 'Philips', area: livingRoom.id })

const mbSonos = device('Master Bedroom Sonos', { manufacturer: 'Sonos', area: masterBedroom.id })
const mbShelly = device('Master Bedroom Shelly Blinds', {
  manufacturer: 'Shelly',
  area: masterBedroom.id,
})
const mbHue = device('Master Bedroom Hue', { manufacturer: 'Philips', area: masterBedroom.id })

const kRoborock = device('Kitchen Roborock', { manufacturer: 'Roborock', area: kitchen.id })
const kSonos = device('Kitchen Sonos', { manufacturer: 'Sonos', area: kitchen.id })
const kHue = device('Kitchen Hue', { manufacturer: 'Philips', area: kitchen.id })

const fdSchlage = device('Front Door Schlage', { manufacturer: 'Schlage', area: frontDoor.id })
const fdReolink = device('Front Door Reolink', { manufacturer: 'Reolink', area: frontDoor.id })
const fdHue = device('Front Door Hue', { manufacturer: 'Philips', area: frontDoor.id })

const livingRoomEntities = [
  registryEntry(FX, 'media_player', 'Living Room Samsung TV', {
    area: livingRoom.id,
    device: lrSamsung.id,
  }),
  registryEntry(FX, 'cover', 'Living Room Blinds', {
    area: livingRoom.id,
    device: lrShelly.id,
  }),
  registryEntry(FX, 'camera', 'Living Room Camera', {
    area: livingRoom.id,
    device: lrReolink.id,
  }),
  light(FX, 'Living Room Ceiling Light', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Living Room Floor Lamp', { area: livingRoom.id, device: lrHue.id }),
  motion(FX, 'Living Room Motion', { area: livingRoom.id }),
  tempSensor(FX, 'Living Room Temperature', { area: livingRoom.id }),
]

const masterBedroomEntities = [
  registryEntry(FX, 'media_player', 'Master Bedroom Speaker', {
    area: masterBedroom.id,
    device: mbSonos.id,
  }),
  registryEntry(FX, 'cover', 'Master Bedroom Blackout Blinds', {
    area: masterBedroom.id,
    device: mbShelly.id,
  }),
  registryEntry(FX, 'fan', 'Master Bedroom Ceiling Fan', { area: masterBedroom.id }),
  light(FX, 'Master Bedroom Ceiling Light', { area: masterBedroom.id, device: mbHue.id }),
  light(FX, 'Master Bedroom Bedside Light', { area: masterBedroom.id, device: mbHue.id }),
  motion(FX, 'Master Bedroom Motion', { area: masterBedroom.id }),
]

const kitchenEntities = [
  registryEntry(FX, 'vacuum', 'Kitchen Roborock', { area: kitchen.id, device: kRoborock.id }),
  registryEntry(FX, 'fan', 'Kitchen Range Hood', { area: kitchen.id }),
  registryEntry(FX, 'media_player', 'Kitchen Sonos', { area: kitchen.id, device: kSonos.id }),
  light(FX, 'Kitchen Ceiling Light', { area: kitchen.id, device: kHue.id }),
  light(FX, 'Kitchen Counter Light', { area: kitchen.id, device: kHue.id }),
  tempSensor(FX, 'Kitchen Temperature', { area: kitchen.id }),
  humiditySensor(FX, 'Kitchen Humidity', { area: kitchen.id }),
]

const frontDoorEntities = [
  registryEntry(FX, 'lock', 'Front Door Lock', { area: frontDoor.id, device: fdSchlage.id }),
  registryEntry(FX, 'camera', 'Front Door Camera', { area: frontDoor.id, device: fdReolink.id }),
  registryEntry(FX, 'binary_sensor', 'Front Doorbell', {
    area: frontDoor.id,
    deviceClass: 'occupancy',
  }),
  light(FX, 'Front Porch Light', { area: frontDoor.id, device: fdHue.id }),
]

const floatingEntities = [
  registryEntry(FX, 'sensor', 'Hue Bridge Uptime', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Sonos Connection Quality', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Reolink Stream Bitrate', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Roborock Battery', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Hidden Battery 1', { hidden: true }),
  registryEntry(FX, 'sensor', 'Hidden Battery 2', { hidden: true }),
  registryEntry(FX, 'switch', 'Disabled Old Plug 1', { disabled: true }),
  registryEntry(FX, 'switch', 'Disabled Old Plug 2', { disabled: true }),
]

export const kitchenSink = fixture({
  meta: {
    name: 'kitchen-sink',
    description:
      '~40 entities across 4 areas. Smoke fixture for the full P1b-2 ' +
      'domain matrix: every new domain (cover, media_player, lock, camera, ' +
      'vacuum, fan) appears in at least one area. Validates that all 6 new ' +
      'card mappings work together in a single install.',
  },
  floors: [ground],
  areas: [livingRoom, masterBedroom, kitchen, frontDoor],
  devices: [
    lrSamsung,
    lrShelly,
    lrReolink,
    lrHue,
    mbSonos,
    mbShelly,
    mbHue,
    kRoborock,
    kSonos,
    kHue,
    fdSchlage,
    fdReolink,
    fdHue,
  ],
  entities: [
    ...livingRoomEntities,
    ...masterBedroomEntities,
    ...kitchenEntities,
    ...frontDoorEntities,
    ...floatingEntities,
  ],
})
```

- [ ] **Step 2: Verify the fixture compiles**

```bash
pnpm --dir <worktree> typecheck
```

Expected: PASS.

- [ ] **Step 3: Create the structural test**

Create `tests/fixtures/__tests__/kitchen-sink.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { kitchenSink } from '../kitchen-sink.js'

const fx = kitchenSink

describe('kitchen-sink fixture', () => {
  it('has four rooms (areas)', () => {
    expect(fx.areas).toHaveLength(4)
  })

  it('has between 35 and 50 entities', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(35)
    expect(fx.entities.length).toBeLessThanOrEqual(50)
  })

  it('declares one floor (Ground)', () => {
    expect(fx.floors).toHaveLength(1)
    expect(fx.floors[0]!.name).toBe('Ground')
  })

  it('all expected area names present', () => {
    const names = fx.areas.map((a) => a.name)
    expect(names).toContain('Living Room')
    expect(names).toContain('Master Bedroom')
    expect(names).toContain('Kitchen')
    expect(names).toContain('Front Door')
  })

  it('contains every P1b-2 new domain (cover, media_player, lock, camera, vacuum, fan)', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['cover', 'media_player', 'lock', 'camera', 'vacuum', 'fan'] as const) {
      expect(domains, `expected domain "${d}" in kitchen-sink fixture`).toContain(d)
    }
  })

  it('also contains the P1a domains (light, sensor, binary_sensor, switch)', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['light', 'sensor', 'binary_sensor', 'switch'] as const) {
      expect(domains).toContain(d)
    }
  })

  it('has at least 2 hidden entities', () => {
    const hidden = fx.entities.filter((e) => e.hidden).length
    expect(hidden).toBeGreaterThanOrEqual(2)
  })

  it('has at least 2 disabled entities', () => {
    const disabled = fx.entities.filter((e) => e.disabled).length
    expect(disabled).toBeGreaterThanOrEqual(2)
  })

  it('every entity referencing a device points at an existing device', () => {
    const deviceIds = new Set(fx.devices.map((d) => d.id))
    for (const e of fx.entities) {
      if (e.device !== null) {
        expect(deviceIds).toContain(e.device)
      }
    }
  })
})
```

- [ ] **Step 4: Run the structural test**

```bash
pnpm --dir <worktree> vitest run tests/fixtures/__tests__/kitchen-sink.test.ts
```

Expected: PASS.

- [ ] **Step 5: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add tests/fixtures/kitchen-sink.ts \
        tests/fixtures/__tests__/kitchen-sink.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(fixtures): kitchen-sink — full P1b-2 domain matrix in one fixture

~40 entities across Living Room, Master Bedroom, Kitchen, Front Door.
Every new domain (cover, media_player, lock, camera, vacuum, fan)
appears in at least one area, plus all P1a domains. Smoke fixture for
the full domain matrix — if any of the 6 new card mappings regresses,
this fixture's snapshot diff surfaces it instantly.

P1b-2 layer 6 of 7 (kitchen-sink fixture).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire 3 new fixtures into `detect.fixtures.test.ts` + `grouping.fixtures.test.ts`

**Files:**
- Modify: `packages/analyzer/src/__tests__/detect.fixtures.test.ts`
- Modify: `packages/analyzer/src/__tests__/grouping.fixtures.test.ts`

Adds `describe` blocks for the 3 new fixtures in both test files. Uses the same patterns as the existing english-cluttered / czech-tidy / german-massive blocks.

- [ ] **Step 1: Read the existing structure of `detect.fixtures.test.ts`**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/<worktree>/packages/analyzer/src/__tests__/detect.fixtures.test.ts
```

Note the imports + the per-fixture describe blocks. Each block does: `fixtureToHaRegistries → normalize → detect → assertions`.

- [ ] **Step 2: Add imports for the new fixtures**

In `packages/analyzer/src/__tests__/detect.fixtures.test.ts`, add 3 new imports next to the existing fixture imports:

```ts
import { kitchenSink } from '../../../../tests/fixtures/kitchen-sink.js'
import { securityRich } from '../../../../tests/fixtures/security-rich.js'
import { vacuumHeavy } from '../../../../tests/fixtures/vacuum-heavy.js'
```

- [ ] **Step 3: Append a describe block per new fixture**

After the existing german-massive block, append:

```ts
describe('detect — security-rich fixture', () => {
  const ha = fixtureToHaRegistries(securityRich)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })

  it('produces one assignment per input entity', () => {
    expect(assignments).toHaveLength(entities.length)
  })

  it('all entities with non-null fixture area land in their area canonical', () => {
    // security-rich uses english area names that the keyword pack does
    // (or doesn't) recognize. Front Entry / Back Yard / Garage / Hallway
    // — only Garage + Hallway map to canonical rooms. Front Entry +
    // Back Yard are non-canonical, so those entities go to misc.
    const ctx = buildDetectionContext(ha.areas)
    const areaIdToCanonical = new Map<string, string>()
    for (const [areaId, entry] of ctx.areaIndex) {
      if (entry.canonical !== null) areaIdToCanonical.set(areaId, entry.canonical)
    }
    let testable = 0
    let correct = 0
    const assignmentByEntityId = new Map(assignments.map((a) => [a.entityId, a]))
    const haEntityById = new Map(ha.entities.map((e) => [e.entity_id, e]))
    for (const e of securityRich.entities) {
      const haEntity = haEntityById.get(`${e.domain}.${e.objectId}`)
      const haAreaId = haEntity?.area_id ?? null
      if (haAreaId === null) continue
      const expected = areaIdToCanonical.get(haAreaId)
      if (expected === undefined) continue
      const a = assignmentByEntityId.get(`${e.domain}.${e.objectId}`)
      if (a === undefined) continue
      testable++
      if (a.roomId === expected) correct++
    }
    expect(testable).toBeGreaterThan(5)
    const ratio = correct / testable
    expect(ratio, `${correct}/${testable} matched`).toBeGreaterThanOrEqual(0.85)
  })
})

describe('detect — vacuum-heavy fixture', () => {
  const ha = fixtureToHaRegistries(vacuumHeavy)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })

  it('produces one assignment per input entity', () => {
    expect(assignments).toHaveLength(entities.length)
  })

  it('every area-attributed entity lands in its area canonical', () => {
    // vacuum-heavy uses canonical English area names (Living Room,
    // Kitchen, Hallway), so all area-attributed entities map cleanly.
    const ctx = buildDetectionContext(ha.areas)
    const areaIdToCanonical = new Map<string, string>()
    for (const [areaId, entry] of ctx.areaIndex) {
      if (entry.canonical !== null) areaIdToCanonical.set(areaId, entry.canonical)
    }
    const assignmentByEntityId = new Map(assignments.map((a) => [a.entityId, a]))
    const haEntityById = new Map(ha.entities.map((e) => [e.entity_id, e]))
    for (const e of vacuumHeavy.entities) {
      const haEntity = haEntityById.get(`${e.domain}.${e.objectId}`)
      const haAreaId = haEntity?.area_id ?? null
      if (haAreaId === null) continue
      const expected = areaIdToCanonical.get(haAreaId)
      if (expected === undefined) continue
      const a = assignmentByEntityId.get(`${e.domain}.${e.objectId}`)
      expect(a?.roomId, `${e.domain}.${e.objectId} should be ${expected}`).toBe(expected)
    }
  })
})

describe('detect — kitchen-sink fixture', () => {
  const ha = fixtureToHaRegistries(kitchenSink)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })

  it('produces one assignment per input entity', () => {
    expect(assignments).toHaveLength(entities.length)
  })

  it('all 4 areas resolve to canonicals (Living Room, Master Bedroom, Kitchen, Front Door)', () => {
    // Living Room → living_room, Master Bedroom → bedroom, Kitchen → kitchen.
    // Front Door is non-canonical (no pattern matches just "front door"),
    // so its entities go to misc — we don't fail on that here.
    const ctx = buildDetectionContext(ha.areas)
    const canonicals = new Set<string>()
    for (const [, entry] of ctx.areaIndex) {
      if (entry.canonical !== null) canonicals.add(entry.canonical)
    }
    expect(canonicals).toContain('living_room')
    expect(canonicals).toContain('bedroom')
    expect(canonicals).toContain('kitchen')
  })
})
```

The bathroom-resolves and Hobbyraum-misc-style assertions from german-massive aren't needed here — these fixtures are smaller and cleaner; the simpler "everything-resolves" check is enough.

- [ ] **Step 4: Run the new detect tests**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.fixtures.test.ts -t 'security-rich|vacuum-heavy|kitchen-sink'
```

Expected: PASS — about 8 new tests.

- [ ] **Step 5: Read `grouping.fixtures.test.ts`**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/<worktree>/packages/analyzer/src/__tests__/grouping.fixtures.test.ts
```

Note the `pipe()` helper at the top that returns `{ ha, entities, assignments, groupings }` (P1b-1 added `ha`).

- [ ] **Step 6: Add imports for the new fixtures in grouping.fixtures.test.ts**

```ts
import { kitchenSink } from '../../../../tests/fixtures/kitchen-sink.js'
import { securityRich } from '../../../../tests/fixtures/security-rich.js'
import { vacuumHeavy } from '../../../../tests/fixtures/vacuum-heavy.js'
```

- [ ] **Step 7: Append per-fixture grouping describe blocks**

After the existing german-massive block, append three new blocks:

```ts
describe('groupByDomain — security-rich fixture', () => {
  const { groupings } = pipe(securityRich)

  it('matches structural snapshot', () => {
    const summary = groupings
      .filter((g) => g.roomId !== 'misc')
      .map((g) => ({
        roomId: g.roomId,
        groups: g.groups.map((sub) => ({ key: sub.key, count: sub.entities.length })),
      }))
    expect(summary).toMatchInlineSnapshot()
  })

  it('every canonical room has at least one group', () => {
    for (const g of groupings) {
      if (g.roomId === 'misc') continue
      expect(g.groups.length).toBeGreaterThan(0)
    }
  })
})

describe('groupByDomain — vacuum-heavy fixture', () => {
  const { groupings } = pipe(vacuumHeavy)

  it('matches structural snapshot', () => {
    const summary = groupings
      .filter((g) => g.roomId !== 'misc')
      .map((g) => ({
        roomId: g.roomId,
        groups: g.groups.map((sub) => ({ key: sub.key, count: sub.entities.length })),
      }))
    expect(summary).toMatchInlineSnapshot()
  })

  it('living_room, kitchen, hallway each have a vacuum group', () => {
    const targets = ['living_room', 'kitchen', 'hallway'] as const
    for (const roomId of targets) {
      const room = groupings.find((g) => g.roomId === roomId)
      expect(room, `room ${roomId} should be present`).toBeDefined()
      const vacuumGroup = room!.groups.find((g) => g.key === 'vacuum')
      expect(vacuumGroup, `${roomId} should have a vacuum group`).toBeDefined()
    }
  })
})

describe('groupByDomain — kitchen-sink fixture', () => {
  const { groupings } = pipe(kitchenSink)

  it('matches structural snapshot', () => {
    const summary = groupings
      .filter((g) => g.roomId !== 'misc')
      .map((g) => ({
        roomId: g.roomId,
        groups: g.groups.map((sub) => ({ key: sub.key, count: sub.entities.length })),
      }))
    expect(summary).toMatchInlineSnapshot()
  })

  it('contains every new P1b-2 group key (covers, media, security, cameras, vacuum, fans)', () => {
    const allGroupKeys = new Set<string>()
    for (const g of groupings) {
      for (const sub of g.groups) allGroupKeys.add(sub.key)
    }
    for (const k of ['covers', 'media', 'security', 'cameras', 'vacuum', 'fans'] as const) {
      expect(allGroupKeys, `expected group key "${k}" to appear somewhere`).toContain(k)
    }
  })
})
```

- [ ] **Step 8: Generate the new snapshots**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.fixtures.test.ts -t 'security-rich|vacuum-heavy|kitchen-sink' -u
```

Expected: PASS. The 3 new `toMatchInlineSnapshot()` calls populate.

Open the file and inspect each snapshot. Sanity-check:

- security-rich snapshot: Garage has a `security` group + a `covers` group. Hallway has activity + lights.
- vacuum-heavy snapshot: living_room, kitchen, hallway each have `vacuum` groups.
- kitchen-sink snapshot: contains all 6 new group keys distributed across the 4 rooms (Front Door's lock + camera land in `misc` since "Front Door" isn't a canonical area, but they should still be groupable — actually no, misc bucket is filtered out of the snapshot helper, so Front Door's contents won't appear unless the area resolves to a canonical).

Note: `kitchen-sink`'s "Front Door" area is non-canonical (no `door` keyword pattern matches just "front door"), so lock + camera + binary_sensor land in misc. The `kitchen-sink contains every new P1b-2 group key` test will only pass if `lock`/`camera` from the misc bucket DO get grouped — but `groupByDomain` produces grouping entries for misc-roomId entities too. Let me verify by checking the test: the assertion iterates over `groupings` (all rooms including misc) and collects `sub.key` from every room's groups. So yes, even misc-bucket entities contribute their group keys to the set. Good.

If the assertion fails, debug: confirm `groupByDomain` produces a misc-room grouping with the appropriate sub-groups (it does — that's existing behavior), and confirm that `domainGroup` returns the right key for each domain.

- [ ] **Step 9: Re-run without `-u` to confirm stability**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/grouping.fixtures.test.ts
```

Expected: PASS — all blocks (existing + new).

- [ ] **Step 10: Run full verification**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
pnpm --dir <worktree> format:check
pnpm --dir <worktree> lint
```

All four green. If `format:check` fails on inline-snapshot whitespace, run `pnpm --dir <worktree> format`, re-stage, and retry.

- [ ] **Step 11: Commit**

```bash
git -C <worktree> add packages/analyzer/src/__tests__/detect.fixtures.test.ts \
        packages/analyzer/src/__tests__/grouping.fixtures.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
test(analyzer): wire security-rich + vacuum-heavy + kitchen-sink into fixture pipes

Each fixture gets a describe block in detect.fixtures (per-entity
canonical resolution) and grouping.fixtures (per-room domain split
snapshot). Specifically:

- security-rich: tests that area-attributed entities resolve to their
  canonical when the area name maps to a canonical (Garage, Hallway).
  Grouping snapshot locks the per-room domain split.
- vacuum-heavy: every area-attributed entity resolves cleanly (areas
  are canonical English names). Grouping snapshot verifies that all 3
  rooms have a vacuum group.
- kitchen-sink: 3 areas resolve to canonicals (living_room, bedroom,
  kitchen); Front Door is non-canonical (entities go to misc).
  Grouping snapshot verifies all 6 new P1b-2 group keys appear
  somewhere across the fixture's grouping output.

Closes P1b-2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1b-2 Acceptance Confirmation

- [ ] `domainGroup()` routes cover/media_player/lock/camera/vacuum/fan to their respective groups (6 routing tests pass).
- [ ] `MediaControlCard` and `PictureEntityCard` types exported from `@lovelacer/generator`.
- [ ] `cover-open-close` and `fan-speed` `TileFeature` variants exported.
- [ ] `buildSection()` switch is exhaustive over `DomainGroupKey` (no runtime throw); TypeScript enforces.
- [ ] `GROUP_HEADINGS` is `Record<DomainGroupKey, string>` (compile-time exhaustiveness).
- [ ] `buildTileCard()` attaches `cover-open-close` for covers and `fan-speed` for fans.
- [ ] Three new fixtures (`security-rich`, `vacuum-heavy`, `kitchen-sink`) ship with structural tests.
- [ ] Detect + grouping fixture-pipe tests cover the three new fixtures.
- [ ] Existing snapshots regenerated for english-cluttered + german-massive (analyzer + generator).
- [ ] `pnpm typecheck`, `pnpm -r test`, `pnpm format:check`, `pnpm lint` clean.
