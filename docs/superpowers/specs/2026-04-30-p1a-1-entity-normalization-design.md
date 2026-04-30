# P1a-1 Entity Normalization — Design

**Status:** Draft v1 · **Date:** 2026-04-30 · **Ticket:** [P1a-1 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Provide the analyzer with a single pure function that converts raw Home Assistant registry data — `HaEntityRegistryEntry[]` and `HaDeviceRegistryEntry[]` — into the analyzer-friendly `NormalizedEntity[]` shape. This is the input to every later analyzer ticket: P1a-2 (keyword DB), P1a-3 (detection chain), P1a-4 (confidence), P1a-5 (grouping).

## Non-goals

- Area inheritance from device → entity. That belongs to the detection chain (priority 2 per [HEURISTICS.md](../../HEURISTICS.md)). Normalization preserves the entity's own `area_id` only; it does not propagate.
- Filtering disabled / hidden / diagnostic entries. They pass through with flags set; downstream stages decide what to exclude.
- Any keyword matching, room detection, or confidence scoring.
- Reading from disk, the network, or HA. The function is fully pure.

## Approach summary

Single pure function in a single file. Inputs: arrays of HA registry entries (the shapes already declared in `packages/shared/src/types.ts`). Output: `NormalizedEntity[]`. Devices referenced by entities are normalized inline and attached to each entity's `.device` field; devices with no referencing entities are dropped.

The shape of `NormalizedEntity` and `NormalizedDevice` is already pinned in [`packages/shared/src/types.ts`](../../../packages/shared/src/types.ts) — this spec defines the function semantics that produce values matching those types.

## Architecture

```
packages/analyzer/src/
  normalize.ts            # the function + private humanize helper
  index.ts                # re-exports normalize and ANALYZER_VERSION
  __tests__/
    normalize.test.ts     # TDD coverage
```

The analyzer package already exists from Phase 0 with `index.ts` as a placeholder; this ticket fills in the first real implementation.

## Public API

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

export function normalize(input: NormalizeInput): NormalizedEntity[]
```

Re-exported from `packages/analyzer/src/index.ts` so consumers write `import { normalize } from '@lovelacer/analyzer'`.

## Behavior

### Per-entity transformation

For each entry in `input.entities`, produce exactly one `NormalizedEntity`:

| `NormalizedEntity` field | Source                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `entityId`               | `entity.entity_id`                                                                                     |
| `domain`, `objectId`     | Split `entity.entity_id` on the first `.`. Throw on malformed input (no dot).                          |
| `friendlyName`           | First non-null of `entity.name`, then `entity.original_name`, then `humanize(objectId)`.               |
| `deviceClass`            | Passthrough from `entity.device_class`.                                                                |
| `entityCategory`         | Passthrough from `entity.entity_category`.                                                             |
| `haAreaId`               | `entity.area_id` only. **Not** inherited from the device.                                              |
| `device`                 | Matched `NormalizedDevice` (see below) if `entity.device_id` resolves to an input device; else `null`. |
| `isHidden`               | `entity.hidden_by !== null`.                                                                           |
| `isDisabled`             | `entity.disabled_by !== null`.                                                                         |

### Per-device transformation (only when referenced)

A `NormalizedDevice` is built lazily from any `HaDeviceRegistryEntry` that some entity references:

| `NormalizedDevice` field | Source                |
| ------------------------ | --------------------- |
| `id`                     | `device.id`           |
| `name`                   | `device.name`         |
| `nameByUser`             | `device.name_by_user` |
| `manufacturer`           | `device.manufacturer` |
| `model`                  | `device.model`        |
| `haAreaId`               | `device.area_id`      |

Implementation note: build a single `Map<deviceId, NormalizedDevice>` lazily as entities are processed. Devices not referenced by any entity are absent from the output graph (no leaking through, no separate device list).

### `humanize` helper

Private to `normalize.ts`. Converts a slug to a display string:

```ts
function humanize(slug: string): string
```

- Replace `_` with ` `.
- Title-case each whitespace-separated word (first letter upper, rest lower).
- `"living_room_temperature"` → `"Living Room Temperature"`.
- `""` → `""`. (Defensive: should not occur because `objectId` is required after the dot, but the function is total.)

No acronym preservation, no number-aware casing — YAGNI for v1. Add later if a consumer needs `"Wifi"` → `"WiFi"`.

## Error handling

| Condition                                                           | Behavior                                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `entity.entity_id` has no `.`                                       | Throw `Error` with the bad value.                                |
| `entity.device_id` is set but no matching device in `input.devices` | Set `entity.device = null`. Not an error — registries can drift. |
| `entity.device_id` is `null`                                        | Set `entity.device = null`.                                      |
| Empty `input.entities`                                              | Return `[]`.                                                     |

## Testing

TDD. Two layers of tests in `__tests__/normalize.test.ts`:

### Unit tests — focused

Each test isolates one transformation rule. Use small inline `HaEntityRegistryEntry` / `HaDeviceRegistryEntry` literals (3-5 entries) to drive cases:

- Friendly name priority: `name` wins over `original_name` wins over `humanize(objectId)`.
- `humanize` produces the documented outputs (covered through `normalize`'s observable output, no separate export).
- `isDisabled` / `isHidden` reflect their `_by` source fields.
- `entityCategory: 'diagnostic'` passes through.
- `haAreaId` is the entity's own area, _never_ the device's. Anti-regression for detection's responsibility.
- Device attached when `device_id` resolves; `null` when it doesn't; `null` when `device_id` is `null`.
- Device with no referencing entity does not surface in any output entity's `.device`.
- Malformed `entity_id` (no dot) throws.

### Integration test — fixture-driven

One end-to-end test that consumes the canonical `english-cluttered` fixture from P0-2 (~159 entities). A tiny test helper `fixtureToHaRegistries(fixture)` converts the `Fixture` shape into `HaEntityRegistryEntry[]` and `HaDeviceRegistryEntry[]` so the test can call `normalize()` with realistic input.

The test asserts:

- Output length matches input entity count.
- The number of `isDisabled === true` entries matches the fixture's known disabled count.
- The number of `isHidden === true` entries matches the fixture's known hidden count.
- The number of `entityCategory === 'diagnostic'` entries matches.
- At least one entity has a non-null `.device`, and at least one has `.device === null` (covers the propagation behavior).
- No throws on the full fixture (confirms no malformed `entity_id`s slip through the fixture builder).

The `fixtureToHaRegistries` helper lives next to the test or in `tests/fixtures/_builder/` if it grows useful for other consumers later.

## File-by-file

| File                                                | Action       | Notes                                                                                        |
| --------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| `packages/analyzer/src/normalize.ts`                | Create       | `normalize` + private `humanize`                                                             |
| `packages/analyzer/src/index.ts`                    | Modify       | Re-export `normalize` (and its types if any)                                                 |
| `packages/analyzer/src/__tests__/normalize.test.ts` | Create       | Unit + integration tests                                                                     |
| `packages/analyzer/vitest.config.ts`                | Create       | Per the orphan-test note in root vitest config                                               |
| `tests/fixtures/_builder/index.ts`                  | Maybe modify | If `fixtureToHaRegistries` lands in the builder; otherwise the helper lives in the test file |

## Open questions resolved during brainstorming

- **Friendly name when no name is set:** humanize the objectId.
- **Filtering at this layer:** none — pass everything through with flags. Downstream filters.
- **Area inheritance:** out of scope for normalization; that's detection priority 2.
- **Devices with no entities:** dropped from output.
- **Failure mode for malformed entity_id:** throw.

## Risks

- **Drift between `NormalizedDevice` and HA's actual device shape.** Mitigated: the `HaDeviceRegistryEntry` type lives in shared and was vetted against live HA stable during P0-2's smoke test.
- **The `humanize` helper not matching HA's UI exactly.** Acceptable: `friendlyName` is for our analyzer's display + keyword-matching, not a contract with HA. If a consumer later needs HA-identical behavior, swap the helper.

## Acceptance

P1a-1 closes when:

- [ ] `normalize` is exported from `@lovelacer/analyzer` and accepts the documented `NormalizeInput`.
- [ ] All unit tests in `__tests__/normalize.test.ts` pass.
- [ ] The english-cluttered integration test passes (no throws, signal counts match).
- [ ] `pnpm typecheck` clean across the workspace.
- [ ] `pnpm test` green.
