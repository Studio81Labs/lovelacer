import { describe, it, expect } from 'vitest'
import { securityRich } from '../security-rich.js'

const fx = securityRich

describe('security-rich fixture', () => {
  it('has four rooms (areas)', () => {
    expect(fx.areas).toHaveLength(4)
  })

  it('has between 28 and 36 entities', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(28)
    expect(fx.entities.length).toBeLessThanOrEqual(36)
  })

  it('declares one floor (Ground)', () => {
    expect(fx.floors).toHaveLength(1)
    expect(fx.floors[0]!.name).toBe('Ground')
  })

  it('all expected security area names present', () => {
    const names = fx.areas.map((a) => a.name)
    expect(names).toContain('Front Entry')
    expect(names).toContain('Back Yard')
    expect(names).toContain('Garage')
    expect(names).toContain('Hallway')
  })

  it('contains lock, camera, cover, light, binary_sensor domains', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['lock', 'camera', 'cover', 'light', 'binary_sensor'] as const) {
      expect(domains).toContain(d)
    }
  })

  it('has at least 5 cameras', () => {
    const cameras = fx.entities.filter((e) => e.domain === 'camera').length
    expect(cameras).toBeGreaterThanOrEqual(5)
  })

  it('has at least 2 locks', () => {
    const locks = fx.entities.filter((e) => e.domain === 'lock').length
    expect(locks).toBeGreaterThanOrEqual(2)
  })

  it('has at least 1 hidden entity', () => {
    expect(fx.entities.some((e) => e.hidden)).toBe(true)
  })

  it('has at least 1 disabled entity', () => {
    expect(fx.entities.some((e) => e.disabled)).toBe(true)
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
