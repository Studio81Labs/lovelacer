import { describe, it, expect } from 'vitest'
import type { HaDeviceRegistryEntry, HaEntityRegistryEntry } from '@lovelacer/shared'
import { normalize } from '../normalize.js'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'

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

  it('handles digits and mixed-length tokens in humanize', () => {
    const [r] = normalize({
      entities: [e({ entity_id: 'sensor.aqara_th_158d', name: null, original_name: null })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Aqara Th 158d')
  })

  it('collapses consecutive underscores in humanize', () => {
    const [r] = normalize({
      entities: [e({ entity_id: 'sensor.aqara__th', name: null, original_name: null })],
      devices: [],
    })
    expect(r!.friendlyName).toBe('Aqara Th')
  })
})

describe('normalize — device attachment', () => {
  const dev: HaDeviceRegistryEntry = {
    id: 'aqara_th_1',
    name: 'Aqara TH',
    name_by_user: 'Couch Sensor',
    manufacturer: 'Aqara',
    model: 'WSDCGQ11LM',
    area_id: 'kitchen',
  }

  it('attaches a NormalizedDevice when entity.device_id resolves', () => {
    const [r] = normalize({
      entities: [{ ...baseEntity, device_id: 'aqara_th_1' }],
      devices: [dev],
    })
    expect(r!.device).toEqual({
      id: 'aqara_th_1',
      name: 'Aqara TH',
      nameByUser: 'Couch Sensor',
      manufacturer: 'Aqara',
      model: 'WSDCGQ11LM',
      haAreaId: 'kitchen',
    })
  })

  it('sets device to null when entity.device_id is null', () => {
    const [r] = normalize({
      entities: [{ ...baseEntity, device_id: null }],
      devices: [dev],
    })
    expect(r!.device).toBeNull()
  })

  it('sets device to null when entity.device_id has no matching device', () => {
    const [r] = normalize({
      entities: [{ ...baseEntity, device_id: 'nonexistent_device' }],
      devices: [dev],
    })
    expect(r!.device).toBeNull()
  })

  it('does NOT propagate device area to entity.haAreaId', () => {
    // Entity has no area_id; device has kitchen. haAreaId on the entity must
    // remain null — area inheritance is the detection chain's job, not ours.
    const [r] = normalize({
      entities: [{ ...baseEntity, area_id: null, device_id: 'aqara_th_1' }],
      devices: [dev],
    })
    expect(r!.haAreaId).toBeNull()
    expect(r!.device?.haAreaId).toBe('kitchen')
  })

  it('drops devices that no entity references (anti-leak)', () => {
    const orphan: HaDeviceRegistryEntry = { ...dev, id: 'orphan_device' }
    const out = normalize({
      entities: [{ ...baseEntity, device_id: 'aqara_th_1' }],
      devices: [dev, orphan],
    })
    // The only way to surface a device is via entity.device. The orphan must
    // never appear there.
    const deviceIds = out.map((e) => e.device?.id).filter((id): id is string => id !== undefined)
    expect(deviceIds).not.toContain('orphan_device')
  })
})

describe('normalize — error handling', () => {
  it('throws when entity_id has no dot separator', () => {
    expect(() =>
      normalize({
        entities: [{ ...baseEntity, entity_id: 'malformed_no_dot' }],
        devices: [],
      }),
    ).toThrow(/malformed_no_dot/)
  })

  it('throws on empty entity_id', () => {
    expect(() =>
      normalize({
        entities: [{ ...baseEntity, entity_id: '' }],
        devices: [],
      }),
    ).toThrow(/entity_id/i)
  })

  it('throws on leading dot (.foo)', () => {
    expect(() =>
      normalize({
        entities: [{ ...baseEntity, entity_id: '.sensor' }],
        devices: [],
      }),
    ).toThrow(/\.sensor/)
  })

  it('throws on trailing dot (foo.)', () => {
    expect(() =>
      normalize({
        entities: [{ ...baseEntity, entity_id: 'sensor.' }],
        devices: [],
      }),
    ).toThrow(/sensor\./)
  })
})

describe('normalize — english-cluttered fixture (integration)', () => {
  const ha = fixtureToHaRegistries(englishCluttered)
  const result = normalize({ entities: ha.entities, devices: ha.devices })

  it('does not throw on the full fixture', () => {
    expect(() => normalize({ entities: ha.entities, devices: ha.devices })).not.toThrow()
  })

  it('produces one NormalizedEntity per fixture entity', () => {
    expect(result).toHaveLength(englishCluttered.entities.length)
  })

  it('isDisabled count matches the fixture', () => {
    const expected = englishCluttered.entities.filter((e) => e.disabled).length
    const actual = result.filter((e) => e.isDisabled).length
    expect(actual).toBe(expected)
  })

  it('isHidden count matches the fixture', () => {
    const expected = englishCluttered.entities.filter((e) => e.hidden).length
    const actual = result.filter((e) => e.isHidden).length
    expect(actual).toBe(expected)
  })

  it('diagnostic-category count matches the fixture', () => {
    const expected = englishCluttered.entities.filter(
      (e) => e.entityCategory === 'diagnostic',
    ).length
    const actual = result.filter((e) => e.entityCategory === 'diagnostic').length
    expect(actual).toBe(expected)
  })

  it('attaches a device on at least one entity and leaves at least one without', () => {
    expect(result.some((e) => e.device !== null)).toBe(true)
    expect(result.some((e) => e.device === null)).toBe(true)
  })

  it('preserves entity haAreaId without device-area inheritance', () => {
    // Find an entity with no entity-level area but a device that does.
    const interesting = result.find(
      (e) => e.haAreaId === null && e.device !== null && e.device.haAreaId !== null,
    )
    expect(interesting).toBeDefined()
    expect(interesting!.haAreaId).toBeNull()
    expect(interesting!.device!.haAreaId).not.toBeNull()
  })
})
