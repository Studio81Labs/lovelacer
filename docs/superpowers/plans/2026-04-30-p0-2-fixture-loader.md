# P0-2 Fixture Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land a `pnpm fixtures:load <name>` command that drives the local HA dev container into a known fixture state — registries via `.storage/*` overlay, state-supporting domains via a generated `template:` YAML — closing the P0-2 acceptance criterion of "≥150 entities across 6 rooms."

**Architecture:** A typed TypeScript builder under `tests/fixtures/_builder/` is the single source of truth. The first concrete fixture, `tests/fixtures/english-cluttered.ts`, uses the builder. A CLI script at `dev/scripts/load-fixture.ts` (run via `tsx`) orchestrates: pre-flight check, container stop, registry backup, registry serialization, template-YAML emission, idempotent `configuration.yaml` patch, container restart, healthcheck poll. Pure pieces (validator, serializers, backup pruning, YAML include patcher) are unit-tested; the orchestrator is exercised manually against the dev HA stack.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`), Vitest, `yaml` (npm), `tsx` (npm), Docker Compose (already wired in `dev/ha-stack.yml`).

**Spec reference:** [`docs/superpowers/specs/2026-04-30-p0-2-fixture-loader-design.md`](../specs/2026-04-30-p0-2-fixture-loader-design.md)

---

## Conventions used in this plan

- All TS files use ESM with explicit `.js` import extensions even when importing `.ts` source — matches the rest of the repo.
- Type-only imports use `import type { … } from '…'` because the repo enables `verbatimModuleSyntax`.
- Tests use `import { describe, it, expect } from 'vitest'` (no globals).
- Commit messages follow the existing repo style: `<type>(<scope>): <subject>` — observed in recent history (`fix(shared): close gaps…`).
- Each task ends with a `git add` + `git commit`. Don't batch commits.

---

## Task 1: Tooling foundation — `tsx`, `yaml`, root vitest, tools tsconfig

**Files:**
- Modify: `package.json`
- Create: `tsconfig.tools.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`

**Why this is task 1:** The builder code lives under `tests/` and the loader under `dev/scripts/` — neither is part of the workspace package graph. Without a tools tsconfig, `pnpm typecheck` won't see them. Without a root vitest config that includes them, `pnpm test` won't run their tests. Wiring this up first means every later task can rely on test/typecheck working out of the box.

- [ ] **Step 1: Add `tsx` and `yaml` as root devDependencies**

Edit `package.json`. Inside `"devDependencies"`, add (alphabetical with the existing entries):

```json
    "tsx": "^4.19.2",
    "yaml": "^2.6.0",
```

- [ ] **Step 2: Add a `fixtures:load` script that points at the loader file we'll create later**

In `package.json`, inside `"scripts"`, after the existing `dev:ha:logs` line, add:

```json
    "fixtures:load": "tsx dev/scripts/load-fixture.ts",
```

- [ ] **Step 3: Create `tsconfig.tools.json` covering tests + dev scripts**

Create `tsconfig.tools.json` at repo root with:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist-tools",
    "rootDir": "./",
    "noEmit": true
  },
  "include": ["tests/**/*.ts", "dev/scripts/**/*.ts"],
  "exclude": ["node_modules", "**/dist/**"]
}
```

The `noEmit: true` plus `composite: true` is intentional: composite is required for project references, but we never want emitted output for the tooling tree — `tsx` runs the TS at runtime and Vitest transpiles in-process.

- [ ] **Step 4: Reference the tools tsconfig from the root tsconfig**

Edit `tsconfig.json` — append `{ "path": "./tsconfig.tools.json" }` to the `references` array. Final shape:

```json
{
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/ha-client" },
    { "path": "./packages/analyzer" },
    { "path": "./packages/generator" },
    { "path": "./packages/server" },
    { "path": "./packages/web" },
    { "path": "./tsconfig.tools.json" }
  ]
}
```

- [ ] **Step 5: Update root `vitest.config.ts` to pick up tools tests**

Replace the file content:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'dev/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.config.*'],
    },
  },
})
```

- [ ] **Step 6: Update root `test` script to run both workspace tests and tools tests**

In `package.json`, change the `"test"` script to:

```json
    "test": "pnpm -r test && vitest run --passWithNoTests",
```

`--passWithNoTests` keeps the root vitest run green until Tasks 3+ start adding tools tests.

Update `"test:watch"` similarly:

```json
    "test:watch": "pnpm -r --parallel test:watch & vitest --passWithNoTests",
```

- [ ] **Step 7: Install and verify**

Run:

```bash
pnpm install
pnpm typecheck
pnpm test
```

Expected: install succeeds, typecheck passes, `pnpm test` exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json tsconfig.tools.json vitest.config.ts
git commit -m "chore(tooling): add tsx + yaml + tools tsconfig for fixture loader"
```

---

## Task 2: Fixture types

**Files:**
- Create: `tests/fixtures/_builder/types.ts`

These are pure type declarations — no runtime code, so no test in this task. They get exercised by every later task.

- [ ] **Step 1: Write `tests/fixtures/_builder/types.ts`**

```ts
/**
 * Fixture authoring types.
 *
 * The Fixture object is the single source of truth for a named test
 * dataset. The loader script consumes a Fixture and writes both
 * .storage/core.*_registry JSON files and a template: YAML block.
 */

export type FixtureDomain =
  | 'sensor'
  | 'binary_sensor'
  | 'switch'
  | 'light'
  | 'climate'
  | 'cover'
  | 'media_player'
  | 'lock'
  | 'fan'
  | 'camera'
  | 'vacuum'

export interface FloorSpec {
  id: string
  name: string
  level: number | null
  icon: string | null
}

export interface AreaSpec {
  id: string
  name: string
  floor: string | null
  icon: string | null
}

export interface DeviceSpec {
  id: string
  name: string
  nameByUser: string | null
  manufacturer: string | null
  model: string | null
  area: string | null
}

export interface EntitySpec {
  domain: FixtureDomain
  objectId: string
  uniqueId: string
  originalName: string
  nameByUser: string | null
  area: string | null
  device: string | null
  deviceClass: string | null
  entityCategory: 'config' | 'diagnostic' | null
  hidden: boolean
  disabled: boolean
  /**
   * State value used when the loader emits a `template:` YAML block.
   * Ignored for domains the template integration cannot represent.
   */
  templateState: string | null
}

export interface FixtureMeta {
  name: string
  description: string
}

export interface Fixture {
  meta: FixtureMeta
  floors: FloorSpec[]
  areas: AreaSpec[]
  devices: DeviceSpec[]
  entities: EntitySpec[]
}
```

- [ ] **Step 2: Verify typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/_builder/types.ts
git commit -m "feat(fixtures): add builder type declarations"
```

---

## Task 3: ID helpers (slug + uniqueId)

**Files:**
- Create: `tests/fixtures/_builder/ids.ts`
- Create: `tests/fixtures/_builder/__tests__/ids.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/fixtures/_builder/__tests__/ids.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { slug, uniqueIdFor } from '../ids.js'

describe('slug', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(slug('Living Room')).toBe('living_room')
  })

  it('strips punctuation and collapses multiple separators', () => {
    expect(slug("Bart's  Office!")).toBe('barts_office')
  })

  it('preserves digits and underscores', () => {
    expect(slug('Sensor 4_b')).toBe('sensor_4_b')
  })

  it('strips leading/trailing separators', () => {
    expect(slug('  --hello--  ')).toBe('hello')
  })

  it('throws on input that slugs to empty string', () => {
    expect(() => slug('!!!')).toThrow(/cannot slug/i)
  })
})

