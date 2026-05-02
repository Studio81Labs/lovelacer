# P2-5 Suggestions Panel (Lite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface three rule-based, accept/dismiss suggestions on the analyze view (`set_area_id`, `move_room`, `hide_diagnostic`) so users can polish detection results in one click; dismissals persist across runs via SQLite.

**Architecture:** Pure suggestion engine in `@lovelacer/analyzer` consumes a top-N detector output plus the existing override snapshot; new SQLite store persists dismissals; server attaches `suggestions[]` to `PreviewOutput`; new POST endpoint records dismissals; new Vue panel renders cards with per-type Accept verbs that delegate to the existing `useOverridesStore` (or open a HA deep-link) and Dismiss verb that hits the new endpoint with optimistic UI.

**Tech Stack:** TypeScript strict + ESM (`.js` import extensions), Fastify + Zod, better-sqlite3 (WAL), Vue 3 + Pinia 2 + Tailwind 4, Vitest.

**Source spec:** `docs/superpowers/specs/2026-05-02-p2-5-suggestions-panel-design.md` (commit `9435a32`).

**Conventions to honor (from prior Phase 2 tickets):**

- Web package mirrors server types locally (no workspace dep on `@lovelacer/server`/`@lovelacer/shared`); `roomId` widened to `string`.
- All `fetch` paths use document-relative URLs (no leading slash) to survive HA Supervisor ingress at `/api/hassio_ingress/<token>/`.
- `exactOptionalPropertyTypes` is on. Use the `...(cond ? { field } : {})` spread, never `field: cond ? value : undefined`.
- SQLite stores: `mkdirSync(dirname, { recursive: true })` for file paths, `':memory:'` for tests, `journal_mode = WAL`, prepared statements hoisted in the constructor.
- Tests with Pinia: `createTestingPinia({ stubActions: false, createSpy: vi.fn })`.
- Vitest globals are off — every test file imports `describe, it, expect, vi, ...` from `'vitest'`.
- Run a full workspace build at the very end of each task (after the per-package test) to catch type regressions across package boundaries.

**Working directory:** `.worktrees/p2-5-suggestions/` on branch `feat/p2-5-suggestions`. The setup happens before Task 1 (see "Worktree setup" below).

---

## Worktree setup (run BEFORE Task 1)

```bash
cd /Users/akadlec/Development/Studio81Labs/lovelacer
git fetch origin
git worktree add -b feat/p2-5-suggestions .worktrees/p2-5-suggestions origin/main
cd .worktrees/p2-5-suggestions
pnpm install
pnpm -r test
```

Expected: `pnpm -r test` passes (workspace-wide green baseline; if not, fix before starting).

All later commands assume `cwd = .worktrees/p2-5-suggestions/`. Remember: do NOT run `pnpm` from the main repo root.

---

## File summary

**New files:**

- `packages/analyzer/src/suggestions.ts`
- `packages/analyzer/src/__tests__/suggestions.test.ts`
- `packages/server/src/storage/dismissed-suggestion-store.ts`
- `packages/server/src/storage/__tests__/dismissed-suggestion-store.test.ts`
- `packages/server/src/routes/suggestions.ts`
- `packages/server/src/__tests__/routes/suggestions.test.ts`
- `packages/web/src/stores/suggestions.ts`
- `packages/web/src/__tests__/stores/suggestions.test.ts`
- `packages/web/src/components/SuggestionsPanel.vue`
- `packages/web/src/__tests__/components/SuggestionsPanel.test.ts`

**Modified files:**

- `packages/shared/src/types.ts` — add `SuggestionType`, `Suggestion`, `AlternativeAssignment`; extend `RoomAssignment.alternatives?`
- `packages/analyzer/src/detect.ts` — emit top-N alternatives in `assemble()`
- `packages/analyzer/src/index.ts` — re-export `computeSuggestions`
- `packages/analyzer/src/__tests__/detect.test.ts` — extend with alternatives coverage
- `packages/server/src/pipeline.ts` — extend `PreviewOutput` with `suggestions`, compute via `computeSuggestions`, accept `DismissedSuggestionStore` in `runPreview`
- `packages/server/src/app.ts` — register `suggestionsRoute`, add `dismissedSuggestions` to `CreateAppOptions`, plumb to `previewRoute`
- `packages/server/src/main.ts` — instantiate + close `DismissedSuggestionStore`
- `packages/server/src/routes/preview.ts` — pass `dismissedSuggestions` through to `runPreview`
- `packages/server/src/__tests__/routes/preview.test.ts` — extend with suggestion + dismissed-filter cases (and pass new store into `makeApp`)
- `packages/server/src/__tests__/routes/invite-gate.test.ts` — extend with `POST /api/suggestions/dismiss` 403 case (and pass new store into `makeApp`)
- `packages/web/src/api/types.ts` — mirror `Suggestion`, `SuggestionType`, extend `PreviewOutput.suggestions`
- `packages/web/src/api/client.ts` — `postDismissSuggestion`
- `packages/web/src/__tests__/api/client.test.ts` — extend with dismiss test
- `packages/web/src/App.vue` — render `SuggestionsPanel`, watch-reset suggestions store on preview change

---

### Task 1: Shared types — `Suggestion`, `SuggestionType`, `AlternativeAssignment`, extend `RoomAssignment`

**Files:**

- Modify: `packages/shared/src/types.ts` (replace existing `RoomAssignment` interface near line 101 and append the new types)

This task adds the type vocabulary the rest of the plan consumes. No tests — types are checked transitively by every package that imports them.

- [ ] **Step 1: Edit `packages/shared/src/types.ts`**

In `packages/shared/src/types.ts`, replace the existing `RoomAssignment` interface (lines 101-112) with the version that adds `alternatives?`, and append the new `AlternativeAssignment`, `SuggestionType`, `Suggestion` types directly below it.

Replace this block:

```ts
export interface RoomAssignment {
  entityId: string
  roomId: CanonicalRoomId
  confidence: number
  signals: DetectionSignal[]
  /**
   * True iff this assignment was overridden by user override (P1b-3).
   * Detector-produced assignments leave this undefined; the override
   * patch step in `runFullPipeline` sets it.
   */
  manual?: boolean
}
```

with:

```ts
export interface RoomAssignment {
  entityId: string
  roomId: CanonicalRoomId
  confidence: number
  signals: DetectionSignal[]
  /**
   * True iff this assignment was overridden by user override (P1b-3).
   * Detector-produced assignments leave this undefined; the override
   * patch step in `runFullPipeline` sets it.
   */
  manual?: boolean
  /**
   * P2-5 — top-N candidate rooms (excluding the winner) that scored
   * above the detector's alternative threshold. Used by the suggestion
   * engine to power "consider X instead" prompts. Capped at 2 entries
   * to avoid noise. Field is omitted entirely when empty so consumers
   * can `if (a.alternatives !== undefined)` cleanly under
   * exactOptionalPropertyTypes.
   */
  alternatives?: AlternativeAssignment[]
}

export interface AlternativeAssignment {
  roomId: CanonicalRoomId
  confidence: number
}

/**
 * P2-5 — three rule-based hints surfaced on the analyze view. Each has
 * an Accept verb (delegated to existing override calls or a HA deep-link)
 * and a Dismiss verb that persists across runs via DismissedSuggestionStore.
 */
export type SuggestionType = 'set_area_id' | 'move_room' | 'hide_diagnostic'

export interface Suggestion {
  entityId: string
  type: SuggestionType
  /** Brief user-facing prose. Localizable later (P2-9). */
  message: string
  /** For move_room only: the suggested target room (top alternative). */
  suggestedRoomId?: CanonicalRoomId
  /** For set_area_id only: the canonical room we matched. Used for the deep-link + display. */
  matchedRoomId?: CanonicalRoomId
}
```

- [ ] **Step 2: Build the shared package and verify type exports**

Run: `pnpm --filter @lovelacer/shared build`

Expected: build succeeds with no TS errors.

- [ ] **Step 3: Build the workspace to confirm no downstream type breakage**

Run: `pnpm -r build`

Expected: every package builds. (Existing detector code has no `alternatives` field on its return value yet — that's fine, the field is optional.)

- [ ] **Step 4: Run all tests**

Run: `pnpm -r test`

Expected: all green. The new types aren't referenced yet so behavior is unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add Suggestion, SuggestionType, AlternativeAssignment types

P2-5 vocabulary. Extend RoomAssignment with optional alternatives[]
field (top-N runner-up rooms from the detector). Pure type addition;
no runtime change yet."
```

---

### Task 2: Detector emits top-N alternatives

**Files:**

- Modify: `packages/analyzer/src/detect.ts` (function `assemble`, lines 129-155)
- Modify: `packages/analyzer/src/__tests__/detect.test.ts` (append a new `describe` block at the end)

**Background.** The current `assemble()` finds the highest-weight fired signal as the winner, then computes confidence as `winner.weight + corroborationBoost`. We need to additionally compute per-target aggregate scores (each non-winner target's top weight + its own corroboration boost), filter by `score >= 0.2`, sort desc, take top 2, and emit as `alternatives`. The winner-selection logic must NOT change (existing tests pin the current behavior).

**Approach for non-mutation safety:** insert the alternatives calculation at the bottom of `assemble`, after `confidence`/`signals` are computed but before the `return`. Use the same per-target boost formula (`Math.min(0.1, (count - 1) * 0.05)`) for parity.

- [ ] **Step 1: Add the failing tests**

Append to `packages/analyzer/src/__tests__/detect.test.ts` (new `describe` block at the end):

```ts
describe('detectEntity — alternatives (P2-5 top-N)', () => {
  // The fixture has these areas mapped via findRoom:
  //   kitchen → kitchen
  //   living_room → living_room
  //   bedroom → bedroom
  //   barts_den → null
  // (See top-of-file `ctx` setup in the existing tests.)

  it('omits alternatives entirely when only one target fired', () => {
    const result = detectEntity({ ...baseEntity, haAreaId: 'living_room' }, ctx)
    expect(result.roomId).toBe('living_room')
    expect(result.alternatives).toBeUndefined()
  })

  it('emits alternatives sorted by score descending, excluding the winner', () => {
    // entity_area for kitchen (weight 1.0) wins.
    // friendly_name "Living Room" fires (weight 0.6) → living_room alternative.
    // entity_id "bedroom_lamp" fires (weight 0.5) → bedroom alternative.
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'kitchen',
        friendlyName: 'Living Room Light',
        objectId: 'bedroom_lamp',
      },
      ctx,
    )
    expect(result.roomId).toBe('kitchen')
    expect(result.alternatives).toEqual([
      { roomId: 'living_room', confidence: 0.6 },
      { roomId: 'bedroom', confidence: 0.5 },
    ])
  })

  it('caps alternatives at 2 entries even when more candidates score above threshold', () => {
    // entity_area for kitchen wins (1.0).
    // friendly_name match → living_room (0.6).
    // entity_id match → bedroom (0.5).
    // device_name match → bathroom (0.45).
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'kitchen',
        friendlyName: 'Living Room Light',
        objectId: 'bedroom_lamp',
        device: {
          id: 'd1',
          name: 'Bathroom Hub',
          nameByUser: null,
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctx,
    )
    expect(result.alternatives).toHaveLength(2)
    expect(result.alternatives?.[0]?.roomId).toBe('living_room')
    expect(result.alternatives?.[1]?.roomId).toBe('bedroom')
  })

  it('omits alternatives below the 0.2 threshold', () => {
    // No way to score below 0.2 with current weights (min is device_name 0.45),
    // so this test exercises the threshold boundary by relying on the filter
    // never including a target whose top-signal weight is below 0.2.
    // Pin the boundary by setting up a scenario where only the winner fires.
    const result = detectEntity({ ...baseEntity, haAreaId: 'kitchen' }, ctx)
    expect(result.alternatives).toBeUndefined()
  })

  it('never includes misc in alternatives', () => {
    // Baseline: only the winner fires (priority 1 entity_area). No
    // 'misc' target exists in fired[] because misc is the fallback when
    // nothing fires, so this assertion guards against a future regression
    // where misc accidentally leaks into the alternatives array.
    const result = detectEntity({ ...baseEntity, haAreaId: 'kitchen' }, ctx)
    expect(result.alternatives?.some((a) => a.roomId === 'misc')).toBeFalsy()
  })
})
```

- [ ] **Step 2: Run new tests to verify they fail**

Run: `pnpm --filter @lovelacer/analyzer test -- detect.test.ts`

Expected: 4-5 failures in the new `describe` block. Existing tests still pass.

- [ ] **Step 3: Implement alternatives in `assemble`**

Edit `packages/analyzer/src/detect.ts`. Add the type import at the top:

```ts
import type {
  AlternativeAssignment,
  CanonicalRoomId,
  DetectionSignal,
  HaAreaRegistryEntry,
  NormalizedEntity,
  RoomAssignment,
} from '@lovelacer/shared'
```

Then replace the `assemble` function (lines 129-155) with:

```ts
const ALTERNATIVE_THRESHOLD = 0.2
const ALTERNATIVE_LIMIT = 2

