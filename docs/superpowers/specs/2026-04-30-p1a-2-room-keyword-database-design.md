# P1a-2 Room Keyword Database (EN + CS) — Design

**Status:** Draft v1 · **Date:** 2026-04-30 · **Ticket:** [P1a-2 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Ship the room-detection keyword database — pure data — plus the matching primitives the detection chain (P1a-3) will compose: a text-normalization helper and a `findRoom(text, opts?)` matcher. Cover EN and CS for all 14 non-misc canonical rooms.

## Non-goals

- The detection priority chain itself. P1a-3 wires `findRoom` into the friendly-name and entity_id steps.
- Confidence scoring. P1a-4.
- Display labels for canonical rooms (e.g., for the SPA). Future ticket.
- Languages beyond EN and CS — DE in P1b-1, ES/FR/IT/PL/NL when those tickets open.
- "Auto" language detection from HA's `core.config.language`. The matcher returns the best match across the loaded languages; a future config option can restrict it.

## Approach summary

A single typed data table (`packages/shared/src/room-keywords.ts`) holds every `RoomKeyword` rule. The analyzer ships a small, pure normalization helper and a `findRoom` function that consumes the table. Patterns are stored pre-normalized so per-call work stays bounded to normalizing the input text.

This keeps configuration (data) separate from logic (matching). The web SPA can later read the table directly to label canonical rooms in their detected language.

## Architecture

```
packages/shared/src/
  types.ts                    # add LanguageCode + RoomKeyword
  room-keywords.ts            # ROOM_KEYWORDS: RoomKeyword[]
  index.ts                    # re-exports the new symbols
  __tests__/
    room-keywords.test.ts     # schema integrity

packages/analyzer/src/
  normalize-text.ts           # normalizeForMatching(text)
  match-room.ts               # findRoom(text, opts?), RoomMatch, FindRoomOptions
  index.ts                    # re-export findRoom + types
  __tests__/
    normalize-text.test.ts
    match-room.test.ts
```

## Components

### 1. Types (`packages/shared/src/types.ts`)

```ts
export type LanguageCode = 'en' | 'cs' | 'de' | 'es' | 'fr' | 'it' | 'pl' | 'nl'

export interface RoomKeyword {
  /**
   * The canonical room this rule maps to. `'misc'` is the fallback bucket
   * and cannot be a keyword target — only the detection chain can route
   * an entity there when nothing else matches.
   */
  canonical: Exclude<CanonicalRoomId, 'misc'>
  language: LanguageCode
  /**
   * Pre-normalized match patterns: lowercase, no diacritics, words
   * separated by single space, only [a-z0-9 ] characters. The matcher
   * normalizes input text the same way and uses substring matching.
   */
  patterns: string[]
  /**
   * Optional substring guards. If any of these is present in the
   * normalized candidate text, the entire rule is skipped. Same
   * normalization rules as `patterns`.
   */
  excludes?: string[]
}
```

`CanonicalRoomId` and `LanguageCode` are deliberately broader than the EN+CS data shipped now — adding DE in P1b-1 is a pure data change.

### 2. Data table (`packages/shared/src/room-keywords.ts`)

A single `export const ROOM_KEYWORDS: RoomKeyword[]` containing 28+ rules (14 rooms × 2 languages, more if a single canonical needs multiple per-language rule entries).

**Coverage requirements:**

| Canonical     | EN seed patterns                                     | CS seed patterns                                                                                                       |
| ------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `kitchen`     | `kitchen`, `kitchenette`                             | `kuchyne`, `kuch`                                                                                                      |
| `living_room` | `living room`, `livingroom`, `lounge`, `family room` | `obyvak`, `obyvaci pokoj`                                                                                              |
| `bedroom`     | `bedroom`, `master bedroom` (excludes: `bathroom`)   | `loznice`, `master loznice` (excludes: `koupelna`)                                                                     |
| `bathroom`    | `bathroom`, `bath`, `shower`                         | `koupelna`, `sprcha`                                                                                                   |
| `office`      | `office`, `study`, `workroom`                        | `kancelar`, `pracovna`                                                                                                 |
| `hallway`     | `hallway`, `corridor`, `entry`, `entryway`           | `chodba`, `predsin`                                                                                                    |
| `garage`      | `garage`, `garage bay`                               | `garaz`, `garaze`                                                                                                      |
| `garden`      | `garden`, `yard`, `outdoor`                          | `zahrada`, `dvorek`, `venku`                                                                                           |
| `dining_room` | `dining room`, `diningroom`                          | `jidelna`                                                                                                              |
| `laundry`     | `laundry`, `laundry room`, `utility`                 | `pradelna`, `pradlo`                                                                                                   |
| `basement`    | `basement`, `cellar`                                 | `sklep`, `suteren`                                                                                                     |
| `attic`       | `attic`, `loft`                                      | `puda`                                                                                                                 |
| `kids_room`   | `kids room`, `children room`, `nursery`, `playroom`  | `detsky pokoj`, `dětský pokoj` (the latter normalizes to the former; ship one — duplicate exposes a normalization bug) |
| `guest_room`  | `guest room`, `guestroom`                            | `host pokoj`, `pokoj pro hosty`                                                                                        |

Pattern lists are seed values; the implementer may extend each with one or two more synonyms while staying compact. The tests assert _minimum_ coverage (≥1 EN rule, ≥1 CS rule per non-misc canonical), not exact counts, so reasonable additions don't break tests.

A header comment in the file documents the pre-normalization convention so future contributors don't ship raw `kuchyně` and wonder why nothing matches.

### 3. Normalization helper (`packages/analyzer/src/normalize-text.ts`)

```ts
export function normalizeForMatching(text: string): string
```

Pipeline, in order:

1. Lowercase via `String.prototype.toLowerCase()`.
2. NFKD via `String.prototype.normalize('NFKD')`.
3. Strip combining marks: `.replace(/\p{M}/gu, '')`.
4. Replace separator runs with single space: `.replace(/[\s_\-/]+/g, ' ')`.
5. Trim.

Step 3's `\p{M}` Unicode property requires the `u` flag — strips diaeresis, acute, caron, etc., which is exactly what HEURISTICS.md prescribes (`küche` → `kueche` via NFKD + strip; in practice the German `ü` decomposes to `u` + `̈`, so we get `kuche` after the strip — close enough; the keyword data has both spellings if there's any ambiguity).

