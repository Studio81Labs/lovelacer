import { describe, it, expect } from 'vitest'
import type { NormalizedEntity, RoomAssignment } from '@lovelacer/shared'
import { domainGroup, groupByDomain } from '../grouping.js'

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

const ent = (
  id: string,
  overrides: Partial<NormalizedEntity> = {},
): NormalizedEntity => ({
  ...baseEntity,
  entityId: id,
  domain: id.split('.')[0]!,
  objectId: id.split('.')[1]!,
  ...overrides,
})

const assignment = (entityId: string, roomId: string): RoomAssignment => ({
  entityId,
  roomId: roomId as RoomAssignment['roomId'],
  confidence: 1.0,
  signals: [],
})

describe('groupByDomain — orchestration', () => {
  it('returns empty array for empty input', () => {
    expect(groupByDomain({ assignments: [], entities: [] })).toEqual([])
  })

  it('produces one room with one group containing the single entity', () => {
    const e = ent('light.kitchen_ceiling', { friendlyName: 'Kitchen Ceiling' })
    const result = groupByDomain({
      assignments: [assignment('light.kitchen_ceiling', 'kitchen')],
      entities: [e],
    })
    expect(result).toEqual([
      {
        roomId: 'kitchen',
        groups: [{ key: 'lights', entities: [e] }],
      },
    ])
  })

  it('drops hidden entities', () => {
    const e = ent('light.kitchen_ceiling', { isHidden: true })
    const result = groupByDomain({
      assignments: [assignment('light.kitchen_ceiling', 'kitchen')],
      entities: [e],
    })
    expect(result).toEqual([])
  })

  it('drops disabled entities', () => {
    const e = ent('light.kitchen_ceiling', { isDisabled: true })
    const result = groupByDomain({
      assignments: [assignment('light.kitchen_ceiling', 'kitchen')],
      entities: [e],
    })
    expect(result).toEqual([])
  })

  it('preserves diagnostic entities in their natural group', () => {
    const e = ent('sensor.aqara_battery', {
      friendlyName: 'Aqara Battery',
      deviceClass: 'battery',
      entityCategory: 'diagnostic',
    })
    const result = groupByDomain({
      assignments: [assignment('sensor.aqara_battery', 'kitchen')],
      entities: [e],
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.groups[0]!.key).toBe('other') // battery deviceClass not in env filter
    expect(result[0]!.groups[0]!.entities[0]!.entityCategory).toBe('diagnostic')
  })

  it('drops empty groups (room with only lights → output has only lights group)', () => {
    const result = groupByDomain({
      assignments: [assignment('light.a', 'kitchen')],
      entities: [ent('light.a', { friendlyName: 'A' })],
    })
    expect(result[0]!.groups.map((g) => g.key)).toEqual(['lights'])
  })

  it('orders rooms lexicographically by roomId', () => {
    const result = groupByDomain({
      assignments: [
        assignment('light.a', 'kitchen'),
        assignment('light.b', 'bedroom'),
        assignment('light.c', 'living_room'),
      ],
      entities: [
        ent('light.a', { friendlyName: 'A' }),
        ent('light.b', { friendlyName: 'B' }),
        ent('light.c', { friendlyName: 'C' }),
      ],
    })
    expect(result.map((r) => r.roomId)).toEqual(['bedroom', 'kitchen', 'living_room'])
  })

  it('orders groups within a room via GROUP_ORDER (lights, climate, activity, environment, other)', () => {
    const result = groupByDomain({
      assignments: [
        assignment('binary_sensor.m', 'kitchen'),
        assignment('sensor.t', 'kitchen'),
        assignment('climate.c', 'kitchen'),
        assignment('light.l', 'kitchen'),
        assignment('cover.x', 'kitchen'),
      ],
      entities: [
        ent('binary_sensor.m', { friendlyName: 'M', deviceClass: 'motion' }),
        ent('sensor.t', { friendlyName: 'T', deviceClass: 'temperature' }),
        ent('climate.c', { friendlyName: 'C' }),
        ent('light.l', { friendlyName: 'L' }),
        ent('cover.x', { friendlyName: 'X' }),
      ],
    })
    expect(result[0]!.groups.map((g) => g.key)).toEqual([
      'lights',
      'climate',
      'activity',
      'environment',
      'other',
    ])
  })

  it('places `other` last when populated', () => {
    const result = groupByDomain({
      assignments: [
        assignment('cover.x', 'kitchen'),
        assignment('light.l', 'kitchen'),
      ],
      entities: [
        ent('cover.x', { friendlyName: 'X' }),
        ent('light.l', { friendlyName: 'L' }),
      ],
    })
    expect(result[0]!.groups.map((g) => g.key)).toEqual(['lights', 'other'])
  })

  it('sorts entities within a group alphabetically by friendlyName, case-insensitive', () => {
    const result = groupByDomain({
      assignments: [
        assignment('light.banana', 'kitchen'),
        assignment('light.apple', 'kitchen'),
        assignment('light.cherry', 'kitchen'),
      ],
      entities: [
        ent('light.banana', { friendlyName: 'Banana' }),
        ent('light.apple', { friendlyName: 'apple' }),
        ent('light.cherry', { friendlyName: 'cherry' }),
      ],
    })
    expect(result[0]!.groups[0]!.entities.map((e) => e.friendlyName)).toEqual([
      'apple',
      'Banana',
      'cherry',
    ])
  })

  it('silently skips assignments referencing entities not in the input', () => {
    const result = groupByDomain({
      assignments: [
        assignment('light.real', 'kitchen'),
        assignment('light.ghost', 'kitchen'),
      ],
      entities: [ent('light.real', { friendlyName: 'Real' })],
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.groups[0]!.entities).toHaveLength(1)
    expect(result[0]!.groups[0]!.entities[0]!.entityId).toBe('light.real')
  })

  it('handles empty entities with non-empty assignments → empty output', () => {
    const result = groupByDomain({
      assignments: [assignment('light.a', 'kitchen')],
      entities: [],
    })
    expect(result).toEqual([])
  })
})