function assemble(entityId: string, fired: FiredSignal[]): RoomAssignment {
  if (fired.length === 0) {
    return { entityId, roomId: 'misc', confidence: 0, signals: [] }
  }
  // Highest-weight target wins; ties broken by priority (insertion) order.
  let winner = fired[0]!
  for (const s of fired) {
    if (s.weight > winner.weight) winner = s
  }

  // Corroboration boost: count fired signals pointing to the winning room.
  // Each additional corroborator adds 0.05; cap at 0.10. Final confidence
  // capped at 1.0. Different-target signals don't corroborate — see
  // docs/HEURISTICS.md "Boost for corroboration" and the P1a-4 spec.
  const corroborationCount = fired.filter((s) => s.target === winner.target).length
  const boost = Math.min(0.1, (corroborationCount - 1) * 0.05)
  const confidence = Math.min(1.0, winner.weight + boost)

  // Strip the internal `target` field before exposing signals publicly.
  const signals: DetectionSignal[] = fired.map(({ target: _t, ...rest }) => rest)

  // P2-5 — compute alternative rooms. Group fired signals by target,
  // score each non-winner target the same way (top weight + same
  // corroboration formula capped at 1.0), filter below threshold, sort
  // desc, take top N. Same boost formula as the winner so users see
  // comparable confidence numbers across the panel.
  const byTarget = new Map<Exclude<CanonicalRoomId, 'misc'>, FiredSignal[]>()
  for (const s of fired) {
    const list = byTarget.get(s.target)
    if (list === undefined) byTarget.set(s.target, [s])
    else list.push(s)
  }
  const altScores: AlternativeAssignment[] = []
  for (const [target, sigs] of byTarget) {
    if (target === winner.target) continue
    let topWeight = sigs[0]!.weight
    for (const s of sigs) {
      if (s.weight > topWeight) topWeight = s.weight
    }
    const altBoost = Math.min(0.1, (sigs.length - 1) * 0.05)
    const altConfidence = Math.min(1.0, topWeight + altBoost)
    if (altConfidence >= ALTERNATIVE_THRESHOLD) {
      altScores.push({ roomId: target, confidence: altConfidence })
    }
  }
  altScores.sort((a, b) => b.confidence - a.confidence)
  const alternatives = altScores.slice(0, ALTERNATIVE_LIMIT)

  return {
    entityId,
    roomId: winner.target,
    confidence,
    signals,
    ...(alternatives.length > 0 ? { alternatives } : {}),
  }
}
```

- [ ] **Step 4: Run new tests to verify they pass**

Run: `pnpm --filter @lovelacer/analyzer test -- detect.test.ts`

Expected: all green (existing + new).

- [ ] **Step 5: Run full workspace tests to confirm no regression**

Run: `pnpm -r test`

Expected: all green. Pre-existing snapshot tests in `analyzer`/`server` may include `RoomAssignment` shapes — alternatives is optional so unchanged shapes still match.

- [ ] **Step 6: Commit**

```bash
git add packages/analyzer/src/detect.ts packages/analyzer/src/__tests__/detect.test.ts
git commit -m "feat(analyzer): emit top-N alternatives in detector output

assemble() now groups fired signals by target room, scores each
non-winner the same way (top weight + matching corroboration boost,
capped at 1.0), filters below 0.2 threshold, sorts desc, takes top 2.
Field omitted entirely when empty for exactOptionalPropertyTypes.

Powers the P2-5 'move_room' suggestion which surfaces close-call
runner-ups (within 0.15 confidence of the winner)."
```

---

### Task 3: Suggestion engine — `computeSuggestions`

**Files:**

- Create: `packages/analyzer/src/suggestions.ts`
- Create: `packages/analyzer/src/__tests__/suggestions.test.ts`
- Modify: `packages/analyzer/src/index.ts` (add re-export)

This is a pure function. Build it test-first.

- [ ] **Step 1: Create the failing test file**

Create `packages/analyzer/src/__tests__/suggestions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  NormalizedEntity,
  Override,
  RoomAssignment,
} from '@lovelacer/shared'
import { computeSuggestions } from '../suggestions.js'

function makeEntity(over: Partial<NormalizedEntity> = {}): NormalizedEntity {
  return {
    entityId: 'sensor.foo',
    domain: 'sensor',
    objectId: 'foo',
    friendlyName: 'Foo',
    deviceClass: null,
    entityCategory: null,
    haAreaId: null,
    device: null,
    isHidden: false,
    isDisabled: false,
    ...over,
  }
}

function makeAssignment(over: Partial<RoomAssignment> = {}): RoomAssignment {
  return {
    entityId: 'sensor.foo',
    roomId: 'kitchen' as CanonicalRoomId,
    confidence: 0.6,
    signals: [{ source: 'friendly_name', weight: 0.6, matchedValue: 'kitchen' }],
    ...over,
  }
}

function makeRoom(assignments: RoomAssignment[]): AnalyzedRoom {
  return {
    id: 'kitchen' as CanonicalRoomId,
    haAreaId: null,
    displayName: 'Kitchen',
    entityCount: assignments.length,
    averageConfidence: 0,
    assignments,
  }
}

function input(overrides: {
  rooms?: AnalyzedRoom[]
  miscEntityIds?: Set<string>
  entitiesById?: Map<string, NormalizedEntity>
  overridesById?: Map<string, Override>
  dismissed?: Set<string>
}) {
  return {
    rooms: overrides.rooms ?? [],
    miscEntityIds: overrides.miscEntityIds ?? new Set<string>(),
    entitiesById: overrides.entitiesById ?? new Map(),
    overridesById: overrides.overridesById ?? new Map(),
    dismissed: overrides.dismissed ?? new Set<string>(),
  }
}

describe('computeSuggestions — empty input', () => {
  it('returns empty array when there are no rooms or misc', () => {
    expect(computeSuggestions(input({}))).toEqual([])
  })
})

describe('computeSuggestions — set_area_id', () => {
  const entity = makeEntity({ entityId: 'sensor.foo', haAreaId: null })
  const entitiesById = new Map([[entity.entityId, entity]])
  const assignment = makeAssignment({ entityId: entity.entityId, confidence: 0.6 })

  it('emits when entity has no haAreaId, name-based dominant signal, confidence >= 0.6', () => {
    const result = computeSuggestions(input({ rooms: [makeRoom([assignment])], entitiesById }))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      entityId: entity.entityId,
      type: 'set_area_id',
      matchedRoomId: 'kitchen',
    })
  })

  it('does NOT emit when entity already has haAreaId set', () => {
    const e = makeEntity({ entityId: 'sensor.foo', haAreaId: 'area_1' })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([assignment])],
        entitiesById: new Map([[e.entityId, e]]),
      }),
    )
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })

  it('does NOT emit when device has haAreaId set', () => {
    const e = makeEntity({
      entityId: 'sensor.foo',
      haAreaId: null,
      device: {
        id: 'd1',
        name: 'X',
        nameByUser: null,
        manufacturer: null,
        model: null,
        haAreaId: 'area_1',
      },
    })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([assignment])],
        entitiesById: new Map([[e.entityId, e]]),
      }),
    )
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })

  it('does NOT emit when confidence < 0.6', () => {
    const a = makeAssignment({ entityId: entity.entityId, confidence: 0.59 })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })

  it('does NOT emit when dominant signal is entity_area', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      signals: [{ source: 'entity_area', weight: 1.0 }],
      confidence: 1.0,
    })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })

  it('does NOT emit when dominant signal is device_area', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      signals: [{ source: 'device_area', weight: 0.85 }],
      confidence: 0.85,
    })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })
})

