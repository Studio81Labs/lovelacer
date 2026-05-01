# P1b-1 German Keyword Pack + `german-massive` Fixture — Design

**Status:** Draft v1 · **Date:** 2026-05-01 · **Ticket:** [P1b-1 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Add German (`de`) language support to the room keyword database and ship a `german-massive` test fixture that exercises the new patterns under realistic, multi-floor conditions. Closes the first Phase 1b ticket and validates the language-pack extension story for future locales.

## Non-goals

- New canonical room types. The 14 existing canonical rooms cover P1b; non-canonical German concepts (`Hobbyraum`, `Speisekammer`) intentionally fall back to misc or to the closest canonical match.
- Floor-aware detection logic. `german-massive` declares floors but P1b-1 doesn't change `findRoom` to use them — that lands in a future ticket if needed. The fixture's floor metadata is structural (registry shape) only.
- New analyzer logic. `detect`, `findRoom`, `normalize`, and `groupByDomain` work as-is; this ticket is data + fixture + tests.
- Other Phase 1b features (overrides, additional domains, override UI). P1b-2 onward.
- A second German fixture (`german-tidy` or similar). One fixture is enough to exercise the keyword pack.

## Approach summary

Append 14 German rows to `packages/shared/src/room-keywords.ts` — one per canonical room, following the same `RoomKeyword` shape used by EN + CS. The pre-normalization storage convention (lowercase, no diacritics, single-space, only `[a-z0-9 ]`) applies; the existing schema test (`__tests__/room-keywords.test.ts`) catches typos at CI time.

Ship `tests/fixtures/german-massive.ts` — a multi-floor (Erdgeschoss + Obergeschoss + Keller) German home with ~130 entities across 13 areas. Mostly German area names with diacritics (`Küche`, `Wohnzimmer`, `Bad EG`, `Bad OG`, `Gästezimmer`, `Waschküche`), a couple of EN-named entities to verify that the area_id signal still beats the friendly_name signal. Includes 1-2 non-canonical areas (`Hobbyraum`, `Terrasse`) to test misc-bucket fallback and partial-match behavior.

Extend the existing `detect.fixtures.test.ts` and `grouping.fixtures.test.ts` to run `german-massive` through the same pipe as `english-cluttered` and `czech-tidy`. Lock the per-entity room assignments and per-room domain grouping via inline snapshots. Anti-regression: ≥85% of visible entities get a non-misc assignment.

## Architecture

```
packages/shared/src/
  room-keywords.ts                       # MODIFY: append 14 DE rows
  __tests__/
    room-keywords.test.ts                # already enforces storage convention; no changes

tests/fixtures/
  german-massive.ts                      # NEW: ~130 entities across 13 areas, 2 floors + Keller
  __tests__/
    german-massive.test.ts               # NEW: structural assertions

packages/analyzer/src/__tests__/
  detect.fixtures.test.ts                # MODIFY: add german-massive fixture pipe + snapshot
  grouping.fixtures.test.ts              # MODIFY: add german-massive grouping snapshot
```

No type changes — `LanguageCode` already declares `'de'`.

## Components

### 1. German keyword rows (`packages/shared/src/room-keywords.ts`)

Append after the existing CS rows. Storage convention: lowercase, no diacritics (`Küche` → `kuche`), single-space-separated, only `[a-z0-9 ]`. The matcher normalizes its input the same way before substring-matching.

```ts
// ── kitchen ──────
{ canonical: 'kitchen', language: 'de', patterns: ['kuche', 'kochnische'] },

// ── living_room ──────
{ canonical: 'living_room', language: 'de', patterns: ['wohnzimmer', 'wohnraum', 'wohnbereich'] },

// ── bedroom ──────
// `excludes: ['bad']` mirrors the CS pattern's `excludes: ['koupelna']`.
// Prevents bedroom from over-matching when bathroom-related substrings
// appear in the same name (e.g. "Schlafzimmer mit Bad").
{
  canonical: 'bedroom',
  language: 'de',
  patterns: ['schlafzimmer', 'schlafraum'],
  excludes: ['bad'],
},

// ── bathroom ──────
{ canonical: 'bathroom', language: 'de', patterns: ['bad', 'badezimmer', 'dusche', 'waschraum'] },

// ── office ──────
{ canonical: 'office', language: 'de', patterns: ['buro', 'arbeitszimmer', 'arbeitsraum'] },

// ── hallway ──────
// `Diele` is regional (Northern Germany alternative to `Flur`).
{ canonical: 'hallway', language: 'de', patterns: ['flur', 'diele', 'eingang', 'eingangsbereich'] },

// ── garage ──────
{ canonical: 'garage', language: 'de', patterns: ['garage'] },

// ── garden ──────
{ canonical: 'garden', language: 'de', patterns: ['garten', 'aussen', 'terrasse', 'balkon'] },

// ── dining_room ──────
{ canonical: 'dining_room', language: 'de', patterns: ['esszimmer', 'essbereich', 'speisezimmer'] },

// ── laundry ──────
// `waschraum` overlaps with bathroom.patterns intentionally — German
// regional usage is genuinely ambiguous. Corroboration boost from sibling
// entities (`waschmaschine` vs `waschbecken`) breaks the tie.
{
  canonical: 'laundry',
  language: 'de',
  patterns: ['waschkuche', 'hauswirtschaftsraum', 'waschraum'],
},

// ── basement ──────
{ canonical: 'basement', language: 'de', patterns: ['keller', 'untergeschoss'] },

// ── attic ──────
// `'speicher'` alone would match memory/storage senses; we use the
// explicit compound `'speicherraum'`.
{ canonical: 'attic', language: 'de', patterns: ['dachboden', 'speicherraum', 'dachgeschoss'] },

// ── kids_room ──────
{ canonical: 'kids_room', language: 'de', patterns: ['kinderzimmer', 'kinder'] },

// ── guest_room ──────
{ canonical: 'guest_room', language: 'de', patterns: ['gastezimmer', 'gastzimmer'] },
```

### 2. `german-massive` fixture

Multi-floor single-family German home. ~130 entities, 13 areas across 3 floor groupings.

**Floor / area layout:**

| Floor | Areas | Notes |
| --- | --- | --- |
| Erdgeschoss (EG) | Küche, Wohnzimmer, Esszimmer, Bad EG, Flur, Garage | Living areas |
| Obergeschoss (OG) | Schlafzimmer, Kinderzimmer, Bad OG, Gästezimmer | Bedrooms |
| Keller | Keller, Waschküche, Hobbyraum | Cellar utilities |
| (no floor) | (Garten, Terrasse exist as friendlyName-only entities, no `area_id`) | Outdoor — tests friendly_name-only signal |

`Hobbyraum` is non-canonical — entities there fall through to misc. `Terrasse` is non-canonical but matches `garden.patterns` via the `'terrasse'` substring, so those entities route to garden.

**Per-room entity mix (rough counts):**

| Area | Entity count | Examples |
| --- | --- | --- |
| Küche | 10 | 3× lights, oven, dishwasher, fridge, motion sensor, temp, humidity |
| Wohnzimmer | 10 | ceiling-light, floor-lamp, TV (media_player → P1b-2), thermostat, motion, temp, humidity, presence |
| Esszimmer | 5 | 2× dining-lights, motion, temp |
| Bad EG | 6 | bath-light, exhaust-fan (switch), motion, humidity, towel-warmer |
| Bad OG | 5 | mirror-light, ventilation, motion, humidity |
| Schlafzimmer | 9 | 2× bed-lights, ceiling-light, presence, thermostat, temp, humidity, blinds (cover → P1b-2) |
| Kinderzimmer | 6 | kid-light, night-light, motion, temp, humidity |
| Gästezimmer | 4 | guest-light, motion, temp |
| Flur | 6 | 2× corridor-lights, 2× motion, presence |
| Garage | 5 | garage-door (cover), garage-light, motion, temp |
| Keller | 6 | 2× cellar-lights, motion, humidity, leak-sensor |
| Waschküche | 7 | washer (switch), dryer (switch), light, motion, humidity, leak-sensor |
| Hobbyraum | 3 | hobby-light, motion (intentionally sparse — misc test) |
| Garten + Terrasse (no area) | 7 | 3× outdoor-lights, weather, presence, gate-sensor |
| Floating | 10 | diagnostic + hidden + disabled mix, no area |

Total: ~130 entities.

**Specific stresses the fixture exercises:**

- **Diacritic normalization.** Areas: `Küche`, `Bad EG`, `Bad OG`, `Gästezimmer`, `Waschküche`. The matcher normalizes `Küche` → `kuche` before substring-matching against `'kuche'`.
- **Two `Bad` areas (EG/OG).** Both correctly route to bathroom. The `Bad EG` / `Bad OG` suffix shouldn't confuse the substring matcher (which is checking for `'bad'` and `'badezimmer'`).
- **`bedroom.excludes: ['bad']` exercise.** Hard to construct without a contrived "Schlafzimmer Bad" name, but the rule is in place for users with combined master-bath layouts.
- **`waschraum` overlap.** No fixture entity in `Bad EG` / `Bad OG` named "Waschraum" — the overlap is documented but not actively tested in this fixture. If a user has a true `Waschraum` area, corroboration handles it.
- **Mixed-language entity names.** A couple of devices get EN-named friendlyNames (e.g., `Outdoor Light Garten`) to verify area_id signal beats friendly_name signal.
- **Domains outside P1a scope.** TV (`media_player`), garage-door (`cover`), blinds (`cover`) → land in misc / "Other" view in P1a; P1b-2 maps them to proper card types.
- **Hidden + disabled.** ~5 hidden + 5 disabled entities to verify they're excluded from groupByDomain output (matching existing fixture behavior).

## Data flow

No data-flow changes. The existing pipeline:

```
HA registries → normalize → findRoom (now includes DE patterns) → detect → groupByDomain
```

`findRoom` reads `ROOM_KEYWORDS` once per call and substring-matches each pattern. New DE rows fold in transparently. The detection priority chain (entity_area > device_area > friendly_name > entity_id > device_name) is unaffected.

## Error handling

| Layer | Failure | Behavior |
| --- | --- | --- |
| `room-keywords.ts` schema | A new pattern violates the storage convention (uppercase, diacritic, etc.) | Existing schema test in `__tests__/room-keywords.test.ts` fails at CI time before merge. |
| `findRoom` | Pattern matches nothing in entity text | Returns `null` for that entity (existing behavior) — falls through to next priority. |
| Fixture | `german-massive.ts` references an area_id that's missing | The fixture's structural test `german-massive.test.ts` catches the inconsistency at CI time. |
| Fixture | An entity's `device_id` doesn't resolve | Same — caught by structural test. |

No runtime error paths change.

## Testing

### `tests/fixtures/__tests__/german-massive.test.ts` — structural (~10 tests)

Mirrors `english-cluttered.test.ts` and `czech-tidy.test.ts`:

- Total entity count is `>= 120 && <= 140`.
- Every entity has a non-empty `entity_id`.
- Every entity has a non-empty `name` or `original_name`.
- All declared areas appear in the area registry: `Küche`, `Wohnzimmer`, `Esszimmer`, `Bad EG`, `Bad OG`, `Schlafzimmer`, `Kinderzimmer`, `Gästezimmer`, `Flur`, `Garage`, `Keller`, `Waschküche`, `Hobbyraum`.
- Area `area_id`s are unique.
- ≥5 entities have `hidden_by !== null`.
- ≥5 entities have `disabled_by !== null`.
- Every entity's `device_id` resolves to an entry in the device registry.
- Floor mapping: each area resolves to one of the three declared floors (or none, for Garten/Terrasse).

### `packages/analyzer/src/__tests__/detect.fixtures.test.ts` — extend (~3 tests added)

- `german-massive` runs through the same pipe (`fixtureToHaRegistries → normalize → detect`).
- Inline snapshot of the per-entity room assignment summary (e.g., `[{ entityId, roomId }]` for non-misc only).
- Acceptance assertion: `> 85%` of visible (non-hidden, non-disabled) entities get a non-misc `roomId`.

### `packages/analyzer/src/__tests__/grouping.fixtures.test.ts` — extend (~2 tests added)

- `german-massive` runs through `groupByDomain`.
- Inline snapshot of the per-room domain split (lights/climate/activity/environment/other counts).

### `packages/shared/src/__tests__/room-keywords.test.ts` — no changes

The existing schema test enforces:
- All patterns lowercase, no diacritics, only `[a-z0-9 ]`.
- All `excludes` patterns same.
- Every `canonical` field is a valid `CanonicalRoomId`.
- Every `language` field is a valid `LanguageCode`.

A typo in the new DE rows surfaces immediately.

**Total: ~14 new keyword rows + 1 new fixture file + 1 new fixture-structure test file (~10 tests) + 5 new fixture-pipe assertions across detect/grouping. Single PR.**

## File-by-file

| File | Action | Notes |
| --- | --- | --- |
| `packages/shared/src/room-keywords.ts` | Modify | Append 14 DE rows |
| `tests/fixtures/german-massive.ts` | Create | ~130 entities, 13 areas, 2 floors + Keller |
| `tests/fixtures/__tests__/german-massive.test.ts` | Create | Structural assertions |
| `packages/analyzer/src/__tests__/detect.fixtures.test.ts` | Modify | Add german-massive pipe + snapshot |
| `packages/analyzer/src/__tests__/grouping.fixtures.test.ts` | Modify | Add german-massive grouping snapshot |

## Open questions resolved during brainstorming

- **Fixture character (Q1):** A. `german-massive`. Multi-floor, ~130 entities, 9-10 canonical rooms + 1-2 non-canonical for misc-bucket testing.
- **Keyword scope (Q2):** C. All 14 canonical rooms get DE patterns. Bedroom gets `excludes: ['bad']` mirroring the CS pattern.
- **Diacritics:** Stored pre-normalized (`Küche` → `kuche`). Schema test enforces.
- **`waschraum` overlap:** Documented (bathroom + laundry both claim it). Corroboration handles it; no special-casing.

## Risks

- **Pattern over-match.** `'kinder'` (kids_room) might match `Kinderwagen` (stroller) or other unrelated terms. The fixture has a `Kinder Lampe` entity that should match correctly; we'll verify there are no over-matches in the snapshot. If we hit one, we either tighten the pattern (`'kinderzimmer'` only) or add an `excludes` clause.
- **Regional vocabulary gaps.** Northern Germany uses `Diele` for hallway; Southern uses `Flur`. Both included. `Speisekammer` (pantry — non-canonical) might surprise some users; lands in misc.
- **Fixture-driven false confidence.** Detection thresholds passing on `german-massive` doesn't guarantee they pass on a real German user's install. Mitigation: P1b's friendly invite flow (P1b-6) will surface real-world failures.
- **Word boundary semantics.** Substring matching means `'bad'` matches inside `'badezimmer'`, which is fine. But it'd also match inside `'badminton'` or the (unlikely) `'fußballbad'`. Acceptable false-positive rate for an alpha — overrides (P1b-3) let users correct.

## Acceptance

P1b-1 closes when:

- [ ] 14 new DE rows in `room-keywords.ts`, all passing the schema test.
- [ ] `german-massive.ts` fixture builds, structural test passes.
- [ ] `detect.fixtures.test.ts` runs `german-massive` through the pipe; snapshot pinned; ≥85% of visible entities get a non-misc room.
- [ ] `grouping.fixtures.test.ts` runs `german-massive` through `groupByDomain`; snapshot pinned.
- [ ] `pnpm typecheck`, `pnpm -r test`, `pnpm format:check`, `pnpm lint` clean.
- [ ] No analyzer logic changes (data + fixture + tests only).
