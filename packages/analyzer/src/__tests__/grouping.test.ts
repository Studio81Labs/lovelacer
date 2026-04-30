import { describe, it, expect } from 'vitest'
import type { NormalizedEntity } from '@lovelacer/shared'
import { domainGroup } from '../grouping.js'

const baseEntity: NormalizedEntity = {
  entityId: 'sensor.test',
  domain: 'sensor',
  objectId: 'test',
  friendlyName: 'Test',
  deviceClass: null,
  entityCategory: null,
  haAreaId: null,
  device: null,
  isHidden: false,
  isDisabled: false,
}

describe('domainGroup — routing', () => {
  it('routes light → lights', () => {
    expect(domainGroup({ ...baseEntity, domain: 'light' })).toBe('lights')
  })

  it('routes switch → lights', () => {
    expect(domainGroup({ ...baseEntity, domain: 'switch' })).toBe('lights')
  })

  it('routes climate → climate', () => {
    expect(domainGroup({ ...baseEntity, domain: 'climate' })).toBe('climate')
  })

  it('routes sensor with deviceClass=temperature → environment', () => {
    expect(
      domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: 'temperature' }),
    ).toBe('environment')
  })

  it('routes sensor with deviceClass=humidity → environment', () => {
    expect(
      domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: 'humidity' }),
    ).toBe('environment')
  })

  it('routes sensor with deviceClass=illuminance → other (not in P1a env filter)', () => {
    expect(
      domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: 'illuminance' }),
    ).toBe('other')
  })

  it('routes sensor with no deviceClass → other', () => {
    expect(domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: null })).toBe(
      'other',
    )
  })

  it('routes binary_sensor with deviceClass=motion → activity', () => {
    expect(
      domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'motion' }),
    ).toBe('activity')
  })

  it('routes binary_sensor with deviceClass=occupancy → activity', () => {
    expect(
      domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'occupancy' }),
    ).toBe('activity')
  })

  it('routes binary_sensor with deviceClass=door → activity', () => {
    expect(
      domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'door' }),
    ).toBe('activity')
  })

  it('routes binary_sensor with deviceClass=window → other (not in P1a activity filter)', () => {
    expect(
      domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'window' }),
    ).toBe('other')
  })

  it('routes binary_sensor with no deviceClass → other', () => {
    expect(
      domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: null }),
    ).toBe('other')
  })

  it('routes P1b-only domains → other (cover, media_player, lock, camera, vacuum, fan)', () => {
    for (const d of ['cover', 'media_player', 'lock', 'camera', 'vacuum', 'fan']) {
      expect(domainGroup({ ...baseEntity, domain: d })).toBe('other')
    }
  })

  it('routes unknown domain → other (e.g., lawn_mower)', () => {
    expect(domainGroup({ ...baseEntity, domain: 'lawn_mower' })).toBe('other')
  })

  it('routes diagnostic light → lights (entityCategory does not affect routing)', () => {
    expect(
      domainGroup({ ...baseEntity, domain: 'light', entityCategory: 'diagnostic' }),
    ).toBe('lights')
  })
})
