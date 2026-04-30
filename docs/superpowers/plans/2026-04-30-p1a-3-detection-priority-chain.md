# P1a-3 Detection Priority Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the 5-level priority chain (`entity_area`, `device_area`, `friendly_name`, `entity_id`, `device_name`) into a pure `detect(input)` function in `@lovelacer/analyzer`, producing one `RoomAssignment` per input entity. Ship the `czech-tidy` fixture alongside.

**Architecture:** Per-entity work in `detectEntity(entity, ctx)`; bulk wrapper `detect({ entities, areas })` builds the area-name-to-canonical context once via `buildDetectionContext` then maps each entity through `detectEntity`. All priorities run (no short-circuit); final `roomId` is the target of the highest-weight fired signal; final `confidence` is that weight. Misc fallback when nothing fires.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), Vitest. No new runtime dependencies.

**Spec reference:** [`docs/superpowers/specs/2026-04-30-p1a-3-detection-priority-chain-design.md`](../specs/2026-04-30-p1a-3-detection-priority-chain-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions.
- Type-only imports use `import type { … } from '…'`.
- Tests use `import { describe, it, expect } from 'vitest'`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- Run `pnpm` from the worktree (`pnpm --dir <worktree>`); `git -C <worktree>`.

---

## Task 1: `czech-tidy` fixture + self-tests

**Files:**
- Create: `tests/fixtures/czech-tidy.ts`
- Create: `tests/fixtures/__tests__/czech-tidy.test.ts`

The fixture is needed by Task 6's fixture-driven tests. Build it first so it can stabilize independently. Uses existing P0-2 builder helpers (`floor`, `area`, `device`, `light`, `switch_`, `tempSensor`, `humiditySensor`, `motion`, `occupancy`, `door`, `climate`, `registryEntry`).

- [ ] **Step 1: Write the failing self-tests**

Create `tests/fixtures/__tests__/czech-tidy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { czechTidy } from '../czech-tidy.js'

const fx = czechTidy

describe('czech-tidy fixture', () => {
  it('has exactly five rooms (areas)', () => {
    expect(fx.areas).toHaveLength(5)
  })

  it('has between 75 and 90 entities', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(75)
    expect(fx.entities.length).toBeLessThanOrEqual(90)
  })

  it('declares two floors', () => {
    expect(fx.floors).toHaveLength(2)
  })

  it('100% of entities have non-null area attribution', () => {
    const withArea = fx.entities.filter((e) => e.area !== null).length
    expect(withArea).toBe(fx.entities.length)
  })

  it('has 0 hidden entities', () => {
    expect(fx.entities.some((e) => e.hidden)).toBe(false)
  })

  it('has 0 disabled entities', () => {
    expect(fx.entities.some((e) => e.disabled)).toBe(false)
  })

  it('all area names contain Czech-language characters or recognizable Czech keywords', () => {
    const czechMarkerOrPattern = /[áčďéěíňóřšťúůýž]|kuchyne|pokoj|loznice|koupelna|kancelar/i
    for (const area of fx.areas) {
      expect(area.name, `area "${area.name}" should look Czech`).toMatch(czechMarkerOrPattern)
    }
  })

  it('all entities have Czech-influenced friendly names', () => {
    // Each name must contain at least one Czech diacritic OR a Czech room/object word.
    const czechMarker = /[áčďéěíňóřšťúůýž]|kuchyne|loznice|koupelna|svetlo|teplota|vlhkost|pohyb/i
    for (const e of fx.entities) {
      expect(e.originalName, `entity "${e.originalName}" should look Czech`).toMatch(czechMarker)
    }
  })

  it('contains every P1a domain (light, switch, sensor, binary_sensor, climate)', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['light', 'switch', 'sensor', 'binary_sensor', 'climate'] as const) {
      expect(domains).toContain(d)
    }
  })

  it('passes the fixture validator (no dangling references, no duplicates)', () => {
    expect(fx.meta.name).toBe('czech-tidy')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir <worktree> vitest run tests/fixtures/__tests__/czech-tidy.test.ts
```

Expected: FAIL — module not found for `../czech-tidy.js`.

- [ ] **Step 3: Author the fixture**

Create `tests/fixtures/czech-tidy.ts`:

```ts
import {
  area,
  climate,
  device,
  fixture,
  floor,
  humiditySensor,
  light,
  motion,
  occupancy,
  registryEntry,
  switch_,
  tempSensor,
} from './_builder/index.js'

const FX = 'czech-tidy'

const ground = floor('Přízemí', { level: 0, icon: 'mdi:home-floor-g' })
const upstairs = floor('Patro', { level: 1, icon: 'mdi:home-floor-1' })

const livingRoom = area('Obývací pokoj', { floor: ground.id, icon: 'mdi:sofa' })
const kitchen = area('Kuchyně', { floor: ground.id, icon: 'mdi:silverware-fork-knife' })
const bathroom = area('Koupelna', { floor: ground.id, icon: 'mdi:shower' })
const bedroom = area('Ložnice', { floor: upstairs.id, icon: 'mdi:bed' })
const office = area('Kancelář', { floor: upstairs.id, icon: 'mdi:desk' })

const lrHue = device('Obývací pokoj Hue', { manufacturer: 'Philips', area: livingRoom.id })
const lrAqara = device('Obývací pokoj Aqara TH', { manufacturer: 'Aqara', area: livingRoom.id })
const lrThermostat = device('Obývací pokoj Tado', { manufacturer: 'tado', area: livingRoom.id })

const kitchenHue = device('Kuchyně Hue', { manufacturer: 'Philips', area: kitchen.id })
const kitchenAqara = device('Kuchyně Aqara TH', { manufacturer: 'Aqara', area: kitchen.id })

const bathHue = device('Koupelna Hue', { manufacturer: 'Philips', area: bathroom.id })
const bathAqara = device('Koupelna Aqara TH', { manufacturer: 'Aqara', area: bathroom.id })

const bedHue = device('Ložnice Hue', { manufacturer: 'Philips', area: bedroom.id })
const bedThermostat = device('Ložnice Tado', { manufacturer: 'tado', area: bedroom.id })

const officeHue = device('Kancelář Hue', { manufacturer: 'Philips', area: office.id })

const livingRoomEntities = [
  light(FX, 'Obývací pokoj stropní světlo', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Obývací pokoj lampa vlevo', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Obývací pokoj lampa vpravo', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Obývací pokoj bodové 1', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Obývací pokoj bodové 2', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Obývací pokoj bodové 3', { area: livingRoom.id, device: lrHue.id }),
  switch_(FX, 'Obývací pokoj zásuvka televize', { area: livingRoom.id }),
  switch_(FX, 'Obývací pokoj podlahové topení', { area: livingRoom.id }),
  tempSensor(FX, 'Obývací pokoj teplota', { area: livingRoom.id, device: lrAqara.id }),
  humiditySensor(FX, 'Obývací pokoj vlhkost', { area: livingRoom.id, device: lrAqara.id }),
  climate(FX, 'Obývací pokoj termostat', { area: livingRoom.id, device: lrThermostat.id }),
  motion(FX, 'Obývací pokoj pohyb', { area: livingRoom.id }),
  occupancy(FX, 'Obývací pokoj obsazenost gauče', { area: livingRoom.id }),
  registryEntry(FX, 'sensor', 'Hue Bridge ZigBee kanál', {
    area: livingRoom.id,
    device: lrHue.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Hue Bridge verze software', {
    area: livingRoom.id,
    device: lrHue.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Tado baterie', {
    area: livingRoom.id,
    device: lrThermostat.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Aqara baterie obývák', {
    area: livingRoom.id,
    device: lrAqara.id,
    entityCategory: 'diagnostic',
  }),
  light(FX, 'Obývací pokoj nálada', { area: livingRoom.id, device: lrHue.id }),
  switch_(FX, 'Obývací pokoj ventilátor', { area: livingRoom.id }),
  switch_(FX, 'Obývací pokoj zvlhčovač', { area: livingRoom.id }),
  registryEntry(FX, 'sensor', 'Obývací pokoj jas', { area: livingRoom.id }),
  registryEntry(FX, 'sensor', 'Obývací pokoj CO2', { area: livingRoom.id }),
]

const kitchenEntities = [
  light(FX, 'Kuchyně stropní světlo', { area: kitchen.id, device: kitchenHue.id }),
  light(FX, 'Kuchyně linka', { area: kitchen.id, device: kitchenHue.id }),
  light(FX, 'Kuchyně závěsné světlo', { area: kitchen.id, device: kitchenHue.id }),
  switch_(FX, 'Kuchyně varná konvice', { area: kitchen.id }),
  switch_(FX, 'Kuchyně kávovar', { area: kitchen.id }),
  switch_(FX, 'Kuchyně myčka', { area: kitchen.id }),
  switch_(FX, 'Kuchyně topinkovač', { area: kitchen.id }),
  switch_(FX, 'Kuchyně lednice', { area: kitchen.id }),
  tempSensor(FX, 'Kuchyně teplota', { area: kitchen.id, device: kitchenAqara.id }),
  humiditySensor(FX, 'Kuchyně vlhkost', { area: kitchen.id, device: kitchenAqara.id }),
  motion(FX, 'Kuchyně pohyb', { area: kitchen.id }),
  occupancy(FX, 'Kuchyně obsazenost dřezu', { area: kitchen.id }),
  tempSensor(FX, 'Kuchyně teplota lednice', { area: kitchen.id }),
  tempSensor(FX, 'Kuchyně teplota mrazáku', { area: kitchen.id }),
  registryEntry(FX, 'sensor', 'Kuchyně jas', { area: kitchen.id }),
  registryEntry(FX, 'sensor', 'Aqara baterie kuchyně', {
    area: kitchen.id,
    device: kitchenAqara.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Kuchyně CO2', { area: kitchen.id }),
  switch_(FX, 'Kuchyně digestoř', { area: kitchen.id }),
]

const bathroomEntities = [
  light(FX, 'Koupelna stropní světlo', { area: bathroom.id, device: bathHue.id }),
  light(FX, 'Koupelna zrcadlo', { area: bathroom.id, device: bathHue.id }),
  motion(FX, 'Koupelna pohyb', { area: bathroom.id }),
  occupancy(FX, 'Koupelna obsazenost sprchy', { area: bathroom.id }),
  tempSensor(FX, 'Koupelna teplota', { area: bathroom.id, device: bathAqara.id }),
  humiditySensor(FX, 'Koupelna vlhkost', { area: bathroom.id, device: bathAqara.id }),
  switch_(FX, 'Koupelna ventilátor', { area: bathroom.id }),
  switch_(FX, 'Koupelna topný žebřík', { area: bathroom.id }),
  registryEntry(FX, 'sensor', 'Aqara baterie koupelna', {
    area: bathroom.id,
    device: bathAqara.id,
    entityCategory: 'diagnostic',
  }),
  humiditySensor(FX, 'Koupelna pára', { area: bathroom.id }),
]

const bedroomEntities = [
  light(FX, 'Ložnice stropní světlo', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Ložnice noční stolek vlevo', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Ložnice noční stolek vpravo', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Ložnice čtecí lampa', { area: bedroom.id, device: bedHue.id }),
  climate(FX, 'Ložnice termostat', { area: bedroom.id, device: bedThermostat.id }),
  motion(FX, 'Ložnice pohyb', { area: bedroom.id }),
  occupancy(FX, 'Ložnice obsazenost postele', { area: bedroom.id }),
  tempSensor(FX, 'Ložnice teplota', { area: bedroom.id }),
  humiditySensor(FX, 'Ložnice vlhkost', { area: bedroom.id }),
  light(FX, 'Ložnice nálada', { area: bedroom.id, device: bedHue.id }),
  switch_(FX, 'Ložnice zvlhčovač', { area: bedroom.id }),
  switch_(FX, 'Ložnice ventilátor', { area: bedroom.id }),
  tempSensor(FX, 'Ložnice teplota u postele', { area: bedroom.id }),
  registryEntry(FX, 'sensor', 'Tado baterie ložnice', {
    area: bedroom.id,
    device: bedThermostat.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Tado signál ložnice', {
    area: bedroom.id,
    device: bedThermostat.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Ložnice jas', { area: bedroom.id }),
  registryEntry(FX, 'sensor', 'Ložnice CO2', { area: bedroom.id }),
  motion(FX, 'Ložnice pohyb u skříně', { area: bedroom.id }),
]

const officeEntities = [
  light(FX, 'Kancelář stropní světlo', { area: office.id, device: officeHue.id }),
  light(FX, 'Kancelář stolní lampa', { area: office.id, device: officeHue.id }),
  light(FX, 'Kancelář knihovna', { area: office.id, device: officeHue.id }),
  switch_(FX, 'Kancelář zásuvka PC', { area: office.id }),
  switch_(FX, 'Kancelář zásuvka monitor', { area: office.id }),
  switch_(FX, 'Kancelář 3D tiskárna', { area: office.id }),
  tempSensor(FX, 'Kancelář teplota', { area: office.id }),
  humiditySensor(FX, 'Kancelář vlhkost', { area: office.id }),
  motion(FX, 'Kancelář pohyb', { area: office.id }),
  occupancy(FX, 'Kancelář obsazenost židle', { area: office.id }),
  tempSensor(FX, 'Kancelář teplota serveru', { area: office.id }),
  registryEntry(FX, 'sensor', 'Kancelář jas', { area: office.id }),
]

export const czechTidy = fixture({
  meta: {
    name: 'czech-tidy',
    description:
      '~80 entities across 5 well-set-up Czech rooms (Obývací pokoj, Kuchyně, ' +
      'Koupelna, Ložnice, Kancelář) on 2 floors. 100% area-attributed; no hidden, ' +
      'disabled, or ambiguous-named entries. Contrast fixture for the analyzer ' +
      'when english-cluttered exercises the messy-input paths.',
  },
  floors: [ground, upstairs],
  areas: [livingRoom, kitchen, bathroom, bedroom, office],
  devices: [
    lrHue, lrAqara, lrThermostat,
    kitchenHue, kitchenAqara,
    bathHue, bathAqara,
    bedHue, bedThermostat,
    officeHue,
  ],
  entities: [
    ...livingRoomEntities,
    ...kitchenEntities,
    ...bathroomEntities,
    ...bedroomEntities,
    ...officeEntities,
  ],
})
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run tests/fixtures/__tests__/czech-tidy.test.ts
```

Expected: PASS (10 tests).

If a self-test fails (e.g., entity count outside 75-90, or a name doesn't look Czech), tweak the fixture entity lists rather than relax the assertion. The thresholds are the contract.

- [ ] **Step 5: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green. The full root-vitest test count goes up by 10.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add tests/fixtures/czech-tidy.ts tests/fixtures/__tests__/czech-tidy.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(fixtures): add czech-tidy fixture with self-tests

~80 entities across 5 Czech rooms (Obývací pokoj, Kuchyně, Koupelna,
Ložnice, Kancelář) on 2 floors. Deliberately tidy: 100% area-attributed,
0 hidden, 0 disabled, all friendly names use Czech terms or diacritics.
Contrast fixture for P1a-3's detection chain — english-cluttered tests
messy-input paths, czech-tidy verifies the clean-input path through to
0 misc bucket entries.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Detection types + `buildDetectionContext`

**Files:**
- Create: `packages/analyzer/src/detect.ts` (initial — types + context builder only)
- Create: `packages/analyzer/src/__tests__/detect.test.ts` (initial — context tests)

This task lays down the type surface and the context builder. `detectEntity` and `detect` come in subsequent tasks.

- [ ] **Step 1: Write the failing test**

Create `packages/analyzer/src/__tests__/detect.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { HaAreaRegistryEntry } from '@lovelacer/shared'
import { buildDetectionContext } from '../detect.js'

describe('buildDetectionContext', () => {
  it('returns an empty index for empty input', () => {
    const ctx = buildDetectionContext([])
    expect(ctx.areaIndex.size).toBe(0)
  })

  it('maps area whose name matches a canonical via findRoom', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'living_room', name: 'Living Room', floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    const entry = ctx.areaIndex.get('living_room')
    expect(entry).toBeDefined()
    expect(entry!.name).toBe('Living Room')
    expect(entry!.canonical).toBe('living_room')
  })

  it('maps Czech area name via diacritic-stripping pipeline', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'loznice', name: 'Ložnice', floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    const entry = ctx.areaIndex.get('loznice')
    expect(entry!.canonical).toBe('bedroom')
  })

  it('records canonical=null when area name does not map', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'barts_den', name: "Bart's Den", floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    const entry = ctx.areaIndex.get('barts_den')
    expect(entry).toBeDefined()
    expect(entry!.name).toBe("Bart's Den")
    expect(entry!.canonical).toBeNull()
  })

  it('builds one entry per input area', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'living_room', name: 'Living Room', floor_id: null, icon: null },
      { area_id: 'kitchen', name: 'Kitchen', floor_id: null, icon: null },
      { area_id: 'unknown', name: "Bart's Den", floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    expect(ctx.areaIndex.size).toBe(3)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.test.ts
```

Expected: FAIL — module not found for `../detect.js`.

- [ ] **Step 3: Write the initial detect.ts (types + context only)**

Create `packages/analyzer/src/detect.ts`:

```ts
import type {
  CanonicalRoomId,
  HaAreaRegistryEntry,
  NormalizedEntity,
  RoomAssignment,
} from '@lovelacer/shared'
import { findRoom } from './match-room.js'

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
   * Maps HA area_id → AreaIndexEntry. Absence from the map means the
   * area_id doesn't exist in the input areas list at all (stale registry);
   * priorities 1/2 treat that the same as a null canonical (they don't fire).
   */
  areaIndex: ReadonlyMap<string, AreaIndexEntry>
}

export interface DetectInput {
  entities: NormalizedEntity[]
  areas: HaAreaRegistryEntry[]
}

export function buildDetectionContext(areas: HaAreaRegistryEntry[]): DetectionContext {
  const areaIndex = new Map<string, AreaIndexEntry>()
  for (const area of areas) {
    const match = findRoom(area.name)
    areaIndex.set(area.area_id, {
      name: area.name,
      canonical: match !== null ? match.canonical : null,
    })
  }
  return { areaIndex }
}

// detectEntity and detect land in subsequent tasks.
// Suppress the unused-imports warning by referencing them as types only here.
export type _Internal_NormalizedEntity = NormalizedEntity
export type _Internal_RoomAssignment = RoomAssignment
```

> **Note on the "_Internal" type re-exports:** TypeScript's `noUnusedLocals` (set in the base tsconfig) flags imports that aren't used in the module. Since `NormalizedEntity` and `RoomAssignment` will be used by `detectEntity` and `detect` in Tasks 3-5 but aren't yet, the placeholder type re-exports keep typecheck green. **Remove these placeholder re-exports in Task 5** when both consumers exist.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add packages/analyzer/src/detect.ts packages/analyzer/src/__tests__/detect.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(analyzer): detection context + types

Lays down DetectInput, DetectionContext, AreaIndexEntry, and the
buildDetectionContext helper that runs findRoom on each area's name
once and caches the result. detectEntity and detect land in the
follow-up commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `detectEntity` — Priorities 1 + 2 (area-based)

**Files:**
- Modify: `packages/analyzer/src/detect.ts`
- Modify: `packages/analyzer/src/__tests__/detect.test.ts`

Implement `detectEntity` with priorities 1 (entity_area) and 2 (device_area), plus the misc fallback. Priorities 3-5 land in Task 4.

- [ ] **Step 1: Add the failing tests for `detectEntity`**

Append to `packages/analyzer/src/__tests__/detect.test.ts`. First, extend the existing imports to include `NormalizedEntity` and `detectEntity`:

```ts
import type { HaAreaRegistryEntry, NormalizedEntity } from '@lovelacer/shared'
import { buildDetectionContext, detectEntity } from '../detect.js'
```

Then append a new `describe` block at the bottom of the file:

```ts
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

const livingRoomArea: HaAreaRegistryEntry = {
  area_id: 'living_room',
  name: 'Living Room',
  floor_id: null,
  icon: null,
}

const bartsAreaUnmappable: HaAreaRegistryEntry = {
  area_id: 'barts_den',
  name: "Bart's Den",
  floor_id: null,
  icon: null,
}

describe('detectEntity — fallback', () => {
  it('returns roomId=misc with confidence 0 and no signals when nothing fires', () => {
    const ctx = buildDetectionContext([])
    const result = detectEntity(baseEntity, ctx)
    expect(result.entityId).toBe('sensor.test')
    expect(result.roomId).toBe('misc')
    expect(result.confidence).toBe(0)
    expect(result.signals).toEqual([])
  })
})

describe('detectEntity — priority 1 (entity_area)', () => {
  const ctx = buildDetectionContext([livingRoomArea, bartsAreaUnmappable])

  it('fires with weight 1.0 when entity area name maps to a canonical', () => {
    const result = detectEntity({ ...baseEntity, haAreaId: 'living_room' }, ctx)
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0)
    expect(result.signals).toContainEqual({
      source: 'entity_area',
      weight: 1.0,
      matchedValue: 'Living Room',
    })
  })

  it('does NOT fire when entity area name does not map (canonical=null)', () => {
    const result = detectEntity({ ...baseEntity, haAreaId: 'barts_den' }, ctx)
    expect(result.signals.find((s) => s.source === 'entity_area')).toBeUndefined()
    expect(result.roomId).toBe('misc')
  })

  it('does NOT fire when entity area is absent from the index', () => {
    const result = detectEntity({ ...baseEntity, haAreaId: 'nonexistent' }, ctx)
    expect(result.signals.find((s) => s.source === 'entity_area')).toBeUndefined()
    expect(result.roomId).toBe('misc')
  })

  it('does NOT fire when haAreaId is null', () => {
    const result = detectEntity({ ...baseEntity, haAreaId: null }, ctx)
    expect(result.signals.find((s) => s.source === 'entity_area')).toBeUndefined()
  })
})

describe('detectEntity — priority 2 (device_area)', () => {
  const ctx = buildDetectionContext([livingRoomArea])

  it('fires with weight 0.85 when device.haAreaId maps and entity has no own area', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: null,
        device: {
          id: 'dev1',
          name: 'Sensor',
          nameByUser: null,
          manufacturer: null,
          model: null,
          haAreaId: 'living_room',
        },
      },
      ctx,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(0.85)
    expect(result.signals).toContainEqual({
      source: 'device_area',
      weight: 0.85,
      matchedValue: 'Living Room',
    })
  })

  it('does NOT fire when entity.device is null', () => {
    const result = detectEntity({ ...baseEntity, device: null }, ctx)
    expect(result.signals.find((s) => s.source === 'device_area')).toBeUndefined()
  })

  it('does NOT fire when device.haAreaId is null', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        device: {
          id: 'dev1',
          name: 'Sensor',
          nameByUser: null,
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctx,
    )
    expect(result.signals.find((s) => s.source === 'device_area')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.test.ts
```

Expected: FAIL — `detectEntity` is not exported.

- [ ] **Step 3: Implement priorities 1+2 + fallback**

Edit `packages/analyzer/src/detect.ts`. Remove the placeholder `_Internal_*` re-exports and add `detectEntity`:

```ts
import type {
  CanonicalRoomId,
  DetectionSignal,
  HaAreaRegistryEntry,
  NormalizedEntity,
  RoomAssignment,
} from '@lovelacer/shared'
import { findRoom } from './match-room.js'

export interface AreaIndexEntry {
  name: string
  canonical: Exclude<CanonicalRoomId, 'misc'> | null
}

export interface DetectionContext {
  areaIndex: ReadonlyMap<string, AreaIndexEntry>
}

export interface DetectInput {
  entities: NormalizedEntity[]
  areas: HaAreaRegistryEntry[]
}

export function buildDetectionContext(areas: HaAreaRegistryEntry[]): DetectionContext {
  const areaIndex = new Map<string, AreaIndexEntry>()
  for (const area of areas) {
    const match = findRoom(area.name)
    areaIndex.set(area.area_id, {
      name: area.name,
      canonical: match !== null ? match.canonical : null,
    })
  }
  return { areaIndex }
}

interface FiredSignal extends DetectionSignal {
  /** The canonical room this signal targets. */
  target: Exclude<CanonicalRoomId, 'misc'>
}

export function detectEntity(entity: NormalizedEntity, ctx: DetectionContext): RoomAssignment {
  const fired: FiredSignal[] = []

  // Priority 1 — entity_area
  if (entity.haAreaId !== null) {
    const entry = ctx.areaIndex.get(entity.haAreaId)
    if (entry !== undefined && entry.canonical !== null) {
      fired.push({
        source: 'entity_area',
        weight: 1.0,
        matchedValue: entry.name,
        target: entry.canonical,
      })
    }
  }

  // Priority 2 — device_area
  if (entity.device !== null && entity.device.haAreaId !== null) {
    const entry = ctx.areaIndex.get(entity.device.haAreaId)
    if (entry !== undefined && entry.canonical !== null) {
      fired.push({
        source: 'device_area',
        weight: 0.85,
        matchedValue: entry.name,
        target: entry.canonical,
      })
    }
  }

  return assemble(entity.entityId, fired)
}

function assemble(entityId: string, fired: FiredSignal[]): RoomAssignment {
  if (fired.length === 0) {
    return { entityId, roomId: 'misc', confidence: 0, signals: [] }
  }
  // Highest-weight target wins; ties broken by priority (insertion) order.
  let winner = fired[0]!
  for (const s of fired) {
    if (s.weight > winner.weight) winner = s
  }
  // Strip the internal `target` field before exposing signals publicly.
  const signals: DetectionSignal[] = fired.map(({ target: _t, ...rest }) => rest)
  return {
    entityId,
    roomId: winner.target,
    confidence: winner.weight,
    signals,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.test.ts
```

Expected: PASS (12 tests — 5 from Task 2 + 7 new).

- [ ] **Step 5: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add packages/analyzer/src/detect.ts packages/analyzer/src/__tests__/detect.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(analyzer): detectEntity priorities 1+2 (area-based)

Wires entity_area (weight 1.0) and device_area (weight 0.85) signals
through the precomputed area index. Misc fallback when nothing fires.
Priorities 3-5 (findRoom-based) land in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `detectEntity` — Priorities 3 + 4 + 5 (findRoom-based)

**Files:**
- Modify: `packages/analyzer/src/detect.ts`
- Modify: `packages/analyzer/src/__tests__/detect.test.ts`

Wire the friendly_name (priority 3, weight 0.6), entity_id (priority 4, weight 0.5), and device_name (priority 5, weight 0.45) signals via `findRoom`.

- [ ] **Step 1: Add the failing tests**

Append to `packages/analyzer/src/__tests__/detect.test.ts`:

```ts
describe('detectEntity — priority 3 (friendly_name)', () => {
  const ctx = buildDetectionContext([])

  it('fires with weight 0.6 when findRoom matches the friendly name', () => {
    const result = detectEntity(
      { ...baseEntity, friendlyName: 'Living Room Light' },
      ctx,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(0.6)
    expect(result.signals).toContainEqual(
      expect.objectContaining({
        source: 'friendly_name',
        weight: 0.6,
      }),
    )
  })

  it('does NOT fire when friendly name has no canonical match', () => {
    const result = detectEntity(
      { ...baseEntity, friendlyName: 'random gibberish' },
      ctx,
    )
    expect(result.signals.find((s) => s.source === 'friendly_name')).toBeUndefined()
  })
})

describe('detectEntity — priority 4 (entity_id)', () => {
  const ctx = buildDetectionContext([])

  it('fires with weight 0.5 when findRoom matches the objectId', () => {
    const result = detectEntity(
      { ...baseEntity, friendlyName: 'Sensor 4', objectId: 'kitchen_temp_4' },
      ctx,
    )
    const sig = result.signals.find((s) => s.source === 'entity_id')
    expect(sig).toBeDefined()
    expect(sig!.weight).toBe(0.5)
    // friendly_name doesn't match "Sensor 4", so entity_id is the highest-weight signal
    expect(result.roomId).toBe('kitchen')
  })
})

describe('detectEntity — priority 5 (device_name)', () => {
  const ctx = buildDetectionContext([])

  it('fires with weight 0.45 from device.nameByUser when set', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        friendlyName: 'Sensor',
        device: {
          id: 'dev1',
          name: 'Generic Device',
          nameByUser: 'Bedroom Sensor Hub',
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctx,
    )
    expect(result.signals).toContainEqual(
      expect.objectContaining({
        source: 'device_name',
        weight: 0.45,
      }),
    )
    expect(result.roomId).toBe('bedroom')
  })

  it('falls back to device.name when nameByUser is null', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        friendlyName: 'Sensor',
        device: {
          id: 'dev1',
          name: 'Bathroom Aqara TH',
          nameByUser: null,
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctx,
    )
    const sig = result.signals.find((s) => s.source === 'device_name')
    expect(sig).toBeDefined()
    expect(result.roomId).toBe('bathroom')
  })

  it('does NOT fire when device is null', () => {
    const result = detectEntity({ ...baseEntity, device: null }, ctx)
    expect(result.signals.find((s) => s.source === 'device_name')).toBeUndefined()
  })

  it('prefers nameByUser over name when both have canonical matches', () => {
    // nameByUser says bedroom; name says bathroom. nameByUser wins.
    const result = detectEntity(
      {
        ...baseEntity,
        friendlyName: 'Sensor',
        device: {
          id: 'dev1',
          name: 'Bathroom Aqara TH',
          nameByUser: 'Bedroom Sensor Hub',
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctx,
    )
    expect(result.roomId).toBe('bedroom')
  })
})

describe('detectEntity — multi-signal aggregation', () => {
  const livingRoomArea: HaAreaRegistryEntry = {
    area_id: 'living_room',
    name: 'Living Room',
    floor_id: null,
    icon: null,
  }
  const ctx = buildDetectionContext([livingRoomArea])

  it('records all fired signals when multiple priorities match the same room', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Living Room Light',
        objectId: 'living_room_light',
      },
      ctx,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0) // highest weight wins
    const sources = result.signals.map((s) => s.source).sort()
    expect(sources).toEqual(['entity_area', 'entity_id', 'friendly_name'])
  })

  it('picks the highest-weight target when priorities point to different rooms', () => {
    // Priority 1 (1.0) says living_room; priority 3 (0.6) says kitchen.
    // Priority 1 wins as roomId; both signals stay in `signals[]`.
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Kitchen Light',
      },
      ctx,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0)
    expect(result.signals.map((s) => s.source).sort()).toEqual([
      'entity_area',
      'friendly_name',
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.test.ts
```

Expected: FAIL — priorities 3-5 not yet implemented.

- [ ] **Step 3: Add priorities 3, 4, 5 to `detectEntity`**

Edit `packages/analyzer/src/detect.ts`. Replace the existing `detectEntity` function with:

```ts
export function detectEntity(entity: NormalizedEntity, ctx: DetectionContext): RoomAssignment {
  const fired: FiredSignal[] = []

  // Priority 1 — entity_area
  if (entity.haAreaId !== null) {
    const entry = ctx.areaIndex.get(entity.haAreaId)
    if (entry !== undefined && entry.canonical !== null) {
      fired.push({
        source: 'entity_area',
        weight: 1.0,
        matchedValue: entry.name,
        target: entry.canonical,
      })
    }
  }

  // Priority 2 — device_area
  if (entity.device !== null && entity.device.haAreaId !== null) {
    const entry = ctx.areaIndex.get(entity.device.haAreaId)
    if (entry !== undefined && entry.canonical !== null) {
      fired.push({
        source: 'device_area',
        weight: 0.85,
        matchedValue: entry.name,
        target: entry.canonical,
      })
    }
  }

  // Priority 3 — friendly_name
  const fnMatch = findRoom(entity.friendlyName)
  if (fnMatch !== null) {
    fired.push({
      source: 'friendly_name',
      weight: 0.6,
      matchedValue: fnMatch.pattern,
      target: fnMatch.canonical,
    })
  }

  // Priority 4 — entity_id (objectId)
  const idMatch = findRoom(entity.objectId)
  if (idMatch !== null) {
    fired.push({
      source: 'entity_id',
      weight: 0.5,
      matchedValue: idMatch.pattern,
      target: idMatch.canonical,
    })
  }

  // Priority 5 — device_name (prefer nameByUser, fall back to name)
  if (entity.device !== null) {
    const candidates = [entity.device.nameByUser, entity.device.name].filter(
      (s): s is string => s !== null,
    )
    for (const name of candidates) {
      const match = findRoom(name)
      if (match !== null) {
        fired.push({
          source: 'device_name',
          weight: 0.45,
          matchedValue: match.pattern,
          target: match.canonical,
        })
        break
      }
    }
  }

  return assemble(entity.entityId, fired)
}
```

The rest of the file (types, `buildDetectionContext`, `assemble`) is unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.test.ts
```

Expected: PASS — 12 + new ones from this task. (Roughly 20-22 tests total in this file.)

- [ ] **Step 5: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add packages/analyzer/src/detect.ts packages/analyzer/src/__tests__/detect.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(analyzer): detectEntity priorities 3+4+5 (findRoom-based)

friendly_name (0.6), entity_id (0.5), and device_name (0.45) signals
all run findRoom on the relevant entity field. device_name prefers
nameByUser over name. All five priorities now run; highest-weight
target wins as roomId; all fired signals appear in signals[].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Bulk `detect` + re-exports

**Files:**
- Modify: `packages/analyzer/src/detect.ts`
- Modify: `packages/analyzer/src/__tests__/detect.test.ts`
- Modify: `packages/analyzer/src/index.ts`

- [ ] **Step 1: Add the failing tests**

Append to `packages/analyzer/src/__tests__/detect.test.ts`:

```ts
describe('detect — bulk API', () => {
  it('returns empty array for empty input', () => {
    const result = detect({ entities: [], areas: [] })
    expect(result).toEqual([])
  })

  it('produces one assignment per input entity, preserving order', () => {
    const livingRoomArea: HaAreaRegistryEntry = {
      area_id: 'living_room',
      name: 'Living Room',
      floor_id: null,
      icon: null,
    }
    const entities: NormalizedEntity[] = [
      { ...baseEntity, entityId: 'sensor.a', haAreaId: 'living_room' },
      { ...baseEntity, entityId: 'sensor.b', friendlyName: 'Kitchen Light' },
      { ...baseEntity, entityId: 'sensor.c' }, // no signals
    ]
    const result = detect({ entities, areas: [livingRoomArea] })
    expect(result.map((r) => r.entityId)).toEqual(['sensor.a', 'sensor.b', 'sensor.c'])
    expect(result[0]!.roomId).toBe('living_room')
    expect(result[1]!.roomId).toBe('kitchen')
    expect(result[2]!.roomId).toBe('misc')
  })
})
```

You'll also need to extend the import on the test file's first lines:

```ts
import { buildDetectionContext, detect, detectEntity } from '../detect.js'
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.test.ts
```

Expected: FAIL — `detect` not exported.

- [ ] **Step 3: Add `detect`**

Edit `packages/analyzer/src/detect.ts`. Append at the bottom (after `assemble`):

```ts
export function detect(input: DetectInput): RoomAssignment[] {
  const ctx = buildDetectionContext(input.areas)
  return input.entities.map((entity) => detectEntity(entity, ctx))
}
```

- [ ] **Step 4: Re-export from analyzer barrel**

Read `packages/analyzer/src/index.ts` first. Append:

```ts
export { buildDetectionContext, detect, detectEntity } from './detect.js'
export type { AreaIndexEntry, DetectInput, DetectionContext } from './detect.js'
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.test.ts
```

Expected: PASS.

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add packages/analyzer/src/detect.ts \
        packages/analyzer/src/__tests__/detect.test.ts \
        packages/analyzer/src/index.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(analyzer): bulk detect() wrapper + public exports

Trivial map-over-entities wrapper that builds the area context once.
Exposes detect, detectEntity, buildDetectionContext, and the related
types via the package barrel for downstream consumers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Fixture-driven tests

**Files:**
- Create: `packages/analyzer/src/__tests__/detect.fixtures.test.ts`

End-to-end runs against `english-cluttered` and `czech-tidy`. Uses `fixtureToHaRegistries` from P1a-1.

- [ ] **Step 1: Write the failing tests**

Create `packages/analyzer/src/__tests__/detect.fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { czechTidy } from '../../../../tests/fixtures/czech-tidy.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import { normalize } from '../normalize.js'
import { detect } from '../detect.js'

describe('detect — english-cluttered fixture', () => {
  const ha = fixtureToHaRegistries(englishCluttered)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })

  it('produces one assignment per input entity', () => {
    expect(assignments).toHaveLength(entities.length)
  })

  it('preserves entity order', () => {
    for (let i = 0; i < entities.length; i++) {
      expect(assignments[i]!.entityId).toBe(entities[i]!.entityId)
    }
  })

  it('misc bucket size is between 10% and 30% of entities', () => {
    const miscCount = assignments.filter((a) => a.roomId === 'misc').length
    const ratio = miscCount / assignments.length
    expect(ratio, `${miscCount}/${assignments.length} entities in misc`).toBeGreaterThanOrEqual(
      0.1,
    )
    expect(ratio).toBeLessThanOrEqual(0.3)
  })

  it('≥80% of entities with non-null fixture area land in their fixture-area canonical', () => {
    let testable = 0
    let correct = 0
    const fixtureAreaToEntityId = new Map<string, string[]>()
    for (const e of englishCluttered.entities) {
      if (e.area === null) continue
      const list = fixtureAreaToEntityId.get(e.area) ?? []
      list.push(`${e.domain}.${e.objectId}`)
      fixtureAreaToEntityId.set(e.area, list)
    }
    const assignmentByEntityId = new Map(assignments.map((a) => [a.entityId, a]))
    for (const [areaSlug, entityIds] of fixtureAreaToEntityId) {
      for (const id of entityIds) {
        const a = assignmentByEntityId.get(id)
        if (a === undefined) continue
        testable++
        if (a.roomId === areaSlug) correct++
      }
    }
    expect(testable).toBeGreaterThan(50)
    const ratio = correct / testable
    expect(ratio, `${correct}/${testable} matched`).toBeGreaterThanOrEqual(0.8)
  })
})