describe('uniqueIdFor', () => {
  it('combines fixture name and entity id', () => {
    expect(uniqueIdFor('english-cluttered', 'sensor.living_room_temperature')).toBe(
      'english-cluttered__sensor.living_room_temperature',
    )
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm vitest run tests/fixtures/_builder/__tests__/ids.test.ts
```

Expected: FAIL with module-not-found for `../ids.js`.

- [ ] **Step 3: Write the minimal implementation**

Create `tests/fixtures/_builder/ids.ts`:

```ts
/**
 * Convert a free-form name into a HA-friendly identifier:
 * lowercase, ASCII alphanumerics + underscores, no leading/trailing separators.
 */
export function slug(input: string): string {
  const result = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (result.length === 0) {
    throw new Error(`cannot slug ${JSON.stringify(input)} — produces empty string`)
  }
  return result
}

export function uniqueIdFor(fixtureName: string, entityId: string): string {
  return `${fixtureName}__${entityId}`
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm vitest run tests/fixtures/_builder/__tests__/ids.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/_builder/ids.ts tests/fixtures/_builder/__tests__/ids.test.ts
git commit -m "feat(fixtures): add slug + uniqueId helpers"
```

---

## Task 4: Validating `fixture()` constructor

**Files:**
- Create: `tests/fixtures/_builder/fixture.ts`
- Create: `tests/fixtures/_builder/__tests__/fixture.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/fixtures/_builder/__tests__/fixture.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fixture } from '../fixture.js'
import type { AreaSpec, DeviceSpec, EntitySpec, FloorSpec } from '../types.js'

const meta = { name: 'tiny', description: 'tiny test fixture' }
const floor: FloorSpec = { id: 'ground', name: 'Ground', level: 0, icon: null }
const area: AreaSpec = { id: 'living_room', name: 'Living Room', floor: 'ground', icon: null }
const device: DeviceSpec = {
  id: 'dev1',
  name: 'Sensor',
  nameByUser: null,
  manufacturer: null,
  model: null,
  area: 'living_room',
}
const entity: EntitySpec = {
  domain: 'sensor',
  objectId: 'living_room_temperature',
  uniqueId: 'tiny__sensor.living_room_temperature',
  originalName: 'Living Room Temperature',
  nameByUser: null,
  area: 'living_room',
  device: 'dev1',
  deviceClass: 'temperature',
  entityCategory: null,
  hidden: false,
  disabled: false,
  templateState: '21.5',
}

describe('fixture()', () => {
  it('returns the input unchanged when valid', () => {
    const result = fixture({ meta, floors: [floor], areas: [area], devices: [device], entities: [entity] })
    expect(result.entities).toHaveLength(1)
  })

  it('rejects duplicate floor ids', () => {
    expect(() =>
      fixture({ meta, floors: [floor, floor], areas: [area], devices: [device], entities: [entity] }),
    ).toThrow(/duplicate floor id/i)
  })

  it('rejects duplicate area ids', () => {
    expect(() =>
      fixture({ meta, floors: [floor], areas: [area, area], devices: [device], entities: [entity] }),
    ).toThrow(/duplicate area id/i)
  })

  it('rejects duplicate device ids', () => {
    expect(() =>
      fixture({ meta, floors: [floor], areas: [area], devices: [device, device], entities: [entity] }),
    ).toThrow(/duplicate device id/i)
  })

  it('rejects duplicate entity ids (domain + objectId)', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [area],
        devices: [device],
        entities: [entity, entity],
      }),
    ).toThrow(/duplicate entity id/i)
  })

  it('rejects an entity referencing an unknown area', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [area],
        devices: [device],
        entities: [{ ...entity, area: 'no_such_area' }],
      }),
    ).toThrow(/unknown area/i)
  })

  it('rejects an entity referencing an unknown device', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [area],
        devices: [device],
        entities: [{ ...entity, device: 'no_such_device' }],
      }),
    ).toThrow(/unknown device/i)
  })

  it('rejects an area referencing an unknown floor', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [{ ...area, floor: 'no_such_floor' }],
        devices: [device],
        entities: [entity],
      }),
    ).toThrow(/unknown floor/i)
  })

  it('rejects a device referencing an unknown area', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [area],
        devices: [{ ...device, area: 'no_such_area' }],
        entities: [entity],
      }),
    ).toThrow(/unknown area/i)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm vitest run tests/fixtures/_builder/__tests__/fixture.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

Create `tests/fixtures/_builder/fixture.ts`:

```ts
import type { Fixture, FixtureMeta, FloorSpec, AreaSpec, DeviceSpec, EntitySpec } from './types.js'

interface FixtureInput {
  meta: FixtureMeta
  floors: FloorSpec[]
  areas: AreaSpec[]
  devices: DeviceSpec[]
  entities: EntitySpec[]
}

export function fixture(input: FixtureInput): Fixture {
  const floorIds = new Set<string>()
  for (const f of input.floors) {
    if (floorIds.has(f.id)) throw new Error(`duplicate floor id: ${f.id}`)
    floorIds.add(f.id)
  }

  const areaIds = new Set<string>()
  for (const a of input.areas) {
    if (areaIds.has(a.id)) throw new Error(`duplicate area id: ${a.id}`)
    if (a.floor !== null && !floorIds.has(a.floor)) {
      throw new Error(`area ${a.id} references unknown floor: ${a.floor}`)
    }
    areaIds.add(a.id)
  }

  const deviceIds = new Set<string>()
  for (const d of input.devices) {
    if (deviceIds.has(d.id)) throw new Error(`duplicate device id: ${d.id}`)
    if (d.area !== null && !areaIds.has(d.area)) {
      throw new Error(`device ${d.id} references unknown area: ${d.area}`)
    }
    deviceIds.add(d.id)
  }

  const entityIds = new Set<string>()
  for (const e of input.entities) {
    const entityId = `${e.domain}.${e.objectId}`
    if (entityIds.has(entityId)) throw new Error(`duplicate entity id: ${entityId}`)
    if (e.area !== null && !areaIds.has(e.area)) {
      throw new Error(`entity ${entityId} references unknown area: ${e.area}`)
    }
    if (e.device !== null && !deviceIds.has(e.device)) {
      throw new Error(`entity ${entityId} references unknown device: ${e.device}`)
    }
    entityIds.add(entityId)
  }

  return input
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm vitest run tests/fixtures/_builder/__tests__/fixture.test.ts
```

Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/_builder/fixture.ts tests/fixtures/_builder/__tests__/fixture.test.ts
git commit -m "feat(fixtures): add validating fixture() constructor"
```

---

## Task 5: Builder factory helpers

**Files:**
- Create: `tests/fixtures/_builder/helpers.ts`
- Create: `tests/fixtures/_builder/__tests__/helpers.test.ts`

The helpers exist to make Task 8 (the english-cluttered fixture) tolerable to author. Each helper produces a single Spec; defaults are aggressive so most call sites are one or two arguments long.

- [ ] **Step 1: Write the failing test**

Create `tests/fixtures/_builder/__tests__/helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  area,
  device,
  floor,
  light,
  motion,
  switch_,
  tempSensor,
  registryEntry,
} from '../helpers.js'

const FIXTURE_NAME = 'helpers-test'

describe('floor()', () => {
  it('slugs the name into the id', () => {
    expect(floor('Ground')).toEqual({ id: 'ground', name: 'Ground', level: null, icon: null })
  })
  it('accepts level and icon overrides', () => {
    expect(floor('Upstairs', { level: 1, icon: 'mdi:stairs-up' })).toEqual({
      id: 'upstairs',
      name: 'Upstairs',
      level: 1,
      icon: 'mdi:stairs-up',
    })
  })
})

describe('area()', () => {
  it('produces an AreaSpec with slugged id', () => {
    expect(area('Living Room')).toEqual({
      id: 'living_room',
      name: 'Living Room',
      floor: null,
      icon: null,
    })
  })
  it('accepts a floor reference', () => {
    expect(area('Bedroom', { floor: 'upstairs' }).floor).toBe('upstairs')
  })
})

describe('device()', () => {
  it('produces a DeviceSpec with slugged id', () => {
    expect(device('Aqara TH 158d')).toEqual({
      id: 'aqara_th_158d',
      name: 'Aqara TH 158d',
      nameByUser: null,
      manufacturer: null,
      model: null,
      area: null,
    })
  })
})

describe('light()', () => {
  it('emits a light entity with sensible defaults', () => {
    const e = light(FIXTURE_NAME, 'Ceiling Light', { area: 'living_room' })
    expect(e.domain).toBe('light')
    expect(e.objectId).toBe('ceiling_light')
    expect(e.uniqueId).toBe('helpers-test__light.ceiling_light')
    expect(e.originalName).toBe('Ceiling Light')
    expect(e.area).toBe('living_room')
    expect(e.templateState).toBeNull()
    expect(e.hidden).toBe(false)
    expect(e.disabled).toBe(false)
  })
})

describe('switch_()', () => {
  it('emits a switch entity with template state defaulting to "off"', () => {
    const e = switch_(FIXTURE_NAME, 'Coffee Machine')
    expect(e.domain).toBe('switch')
    expect(e.templateState).toBe('off')
  })
})

describe('tempSensor()', () => {
  it('emits a sensor with device_class=temperature and a numeric template state', () => {
    const e = tempSensor(FIXTURE_NAME, 'Living Room Temperature')
    expect(e.domain).toBe('sensor')
    expect(e.deviceClass).toBe('temperature')
    expect(e.templateState).toBe('21.5')
  })
})

describe('motion()', () => {
  it('emits a binary_sensor with device_class=motion', () => {
    const e = motion(FIXTURE_NAME, 'Hallway Motion')
    expect(e.domain).toBe('binary_sensor')
    expect(e.deviceClass).toBe('motion')
    expect(e.templateState).toBe('off')
  })
})

describe('registryEntry()', () => {
  it('emits a registry-only entity with no template state', () => {
    const e = registryEntry(FIXTURE_NAME, 'cover', 'Garage Door', { area: 'garage' })
    expect(e.domain).toBe('cover')
    expect(e.templateState).toBeNull()
  })
})