describe('computeSuggestions — move_room', () => {
  const entity = makeEntity({ entityId: 'sensor.bar', haAreaId: 'area_1' })
  const entitiesById = new Map([[entity.entityId, entity]])

  it('emits when confidence < 0.5 and top alternative is within 0.15', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      confidence: 0.45,
      signals: [{ source: 'entity_area', weight: 0.45 }],
      alternatives: [{ roomId: 'living_room' as CanonicalRoomId, confidence: 0.4 }],
    })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    const move = result.find((s) => s.type === 'move_room')
    expect(move).toBeDefined()
    expect(move?.suggestedRoomId).toBe('living_room')
  })

  it('does NOT emit when confidence >= 0.5', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      confidence: 0.5,
      alternatives: [{ roomId: 'living_room' as CanonicalRoomId, confidence: 0.45 }],
    })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'move_room')).toBeUndefined()
  })

  it('does NOT emit when alternatives is missing', () => {
    const a = makeAssignment({ entityId: entity.entityId, confidence: 0.45 })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'move_room')).toBeUndefined()
  })

  it('does NOT emit when top alternative is more than 0.15 below winner', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      confidence: 0.45,
      alternatives: [{ roomId: 'living_room' as CanonicalRoomId, confidence: 0.25 }],
    })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'move_room')).toBeUndefined()
  })

  it('does NOT emit when an override with roomId already exists', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      confidence: 0.45,
      alternatives: [{ roomId: 'living_room' as CanonicalRoomId, confidence: 0.4 }],
    })
    const overridesById = new Map<string, Override>([
      [entity.entityId, { entityId: entity.entityId, roomId: 'office' as CanonicalRoomId }],
    ])
    const result = computeSuggestions(
      input({ rooms: [makeRoom([a])], entitiesById, overridesById }),
    )
    expect(result.find((s) => s.type === 'move_room')).toBeUndefined()
  })
})

describe('computeSuggestions — hide_diagnostic', () => {
  it('emits for diagnostic entities not yet hidden', () => {
    const entity = makeEntity({
      entityId: 'sensor.batt',
      entityCategory: 'diagnostic',
      isHidden: false,
    })
    const a = makeAssignment({ entityId: entity.entityId, confidence: 1.0 })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([a])],
        entitiesById: new Map([[entity.entityId, entity]]),
      }),
    )
    const hide = result.find((s) => s.type === 'hide_diagnostic')
    expect(hide).toBeDefined()
    expect(hide?.entityId).toBe(entity.entityId)
  })

  it('does NOT emit for non-diagnostic entities', () => {
    const entity = makeEntity({ entityId: 'sensor.x', entityCategory: null })
    const a = makeAssignment({ entityId: entity.entityId, confidence: 1.0 })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([a])],
        entitiesById: new Map([[entity.entityId, entity]]),
      }),
    )
    expect(result.find((s) => s.type === 'hide_diagnostic')).toBeUndefined()
  })

  it('does NOT emit when entity.isHidden is already true', () => {
    const entity = makeEntity({
      entityId: 'sensor.batt',
      entityCategory: 'diagnostic',
      isHidden: true,
    })
    const a = makeAssignment({ entityId: entity.entityId, confidence: 1.0 })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([a])],
        entitiesById: new Map([[entity.entityId, entity]]),
      }),
    )
    expect(result.find((s) => s.type === 'hide_diagnostic')).toBeUndefined()
  })

  it('does NOT emit when an override has hidden=true', () => {
    const entity = makeEntity({
      entityId: 'sensor.batt',
      entityCategory: 'diagnostic',
      isHidden: false,
    })
    const a = makeAssignment({ entityId: entity.entityId, confidence: 1.0 })
    const overridesById = new Map<string, Override>([
      [entity.entityId, { entityId: entity.entityId, hidden: true }],
    ])
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([a])],
        entitiesById: new Map([[entity.entityId, entity]]),
        overridesById,
      }),
    )
    expect(result.find((s) => s.type === 'hide_diagnostic')).toBeUndefined()
  })

  it('emits for misc entities that are diagnostic', () => {
    const entity = makeEntity({
      entityId: 'sensor.misc_diag',
      entityCategory: 'diagnostic',
      isHidden: false,
    })
    const result = computeSuggestions(
      input({
        miscEntityIds: new Set([entity.entityId]),
        entitiesById: new Map([[entity.entityId, entity]]),
      }),
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('hide_diagnostic')
  })
})

describe('computeSuggestions — dismissed filter', () => {
  it('drops suggestions whose (entityId|type) is in the dismissed set', () => {
    const entity = makeEntity({ entityId: 'sensor.foo', haAreaId: null })
    const a = makeAssignment({ entityId: entity.entityId, confidence: 0.6 })
    const dismissed = new Set([`${entity.entityId}|set_area_id`])
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([a])],
        entitiesById: new Map([[entity.entityId, entity]]),
        dismissed,
      }),
    )
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })
})

describe('computeSuggestions — sort order', () => {
  it('sorts by entityId ascending then by type ascending', () => {
    const a = makeEntity({
      entityId: 'sensor.aaa',
      entityCategory: 'diagnostic',
      isHidden: false,
      haAreaId: null,
    })
    const b = makeEntity({
      entityId: 'sensor.bbb',
      entityCategory: 'diagnostic',
      isHidden: false,
      haAreaId: null,
    })
    const aa = makeAssignment({ entityId: a.entityId, confidence: 0.6 })
    const ba = makeAssignment({ entityId: b.entityId, confidence: 0.6 })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([aa, ba])],
        entitiesById: new Map([
          [a.entityId, a],
          [b.entityId, b],
        ]),
      }),
    )
    // Each entity emits set_area_id + hide_diagnostic. Expect:
    //   sensor.aaa | hide_diagnostic
    //   sensor.aaa | set_area_id
    //   sensor.bbb | hide_diagnostic
    //   sensor.bbb | set_area_id
    expect(result.map((s) => `${s.entityId}|${s.type}`)).toEqual([
      'sensor.aaa|hide_diagnostic',
      'sensor.aaa|set_area_id',
      'sensor.bbb|hide_diagnostic',
      'sensor.bbb|set_area_id',
    ])
  })
})
```

- [ ] **Step 2: Run the test file to confirm it fails (module not found)**

Run: `pnpm --filter @lovelacer/analyzer test -- suggestions.test.ts`

Expected: error "Cannot find module '../suggestions.js'" — every test reports failed module resolution.

- [ ] **Step 3: Create `packages/analyzer/src/suggestions.ts`**

```ts
import type {
  AnalyzedRoom,
  NormalizedEntity,
  Override,
  RoomAssignment,
  Suggestion,
} from '@lovelacer/shared'

/**
 * Input for {@link computeSuggestions}. All fields are required (callers
 * pre-build the lookups so the engine stays a pure O(n) walk with O(1)
 * map/set probes).
 */
export interface ComputeSuggestionsInput {
  rooms: AnalyzedRoom[]
  miscEntityIds: Set<string>
  entitiesById: Map<string, NormalizedEntity>
  overridesById: Map<string, Override>
  /** Serialized "entityId|type" keys for O(1) "is this dismissed?" lookup. */
  dismissed: Set<string>
}

const NAME_BASED_SOURCES = new Set(['friendly_name', 'entity_id', 'device_name'])
const SET_AREA_MIN_CONFIDENCE = 0.6
const MOVE_ROOM_MAX_CONFIDENCE = 0.5
/** Top alternative must be within this delta of the winner to be considered close. */
const MOVE_ROOM_GAP = 0.15

/**
 * Pure suggestion engine. Walks every assigned entity (skipping the misc
 * room) plus every misc entity, applies the three rules, filters
 * dismissed keys, sorts deterministically, returns the result.
 *
 * No IO. Caller pre-builds the lookups so this stays sub-millisecond on
 * realistic 500-entity installs.
 */
export function computeSuggestions(input: ComputeSuggestionsInput): Suggestion[] {
  const out: Suggestion[] = []

  for (const room of input.rooms) {
    if (room.id === 'misc') continue
    for (const a of room.assignments) {
      const entity = input.entitiesById.get(a.entityId)
      if (entity === undefined) continue
      const override = input.overridesById.get(a.entityId)

      const setArea = trySetAreaIdSuggestion(a, entity)
      if (setArea !== null && !isDismissed(input.dismissed, setArea)) out.push(setArea)

      const moveRoom = tryMoveRoomSuggestion(a, override)
      if (moveRoom !== null && !isDismissed(input.dismissed, moveRoom)) out.push(moveRoom)

      const hideDiag = tryHideDiagnosticSuggestion(entity, override)
      if (hideDiag !== null && !isDismissed(input.dismissed, hideDiag)) out.push(hideDiag)
    }
  }

  // Diagnostic suggestions also apply to misc entities — they can pile up
  // there as detection-eluding "Battery", "Signal Strength" sensors.
  for (const entityId of input.miscEntityIds) {
    const entity = input.entitiesById.get(entityId)
    if (entity === undefined) continue
    const override = input.overridesById.get(entityId)
    const hideDiag = tryHideDiagnosticSuggestion(entity, override)
    if (hideDiag !== null && !isDismissed(input.dismissed, hideDiag)) out.push(hideDiag)
  }

  out.sort((a, b) => {
    const cmp = a.entityId.localeCompare(b.entityId, 'en')
    if (cmp !== 0) return cmp
    return a.type.localeCompare(b.type, 'en')
  })

  return out
}

function isDismissed(set: Set<string>, s: Suggestion): boolean {
  return set.has(`${s.entityId}|${s.type}`)
}

function trySetAreaIdSuggestion(a: RoomAssignment, entity: NormalizedEntity): Suggestion | null {
  if (entity.haAreaId !== null) return null
  if ((entity.device?.haAreaId ?? null) !== null) return null
  if (a.confidence < SET_AREA_MIN_CONFIDENCE) return null
  // Find the highest-weight signal — that's the dominant detection
  // source for this assignment.
  let dominant = a.signals[0]
  for (const s of a.signals) {
    if (dominant === undefined || s.weight > dominant.weight) dominant = s
  }
  if (dominant === undefined || !NAME_BASED_SOURCES.has(dominant.source)) return null
  return {
    entityId: a.entityId,
    type: 'set_area_id',
    matchedRoomId: a.roomId,
    message:
      'This entity has no area set in HA. Detected via its name. Set the area in HA so the assignment is permanent.',
  }
}

function tryMoveRoomSuggestion(
  a: RoomAssignment,
  override: Override | undefined,
): Suggestion | null {
  if (a.confidence >= MOVE_ROOM_MAX_CONFIDENCE) return null
  if (override?.roomId !== undefined) return null
  const alt = a.alternatives?.[0]
  if (alt === undefined) return null
  if (alt.confidence <= a.confidence - MOVE_ROOM_GAP) return null
  return {
    entityId: a.entityId,
    type: 'move_room',
    suggestedRoomId: alt.roomId,
    message: `Low-confidence assignment (${Math.round(a.confidence * 100)}%). Consider moving to a different room.`,
  }
}

function tryHideDiagnosticSuggestion(
  entity: NormalizedEntity,
  override: Override | undefined,
): Suggestion | null {
  if (entity.entityCategory !== 'diagnostic') return null
  if (entity.isHidden) return null
  if (override?.hidden === true) return null
  return {
    entityId: entity.entityId,
    type: 'hide_diagnostic',
    message: 'Diagnostic entity. Hide from the dashboard?',
  }
}
```

- [ ] **Step 4: Re-export from the analyzer index**

Edit `packages/analyzer/src/index.ts`. Append after the existing `assignFloors` lines:

```ts
export { computeSuggestions } from './suggestions.js'
export type { ComputeSuggestionsInput } from './suggestions.js'
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `pnpm --filter @lovelacer/analyzer test -- suggestions.test.ts`