describe('detect — czech-tidy fixture', () => {
  const ha = fixtureToHaRegistries(czechTidy)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })

  it('produces zero misc bucket entries', () => {
    const miscCount = assignments.filter((a) => a.roomId === 'misc').length
    expect(miscCount).toBe(0)
  })

  it('every entity lands in the canonical of its fixture area', () => {
    const expectedById = new Map<string, string>()
    for (const e of czechTidy.entities) {
      if (e.area !== null) expectedById.set(`${e.domain}.${e.objectId}`, e.area)
    }
    let mismatches: string[] = []
    for (const a of assignments) {
      const expected = expectedById.get(a.entityId)
      if (expected === undefined) continue
      if (a.roomId !== expected) {
        mismatches.push(`${a.entityId}: got ${a.roomId}, expected ${expected}`)
      }
    }
    expect(mismatches, mismatches.join('\n')).toEqual([])
  })

  it('at least 50% of fired signals reference a Czech matchedValue', () => {
    const czechMarker = /[áčďéěíňóřšťúůýž]|kuchyne|loznice|koupelna|obyvac|kancelar|pokoj|svetlo|teplota|vlhkost|pohyb/i
    let totalFired = 0
    let czechFired = 0
    for (const a of assignments) {
      for (const s of a.signals) {
        totalFired++
        if (s.matchedValue !== undefined && czechMarker.test(s.matchedValue)) czechFired++
      }
    }
    const ratio = czechFired / totalFired
    expect(ratio).toBeGreaterThanOrEqual(0.5)
  })
})
```

- [ ] **Step 2: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.fixtures.test.ts
```