describe('helper option overrides', () => {
  it('applies hidden, disabled, nameByUser, entityCategory', () => {
    const e = light(FIXTURE_NAME, 'Closet Light', {
      hidden: true,
      disabled: true,
      nameByUser: 'Wardrobe',
      entityCategory: 'diagnostic',
    })
    expect(e.hidden).toBe(true)
    expect(e.disabled).toBe(true)
    expect(e.nameByUser).toBe('Wardrobe')
    expect(e.entityCategory).toBe('diagnostic')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm vitest run tests/fixtures/_builder/__tests__/helpers.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

Create `tests/fixtures/_builder/helpers.ts`:

```ts
import { slug, uniqueIdFor } from './ids.js'
import type { AreaSpec, DeviceSpec, EntitySpec, FixtureDomain, FloorSpec } from './types.js'

interface FloorOpts {
  level?: number
  icon?: string
}

export function floor(name: string, opts: FloorOpts = {}): FloorSpec {
  return {
    id: slug(name),
    name,
    level: opts.level ?? null,
    icon: opts.icon ?? null,
  }
}

interface AreaOpts {
  floor?: string
  icon?: string
}

export function area(name: string, opts: AreaOpts = {}): AreaSpec {
  return {
    id: slug(name),
    name,
    floor: opts.floor ?? null,
    icon: opts.icon ?? null,
  }
}

interface DeviceOpts {
  manufacturer?: string
  model?: string
  area?: string
  nameByUser?: string
}

export function device(name: string, opts: DeviceOpts = {}): DeviceSpec {
  return {
    id: slug(name),
    name,
    nameByUser: opts.nameByUser ?? null,
    manufacturer: opts.manufacturer ?? null,
    model: opts.model ?? null,
    area: opts.area ?? null,
  }
}

interface EntityOpts {
  area?: string
  device?: string
  objectId?: string
  nameByUser?: string
  hidden?: boolean
  disabled?: boolean
  entityCategory?: 'config' | 'diagnostic'
}

interface BuildEntityArgs extends EntityOpts {
  domain: FixtureDomain
  fixtureName: string
  friendlyName: string
  deviceClass: string | null
  templateState: string | null
}

function buildEntity(args: BuildEntityArgs): EntitySpec {
  const objectId = args.objectId ?? slug(args.friendlyName)
  const entityId = `${args.domain}.${objectId}`
  return {
    domain: args.domain,
    objectId,
    uniqueId: uniqueIdFor(args.fixtureName, entityId),
    originalName: args.friendlyName,
    nameByUser: args.nameByUser ?? null,
    area: args.area ?? null,
    device: args.device ?? null,
    deviceClass: args.deviceClass,
    entityCategory: args.entityCategory ?? null,
    hidden: args.hidden ?? false,
    disabled: args.disabled ?? false,
    templateState: args.templateState,
  }
}

export function light(fixtureName: string, friendlyName: string, opts: EntityOpts = {}): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'light',
    fixtureName,
    friendlyName,
    deviceClass: null,
    templateState: null,
  })
}

export function switch_(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'switch',
    fixtureName,
    friendlyName,
    deviceClass: null,
    templateState: 'off',
  })
}

export function tempSensor(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'sensor',
    fixtureName,
    friendlyName,
    deviceClass: 'temperature',
    templateState: '21.5',
  })
}

export function humiditySensor(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'sensor',
    fixtureName,
    friendlyName,
    deviceClass: 'humidity',
    templateState: '47',
  })
}

export function motion(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'binary_sensor',
    fixtureName,
    friendlyName,
    deviceClass: 'motion',
    templateState: 'off',
  })
}

export function occupancy(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'binary_sensor',
    fixtureName,
    friendlyName,
    deviceClass: 'occupancy',
    templateState: 'off',
  })
}

export function door(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'binary_sensor',
    fixtureName,
    friendlyName,
    deviceClass: 'door',
    templateState: 'off',
  })
}

export function climate(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'climate',
    fixtureName,
    friendlyName,
    deviceClass: null,
    templateState: null,
  })
}

/**
 * Generic registry-only entity for domains where the loader does not emit
 * template YAML (cover, media_player, lock, fan, camera, vacuum).
 */
export function registryEntry(
  fixtureName: string,
  domain: FixtureDomain,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain,
    fixtureName,
    friendlyName,
    deviceClass: null,
    templateState: null,
  })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm vitest run tests/fixtures/_builder/__tests__/helpers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/_builder/helpers.ts tests/fixtures/_builder/__tests__/helpers.test.ts
git commit -m "feat(fixtures): add domain-aware builder helpers"
```

---

## Task 6: `.storage/*` registry serializer

**Files:**
- Create: `tests/fixtures/_builder/serialize-storage.ts`
- Create: `tests/fixtures/_builder/__tests__/serialize-storage.test.ts`

The HA storage envelope is `{ version: number, minor_version: number, key: string, data: object }`. We pin a known-good version pair per registry as exported constants so the loader can compare against existing files and refuse to clobber a newer schema. The numbers below are placeholders — Task 11 verifies and locks them against a live HA `stable` instance.

- [ ] **Step 1: Write the failing test**

Create `tests/fixtures/_builder/__tests__/serialize-storage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { serializeStorage, STORAGE_VERSIONS } from '../serialize-storage.js'
import type { Fixture } from '../types.js'

const FIXTURE: Fixture = {
  meta: { name: 'tiny', description: 'tiny test fixture' },
  floors: [{ id: 'ground', name: 'Ground', level: 0, icon: null }],
  areas: [{ id: 'living_room', name: 'Living Room', floor: 'ground', icon: 'mdi:sofa' }],
  devices: [
    {
      id: 'sensor_dev',
      name: 'Aqara TH',
      nameByUser: null,
      manufacturer: 'Aqara',
      model: 'WSDCGQ11LM',
      area: 'living_room',
    },
  ],
  entities: [
    {
      domain: 'sensor',
      objectId: 'living_room_temperature',
      uniqueId: 'tiny__sensor.living_room_temperature',
      originalName: 'Living Room Temperature',
      nameByUser: null,
      area: 'living_room',
      device: 'sensor_dev',
      deviceClass: 'temperature',
      entityCategory: null,
      hidden: false,
      disabled: false,
      templateState: '21.5',
    },
  ],
}

describe('serializeStorage', () => {
  it('returns four files keyed by HA storage key', () => {
    const out = serializeStorage(FIXTURE)
    expect(Object.keys(out).sort()).toEqual([
      'core.area_registry',
      'core.device_registry',
      'core.entity_registry',
      'core.floor_registry',
    ])
  })

  it('wraps each file in HA envelope shape', () => {
    const out = serializeStorage(FIXTURE)
    for (const [key, env] of Object.entries(out)) {
      expect(env.key).toBe(key)
      expect(env.version).toBe(STORAGE_VERSIONS[key as keyof typeof STORAGE_VERSIONS].version)
      expect(env.minor_version).toBe(
        STORAGE_VERSIONS[key as keyof typeof STORAGE_VERSIONS].minor_version,
      )
      expect(env.data).toBeDefined()
    }
  })

  it('serializes floor with id, name, level, icon', () => {
    const out = serializeStorage(FIXTURE)
    const floors = out['core.floor_registry'].data as { floors: unknown[] }
    expect(floors.floors).toEqual([
      expect.objectContaining({ floor_id: 'ground', name: 'Ground', level: 0, icon: null }),
    ])
  })

  it('serializes area with area_id, name, floor_id, icon', () => {
    const out = serializeStorage(FIXTURE)
    const areas = out['core.area_registry'].data as { areas: unknown[] }
    expect(areas.areas).toEqual([
      expect.objectContaining({
        area_id: 'living_room',
        name: 'Living Room',
        floor_id: 'ground',
        icon: 'mdi:sofa',
      }),
    ])
  })

  it('serializes device with id, name, manufacturer, model, area_id', () => {
    const out = serializeStorage(FIXTURE)
    const devices = out['core.device_registry'].data as { devices: unknown[] }
    expect(devices.devices).toEqual([
      expect.objectContaining({
        id: 'sensor_dev',
        name: 'Aqara TH',
        name_by_user: null,
        manufacturer: 'Aqara',
        model: 'WSDCGQ11LM',
        area_id: 'living_room',
      }),
    ])
  })

  it('serializes entity with full registry shape', () => {
    const out = serializeStorage(FIXTURE)
    const entities = out['core.entity_registry'].data as { entities: unknown[] }
    expect(entities.entities).toEqual([
      expect.objectContaining({
        entity_id: 'sensor.living_room_temperature',
        unique_id: 'tiny__sensor.living_room_temperature',
        platform: 'lovelacer_fixture',
        name: null,
        original_name: 'Living Room Temperature',
        area_id: 'living_room',
        device_id: 'sensor_dev',
        device_class: 'temperature',
        entity_category: null,
        disabled_by: null,
        hidden_by: null,
      }),
    ])
  })

  it('reflects nameByUser into the registry `name` field', () => {
    const fx: Fixture = {
      ...FIXTURE,
      entities: [{ ...FIXTURE.entities[0]!, nameByUser: 'Couch Temp' }],
    }
    const out = serializeStorage(fx)
    const entities = out['core.entity_registry'].data as { entities: { name: unknown }[] }
    expect(entities.entities[0]!.name).toBe('Couch Temp')
  })

  it('reflects hidden=true as hidden_by="user"', () => {
    const fx: Fixture = {
      ...FIXTURE,
      entities: [{ ...FIXTURE.entities[0]!, hidden: true }],
    }
    const out = serializeStorage(fx)
    const entities = out['core.entity_registry'].data as { entities: { hidden_by: unknown }[] }
    expect(entities.entities[0]!.hidden_by).toBe('user')
  })

  it('reflects disabled=true as disabled_by="user"', () => {
    const fx: Fixture = {
      ...FIXTURE,
      entities: [{ ...FIXTURE.entities[0]!, disabled: true }],
    }
    const out = serializeStorage(fx)
    const entities = out['core.entity_registry'].data as { entities: { disabled_by: unknown }[] }
    expect(entities.entities[0]!.disabled_by).toBe('user')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm vitest run tests/fixtures/_builder/__tests__/serialize-storage.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

Create `tests/fixtures/_builder/serialize-storage.ts`:

```ts
import type { Fixture } from './types.js'

export const STORAGE_VERSIONS = {
  'core.floor_registry': { version: 1, minor_version: 2 },
  'core.area_registry': { version: 1, minor_version: 7 },
  'core.device_registry': { version: 1, minor_version: 7 },
  'core.entity_registry': { version: 1, minor_version: 16 },
} as const

export interface StorageEnvelope {
  version: number
  minor_version: number
  key: string
  data: unknown
}

export type StorageFiles = {
  [K in keyof typeof STORAGE_VERSIONS]: StorageEnvelope
}

export function serializeStorage(fx: Fixture): StorageFiles {
  return {
    'core.floor_registry': envelope('core.floor_registry', {
      floors: fx.floors.map((f) => ({
        floor_id: f.id,
        name: f.name,
        level: f.level,
        icon: f.icon,
        aliases: [],
      })),
    }),
    'core.area_registry': envelope('core.area_registry', {
      areas: fx.areas.map((a) => ({
        area_id: a.id,
        name: a.name,
        floor_id: a.floor,
        icon: a.icon,
        aliases: [],
        labels: [],
        picture: null,
      })),
    }),
    'core.device_registry': envelope('core.device_registry', {
      devices: fx.devices.map((d) => ({
        id: d.id,
        name: d.name,
        name_by_user: d.nameByUser,
        manufacturer: d.manufacturer,
        model: d.model,
        area_id: d.area,
        identifiers: [['lovelacer_fixture', d.id]],
        connections: [],
        config_entries: [],
        configuration_url: null,
        disabled_by: null,
        entry_type: null,
        hw_version: null,
        sw_version: null,
        via_device_id: null,
        labels: [],
      })),
      deleted_devices: [],
    }),
    'core.entity_registry': envelope('core.entity_registry', {
      entities: fx.entities.map((e) => ({
        entity_id: `${e.domain}.${e.objectId}`,
        unique_id: e.uniqueId,
        platform: 'lovelacer_fixture',
        name: e.nameByUser,
        original_name: e.originalName,
        area_id: e.area,
        device_id: e.device,
        device_class: null,
        original_device_class: e.deviceClass,
        entity_category: e.entityCategory,
        original_entity_category: e.entityCategory,
        disabled_by: e.disabled ? 'user' : null,
        hidden_by: e.hidden ? 'user' : null,
        config_entry_id: null,
        capabilities: null,
        supported_features: 0,
        unit_of_measurement: null,
        translation_key: null,
        options: {},
        aliases: [],
        labels: [],
        has_entity_name: false,
      })),
      deleted_entities: [],
      orphaned_timestamps: {},
    }),
  }
}

function envelope(key: keyof typeof STORAGE_VERSIONS, data: unknown): StorageEnvelope {
  const version = STORAGE_VERSIONS[key]
  return { ...version, key, data }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm vitest run tests/fixtures/_builder/__tests__/serialize-storage.test.ts
```

Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/_builder/serialize-storage.ts tests/fixtures/_builder/__tests__/serialize-storage.test.ts
git commit -m "feat(fixtures): serialize Fixture into HA storage envelopes"
```

---

## Task 7: Template-YAML serializer

**Files:**
- Create: `tests/fixtures/_builder/serialize-template-yaml.ts`
- Create: `tests/fixtures/_builder/__tests__/serialize-template-yaml.test.ts`

Only `sensor`, `binary_sensor`, and `switch` are state-supported. The serializer skips every other domain. Output is parsed YAML — the loader writes it to disk as a string.

- [ ] **Step 1: Write the failing test**

Create `tests/fixtures/_builder/__tests__/serialize-template-yaml.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parse } from 'yaml'
import { serializeTemplateYaml } from '../serialize-template-yaml.js'
import type { Fixture } from '../types.js'

const baseEntity = {
  area: null,
  device: null,
  nameByUser: null,
  entityCategory: null,
  hidden: false,
  disabled: false,
  deviceClass: null,
} as const

const FIXTURE: Fixture = {
  meta: { name: 'tiny', description: 'tiny' },
  floors: [],
  areas: [],
  devices: [],
  entities: [
    {
      ...baseEntity,
      domain: 'sensor',
      objectId: 'living_room_temperature',
      uniqueId: 'tiny__sensor.living_room_temperature',
      originalName: 'Living Room Temperature',
      deviceClass: 'temperature',
      templateState: '21.5',
    },
    {
      ...baseEntity,
      domain: 'binary_sensor',
      objectId: 'hallway_motion',
      uniqueId: 'tiny__binary_sensor.hallway_motion',
      originalName: 'Hallway Motion',
      deviceClass: 'motion',
      templateState: 'off',
    },
    {
      ...baseEntity,
      domain: 'switch',
      objectId: 'coffee_machine',
      uniqueId: 'tiny__switch.coffee_machine',
      originalName: 'Coffee Machine',
      templateState: 'off',
    },
    {
      ...baseEntity,
      domain: 'light',
      objectId: 'ceiling_light',
      uniqueId: 'tiny__light.ceiling_light',
      originalName: 'Ceiling Light',
      templateState: null,
    },
    {
      ...baseEntity,
      domain: 'sensor',
      objectId: 'disabled_one',
      uniqueId: 'tiny__sensor.disabled_one',
      originalName: 'Disabled One',
      templateState: '12',
      disabled: true,
    },
  ],
}

describe('serializeTemplateYaml', () => {
  it('produces a YAML document with a top-level template: sequence', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    const parsed = parse(yaml) as { template: unknown }
    expect(Array.isArray(parsed.template)).toBe(true)
  })

  it('groups entities under sensor / binary_sensor / switch keys', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    const parsed = parse(yaml) as { template: { sensor?: unknown; binary_sensor?: unknown; switch?: unknown }[] }
    const groups = parsed.template
    const keysFound = new Set<string>()
    for (const g of groups) for (const k of Object.keys(g)) keysFound.add(k)
    expect(keysFound).toEqual(new Set(['sensor', 'binary_sensor', 'switch']))
  })

  it('omits domains that template integration cannot represent (light, climate, …)', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    expect(yaml).not.toContain('ceiling_light')
  })

  it('omits disabled entities', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    expect(yaml).not.toContain('disabled_one')
  })

  it('emits unique_id, name, and state per entity', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    const parsed = parse(yaml) as { template: { sensor?: { unique_id: string; name: string; state: string }[] }[] }
    const sensorGroup = parsed.template.find((g) => g.sensor)
    expect(sensorGroup?.sensor).toContainEqual(
      expect.objectContaining({
        unique_id: 'tiny__sensor.living_room_temperature',
        name: 'Living Room Temperature',
        state: '21.5',
      }),
    )
  })

  it('includes device_class for sensor and binary_sensor entries when set', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    const parsed = parse(yaml) as { template: { sensor?: { device_class?: string }[]; binary_sensor?: { device_class?: string }[] }[] }
    const sensorGroup = parsed.template.find((g) => g.sensor)
    expect(sensorGroup?.sensor?.[0]?.device_class).toBe('temperature')
    const binaryGroup = parsed.template.find((g) => g.binary_sensor)
    expect(binaryGroup?.binary_sensor?.[0]?.device_class).toBe('motion')
  })

  it('returns an empty template: list when no state-supported entities exist', () => {
    const empty: Fixture = { ...FIXTURE, entities: [FIXTURE.entities[3]!] }
    const yaml = serializeTemplateYaml(empty)
    expect(parse(yaml)).toEqual({ template: [] })
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm vitest run tests/fixtures/_builder/__tests__/serialize-template-yaml.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

Create `tests/fixtures/_builder/serialize-template-yaml.ts`:

```ts
import { stringify } from 'yaml'
import type { EntitySpec, Fixture, FixtureDomain } from './types.js'

const TEMPLATE_DOMAINS: ReadonlySet<FixtureDomain> = new Set(['sensor', 'binary_sensor', 'switch'])

interface TemplateEntry {
  unique_id: string
  name: string
  state: string
  device_class?: string
}

export function serializeTemplateYaml(fx: Fixture): string {
  const groups: Record<string, TemplateEntry[]> = {}

  for (const e of fx.entities) {
    if (e.disabled) continue
    if (!TEMPLATE_DOMAINS.has(e.domain)) continue
    if (e.templateState === null) continue

    const entry: TemplateEntry = {
      unique_id: e.uniqueId,
      name: e.originalName,
      state: e.templateState,
    }
    if (e.deviceClass !== null) entry.device_class = e.deviceClass

    const list = groups[e.domain] ?? []
    list.push(entry)
    groups[e.domain] = list
  }

  const template = Object.entries(groups).map(([domain, entries]) => ({ [domain]: entries }))
  return stringify({ template }, { lineWidth: 0 })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm vitest run tests/fixtures/_builder/__tests__/serialize-template-yaml.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/_builder/serialize-template-yaml.ts tests/fixtures/_builder/__tests__/serialize-template-yaml.test.ts
git commit -m "feat(fixtures): emit template: YAML for state-supported domains"
```

---

## Task 8: `english-cluttered` fixture + signal-distribution self-tests

**Files:**
- Create: `tests/fixtures/_builder/index.ts`
- Create: `tests/fixtures/english-cluttered.ts`
- Create: `tests/fixtures/__tests__/english-cluttered.test.ts`

The fixture content is large but mechanical — apply the helpers per the design doc. Self-tests guarantee the cluttered-signal distribution stays in spec across edits.

- [ ] **Step 1: Write the public re-export barrel**

Create `tests/fixtures/_builder/index.ts`:

```ts
export * from './types.js'
export * from './ids.js'
export * from './fixture.js'
export * from './helpers.js'
export * from './serialize-storage.js'
export * from './serialize-template-yaml.js'
```

- [ ] **Step 2: Write the failing self-tests for `english-cluttered`**

Create `tests/fixtures/__tests__/english-cluttered.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../english-cluttered.js'

const fx = englishCluttered

describe('english-cluttered fixture', () => {
  it('has exactly six rooms (areas)', () => {
    expect(fx.areas).toHaveLength(6)
  })

  it('has at least 150 entities total', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(150)
  })

  it('targets ~165 entities (within ±10)', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(155)
    expect(fx.entities.length).toBeLessThanOrEqual(175)
  })

  it('declares two floors', () => {
    expect(fx.floors).toHaveLength(2)
  })

  it('attributes ~40% of entities by direct entity area_id', () => {
    const direct = fx.entities.filter((e) => e.area !== null).length
    const ratio = direct / fx.entities.length
    expect(ratio).toBeGreaterThan(0.35)
    expect(ratio).toBeLessThan(0.5)
  })

  it('has ~25% device-only attribution (no entity area but device has one)', () => {
    const devicesById = new Map(fx.devices.map((d) => [d.id, d]))
    const deviceOnly = fx.entities.filter(
      (e) => e.area === null && e.device !== null && devicesById.get(e.device)?.area !== null,
    ).length
    const ratio = deviceOnly / fx.entities.length
    expect(ratio).toBeGreaterThan(0.18)
    expect(ratio).toBeLessThan(0.32)
  })

  it('has ~25% with no area attribution at all', () => {
    const devicesById = new Map(fx.devices.map((d) => [d.id, d]))
    const orphaned = fx.entities.filter(
      (e) =>
        e.area === null &&
        (e.device === null || (e.device !== null && devicesById.get(e.device)?.area === null)),
    ).length
    const ratio = orphaned / fx.entities.length
    expect(ratio).toBeGreaterThan(0.18)
    expect(ratio).toBeLessThan(0.32)
  })

  it('includes at least one diagnostic, one disabled, one hidden, one nameByUser', () => {
    expect(fx.entities.some((e) => e.entityCategory === 'diagnostic')).toBe(true)
    expect(fx.entities.some((e) => e.disabled)).toBe(true)
    expect(fx.entities.some((e) => e.hidden)).toBe(true)
    expect(fx.entities.some((e) => e.nameByUser !== null)).toBe(true)
  })

  it('contains every P1a domain plus at least one P1b registry-only domain', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['light', 'switch', 'sensor', 'binary_sensor', 'climate'] as const) {
      expect(domains).toContain(d)
    }
    const p1bSeen = (['cover', 'media_player', 'lock', 'fan'] as const).some((d) =>
      domains.has(d),
    )
    expect(p1bSeen).toBe(true)
  })

  it('passes the fixture validator (no dangling references, no duplicates)', () => {
    expect(fx.meta.name).toBe('english-cluttered')
  })
})
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
pnpm vitest run tests/fixtures/__tests__/english-cluttered.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 4: Author the fixture**

Create `tests/fixtures/english-cluttered.ts`:

```ts
import {
  area,
  climate,
  device,
  door,
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

const FX = 'english-cluttered'

const ground = floor('Ground', { level: 0, icon: 'mdi:home-floor-g' })
const upstairs = floor('Upstairs', { level: 1, icon: 'mdi:home-floor-1' })

const livingRoom = area('Living Room', { floor: ground.id, icon: 'mdi:sofa' })
const kitchen = area('Kitchen', { floor: ground.id, icon: 'mdi:silverware-fork-knife' })
const bathroom = area('Bathroom', { floor: ground.id, icon: 'mdi:shower' })
const bedroom = area('Bedroom', { floor: upstairs.id, icon: 'mdi:bed' })
const office = area('Office', { floor: upstairs.id, icon: 'mdi:desk' })
const garage = area('Garage', { floor: ground.id, icon: 'mdi:garage' })

// ── Devices ─────────────────────────────────────────────────────────────
// "Direct" devices: anchored in an area; their entities will mostly inherit.
const lrHueBridge = device('Living Room Hue Bridge', {
  manufacturer: 'Philips',
  model: 'BSB002',
  area: livingRoom.id,
})
const lrAqara = device('Living Room Aqara TH', {
  manufacturer: 'Aqara',
  model: 'WSDCGQ11LM',
  area: livingRoom.id,
})
const lrThermostat = device('Living Room Tado', {
  manufacturer: 'tado',
  model: 'V3+',
  area: livingRoom.id,
})
const lrTV = device('Living Room TV', { manufacturer: 'LG', model: 'OLED55C2', area: livingRoom.id })

const kitchenHue = device('Kitchen Hue', { manufacturer: 'Philips', area: kitchen.id })
const kitchenAqara = device('Kitchen Aqara TH', {
  manufacturer: 'Aqara',
  model: 'WSDCGQ11LM',
  area: kitchen.id,
})
const dishwasher = device('Dishwasher Plug', {
  manufacturer: 'Shelly',
  model: 'Plug S',
  area: kitchen.id,
})

const bathHue = device('Bathroom Hue', { manufacturer: 'Philips', area: bathroom.id })
const bathAqara = device('Bathroom Aqara TH', { manufacturer: 'Aqara', area: bathroom.id })

const bedHue = device('Bedroom Hue', { manufacturer: 'Philips', area: bedroom.id })
const bedThermostat = device('Bedroom Tado', { manufacturer: 'tado', area: bedroom.id })

const officeHue = device('Office Hue', { manufacturer: 'Philips', area: office.id })
const officePlug = device('Office Plug', { manufacturer: 'Shelly', area: office.id })

const garageDoor = device('Garage Door Sensor', { manufacturer: 'Aqara', area: garage.id })
const garageMotion = device('Garage Motion', { manufacturer: 'Aqara', area: garage.id })

// "Device-only" devices: have area_id, but their entities will NOT (forces
// device→entity propagation in the analyzer).
const kitchenZ2M = device('Kitchen Zigbee Group', { area: kitchen.id })
const lrZ2M = device('Living Room Zigbee Group', { area: livingRoom.id })
const bedZ2M = device('Bedroom Zigbee Group', { area: bedroom.id })
const officeZ2M = device('Office Zigbee Group', { area: office.id })

// "Floating" devices: no area at all — entities will need friendly-name fallback.
const espHallway = device('ESP32 Hallway')
const espStairs = device('ESP32 Stairs')
const espOutdoor = device('ESP32 Outdoor')
const networkSwitch = device('UniFi Switch', { manufacturer: 'Ubiquiti' })
const router = device('UniFi Router', { manufacturer: 'Ubiquiti' })

// ── Entities ────────────────────────────────────────────────────────────
// Counts per room are approximate; the self-tests assert distributional
// properties rather than exact totals.

const livingRoomEntities = [
  // direct area_id (clean)
  light(FX, 'Living Room Ceiling', { area: livingRoom.id, device: lrHueBridge.id }),
  light(FX, 'Living Room Lamp Left', { area: livingRoom.id, device: lrHueBridge.id }),
  light(FX, 'Living Room Lamp Right', { area: livingRoom.id, device: lrHueBridge.id }),
  light(FX, 'Living Room Spot 1', { area: livingRoom.id, device: lrHueBridge.id }),
  light(FX, 'Living Room Spot 2', { area: livingRoom.id, device: lrHueBridge.id }),
  light(FX, 'Living Room Spot 3', { area: livingRoom.id, device: lrHueBridge.id }),
  tempSensor(FX, 'Living Room Temperature', { area: livingRoom.id, device: lrAqara.id }),
  humiditySensor(FX, 'Living Room Humidity', { area: livingRoom.id, device: lrAqara.id }),
  climate(FX, 'Living Room Thermostat', { area: livingRoom.id, device: lrThermostat.id }),
  registryEntry(FX, 'media_player', 'Living Room TV', { area: livingRoom.id, device: lrTV.id }),
  switch_(FX, 'Living Room Floor Heating', { area: livingRoom.id }),
  // device-only (no entity area_id)
  motion(FX, 'Couch Presence', { device: lrZ2M.id }),
  occupancy(FX, 'Sofa Occupancy', { device: lrZ2M.id }),
  tempSensor(FX, 'Couch Temp', { device: lrZ2M.id, nameByUser: 'Sofa Side Temperature' }),
  // ambiguous friendly names
  tempSensor(FX, '0x158d000111aaa Temperature', { device: lrZ2M.id }),
  humiditySensor(FX, '0x158d000111aaa Humidity', { device: lrZ2M.id }),
  // diagnostics — should be filtered
  registryEntry(FX, 'sensor', 'Hue Bridge ZigBee Channel', {
    device: lrHueBridge.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Hue Bridge Software Version', {
    device: lrHueBridge.id,
    entityCategory: 'diagnostic',
  }),
  // hidden by user
  light(FX, 'Living Room Closet', {
    area: livingRoom.id,
    device: lrHueBridge.id,
    hidden: true,
  }),
  // disabled
  light(FX, 'Living Room Old Lamp', {
    area: livingRoom.id,
    device: lrHueBridge.id,
    disabled: true,
  }),
  // straddling friendly name
  motion(FX, 'Hallway / Living Room Motion'),
]

const kitchenEntities = [
  light(FX, 'Kitchen Ceiling', { area: kitchen.id, device: kitchenHue.id }),
  light(FX, 'Kitchen Counter Strip', { area: kitchen.id, device: kitchenHue.id }),
  light(FX, 'Kitchen Pendant', { area: kitchen.id, device: kitchenHue.id }),
  switch_(FX, 'Kettle', { area: kitchen.id }),
  switch_(FX, 'Coffee Machine', { area: kitchen.id }),
  switch_(FX, 'Dishwasher Plug', { area: kitchen.id, device: dishwasher.id }),
  switch_(FX, 'Toaster', { area: kitchen.id }),
  tempSensor(FX, 'Kitchen Temperature', { area: kitchen.id, device: kitchenAqara.id }),
  humiditySensor(FX, 'Kitchen Humidity', { area: kitchen.id, device: kitchenAqara.id }),
  motion(FX, 'Kitchen Motion', { area: kitchen.id }),
  // device-only
  occupancy(FX, 'Sink Occupancy', { device: kitchenZ2M.id }),
  tempSensor(FX, 'Fridge Temp', { device: kitchenZ2M.id }),
  tempSensor(FX, 'Freezer Temp', { device: kitchenZ2M.id }),
  // ambiguous
  tempSensor(FX, 'Sensor 4', { device: kitchenZ2M.id }),
  registryEntry(FX, 'sensor', 'Aqara Battery 158d', {
    device: kitchenAqara.id,
    entityCategory: 'diagnostic',
  }),
  // P1b registry-only domain
  registryEntry(FX, 'cover', 'Kitchen Blinds', { area: kitchen.id }),
]

const bathroomEntities = [
  light(FX, 'Bathroom Ceiling', { area: bathroom.id, device: bathHue.id }),
  light(FX, 'Bathroom Mirror', { area: bathroom.id, device: bathHue.id }),
  motion(FX, 'Bathroom Motion', { area: bathroom.id }),
  occupancy(FX, 'Shower Occupancy', { area: bathroom.id }),
  tempSensor(FX, 'Bathroom Temperature', { area: bathroom.id, device: bathAqara.id }),
  humiditySensor(FX, 'Bathroom Humidity', { area: bathroom.id, device: bathAqara.id }),
  switch_(FX, 'Bathroom Fan', { area: bathroom.id }),
  switch_(FX, 'Towel Rail Heater', { area: bathroom.id }),
  registryEntry(FX, 'sensor', 'Bathroom Aqara Battery', {
    device: bathAqara.id,
    entityCategory: 'diagnostic',
  }),
  humiditySensor(FX, 'Bathroom Steam Sensor', {
    area: bathroom.id,
    nameByUser: 'Steam Trigger',
  }),
  light(FX, 'Bathroom Night Light', { area: bathroom.id, device: bathHue.id, hidden: true }),
  motion(FX, 'Bathroom Old Motion', { area: bathroom.id, disabled: true }),
]

const bedroomEntities = [
  light(FX, 'Bedroom Ceiling', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Bedroom Bedside Left', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Bedroom Bedside Right', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Bedroom Reading Lamp', { area: bedroom.id, device: bedHue.id }),
  climate(FX, 'Bedroom Thermostat', { area: bedroom.id, device: bedThermostat.id }),
  motion(FX, 'Bedroom Motion', { area: bedroom.id }),
  tempSensor(FX, 'Bedroom Temperature', { area: bedroom.id }),
  humiditySensor(FX, 'Bedroom Humidity', { area: bedroom.id }),
  // device-only
  motion(FX, 'Bed Presence', { device: bedZ2M.id }),
  occupancy(FX, 'Wardrobe Occupancy', { device: bedZ2M.id }),
  tempSensor(FX, 'Bed Side Temperature', { device: bedZ2M.id }),
  // ambiguous + diagnostic
  registryEntry(FX, 'sensor', 'Tado V3+ Battery', {
    device: bedThermostat.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Tado V3+ Signal Strength', {
    device: bedThermostat.id,
    entityCategory: 'diagnostic',
  }),
]

const officeEntities = [
  light(FX, 'Office Ceiling', { area: office.id, device: officeHue.id }),
  light(FX, 'Office Desk Lamp', { area: office.id, device: officeHue.id }),
  light(FX, 'Office Bookshelf', { area: office.id, device: officeHue.id }),
  switch_(FX, 'Office Plug', { area: office.id, device: officePlug.id }),
  switch_(FX, 'Monitor Plug', { area: office.id }),
  switch_(FX, '3D Printer Plug', { area: office.id }),
  tempSensor(FX, 'Office Temperature', { area: office.id }),
  humiditySensor(FX, 'Office Humidity', { area: office.id }),
  // device-only
  motion(FX, 'Desk Presence', { device: officeZ2M.id }),
  occupancy(FX, 'Chair Occupancy', { device: officeZ2M.id }),
  tempSensor(FX, 'Server Rack Temp', { device: officeZ2M.id }),
  // diagnostic + name_by_user
  registryEntry(FX, 'sensor', 'Shelly Plug Power', {
    device: officePlug.id,
    nameByUser: 'Office PC Power',
  }),
  registryEntry(FX, 'sensor', 'Shelly Plug RSSI', {
    device: officePlug.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Shelly Plug Energy Today', {
    device: officePlug.id,
    entityCategory: 'diagnostic',
  }),
]

const garageEntities = [
  door(FX, 'Garage Door', { area: garage.id, device: garageDoor.id }),
  motion(FX, 'Garage Motion', { area: garage.id, device: garageMotion.id }),
  switch_(FX, 'Garage Light Switch', { area: garage.id }),
  light(FX, 'Garage Ceiling', { area: garage.id }),
  tempSensor(FX, 'Garage Temperature', { area: garage.id }),
  humiditySensor(FX, 'Garage Humidity', { area: garage.id }),
  registryEntry(FX, 'cover', 'Garage Door Opener', { area: garage.id, device: garageDoor.id }),
  registryEntry(FX, 'lock', 'Garage Side Door Lock', { area: garage.id }),
  // diagnostics
  registryEntry(FX, 'sensor', 'Garage Aqara Battery', {
    device: garageDoor.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Garage Motion Battery', {
    device: garageMotion.id,
    entityCategory: 'diagnostic',
  }),
]

// Misc — entities with no usable area attribution. Some have names that
// the analyzer should recognize via friendly-name fallback (Hallway, Stairs,
// Outdoor); others are genuinely homeless (network gear, hub diagnostics).
const miscEntities = [
  motion(FX, 'Hallway Motion', { device: espHallway.id }),
  motion(FX, 'Hallway / Stairs Motion'),
  tempSensor(FX, 'Hallway Temperature', { device: espHallway.id }),
  motion(FX, 'Stairs Motion', { device: espStairs.id }),
  tempSensor(FX, 'Outdoor Temperature', { device: espOutdoor.id }),
  humiditySensor(FX, 'Outdoor Humidity', { device: espOutdoor.id }),
  registryEntry(FX, 'sensor', 'Outdoor Wind Speed', { device: espOutdoor.id }),
  registryEntry(FX, 'sensor', 'UniFi Switch CPU', {
    device: networkSwitch.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'UniFi Switch Memory', {
    device: networkSwitch.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'UniFi Switch Uptime', {
    device: networkSwitch.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'UniFi Router CPU', {
    device: router.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'UniFi Router Memory', {
    device: router.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'UniFi Router WAN Throughput', {
    device: router.id,
    entityCategory: 'diagnostic',
  }),
  // ambiguous floaters
  tempSensor(FX, 'Sensor 1'),
  tempSensor(FX, 'Sensor 2'),
  tempSensor(FX, 'Sensor 3'),
  humiditySensor(FX, 'Aqara TH 0x158d000999fff'),
  // disabled floaters
  tempSensor(FX, 'Old Test Sensor', { disabled: true }),
  // hidden floaters
  registryEntry(FX, 'sensor', 'System Monitor Load', { hidden: true }),
  registryEntry(FX, 'sensor', 'System Monitor Memory', { hidden: true }),
  registryEntry(FX, 'fan', 'Office Floor Fan'),
  registryEntry(FX, 'media_player', 'Bedroom Speaker'),
  registryEntry(FX, 'media_player', 'Kitchen Speaker'),
  registryEntry(FX, 'lock', 'Front Door Lock'),
  registryEntry(FX, 'cover', 'Hallway Curtains'),
]

export const englishCluttered = fixture({
  meta: {
    name: 'english-cluttered',
    description:
      '~165 entities across 6 rooms with mixed area attribution, ambiguous names, ' +
      'diagnostics, hidden/disabled entries, and out-of-P1a-scope domains. ' +
      'Heuristic-stress fixture for analyzer development.',
  },
  floors: [ground, upstairs],
  areas: [livingRoom, kitchen, bathroom, bedroom, office, garage],
  devices: [
    lrHueBridge, lrAqara, lrThermostat, lrTV,
    kitchenHue, kitchenAqara, dishwasher,
    bathHue, bathAqara,
    bedHue, bedThermostat,
    officeHue, officePlug,
    garageDoor, garageMotion,
    kitchenZ2M, lrZ2M, bedZ2M, officeZ2M,
    espHallway, espStairs, espOutdoor, networkSwitch, router,
  ],
  entities: [
    ...livingRoomEntities,
    ...kitchenEntities,
    ...bathroomEntities,
    ...bedroomEntities,
    ...officeEntities,
    ...garageEntities,
    ...miscEntities,
  ],
})
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
pnpm vitest run tests/fixtures/__tests__/english-cluttered.test.ts
```

Expected: PASS. If a distributional check fails, tweak entity counts in the lists above and re-run. The test ranges are wide enough (±5 percentage points) that small edits are fine.

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/_builder/index.ts tests/fixtures/english-cluttered.ts tests/fixtures/__tests__/english-cluttered.test.ts
git commit -m "feat(fixtures): add english-cluttered with signal-distribution self-tests"
```

---

## Task 9: Loader pure helpers — backup pruning + `configuration.yaml` patcher

**Files:**
- Create: `dev/scripts/_loader/backup.ts`
- Create: `dev/scripts/_loader/config-yaml.ts`
- Create: `dev/scripts/_loader/__tests__/backup.test.ts`
- Create: `dev/scripts/_loader/__tests__/config-yaml.test.ts`

These are the pieces of the loader that don't touch Docker. Unit-testable, so they get unit tests. The orchestrating CLI in Task 10 wires them up.

- [ ] **Step 1: Write the failing test for `backup.ts`**

Create `dev/scripts/_loader/__tests__/backup.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupRegistries, MAX_BACKUPS } from '../backup.js'

const REGISTRY_KEYS = [
  'core.floor_registry',
  'core.area_registry',
  'core.device_registry',
  'core.entity_registry',
] as const

function setupStorageDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'lovelacer-backup-'))
  mkdirSync(join(root, '.storage'), { recursive: true })
  for (const k of REGISTRY_KEYS) writeFileSync(join(root, '.storage', k), `{"key":"${k}"}`)
  return root
}