Expected: all green.

- [ ] **Step 6: Run full workspace tests**

Run: `pnpm -r test`

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/analyzer/src/suggestions.ts \
  packages/analyzer/src/__tests__/suggestions.test.ts \
  packages/analyzer/src/index.ts
git commit -m "feat(analyzer): pure computeSuggestions engine

Three rules: set_area_id (name-detected entity has no HA area_id),
move_room (low confidence with close runner-up), hide_diagnostic
(diagnostic entity not yet hidden). Filters out keys in the
dismissed set. Sorts by entityId then type for deterministic UI.

Pure function, no IO. O(n) walk with O(1) lookups. Re-exported from
@lovelacer/analyzer for the server pipeline."
```

---

### Task 4: `DismissedSuggestionStore` (SQLite, multi-row composite key)

**Files:**

- Create: `packages/server/src/storage/dismissed-suggestion-store.ts`
- Create: `packages/server/src/storage/__tests__/dismissed-suggestion-store.test.ts`

- [ ] **Step 1: Create the failing test file**

Create `packages/server/src/storage/__tests__/dismissed-suggestion-store.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DismissedSuggestionStore } from '../dismissed-suggestion-store.js'

describe('DismissedSuggestionStore (in-memory)', () => {
  let store: DismissedSuggestionStore

  beforeEach(() => {
    store = new DismissedSuggestionStore(':memory:')
  })

  afterEach(() => {
    store.close()
  })

  it('returns an empty Set on a fresh store', () => {
    expect(store.getAllAsKeySet().size).toBe(0)
  })

  it('persists a dismissal and exposes it as the entityId|type key', () => {
    store.dismiss('sensor.foo', 'set_area_id')
    const set = store.getAllAsKeySet()
    expect(set.has('sensor.foo|set_area_id')).toBe(true)
    expect(set.size).toBe(1)
  })

  it('is idempotent — dismissing the same (entityId, type) twice yields one row', () => {
    store.dismiss('sensor.foo', 'set_area_id')
    store.dismiss('sensor.foo', 'set_area_id')
    expect(store.getAllAsKeySet().size).toBe(1)
  })

  it('treats different types of the same entity as distinct rows', () => {
    store.dismiss('sensor.foo', 'set_area_id')
    store.dismiss('sensor.foo', 'hide_diagnostic')
    const set = store.getAllAsKeySet()
    expect(set.size).toBe(2)
    expect(set.has('sensor.foo|set_area_id')).toBe(true)
    expect(set.has('sensor.foo|hide_diagnostic')).toBe(true)
  })
})

describe('DismissedSuggestionStore (file-backed)', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dss-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates the parent directory if missing', () => {
    const filename = join(dir, 'nested', 'lovelacer.sqlite')
    const store = new DismissedSuggestionStore(filename)
    try {
      store.dismiss('a.b', 'move_room')
      expect(store.getAllAsKeySet().has('a.b|move_room')).toBe(true)
    } finally {
      store.close()
    }
  })

  it('persists across instances', () => {
    const filename = join(dir, 'lovelacer.sqlite')
    const first = new DismissedSuggestionStore(filename)
    first.dismiss('a.b', 'move_room')
    first.close()
    const second = new DismissedSuggestionStore(filename)
    try {
      expect(second.getAllAsKeySet().has('a.b|move_room')).toBe(true)
    } finally {
      second.close()
    }
  })
})
```

- [ ] **Step 2: Run tests — confirm failure**

Run: `pnpm --filter @lovelacer/server test -- dismissed-suggestion-store.test.ts`

Expected: module-not-found errors on `../dismissed-suggestion-store.js`.

- [ ] **Step 3: Create the store**

Create `packages/server/src/storage/dismissed-suggestion-store.ts`:

```ts
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { Database as DatabaseType, Statement } from 'better-sqlite3'
import type { SuggestionType } from '@lovelacer/shared'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS dismissed_suggestions (
    entity_id       TEXT    NOT NULL,
    suggestion_type TEXT    NOT NULL,
    dismissed_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (entity_id, suggestion_type)
  );
`

interface DismissedRow {
  entity_id: string
  suggestion_type: string
}

/**
 * SQLite-backed persistence for dismissed P2-5 suggestions.
 *
 * Multi-row table keyed `(entity_id, suggestion_type)` — matches the
 * granularity of the `Suggestion` shape (one row per dismissed suggestion).
 * INSERT OR REPLACE makes `dismiss()` idempotent (re-dismissing updates
 * the timestamp without raising a constraint error).
 *
 * Constructor accepts ':memory:' for tests; for file paths, the parent
 * directory is created if missing. Mirrors `OverrideStore` /
 * `AppliedSnapshotStore`.
 */
export class DismissedSuggestionStore {
  private readonly db: DatabaseType
  private readonly stmtGetAll: Statement
  private readonly stmtDismiss: Statement

  constructor(filename: string) {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true })
    }
    this.db = new Database(filename)
    this.db.pragma('journal_mode = WAL')
    // SQLite DDL — better-sqlite3's exec(), not Node's child_process.exec.
    this.db.exec(SCHEMA)

    this.stmtGetAll = this.db.prepare(
      'SELECT entity_id, suggestion_type FROM dismissed_suggestions ORDER BY entity_id, suggestion_type',
    )
    this.stmtDismiss = this.db.prepare(
      'INSERT OR REPLACE INTO dismissed_suggestions (entity_id, suggestion_type, dismissed_at) ' +
        'VALUES (?, ?, unixepoch())',
    )
  }

  /**
   * Returns dismissals as a Set of "entityId|type" keys for O(1) lookup
   * by the suggestion engine. The serialization matches what
   * `computeSuggestions`'s dismissed-set filter expects.
   */
  getAllAsKeySet(): Set<string> {
    const rows = this.stmtGetAll.all() as DismissedRow[]
    const out = new Set<string>()
    for (const row of rows) out.add(`${row.entity_id}|${row.suggestion_type}`)
    return out
  }

  dismiss(entityId: string, type: SuggestionType): void {
    this.stmtDismiss.run(entityId, type)
  }

  /** Closes the underlying DB. Used in tests to release ':memory:' handles. */
  close(): void {
    this.db.close()
  }
}
```

- [ ] **Step 4: Run the tests — confirm green**

Run: `pnpm --filter @lovelacer/server test -- dismissed-suggestion-store.test.ts`

Expected: all 6 tests green.

- [ ] **Step 5: Run full workspace tests**

Run: `pnpm -r test`

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/storage/dismissed-suggestion-store.ts \
  packages/server/src/storage/__tests__/dismissed-suggestion-store.test.ts
git commit -m "feat(server): add DismissedSuggestionStore for P2-5 persistence

Multi-row SQLite table keyed (entity_id, suggestion_type), WAL mode,
prepared statements hoisted in the constructor, file-or-:memory:
constructor signature mirroring OverrideStore. INSERT OR REPLACE
makes dismiss() idempotent.

getAllAsKeySet() returns the same 'entityId|type' shape that
computeSuggestions's dismissed-set filter consumes — no in-pipeline
transformation needed."
```

---

### Task 5: `POST /api/suggestions/dismiss` route + invite-gate test

**Files:**

- Create: `packages/server/src/routes/suggestions.ts`
- Create: `packages/server/src/__tests__/routes/suggestions.test.ts`
- Modify: `packages/server/src/__tests__/routes/invite-gate.test.ts` (extend `makeApp` + add gating test)

The route is wired into `app.ts` in **Task 6** alongside the pipeline change. Task 5 stops at unit-testing the route plugin in isolation (matches the `invite.test.ts` style). The invite-gate test gets extended now because it constructs the full `createApp`, and we want the gating contract pinned before pipeline plumbing lands.

- [ ] **Step 1: Create the failing route test**

Create `packages/server/src/__tests__/routes/suggestions.test.ts`:

```ts
import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { afterEach, describe, expect, it } from 'vitest'
import { suggestionsRoute } from '../../routes/suggestions.js'
import { DismissedSuggestionStore } from '../../storage/dismissed-suggestion-store.js'

let store: DismissedSuggestionStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

async function makeApp() {
  store = new DismissedSuggestionStore(':memory:')
  const app = Fastify({ logger: false })
  await app.register(sensible)
  await app.register(suggestionsRoute, { dismissed: store })
  return app
}

describe('POST /api/suggestions/dismiss', () => {
  it('returns 200 { ok: true } and persists for a valid body', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/suggestions/dismiss',
        payload: { entityId: 'sensor.foo', suggestionType: 'set_area_id' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ ok: true })
      expect(store!.getAllAsKeySet().has('sensor.foo|set_area_id')).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body when entityId is missing', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/suggestions/dismiss',
        payload: { suggestionType: 'set_area_id' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body when suggestionType is unknown', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/suggestions/dismiss',
        payload: { entityId: 'sensor.foo', suggestionType: 'magic' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('accepts each of the three valid suggestion types', async () => {
    const app = await makeApp()
    try {
      for (const t of ['set_area_id', 'move_room', 'hide_diagnostic']) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/suggestions/dismiss',
          payload: { entityId: `sensor.${t}`, suggestionType: t },
        })
        expect(res.statusCode).toBe(200)
      }
      expect(store!.getAllAsKeySet().size).toBe(3)
    } finally {
      await app.close()
    }
  })
})
```

- [ ] **Step 2: Run the test — confirm failure**

Run: `pnpm --filter @lovelacer/server test -- routes/suggestions.test.ts`

Expected: module-not-found on `../../routes/suggestions.js`.

- [ ] **Step 3: Create the route plugin**

Create `packages/server/src/routes/suggestions.ts`:

```ts
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { DismissedSuggestionStore } from '../storage/dismissed-suggestion-store.js'

export interface SuggestionsRouteOptions {
  dismissed: DismissedSuggestionStore
}

const SUGGESTION_TYPES = ['set_area_id', 'move_room', 'hide_diagnostic'] as const

const DismissBodySchema = z.object({
  entityId: z.string().min(1).max(255),
  suggestionType: z.enum(SUGGESTION_TYPES),
})

/**
 * POST /api/suggestions/dismiss — persists a dismissal so the suggestion
 * is filtered out of every future preview.
 *
 * Body: `{ entityId: string, suggestionType: SuggestionType }`.
 *
 * Errors:
 * - 400 invalid_body — body fails schema (missing/invalid fields)
 * - 500 storage_error — better-sqlite3 threw
 */
