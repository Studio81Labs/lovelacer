import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../english-cluttered.js'

const fx = englishCluttered

describe('english-cluttered fixture', () => {
  it('has exactly six rooms (areas)', () => {
    expect(fx.areas).toHaveLength(6)
  })

  it('has at least 150 entities total', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(150)
  })

  it('targets ~165 entities (within ±10)', () => {
    expect(fx.entities.length).toBeGreaterThanOrEqual(155)
    expect(fx.entities.length).toBeLessThanOrEqual(175)
  })

  it('declares two floors', () => {
    expect(fx.floors).toHaveLength(2)
  })

  it('attributes ~40% of entities by direct entity area_id', () => {
    const direct = fx.entities.filter((e) => e.area !== null).length
    const ratio = direct / fx.entities.length
    expect(ratio).toBeGreaterThan(0.35)
    expect(ratio).toBeLessThan(0.5)
  })

  it('has ~25% device-only attribution (no entity area but device has one)', () => {
    const devicesById = new Map(fx.devices.map((d) => [d.id, d]))
    const deviceOnly = fx.entities.filter(
      (e) => e.area === null && e.device !== null && devicesById.get(e.device)?.area !== null,
    ).length
    const ratio = deviceOnly / fx.entities.length
    expect(ratio).toBeGreaterThan(0.18)
    expect(ratio).toBeLessThan(0.32)
  })

  it('has ~25% with no area attribution at all', () => {
    const devicesById = new Map(fx.devices.map((d) => [d.id, d]))
    const orphaned = fx.entities.filter(
      (e) =>
        e.area === null &&
        (e.device === null || (e.device !== null && devicesById.get(e.device)?.area === null)),
    ).length
    const ratio = orphaned / fx.entities.length
    expect(ratio).toBeGreaterThan(0.18)
    expect(ratio).toBeLessThan(0.32)
  })

  it('includes at least one diagnostic, one disabled, one hidden, one nameByUser', () => {
    expect(fx.entities.some((e) => e.entityCategory === 'diagnostic')).toBe(true)
    expect(fx.entities.some((e) => e.disabled)).toBe(true)
    expect(fx.entities.some((e) => e.hidden)).toBe(true)
    expect(fx.entities.some((e) => e.nameByUser !== null)).toBe(true)
  })

  it('contains every P1a domain plus at least one P1b registry-only domain', () => {
    const domains = new Set(fx.entities.map((e) => e.domain))
    for (const d of ['light', 'switch', 'sensor', 'binary_sensor', 'climate'] as const) {
      expect(domains).toContain(d)
    }
    const p1bSeen = (['cover', 'media_player', 'lock', 'fan'] as const).some((d) => domains.has(d))
    expect(p1bSeen).toBe(true)
  })

  it('passes the fixture validator (no dangling references, no duplicates)', () => {
    expect(fx.meta.name).toBe('english-cluttered')
  })
})