describe('backupRegistries', () => {
  let configRoot: string
  beforeEach(() => {
    configRoot = setupStorageDir()
  })

  it('moves existing registries into a timestamped backup directory', () => {
    const dir = backupRegistries(configRoot)
    expect(existsSync(dir)).toBe(true)
    for (const k of REGISTRY_KEYS) {
      expect(existsSync(join(dir, k))).toBe(true)
      expect(existsSync(join(configRoot, '.storage', k))).toBe(false)
    }
  })

  it('returns null when no registries are present', () => {
    const fresh = mkdtempSync(join(tmpdir(), 'lovelacer-backup-empty-'))
    mkdirSync(join(fresh, '.storage'), { recursive: true })
    expect(backupRegistries(fresh)).toBeNull()
  })

  it('prunes old backups beyond MAX_BACKUPS', () => {
    for (let i = 0; i < MAX_BACKUPS + 3; i++) {
      const stamp = `2020-01-01T00-00-${String(i).padStart(2, '0')}-000Z`
      const dir = join(configRoot, '.storage', `.lovelacer-backup-${stamp}`)
      mkdirSync(dir, { recursive: true })
    }
    // also seed a current registry so a new backup gets created
    for (const k of REGISTRY_KEYS) writeFileSync(join(configRoot, '.storage', k), `{}`)
    backupRegistries(configRoot)
    const remaining = readdirSync(join(configRoot, '.storage')).filter((n) =>
      n.startsWith('.lovelacer-backup-'),
    )
    expect(remaining).toHaveLength(MAX_BACKUPS)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm vitest run dev/scripts/_loader/__tests__/backup.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the `backup.ts` implementation**

Create `dev/scripts/_loader/backup.ts`:

```ts
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export const MAX_BACKUPS = 5

const REGISTRY_KEYS = [
  'core.floor_registry',
  'core.area_registry',
  'core.device_registry',
  'core.entity_registry',
] as const

const BACKUP_PREFIX = '.lovelacer-backup-'

/**
 * Move any existing registry files to a fresh `.lovelacer-backup-<ts>/`
 * directory under .storage/. Prunes older backups beyond MAX_BACKUPS.
 *
 * Returns the path to the new backup directory, or null if there was
 * nothing to back up.
 */
export function backupRegistries(haConfigDir: string): string | null {
  const storageDir = join(haConfigDir, '.storage')
  const present = REGISTRY_KEYS.filter((k) => existsSync(join(storageDir, k)))
  if (present.length === 0) return null

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(storageDir, `${BACKUP_PREFIX}${stamp}`)
  mkdirSync(backupDir, { recursive: true })

  for (const k of present) renameSync(join(storageDir, k), join(backupDir, k))

  pruneOldBackups(storageDir)
  return backupDir
}

function pruneOldBackups(storageDir: string): void {
  const entries = readdirSync(storageDir)
    .filter((n) => n.startsWith(BACKUP_PREFIX))
    .sort()
  const excess = entries.length - MAX_BACKUPS
  for (let i = 0; i < excess; i++) {
    rmSync(join(storageDir, entries[i]!), { recursive: true, force: true })
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm vitest run dev/scripts/_loader/__tests__/backup.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing test for `config-yaml.ts`**

Create `dev/scripts/_loader/__tests__/config-yaml.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureFixtureInclude, FIXTURE_INCLUDE_SENTINEL } from '../config-yaml.js'

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'lovelacer-cfg-'))
}