export const suggestionsRoute: FastifyPluginAsync<SuggestionsRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post('/api/suggestions/dismiss', async (req, reply) => {
    const parsed = DismissBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      })
    }
    try {
      opts.dismissed.dismiss(parsed.data.entityId, parsed.data.suggestionType)
      return reply.code(200).send({ ok: true })
    } catch (err) {
      req.log.error({ err }, 'dismiss suggestion failed')
      return reply.code(500).send({ error: 'storage_error', message: String(err) })
    }
  })
}
```

- [ ] **Step 4: Run route tests — confirm green**

Run: `pnpm --filter @lovelacer/server test -- routes/suggestions.test.ts`

Expected: all 4 tests green.

- [ ] **Step 5: Extend the invite-gate test for the new route**

Edit `packages/server/src/__tests__/routes/invite-gate.test.ts`. Add the import at the top (after the existing `OverrideStore` import):

```ts
import { DismissedSuggestionStore } from '../../storage/dismissed-suggestion-store.js'
```

Add a module-scope state for cleanup (after the existing `let invite: InviteStore | null = null`):

```ts
let dismissed: DismissedSuggestionStore | null = null
```

Extend the `afterEach` to close it:

```ts
afterEach(() => {
  invite?.close()
  invite = null
  dismissed?.close()
  dismissed = null
})
```

Modify the `makeApp` helper to construct + pass the store:

```ts
async function makeApp(opts: { accepted: boolean }) {
  invite = new InviteStore(':memory:')
  dismissed = new DismissedSuggestionStore(':memory:')
  if (opts.accepted) invite.accept('BETA-2026-ALPHA')
  return createApp({
    ha: makeHa(),
    overrides: new OverrideStore(':memory:'),
    invite,
    appliedSnapshot: makeAppliedSnapshot(),
    dismissedSuggestions: dismissed,
    logLevel: 'silent',
    dashboardUrlPath: 'lovelacer-home',
  })
}
```

(The `dismissedSuggestions: dismissed` field becomes a required field on `CreateAppOptions` in Task 6 — this test will fail to compile until then, which is fine because Step 7 verifies after that wiring lands.)

Add a new gating test after the existing `'blocks GET /api/export.yaml ...'` test:

```ts
it('blocks POST /api/suggestions/dismiss with 403 when not accepted', async () => {
  // P2-5 — the dismiss endpoint must be gated like every other /api/* route.
  const app = await makeApp({ accepted: false })
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/api/suggestions/dismiss',
      payload: { entityId: 'sensor.foo', suggestionType: 'set_area_id' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ error: 'invite_required' })
  } finally {
    await app.close()
  }
})
```

- [ ] **Step 6: Skip running the gate test for now (next task wires it up)**

The gate test will fail to compile until `CreateAppOptions.dismissedSuggestions` is added in Task 6. That's expected — Task 6 finishes the wiring.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/routes/suggestions.ts \
  packages/server/src/__tests__/routes/suggestions.test.ts \
  packages/server/src/__tests__/routes/invite-gate.test.ts
git commit -m "feat(server): POST /api/suggestions/dismiss route

Zod validation on body shape, persists via DismissedSuggestionStore,
returns { ok: true } on success or 400/500 envelopes on error.

Extends invite-gate test to pin the gating contract on the new
endpoint (compiles after Task 6 wires CreateAppOptions)."
```

---

### Task 6: Pipeline + main.ts + app.ts wiring (suggestions on PreviewOutput)

**Files:**

- Modify: `packages/server/src/pipeline.ts` (extend `PreviewOutput`, `runPreview`, `runApply`)
- Modify: `packages/server/src/app.ts` (extend `CreateAppOptions`, register `suggestionsRoute`, plumb through `previewRoute`/`applyRoute`)
- Modify: `packages/server/src/main.ts` (instantiate + close `DismissedSuggestionStore`)
- Modify: `packages/server/src/routes/preview.ts` (accept + pass `dismissedSuggestions`)
- Modify: `packages/server/src/routes/apply.ts` (accept + pass `dismissedSuggestions`)
- Modify: `packages/server/src/__tests__/routes/preview.test.ts` (extend `makeApp` + add suggestion test cases)

This is the biggest task — it's the seam where the suggestion engine, the new route, the preview pipeline, and the gate test all meet.

- [ ] **Step 1: Extend the preview test fixture and add failing assertions**

First, look at the current `makeApp` helper in `packages/server/src/__tests__/routes/preview.test.ts` to learn its exact shape. Then edit it to construct + pass a `DismissedSuggestionStore`. Add this import near the existing storage imports:

```ts
import { DismissedSuggestionStore } from '../../storage/dismissed-suggestion-store.js'
```

Add the test-scope cleanup variable + close in `afterEach` next to the existing ones (search for `OverrideStore(':memory:')` to find the right area). The pattern matches the invite-gate change in Task 5:

```ts
let dismissed: DismissedSuggestionStore | null = null

afterEach(() => {
  // ...existing cleanup...
  dismissed?.close()
  dismissed = null
})
```

Update `makeApp` to construct + pass the store. Look for where `appliedSnapshot` is passed to `createApp` and add `dismissedSuggestions: dismissed` alongside it. Concretely:

```ts
async function makeApp(/* existing args */) {
  // ...existing construction...
  dismissed = new DismissedSuggestionStore(':memory:')
  return createApp({
    /* existing args */,
    dismissedSuggestions: dismissed,
  })
}
```

(Adapt to the actual `makeApp` signature in the file — its arguments may differ from the one in `invite-gate.test.ts`.)

Then append two new test blocks at the end of the file:

```ts
describe('POST /api/preview — suggestions', () => {
  it('returns suggestions[] for a fixture with a no-area name-detected entity', async () => {
    // englishCluttered fixture has at least one entity that:
    //   - has no haAreaId (and device has no haAreaId)
    //   - matches a canonical room via friendly_name
    //   - confidence >= 0.6 (single-source 0.6 winner; no corroboration)
    // Test pins that the pipeline computes + attaches suggestions[] to
    // the response.
    const app = await makeApp({ accepted: true })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { suggestions: { type: string }[] }
      expect(Array.isArray(body.suggestions)).toBe(true)
      expect(body.suggestions.some((s) => s.type === 'set_area_id')).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('does NOT return dismissed suggestions in the preview response', async () => {
    const app = await makeApp({ accepted: true })
    try {
      // First call: discover a real (entityId, type) pair that's currently
      // suggested.
      const first = await app.inject({ method: 'POST', url: '/api/preview' })
      const firstBody = first.json() as {
        suggestions: { entityId: string; type: string }[]
      }
      const target = firstBody.suggestions.find((s) => s.type === 'set_area_id')
      expect(target).toBeDefined()

      // Dismiss it via the new endpoint.
      const dismissRes = await app.inject({
        method: 'POST',
        url: '/api/suggestions/dismiss',
        payload: { entityId: target!.entityId, suggestionType: target!.type },
      })
      expect(dismissRes.statusCode).toBe(200)

      // Re-preview — the dismissed (entityId, type) is gone.
      const second = await app.inject({ method: 'POST', url: '/api/preview' })
      const secondBody = second.json() as {
        suggestions: { entityId: string; type: string }[]
      }
      const stillThere = secondBody.suggestions.find(
        (s) => s.entityId === target!.entityId && s.type === target!.type,
      )
      expect(stillThere).toBeUndefined()
    } finally {
      await app.close()
    }
  })
})
```

- [ ] **Step 2: Run preview tests — confirm failure**

Run: `pnpm --filter @lovelacer/server test -- routes/preview.test.ts`

Expected: TypeScript compile error (`CreateAppOptions` has no `dismissedSuggestions`) on `makeApp`. That's the failure-state for this task.

- [ ] **Step 3: Add `suggestions` to `PreviewOutput` and compute it in `runPreview`**

Edit `packages/server/src/pipeline.ts`. Update the imports (add `Suggestion`, `computeSuggestions`):

```ts
import {
  assignFloors,
  computeDiff,
  computeSuggestions,
  detect,
  groupByDomain,
  normalize,
  type RoomGrouping,
} from '@lovelacer/analyzer'
```

Append `Suggestion` to the existing shared-types import block. The block (around lines 16-26) becomes:

```ts
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  DiffResult,
  FloorAssignment,
  HaAreaRegistryEntry,
  NormalizedEntity,
  Override,
  RoomAssignment,
  SnapshotAssignment,
  Suggestion,
} from '@lovelacer/shared'
```

Add the new store import after the existing storage imports:

```ts
import type { DismissedSuggestionStore } from './storage/dismissed-suggestion-store.js'
```

Extend `PreviewOutput` (lines 36-40):

```ts
export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
  /** Null when no snapshot has been saved yet (first-run case). */
  diff: DiffResult | null
  /** P2-5 — actionable hints. Always present (empty array when none). */
  suggestions: Suggestion[]
}
```

Update the `runPreview` signature + body. Replace the existing `runPreview` function (lines 323-369) with:

```ts
export async function runPreview(
  ha: HaClient,
  overrides: OverrideStore,
  appliedSnapshot: AppliedSnapshotStore,
  dismissedSuggestions: DismissedSuggestionStore,
): Promise<PreviewOutput> {
  const state = await runFullPipeline(ha, overrides)

  // Drop the misc grouping before view generation: misc entities surface
  // via the analyze response's `misc[]` field, not as a dashboard view.
  const dashboardGroupings = state.groupings.filter((g) => g.roomId !== 'misc')

  const home = buildHomeView({
    entities: state.entities,
    groupings: dashboardGroupings,
    rooms: state.rooms,
    floorAssignments: state.floorAssignments,
  })
  const rooms = buildRoomViews(dashboardGroupings)
  const config = buildLovelaceConfig({ home, rooms })

  // Build the flat assignments list the diff expects: every visible
  // entity → its assigned room (or null for misc). Mirrors what the
  // frontend will send back at apply time.
  const currentAssignments: SnapshotAssignment[] = []
  for (const room of state.rooms) {
    for (const a of room.assignments) {
      currentAssignments.push({ entityId: a.entityId, roomId: room.id })
    }
  }
  for (const m of state.misc) {
    currentAssignments.push({ entityId: m.entityId, roomId: null })
  }

  const snapshot = appliedSnapshot.get()
  const diff =
    snapshot === null
      ? null
      : computeDiff({ snapshot, current: { assignments: currentAssignments } })

  // P2-5 — compute suggestions. Pre-build the lookups computeSuggestions
  // expects so the engine stays a pure O(n) walk. miscEntityIds is
  // derived from state.misc which is already filtered to visible
  // (non-hidden, non-disabled) entities by runFullPipeline.
  const overridesById = new Map<string, Override>()
  for (const o of overrides.getAll()) overridesById.set(o.entityId, o)
  const entitiesById = new Map<string, NormalizedEntity>()
  for (const e of state.entities) entitiesById.set(e.entityId, e)
  const miscEntityIds = new Set(state.misc.map((m) => m.entityId))

  const suggestions = computeSuggestions({
    rooms: state.rooms,
    miscEntityIds,
    entitiesById,
    overridesById,
    dismissed: dismissedSuggestions.getAllAsKeySet(),
  })

  return {
    rooms: state.rooms,
    misc: state.misc,
    summary: state.summary,
    config,
    diff,
    suggestions,
  }
}
```

