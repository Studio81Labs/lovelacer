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
