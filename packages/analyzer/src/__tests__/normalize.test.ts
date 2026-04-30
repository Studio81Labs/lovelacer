import { describe, it, expect } from 'vitest'
import type { HaEntityRegistryEntry } from '@lovelacer/shared'
import { normalize } from '../normalize.js'

const baseEntity: HaEntityRegistryEntry = {
  entity_id: 'sensor.living_room_temperature',
  name: 'Living Room Temperature',
  original_name: 'Temperature',
  area_id: 'living_room',
  device_id: null,
  platform: 'lovelacer_fixture',
  hidden_by: null,
  disabled_by: null,
  entity_category: null,
  device_class: 'temperature',
}

describe('normalize — entity passthrough fields', () => {
  it('returns one NormalizedEntity per input entity', () => {
    const out = normalize({ entities: [baseEntity], devices: [] })
    expect(out).toHaveLength(1)
  })

  it('passes through entityId, domain, objectId', () => {
    const [e] = normalize({ entities: [baseEntity], devices: [] })
    expect(e!.entityId).toBe('sensor.living_room_temperature')
    expect(e!.domain).toBe('sensor')
    expect(e!.objectId).toBe('living_room_temperature')
  })

  it('passes through deviceClass, entityCategory, haAreaId', () => {
    const [e] = normalize({
      entities: [{ ...baseEntity, entity_category: 'diagnostic' }],
      devices: [],
    })
    expect(e!.deviceClass).toBe('temperature')
    expect(e!.entityCategory).toBe('diagnostic')
    expect(e!.haAreaId).toBe('living_room')
  })

  it('reflects hidden_by and disabled_by as boolean flags', () => {
    const out = normalize({
      entities: [
        { ...baseEntity, entity_id: 'sensor.a', hidden_by: 'user', disabled_by: null },
        { ...baseEntity, entity_id: 'sensor.b', hidden_by: null, disabled_by: 'integration' },
        { ...baseEntity, entity_id: 'sensor.c', hidden_by: null, disabled_by: null },
      ],
      devices: [],
    })
    expect(out[0]!.isHidden).toBe(true)
    expect(out[0]!.isDisabled).toBe(false)
    expect(out[1]!.isHidden).toBe(false)
    expect(out[1]!.isDisabled).toBe(true)
    expect(out[2]!.isHidden).toBe(false)
    expect(out[2]!.isDisabled).toBe(false)
  })

  it('returns empty array for empty input', () => {
    expect(normalize({ entities: [], devices: [] })).toEqual([])
  })
})

describe('normalize — friendlyName resolution', () => {
  const e = (overrides: Partial<HaEntityRegistryEntry>): HaEntityRegistryEntry => ({
    ...baseEntity,
    entity_id: 'sensor.living_room_temperature',
    name: null,
    original_name: null,
    ...overrides,
  })

  it('uses entity.name when set', () => {
    const [r] = normalize({
      entities: [e({ name: 'Couch Temp', original_name: 'Temperature' })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Couch Temp')
  })

  it('falls back to entity.original_name when name is null', () => {
    const [r] = normalize({
      entities: [e({ name: null, original_name: 'Temperature' })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Temperature')
  })

  it('falls back to humanized objectId when both are null', () => {
    const [r] = normalize({
      entities: [e({ name: null, original_name: null })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Living Room Temperature')
  })

  it('humanizes single-word objectIds', () => {
    const [r] = normalize({
      entities: [e({ entity_id: 'sensor.kitchen', name: null, original_name: null })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Kitchen')
  })

  it('handles digits and consecutive underscores in humanize', () => {
    const [r] = normalize({
      entities: [e({ entity_id: 'sensor.aqara_th_158d', name: null, original_name: null })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Aqara Th 158d')
  })
})