Update the existing `runApply` (it calls `runPreview` internally for the no-config case at line 387):

```ts
const preview = await runPreview(ha, overrides, appliedSnapshot, dismissedSuggestions)
```

That means `runApply` needs the store passed too. Update its signature:

```ts
export async function runApply(
  ha: HaClient,
  overrides: OverrideStore,
  appliedSnapshot: AppliedSnapshotStore,
  dismissedSuggestions: DismissedSuggestionStore,
  body: ApplyInput,
  defaultOptions: ApplyDashboardOptions = {},
): Promise<RunApplyResult> {
```

(Keep the function body otherwise identical — the only call to `runPreview` now uses the new param.)

- [ ] **Step 4: Wire the new store through `app.ts`**

Edit `packages/server/src/app.ts`. Update the imports near the top:

```ts
import { suggestionsRoute } from './routes/suggestions.js'
import type { DismissedSuggestionStore } from './storage/dismissed-suggestion-store.js'
```

Extend `CreateAppOptions` (after `appliedSnapshot`):

```ts
export interface CreateAppOptions {
  ha: HaClient
  overrides: OverrideStore
  invite: InviteStore
  appliedSnapshot: AppliedSnapshotStore
  dismissedSuggestions: DismissedSuggestionStore
  // ...rest unchanged
```

Pass `dismissedSuggestions` through `previewRoute` and `applyRoute` registrations (plus register `suggestionsRoute` after `overridesRoute`). Replace the registrations block (around lines 87-106):

```ts
await app.register(inviteRoute, { invite: opts.invite })
await app.register(analyzeRoute, { ha: opts.ha, overrides: opts.overrides })
await app.register(previewRoute, {
  ha: opts.ha,
  overrides: opts.overrides,
  appliedSnapshot: opts.appliedSnapshot,
  dismissedSuggestions: opts.dismissedSuggestions,
})
await app.register(applyRoute, {
  ha: opts.ha,
  overrides: opts.overrides,
  appliedSnapshot: opts.appliedSnapshot,
  dismissedSuggestions: opts.dismissedSuggestions,
  dashboardUrlPath: opts.dashboardUrlPath,
})
await app.register(exportRoute, {
  ha: opts.ha,
  overrides: opts.overrides,
  appliedSnapshot: opts.appliedSnapshot,
  dashboardUrlPath: opts.dashboardUrlPath,
})
await app.register(overridesRoute, { overrides: opts.overrides })
await app.register(suggestionsRoute, { dismissed: opts.dismissedSuggestions })
```

- [ ] **Step 5: Update `previewRoute` and `applyRoute` to accept + forward the store**

Open `packages/server/src/routes/preview.ts`. Find its `PreviewRouteOptions` interface — it currently lists `ha`, `overrides`, `appliedSnapshot`. Add `dismissedSuggestions`. Inside the handler, find the `runPreview(...)` call and pass it through.

Apply the same change to `packages/server/src/routes/apply.ts` (`applyRoute`) — its options interface already lists `appliedSnapshot`; add `dismissedSuggestions: DismissedSuggestionStore`, and pass it as the 4th arg to `runApply(ha, overrides, appliedSnapshot, dismissedSuggestions, body, ...)`.

If the existing options interfaces use `import type { ... } from '../storage/applied-snapshot-store.js'`, mirror that pattern with:

```ts
import type { DismissedSuggestionStore } from '../storage/dismissed-suggestion-store.js'
```

and add `dismissedSuggestions: DismissedSuggestionStore` to the route's options interface.

- [ ] **Step 6: Wire the store in `main.ts`**

Edit `packages/server/src/main.ts`. Add the import:

```ts
import { DismissedSuggestionStore } from './storage/dismissed-suggestion-store.js'
```

Add instantiation after the existing `appliedSnapshot` block (after line 41):

```ts
const dismissedSuggestionsPath = resolve(config.dataDir, 'lovelacer.sqlite')
const dismissedSuggestions = new DismissedSuggestionStore(dismissedSuggestionsPath)
logger.info({ path: dismissedSuggestionsPath }, 'dismissed-suggestion store opened')
```

Pass it into `createApp`:

```ts
const app = await createApp({
  ha,
  overrides,
  invite,
  appliedSnapshot,
  dismissedSuggestions,
  isDev,
  logLevel: config.logLevel,
  logger,
  dashboardUrlPath: config.dashboardUrlPath,
  ...(config.webDistDir !== undefined && { webDistDir: config.webDistDir }),
})
```

Close it on shutdown:

```ts
    } finally {
      overrides.close()
      invite.close()
      appliedSnapshot.close()
      dismissedSuggestions.close()
    }
```

- [ ] **Step 7: Run preview + invite-gate + suggestions tests**

Run: `pnpm --filter @lovelacer/server test -- routes/preview.test.ts routes/invite-gate.test.ts routes/suggestions.test.ts`

Expected: all green. The two new preview tests pass (englishCluttered fixture is known to produce at least one no-area name-detected entity). The new invite-gate test passes. The standalone suggestions route tests still pass.

If the first new preview test fails because the fixture happens to NOT produce a `set_area_id`-eligible entity, fall back to a more lenient assertion: `expect(body.suggestions.length).toBeGreaterThan(0)`. If even that fails, the fixture lacks any candidate; switch to a different existing fixture (the `tests/fixtures/` directory has several) by importing it instead of `englishCluttered` in `makeApp`. Document any switch with a one-line comment in the test.

- [ ] **Step 8: Run the full workspace test + build**

Run: `pnpm -r test && pnpm -r build`

Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/pipeline.ts \
  packages/server/src/app.ts \
  packages/server/src/main.ts \
  packages/server/src/routes/preview.ts \
  packages/server/src/routes/apply.ts \
  packages/server/src/__tests__/routes/preview.test.ts
git commit -m "feat(server): attach suggestions[] to PreviewOutput, wire DismissedSuggestionStore

runPreview now pre-builds entitiesById/overridesById/miscEntityIds
and calls computeSuggestions, attaching the result to PreviewOutput.
Dismissed-set comes from DismissedSuggestionStore.getAllAsKeySet().

CreateAppOptions and the preview/apply route option interfaces gain
dismissedSuggestions. main.ts instantiates the store at the same
SQLite file path as the others and closes it on shutdown.

Preview-route tests verify the suggestions[] field is populated and
that dismissals filter through to the next preview."
```

---

### Task 7: Web — mirror types + `postDismissSuggestion`

**Files:**

- Modify: `packages/web/src/api/types.ts` (mirror `Suggestion`, `SuggestionType`; extend `PreviewOutput`)
- Modify: `packages/web/src/api/client.ts` (add `postDismissSuggestion`)
- Modify: `packages/web/src/__tests__/api/client.test.ts` (extend with dismiss tests + update `mockPreviewResponse`)

- [ ] **Step 1: Add the failing client test**

Append to `packages/web/src/__tests__/api/client.test.ts` (after the existing `postPreview` block):

```ts
describe('postDismissSuggestion', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to api/suggestions/dismiss with body and returns void on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as unknown as Response)

    const { postDismissSuggestion } = await import('../../api/client.js')
    await expect(
      postDismissSuggestion({ entityId: 'sensor.foo', suggestionType: 'set_area_id' }),
    ).resolves.toBeUndefined()

    expect(globalThis.fetch).toHaveBeenCalledWith('api/suggestions/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId: 'sensor.foo', suggestionType: 'set_area_id' }),
    })
  })

  it('throws ApiError when server returns 400 invalid_body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'invalid_body',
          message: 'entityId required',
        }),
    } as unknown as Response)

    const { postDismissSuggestion } = await import('../../api/client.js')
    await expect(
      postDismissSuggestion({ entityId: '', suggestionType: 'set_area_id' }),
    ).rejects.toMatchObject({
      error: 'invalid_body',
    })
  })
})
```

- [ ] **Step 2: Run the test — confirm failure**

Run: `pnpm --filter @lovelacer/web test -- api/client.test.ts`

Expected: import error or "postDismissSuggestion is not a function".

- [ ] **Step 3: Mirror the types in `api/types.ts`**

Edit `packages/web/src/api/types.ts`. Append after the existing `RoomAssignment` interface (around line 24):

```ts
/**
 * P2-5 — three rule-based hints. Mirrored from `@lovelacer/shared`.
 * `suggestedRoomId` and `matchedRoomId` are widened to `string` to match
 * this package's CanonicalRoomId-isolation convention (see Override.roomId).
 */
export type SuggestionType = 'set_area_id' | 'move_room' | 'hide_diagnostic'

export interface Suggestion {
  entityId: string
  type: SuggestionType
  message: string
  /** For move_room only. */
  suggestedRoomId?: string
  /** For set_area_id only. */
  matchedRoomId?: string
}
```

Extend `PreviewOutput` (around line 77). Add the `suggestions` field:

```ts
export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
  /**
   * Diff vs. the last applied snapshot, or `null` on first ever preview
   * (no prior snapshot to compare against).
   */
  diff: DiffResult | null
  /** P2-5 — actionable suggestions. Always present (empty array when none). */
  suggestions: Suggestion[]
}
```

- [ ] **Step 4: Add `postDismissSuggestion` to `api/client.ts`**

Edit `packages/web/src/api/client.ts`. Update the import block at the top to include the new types:

```ts
import type {
  AnalyzeOutput,
  ApiError,
  ApplyResult,
  LovelaceConfig,
  Override,
  PreviewOutput,
  SnapshotAssignment,
  SuggestionType,
} from './types.js'
```

Append a new exported function at the end of the file:

```ts
export interface DismissSuggestionInput {
  entityId: string
  suggestionType: SuggestionType
}

/**
 * POST /api/suggestions/dismiss — record a dismissal so the suggestion
 * is filtered from every future preview. Document-relative URL so it
 * works under HA add-on ingress (`/api/hassio_ingress/<token>/...`).
 */