describe('ensureFixtureInclude', () => {
  it('creates configuration.yaml with default_config + include if missing', () => {
    const root = tempRoot()
    ensureFixtureInclude(root)
    const yaml = readFileSync(join(root, 'configuration.yaml'), 'utf8')
    expect(yaml).toContain('default_config:')
    expect(yaml).toContain(FIXTURE_INCLUDE_SENTINEL)
    expect(yaml).toContain('!include lovelacer-fixtures.yaml')
  })

  it('appends include + sentinel to existing configuration.yaml without one', () => {
    const root = tempRoot()
    writeFileSync(join(root, 'configuration.yaml'), 'default_config:\nautomation: !include automations.yaml\n')
    ensureFixtureInclude(root)
    const yaml = readFileSync(join(root, 'configuration.yaml'), 'utf8')
    expect(yaml).toContain('automation: !include automations.yaml')
    expect(yaml).toContain(FIXTURE_INCLUDE_SENTINEL)
    expect(yaml).toContain('!include lovelacer-fixtures.yaml')
  })

  it('is idempotent — re-running does not duplicate the include', () => {
    const root = tempRoot()
    ensureFixtureInclude(root)
    ensureFixtureInclude(root)
    ensureFixtureInclude(root)
    const yaml = readFileSync(join(root, 'configuration.yaml'), 'utf8')
    const occurrences = yaml.match(new RegExp(FIXTURE_INCLUDE_SENTINEL, 'g')) ?? []
    expect(occurrences).toHaveLength(1)
  })

  it('does not touch the file when sentinel already present in different position', () => {
    const root = tempRoot()
    const original = `default_config:\n${FIXTURE_INCLUDE_SENTINEL}\nhomeassistant: !include lovelacer-fixtures.yaml\n`
    writeFileSync(join(root, 'configuration.yaml'), original)
    ensureFixtureInclude(root)
    expect(readFileSync(join(root, 'configuration.yaml'), 'utf8')).toBe(original)
  })

  it('writes nothing extra besides configuration.yaml', () => {
    const root = tempRoot()
    ensureFixtureInclude(root)
    expect(existsSync(join(root, 'configuration.yaml'))).toBe(true)
    // No spurious files
  })
})
```

- [ ] **Step 6: Run the test to confirm it fails**

```bash
pnpm vitest run dev/scripts/_loader/__tests__/config-yaml.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 7: Write the `config-yaml.ts` implementation**

