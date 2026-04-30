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