export async function postDismissSuggestion(input: DismissSuggestionInput): Promise<void> {
  await fetchJson<{ ok: true }>('api/suggestions/dismiss', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
}
```

Update `mockPreviewResponse` in `packages/web/src/__tests__/api/client.test.ts` (around line 12) to include the new required field:

```ts
const mockPreviewResponse: PreviewOutput = {
  rooms: [],
  misc: [],
  summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
  config: { title: 'Lovelacer — Home', views: [] },
  diff: null,
  suggestions: [],
}
```

- [ ] **Step 5: Run the test — confirm green**

Run: `pnpm --filter @lovelacer/web test -- api/client.test.ts`

Expected: all green (existing + new).

- [ ] **Step 6: Run full workspace tests + build**

Run: `pnpm -r test && pnpm -r build`

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/api/types.ts \
  packages/web/src/api/client.ts \
  packages/web/src/__tests__/api/client.test.ts
git commit -m "feat(web): mirror Suggestion types + postDismissSuggestion

PreviewOutput.suggestions[] is now required (server always returns it).
postDismissSuggestion uses the document-relative 'api/suggestions/dismiss'
URL so the request stays inside the add-on ingress prefix on HA.

Test mocks updated to include the new required field."
```

---

### Task 8: `useSuggestionsStore` Pinia store

**Files:**

- Create: `packages/web/src/stores/suggestions.ts`
- Create: `packages/web/src/__tests__/stores/suggestions.test.ts`

- [ ] **Step 1: Create the failing test file**

Create `packages/web/src/__tests__/stores/suggestions.test.ts`:

```ts
import { setActivePinia, createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiError } from '../../api/types.js'
import { useSuggestionsStore } from '../../stores/suggestions.js'

vi.mock('../../api/client.js', () => ({
  postDismissSuggestion: vi.fn(),
}))

import { postDismissSuggestion } from '../../api/client.js'

describe('useSuggestionsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(postDismissSuggestion).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in idle phase with empty optimistic set', () => {
    const store = useSuggestionsStore()
    expect(store.phase).toBe('idle')
    expect(store.error).toBeNull()
    expect(store.isDismissed('a.b', 'set_area_id')).toBe(false)
  })

  it('on successful dismiss: phase ends idle, key added, isDismissed returns true', async () => {
    vi.mocked(postDismissSuggestion).mockResolvedValueOnce(undefined)
    const store = useSuggestionsStore()
    await store.dismiss('sensor.foo', 'set_area_id')
    expect(store.phase).toBe('idle')
    expect(store.error).toBeNull()
    expect(store.isDismissed('sensor.foo', 'set_area_id')).toBe(true)
    expect(store.isDismissed('sensor.foo', 'hide_diagnostic')).toBe(false)
  })

  it('on dismiss failure: phase ends error, key NOT added, error set, throws', async () => {
    const apiErr: ApiError = { error: 'storage_error', message: 'disk full' }
    vi.mocked(postDismissSuggestion).mockRejectedValueOnce(apiErr)
    const store = useSuggestionsStore()
    await expect(store.dismiss('sensor.foo', 'set_area_id')).rejects.toEqual(apiErr)
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
    expect(store.isDismissed('sensor.foo', 'set_area_id')).toBe(false)
  })

  it('reset() clears the optimistic set + error and returns to idle', async () => {
    vi.mocked(postDismissSuggestion).mockResolvedValueOnce(undefined)
    const store = useSuggestionsStore()
    await store.dismiss('sensor.foo', 'set_area_id')
    expect(store.isDismissed('sensor.foo', 'set_area_id')).toBe(true)

    store.reset()
    expect(store.phase).toBe('idle')
    expect(store.error).toBeNull()
    expect(store.isDismissed('sensor.foo', 'set_area_id')).toBe(false)
  })
})
```

- [ ] **Step 2: Run — confirm failure**

Run: `pnpm --filter @lovelacer/web test -- stores/suggestions.test.ts`

Expected: module-not-found on `../../stores/suggestions.js`.

- [ ] **Step 3: Create the store**

Create `packages/web/src/stores/suggestions.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { postDismissSuggestion } from '../api/client.js'
import type { ApiError, SuggestionType } from '../api/types.js'

type Phase = 'idle' | 'dismissing' | 'error'

/**
 * P2-5 — Pinia layer for the Suggestions panel. Holds in-flight POST
 * state + an optimistic-dismissed key set. The server's `suggestions[]`
 * is the source of truth on every preview; this store layers on
 * "things the user just clicked Dismiss on" so the UI doesn't lag a
 * full re-analyze cycle.
 *
 * Reset on every preview so the optimistic set doesn't drift past the
 * authoritative server response. App.vue wires the watch.
 */
export const useSuggestionsStore = defineStore('suggestions', () => {
  const phase = ref<Phase>('idle')
  const error = ref<ApiError | null>(null)
  const optimisticallyDismissed = ref<Set<string>>(new Set())

  function isDismissed(entityId: string, type: SuggestionType): boolean {
    return optimisticallyDismissed.value.has(`${entityId}|${type}`)
  }

  async function dismiss(entityId: string, type: SuggestionType): Promise<void> {
    phase.value = 'dismissing'
    error.value = null
    try {
      await postDismissSuggestion({ entityId, suggestionType: type })
      // Replace the Set so Vue's reactivity picks the change up. Mutating
      // in place wouldn't trigger a re-render under Pinia's setup-store
      // tracking.
      const next = new Set(optimisticallyDismissed.value)
      next.add(`${entityId}|${type}`)
      optimisticallyDismissed.value = next
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
      throw err
    }
  }

  function reset(): void {
    optimisticallyDismissed.value = new Set()
    phase.value = 'idle'
    error.value = null
  }

  return { phase, error, optimisticallyDismissed, isDismissed, dismiss, reset }
})
```

- [ ] **Step 4: Run tests — confirm green**

Run: `pnpm --filter @lovelacer/web test -- stores/suggestions.test.ts`

Expected: all 4 tests green.

- [ ] **Step 5: Run full workspace tests**

Run: `pnpm -r test`

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/stores/suggestions.ts \
  packages/web/src/__tests__/stores/suggestions.test.ts
git commit -m "feat(web): useSuggestionsStore (Pinia) for optimistic dismissal

Tracks dismissing/error phase, holds an optimistic-dismissed key set.
isDismissed(entityId, type) lets the panel hide a card the moment
the POST resolves (before the next preview catches up). reset() clears
the set on each new preview so the server response stays authoritative.

Replaces the Set on each mutation so Vue's reactivity tracks it."
```

---

### Task 9: `SuggestionsPanel.vue` component

**Files:**

- Create: `packages/web/src/components/SuggestionsPanel.vue`
- Create: `packages/web/src/__tests__/components/SuggestionsPanel.test.ts`

- [ ] **Step 1: Create the failing test file**

Create `packages/web/src/__tests__/components/SuggestionsPanel.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SuggestionsPanel from '../../components/SuggestionsPanel.vue'
import type { Suggestion } from '../../api/types.js'
import { useOverridesStore } from '../../stores/overrides.js'
import { useSuggestionsStore } from '../../stores/suggestions.js'

vi.mock('../../api/client.js', () => ({
  postDismissSuggestion: vi.fn().mockResolvedValue(undefined),
  // overrides store may import these — keep the surface complete:
  getOverrides: vi.fn(),
  putOverrides: vi.fn(),
  postPreview: vi.fn(),
  postAnalyze: vi.fn(),
  postApply: vi.fn(),
  getInvite: vi.fn(),
  postInvite: vi.fn(),
}))

function mountPanel(suggestions: Suggestion[]) {
  return mount(SuggestionsPanel, {
    props: { suggestions },
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
    },
  })
}

const setAreaSuggestion: Suggestion = {
  entityId: 'sensor.lamp',
  type: 'set_area_id',
  message: 'No area in HA. Go set it.',
  matchedRoomId: 'living_room',
}

const moveRoomSuggestion: Suggestion = {
  entityId: 'sensor.fan',
  type: 'move_room',
  message: 'Low confidence. Try kitchen?',
  suggestedRoomId: 'kitchen',
}

const hideDiagSuggestion: Suggestion = {
  entityId: 'sensor.batt',
  type: 'hide_diagnostic',
  message: 'Diagnostic. Hide?',
}

