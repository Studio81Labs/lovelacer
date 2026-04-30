# P1a-7 Generator: Home Overview (minimal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `buildHomeView(input)` and `pickQuickStatsEntities(entities)` in `@lovelacer/generator` — pure functions that produce the dashboard's first view (Welcome markdown card + optional Quick stats glance card with up to 4 heuristically-picked entities).

**Architecture:** A `HomeView` type alias for the existing `RoomView` (same structural shape). `lovelace-types.ts` extends the `LovelaceCard` discriminated union with `MarkdownCard` and `GlanceCard`. `home-view.ts` exports `buildHomeView` plus the picker helper. The Welcome section is always present; the Quick stats section is dropped when fewer than 2 entities match the curated patterns.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), Vitest. No new runtime dependencies.

**Spec reference:** [`docs/superpowers/specs/2026-04-30-p1a-7-generator-home-view-design.md`](../specs/2026-04-30-p1a-7-generator-home-view-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions.
- Type-only imports use `import type { … } from '…'`.
- Tests use `import { describe, it, expect } from 'vitest'`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- Run `pnpm` from the worktree (`pnpm --dir <worktree>`); `git -C <worktree>`.

---

## Task 1: Extend `LovelaceCard` union with `MarkdownCard` + `GlanceCard`

**Files:**
- Modify: `packages/generator/src/lovelace-types.ts`
- Modify: `packages/generator/src/index.ts`

Pure type additions. Re-exports the two new types so consumers can narrow on `card.type === 'markdown' | 'glance'`. No runtime code, no tests.

- [ ] **Step 1: Add the new card interfaces and extend the union**

Read `packages/generator/src/lovelace-types.ts` first. Find the `LovelaceCard` union and append the two new card types AFTER the existing `EntitiesCard`. Then update the union to include them.

Edit the section near `LovelaceCard` to be:

```ts
export type LovelaceCard =
  | HeadingCard
  | TileCard
  | ThermostatCard
  | EntitiesCard
  | MarkdownCard
  | GlanceCard
```

And append the two new interface declarations to the end of the file, after the existing `EntitiesCard`:

```ts
export interface MarkdownCard {
  type: 'markdown'
  content: string
}

export interface GlanceCard {
  type: 'glance'
  title?: string
  entities: string[]
}
```

- [ ] **Step 2: Re-export from the package barrel**

Read `packages/generator/src/index.ts` first. Find the `export type { … } from './lovelace-types.js'` block and append `MarkdownCard` and `GlanceCard` to it (alphabetical with the others). The full type re-export block becomes:

```ts
export type {
  EntitiesCard,
  GlanceCard,
  GridSection,
  HeadingCard,
  LovelaceCard,
  MarkdownCard,
  RoomView,
  ThermostatCard,
  TileCard,
  TileFeature,
} from './lovelace-types.js'
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --dir <worktree> typecheck
```

Expected: PASS. The new types compile; no consumers yet.

- [ ] **Step 4: Commit**

```bash
git -C <worktree> add packages/generator/src/lovelace-types.ts \
        packages/generator/src/index.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(generator): add MarkdownCard and GlanceCard to LovelaceCard union

P1a-7 home overview uses a markdown card for the Welcome greeting and
a glance card for the Quick stats section. Re-exports added to the
barrel so consumers narrow on card.type === 'markdown' | 'glance'
just like the existing card types.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `home-view.ts` (picker + builders + view orchestration) + unit tests + re-exports

**Files:**
- Create: `packages/generator/src/home-view.ts`
- Create: `packages/generator/src/__tests__/home-view.test.ts`
- Modify: `packages/generator/src/index.ts`

The full per-home-view implementation: `pickQuickStatsEntities` (the heuristic patterns), `buildWelcomeSection`, `buildQuickStatsSection`, `buildHomeView`. Plus all unit tests TDD-style. Plus barrel re-exports.

- [ ] **Step 1: Write the failing tests**

Create `packages/generator/src/__tests__/home-view.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { NormalizedEntity } from '@lovelacer/shared'
import { buildHomeView, pickQuickStatsEntities } from '../home-view.js'

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

describe('pickQuickStatsEntities — patterns', () => {
  it('picks weather entity (any weather.* domain)', () => {
    const result = pickQuickStatsEntities([ent('weather.home')])
    expect(result).toHaveLength(1)
    expect(result[0]!.entityId).toBe('weather.home')
  })

  it('picks outdoor temperature by entity_id substring', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
    ])
    expect(result.map((e) => e.entityId)).toEqual(['sensor.outdoor_temperature'])
  })

  it('picks outdoor temperature by friendlyName substring (case-insensitive)', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.x', { deviceClass: 'temperature', friendlyName: 'Outside Temp' }),
    ])
    expect(result.map((e) => e.entityId)).toEqual(['sensor.x'])
  })

  it('does NOT pick indoor temperature (no outdoor/outside marker)', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.kitchen_temperature', { deviceClass: 'temperature' }),
    ])
    expect(result).toEqual([])
  })

  it('picks outdoor humidity by entity_id substring', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.outdoor_humidity', { deviceClass: 'humidity' }),
    ])
    expect(result.map((e) => e.entityId)).toEqual(['sensor.outdoor_humidity'])
  })

  it('picks presence by deviceClass', () => {
    const result = pickQuickStatsEntities([
      ent('binary_sensor.living_room_motion', { deviceClass: 'presence' }),
    ])
    expect(result).toHaveLength(1)
  })

  it('picks presence by entity_id pattern: anyone_home', () => {
    const result = pickQuickStatsEntities([ent('binary_sensor.anyone_home')])
    expect(result).toHaveLength(1)
  })

  it('picks presence by entity_id pattern: someone-home (hyphen variant)', () => {
    const result = pickQuickStatsEntities([ent('binary_sensor.someone-home')])
    expect(result).toHaveLength(1)
  })

  it('picks presence by entity_id pattern: any "presence" substring', () => {
    const result = pickQuickStatsEntities([ent('binary_sensor.home_presence')])
    expect(result).toHaveLength(1)
  })

  it('picks power by deviceClass', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.house_power_now', { deviceClass: 'power' }),
    ])
    expect(result).toHaveLength(1)
  })

  it('does NOT pick energy as power (different deviceClass)', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.house_energy_today', { deviceClass: 'energy' }),
    ])
    expect(result).toEqual([])
  })
})

