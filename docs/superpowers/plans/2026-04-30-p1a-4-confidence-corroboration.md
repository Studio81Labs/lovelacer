# P1a-4 Confidence Scoring with Corroboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the corroboration boost to `assemble()` in `detect.ts` so when multiple priority signals fire pointing to the same winning room, `confidence` rises above the base (max-weight) value.

**Architecture:** Three-line change inside `assemble()`. Public surface (`detect`, `detectEntity`, `RoomAssignment`, `DetectionSignal`) is unchanged. Corroboration is target-specific — only signals pointing to the winning room boost the confidence.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`), Vitest. No new dependencies.

**Spec reference:** [`docs/superpowers/specs/2026-04-30-p1a-4-confidence-corroboration-design.md`](../specs/2026-04-30-p1a-4-confidence-corroboration-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions.
- Type-only imports use `import type { … }`.
- Tests use `import { describe, it, expect } from 'vitest'`.
- Each task ends with one or more commits + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.

---

## Task 1: Corroboration boost in `assemble()` + tests

**Files:**
- Modify: `packages/analyzer/src/detect.ts`
- Modify: `packages/analyzer/src/__tests__/detect.test.ts`

This is the entire implementation work. Two commits within this task: first the boost + tests (TDD), then a follow-up commit cleaning up `docs/HEURISTICS.md` so the doc matches the implementation.

- [ ] **Step 1: Write the failing tests**

Append a new `describe` block at the bottom of `packages/analyzer/src/__tests__/detect.test.ts`:

```ts
describe('detectEntity — corroboration boost', () => {
  const livingRoomAreaForBoost: HaAreaRegistryEntry = {
    area_id: 'living_room',
    name: 'Living Room',
    floor_id: null,
    icon: null,
  }
  const ctxLR = buildDetectionContext([livingRoomAreaForBoost])
  const ctxNoAreas = buildDetectionContext([])

  it('1 signal → no boost (confidence equals base weight)', () => {
    const result = detectEntity({ ...baseEntity, friendlyName: 'Kitchen Light' }, ctxNoAreas)
    expect(result.confidence).toBe(0.6)
  })

  it('2 corroborators (same target) → +0.05', () => {
    // friendly_name (0.6) → kitchen, entity_id (0.5) → kitchen.
    // Both point to kitchen. Corroboration count = 2 → boost 0.05 → confidence 0.65.
    const result = detectEntity(
      { ...baseEntity, friendlyName: 'Kitchen Light', objectId: 'kitchen_light' },
      ctxNoAreas,
    )
    expect(result.roomId).toBe('kitchen')
    expect(result.confidence).toBeCloseTo(0.65, 5)
  })

  it('3 corroborators (same target) → +0.10, capped at 1.0', () => {
    // entity_area (1.0) + friendly_name (0.6) + entity_id (0.5), all → living_room.
    // Boost would be 0.10 → 1.0 + 0.10 = 1.10 → capped to 1.0.
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Living Room Light',
        objectId: 'living_room_light',
      },
      ctxLR,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0)
    expect(result.signals.length).toBe(3)
  })

  it('4 corroborators stay at +0.10 (boost cap holds)', () => {
    // entity_area + friendly_name + entity_id + device_name, all → living_room.
    // Boost would naively be (4-1)*0.05 = 0.15 → capped to 0.10.
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Living Room Light',
        objectId: 'living_room_light',
        device: {
          id: 'dev1',
          name: 'Living Room Hub',
          nameByUser: null,
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctxLR,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0) // 1.0 + 0.10 = 1.10, capped at 1.0
    expect(result.signals.length).toBe(4)
  })

  it('different-target signals do NOT boost the winner', () => {
    // entity_area → living_room (1.0); friendly_name → kitchen (0.6).
    // Winner = living_room. Corroborators for living_room = 1. Boost = 0.
    // Confidence = 1.0 (already at base).
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Kitchen Light',
      },
      ctxLR,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0)
    expect(result.signals.length).toBe(2)
  })

  it('mixed corroboration: only same-target signals boost', () => {
    // entity_area → living_room (1.0); friendly_name → living_room (0.6); entity_id → kitchen (0.5).
    // Winner = living_room. Corroborators for living_room = 2 (entity_area + friendly_name).
    // The kitchen signal does NOT contribute. Boost = 0.05. Confidence = 1.0 + 0.05 = 1.0 (capped).
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Living Room Light',
        objectId: 'kitchen_thermostat',
      },
      ctxLR,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0)
    // All three signals appear in signals[] regardless of which corroborated.
    expect(result.signals.length).toBe(3)
  })

  it('corroboration boost makes a non-1.0 confidence visible', () => {
    // 2 weak signals at the same target. friendly_name (0.6) + entity_id (0.5), both → bedroom.
    // Boost +0.05. Confidence = 0.6 + 0.05 = 0.65.
    const result = detectEntity(
      { ...baseEntity, friendlyName: 'Bedroom Sensor', objectId: 'bedroom_sensor' },
      ctxNoAreas,
    )
    expect(result.roomId).toBe('bedroom')
    expect(result.confidence).toBeCloseTo(0.65, 5)
  })
})
```

(Uses the existing module-scope `baseEntity` constant from Task 3 of P1a-3. The `livingRoomAreaForBoost` and `ctx*` constants are local to this describe block to avoid shadowing.)

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.test.ts
```