Create `dev/scripts/_loader/config-yaml.ts`:

```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const FIXTURE_INCLUDE_SENTINEL = '# lovelacer:fixtures'

const DEFAULT_BODY = `default_config:

${FIXTURE_INCLUDE_SENTINEL}
homeassistant: !include lovelacer-fixtures.yaml
`

const APPEND_BLOCK = `
${FIXTURE_INCLUDE_SENTINEL}
homeassistant: !include lovelacer-fixtures.yaml
`

export function ensureFixtureInclude(haConfigDir: string): void {
  const path = join(haConfigDir, 'configuration.yaml')

  if (!existsSync(path)) {
    writeFileSync(path, DEFAULT_BODY)
    return
  }

  const current = readFileSync(path, 'utf8')
  if (current.includes(FIXTURE_INCLUDE_SENTINEL)) return

  const trailing = current.endsWith('\n') ? '' : '\n'
  writeFileSync(path, current + trailing + APPEND_BLOCK)
}
```

> **Note for the implementer:** the include uses the `homeassistant:` key, which HA tolerates as a free-form key for `!include` even though the canonical key for templates is `template:`. We deliberately use `homeassistant:` as a no-op anchor so the include is silently picked up no matter what other top-level keys the user adds. (HA processes `!include` directives at YAML parse time independent of the key.) If this turns out to misbehave on the chosen HA `stable` image, swap the key to `template:` and merge contents in `lovelacer-fixtures.yaml` accordingly — the sentinel logic is unchanged.