describe('pickQuickStatsEntities — ordering and limits', () => {
  it('returns matched entities in pattern order (weather, outdoor temp, outdoor humidity, presence, power)', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.house_power_now', { deviceClass: 'power' }),
      ent('binary_sensor.anyone_home'),
      ent('sensor.outdoor_humidity', { deviceClass: 'humidity' }),
      ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
      ent('weather.home'),
    ])
    expect(result.map((e) => e.entityId)).toEqual([
      'weather.home',
      'sensor.outdoor_temperature',
      'sensor.outdoor_humidity',
      'binary_sensor.anyone_home',
    ])
    // Power not included because the cap is 4.
    expect(result).toHaveLength(4)
  })

  it('caps at 4 entities even when more patterns could match', () => {
    const result = pickQuickStatsEntities([
      ent('weather.home'),
      ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
      ent('sensor.outdoor_humidity', { deviceClass: 'humidity' }),
      ent('binary_sensor.anyone_home'),
      ent('sensor.house_power_now', { deviceClass: 'power' }),
    ])
    expect(result).toHaveLength(4)
  })

  it('multiple matches per pattern → only first picked', () => {
    const result = pickQuickStatsEntities([
      ent('weather.home'),
      ent('weather.forecast'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0]!.entityId).toBe('weather.home')
  })

  it('returns empty array when nothing matches', () => {
    const result = pickQuickStatsEntities([
      ent('light.kitchen_ceiling'),
      ent('switch.coffee_maker'),
    ])
    expect(result).toEqual([])
  })

  it('returns empty array on empty input', () => {
    expect(pickQuickStatsEntities([])).toEqual([])
  })
})

describe('buildHomeView — view metadata', () => {
  it('produces type=sections, title=Home, path=home, icon=mdi:home-variant', () => {
    const view = buildHomeView({ entities: [] })
    expect(view.type).toBe('sections')
    expect(view.title).toBe('Home')
    expect(view.path).toBe('home')
    expect(view.icon).toBe('mdi:home-variant')
  })
})

