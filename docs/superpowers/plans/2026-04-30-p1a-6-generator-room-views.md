# P1a-6 Generator: Room Views (basic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `buildRoomView(grouping)` and `buildRoomViews(groupings)` in `@lovelacer/generator` — pure functions that convert P1a-5's `RoomGrouping[]` into Lovelace `type: 'sections'` views (one section per group, heading + per-entity cards or a grouped entities card).

**Architecture:** Strongly typed. A discriminated `LovelaceCard` union plus structural `RoomView`/`GridSection` types in `lovelace-types.ts`. `room-view.ts` exports the build functions plus internal `ROOM_DISPLAY` and `GROUP_HEADINGS` tables (sourced from DASHBOARD_GENERATION.md). A single `buildSection(group)` switches on `group.key` to construct the correct card layout per group.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), Vitest. No new runtime dependencies.

**Spec reference:** [`docs/superpowers/specs/2026-04-30-p1a-6-generator-room-views-design.md`](../specs/2026-04-30-p1a-6-generator-room-views-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions.
- Type-only imports use `import type { … } from '…'`.
- Tests use `import { describe, it, expect } from 'vitest'`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- Run `pnpm` from the worktree (`pnpm --dir <worktree>`); `git -C <worktree>`.

---

## Task 1: Package wiring (vitest config + analyzer dependency)

**Files:**

- Create: `packages/generator/vitest.config.ts`
- Modify: `packages/generator/package.json`
- Modify: `packages/generator/tsconfig.json`

The generator hasn't shipped any test files yet, so its package config still relies on the root vitest's narrow include glob. Add a local config + wire `@lovelacer/analyzer` as a workspace dep so subsequent tasks can `import` from it.

- [ ] **Step 1: Create the local vitest config**

Create `packages/generator/vitest.config.ts` (mirrors `packages/analyzer/vitest.config.ts`):

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.config.*'],
    },
  },
})
```

- [ ] **Step 2: Add `@lovelacer/analyzer` to the generator's package.json**

Read `packages/generator/package.json` first. The `dependencies` section currently has `@lovelacer/shared` and `yaml`. Add `@lovelacer/analyzer` (alphabetical with the existing entries):

```json
  "dependencies": {
    "@lovelacer/analyzer": "workspace:*",
    "@lovelacer/shared": "workspace:*",
    "yaml": "^2.6.0"
  },
```

- [ ] **Step 3: Add the analyzer project reference to tsconfig**

Edit `packages/generator/tsconfig.json`. The `references` array currently has `[{ "path": "../shared" }]`. Add the analyzer reference (order doesn't matter for tsc, but keep alphabetical):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../analyzer" }, { "path": "../shared" }]
}
```

- [ ] **Step 4: Install + verify**

```bash
pnpm --dir <worktree> install
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Expected: `pnpm install` updates the lockfile (workspace symlinks); `typecheck` clean; `test` clean. The generator package still has no test files, so `--passWithNoTests` keeps it green.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add packages/generator/vitest.config.ts \
        packages/generator/package.json \
        packages/generator/tsconfig.json \
        pnpm-lock.yaml
git -C <worktree> commit -m "$(cat <<'EOF'
chore(generator): wire vitest config + analyzer workspace dep

Local vitest.config.ts so generator tests are discoverable (mirrors
the analyzer pattern). Add @lovelacer/analyzer as a workspace dep
plus its tsconfig project reference so room-view.ts can import
RoomGrouping/DomainGroupKey from the analyzer in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Lovelace types

**Files:**

- Create: `packages/generator/src/lovelace-types.ts`

Pure type declarations for the structures we own. No runtime code, no tests in this task — exercised by every later task.

- [ ] **Step 1: Write `lovelace-types.ts`**

Create `packages/generator/src/lovelace-types.ts`:

```ts
/**
 * TypeScript shapes for the Lovelace structures the generator constructs.
 *
 * Discriminated `LovelaceCard` union narrows on the `type` literal — code
 * that branches on `card.type === 'tile'` gets full TileCard typing without
 * casts. New card kinds (e.g., 'media-control', 'picture-glance') get added
 * to the union in P1b-2.
 *
 * Structural types (RoomView, GridSection) reflect HA's stable
 * sections-view schema. If HA changes the schema in a future release, these
 * types update in lockstep with the generator.
 */

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

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --dir <worktree> typecheck
```

Expected: PASS. The new types compile; no consumers yet.

- [ ] **Step 3: Commit**

```bash
git -C <worktree> add packages/generator/src/lovelace-types.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(generator): add Lovelace card + view type declarations

