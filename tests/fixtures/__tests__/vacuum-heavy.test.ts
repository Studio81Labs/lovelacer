import { describe, it, expect } from 'vitest'
import { vacuumHeavy } from '../vacuum-heavy.js'

const fx = vacuumHeavy

describe('vacuum-heavy fixture', () => {
  it('has three rooms (areas)', () => {
    expect(fx.areas).toHaveLength(3)
  })

  it('has between 22 and 28 entities', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(22)
    expect(fx.entities.length).toBeLessThanOrEqual(28)
  })

  it('declares one floor (Ground)', () => {
    expect(fx.floors).toHaveLength(1)
    expect(fx.floors[0]!.name).toBe('Ground')
  })

  it('all expected area names present', () => {
    const names = fx.areas.map((a) => a.name)
    expect(names).toContain('Living Room')
    expect(names).toContain('Kitchen')
    expect(names).toContain('Hallway')
  })

  it('contains vacuum, light, sensor, binary_sensor domains', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['vacuum', 'light', 'sensor', 'binary_sensor'] as const) {
      expect(domains).toContain(d)
    }
  })

  it('has at least 4 vacuums', () => {
    const vacuums = fx.entities.filter((e) => e.domain === 'vacuum').length
    expect(vacuums).toBeGreaterThanOrEqual(4)
  })

  it('has at least 5 diagnostic sensors', () => {
    const diagnostic = fx.entities.filter((e) => e.entityCategory === 'diagnostic').length
    expect(diagnostic).toBeGreaterThanOrEqual(5)
  })

  it('has at least 1 hidden entity', () => {
    expect(fx.entities.some((e) => e.hidden)).toBe(true)
  })

  it('every entity referencing a device points at an existing device', () => {
    const deviceIds = new Set(fx.devices.map((d) => d.id))
    for (const e of fx.entities) {
      if (e.device !== null) {
        expect(deviceIds).toContain(e.device)
      }
    }
  })
})