Expected: most new tests FAIL — current `assemble()` returns `winner.weight` directly, so:
- "2 corroborators → +0.05" expects 0.65, gets 0.6.
- "different-target signals do NOT boost" still passes (already 1.0).
- "mixed corroboration" expects 1.0 (already capped) — passes.
- "1 signal" expects 0.6 — passes.
- "3 corroborators → capped at 1.0" expects 1.0 — passes.
- "4 corroborators capped" expects 1.0 — passes.
- "non-1.0 confidence visible" expects 0.65, gets 0.6.

So 2 of 7 fail (the ones whose expected confidence is non-base). That's the red signal we need.

- [ ] **Step 3: Apply the boost in `assemble()`**

Edit `packages/analyzer/src/detect.ts`. Find the `assemble` function (currently below `detectEntity`). Replace its body with:

```ts
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
  return {
    entityId,
    roomId: winner.target,
    confidence,
    signals,
  }
}
```

The only behavioral change is the three lines after the `// Corroboration boost` comment plus the `confidence` field uses the new value. Everything else stays.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/detect.test.ts
```

Expected: PASS — 24 from P1a-3 + 7 new = 31 tests in detect.test.ts.

- [ ] **Step 5: Verify the broader build (no regressions in fixture tests)**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green. The english-cluttered and czech-tidy fixture tests don't assert specific confidence values, so they're unaffected.

- [ ] **Step 6: Commit the implementation**

```bash
git -C <worktree> add packages/analyzer/src/detect.ts packages/analyzer/src/__tests__/detect.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(analyzer): corroboration boost on RoomAssignment confidence

When multiple fired signals point to the winning room, raise confidence
by 0.05 per additional corroborator (capped at +0.10). Final confidence
capped at 1.0. Different-target signals don't corroborate.

Boost is computed inside assemble() where FiredSignal.target is still
in scope; the public Signal type stays unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Fix HEURISTICS.md to match the implementation**

Read `docs/HEURISTICS.md` first. Find the `### Boost for corroboration` section (around line 187 in the current main). It currently has:

```typescript
function corroboratedConfidence(signals: Signal[]): number {
  const base = Math.max(...signals.map((s) => s.weight))
  const corroborationCount = signals.filter((s) => s.weight > 0).length
  const boost = Math.min(0.1, (corroborationCount - 1) * 0.05)
  return Math.min(1.0, base + boost)
}
```

This is broken — it counts all signals regardless of target, contradicting the prose two paragraphs above ("When multiple sources point to the same room"). Replace the code block with a prose description that matches the implementation:

````markdown
### Boost for corroboration

When multiple sources point to the same room, the assignment's confidence rises above the base (max-weight) value:

- `corroborationCount` = number of fired signals targeting the winning room.
- `boost = min(0.1, (corroborationCount - 1) * 0.05)` — +0.05 per additional corroborator, capped at +0.10.
- `confidence = min(1.0, winnerWeight + boost)` — capped at 1.0.

So an entity with `area_id = kitchen` AND name `Kitchen Light` has 2 corroborating signals → boost 0.05 → confidence `1.0 + 0.05 = 1.0` (capped). An entity with only a name match has 1 signal → no boost → confidence 0.6. An entity with name `Kitchen Light` AND device name `Kitchen Hub` (also matching kitchen) → 2 corroborating signals → 0.6 + 0.05 = 0.65.

Corroboration is target-specific. Signals firing toward different rooms don't boost each other — they compete for `roomId` instead. The implementation is in `packages/analyzer/src/detect.ts`'s `assemble()`, which has access to the internal `FiredSignal.target` field that the public `Signal` shape doesn't carry.
````

(Match the heading level and surrounding markdown style of the existing doc.)

- [ ] **Step 8: Commit the doc cleanup**

```bash
git -C <worktree> add docs/HEURISTICS.md
git -C <worktree> commit -m "$(cat <<'EOF'
docs(heuristics): replace broken corroboratedConfidence sample

The sample function counted all fired signals regardless of target,
contradicting the prose ("multiple sources point to the same room").
The actual implementation in detect.ts's assemble() counts only
signals targeting the winning room. Replaces the misleading code with
a prose description that matches the implementation, and notes the
public Signal type doesn't carry target.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Final verification**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
pnpm --dir <worktree> format:check
pnpm --dir <worktree> lint
```

All green.

---

## P1a-4 Acceptance Confirmation

- [ ] `assemble()` applies the corroboration boost (Task 1 / Step 3).
- [ ] All new corroboration tests pass (Task 1 / Step 4).
- [ ] All existing detect.test.ts tests still pass without modification.
- [ ] All fixture-driven tests still pass.
- [ ] `docs/HEURISTICS.md`'s broken sample function replaced with prose matching the implementation (Task 1 / Step 7).
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm lint` clean.
