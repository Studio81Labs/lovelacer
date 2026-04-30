# P1a-1 Entity Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land `normalize(input)` in `@lovelacer/analyzer` — a pure function that converts HA's raw `HaEntityRegistryEntry[]` + `HaDeviceRegistryEntry[]` into the analyzer's `NormalizedEntity[]` shape, with friendly-name resolution and device attachment.

**Architecture:** Single function in a single file (`packages/analyzer/src/normalize.ts`), unit-tested in isolation with small inline registry literals plus an end-to-end test against the canonical `english-cluttered` fixture from P0-2. A small fixture-to-HA-registries helper bridges the fixture builder to the function's input shape.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), Vitest. No new runtime dependencies.

**Spec reference:** [`docs/superpowers/specs/2026-04-30-p1a-1-entity-normalization-design.md`](../specs/2026-04-30-p1a-1-entity-normalization-design.md)

---

## Conventions used in this plan

- All TS files use ESM with explicit `.js` import extensions even when importing `.ts` source — repo convention from P0-2.
- Type-only imports use `import type { … } from '…'` (the repo enables `verbatimModuleSyntax`).
- Tests use `import { describe, it, expect } from 'vitest'` (no globals).
- Each task ends with a single commit. Don't batch unrelated changes.
- Commit-message style: `<type>(<scope>): <subject>` matching recent history. Append the existing `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- Run `pnpm` from the repo root or with `--dir <worktree>`. Run `git` from the worktree.

---

## Task 1: Wire analyzer for vitest discovery

**Files:**

- Create: `packages/analyzer/vitest.config.ts`

**Why:** The root `vitest.config.ts` has `include: ['tests/**/*.test.ts', 'dev/**/*.test.ts']`, which does not match `packages/analyzer/src/__tests__/normalize.test.ts`. Without a local config, `pnpm test` would silently report "no tests" for the analyzer package. The P0-2 review flagged this orphan-test risk and Task 1 of this plan closes it for the analyzer package, mirroring `packages/shared/vitest.config.ts`.

- [ ] **Step 1: Create the local vitest config**

Create `packages/analyzer/vitest.config.ts` with content identical to `packages/shared/vitest.config.ts`:

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

- [ ] **Step 2: Verify nothing broke**

```bash
pnpm typecheck
pnpm test
```

Expected: typecheck green; tests green (analyzer still has no test files, but `--passWithNoTests` is set in `packages/analyzer/package.json`).

- [ ] **Step 3: Commit**

```bash
git add packages/analyzer/vitest.config.ts
git commit -m "$(cat <<'EOF'
chore(analyzer): add local vitest config so package tests are discoverable

The root vitest config narrows include to tests/ and dev/, so workspace
packages need their own config (or vitest walks up and finds none of
their tests). Mirrors packages/shared/vitest.config.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Skeleton `normalize` + entity passthrough fields

**Files:**

- Create: `packages/analyzer/src/normalize.ts`
- Create: `packages/analyzer/src/__tests__/normalize.test.ts`
- Modify: `packages/analyzer/src/index.ts`

This task lays down the function signature, returns the per-entity passthrough fields (everything except `friendlyName` and `device`), and exposes the function from the package's barrel. Friendly name and device handling come in Tasks 3-4.

- [ ] **Step 1: Write the failing test**