Discriminated LovelaceCard union (HeadingCard | TileCard |
ThermostatCard | EntitiesCard) plus structural RoomView and
GridSection types. Exported via the package barrel in the next
commit when buildRoomView consumes them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `buildRoomView` + `buildRoomViews` + unit tests + re-exports

**Files:**

- Create: `packages/generator/src/room-view.ts`
- Create: `packages/generator/src/__tests__/room-view.test.ts`
- Modify: `packages/generator/src/index.ts`

The full per-room implementation: ROOM_DISPLAY table, GROUP_HEADINGS table, per-group `buildSection`, `buildRoomView`, `buildRoomViews`. Plus all unit tests TDD-style. Plus barrel re-exports.

- [ ] **Step 1: Write the failing tests**

Create `packages/generator/src/__tests__/room-view.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { CanonicalRoomId, NormalizedEntity } from '@lovelacer/shared'
import type { DomainGroup, RoomGrouping } from '@lovelacer/analyzer'
import { buildRoomView, buildRoomViews } from '../room-view.js'

const ent = (id: string, overrides: Partial<NormalizedEntity> = {}): NormalizedEntity => ({
  entityId: id,
  domain: id.split('.')[0]!,
  objectId: id.split('.')[1]!,
  friendlyName: id,
  deviceClass: null,
  entityCategory: null,
  haAreaId: null,
  device: null,
  isHidden: false,
  isDisabled: false,
  ...overrides,
})

const grouping = (roomId: CanonicalRoomId, groups: DomainGroup[]): RoomGrouping => ({
  roomId,
  groups,
})

describe('buildRoomView — per-room metadata', () => {
  it('produces title, path, icon for each canonical room', () => {
    const expected: Record<CanonicalRoomId, { title: string; path: string; icon: string }> = {
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
    for (const [roomId, expectedDisplay] of Object.entries(expected)) {
      const view = buildRoomView(grouping(roomId as CanonicalRoomId, []))
      expect(view.title).toBe(expectedDisplay.title)
      expect(view.path).toBe(expectedDisplay.path)
      expect(view.icon).toBe(expectedDisplay.icon)
    }
  })

  it('returns type=sections for every room', () => {
    const view = buildRoomView(grouping('kitchen', []))
    expect(view.type).toBe('sections')
  })

  it('misc room uses path "other" (not "misc")', () => {
    const view = buildRoomView(grouping('misc', []))
    expect(view.path).toBe('other')
    expect(view.title).toBe('Other')
  })
})

describe('buildRoomView — empty groups', () => {
  it('produces an empty sections array when grouping has no groups', () => {
    const view = buildRoomView(grouping('kitchen', []))
    expect(view.sections).toEqual([])
  })
})

describe('buildRoomView — lights group', () => {
  it('produces heading + tile per light entity with light-brightness feature', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'lights',
          entities: [
            ent('light.kitchen_ceiling', { friendlyName: 'Kitchen Ceiling' }),
            ent('light.kitchen_counter', { friendlyName: 'Kitchen Counter' }),
          ],
        },
      ]),
    )
    expect(view.sections).toHaveLength(1)
    expect(view.sections[0]).toEqual({
      type: 'grid',
      cards: [
        { type: 'heading', heading: 'Lights & Outlets' },
        {
          type: 'tile',
          entity: 'light.kitchen_ceiling',
          features: [{ type: 'light-brightness' }],
        },
        {
          type: 'tile',
          entity: 'light.kitchen_counter',
          features: [{ type: 'light-brightness' }],
        },
      ],
    })
  })

  it('switches get a tile WITHOUT features', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'lights',
          entities: [ent('switch.coffee_maker', { friendlyName: 'Coffee Maker' })],
        },
      ]),
    )
    const cards = view.sections[0]!.cards
    expect(cards[1]).toEqual({ type: 'tile', entity: 'switch.coffee_maker' })
    // Specifically: the `features` key is absent (not `features: undefined`).
    expect('features' in (cards[1] as object)).toBe(false)
  })

  it('mixed light + switch entities each get the right tile shape', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'lights',
          entities: [
            ent('light.a', { friendlyName: 'A' }),
            ent('switch.b', { friendlyName: 'B' }),
            ent('light.c', { friendlyName: 'C' }),
          ],
        },
      ]),
    )
    const cards = view.sections[0]!.cards
    expect(cards[1]).toEqual({
      type: 'tile',
      entity: 'light.a',
      features: [{ type: 'light-brightness' }],
    })
    expect(cards[2]).toEqual({ type: 'tile', entity: 'switch.b' })
    expect(cards[3]).toEqual({
      type: 'tile',
      entity: 'light.c',
      features: [{ type: 'light-brightness' }],
    })
  })
})

describe('buildRoomView — climate group', () => {
  it('produces heading + thermostat per entity', () => {
    const view = buildRoomView(
      grouping('living_room', [
        {
          key: 'climate',
          entities: [
            ent('climate.living_room_thermostat', { friendlyName: 'Living Room Thermostat' }),
          ],
        },
      ]),
    )
    expect(view.sections[0]).toEqual({
      type: 'grid',
      cards: [
        { type: 'heading', heading: 'Climate' },
        { type: 'thermostat', entity: 'climate.living_room_thermostat' },
      ],
    })
  })
})

describe('buildRoomView — environment / activity / other groups', () => {
  it('environment group becomes heading + single entities card', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'environment',
          entities: [
            ent('sensor.kitchen_temp', { friendlyName: 'Kitchen Temperature' }),
            ent('sensor.kitchen_humidity', { friendlyName: 'Kitchen Humidity' }),
          ],
        },
      ]),
    )
    expect(view.sections[0]).toEqual({
      type: 'grid',
      cards: [
        { type: 'heading', heading: 'Environment' },
        {
          type: 'entities',
          entities: ['sensor.kitchen_temp', 'sensor.kitchen_humidity'],
        },
      ],
    })
  })

  it('activity group becomes heading + single entities card', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'activity',
          entities: [ent('binary_sensor.kitchen_motion', { friendlyName: 'Kitchen Motion' })],
        },
      ]),
    )
    expect(view.sections[0]).toEqual({
      type: 'grid',
      cards: [
        { type: 'heading', heading: 'Activity' },
        {
          type: 'entities',
          entities: ['binary_sensor.kitchen_motion'],
        },
      ],
    })
  })

  it('other group becomes heading + single entities card', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'other',
          entities: [
            ent('cover.kitchen_blinds', { friendlyName: 'Kitchen Blinds' }),
            ent('media_player.kitchen_speaker', { friendlyName: 'Kitchen Speaker' }),
          ],
        },
      ]),
    )
    expect(view.sections[0]).toEqual({
      type: 'grid',
      cards: [
        { type: 'heading', heading: 'Other' },
        {
          type: 'entities',
          entities: ['cover.kitchen_blinds', 'media_player.kitchen_speaker'],
        },
      ],
    })
  })

  it('preserves entity order from grouping (already friendly-name-sorted by P1a-5)', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'environment',
          entities: [ent('sensor.a'), ent('sensor.b'), ent('sensor.c')],
        },
      ]),
    )
    const card = view.sections[0]!.cards[1] as { entities: string[] }
    expect(card.entities).toEqual(['sensor.a', 'sensor.b', 'sensor.c'])
  })
})

describe('buildRoomView — section ordering', () => {
  it('preserves group order from input (already GROUP_ORDER-sorted by P1a-5)', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        { key: 'lights', entities: [ent('light.l')] },
        { key: 'climate', entities: [ent('climate.c')] },
        { key: 'activity', entities: [ent('binary_sensor.m', { deviceClass: 'motion' })] },
        {
          key: 'environment',
          entities: [ent('sensor.t', { deviceClass: 'temperature' })],
        },
        { key: 'other', entities: [ent('cover.x')] },
      ]),
    )
    const headings = view.sections.map((s) => (s.cards[0] as { heading: string }).heading)
    expect(headings).toEqual(['Lights & Outlets', 'Climate', 'Activity', 'Environment', 'Other'])
  })
})

describe('buildRoomViews — bulk', () => {
  it('returns empty array for empty input', () => {
    expect(buildRoomViews([])).toEqual([])
  })

  it('produces one view per non-empty grouping, preserving order', () => {
    const views = buildRoomViews([
      grouping('kitchen', [{ key: 'lights', entities: [ent('light.k')] }]),
      grouping('bedroom', [{ key: 'lights', entities: [ent('light.b')] }]),
    ])
    expect(views).toHaveLength(2)
    expect(views[0]!.path).toBe('kitchen')
    expect(views[1]!.path).toBe('bedroom')
  })

  it('filters out groupings with no groups', () => {
    const views = buildRoomViews([
      grouping('kitchen', [{ key: 'lights', entities: [ent('light.k')] }]),
      grouping('bedroom', []),
      grouping('living_room', [{ key: 'lights', entities: [ent('light.lr')] }]),
    ])
    expect(views.map((v) => v.path)).toEqual(['kitchen', 'living_room'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/room-view.test.ts
```