describe('buildHomeView — Welcome section', () => {
  it('always emits a Welcome section even with empty entities', () => {
    const view = buildHomeView({ entities: [] })
    expect(view.sections).toHaveLength(1)
    const card = view.sections[0]!.cards[0]
    expect(card?.type).toBe('markdown')
  })

  it('Welcome card has greeting only when no weather entity exists', () => {
    const view = buildHomeView({ entities: [ent('light.kitchen')] })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain('Good ')
    expect(card.content).toContain("now().strftime('%H')")
    // No weather template line
    expect(card.content).not.toContain('states(')
    expect(card.content).not.toContain('state_attr(')
  })

  it('Welcome card adds weather template when weather entity exists', () => {
    const view = buildHomeView({ entities: [ent('weather.home')] })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain("{{ states('weather.home') }}")
    expect(card.content).toContain("{{ state_attr('weather.home', 'temperature') }}°")
  })

  it('Welcome card uses the first weather entity when multiple exist', () => {
    const view = buildHomeView({
      entities: [ent('weather.home'), ent('weather.forecast')],
    })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain("states('weather.home')")
    expect(card.content).not.toContain("states('weather.forecast')")
  })
})

describe('buildHomeView — Quick stats section', () => {
  it('skips Quick stats section when 0 entities match', () => {
    const view = buildHomeView({ entities: [ent('light.kitchen')] })
    expect(view.sections).toHaveLength(1) // Welcome only
  })

  it('skips Quick stats section when only 1 entity matches', () => {
    const view = buildHomeView({
      entities: [ent('sensor.outdoor_temperature', { deviceClass: 'temperature' })],
    })
    expect(view.sections).toHaveLength(1) // Welcome only
  })

  it('emits Quick stats section when 2 entities match', () => {
    const view = buildHomeView({
      entities: [
        ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
        ent('sensor.outdoor_humidity', { deviceClass: 'humidity' }),
      ],
    })
    expect(view.sections).toHaveLength(2)
    const glance = view.sections[1]!.cards[0] as {
      type: 'glance'
      title: string
      entities: string[]
    }
    expect(glance.type).toBe('glance')
    expect(glance.title).toBe('Quick stats')
    expect(glance.entities).toEqual([
      'sensor.outdoor_temperature',
      'sensor.outdoor_humidity',
    ])
  })

  it('Quick stats section has exactly one glance card', () => {
    const view = buildHomeView({
      entities: [
        ent('weather.home'),
        ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
        ent('binary_sensor.anyone_home'),
      ],
    })
    expect(view.sections[1]!.cards).toHaveLength(1)
    expect(view.sections[1]!.cards[0]!.type).toBe('glance')
  })
})