Create `packages/analyzer/src/__tests__/normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { HaEntityRegistryEntry } from '@lovelacer/shared'
import { normalize } from '../normalize.js'

const baseEntity: HaEntityRegistryEntry = {
  entity_id: 'sensor.living_room_temperature',
  name: 'Living Room Temperature',
  original_name: 'Temperature',
  area_id: 'living_room',
  device_id: null,
  platform: 'lovelacer_fixture',
  hidden_by: null,
  disabled_by: null,
  entity_category: null,
  device_class: 'temperature',
}

describe('normalize — entity passthrough fields', () => {
  it('returns one NormalizedEntity per input entity', () => {
    const out = normalize({ entities: [baseEntity], devices: [] })
    expect(out).toHaveLength(1)
  })

  it('passes through entityId, domain, objectId', () => {
    const [e] = normalize({ entities: [baseEntity], devices: [] })
    expect(e!.entityId).toBe('sensor.living_room_temperature')
    expect(e!.domain).toBe('sensor')
    expect(e!.objectId).toBe('living_room_temperature')
  })

  it('passes through deviceClass, entityCategory, haAreaId', () => {
    const [e] = normalize({
      entities: [{ ...baseEntity, entity_category: 'diagnostic' }],
      devices: [],
    })
    expect(e!.deviceClass).toBe('temperature')
    expect(e!.entityCategory).toBe('diagnostic')
    expect(e!.haAreaId).toBe('living_room')
  })

  it('reflects hidden_by and disabled_by as boolean flags', () => {
    const out = normalize({
      entities: [
        { ...baseEntity, entity_id: 'sensor.a', hidden_by: 'user', disabled_by: null },
        { ...baseEntity, entity_id: 'sensor.b', hidden_by: null, disabled_by: 'integration' },
        { ...baseEntity, entity_id: 'sensor.c', hidden_by: null, disabled_by: null },
      ],
      devices: [],
    })
    expect(out[0]!.isHidden).toBe(true)
    expect(out[0]!.isDisabled).toBe(false)
    expect(out[1]!.isHidden).toBe(false)
    expect(out[1]!.isDisabled).toBe(true)
    expect(out[2]!.isHidden).toBe(false)
    expect(out[2]!.isDisabled).toBe(false)
  })

  it('returns empty array for empty input', () => {
    expect(normalize({ entities: [], devices: [] })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer vitest run packages/analyzer/src/__tests__/normalize.test.ts
```

Expected: FAIL with module-not-found for `../normalize.js`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/analyzer/src/normalize.ts`:

```ts
import type {
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  NormalizedEntity,
} from '@lovelacer/shared'

export interface NormalizeInput {
  entities: HaEntityRegistryEntry[]
  devices: HaDeviceRegistryEntry[]
}

export function normalize(input: NormalizeInput): NormalizedEntity[] {
  return input.entities.map((entity) => normalizeEntity(entity))
}

function normalizeEntity(entity: HaEntityRegistryEntry): NormalizedEntity {
  const dotIndex = entity.entity_id.indexOf('.')
  const domain = entity.entity_id.slice(0, dotIndex)
  const objectId = entity.entity_id.slice(dotIndex + 1)

  return {
    entityId: entity.entity_id,
    domain,
    objectId,
    friendlyName: entity.name ?? entity.original_name ?? objectId, // humanization in Task 3
    deviceClass: entity.device_class,
    entityCategory: entity.entity_category,
    haAreaId: entity.area_id,
    device: null, // device attachment in Task 4
    isHidden: entity.hidden_by !== null,
    isDisabled: entity.disabled_by !== null,
  }
}
```

(Note: `friendlyName` falls back to raw `objectId` here. Task 3 will replace that with `humanize(objectId)`. The current behavior just satisfies the type — none of this task's tests assert friendly-name shape.)

- [ ] **Step 4: Re-export from the package barrel**

Replace the contents of `packages/analyzer/src/index.ts`:

```ts
/**
 * @lovelacer/analyzer
 *
 * Pure functions for analyzing HA registry data and assigning entities
 * to rooms with confidence scores.
 *
 * Implementation lands in:
 *   - P1a-1: normalize.ts        ← this ticket
 *   - P1a-2: keywords.ts (room keyword database, EN+CS for 1a)
 *   - P1a-3: detect.ts (priority chain)
 *   - P1a-4: confidence.ts (scoring + corroboration)
 *   - P1a-5: grouping.ts (domain grouping within rooms)
 */