Expected: FAIL — module not found for `../room-view.js`.

- [ ] **Step 3: Implement `room-view.ts`**

Create `packages/generator/src/room-view.ts`:

```ts
import type { CanonicalRoomId, NormalizedEntity } from '@lovelacer/shared'
import type { DomainGroup, DomainGroupKey, RoomGrouping } from '@lovelacer/analyzer'
import type {
  EntitiesCard,
  GridSection,
  HeadingCard,
  LovelaceCard,
  RoomView,
  ThermostatCard,
  TileCard,
} from './lovelace-types.js'

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

const GROUP_HEADINGS: Partial<Record<DomainGroupKey, string>> = {
  lights: 'Lights & Outlets',
  climate: 'Climate',
  activity: 'Activity',
  environment: 'Environment',
  other: 'Other',
}

/**
 * Convert one analyzer RoomGrouping into a Lovelace `type: 'sections'`
 * view. Each input group becomes one grid section with a heading card
 * followed by per-entity cards (or a single grouped entities card,
 * depending on the group key).
 *
 * Pure function. Preserves the input's entity order within groups and
 * the input's group order within the room (P1a-5 already sorted both).
 */
export function buildRoomView(grouping: RoomGrouping): RoomView {
  const display = ROOM_DISPLAY[grouping.roomId]
  return {
    type: 'sections',
    title: display.title,
    path: display.path,
    icon: display.icon,
    sections: grouping.groups.map((group) => buildSection(group)),
  }
}

/**
 * Bulk wrapper. Filters out groupings with no groups before mapping
 * (no point producing an empty-sections view that HA renders as a
 * blank page). Preserves input order for non-empty groupings.
 */
export function buildRoomViews(groupings: RoomGrouping[]): RoomView[] {
  return groupings.filter((g) => g.groups.length > 0).map((g) => buildRoomView(g))
}

function buildSection(group: DomainGroup): GridSection {
  const heading = GROUP_HEADINGS[group.key]
  if (heading === undefined) {
    throw new Error(`unsupported group key: ${group.key}`)
  }
  const headingCard: HeadingCard = { type: 'heading', heading }

  let bodyCards: LovelaceCard[]
  switch (group.key) {
    case 'lights':
      bodyCards = group.entities.map((e) => buildTileCard(e))
      break
    case 'climate':
      bodyCards = group.entities.map((e) => buildThermostatCard(e))
      break
    case 'environment':
    case 'activity':
    case 'other':
      bodyCards = [buildEntitiesCard(group.entities)]
      break
    default:
      // Should be unreachable given the GROUP_HEADINGS lookup above.
      throw new Error(`unsupported group key: ${group.key as string}`)
  }

  return { type: 'grid', cards: [headingCard, ...bodyCards] }
}

function buildTileCard(entity: NormalizedEntity): TileCard {
  if (entity.domain === 'light') {
    return {
      type: 'tile',
      entity: entity.entityId,
      features: [{ type: 'light-brightness' }],
    }
  }
  return { type: 'tile', entity: entity.entityId }
}

function buildThermostatCard(entity: NormalizedEntity): ThermostatCard {
  return { type: 'thermostat', entity: entity.entityId }
}

function buildEntitiesCard(entities: NormalizedEntity[]): EntitiesCard {
  return { type: 'entities', entities: entities.map((e) => e.entityId) }
}
```

