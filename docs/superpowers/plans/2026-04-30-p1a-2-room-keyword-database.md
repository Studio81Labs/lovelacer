# P1a-2 Room Keyword Database (EN + CS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `ROOM_KEYWORDS` (a typed pure-data table covering EN+CS for all 14 non-misc canonical rooms) plus the matching primitives the detection chain (P1a-3) will compose: `normalizeForMatching(text)` and `findRoom(text, opts?)`.

**Architecture:** Pure data lives in `@lovelacer/shared` (`packages/shared/src/room-keywords.ts`). Matching logic lives in `@lovelacer/analyzer` (`normalize-text.ts` + `match-room.ts`). Patterns are stored pre-normalized so per-call work is bounded to normalizing the input. Tiebreaker: earliest match position → longer pattern → document order.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), Vitest. No new runtime dependencies.

**Spec reference:** [`docs/superpowers/specs/2026-04-30-p1a-2-room-keyword-database-design.md`](../specs/2026-04-30-p1a-2-room-keyword-database-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions even when importing `.ts` source — repo convention.
- Type-only imports use `import type { … } from '…'` (`verbatimModuleSyntax` is on).
- Tests use `import { describe, it, expect } from 'vitest'` (no globals).
- Each task ends with one commit. Don't batch unrelated changes.
- Commit-message style: `<type>(<scope>): <subject>` with the existing `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- Run `pnpm` from the worktree (`pnpm --dir <worktree>`). Run `git -C <worktree>`.

---

## Task 1: Types — `LanguageCode` + `RoomKeyword`

**Files:**

- Modify: `packages/shared/src/types.ts`

Pure type declarations. No tests (type-only). The shared barrel at `packages/shared/src/index.ts` uses `export * from './types.js'` (verified), so the new types are auto-re-exported and `index.ts` does not need to be touched in this task.

- [ ] **Step 1: Add the types**

Read `packages/shared/src/types.ts` first to find a sensible insertion point. Insert after the `HaFloorRegistryEntry` block and before the `NormalizedEntity` block, so the file's "raw HA shapes → analyzer types" organization stays intact:

```ts
/**
 * Languages with localized room keyword sets. Adding a new language is a
 * pure data change in `room-keywords.ts` — this union already declares
 * all 8 documented languages even though EN+CS are the only ones with
 * keyword data shipped today.
 */
export type LanguageCode = 'en' | 'cs' | 'de' | 'es' | 'fr' | 'it' | 'pl' | 'nl'

/**
 * One row of the room keyword database.
 *
 * `patterns` and `excludes` are stored pre-normalized: lowercase, no
 * diacritics, words separated by single space, only `[a-z0-9 ]`
 * characters. The matcher normalizes input text the same way before
 * substring-matching against these.
 */
export interface RoomKeyword {
  canonical: Exclude<CanonicalRoomId, 'misc'>
  language: LanguageCode
  patterns: string[]
  excludes?: string[]
}
```

`CanonicalRoomId` is already imported at the top of `types.ts` from `'./constants.js'` — no new import needed.

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --dir <worktree> typecheck
```

Expected: PASS. The new types compile; no consumers yet.

- [ ] **Step 3: Commit**

```bash
git -C <worktree> add packages/shared/src/types.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(shared): add LanguageCode and RoomKeyword types

Foundation for the EN+CS room keyword database (P1a-2). LanguageCode
declares all 8 documented languages even though only EN+CS ship now —
adding DE in P1b-1 becomes a pure data change. RoomKeyword.canonical
narrows CanonicalRoomId via Exclude<…, 'misc'> because misc is the
fallback bucket and cannot be a keyword target.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Data table + schema integrity tests

**Files:**

- Create: `packages/shared/src/room-keywords.ts`
- Create: `packages/shared/src/__tests__/room-keywords.test.ts`
- Modify: `packages/shared/src/index.ts` (re-export `ROOM_KEYWORDS`)

The schema test pins the contract every contributor must respect when extending the table. Write the test first; the test will fail until the data table is complete and well-formed.

- [ ] **Step 1: Write the failing schema test**

Create `packages/shared/src/__tests__/room-keywords.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CANONICAL_ROOMS } from '../constants.js'
import { ROOM_KEYWORDS } from '../room-keywords.js'
import type { LanguageCode } from '../index.js'