Expected: PASS — both fixture suites green. Total: ~7 tests.

If the english-cluttered ≥80% test fails by a small margin, double-check `fixtureToHaRegistries`'s output and the keyword set; do NOT lower the threshold.

If the czech-tidy "every entity lands in expected room" test fails, inspect the mismatches — the failure message lists each one. Most likely cause: a Czech entity name uses a word the keyword set doesn't cover. Add the word to `ROOM_KEYWORDS` (in `packages/shared/src/room-keywords.ts`) rather than dropping the assertion.

If you DO add keywords, stage the change with this commit (the fixture tests are the regression guard).

- [ ] **Step 3: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 4: Commit**

```bash
git -C <worktree> add packages/analyzer/src/__tests__/detect.fixtures.test.ts
# If you also widened keywords:
# git -C <worktree> add packages/shared/src/room-keywords.ts
git -C <worktree> commit -m "$(cat <<'EOF'
test(analyzer): detect end-to-end on english-cluttered + czech-tidy

Pipes each fixture through fixtureToHaRegistries → normalize → detect
and asserts the chain's full-system behavior:
- english-cluttered: misc bucket between 10-30%, ≥80% of fixture-
  area-attributed entities land in their canonical.
- czech-tidy: 0 misc entries, 100% land in expected canonical, ≥50%
  of fired signals reference Czech-language matchedValues (proves
  diacritic-stripping pipeline carries through end-to-end).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1a-3 Acceptance Confirmation

- [ ] `detect`, `detectEntity`, `buildDetectionContext` exported from `@lovelacer/analyzer` (Task 5).
- [ ] All unit tests in `detect.test.ts` pass (Tasks 2-5).
- [ ] `czech-tidy.ts` fixture self-tests pass (Task 1).
- [ ] Fixture-driven tests in `detect.fixtures.test.ts` pass for both fixtures (Task 6).
- [ ] `pnpm typecheck` clean (verified at end of every task).
- [ ] `pnpm test` green (verified at end of every task).
- [ ] Manual sanity check: `pnpm fixtures:load czech-tidy` loads the new fixture into the dev HA stack without modification (loader auto-discovers).
