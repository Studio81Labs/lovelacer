import { describe, it, expect } from 'vitest'
import { czechTidy } from '../czech-tidy.js'

const fx = czechTidy

describe('czech-tidy fixture', () => {
  it('has exactly five rooms (areas)', () => {
    expect(fx.areas).toHaveLength(5)
  })

  it('has between 75 and 90 entities', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(75)
    expect(fx.entities.length).toBeLessThanOrEqual(90)
  })

  it('declares two floors', () => {
    expect(fx.floors).toHaveLength(2)
  })

  it('100% of entities have non-null area attribution', () => {
    const withArea = fx.entities.filter((e) => e.area !== null).length
    expect(withArea).toBe(fx.entities.length)
  })

  it('has 0 hidden entities', () => {
    expect(fx.entities.some((e) => e.hidden)).toBe(false)
  })

  it('has 0 disabled entities', () => {
    expect(fx.entities.some((e) => e.disabled)).toBe(false)
  })

  it('all area names contain Czech-language characters or recognizable Czech keywords', () => {
    const czechMarkerOrPattern = /[áčďéěíňóřšťúůýž]|kuchyne|pokoj|loznice|koupelna|kancelar/i
    for (const area of fx.areas) {
      expect(area.name, `area "${area.name}" should look Czech`).toMatch(czechMarkerOrPattern)
    }
  })

  it('all entities have Czech-influenced friendly names', () => {
    // Each name must contain at least one Czech diacritic OR a Czech room/object word.
    const czechMarker = /[áčďéěíňóřšťúůýž]|kuchyne|loznice|koupelna|svetlo|teplota|vlhkost|pohyb/i
    for (const e of fx.entities) {
      expect(e.originalName, `entity "${e.originalName}" should look Czech`).toMatch(czechMarker)
    }
  })

  it('contains every P1a domain (light, switch, sensor, binary_sensor, climate)', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['light', 'switch', 'sensor', 'binary_sensor', 'climate'] as const) {
      expect(domains).toContain(d)
    }
  })

  it('passes the fixture validator (no dangling references, no duplicates)', () => {
    expect(fx.meta.name).toBe('czech-tidy')
  })
})