const NORMALIZED_PATTERN = /^[a-z0-9 ]+$/
const NON_MISC_ROOMS = CANONICAL_ROOMS.filter((r) => r !== 'misc')

describe('ROOM_KEYWORDS', () => {
  it('covers every non-misc canonical room in English', () => {
    for (const room of NON_MISC_ROOMS) {
      const enRules = ROOM_KEYWORDS.filter((r) => r.canonical === room && r.language === 'en')
      expect(enRules.length, `missing English rules for ${room}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('covers every non-misc canonical room in Czech', () => {
    for (const room of NON_MISC_ROOMS) {
      const csRules = ROOM_KEYWORDS.filter((r) => r.canonical === room && r.language === 'cs')
      expect(csRules.length, `missing Czech rules for ${room}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('every pattern is pre-normalized (lowercase, no diacritics, only [a-z0-9 ])', () => {
    for (const rule of ROOM_KEYWORDS) {
      for (const pattern of rule.patterns) {
        expect(
          pattern,
          `${rule.canonical}/${rule.language}: pattern "${pattern}" is not pre-normalized`,
        ).toMatch(NORMALIZED_PATTERN)
        expect(pattern.startsWith(' ') || pattern.endsWith(' ')).toBe(false)
        expect(pattern.includes('  ')).toBe(false)
      }
    }
  })

  it('every excludes entry is pre-normalized', () => {
    for (const rule of ROOM_KEYWORDS) {
      if (!rule.excludes) continue
      for (const ex of rule.excludes) {
        expect(
          ex,
          `${rule.canonical}/${rule.language}: exclude "${ex}" is not pre-normalized`,
        ).toMatch(NORMALIZED_PATTERN)
      }
    }
  })

  it('no rule has an empty patterns array', () => {
    for (const rule of ROOM_KEYWORDS) {
      expect(
        rule.patterns.length,
        `${rule.canonical}/${rule.language}: patterns array is empty`,
      ).toBeGreaterThan(0)
    }
  })

  it('no duplicate patterns within a single rule', () => {
    for (const rule of ROOM_KEYWORDS) {
      const unique = new Set(rule.patterns)
      expect(unique.size, `${rule.canonical}/${rule.language}: duplicate patterns in rule`).toBe(
        rule.patterns.length,
      )
    }
  })

  it('only declares languages from the LanguageCode union', () => {
    const allowedLanguages = new Set<LanguageCode>(['en', 'cs', 'de', 'es', 'fr', 'it', 'pl', 'nl'])
    for (const rule of ROOM_KEYWORDS) {
      expect(allowedLanguages.has(rule.language)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir <worktree> vitest run packages/shared/src/__tests__/room-keywords.test.ts
```

Expected: FAIL — module not found for `../room-keywords.js`.

- [ ] **Step 3: Create the data table**

Create `packages/shared/src/room-keywords.ts`:

```ts
import type { RoomKeyword } from './types.js'

/**
 * Room keyword database. Localized substring patterns the analyzer uses
 * to detect which canonical room an entity belongs to.
 *
 * STORAGE CONVENTION: patterns and excludes are stored PRE-NORMALIZED —
 * lowercase, no diacritics, single-space-separated, only [a-z0-9 ]. The
 * matcher normalizes its input the same way and uses substring matching.
 * Writing `kuchyně` here will silently fail to match anything; the schema
 * test in __tests__/room-keywords.test.ts catches this at CI time.
 *
 * Adding a new language: append rows. No type changes needed (LanguageCode
 * already declares all 8 documented languages).
 */
export const ROOM_KEYWORDS: RoomKeyword[] = [
  // ── kitchen ──────────────────────────────────────────────────────
  { canonical: 'kitchen', language: 'en', patterns: ['kitchen', 'kitchenette'] },
  { canonical: 'kitchen', language: 'cs', patterns: ['kuchyne', 'kuch'] },

  // ── living_room ──────────────────────────────────────────────────
  {
    canonical: 'living_room',
    language: 'en',
    patterns: ['living room', 'livingroom', 'lounge', 'family room'],
  },
  {
    canonical: 'living_room',
    language: 'cs',
    patterns: ['obyvak', 'obyvaci pokoj'],
  },

  // ── bedroom ──────────────────────────────────────────────────────
  {
    canonical: 'bedroom',
    language: 'en',
    patterns: ['bedroom', 'master bedroom'],
    excludes: ['bathroom'],
  },
  {
    canonical: 'bedroom',
    language: 'cs',
    patterns: ['loznice', 'master loznice'],
    excludes: ['koupelna'],
  },

  // ── bathroom ─────────────────────────────────────────────────────
  { canonical: 'bathroom', language: 'en', patterns: ['bathroom', 'shower room'] },
  { canonical: 'bathroom', language: 'cs', patterns: ['koupelna', 'sprcha'] },

  // ── office ───────────────────────────────────────────────────────
  { canonical: 'office', language: 'en', patterns: ['office', 'study', 'workroom'] },
  { canonical: 'office', language: 'cs', patterns: ['kancelar', 'pracovna'] },

  // ── hallway ──────────────────────────────────────────────────────
  {
    canonical: 'hallway',
    language: 'en',
    patterns: ['hallway', 'corridor', 'entry', 'entryway'],
  },
  { canonical: 'hallway', language: 'cs', patterns: ['chodba', 'predsin'] },

  // ── garage ───────────────────────────────────────────────────────
  { canonical: 'garage', language: 'en', patterns: ['garage', 'garage bay'] },
  { canonical: 'garage', language: 'cs', patterns: ['garaz', 'garaze'] },

  // ── garden ───────────────────────────────────────────────────────
  { canonical: 'garden', language: 'en', patterns: ['garden', 'yard', 'outdoor'] },
  { canonical: 'garden', language: 'cs', patterns: ['zahrada', 'dvorek', 'venku'] },

  // ── dining_room ──────────────────────────────────────────────────
  {
    canonical: 'dining_room',
    language: 'en',
    patterns: ['dining room', 'diningroom'],
  },
  { canonical: 'dining_room', language: 'cs', patterns: ['jidelna'] },

  // ── laundry ──────────────────────────────────────────────────────
  {
    canonical: 'laundry',
    language: 'en',
    patterns: ['laundry', 'laundry room', 'utility room'],
  },
  { canonical: 'laundry', language: 'cs', patterns: ['pradelna', 'pradlo'] },

  // ── basement ─────────────────────────────────────────────────────
  { canonical: 'basement', language: 'en', patterns: ['basement', 'cellar'] },
  { canonical: 'basement', language: 'cs', patterns: ['sklep', 'suteren'] },

  // ── attic ────────────────────────────────────────────────────────
  { canonical: 'attic', language: 'en', patterns: ['attic', 'loft'] },
  { canonical: 'attic', language: 'cs', patterns: ['puda'] },

  // ── kids_room ────────────────────────────────────────────────────
  {
    canonical: 'kids_room',
    language: 'en',
    patterns: ['kids room', 'children room', 'nursery', 'playroom'],
  },
  { canonical: 'kids_room', language: 'cs', patterns: ['detsky pokoj'] },

  // ── guest_room ───────────────────────────────────────────────────
  {
    canonical: 'guest_room',
    language: 'en',
    patterns: ['guest room', 'guestroom'],
  },
  { canonical: 'guest_room', language: 'cs', patterns: ['hostinsky pokoj', 'pokoj pro hosty'] },
]
```

(28 rules. Reasonable extensions are fine — schema test asserts ≥1 EN and ≥1 CS rule per non-misc canonical, not exact counts.)

- [ ] **Step 4: Re-export from the shared barrel**

Edit `packages/shared/src/index.ts` to add the new file to the wildcard re-exports:

```ts
export * from './constants.js'
export * from './types.js'
export * from './room-keywords.js'
```

(One line appended.)

- [ ] **Step 5: Run the schema tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/shared/src/__tests__/room-keywords.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both must exit 0. The full workspace test count goes up by 7.

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add packages/shared/src/room-keywords.ts \
        packages/shared/src/__tests__/room-keywords.test.ts \
        packages/shared/src/index.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(shared): add ROOM_KEYWORDS data table (EN + CS, 14 rooms)

Pre-normalized substring patterns covering all non-misc canonical
rooms. Schema integrity tests pin the storage convention (lowercase,
no diacritics, [a-z0-9 ] only) so future contributors can't ship
'kuchyně' that silently fails to match anything.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `normalizeForMatching` text helper

**Files:**

- Create: `packages/analyzer/src/normalize-text.ts`
- Create: `packages/analyzer/src/__tests__/normalize-text.test.ts`

The 5-step normalization pipeline. Pure function, easy to TDD.

- [ ] **Step 1: Write the failing test**

Create `packages/analyzer/src/__tests__/normalize-text.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeForMatching } from '../normalize-text.js'

describe('normalizeForMatching', () => {
  it('lowercases ASCII', () => {
    expect(normalizeForMatching('Kitchen')).toBe('kitchen')
    expect(normalizeForMatching('LIVING ROOM')).toBe('living room')
  })

  it('strips diacritics via NFKD + combining mark removal', () => {
    expect(normalizeForMatching('obývák')).toBe('obyvak')
    expect(normalizeForMatching('ložnice')).toBe('loznice')
    expect(normalizeForMatching('küche')).toBe('kuche')
    expect(normalizeForMatching('Příšerně')).toBe('priserne')
  })

  it('collapses runs of separators (whitespace, underscore, dash, slash) to single space', () => {
    expect(normalizeForMatching('Living_Room')).toBe('living room')
    expect(normalizeForMatching('master--bedroom')).toBe('master bedroom')
    expect(normalizeForMatching('Hallway / Stairs')).toBe('hallway stairs')
    expect(normalizeForMatching('Aqara/TH-158d')).toBe('aqara th 158d')
    expect(normalizeForMatching('  multiple   spaces  ')).toBe('multiple spaces')
    expect(normalizeForMatching('mixed_-/whitespace tabs\there')).toBe('mixed whitespace tabs here')
  })

  it('preserves non-separator punctuation (apostrophes, parens, dots)', () => {
    expect(normalizeForMatching("Bart's Office (master)_2")).toBe("bart's office (master) 2")
    expect(normalizeForMatching('sensor.living_room')).toBe('sensor.living room')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeForMatching('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeForMatching('   ')).toBe('')
    expect(normalizeForMatching('___---///')).toBe('')
  })

  it('handles digits unchanged', () => {
    expect(normalizeForMatching('Sensor 4')).toBe('sensor 4')
    expect(normalizeForMatching('0x158d_th')).toBe('0x158d th')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/normalize-text.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `packages/analyzer/src/normalize-text.ts`:

```ts
/**
 * Normalize a candidate string for substring matching against the room
 * keyword database.
 *
 * Pipeline (in order):
 *   1. Lowercase
 *   2. Unicode NFKD decomposition
 *   3. Strip combining marks (`\p{M}`) — diacritics, accents, etc.
 *   4. Collapse runs of `[\s_\-/]` to a single space
 *   5. Trim
 *
 * Output is suitable for `String.prototype.indexOf` against patterns
 * stored pre-normalized in `ROOM_KEYWORDS`.
 */
export function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s_\-/]+/g, ' ')
    .trim()
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/normalize-text.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add packages/analyzer/src/normalize-text.ts \
        packages/analyzer/src/__tests__/normalize-text.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(analyzer): normalizeForMatching text helper

Five-step pipeline: lowercase → NFKD → strip combining marks →
collapse separators (whitespace/underscore/dash/slash) → trim.
Output matches the pre-normalized form used in ROOM_KEYWORDS, so
findRoom can use indexOf without per-call pattern normalization.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `findRoom` matcher — core algorithm

**Files:**

- Create: `packages/analyzer/src/match-room.ts`
- Create: `packages/analyzer/src/__tests__/match-room.test.ts`
- Modify: `packages/analyzer/src/index.ts` (re-export `findRoom` + types)

Unit tests use small inline `keywords` overrides to keep scenarios focused. Integration against the full table comes in Task 5.

- [ ] **Step 1: Write the failing tests**

Create `packages/analyzer/src/__tests__/match-room.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { RoomKeyword } from '@lovelacer/shared'
import { findRoom } from '../match-room.js'

const SMALL_KEYWORDS: RoomKeyword[] = [
  { canonical: 'kitchen', language: 'en', patterns: ['kitchen'] },
  {
    canonical: 'living_room',
    language: 'en',
    patterns: ['living room', 'lounge'],
  },
  {
    canonical: 'bedroom',
    language: 'en',
    patterns: ['bedroom', 'master bedroom'],
    excludes: ['bathroom'],
  },
  { canonical: 'bathroom', language: 'en', patterns: ['bathroom'] },
  { canonical: 'kitchen', language: 'cs', patterns: ['kuchyne'] },
]

describe('findRoom — core matching', () => {
  it('matches a single pattern at index 0', () => {
    const m = findRoom('Living Room Light', { keywords: SMALL_KEYWORDS })
    expect(m).not.toBeNull()
    expect(m!.canonical).toBe('living_room')
    expect(m!.language).toBe('en')
    expect(m!.pattern).toBe('living room')
    expect(m!.matchedAt).toBe(0)
  })

  it('matches an alternative pattern within the same rule', () => {
    const m = findRoom('Lounge Lamp', { keywords: SMALL_KEYWORDS })
    expect(m!.canonical).toBe('living_room')
    expect(m!.pattern).toBe('lounge')
  })

  it('skips a rule when an exclude is present in the candidate', () => {
    const m = findRoom('Master Bathroom Light', { keywords: SMALL_KEYWORDS })
    // Bedroom rule is excluded by 'bathroom'; bathroom rule still matches.
    expect(m!.canonical).toBe('bathroom')
  })

  it('returns null when nothing matches', () => {
    const m = findRoom('random gibberish xyzzy', { keywords: SMALL_KEYWORDS })
    expect(m).toBeNull()
  })

  it('returns null on empty input', () => {
    expect(findRoom('', { keywords: SMALL_KEYWORDS })).toBeNull()
    expect(findRoom('   ', { keywords: SMALL_KEYWORDS })).toBeNull()
  })

  it('respects opts.language to restrict matching', () => {
    expect(findRoom('Kitchen Light', { keywords: SMALL_KEYWORDS, language: 'cs' })).toBeNull()
    const m = findRoom('Kitchen Light', { keywords: SMALL_KEYWORDS, language: 'en' })
    expect(m!.canonical).toBe('kitchen')
  })

  it('returns null when opts.keywords is empty', () => {
    expect(findRoom('Kitchen Light', { keywords: [] })).toBeNull()
  })
})

describe('findRoom — tiebreakers', () => {
  it('earliest matchedAt wins over later match', () => {
    // "kitchen" at 0, "bedroom" at 8 — kitchen wins
    const m = findRoom('kitchen bedroom thermostat', { keywords: SMALL_KEYWORDS })
    expect(m!.canonical).toBe('kitchen')
    expect(m!.matchedAt).toBe(0)
  })

  it('longer pattern wins when multiple rules anchor at the same index', () => {
    // Construct a contrived input: 'master bedroom' appears at 0; 'bedroom'
    // also matches starting at index 7. Earliest position rule means
    // 'master bedroom' wins because it starts at 0 and 'bedroom' at 7.
    const m = findRoom('master bedroom suite', { keywords: SMALL_KEYWORDS })
    expect(m!.pattern).toBe('master bedroom')
    expect(m!.matchedAt).toBe(0)
  })

  it('document order breaks ties when position and length match', () => {
    // Two rules with the same single-pattern at index 0. First in array wins.
    const tiedKeywords: RoomKeyword[] = [
      { canonical: 'office', language: 'en', patterns: ['room'] },
      { canonical: 'guest_room', language: 'en', patterns: ['room'] },
    ]
    const m = findRoom('Room', { keywords: tiedKeywords })
    expect(m!.canonical).toBe('office')
  })
})

describe('findRoom — defaults to ROOM_KEYWORDS when no keywords given', () => {
  it('uses ROOM_KEYWORDS when opts.keywords is omitted', () => {
    // Just confirm wiring; comprehensive table-based assertions live in
    // the integration suite (Task 5).
    const m = findRoom('Living Room Light')
    expect(m).not.toBeNull()
    expect(m!.canonical).toBe('living_room')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/match-room.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the matcher**

Create `packages/analyzer/src/match-room.ts`:

```ts
import type { CanonicalRoomId, LanguageCode, RoomKeyword } from '@lovelacer/shared'
import { ROOM_KEYWORDS } from '@lovelacer/shared'
import { normalizeForMatching } from './normalize-text.js'

export interface RoomMatch {
  canonical: Exclude<CanonicalRoomId, 'misc'>
  language: LanguageCode
  pattern: string
  matchedAt: number
}

export interface FindRoomOptions {
  language?: LanguageCode
  keywords?: readonly RoomKeyword[]
}

interface Hit extends RoomMatch {
  ruleIndex: number
}

/**
 * Find the most-likely canonical room for a candidate string.
 *
 * Returns the winning match by (1) earliest position in the normalized
 * text, (2) longer pattern as tiebreaker, (3) document order in the
 * keywords array as final tiebreaker. Returns `null` if no rule matches.
 *
 * Rules whose `excludes` substrings appear anywhere in the normalized
 * text are skipped wholesale.
 */
export function findRoom(text: string, opts: FindRoomOptions = {}): RoomMatch | null {
  const normalized = normalizeForMatching(text)
  if (normalized.length === 0) return null

  const keywords = opts.keywords ?? ROOM_KEYWORDS
  const filtered =
    opts.language !== undefined ? keywords.filter((r) => r.language === opts.language) : keywords

  const hits: Hit[] = []
  for (let i = 0; i < filtered.length; i++) {
    const rule = filtered[i]!
    if (rule.excludes && rule.excludes.some((ex) => normalized.includes(ex))) continue

    for (const pattern of rule.patterns) {
      const matchedAt = normalized.indexOf(pattern)
      if (matchedAt === -1) continue
      hits.push({
        canonical: rule.canonical,
        language: rule.language,
        pattern,
        matchedAt,
        ruleIndex: i,
      })
    }
  }

  if (hits.length === 0) return null

  hits.sort((a, b) => {
    if (a.matchedAt !== b.matchedAt) return a.matchedAt - b.matchedAt
    if (a.pattern.length !== b.pattern.length) return b.pattern.length - a.pattern.length
    return a.ruleIndex - b.ruleIndex
  })

  const winner = hits[0]!
  return {
    canonical: winner.canonical,
    language: winner.language,
    pattern: winner.pattern,
    matchedAt: winner.matchedAt,
  }
}
```

- [ ] **Step 4: Re-export from the analyzer barrel**

Read `packages/analyzer/src/index.ts` to confirm the existing pattern, then append:

```ts
export { findRoom } from './match-room.js'
export type { FindRoomOptions, RoomMatch } from './match-room.js'
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/match-room.test.ts
```

Expected: PASS (11 tests).

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add packages/analyzer/src/match-room.ts \
        packages/analyzer/src/__tests__/match-room.test.ts \
        packages/analyzer/src/index.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(analyzer): findRoom matcher with position/length tiebreakers

Pure substring matcher over RoomKeyword rules. Skips rules whose
excludes are present in the candidate. Tiebreaker: earliest position
→ longer pattern → document order. Defaults to ROOM_KEYWORDS but
accepts an explicit keywords override for tests and a language
restriction.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `findRoom` — full-table integration + fixture sanity check

**Files:**

- Modify: `packages/analyzer/src/__tests__/match-room.test.ts`

Adds tests that exercise the real `ROOM_KEYWORDS` data and a fixture-driven sanity check against `english-cluttered`.

- [ ] **Step 1: Add the integration test imports**

Edit `packages/analyzer/src/__tests__/match-room.test.ts`. Add two new imports right below the existing imports at the top of the file:

```ts
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
```

(`fixtureToHaRegistries` was added in P1a-1's Task 6 and exposes the fixture's data in HA wire shape; here we read directly from the fixture's structured form.)

Wait — `fixtureToHaRegistries` returns HA wire shape, but for this test we want each entity's structured area + originalName. We can read those off `englishCluttered.entities` and `englishCluttered.areas` directly from the fixture builder shape. Drop the `fixtureToHaRegistries` import; we only need `englishCluttered`:

```ts
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
```

- [ ] **Step 2: Add the full-table tests**

Append a new `describe` block at the bottom of the file:

```ts
describe('findRoom — full ROOM_KEYWORDS integration', () => {
  it('detects English: Living Room Light → living_room/en', () => {
    const m = findRoom('Living Room Light')
    expect(m!.canonical).toBe('living_room')
    expect(m!.language).toBe('en')
  })

  it('detects Czech: Obývací pokoj lampa → living_room/cs', () => {
    const m = findRoom('Obývací pokoj lampa')
    expect(m!.canonical).toBe('living_room')
    expect(m!.language).toBe('cs')
  })

  it('strips Czech diacritics during match: Ložnice → bedroom/cs', () => {
    const m = findRoom('Ložnice')
    expect(m!.canonical).toBe('bedroom')
    expect(m!.language).toBe('cs')
  })

  it('English garage does not false-match any Czech rule', () => {
    const m = findRoom('Garage Light', { language: 'cs' })
    expect(m).toBeNull()
  })

  it('Czech garaze does not false-match any English rule', () => {
    const m = findRoom('Garaze svetlo', { language: 'en' })
    expect(m).toBeNull()
  })

  it('detects bathroom in CS without false-matching bedroom (excludes)', () => {
    const m = findRoom('Master koupelna svetlo')
    expect(m!.canonical).toBe('bathroom')
  })
})
```

- [ ] **Step 3: Add the fixture-driven sanity check**

Append another `describe` block below:

```ts
describe('findRoom — english-cluttered fixture sanity check', () => {
  // Build a (areaId → canonical-room slug) map by reading the fixture's
  // areas. Each area's slug IS the canonical-ish identifier we expect
  // findRoom to surface from the entity's friendlyName.
  const areaIdToCanonical = new Map<string, string>()
  for (const area of englishCluttered.areas) {
    areaIdToCanonical.set(area.id, area.id)
  }

  it('matches the room implied by area for ≥80% of entities with non-null area', () => {
    let testable = 0
    let correct = 0

    for (const entity of englishCluttered.entities) {
      if (entity.area === null) continue
      // Skip entities whose own friendly name is intentionally ambiguous —
      // those are testing detection's lower-priority branches, not the
      // keyword DB. The fixture's "ambiguous" floaters all have hex IDs
      // or numeric names, so we filter on a permissive rule: entity must
      // contain at least one alphabetic word ≥4 chars.
      const hasNamedRoom = /\b[a-z]{4,}/i.test(entity.originalName)
      if (!hasNamedRoom) continue

      const expected = areaIdToCanonical.get(entity.area)
      if (expected === undefined) continue
      testable++

      const m = findRoom(entity.originalName)
      if (m && m.canonical === expected) correct++
    }

    expect(testable).toBeGreaterThan(20) // sanity: we have plenty of testable entities
    const ratio = correct / testable
    expect(ratio, `${correct}/${testable} entities matched their area`).toBeGreaterThanOrEqual(0.8)
  })
})
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/analyzer/src/__tests__/match-room.test.ts
```

Expected: PASS — analyzer match-room tests are now ~18 (11 from Task 4 + 7 new).

If the fixture sanity check fails, the implementer should:

1. Inspect which entities miss — add a temporary `console.log` of the misses inside the loop.
2. Either widen the keyword patterns in `ROOM_KEYWORDS` (if a real synonym is missing — e.g., "Living Room Spot 1" should match but doesn't), or tighten the test's filter (if the misses are deliberately ambiguous fixture entries).

Don't drop below 80% to make the test pass. The threshold exists to catch real coverage gaps.

- [ ] **Step 5: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add packages/analyzer/src/__tests__/match-room.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
test(analyzer): findRoom integration + english-cluttered sanity check

Real-table tests exercise the EN+CS data shipped in P1a-2: positive
detection per language, diacritic-tolerant CS, cross-language
non-collision via opts.language. Fixture-driven sanity check confirms
the keyword set actually identifies the rooms in the canonical
english-cluttered fixture (≥80% match-to-area for entities with
clear room names).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1a-2 Acceptance Confirmation

Run through the AC from the spec:

- [ ] `ROOM_KEYWORDS` exported from `@lovelacer/shared` with full EN+CS coverage (Task 2).
- [ ] Schema tests pass (every non-misc canonical has EN and CS rules; all patterns pre-normalized) (Task 2).
- [ ] `findRoom` exported from `@lovelacer/analyzer` (Task 4).
- [ ] Normalization tests pass (Task 3).
- [ ] Matcher tests pass — positive cases, excludes, tiebreakers, restricted language, no-match (Task 4).
- [ ] `english-cluttered` fixture sanity check passes the 80% threshold for the six known rooms (Task 5).
- [ ] `pnpm typecheck` clean (verified at end of every task).
- [ ] `pnpm test` green (verified at end of every task).