export const ANALYZER_VERSION = '0.0.0'
export { normalize } from './normalize.js'
export type { NormalizeInput } from './normalize.js'
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer vitest run packages/analyzer/src/__tests__/normalize.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer test
```

Both must exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/analyzer/src/normalize.ts \
        packages/analyzer/src/__tests__/normalize.test.ts \
        packages/analyzer/src/index.ts
git commit -m "$(cat <<'EOF'
feat(analyzer): normalize() skeleton with entity passthrough fields

Pure transform from HaEntityRegistryEntry[] to NormalizedEntity[].
This commit covers entityId, domain, objectId, deviceClass,
entityCategory, haAreaId, isHidden, isDisabled. friendlyName falls
back to raw objectId (humanization comes in the next commit) and
device is always null (device attachment comes in the commit after).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Friendly name resolution + `humanize` helper

**Files:**

- Modify: `packages/analyzer/src/normalize.ts`
- Modify: `packages/analyzer/src/__tests__/normalize.test.ts`

- [ ] **Step 1: Add the failing test**

Append to the existing `normalize.test.ts`, right before the final closing `})` of `describe(...)` if the import block is alphabetical, OR as a new top-level `describe` block. Either is fine — use a new `describe` for clarity:

```ts
describe('normalize — friendlyName resolution', () => {
  const e = (overrides: Partial<HaEntityRegistryEntry>): HaEntityRegistryEntry => ({
    ...baseEntity,
    entity_id: 'sensor.living_room_temperature',
    name: null,
    original_name: null,
    ...overrides,
  })

  it('uses entity.name when set', () => {
    const [r] = normalize({
      entities: [e({ name: 'Couch Temp', original_name: 'Temperature' })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Couch Temp')
  })

  it('falls back to entity.original_name when name is null', () => {
    const [r] = normalize({
      entities: [e({ name: null, original_name: 'Temperature' })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Temperature')
  })

  it('falls back to humanized objectId when both are null', () => {
    const [r] = normalize({
      entities: [e({ name: null, original_name: null })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Living Room Temperature')
  })

  it('humanizes single-word objectIds', () => {
    const [r] = normalize({
      entities: [e({ entity_id: 'sensor.kitchen', name: null, original_name: null })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Kitchen')
  })

  it('handles digits and consecutive underscores in humanize', () => {
    const [r] = normalize({
      entities: [e({ entity_id: 'sensor.aqara_th_158d', name: null, original_name: null })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Aqara Th 158d')
  })
})
```

(The `Aqara Th 158d` expectation locks in: title-case is "first letter uppercase, rest lowercase per word"; no acronym preservation; digits left alone.)

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer vitest run packages/analyzer/src/__tests__/normalize.test.ts
```

Expected: FAIL on the "humanizes" tests because the current fallback uses raw `objectId`.

- [ ] **Step 3: Add the `humanize` helper and wire it into the fallback**

Edit `packages/analyzer/src/normalize.ts`:

Replace the current `normalizeEntity` function with:

```ts
function normalizeEntity(entity: HaEntityRegistryEntry): NormalizedEntity {
  const dotIndex = entity.entity_id.indexOf('.')
  const domain = entity.entity_id.slice(0, dotIndex)
  const objectId = entity.entity_id.slice(dotIndex + 1)

  return {
    entityId: entity.entity_id,
    domain,
    objectId,
    friendlyName: entity.name ?? entity.original_name ?? humanize(objectId),
    deviceClass: entity.device_class,
    entityCategory: entity.entity_category,
    haAreaId: entity.area_id,
    device: null, // device attachment in Task 4
    isHidden: entity.hidden_by !== null,
    isDisabled: entity.disabled_by !== null,
  }
}

/**
 * Convert an objectId slug to a display string.
 *
 * Replaces underscores with spaces and title-cases each whitespace-
 * separated word (first letter upper, rest lower). No acronym
 * preservation, no number-aware casing — keep simple until a consumer
 * needs more.
 */
function humanize(slug: string): string {
  if (slug.length === 0) return ''
  return slug
    .split('_')
    .filter((word) => word.length > 0)
    .map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer vitest run packages/analyzer/src/__tests__/normalize.test.ts
```

Expected: PASS (10 tests — 5 from Task 2 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer/src/normalize.ts \
        packages/analyzer/src/__tests__/normalize.test.ts
git commit -m "$(cat <<'EOF'
feat(analyzer): friendlyName resolution priority + humanize helper

friendlyName now falls back through name → original_name →
humanize(objectId). The private humanize helper title-cases each
underscore-separated word, no acronym preservation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Device attachment

**Files:**

- Modify: `packages/analyzer/src/normalize.ts`
- Modify: `packages/analyzer/src/__tests__/normalize.test.ts`

- [ ] **Step 1: Add the failing tests**

First, extend the type-imports at the top of `normalize.test.ts` to include `HaDeviceRegistryEntry`:

```ts
import type { HaDeviceRegistryEntry, HaEntityRegistryEntry } from '@lovelacer/shared'
```

Then append a new `describe` block at the bottom of the file:

```ts
describe('normalize — device attachment', () => {
  const dev: HaDeviceRegistryEntry = {
    id: 'aqara_th_1',
    name: 'Aqara TH',
    name_by_user: 'Couch Sensor',
    manufacturer: 'Aqara',
    model: 'WSDCGQ11LM',
    area_id: 'kitchen',
  }

  it('attaches a NormalizedDevice when entity.device_id resolves', () => {
    const [r] = normalize({
      entities: [{ ...baseEntity, device_id: 'aqara_th_1' }],
      devices: [dev],
    })
    expect(r!.device).toEqual({
      id: 'aqara_th_1',
      name: 'Aqara TH',
      nameByUser: 'Couch Sensor',
      manufacturer: 'Aqara',
      model: 'WSDCGQ11LM',
      haAreaId: 'kitchen',
    })
  })

  it('sets device to null when entity.device_id is null', () => {
    const [r] = normalize({
      entities: [{ ...baseEntity, device_id: null }],
      devices: [dev],
    })
    expect(r!.device).toBeNull()
  })

  it('sets device to null when entity.device_id has no matching device', () => {
    const [r] = normalize({
      entities: [{ ...baseEntity, device_id: 'nonexistent_device' }],
      devices: [dev],
    })
    expect(r!.device).toBeNull()
  })

  it('does NOT propagate device area to entity.haAreaId', () => {
    // Entity has no area_id; device has kitchen. haAreaId on the entity must
    // remain null — area inheritance is the detection chain's job, not ours.
    const [r] = normalize({
      entities: [{ ...baseEntity, area_id: null, device_id: 'aqara_th_1' }],
      devices: [dev],
    })
    expect(r!.haAreaId).toBeNull()
    expect(r!.device?.haAreaId).toBe('kitchen')
  })

  it('drops devices that no entity references (anti-leak)', () => {
    const orphan: HaDeviceRegistryEntry = { ...dev, id: 'orphan_device' }
    const out = normalize({
      entities: [{ ...baseEntity, device_id: 'aqara_th_1' }],
      devices: [dev, orphan],
    })
    // The only way to surface a device is via entity.device. The orphan must
    // never appear there.
    const deviceIds = out.map((e) => e.device?.id).filter((id): id is string => id !== undefined)
    expect(deviceIds).not.toContain('orphan_device')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer vitest run packages/analyzer/src/__tests__/normalize.test.ts
```

Expected: FAIL on all 5 device tests because `device` is hardcoded to `null`.

- [ ] **Step 3: Implement device attachment**

Edit `packages/analyzer/src/normalize.ts`. First, change the imports at the top to also import `NormalizedDevice`:

```ts
import type {
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  NormalizedDevice,
  NormalizedEntity,
} from '@lovelacer/shared'
```

Replace the `normalize` and `normalizeEntity` functions with:

```ts
export function normalize(input: NormalizeInput): NormalizedEntity[] {
  const devicesById = new Map(input.devices.map((d) => [d.id, d]))
  return input.entities.map((entity) => normalizeEntity(entity, devicesById))
}

function normalizeEntity(
  entity: HaEntityRegistryEntry,
  devicesById: Map<string, HaDeviceRegistryEntry>,
): NormalizedEntity {
  const dotIndex = entity.entity_id.indexOf('.')
  const domain = entity.entity_id.slice(0, dotIndex)
  const objectId = entity.entity_id.slice(dotIndex + 1)

  const haDevice = entity.device_id !== null ? devicesById.get(entity.device_id) : undefined
  const device: NormalizedDevice | null = haDevice
    ? {
        id: haDevice.id,
        name: haDevice.name,
        nameByUser: haDevice.name_by_user,
        manufacturer: haDevice.manufacturer,
        model: haDevice.model,
        haAreaId: haDevice.area_id,
      }
    : null

  return {
    entityId: entity.entity_id,
    domain,
    objectId,
    friendlyName: entity.name ?? entity.original_name ?? humanize(objectId),
    deviceClass: entity.device_class,
    entityCategory: entity.entity_category,
    haAreaId: entity.area_id,
    device,
    isHidden: entity.hidden_by !== null,
    isDisabled: entity.disabled_by !== null,
  }
}
```

Leave `humanize` as-is.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer vitest run packages/analyzer/src/__tests__/normalize.test.ts
```

Expected: PASS (15 tests — 10 from Tasks 2-3 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer/src/normalize.ts \
        packages/analyzer/src/__tests__/normalize.test.ts
git commit -m "$(cat <<'EOF'
feat(analyzer): attach NormalizedDevice to entities by device_id

Devices are matched lazily via a Map<id, HaDeviceRegistryEntry> and
inlined onto entity.device. Devices not referenced by any entity are
dropped — they cannot leak into the analyzer graph. Entity.haAreaId
remains the entity's own area_id only; device-area inheritance is the
detection chain's job (P1a-3), not normalization's.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Malformed entity_id throws

**Files:**

- Modify: `packages/analyzer/src/normalize.ts`
- Modify: `packages/analyzer/src/__tests__/normalize.test.ts`

- [ ] **Step 1: Add the failing test**

Append a new `describe` block to `normalize.test.ts`:

```ts
describe('normalize — error handling', () => {
  it('throws when entity_id has no dot separator', () => {
    expect(() =>
      normalize({
        entities: [{ ...baseEntity, entity_id: 'malformed_no_dot' }],
        devices: [],
      }),
    ).toThrow(/malformed_no_dot/)
  })

  it('throws on empty entity_id', () => {
    expect(() =>
      normalize({
        entities: [{ ...baseEntity, entity_id: '' }],
        devices: [],
      }),
    ).toThrow(/entity_id/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer vitest run packages/analyzer/src/__tests__/normalize.test.ts
```

Expected: FAIL — current implementation produces nonsense values for malformed inputs but doesn't throw.

- [ ] **Step 3: Add the validation**

Edit `packages/analyzer/src/normalize.ts`. Replace `normalizeEntity`'s opening with the validation guard:

```ts
function normalizeEntity(
  entity: HaEntityRegistryEntry,
  devicesById: Map<string, HaDeviceRegistryEntry>,
): NormalizedEntity {
  const dotIndex = entity.entity_id.indexOf('.')
  if (dotIndex <= 0 || dotIndex === entity.entity_id.length - 1) {
    throw new Error(
      `malformed entity_id: ${JSON.stringify(entity.entity_id)} — expected '<domain>.<object_id>'`,
    )
  }
  const domain = entity.entity_id.slice(0, dotIndex)
  const objectId = entity.entity_id.slice(dotIndex + 1)

  // ... rest unchanged
```

(The guard `dotIndex <= 0 || dotIndex === entity.entity_id.length - 1` rejects:

- empty string (`indexOf` → -1)
- no dot (`indexOf` → -1)
- leading dot (`.foo`, dotIndex 0)
- trailing dot (`foo.`, dotIndex == length-1)
  …all of which would yield empty domain or empty objectId.)

- [ ] **Step 4: Run tests to verify all pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer vitest run packages/analyzer/src/__tests__/normalize.test.ts
```

Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer/src/normalize.ts \
        packages/analyzer/src/__tests__/normalize.test.ts
git commit -m "$(cat <<'EOF'
feat(analyzer): throw on malformed entity_id

HA entity_ids are always <domain>.<object_id>; an entry that violates
that contract is bad input from upstream and should fail loudly rather
than silently producing nonsense domain/objectId values.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Fixture-to-HA-registries helper + integration test

**Files:**

- Create: `tests/fixtures/_builder/to-ha-registries.ts`
- Modify: `tests/fixtures/_builder/index.ts`
- Modify: `packages/analyzer/src/__tests__/normalize.test.ts`

The fixture builder produces `Fixture` objects (P0-2). The analyzer consumes HA's wire shapes (`HaEntityRegistryEntry[]`, `HaDeviceRegistryEntry[]`). A small bridge function converts one to the other so analyzer tests can use the canonical `english-cluttered` fixture without hand-rolling raw HA entries.

- [ ] **Step 1: Write the bridge helper**

Create `tests/fixtures/_builder/to-ha-registries.ts`:

```ts
import type {
  HaAreaRegistryEntry,
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  HaFloorRegistryEntry,
} from '@lovelacer/shared'
import type { Fixture } from './types.js'

export interface HaRegistries {
  entities: HaEntityRegistryEntry[]
  devices: HaDeviceRegistryEntry[]
  areas: HaAreaRegistryEntry[]
  floors: HaFloorRegistryEntry[]
}

/**
 * Convert a fixture-builder Fixture into the four HA registry list shapes
 * exposed via HA's WS API. The shapes intentionally mirror what
 * home-assistant-js-websocket returns from
 * `config/{entity,device,area,floor}_registry/list`.
 *
 * Fields the analyzer doesn't read are filled with sensible defaults.
 */
export function fixtureToHaRegistries(fx: Fixture): HaRegistries {
  return {
    entities: fx.entities.map((e) => ({
      entity_id: `${e.domain}.${e.objectId}`,
      name: e.nameByUser,
      original_name: e.originalName,
      area_id: e.area,
      device_id: e.device,
      platform: 'lovelacer_fixture',
      hidden_by: e.hidden ? 'user' : null,
      disabled_by: e.disabled ? 'user' : null,
      entity_category: e.entityCategory,
      device_class: e.deviceClass,
    })),
    devices: fx.devices.map((d) => ({
      id: d.id,
      name: d.name,
      name_by_user: d.nameByUser,
      manufacturer: d.manufacturer,
      model: d.model,
      area_id: d.area,
    })),
    areas: fx.areas.map((a) => ({
      area_id: a.id,
      name: a.name,
      floor_id: a.floor,
      icon: a.icon,
    })),
    floors: fx.floors.map((f) => ({
      floor_id: f.id,
      name: f.name,
      level: f.level,
      icon: f.icon,
    })),
  }
}
```

- [ ] **Step 2: Re-export from the builder barrel**

Edit `tests/fixtures/_builder/index.ts`. Append:

```ts
export * from './to-ha-registries.js'
```

The full file should now be:

```ts
export * from './types.js'
export * from './ids.js'
export * from './fixture.js'
export * from './helpers.js'
export * from './serialize-storage.js'
export * from './serialize-template-yaml.js'
export * from './to-ha-registries.js'
```

- [ ] **Step 3: Add the integration test**

Append to `packages/analyzer/src/__tests__/normalize.test.ts`. First add the import at the top of the file, alongside the existing imports:

```ts
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
```

Then append the new `describe` block at the bottom:

```ts
describe('normalize — english-cluttered fixture (integration)', () => {
  const ha = fixtureToHaRegistries(englishCluttered)
  const result = normalize({ entities: ha.entities, devices: ha.devices })

  it('produces one NormalizedEntity per fixture entity', () => {
    expect(result).toHaveLength(englishCluttered.entities.length)
  })

  it('isDisabled count matches the fixture', () => {
    const expected = englishCluttered.entities.filter((e) => e.disabled).length
    const actual = result.filter((e) => e.isDisabled).length
    expect(actual).toBe(expected)
  })

  it('isHidden count matches the fixture', () => {
    const expected = englishCluttered.entities.filter((e) => e.hidden).length
    const actual = result.filter((e) => e.isHidden).length
    expect(actual).toBe(expected)
  })

  it('diagnostic-category count matches the fixture', () => {
    const expected = englishCluttered.entities.filter(
      (e) => e.entityCategory === 'diagnostic',
    ).length
    const actual = result.filter((e) => e.entityCategory === 'diagnostic').length
    expect(actual).toBe(expected)
  })

  it('attaches a device on at least one entity and leaves at least one without', () => {
    expect(result.some((e) => e.device !== null)).toBe(true)
    expect(result.some((e) => e.device === null)).toBe(true)
  })

  it('preserves entity haAreaId without device-area inheritance', () => {
    // Find an entity with no entity-level area but a device that does.
    const interesting = result.find(
      (e) => e.haAreaId === null && e.device !== null && e.device.haAreaId !== null,
    )
    expect(interesting).toBeDefined()
    expect(interesting!.haAreaId).toBeNull()
    expect(interesting!.device!.haAreaId).not.toBeNull()
  })
})
```

(Four-`..`-deep relative imports are unusual but unavoidable: from `packages/analyzer/src/__tests__/`, four `..` reaches the repo root. The fixture lives at `tests/fixtures/` — same workspace but not a workspace package, so it's reached via relative path. Same pattern `dev/scripts/load-fixture.ts` uses.)

- [ ] **Step 4: Run all tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer test
```

Expected: PASS — analyzer's normalize tests are now ~23 tests; full repo suite stays green.

- [ ] **Step 5: Run typecheck**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/_builder/to-ha-registries.ts \
        tests/fixtures/_builder/index.ts \
        packages/analyzer/src/__tests__/normalize.test.ts
git commit -m "$(cat <<'EOF'
test(analyzer): integration coverage via english-cluttered fixture

Bridges the fixture builder to HA's wire shape with a small
fixtureToHaRegistries helper, then runs normalize() against the
canonical 159-entity english-cluttered fixture. Asserts the signal
counts (disabled, hidden, diagnostic) round-trip and that
device-area inheritance does not leak into entity.haAreaId.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1a-1 Acceptance Confirmation

Run through the AC from the spec one more time:

- [ ] `normalize` is exported from `@lovelacer/analyzer` and accepts the documented `NormalizeInput` (Task 2 / Step 4).
- [ ] All unit tests in `__tests__/normalize.test.ts` pass (Tasks 2-5).
- [ ] The english-cluttered integration test passes (Task 6).
- [ ] `pnpm typecheck` clean (verified at end of every task).
- [ ] `pnpm test` green (verified at end of every task).
