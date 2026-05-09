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

  it('expands German ß to ss (no NFKD decomposition)', () => {
    expect(normalizeForMatching('Außen')).toBe('aussen')
    expect(normalizeForMatching('Außenbereich')).toBe('aussenbereich')
    expect(normalizeForMatching('Großküche')).toBe('grosskuche')
    expect(normalizeForMatching('Fußbodenheizung')).toBe('fussbodenheizung')
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

  it('bounds pathological registry names before Unicode normalization', () => {
    const huge = `Kitchen ${'x'.repeat(10_000)} Bathroom`
    const normalized = normalizeForMatching(huge)

    expect(normalized).toContain('kitchen')
    expect(normalized).not.toContain('bathroom')
    expect(normalized.length).toBeLessThanOrEqual(512)
  })
})
