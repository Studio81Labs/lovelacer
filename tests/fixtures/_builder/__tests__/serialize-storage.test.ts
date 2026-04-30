import { describe, it, expect } from 'vitest'
import { serializeStorage, STORAGE_VERSIONS } from '../serialize-storage.js'
import type { Fixture } from '../types.js'

const FIXTURE: Fixture = {
  meta: { name: 'tiny', description: 'tiny test fixture' },
  floors: [{ id: 'ground', name: 'Ground', level: 0, icon: null }],
  areas: [{ id: 'living_room', name: 'Living Room', floor: 'ground', icon: 'mdi:sofa' }],
  devices: [
    {
      id: 'sensor_dev',
      name: 'Aqara TH',
      nameByUser: null,
      manufacturer: 'Aqara',
      model: 'WSDCGQ11LM',
      area: 'living_room',
    },
  ],
  entities: [
    {
      domain: 'sensor',
      objectId: 'living_room_temperature',
      uniqueId: 'tiny__sensor.living_room_temperature',
      originalName: 'Living Room Temperature',
      nameByUser: null,
      area: 'living_room',
      device: 'sensor_dev',
      deviceClass: 'temperature',
      entityCategory: null,
      hidden: false,
      disabled: false,
      templateState: '21.5',
    },
  ],
}