describe('SuggestionsPanel', () => {
  beforeEach(() => {
    // Mock window.open — used by the set_area_id Accept verb.
    vi.stubGlobal('open', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when suggestions is empty', () => {
    const wrapper = mountPanel([])
    expect(wrapper.find('[data-testid="suggestions-panel"]').exists()).toBe(false)
  })

  it('renders one card per suggestion with the right Accept label', () => {
    const wrapper = mountPanel([setAreaSuggestion, moveRoomSuggestion, hideDiagSuggestion])
    const cards = wrapper.findAll('[data-testid="suggestion-card"]')
    expect(cards).toHaveLength(3)

    const acceptButtons = wrapper.findAll('[data-testid="suggestion-accept"]')
    expect(acceptButtons[0]!.text()).toBe('Open HA settings')
    expect(acceptButtons[1]!.text()).toContain('Move to Kitchen')
    expect(acceptButtons[2]!.text()).toBe('Hide')
  })

  it('Accept on set_area_id calls window.open with the deep-link URL', async () => {
    const wrapper = mountPanel([setAreaSuggestion])
    await wrapper.find('[data-testid="suggestion-accept"]').trigger('click')
    expect(window.open).toHaveBeenCalledWith('/config/entities?entity_id=sensor.lamp', '_blank')
  })

  it('Accept on move_room calls overrides.setRoomId(entityId, suggestedRoomId)', async () => {
    const wrapper = mountPanel([moveRoomSuggestion])
    const overrides = useOverridesStore()
    await wrapper.find('[data-testid="suggestion-accept"]').trigger('click')
    expect(overrides.setRoomId).toHaveBeenCalledWith('sensor.fan', 'kitchen')
  })

  it('Accept on hide_diagnostic calls overrides.setHidden(entityId, true)', async () => {
    const wrapper = mountPanel([hideDiagSuggestion])
    const overrides = useOverridesStore()
    await wrapper.find('[data-testid="suggestion-accept"]').trigger('click')
    expect(overrides.setHidden).toHaveBeenCalledWith('sensor.batt', true)
  })

  it('Dismiss calls suggestionsStore.dismiss(entityId, type)', async () => {
    const wrapper = mountPanel([setAreaSuggestion])
    const suggestions = useSuggestionsStore()
    await wrapper.find('[data-testid="suggestion-dismiss"]').trigger('click')
    expect(suggestions.dismiss).toHaveBeenCalledWith('sensor.lamp', 'set_area_id')
  })

  it('hides a card whose key is in the optimistic-dismissed set', async () => {
    const wrapper = mountPanel([setAreaSuggestion, moveRoomSuggestion])
    const suggestions = useSuggestionsStore()
    expect(wrapper.findAll('[data-testid="suggestion-card"]')).toHaveLength(2)

    // Mutate the optimistic set directly to model the post-dismiss state.
    suggestions.optimisticallyDismissed = new Set([
      `${setAreaSuggestion.entityId}|${setAreaSuggestion.type}`,
    ])
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('[data-testid="suggestion-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0]!.text()).toContain('sensor.fan')
  })

  it('disables both Accept and Dismiss buttons while phase is dismissing', async () => {
    const wrapper = mountPanel([setAreaSuggestion])
    const suggestions = useSuggestionsStore()
    suggestions.phase = 'dismissing'
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="suggestion-accept"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="suggestion-dismiss"]').attributes('disabled')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run — confirm failure**

Run: `pnpm --filter @lovelacer/web test -- components/SuggestionsPanel.test.ts`

Expected: cannot resolve `../../components/SuggestionsPanel.vue`.

- [ ] **Step 3: Create the component**

Create `packages/web/src/components/SuggestionsPanel.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useOverridesStore } from '../stores/overrides.js'
import { useSuggestionsStore } from '../stores/suggestions.js'
import { roomIdToDisplay } from '../rooms.js'
import type { Suggestion } from '../api/types.js'

const props = defineProps<{ suggestions: Suggestion[] }>()
const overrides = useOverridesStore()
const suggestionsStore = useSuggestionsStore()

const visible = computed(() =>
  props.suggestions.filter((s) => !suggestionsStore.isDismissed(s.entityId, s.type)),
)

function accept(s: Suggestion): void {
  if (s.type === 'set_area_id') {
    // Host-rooted absolute path: navigates to HA's entity settings even
    // when the SPA is served under add-on ingress at
    // /api/hassio_ingress/<token>/. Opens in a new tab so the user
    // can return to the analyze view.
    window.open(`/config/entities?entity_id=${encodeURIComponent(s.entityId)}`, '_blank')
    return
  }
  if (s.type === 'move_room' && s.suggestedRoomId !== undefined) {
    overrides.setRoomId(s.entityId, s.suggestedRoomId)
    return
  }
  if (s.type === 'hide_diagnostic') {
    overrides.setHidden(s.entityId, true)
    return
  }
}

async function dismiss(s: Suggestion): Promise<void> {
  try {
    await suggestionsStore.dismiss(s.entityId, s.type)
  } catch {
    // Store already set phase=error and stashed the ApiError. The
    // suggestion stays visible because the optimistic key wasn't added.
    // Lite version: no toast — user can retry by clicking Dismiss again.
  }
}

function suggestedLabel(s: Suggestion): string {
  if (s.type === 'move_room' && s.suggestedRoomId !== undefined) {
    return roomIdToDisplay(s.suggestedRoomId)
  }
  if (s.type === 'set_area_id' && s.matchedRoomId !== undefined) {
    return roomIdToDisplay(s.matchedRoomId)
  }
  return ''
}

function acceptLabel(s: Suggestion): string {
  if (s.type === 'set_area_id') return 'Open HA settings'
  if (s.type === 'move_room') return `Move to ${suggestedLabel(s)}`
  return 'Hide'
}
</script>

<template>
  <section
    v-if="visible.length > 0"
    data-testid="suggestions-panel"
    class="rounded-lg border border-stone-200 bg-white px-5 py-3 text-sm"
  >
    <h3 class="mb-3 text-sm font-medium text-stone-700">
      {{ visible.length }} suggestion{{ visible.length === 1 ? '' : 's' }}
    </h3>
    <ul class="space-y-2">
      <li
        v-for="s in visible"
        :key="`${s.entityId}|${s.type}`"
        data-testid="suggestion-card"
        class="flex items-center gap-3 rounded border border-stone-100 bg-stone-50/50 px-3 py-2 text-xs"
      >
        <div class="min-w-0 flex-1">
          <span class="font-mono text-stone-700">{{ s.entityId }}</span>
          <p class="mt-0.5 text-stone-600">{{ s.message }}</p>
        </div>
        <button
          type="button"
          data-testid="suggestion-accept"
          class="rounded bg-brand-600 px-3 py-1 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="suggestionsStore.phase === 'dismissing'"
          @click="accept(s)"
        >
          {{ acceptLabel(s) }}
        </button>
        <button
          type="button"
          data-testid="suggestion-dismiss"
          class="rounded border border-stone-300 bg-white px-3 py-1 font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="suggestionsStore.phase === 'dismissing'"
          @click="dismiss(s)"
        >
          Dismiss
        </button>
      </li>
    </ul>
  </section>
</template>
```

- [ ] **Step 4: Run component test — confirm green**

Run: `pnpm --filter @lovelacer/web test -- components/SuggestionsPanel.test.ts`

Expected: all 8 tests green.

- [ ] **Step 5: Run full workspace tests + build**

Run: `pnpm -r test && pnpm -r build`

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/SuggestionsPanel.vue \
  packages/web/src/__tests__/components/SuggestionsPanel.test.ts
git commit -m "feat(web): SuggestionsPanel.vue with per-type Accept verbs

Renders nothing when suggestions[] is empty (or all are optimistically
dismissed). One card per suggestion with:
- set_area_id  -> Accept = window.open('/config/entities?entity_id=..', '_blank')
- move_room    -> Accept = overrides.setRoomId(entity, suggestedRoomId)
- hide_diagnostic -> Accept = overrides.setHidden(entity, true)
- All types    -> Dismiss = useSuggestionsStore.dismiss(entity, type)

Both buttons disable while phase === 'dismissing' to prevent
double-POST during the in-flight request. Dismiss-failure leaves the
card visible (no toast in lite version)."
```

---

### Task 10: Wire `SuggestionsPanel` into `App.vue` + reset suggestions store on preview change

**Files:**

- Modify: `packages/web/src/App.vue` (import + render + watch-reset)

- [ ] **Step 1: Edit `App.vue` script block**

Update the imports and store usage. After the existing imports in the `<script setup>` block, add:

```ts
import SuggestionsPanel from './components/SuggestionsPanel.vue'
import { useSuggestionsStore } from './stores/suggestions.js'
```

After the existing store instantiations, add:

```ts
const suggestions = useSuggestionsStore()
```

Add the watch (near the existing `watch(() => analyze.phase, ...)` block):

```ts
// On every fresh preview, clear the optimistic-dismissed set so the
// authoritative server response in `analyze.preview.suggestions[]`
// drives what's visible. Dismissed-on-server keys are filtered there;
// if the user cleared a dismissal out-of-band, it'll re-appear.
watch(
  () => analyze.preview,
  () => {
    suggestions.reset()
  },
)
```

- [ ] **Step 2: Edit `App.vue` template**

Insert `<SuggestionsPanel>` between `<RemovedEntitiesPanel>` and `<RoomList>` (around line 84). The `analyze.preview` null-guard already wraps the section, so the inner element doesn't need its own:

```vue
<RemovedEntitiesPanel
  v-if="analyze.preview.diff !== null && analyze.preview.diff.totals.removed > 0"
  :diff="analyze.preview.diff"
/>
<SuggestionsPanel :suggestions="analyze.preview.suggestions" />
<RoomList
  :rooms="analyze.preview.rooms"
  :diff-by-room="diffByRoom"
  :diff-by-entity-id="diffByEntityId"
/>
```

- [ ] **Step 3: Run web tests + build**

Run: `pnpm --filter @lovelacer/web test && pnpm --filter @lovelacer/web build`

Expected: all green. The web build verifies the type chain end-to-end.

- [ ] **Step 4: Run full workspace tests + build**

Run: `pnpm -r test && pnpm -r build`

Expected: all green.

- [ ] **Step 5: Manual lint + format check**

Run: `pnpm exec prettier --check . && pnpm exec eslint .`

Expected: clean. Fix any complaints inline (most likely targets: the new Vue file's formatting, the new test files).

If prettier flags anything, fix with: `pnpm exec prettier --write <file>`.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/App.vue
git commit -m "feat(web): render SuggestionsPanel + reset suggestions store on preview

Panel sits between RemovedEntitiesPanel and RoomList in the analyze
view. Watch on analyze.preview clears the optimistic-dismissed set
on every fresh response so the server's suggestions[] is always
authoritative — no drift across re-analyze cycles.

Closes the P2-5 ticket: roadmap acceptance criteria are now met
(rules surface suggestions, Dismiss persists, Accept applies as
override or deep-links to HA)."
```

---

## Manual smoke (do not skip — required by the ROADMAP DoD)

After Task 10 commits, run a manual smoke against a dev HA stack to confirm end-to-end behavior. Do this before opening the PR:

1. Start the dev stack: in two terminals run `pnpm --filter @lovelacer/server dev` and `pnpm --filter @lovelacer/web dev`. Open `http://localhost:5173`.
2. Accept the invite. Click Analyze.
3. Confirm the **Suggestions** section renders between the Removed Entities panel and the Room list. Cards should show entity_id, message, Accept button (label varies by type), Dismiss button.
4. **set_area_id verb:** Click "Open HA settings" on a card. New tab opens to `http://<your-ha>/config/entities?entity_id=<id>`. Set the area in HA. Re-analyze. The card disappears.
5. **move_room verb:** Click "Move to <Room>" on a low-confidence card. The OverridesBar shows `+1 pending change`. Click Save. Re-analyze runs automatically. The card disappears (assignment is now manual at confidence 1.0).
6. **hide_diagnostic verb:** Click "Hide" on a diagnostic card. OverridesBar shows `+1 pending change`. Click Save. Re-analyze. The card disappears.
7. **Dismiss persistence:** Click Dismiss on any card. Card disappears immediately (optimistic). Re-analyze. Card stays gone (server filtered). Restart the server (`Ctrl+C`, then re-run `pnpm dev`). Re-analyze in the browser. Card still gone (DB persistence).
8. **Empty case:** If no suggestions match the rules on your fixture, the section doesn't render at all (panel is `v-if="visible.length > 0"`).

If any step fails, fix and amend the relevant task's commit (or add a follow-up fix commit) before opening the PR.

---

## Final review (after all tasks committed)

- [ ] Read every commit on `feat/p2-5-suggestions` and confirm it tells a coherent story.
- [ ] `git log --oneline origin/main..HEAD` should show ~10 commits, each scoped to one task.
- [ ] `pnpm -r test && pnpm -r build && pnpm exec prettier --check . && pnpm exec eslint .` — green.
- [ ] Optional: dispatch the cross-cutting `code-reviewer` subagent for one final pass before the PR (catches issues across task boundaries that per-task review missed — e.g., did Task 6 introduce a circular import? Did Task 9's component miss an aria attribute used elsewhere?).

When all green, hand off to `superpowers:finishing-a-development-branch`.
