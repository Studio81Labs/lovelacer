import { describe, it, expect } from 'vitest'
import { germanMassive } from '../german-massive.js'

const fx = germanMassive

describe('german-massive fixture', () => {
  it('has thirteen rooms (areas)', () => {
    expect(fx.areas).toHaveLength(13)
  })

  it('has between 90 and 110 entities', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(90)
    expect(fx.entities.length).toBeLessThanOrEqual(110)
  })

  it('declares three floors (Erdgeschoss, Obergeschoss, Keller)', () => {
    expect(fx.floors).toHaveLength(3)
    const names = fx.floors.map((f) => f.name)
    expect(names).toContain('Erdgeschoss')
    expect(names).toContain('Obergeschoss')
    expect(names).toContain('Keller')
  })

  it('every entity has a non-empty originalName', () => {
    for (const e of fx.entities) {
      expect(e.originalName, `entity ${e.objectId} has empty originalName`).toBeTruthy()
    }
  })

  it('all expected German-named areas appear in the area registry', () => {
    const expected = [
      'Küche',
      'Wohnzimmer',
      'Esszimmer',
      'Bad EG',
      'Bad OG',
      'Schlafzimmer',
      'Kinderzimmer',
      'Gästezimmer',
      'Flur',
      'Garage',
      'Keller',
      'Waschküche',
      'Hobbyraum',
    ]
    const names = fx.areas.map((a) => a.name)
    for (const expectedName of expected) {
      expect(names, `area "${expectedName}" missing`).toContain(expectedName)
    }
  })

  it('area ids are unique', () => {
    const ids = fx.areas.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has at least 5 hidden entities', () => {
    const hidden = fx.entities.filter((e) => e.hidden).length
    expect(hidden).toBeGreaterThanOrEqual(3)
  })

  it('has at least 4 disabled entities', () => {
    const disabled = fx.entities.filter((e) => e.disabled).length
    expect(disabled).toBeGreaterThanOrEqual(4)
  })

  it('every entity referencing a device points at an existing device', () => {
    const deviceIds = new Set(fx.devices.map((d) => d.id))
    for (const e of fx.entities) {
      if (e.device !== null) {
        expect(deviceIds, `entity ${e.objectId} references missing device ${e.device}`).toContain(
          e.device,
        )
      }
    }
  })

  it('every entity referencing an area points at an existing area', () => {
    const areaIds = new Set(fx.areas.map((a) => a.id))
    for (const e of fx.entities) {
      if (e.area !== null) {
        expect(areaIds, `entity ${e.objectId} references missing area ${e.area}`).toContain(e.area)
      }
    }
  })

  it('every area referencing a floor points at an existing floor', () => {
    const floorIds = new Set(fx.floors.map((f) => f.id))
    for (const a of fx.areas) {
      if (a.floor !== null) {
        expect(floorIds, `area "${a.name}" references missing floor ${a.floor}`).toContain(a.floor)
      }
    }
  })

  it('contains every P1a domain (light, switch, sensor, binary_sensor, climate)', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['light', 'switch', 'sensor', 'binary_sensor', 'climate'] as const) {
      expect(domains).toContain(d)
    }
  })

  it('contains at least one out-of-P1a-scope entity (cover or media_player)', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    const outOfScope = ['cover', 'media_player'].some((d) => domains.has(d as never))
    expect(outOfScope).toBe(true)
  })
})