Apostrophes, parentheses, digits, dots stay intact. Patterns don't contain them, so they're inert for matching but preserved for future use cases (e.g., the analyzer might log the pre-normalized text for diagnostics).

### 4. Matcher (`packages/analyzer/src/match-room.ts`)

```ts
import type { CanonicalRoomId, LanguageCode, RoomKeyword } from '@lovelacer/shared'

export interface RoomMatch {
  canonical: Exclude<CanonicalRoomId, 'misc'>
  language: LanguageCode
  pattern: string // the specific pattern that matched
  matchedAt: number // index in the normalized text where the match starts
}

export interface FindRoomOptions {
  language?: LanguageCode
  keywords?: readonly RoomKeyword[] // default: ROOM_KEYWORDS — override for tests
}

export function findRoom(text: string, opts?: FindRoomOptions): RoomMatch | null
```

**Algorithm:**

1. Normalize `text` via `normalizeForMatching`.
2. Pick the keyword set: `opts.keywords ?? ROOM_KEYWORDS`. If `opts.language` is set, filter to that language.
3. For each rule:
   - If any `excludes` substring is `.includes(...)` in the normalized text → skip the rule.
   - For each `pattern`, compute `normalized.indexOf(pattern)`. Skip patterns that don't match.
4. Collect every successful `(canonical, language, pattern, matchedAt)` hit.
5. **Tiebreaker:**
   1. Earliest `matchedAt` wins.
   2. Tie → longer `pattern.length` wins.
   3. Tie → first rule in `keywords` document order wins.