describe('buildHomeView — integration', () => {
  it('full input with weather + outdoor temp + presence → Welcome with weather + Quick stats with 3 entities', () => {
    const view = buildHomeView({
      entities: [
        ent('weather.home'),
        ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
        ent('binary_sensor.anyone_home'),
        ent('light.kitchen'), // not in glance
      ],
    })
    expect(view.sections).toHaveLength(2)
    const welcome = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(welcome.content).toContain("states('weather.home')")
    const glance = view.sections[1]!.cards[0] as { type: 'glance'; entities: string[] }
    expect(glance.entities).toEqual([
      'weather.home',
      'sensor.outdoor_temperature',
      'binary_sensor.anyone_home',
    ])
  })

  it('empty input → Welcome only, no Quick stats', () => {
    const view = buildHomeView({ entities: [] })
    expect(view.sections).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/home-view.test.ts
```

Expected: FAIL — module not found for `../home-view.js`.

- [ ] **Step 3: Implement `home-view.ts`**

Create `packages/generator/src/home-view.ts`:

```ts
import type { NormalizedEntity } from '@lovelacer/shared'
import type {
  GlanceCard,
  GridSection,
  MarkdownCard,
  RoomView,
} from './lovelace-types.js'

/**
 * Home view shares RoomView's structural shape (sections layout). The
 * discriminator is the `path: 'home'` value, not the type itself.
 */
export type HomeView = RoomView

export interface BuildHomeViewInput {
  entities: NormalizedEntity[]
}

const PRESENCE_ID_PATTERN = /anyone[_-]?home|someone[_-]?home|presence/i

const GREETING_LINE =
  "## Good {{ now().strftime('%H')|int < 12 and 'morning' or now().strftime('%H')|int < 18 and 'afternoon' or 'evening' }}"

/**
 * Apply the quick-stats patterns to the input entities.
 *
 * Patterns are applied in declared order; the first match per pattern
 * is taken. Result is capped at 4 entities. Returns up to 4 entities
 * in pattern order; caller decides whether to render (the rule
 * "skip glance if <2" lives in `buildHomeView`, not here).
 */
export function pickQuickStatsEntities(entities: NormalizedEntity[]): NormalizedEntity[] {
  const finders: ((e: NormalizedEntity) => boolean)[] = [
    // Weather: any weather.* domain
    (e) => e.domain === 'weather',
    // Outdoor temperature: sensor + temperature deviceClass + outdoor/outside marker
    (e) =>
      e.domain === 'sensor' &&
      e.deviceClass === 'temperature' &&
      hasOutdoorMarker(e),
    // Outdoor humidity: sensor + humidity deviceClass + outdoor/outside marker
    (e) =>
      e.domain === 'sensor' &&
      e.deviceClass === 'humidity' &&
      hasOutdoorMarker(e),
    // Presence: binary_sensor + (presence deviceClass OR anyone_home/someone_home/presence in entityId)
    (e) =>
      e.domain === 'binary_sensor' &&
      (e.deviceClass === 'presence' || PRESENCE_ID_PATTERN.test(e.entityId)),
    // Power: sensor + power deviceClass
    (e) => e.domain === 'sensor' && e.deviceClass === 'power',
  ]

  const picked: NormalizedEntity[] = []
  for (const finder of finders) {
    if (picked.length >= 4) break
    const match = entities.find(finder)
    if (match !== undefined) picked.push(match)
  }
  return picked
}

function hasOutdoorMarker(entity: NormalizedEntity): boolean {
  const id = entity.entityId.toLowerCase()
  const name = entity.friendlyName.toLowerCase()
  return (
    id.includes('outdoor') ||
    id.includes('outside') ||
    name.includes('outdoor') ||
    name.includes('outside')
  )
}

/**
 * Build the dashboard's first view: Welcome markdown card + an
 * optional Quick stats glance card (dropped when fewer than 2
 * entities match the curated patterns).
 *
 * Pure function. Always emits the Welcome section.
 */
export function buildHomeView(input: BuildHomeViewInput): HomeView {
  const sections: GridSection[] = [buildWelcomeSection(input.entities)]
  const quickStats = buildQuickStatsSection(input.entities)
  if (quickStats !== null) sections.push(quickStats)
  return {
    type: 'sections',
    title: 'Home',
    path: 'home',
    icon: 'mdi:home-variant',
    sections,
  }
}

function buildWelcomeSection(entities: NormalizedEntity[]): GridSection {
  const weather = entities.find((e) => e.domain === 'weather')
  const content =
    weather !== undefined
      ? `${GREETING_LINE}\n\n{{ states('${weather.entityId}') }} · {{ state_attr('${weather.entityId}', 'temperature') }}°`
      : GREETING_LINE
  const card: MarkdownCard = { type: 'markdown', content }
  return { type: 'grid', cards: [card] }
}

function buildQuickStatsSection(entities: NormalizedEntity[]): GridSection | null {
  const picked = pickQuickStatsEntities(entities)
  if (picked.length < 2) return null
  const card: GlanceCard = {
    type: 'glance',
    title: 'Quick stats',
    entities: picked.map((e) => e.entityId),
  }
  return { type: 'grid', cards: [card] }
}
```

- [ ] **Step 4: Re-export from the package barrel**

Read `packages/generator/src/index.ts` first. Append the home-view exports below the existing room-view exports:

```ts
export { buildHomeView, pickQuickStatsEntities } from './home-view.js'
export type { BuildHomeViewInput, HomeView } from './home-view.js'
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/home-view.test.ts
```

Expected: PASS — about 25 tests.

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add packages/generator/src/home-view.ts \
        packages/generator/src/__tests__/home-view.test.ts \
        packages/generator/src/index.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(generator): buildHomeView + pickQuickStatsEntities

Pure functions that produce the dashboard's first view. Always emits
a Welcome section (markdown card with time-of-day greeting; optional
weather state line if a weather.* entity exists in input). Optionally
emits a Quick stats section (glance card with up to 4 entities matched
by curated patterns: weather, outdoor temperature, outdoor humidity,
presence, power). Glance section dropped if fewer than 2 entities
match — bare-minimum installs see Welcome only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Fixture-driven snapshot tests

**Files:**
- Create: `packages/generator/src/__tests__/home-view.fixtures.test.ts`

End-to-end runs against `english-cluttered` and `czech-tidy`. Pipes through `fixtureToHaRegistries → normalize` (no detect/groupByDomain needed since `buildHomeView` only reads the entity list). Locks structural snapshots plus anti-regression assertions.

- [ ] **Step 1: Write the test file**

Create `packages/generator/src/__tests__/home-view.fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { czechTidy } from '../../../../tests/fixtures/czech-tidy.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import type { Fixture } from '../../../../tests/fixtures/_builder/index.js'
import { normalize } from '@lovelacer/analyzer'
import { buildHomeView } from '../home-view.js'

function pipe(fixture: Fixture) {
  const ha = fixtureToHaRegistries(fixture)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const view = buildHomeView({ entities })
  return { entities, view }
}

function summarize(view: ReturnType<typeof pipe>['view']) {
  return {
    title: view.title,
    path: view.path,
    icon: view.icon,
    sections: view.sections.map((s) => ({
      cards: s.cards.map((c) => {
        if (c.type === 'glance') return { type: c.type, count: c.entities.length }
        if (c.type === 'markdown') return { type: c.type, hasWeather: c.content.includes("states('") }
        return { type: c.type }
      }),
    })),
  }
}

describe('buildHomeView — english-cluttered fixture', () => {
  const { entities, view } = pipe(englishCluttered)

  it('matches structural snapshot', () => {
    expect(summarize(view)).toMatchInlineSnapshot()
  })

  it('produces Welcome + Quick stats (fixture has Outdoor Temperature + Outdoor Humidity)', () => {
    expect(view.sections).toHaveLength(2)
  })

  it('every glance entityId exists in the input entity list', () => {
    const inputIds = new Set(entities.map((e) => e.entityId))
    for (const section of view.sections) {
      for (const card of section.cards) {
        if (card.type === 'glance') {
          for (const id of card.entities) {
            expect(inputIds.has(id)).toBe(true)
          }
        }
      }
    }
  })

  it('Welcome card is the first card in the first section', () => {
    expect(view.sections[0]!.cards[0]!.type).toBe('markdown')
  })
})

describe('buildHomeView — czech-tidy fixture', () => {
  const { view } = pipe(czechTidy)

  it('matches structural snapshot', () => {
    expect(summarize(view)).toMatchInlineSnapshot()
  })

  it('produces Welcome only (czech-tidy has no outdoor/weather/presence/power entities)', () => {
    expect(view.sections).toHaveLength(1)
    expect(view.sections[0]!.cards[0]!.type).toBe('markdown')
  })
})
```

- [ ] **Step 2: Generate the snapshots**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/home-view.fixtures.test.ts --update
```

Expected: PASS. The two `toMatchInlineSnapshot()` calls populate.

Open the file and inspect the snapshots:

- english-cluttered: 2 sections — Welcome (markdown without weather since the fixture has no weather entity) + Quick stats with 2 entities (Outdoor Temperature + Outdoor Humidity).
- czech-tidy: 1 section — Welcome only (no weather, no outdoor, no presence, no power in the fixture).

Sanity-check before continuing. If the english-cluttered Welcome shows `hasWeather: true`, that's a real signal — the fixture doesn't have a weather entity so this would mean the picker's pattern is over-matching.

- [ ] **Step 3: Re-run without `--update` to confirm stability**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/home-view.fixtures.test.ts
```

Expected: PASS — all assertions including the populated snapshots.

- [ ] **Step 4: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
pnpm --dir <worktree> format:check
pnpm --dir <worktree> lint
```

All green. If `format:check` fails, run `pnpm format` and stage the changes.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add packages/generator/src/__tests__/home-view.fixtures.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
test(generator): buildHomeView end-to-end on english-cluttered + czech-tidy

Pipes each fixture through fixtureToHaRegistries → normalize →
buildHomeView and locks the structural shape via inline snapshots.
- english-cluttered: Welcome + Quick stats (Outdoor Temperature +
  Outdoor Humidity from the fixture's named entities).
- czech-tidy: Welcome only (no outdoor/weather/presence/power
  entities in the fixture, so glance is dropped under the <2 rule).

Anti-regression: every entityId in the home view's glance card
exists in the input entity list.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1a-7 Acceptance Confirmation

- [ ] `buildHomeView`, `pickQuickStatsEntities`, `HomeView` type, and the new card types (`MarkdownCard`, `GlanceCard`) exported from `@lovelacer/generator`.
- [ ] All unit tests in `home-view.test.ts` pass.
- [ ] Fixture snapshot tests in `home-view.fixtures.test.ts` pass for both fixtures.
- [ ] Snapshots reviewed for sanity (english-cluttered: Welcome + Quick stats with 2 entities; czech-tidy: Welcome only).
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm lint` clean.