> **Note on `exactOptionalPropertyTypes`:** the switch tile path returns `{ type: 'tile', entity: '...' }` — no `features` key — so the test's `'features' in card` check returns false. Returning `{ ...card, features: undefined }` would fail under `exactOptionalPropertyTypes: true` and would also pass `'features' in card` as true. Don't add the optional key to the object literal when the entity isn't a light.

- [ ] **Step 4: Re-export from the package barrel**

Replace the contents of `packages/generator/src/index.ts`:

```ts
/**
 * @lovelacer/generator
 *
 * Builds Lovelace dashboard configurations from analyzer output.
 *
 * Implementation lands in:
 *   - P1a-6: room-view.ts (per-room sections layout)
 *   - P1a-7: home-view.ts (overview view, minimal in 1a)
 *   - P1a-8: storage-apply.ts (lovelace/config/save mechanics)
 *   - P1b-2: full domain card mappings
 *   - P1b-5: full home overview composition
 *   - Phase 2: yaml-export.ts (proper YAML serialization)
 *
 * Future packages/generator-smartpanel will be a sibling using the
 * same analyzer output. See SMART_PANEL_BRIDGE.md.
 */
export const GENERATOR_VERSION = '0.0.0'
export { buildRoomView, buildRoomViews } from './room-view.js'
export type {
  EntitiesCard,
  GridSection,
  HeadingCard,
  LovelaceCard,
  RoomView,
  ThermostatCard,
  TileCard,
  TileFeature,
} from './lovelace-types.js'
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/room-view.test.ts
```

