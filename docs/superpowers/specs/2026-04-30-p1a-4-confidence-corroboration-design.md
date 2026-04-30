# P1a-4 Confidence Scoring with Corroboration — Design

**Status:** Draft v1 · **Date:** 2026-04-30 · **Ticket:** [P1a-4 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Add the corroboration boost to the detection chain's `confidence` calculation. When multiple priority signals fire pointing to the same winning room, raise the assignment's confidence above the base (max-weight) value.

## Non-goals

- Re-architecting the detection chain. P1a-3 shipped the structure; this ticket is a 3-line tweak inside `assemble()`.
- Changing the public `RoomAssignment` or `DetectionSignal` shape — both stay as-is.
- Confidence buckets (UI display thresholds). Already in [`packages/shared/src/constants.ts`](../../../packages/shared/src/constants.ts) as `CONFIDENCE_BUCKETS`.
- Any UI work. P2-1 / P2-5 surface confidence to the user.
- Re-running the chain or invalidating existing fixtures.

## Approach summary

The boost is computed inside `assemble()` in `packages/analyzer/src/detect.ts`, where the internal `FiredSignal[]` array still carries the `target` field. After the winner is picked, count the fired signals that share the winner's `target`; that count is `corroborationCount`. Apply the formula:

```
boost = min(0.1, (corroborationCount - 1) * 0.05)
confidence = min(1.0, winner.weight + boost)
```

So 1 signal → boost 0; 2 corroborators → +0.05; 3+ → +0.10 (capped). Final confidence capped at 1.0.

**Corroboration is target-specific.** Signals that fire pointing to _different_ rooms than the winner do not boost. This matches the HEURISTICS.md prose ("When multiple sources point to the same room") and was already pinned in the P1a-3 spec.

## Architecture

No new files. The change is local to `assemble()`. Public surface (the exported `detect`, `detectEntity`, `buildDetectionContext`, and the types) is unchanged.

## Behavior

### Formula

```ts
const corroborationCount = fired.filter((s) => s.target === winner.target).length
const boost = Math.min(0.1, (corroborationCount - 1) * 0.05)
const confidence = Math.min(1.0, winner.weight + boost)
```

### Worked examples

| Fired signals (source / target / weight)                                     | Winner        | Corroborators | Boost | Confidence   |
| ---------------------------------------------------------------------------- | ------------- | ------------- | ----- | ------------ |
| friendly_name → kitchen / 0.6                                                | friendly_name | 1             | 0     | 0.6          |
| friendly_name → kitchen / 0.6, entity_id → kitchen / 0.5                     | friendly_name | 2             | 0.05  | 0.65         |
| entity_area → lr / 1.0, device_area → lr / 0.85                              | entity_area   | 2             | 0.05  | 1.0 (capped) |
| entity_area → lr / 1.0, friendly_name → kitchen / 0.6                        | entity_area   | 1             | 0     | 1.0          |
| entity_area → lr / 1.0, friendly_name → lr / 0.6, entity_id → lr / 0.5       | entity_area   | 3             | 0.10  | 1.0 (capped) |
| friendly_name → lr / 0.6, entity_id → lr / 0.5, device_name → kitchen / 0.45 | friendly_name | 2             | 0.05  | 0.65         |

### Cap semantics

- The boost itself is capped at 0.10 (i.e., 3+ corroborators all give the same boost as 3 corroborators).
- The final `confidence` is capped at 1.0.

## File-by-file

| File                                             | Action | Notes                                                                                                   |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------- |
| `packages/analyzer/src/detect.ts`                | Modify | ~3 new lines inside `assemble()`                                                                        |
| `packages/analyzer/src/__tests__/detect.test.ts` | Modify | New `describe('detectEntity — corroboration boost')` block                                              |
| `docs/HEURISTICS.md`                             | Modify | Fix the broken `corroboratedConfidence` sample function so it matches the prose's "same room" semantics |

## Testing

Add to `packages/analyzer/src/__tests__/detect.test.ts` a new `describe` block at the bottom:

- **1 signal → no boost.** Use a single `friendly_name` match. Assert `confidence === 0.6`.
- **2 corroborators (same target) → +0.05.** Construct an entity where `friendly_name` (0.6) and `entity_id` (0.5) both match `kitchen`. Assert `confidence === 0.65`.
- **3 corroborators (same target) → +0.10, capped at 1.0.** Use the existing "all priorities fire pointing to same room" pattern (entity_area → lr 1.0 + friendly_name → lr 0.6 + entity_id → lr 0.5). Assert `confidence === 1.0` (capped, not 1.10).
- **4+ corroborators stay at +0.10.** Add device_name to the 3-corroborator setup. Assert `confidence === 1.0`. (Boost cap, regardless that the cumulative would otherwise be +0.15.)
- **Different-target signals don't boost.** Entity has `area → living_room` (1.0) AND `friendly_name → 'Kitchen Light'` (0.6). Winner is living_room (1.0). Corroborators for living_room = 1 → no boost → confidence 1.0. (The kitchen signal still appears in `signals[]`.)
- **Mixed corroboration: only same-target signals count.** 3-signal scenario where 2 fire to living_room (1.0 + 0.6) and 1 to kitchen (0.5). Living room wins; corroborator count = 2; boost +0.05; final confidence = 1.0 (capped). Asserts that the kitchen signal does NOT contribute to corroboration.

### Existing-test impact

Reviewed: every existing test that asserts `confidence` either has 1 signal (no boost) or 3+ same-target signals at base 1.0 (capped regardless). No existing tests break. Fixture-driven tests don't assert specific confidence values, only misc-bucket size and area-canonical match counts — unaffected.

## Documentation cleanup — `docs/HEURISTICS.md`

The current sample function:

```ts
function corroboratedConfidence(signals: Signal[]): number {
  const base = Math.max(...signals.map((s) => s.weight))
  const corroborationCount = signals.filter((s) => s.weight > 0).length
  const boost = Math.min(0.1, (corroborationCount - 1) * 0.05)
  return Math.min(1.0, base + boost)
}
```

is inconsistent with the prose two paragraphs above ("When multiple sources point to the same room"). The sample counts all fired signals; the prose says only same-room signals corroborate. The implementation follows the prose.

The fix replaces the sample with a note pointing to the actual implementation:

> The implementation in `packages/analyzer/src/detect.ts`'s `assemble()` counts fired signals that share the winning room's target, applies `boost = min(0.1, (corroborationCount - 1) * 0.05)`, and caps the final confidence at 1.0. The public `Signal` type doesn't expose `target` because corroboration is computed inside the assembler where the internal `FiredSignal.target` is still available.

## Open questions resolved during brainstorming

- **Strict (target-specific) corroboration vs loose (count all signals).** Strict — matches HEURISTICS prose and the P1a-3 spec.
- **Where the boost is computed.** Inside `assemble()`, so `FiredSignal.target` is in scope.
- **Public API changes.** None. `RoomAssignment.confidence` is just numerically different in some cases; no shape change.
- **HEURISTICS.md inconsistency.** Fixed by replacing the sample function with a pointer to the actual implementation (the public `Signal` shape can't reproduce the actual logic since it doesn't carry `target`).

## Risks

- **Existing tests have specific confidence values that turn out to subtly assume "no boost" semantics.** Reviewed and confirmed none do.
- **Numerical precision.** All values are multiples of 0.05; floating-point arithmetic on these is exact in IEEE 754 binary representation for the cases we generate. No rounding issues expected.

## Acceptance

P1a-4 closes when:

- [ ] `assemble()` applies the corroboration boost per the formula.
- [ ] All new corroboration tests pass.
- [ ] All existing detect.test.ts tests still pass without modification.
- [ ] All fixture-driven tests still pass.
- [ ] `docs/HEURISTICS.md`'s `corroboratedConfidence` sample is replaced with a pointer to the implementation.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm lint` clean.