describe('serializeStorage', () => {
  it('returns four files keyed by HA storage key', () => {
    const out = serializeStorage(FIXTURE)
    expect(Object.keys(out).sort()).toEqual([
      'core.area_registry',
      'core.device_registry',
      'core.entity_registry',
      'core.floor_registry',
    ])
  })

  it('wraps each file in HA envelope shape', () => {
    const out = serializeStorage(FIXTURE)
    for (const [key, env] of Object.entries(out)) {
      expect(env.key).toBe(key)
      expect(env.version).toBe(STORAGE_VERSIONS[key as keyof typeof STORAGE_VERSIONS].version)
      expect(env.minor_version).toBe(
        STORAGE_VERSIONS[key as keyof typeof STORAGE_VERSIONS].minor_version,
      )
      expect(env.data).toBeDefined()
    }
  })

  it('serializes floor with id, name, level, icon, and v1.2 timestamps', () => {
    const out = serializeStorage(FIXTURE)
    const floors = out['core.floor_registry'].data as { floors: Record<string, unknown>[] }
    const f = floors.floors[0]!
    expect(f).toEqual(
      expect.objectContaining({ floor_id: 'ground', name: 'Ground', level: 0, icon: null }),
    )
    expect(typeof f['created_at']).toBe('string')
    expect(typeof f['modified_at']).toBe('string')
  })

  it('serializes area with id (v1.9), name, floor_id, icon', () => {
    const out = serializeStorage(FIXTURE)
    const areas = out['core.area_registry'].data as { areas: unknown[] }
    expect(areas.areas).toEqual([
      expect.objectContaining({
        // v1.9 renamed area_id → id
        id: 'living_room',
        name: 'Living Room',
        floor_id: 'ground',
        icon: 'mdi:sofa',
      }),
    ])
  })

  it('includes the v1.9 area fields HA expects (humidity/temperature entity refs, timestamps)', () => {
    const out = serializeStorage(FIXTURE)
    const areas = out['core.area_registry'].data as { areas: Record<string, unknown>[] }
    const area = areas.areas[0]!
    expect(area['humidity_entity_id']).toBeNull()
    expect(area['temperature_entity_id']).toBeNull()
    expect(typeof area['created_at']).toBe('string')
    expect(typeof area['modified_at']).toBe('string')
  })

  it('serializes device with id, name, manufacturer, model, area_id', () => {
    const out = serializeStorage(FIXTURE)
    const devices = out['core.device_registry'].data as { devices: unknown[] }
    expect(devices.devices).toEqual([
      expect.objectContaining({
        id: 'sensor_dev',
        name: 'Aqara TH',
        name_by_user: null,
        manufacturer: 'Aqara',
        model: 'WSDCGQ11LM',
        area_id: 'living_room',
      }),
    ])
  })

  it('includes v1.12 device fields HA expects (model_id, serial_number, primary_config_entry, config_entries_subentries, timestamps)', () => {
    const out = serializeStorage(FIXTURE)
    const devices = out['core.device_registry'].data as { devices: Record<string, unknown>[] }
    const device = devices.devices[0]!
    expect(device['model_id']).toBeNull()
    expect(device['serial_number']).toBeNull()
    expect(device['primary_config_entry']).toBeNull()
    expect(device['config_entries_subentries']).toEqual({})
    expect(typeof device['created_at']).toBe('string')
    expect(typeof device['modified_at']).toBe('string')
  })

  it('serializes entity with full registry shape', () => {
    const out = serializeStorage(FIXTURE)
    const entities = out['core.entity_registry'].data as { entities: unknown[] }
    expect(entities.entities).toEqual([
      expect.objectContaining({
        entity_id: 'sensor.living_room_temperature',
        unique_id: 'tiny__sensor.living_room_temperature',
        platform: 'lovelacer_fixture',
        name: null,
        original_name: 'Living Room Temperature',
        area_id: 'living_room',
        device_id: 'sensor_dev',
        device_class: 'temperature',
        entity_category: null,
        disabled_by: null,
        hidden_by: null,
      }),
    ])
  })

  it('includes v1.22 entity fields HA expects (id, aliases_v2, categories, timestamps, …)', () => {
    const out = serializeStorage(FIXTURE)
    const entities = out['core.entity_registry'].data as { entities: Record<string, unknown>[] }
    const e = entities.entities[0]!
    expect(typeof e['id']).toBe('string')
    expect((e['id'] as string).length).toBe(32) // md5 hex
    expect(e['aliases_v2']).toEqual([null])
    expect(e['categories']).toEqual({})
    expect(e['config_subentry_id']).toBeNull()
    expect(e['icon']).toBeNull()
    expect(e['original_icon']).toBeNull()
    expect(e['object_id_base']).toBeNull()
    expect(e['suggested_object_id']).toBeNull()
    expect(e['previous_unique_id']).toBeNull()
    expect(typeof e['created_at']).toBe('string')
    expect(typeof e['modified_at']).toBe('string')
  })

  it('derives entity `id` deterministically from entity_id', () => {
    const out1 = serializeStorage(FIXTURE)
    const out2 = serializeStorage(FIXTURE)
    const id1 = (out1['core.entity_registry'].data as { entities: { id: string }[] }).entities[0]!
      .id
    const id2 = (out2['core.entity_registry'].data as { entities: { id: string }[] }).entities[0]!
      .id
    expect(id1).toBe(id2)
  })

  it('reflects nameByUser into the registry `name` field', () => {
    const fx: Fixture = {
      ...FIXTURE,
      entities: [{ ...FIXTURE.entities[0]!, nameByUser: 'Couch Temp' }],
    }
    const out = serializeStorage(fx)
    const entities = out['core.entity_registry'].data as { entities: { name: unknown }[] }
    expect(entities.entities[0]!.name).toBe('Couch Temp')
  })

  it('reflects hidden=true as hidden_by="user"', () => {
    const fx: Fixture = {
      ...FIXTURE,
      entities: [{ ...FIXTURE.entities[0]!, hidden: true }],
    }
    const out = serializeStorage(fx)
    const entities = out['core.entity_registry'].data as { entities: { hidden_by: unknown }[] }
    expect(entities.entities[0]!.hidden_by).toBe('user')
  })

  it('reflects disabled=true as disabled_by="user"', () => {
    const fx: Fixture = {
      ...FIXTURE,
      entities: [{ ...FIXTURE.entities[0]!, disabled: true }],
    }
    const out = serializeStorage(fx)
    const entities = out['core.entity_registry'].data as { entities: { disabled_by: unknown }[] }
    expect(entities.entities[0]!.disabled_by).toBe('user')
  })
})