Expected: PASS — 16 tests (3 metadata + 1 empty + 3 lights + 1 climate + 4 environment/activity/other + 1 ordering + 3 bulk = 16; the per-room metadata test counts as 1 with 15 inner assertions).

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add packages/generator/src/room-view.ts \
        packages/generator/src/__tests__/room-view.test.ts \
        packages/generator/src/index.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(generator): buildRoomView + buildRoomViews

Pure functions that convert P1a-5's RoomGrouping[] into Lovelace
'sections' views. One section per group: heading card + per-entity
cards (tile for lights/switches with light-brightness feature for
lights only, thermostat for climate) or a single grouped entities
card (environment/activity/other). Internal ROOM_DISPLAY and
GROUP_HEADINGS tables source titles/icons/headings from
DASHBOARD_GENERATION.md.

buildRoomViews filters out groupings with no groups before mapping.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Fixture-driven snapshot tests

**Files:**

- Create: `packages/generator/src/__tests__/room-view.fixtures.test.ts`

End-to-end tests that pipe each fixture through the entire chain (`fixtureToHaRegistries → normalize → detect → groupByDomain → buildRoomViews`) and lock the structural shape via inline snapshots, plus several anti-regression assertions.

- [ ] **Step 1: Write the test file**

Create `packages/generator/src/__tests__/room-view.fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { czechTidy } from '../../../../tests/fixtures/czech-tidy.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import { normalize, detect, groupByDomain } from '@lovelacer/analyzer'
import { buildRoomViews } from '../room-view.js'
import type { LovelaceCard } from '../lovelace-types.js'

function pipe(fixture: typeof englishCluttered) {
  const ha = fixtureToHaRegistries(fixture)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })
  const groupings = groupByDomain({ assignments, entities })
  const views = buildRoomViews(groupings)
  return { entities, groupings, views }
}

function summarize(views: ReturnType<typeof pipe>['views']) {
  return views.map((v) => ({
    title: v.title,
    path: v.path,
    icon: v.icon,
    sections: v.sections.map((s) => {
      const heading = (s.cards[0] as { heading?: string }).heading
      const cardTypeCounts: Record<string, number> = {}
      for (let i = 1; i < s.cards.length; i++) {
        const t = s.cards[i]!.type
        cardTypeCounts[t] = (cardTypeCounts[t] ?? 0) + 1
      }
      return { heading, cards: cardTypeCounts }
    }),
  }))
}

function entityIdsInCard(card: LovelaceCard): string[] {
  if (card.type === 'tile' || card.type === 'thermostat') return [card.entity]
  if (card.type === 'entities') return card.entities
  return [] // heading
}

describe('buildRoomViews — english-cluttered fixture', () => {
  const { groupings, views } = pipe(englishCluttered)

  it('matches structural snapshot', () => {
    expect(summarize(views)).toMatchInlineSnapshot()
  })

  it('produces one view per non-empty grouping', () => {
    expect(views.length).toBe(groupings.filter((g) => g.groups.length > 0).length)
  })

  it('all view paths are unique', () => {
    const paths = views.map((v) => v.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('every entity that survived grouping appears exactly once across all cards', () => {
    const entityIdsInOutput: string[] = []
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          entityIdsInOutput.push(...entityIdsInCard(card))
        }
      }
    }
    const expectedCount = groupings.reduce(
      (sum, g) => sum + g.groups.reduce((s, grp) => s + grp.entities.length, 0),
      0,
    )
    expect(entityIdsInOutput).toHaveLength(expectedCount)
    expect(new Set(entityIdsInOutput).size).toBe(entityIdsInOutput.length)
  })

  it('every TileCard has a non-empty entity', () => {
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          if (card.type === 'tile') expect(card.entity).not.toBe('')
        }
      }
    }
  })

  it('every ThermostatCard has a non-empty entity', () => {
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          if (card.type === 'thermostat') expect(card.entity).not.toBe('')
        }
      }
    }
  })

  it('every EntitiesCard has at least one entity', () => {
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          if (card.type === 'entities') expect(card.entities.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('first card in every section is a heading', () => {
    for (const view of views) {
      for (const section of view.sections) {
        expect(section.cards[0]?.type).toBe('heading')
      }
    }
  })

  it('lights sections contain only tile cards (after the heading)', () => {
    for (const view of views) {
      for (const section of view.sections) {
        if ((section.cards[0] as { heading: string }).heading !== 'Lights & Outlets') continue
        for (let i = 1; i < section.cards.length; i++) {
          expect(section.cards[i]!.type).toBe('tile')
        }
      }
    }
  })

  it('climate sections contain only thermostat cards (after the heading)', () => {
    for (const view of views) {
      for (const section of view.sections) {
        if ((section.cards[0] as { heading: string }).heading !== 'Climate') continue
        for (let i = 1; i < section.cards.length; i++) {
          expect(section.cards[i]!.type).toBe('thermostat')
        }
      }
    }
  })

  it('environment / activity / other sections contain exactly one entities card after the heading', () => {
    const groupedHeadings = new Set(['Environment', 'Activity', 'Other'])
    for (const view of views) {
      for (const section of view.sections) {
        const heading = (section.cards[0] as { heading: string }).heading
        if (!groupedHeadings.has(heading)) continue
        expect(section.cards.length).toBe(2)
        expect(section.cards[1]?.type).toBe('entities')
      }
    }
  })
})

describe('buildRoomViews — czech-tidy fixture', () => {
  const { groupings, views } = pipe(czechTidy)

  it('matches structural snapshot', () => {
    expect(summarize(views)).toMatchInlineSnapshot()
  })

  it('produces one view per grouping (czech-tidy has no empty groupings)', () => {
    expect(views.length).toBe(groupings.length)
  })

  it('all view paths are unique', () => {
    const paths = views.map((v) => v.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('every entity in groupings appears exactly once across all cards', () => {
    const entityIdsInOutput: string[] = []
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          entityIdsInOutput.push(...entityIdsInCard(card))
        }
      }
    }
    const expectedCount = groupings.reduce(
      (sum, g) => sum + g.groups.reduce((s, grp) => s + grp.entities.length, 0),
      0,
    )
    expect(entityIdsInOutput).toHaveLength(expectedCount)
    expect(new Set(entityIdsInOutput).size).toBe(entityIdsInOutput.length)
  })

  it('first card in every section is a heading', () => {
    for (const view of views) {
      for (const section of view.sections) {
        expect(section.cards[0]?.type).toBe('heading')
      }
    }
  })
})
```

