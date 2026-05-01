import { describe, it, expect } from 'vitest'
import { kitchenSink } from '../kitchen-sink.js'

const fx = kitchenSink

describe('kitchen-sink fixture', () => {
  it('has four rooms (areas)', () => {
    expect(fx.areas).toHaveLength(4)
  })

  it('has between 28 and 38 entities', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(28)
    expect(fx.entities.length).toBeLessThanOrEqual(38)
  })

  it('declares one floor (Ground)', () => {
    expect(fx.floors).toHaveLength(1)
    expect(fx.floors[0]!.name).toBe('Ground')
  })

  it('all expected area names present', () => {
    const names = fx.areas.map((a) => a.name)
    expect(names).toContain('Living Room')
    expect(names).toContain('Master Bedroom')
    expect(names).toContain('Kitchen')
    expect(names).toContain('Front Door')
  })

  it('contains every P1b-2 new domain (cover, media_player, lock, camera, vacuum, fan)', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['cover', 'media_player', 'lock', 'camera', 'vacuum', 'fan'] as const) {
      expect(domains, `expected domain "${d}" in kitchen-sink fixture`).toContain(d)
    }
  })

  it('also contains the P1a domains (light, sensor, binary_sensor, switch)', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['light', 'sensor', 'binary_sensor', 'switch'] as const) {
      expect(domains).toContain(d)
    }
  })

  it('has at least 2 hidden entities', () => {
    const hidden = fx.entities.filter((e) => e.hidden).length
    expect(hidden).toBeGreaterThanOrEqual(2)
  })

  it('has at least 2 disabled entities', () => {
    const disabled = fx.entities.filter((e) => e.disabled).length
    expect(disabled).toBeGreaterThanOrEqual(2)
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