6. Return the winner. If no hits, return `null`.

**Pure function.** Re-runnable, no globals, no mutation. The `keywords` parameter exists for tests so we can craft narrow-scoped scenarios without depending on the full table.

### 5. Re-exports

`packages/shared/src/index.ts` adds:

```ts
export { ROOM_KEYWORDS } from './room-keywords.js'
export type { RoomKeyword, LanguageCode } from './types.js'
```

`packages/analyzer/src/index.ts` adds:

```ts
export { findRoom } from './match-room.js'
export type { RoomMatch, FindRoomOptions } from './match-room.js'
```

`normalizeForMatching` stays internal to the analyzer (file-level export, not package-level) — consumers should always go through `findRoom`.

## Data flow

```
input text (raw, e.g. "Light.Master_Bedroom_Lamp" → "Master_Bedroom_Lamp" by upstream)
  │
  ▼
findRoom(text, opts?)
  │
  ├─ normalizeForMatching → "master bedroom lamp"
  ├─ filter keywords by opts.language (or all)
  ├─ for each rule:
  │   ├─ check excludes — "bathroom" in text? no → continue
  │   └─ for each pattern: indexOf → record hit
  ├─ apply tiebreaker
  └─ return RoomMatch | null
```

## Error handling

| Condition                                                              | Behavior                                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `text` is empty / whitespace-only                                      | Returns `null` (normalized to `''`, no patterns can match)                   |
| `opts.language` is set but no rules in the table for it                | Returns `null`                                                               |
| `opts.keywords` is empty                                               | Returns `null`                                                               |
| Pattern in the data table contains an uppercase character or diacritic | The matcher silently won't match it; the schema test catches this at CI time |

No throws. The function is total over its declared input space.

## Testing

### `packages/shared/src/__tests__/room-keywords.test.ts` — schema

- Every non-`misc` canonical in `CANONICAL_ROOMS` has at least one rule with `language: 'en'` and at least one with `language: 'cs'`.
- Every pattern matches `/^[a-z0-9 ]+$/` — pre-normalized form, no leading/trailing spaces, no consecutive spaces.
- Every `excludes` entry (when present) matches the same regex.
- No empty `patterns` arrays.
- No duplicate patterns within a single rule.

### `packages/analyzer/src/__tests__/normalize-text.test.ts` — normalization

- Lowercase: `Kitchen` → `kitchen`.
- Strip diacritics: `obývák` → `obyvak`, `küche` → `kuche`, `ložnice` → `loznice`.
- Separators: `Living_Room` → `living room`, `master--bedroom` → `master bedroom`, `Hallway / Stairs` → `hallway stairs`, `Aqara/TH-158d` → `aqara th 158d`, `  multiple   spaces  ` → `multiple spaces`.
- Combined: `Bart's Office (master)_2` → `bart's office (master) 2` — apostrophes and parens preserved.
- Empty input: `''` → `''`.
- Whitespace-only: `'   '` → `''`.

### `packages/analyzer/src/__tests__/match-room.test.ts` — matcher

Direct cases (use small inline `keywords` arrays, not the full `ROOM_KEYWORDS`, for focus):

