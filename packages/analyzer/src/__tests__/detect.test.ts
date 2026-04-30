import { describe, it, expect } from 'vitest'
import type { HaAreaRegistryEntry, NormalizedEntity } from '@lovelacer/shared'
import { buildDetectionContext, detectEntity } from '../detect.js'

describe('buildDetectionContext', () => {
  it('returns an empty index for empty input', () => {
    const ctx = buildDetectionContext([])
    expect(ctx.areaIndex.size).toBe(0)
  })

  it('maps area whose name matches a canonical via findRoom', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'living_room', name: 'Living Room', floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    const entry = ctx.areaIndex.get('living_room')
    expect(entry).toBeDefined()
    expect(entry!.name).toBe('Living Room')
    expect(entry!.canonical).toBe('living_room')
  })

  it('maps Czech area name via diacritic-stripping pipeline', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'loznice', name: 'Ložnice', floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    const entry = ctx.areaIndex.get('loznice')
    expect(entry!.canonical).toBe('bedroom')
  })

  it('records canonical=null when area name does not map', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'barts_den', name: "Bart's Den", floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    const entry = ctx.areaIndex.get('barts_den')
    expect(entry).toBeDefined()
    expect(entry!.name).toBe("Bart's Den")
    expect(entry!.canonical).toBeNull()
  })

  it('builds one entry per input area', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'living_room', name: 'Living Room', floor_id: null, icon: null },
      { area_id: 'kitchen', name: 'Kitchen', floor_id: null, icon: null },
      { area_id: 'unknown', name: "Bart's Den", floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    expect(ctx.areaIndex.size).toBe(3)
  })
})

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

const livingRoomArea: HaAreaRegistryEntry = {
  area_id: 'living_room',
  name: 'Living Room',
  floor_id: null,
  icon: null,
}

const bartsAreaUnmappable: HaAreaRegistryEntry = {
  area_id: 'barts_den',
  name: "Bart's Den",
  floor_id: null,
  icon: null,
}

describe('detectEntity — fallback', () => {
  it('returns roomId=misc with confidence 0 and no signals when nothing fires', () => {
    const ctx = buildDetectionContext([])
    const result = detectEntity(baseEntity, ctx)
    expect(result.entityId).toBe('sensor.test')
    expect(result.roomId).toBe('misc')
    expect(result.confidence).toBe(0)
    expect(result.signals).toEqual([])
  })
})

describe('detectEntity — priority 1 (entity_area)', () => {
  const ctx = buildDetectionContext([livingRoomArea, bartsAreaUnmappable])

  it('fires with weight 1.0 when entity area name maps to a canonical', () => {
    const result = detectEntity({ ...baseEntity, haAreaId: 'living_room' }, ctx)
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0)
    expect(result.signals).toContainEqual({
      source: 'entity_area',
      weight: 1.0,
      matchedValue: 'Living Room',
    })
  })

  it('does NOT fire when entity area name does not map (canonical=null)', () => {
    const result = detectEntity({ ...baseEntity, haAreaId: 'barts_den' }, ctx)
    expect(result.signals.find((s) => s.source === 'entity_area')).toBeUndefined()
    expect(result.roomId).toBe('misc')
  })

  it('does NOT fire when entity area is absent from the index', () => {
    const result = detectEntity({ ...baseEntity, haAreaId: 'nonexistent' }, ctx)
    expect(result.signals.find((s) => s.source === 'entity_area')).toBeUndefined()
    expect(result.roomId).toBe('misc')
  })

  it('does NOT fire when haAreaId is null', () => {
    const result = detectEntity({ ...baseEntity, haAreaId: null }, ctx)
    expect(result.signals.find((s) => s.source === 'entity_area')).toBeUndefined()
  })
})

describe('detectEntity — priority 2 (device_area)', () => {
  const ctx = buildDetectionContext([livingRoomArea])

  it('fires with weight 0.85 when device.haAreaId maps and entity has no own area', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: null,
        device: {
          id: 'dev1',
          name: 'Sensor',
          nameByUser: null,
          manufacturer: null,
          model: null,
          haAreaId: 'living_room',
        },
      },
      ctx,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(0.85)
    expect(result.signals).toContainEqual({
      source: 'device_area',
      weight: 0.85,
      matchedValue: 'Living Room',
    })
  })

  it('does NOT fire when entity.device is null', () => {
    const result = detectEntity({ ...baseEntity, device: null }, ctx)
    expect(result.signals.find((s) => s.source === 'device_area')).toBeUndefined()
  })

  it('does NOT fire when device.haAreaId is null', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        device: {
          id: 'dev1',
          name: 'Sensor',
          nameByUser: null,
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctx,
    )
    expect(result.signals.find((s) => s.source === 'device_area')).toBeUndefined()
  })
})