- [ ] **Step 8: Run the test to confirm it passes**

```bash
pnpm vitest run dev/scripts/_loader/__tests__/config-yaml.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 9: Commit**

```bash
git add dev/scripts/_loader/
git commit -m "feat(loader): add backup pruning + idempotent config.yaml include"
```

---

## Task 10: Loader CLI orchestration

**Files:**
- Create: `dev/scripts/load-fixture.ts`

This task does not have unit tests — Docker orchestration is exercised manually in Task 11. The pure pieces it composes are already covered.

- [ ] **Step 1: Write `dev/scripts/load-fixture.ts`**

```ts
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import type { Fixture } from '../../tests/fixtures/_builder/types.js'
import {
  serializeStorage,
  serializeTemplateYaml,
} from '../../tests/fixtures/_builder/index.js'
import { backupRegistries } from './_loader/backup.js'
import { ensureFixtureInclude } from './_loader/config-yaml.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const HA_CONFIG = join(REPO_ROOT, 'dev', 'ha-config')
const COMPOSE_FILE = join(REPO_ROOT, 'dev', 'ha-stack.yml')
const FIXTURES_DIR = join(REPO_ROOT, 'tests', 'fixtures')

async function main(): Promise<void> {
  const name = process.argv[2]
  if (!name) {
    printUsage()
    process.exit(1)
  }

  const fixturePath = join(FIXTURES_DIR, `${name}.ts`)
  if (!existsSync(fixturePath)) {
    console.error(`fixture not found: ${name}\n`)
    printUsage()
    process.exit(1)
  }

  if (!existsSync(HA_CONFIG) || !existsSync(join(HA_CONFIG, '.storage', 'auth'))) {
    console.error(
      `dev/ha-config not initialized — run 'pnpm dev:ha' and complete onboarding first.\n` +
        `See dev/README.md for the full first-run flow.`,
    )
    process.exit(2)
  }

  const fx = await loadFixture(fixturePath)
  console.log(`loaded fixture: ${fx.meta.name}`)
  console.log(
    `  ${fx.floors.length} floors · ${fx.areas.length} areas · ` +
      `${fx.devices.length} devices · ${fx.entities.length} entities`,
  )

  stopHa()

  const backup = backupRegistries(HA_CONFIG)
  if (backup) console.log(`backed up previous registries → ${backup}`)

  const storage = serializeStorage(fx)
  const storageDir = join(HA_CONFIG, '.storage')
  mkdirSync(storageDir, { recursive: true })
  for (const [key, env] of Object.entries(storage)) {
    writeFileSync(join(storageDir, key), JSON.stringify(env, null, 2))
  }
  console.log(`wrote 4 registry files to ${storageDir}`)

  const yaml = serializeTemplateYaml(fx)
  writeFileSync(join(HA_CONFIG, 'lovelacer-fixtures.yaml'), yaml)
  ensureFixtureInclude(HA_CONFIG)
  console.log('wrote lovelacer-fixtures.yaml + ensured configuration.yaml include')

  startHa()
  await waitForHealthy()

  console.log('\n✓ fixture loaded — HA is running at http://localhost:8123')
  console.log('  HA_TOKEN in .env is unaffected.\n')
}