- Single-language single-pattern: `Living Room Light` matches `living_room/en` at index 0.
- Multi-pattern same rule: `Lounge Light` matches `living_room/en` via the `lounge` pattern.
- Excludes guard: `Master Bathroom Light` does NOT match `bedroom/en` (the rule's `excludes: ['bathroom']` skips it); does match `bathroom/en`.
- `language: 'cs'` option restricts: `Kitchen Light` with `language: 'cs'` → `null`.
- Position tiebreaker: text contains both `kitchen` (at index 0) and `bedroom` (at index 8) → returns `kitchen`.
- Specificity tiebreaker: two patterns of different rules anchor at the same index in a constructed input → longer pattern wins.
- No-match: `random gibberish xyzzy` → `null`.

Full-table cases (using `ROOM_KEYWORDS`):

- Czech detection: `Obývací pokoj lampa` → `living_room/cs`.
- Diacritic-tolerant: `Ložnice` → `bedroom/cs`.
- Cross-language non-collision: `garaze` (CS) doesn't match any EN rule; `garage` (EN) doesn't match any CS rule.

Fixture-driven sanity check (using `english-cluttered` from P0-2):

```ts
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
```

For each fixture entity whose `area` is non-null (the analyzer's later stages would route by `haAreaId`, but for this test we treat the fixture's known area as the ground truth), run `findRoom` on the entity's `originalName` and check that the returned canonical matches the area's slug for at least 80% of the entities in the six known rooms. Threshold (not exactness) since the fixture deliberately includes ambiguous-named entities.

## File-by-file

| File                                                     | Action | Notes                             |
| -------------------------------------------------------- | ------ | --------------------------------- |
| `packages/shared/src/types.ts`                           | Modify | Add `LanguageCode`, `RoomKeyword` |
| `packages/shared/src/room-keywords.ts`                   | Create | The `ROOM_KEYWORDS` data table    |
| `packages/shared/src/index.ts`                           | Modify | Re-export new types + data        |
| `packages/shared/src/__tests__/room-keywords.test.ts`    | Create | Schema integrity tests            |
| `packages/analyzer/src/normalize-text.ts`                | Create | `normalizeForMatching`            |
| `packages/analyzer/src/match-room.ts`                    | Create | `findRoom` + types                |
| `packages/analyzer/src/index.ts`                         | Modify | Re-export `findRoom`              |
| `packages/analyzer/src/__tests__/normalize-text.test.ts` | Create | Normalization unit tests          |
| `packages/analyzer/src/__tests__/match-room.test.ts`     | Create | Matcher unit + fixture tests      |

## Open questions resolved during brainstorming

- **Data location:** `packages/shared/src/room-keywords.ts` (option C). Web can read it.
- **Matcher location:** `packages/analyzer/src/match-room.ts` (option C). Logic stays with the analyzer.
- **Scope:** data + matcher (option B). Tightly coupled; ship together.
- **`LanguageCode`:** declares all 8 even though only EN+CS ship. Adding DE is a data-only change.
- **`canonical` excludes `'misc'`:** misc is the fallback bucket only; not a keyword target.
- **Patterns stored pre-normalized:** keeps per-call cost bounded; schema test enforces.
- **Separator regex:** `[\s_\-/]+` — adds slash beyond what HEURISTICS.md mentions.
- **Tiebreaker:** earliest position → longer pattern → document order.
- **`excludes` semantics:** if any exclude substring is in the candidate, the entire rule is skipped.
- **`auto` language behavior:** matcher returns the best across all loaded languages by default; explicit `opts.language` restricts.

## Risks

- **Diacritic stripping not idempotent on all Unicode.** NFKD + `\p{M}` covers Latin-extended (which is what EN+CS need). If P1b-1's German pack uses combining marks we don't strip cleanly, the test will catch it before merge.
- **Pattern conflicts between languages.** `garage` (EN) vs `garaz` (CS) is the canonical example — they're spelled differently, so no collision. The cross-language non-collision tests guard against accidental future overlaps.
- **Pre-normalized data vs natural language readability.** Future contributors might write `kuchyně` and have it silently fail to match. The schema test catches it; the file header comment documents the convention.

## Acceptance

P1a-2 closes when:

- [ ] `ROOM_KEYWORDS` exported from `@lovelacer/shared` with full EN+CS coverage.
- [ ] Schema tests pass (every non-misc canonical has EN and CS rules; all patterns pre-normalized).
- [ ] `findRoom` exported from `@lovelacer/analyzer`.
- [ ] Normalization tests pass (lowercase, diacritics, separators, edge cases).
- [ ] Matcher tests pass (positive cases, excludes, tiebreakers, restricted language, no-match).
- [ ] `english-cluttered` fixture-driven sanity check passes the 80% threshold for the six known rooms.
- [ ] `pnpm typecheck` clean.
- [ ] `pnpm test` green.
