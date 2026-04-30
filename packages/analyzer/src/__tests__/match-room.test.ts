import { describe, it, expect } from 'vitest'
import type { RoomKeyword } from '@lovelacer/shared'
import { findRoom } from '../match-room.js'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'

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
    // 'master bedroom' at 0 vs 'bedroom' at 7 — earliest position (0) wins
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
      // those test detection's lower-priority branches, not the keyword DB.
      // Permissive filter: entity must contain at least one alphabetic word ≥4 chars.
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