- [ ] **Step 2: Generate the snapshots**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/room-view.fixtures.test.ts --update
```

Expected: PASS. The two `toMatchInlineSnapshot()` calls populate with the actual structural summaries.

Open the file and inspect the populated snapshots. Sanity check:

- english-cluttered: ~10 views (matches the 10 rooms from P1a-5's snapshot — kitchen, living_room, bedroom, bathroom, office, garage, attic, garden, hallway, misc-as-Other). Each view has 1–4 sections per the count of populated groups in P1a-5's grouping output. Card-type counts inside each section match the group's expected layout (lights → many tiles, climate → 0–1 thermostats, environment/activity/other → exactly 1 entities card).
- czech-tidy: 5 views (the 5 Czech rooms). No misc.

If a snapshot looks off — e.g., a section has 2 entities cards under "Environment" — fix the implementation and re-run with `--update`.

- [ ] **Step 3: Re-run without `--update` to lock the snapshots**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/room-view.fixtures.test.ts
```

Expected: PASS — all 13 tests including the (now populated) snapshots.

- [ ] **Step 4: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
pnpm --dir <worktree> format:check
pnpm --dir <worktree> lint
```

All green. Snapshots should not need refreshing.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add packages/generator/src/__tests__/room-view.fixtures.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
test(generator): buildRoomViews end-to-end on english-cluttered + czech-tidy

Pipes each fixture through fixtureToHaRegistries → normalize → detect
→ groupByDomain → buildRoomViews and locks the structural shape via
inline snapshots. Anti-regression assertions confirm: one view per
non-empty grouping, unique paths, every entity appears exactly once
across all cards, no empty cards, first card in every section is a
heading, and per-group section structure (lights → tiles, climate →
thermostats, env/activity/other → single entities card).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1a-6 Acceptance Confirmation

- [ ] `buildRoomView`, `buildRoomViews`, and the public Lovelace types exported from `@lovelacer/generator`.
- [ ] All unit tests in `room-view.test.ts` pass.
- [ ] Fixture snapshot tests in `room-view.fixtures.test.ts` pass for both fixtures.
- [ ] Snapshots reviewed for sanity (rooms, sections, card-type counts make sense for each fixture).
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm lint` clean.