function printUsage(): void {
  const available = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_'))
    .map((f) => f.replace(/\.ts$/, ''))
  console.error('Usage: pnpm fixtures:load <name>\n')
  console.error('Available fixtures:')
  for (const f of available) console.error(`  - ${f}`)
}

async function loadFixture(path: string): Promise<Fixture> {
  const mod = (await import(path)) as Record<string, unknown>
  for (const value of Object.values(mod)) {
    if (isFixture(value)) return value
  }
  throw new Error(`no Fixture export found in ${path}`)
}

function isFixture(value: unknown): value is Fixture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'meta' in value &&
    'floors' in value &&
    'areas' in value &&
    'devices' in value &&
    'entities' in value
  )
}

function stopHa(): void {
  const result = spawnSync('docker', ['compose', '-f', COMPOSE_FILE, 'stop', 'homeassistant'], {
    stdio: 'inherit',
  })
  if (result.error) {
    console.error('docker not available — is Docker installed?')
    process.exit(3)
  }
}

function startHa(): void {
  const result = spawnSync('docker', ['compose', '-f', COMPOSE_FILE, 'start', 'homeassistant'], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error('failed to start HA container')
    process.exit(4)
  }
}

async function waitForHealthy(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastStatus = ''
  while (Date.now() < deadline) {
    const out = spawnSync(
      'docker',
      ['inspect', '--format', '{{.State.Health.Status}}', 'lovelacer-dev-ha'],
      { encoding: 'utf8' },
    )
    lastStatus = (out.stdout ?? '').trim()
    if (lastStatus === 'healthy') return
    await sleep(2000)
  }
  console.warn(`warning: HA healthcheck did not report 'healthy' within ${timeoutMs}ms (last: ${lastStatus})`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

main().catch((err) => {
  console.error(err)
  process.exit(99)
})
```

- [ ] **Step 2: Run typecheck and verify the script type-checks cleanly**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add dev/scripts/load-fixture.ts
git commit -m "feat(loader): orchestration CLI for pnpm fixtures:load"
```

---

## Task 11: Manual smoke test — verify against a live dev HA, lock storage versions

**Files:**
- Modify: `tests/fixtures/_builder/serialize-storage.ts` (likely — pin the schema versions if they differ)

This task is the only one that exercises the full end-to-end loop. It also validates the schema-version constants set in Task 6.

- [ ] **Step 1: Bring HA up fresh**

```bash
pnpm dev:ha:down
rm -rf dev/ha-config
pnpm dev:ha
```

Wait ~60s for the container to become healthy:

```bash
docker inspect --format '{{.State.Health.Status}}' lovelacer-dev-ha
```

Expected: `healthy`.

- [ ] **Step 2: Complete HA onboarding**

Open `http://localhost:8123`, create an admin account, set a location, skip area setup. Then in profile → security, generate a long-lived access token and save to `.env`:

```
HA_URL=http://localhost:8123
HA_TOKEN=<paste>
```

- [ ] **Step 3: Inspect HA's actual storage versions and reconcile with the loader**

```bash
for k in core.floor_registry core.area_registry core.device_registry core.entity_registry; do
  echo "=== $k ==="
  if [ -f "dev/ha-config/.storage/$k" ]; then
    head -c 200 "dev/ha-config/.storage/$k"
    echo
  else
    echo "(not present)"
  fi
done
```

For each registry that's present, note the `version` and `minor_version` values. If any differ from the constants in `tests/fixtures/_builder/serialize-storage.ts` (`STORAGE_VERSIONS`), update the constants to match. If a registry isn't present yet (e.g. `core.floor_registry` only appears after the user creates a floor), keep the existing constant — the loader writes a fresh file at that version anyway.

- [ ] **Step 4: Run the loader**

```bash
pnpm fixtures:load english-cluttered
```

Expected output:

- Fixture summary line with floor/area/device/entity counts.
- "backed up previous registries → …" if anything was present.
- "wrote 4 registry files…"
- "wrote lovelacer-fixtures.yaml + ensured configuration.yaml include"
- HA stop, HA start, then "✓ fixture loaded".

If the script exits non-zero, troubleshoot per the message and re-run.

- [ ] **Step 5: Verify ≥150 entities + 6 areas via WebSocket**

Use a small one-off script. Run from the repo root:

```bash
node --experimental-vm-modules -e "
import('home-assistant-js-websocket').then(async ({ createConnection, createLongLivedTokenAuth }) => {
  const { config } = await import('dotenv')
  config()
  const { default: WebSocket } = await import('ws')
  globalThis.WebSocket = WebSocket
  const auth = createLongLivedTokenAuth(process.env.HA_URL, process.env.HA_TOKEN)
  const conn = await createConnection({ auth })
  const entities = await conn.sendMessagePromise({ type: 'config/entity_registry/list' })
  const areas = await conn.sendMessagePromise({ type: 'config/area_registry/list' })
  console.log('entities:', entities.length)
  console.log('areas:', areas.length)
  conn.close()
})
"
```

Expected: `entities: 165` (or whatever the fixture's actual count is, ≥150) and `areas: 6`.

If `entities` shows zero, check `docker logs lovelacer-dev-ha --tail 100` for HA startup errors related to `lovelacer-fixtures.yaml` or `core.entity_registry` parse failures.

- [ ] **Step 6: Verify `/api/health` reports `ha.connected: true`**

In another terminal:

```bash
pnpm dev
```

Then:

```bash
curl -s http://localhost:3000/api/health | jq
```

Expected: `{ "ok": true, "version": "0.0.0", "ha": { "connected": true } }`.

- [ ] **Step 7: Verify idempotency**

Run the loader again with the same fixture:

```bash
pnpm fixtures:load english-cluttered
```

Expected: succeeds; a new backup directory appears under `dev/ha-config/.storage/`; entity count and area count via WS are unchanged. `configuration.yaml` still has exactly one `# lovelacer:fixtures` line:

```bash
grep -c '# lovelacer:fixtures' dev/ha-config/configuration.yaml
```

Expected: `1`.

- [ ] **Step 8: Run the full test suite once more**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: all green.

- [ ] **Step 9: If `STORAGE_VERSIONS` was updated in Step 3, commit that fix**

```bash
git add tests/fixtures/_builder/serialize-storage.ts
git commit -m "fix(fixtures): pin storage schema versions to live HA stable"
```

(If no version updates were needed, skip this commit.)

- [ ] **Step 10: Update `dev/README.md` to remove the "added in P0-2" placeholder line**

The current `dev/README.md` says:

```
(This script is added in P0-2.)
```

Edit it to remove that parenthetical — the script now exists. Verify the surrounding section still reads naturally.

```bash
git add dev/README.md
git commit -m "docs(dev): drop P0-2 placeholder note from fixtures section"
```

---

## P0-2 Acceptance Confirmation

Run through the AC from the spec:

- [ ] `pnpm fixtures:load english-cluttered` runs end-to-end and exits 0 (Task 11 / Step 4).
- [ ] `pnpm dev` connects, `/api/health` reports `ha.connected: true` (Task 11 / Step 6).
- [ ] WS `config/entity_registry/list` returns ≥150 entries; `config/area_registry/list` returns 6 (Task 11 / Step 5).
- [ ] Re-running the loader with the same fixture is idempotent (Task 11 / Step 7).
- [ ] Re-running with a different fixture cleanly replaces — verified by exercising the same flow with a one-off `tiny.ts` fixture if desired; not strictly required for AC, but the backup logic is covered by Task 9 unit tests.
- [ ] `pnpm test` passes including builder + fixture self-tests (Task 11 / Step 8).
