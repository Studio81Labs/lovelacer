import { describe, it, expect, vi } from 'vitest'
import type { HaAreaRegistryEntry, NormalizedEntity } from '@lovelacer/shared'
import { buildDetectionContext, detect, detectAsync, detectEntity } from '../detect.js'

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

describe('detectEntity — priority 3 (friendly_name)', () => {
  const ctx = buildDetectionContext([])

  it('fires with weight 0.6 when findRoom matches the friendly name', () => {
    const result = detectEntity({ ...baseEntity, friendlyName: 'Living Room Light' }, ctx)
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(0.6)
    expect(result.signals).toContainEqual(
      expect.objectContaining({
        source: 'friendly_name',
        weight: 0.6,
      }),
    )
  })

  it('does NOT fire when friendly name has no canonical match', () => {
    const result = detectEntity({ ...baseEntity, friendlyName: 'random gibberish' }, ctx)
    expect(result.signals.find((s) => s.source === 'friendly_name')).toBeUndefined()
  })
})

describe('detectEntity — priority 4 (entity_id)', () => {
  const ctx = buildDetectionContext([])

  it('fires with weight 0.5 when findRoom matches the objectId', () => {
    const result = detectEntity(
      { ...baseEntity, friendlyName: 'Sensor 4', objectId: 'kitchen_temp_4' },
      ctx,
    )
    const sig = result.signals.find((s) => s.source === 'entity_id')
    expect(sig).toBeDefined()
    expect(sig!.weight).toBe(0.5)
    // friendly_name doesn't match "Sensor 4", so entity_id is the highest-weight signal
    expect(result.roomId).toBe('kitchen')
  })
})

describe('detectEntity — priority 5 (device_name)', () => {
  const ctx = buildDetectionContext([])

  it('fires with weight 0.45 from device.nameByUser when set', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        friendlyName: 'Sensor',
        device: {
          id: 'dev1',
          name: 'Generic Device',
          nameByUser: 'Bedroom Sensor Hub',
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctx,
    )
    expect(result.signals).toContainEqual(
      expect.objectContaining({
        source: 'device_name',
        weight: 0.45,
      }),
    )
    expect(result.roomId).toBe('bedroom')
  })

  it('falls back to device.name when nameByUser is null', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        friendlyName: 'Sensor',
        device: {
          id: 'dev1',
          name: 'Bathroom Aqara TH',
          nameByUser: null,
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctx,
    )
    const sig = result.signals.find((s) => s.source === 'device_name')
    expect(sig).toBeDefined()
    expect(result.roomId).toBe('bathroom')
  })

  it('does NOT fire when device is null', () => {
    const result = detectEntity({ ...baseEntity, device: null }, ctx)
    expect(result.signals.find((s) => s.source === 'device_name')).toBeUndefined()
  })

  it('prefers nameByUser over name when both have canonical matches', () => {
    // nameByUser says bedroom; name says bathroom. nameByUser wins.
    const result = detectEntity(
      {
        ...baseEntity,
        friendlyName: 'Sensor',
        device: {
          id: 'dev1',
          name: 'Bathroom Aqara TH',
          nameByUser: 'Bedroom Sensor Hub',
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctx,
    )
    expect(result.roomId).toBe('bedroom')
  })
})

describe('detectEntity — multi-signal aggregation', () => {
  const ctx = buildDetectionContext([livingRoomArea])

  it('records all fired signals when multiple priorities match the same room', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Living Room Light',
        objectId: 'living_room_light',
      },
      ctx,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0) // highest weight wins
    const sources = result.signals.map((s) => s.source).sort()
    expect(sources).toEqual(['entity_area', 'entity_id', 'friendly_name'])
  })

  it('picks the highest-weight target when priorities point to different rooms', () => {
    // Priority 1 (1.0) says living_room; priority 3 (0.6) says kitchen.
    // Priority 1 wins as roomId; both signals stay in `signals[]`.
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Kitchen Light',
      },
      ctx,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0)
    expect(result.signals.map((s) => s.source).sort()).toEqual(['entity_area', 'friendly_name'])
  })
})

describe('detect — bulk API', () => {
  it('returns empty array for empty input', () => {
    const result = detect({ entities: [], areas: [] })
    expect(result).toEqual([])
  })

  it('produces one assignment per input entity, preserving order', () => {
    const livingRoomAreaForBulk: HaAreaRegistryEntry = {
      area_id: 'living_room',
      name: 'Living Room',
      floor_id: null,
      icon: null,
    }
    const entities: NormalizedEntity[] = [
      { ...baseEntity, entityId: 'sensor.a', haAreaId: 'living_room' },
      { ...baseEntity, entityId: 'sensor.b', friendlyName: 'Kitchen Light' },
      { ...baseEntity, entityId: 'sensor.c' }, // no signals
    ]
    const result = detect({ entities, areas: [livingRoomAreaForBulk] })
    expect(result.map((r) => r.entityId)).toEqual(['sensor.a', 'sensor.b', 'sensor.c'])
    expect(result[0]!.roomId).toBe('living_room')
    expect(result[1]!.roomId).toBe('kitchen')
    expect(result[2]!.roomId).toBe('misc')
  })
})

describe('detect — authoritative HA area fast path', () => {
  const ctx = buildDetectionContext([livingRoomArea])

  it('skips slower name fallbacks after an entity_area match when requested', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Kitchen Light',
        objectId: 'bedroom_lamp',
      },
      ctx,
      { authoritativeHaAreas: true },
    )

    expect(result.roomId).toBe('living_room')
    expect(result.signals).toEqual([
      { source: 'entity_area', weight: 1.0, matchedValue: 'Living Room' },
    ])
    expect(result.alternatives).toBeUndefined()
  })

  it('keeps name fallback behavior when no HA area matches', () => {
    const result = detectEntity(
      {
        ...baseEntity,
        friendlyName: 'Kitchen Light',
        objectId: 'bedroom_lamp',
      },
      ctx,
      { authoritativeHaAreas: true },
    )

    expect(result.roomId).toBe('kitchen')
    expect(result.signals.map((s) => s.source)).toContain('friendly_name')
  })

  it('detectAsync yields batched progress while preserving assignment order', async () => {
    const logger = { info: vi.fn() }
    const entities: NormalizedEntity[] = [
      { ...baseEntity, entityId: 'sensor.a', haAreaId: 'living_room' },
      { ...baseEntity, entityId: 'sensor.b', friendlyName: 'Kitchen Light' },
      { ...baseEntity, entityId: 'sensor.c' },
    ]

    const result = await detectAsync(
      { entities, areas: [livingRoomArea] },
      { authoritativeHaAreas: true, logger, batchSize: 2 },
    )

    expect(result.map((r) => r.entityId)).toEqual(['sensor.a', 'sensor.b', 'sensor.c'])
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'detect', index: 0, total: 3, entityId: 'sensor.a' }),
      'detect progress',
    )
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'detect', index: 2, total: 3, entityId: 'sensor.c' }),
      'detect progress',
    )
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'detect', index: 3, total: 3 }),
      'detect progress',
    )
  })
})

describe('detectEntity — alternatives (P2-5 top-N)', () => {
  // ctx has four areas: kitchen, living_room, bedroom (all mapping to canonical),
  // and barts_den (canonical=null). 'bathroom' is not an HA area here but
  // device_name matching works via findRoom on the name string alone.
  const ctx = buildDetectionContext([
    { area_id: 'kitchen', name: 'Kitchen', floor_id: null, icon: null },
    { area_id: 'living_room', name: 'Living Room', floor_id: null, icon: null },
    { area_id: 'bedroom', name: 'Bedroom', floor_id: null, icon: null },
    { area_id: 'barts_den', name: "Bart's Den", floor_id: null, icon: null },
  ])

  it('omits alternatives entirely when only one target fired', () => {
    const result = detectEntity({ ...baseEntity, haAreaId: 'living_room' }, ctx)
    expect(result.roomId).toBe('living_room')
    expect(result.alternatives).toBeUndefined()
  })

  it('emits alternatives sorted by score descending, excluding the winner', () => {
    // entity_area for kitchen (weight 1.0) wins.
    // friendly_name "Living Room" fires (weight 0.6) → living_room alternative.
    // entity_id "bedroom_lamp" fires (weight 0.5) → bedroom alternative.
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'kitchen',
        friendlyName: 'Living Room Light',
        objectId: 'bedroom_lamp',
      },
      ctx,
    )
    expect(result.roomId).toBe('kitchen')
    expect(result.alternatives).toEqual([
      { roomId: 'living_room', confidence: 0.6 },
      { roomId: 'bedroom', confidence: 0.5 },
    ])
  })

  it('caps alternatives at 2 entries even when more candidates score above threshold', () => {
    // entity_area for kitchen wins (1.0).
    // friendly_name match → living_room (0.6).
    // entity_id match → bedroom (0.5).
    // device_name match → bathroom (0.45).
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'kitchen',
        friendlyName: 'Living Room Light',
        objectId: 'bedroom_lamp',
        device: {
          id: 'd1',
          name: 'Bathroom Hub',
          nameByUser: null,
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctx,
    )
    expect(result.alternatives).toHaveLength(2)
    expect(result.alternatives?.[0]?.roomId).toBe('living_room')
    expect(result.alternatives?.[1]?.roomId).toBe('bedroom')
  })
})

describe('detectEntity — language filter (P2-6)', () => {
  // Priorities 3-5 narrow when `language` is set on the context.
  // Priorities 1-2 (entity_area, device_area) ignore the language and
  // always match against all keyword sets via buildDetectionContext.

  it('omits priority-3 friendly_name match when language=cs and name is English-only', () => {
    // 'Living Room Light' is matched by EN keywords only, not CS.
    const ctx = buildDetectionContext([], { language: 'cs' })
    const result = detectEntity({ ...baseEntity, friendlyName: 'Living Room Light' }, ctx)
    expect(result.roomId).toBe('misc')
    expect(result.signals).toEqual([])
  })

  it('keeps priority-3 friendly_name match when language=auto / undefined', () => {
    const ctx = buildDetectionContext([], {}) // language undefined
    const result = detectEntity({ ...baseEntity, friendlyName: 'Living Room Light' }, ctx)
    expect(result.roomId).toBe('living_room')
    expect(result.signals[0]?.source).toBe('friendly_name')
  })

  it('keeps priority-1 entity_area match even when language is narrow', () => {
    // The HA area "Living Room" should still match via priority 1
    // regardless of the user's language pick — area names are
    // multilingual by construction.
    const ctx = buildDetectionContext(
      [{ area_id: 'a1', name: 'Living Room', floor_id: null, icon: null }],
      {
        language: 'cs',
      },
    )
    const result = detectEntity({ ...baseEntity, haAreaId: 'a1' }, ctx)
    expect(result.roomId).toBe('living_room')
    expect(result.signals[0]?.source).toBe('entity_area')
  })

  it('detect() forwards language to the context (regression: undefined still works)', () => {
    const result = detect({
      entities: [{ ...baseEntity, friendlyName: 'Kitchen' }],
      areas: [],
      // language omitted entirely — match-all baseline preserved
    })
    expect(result[0]?.roomId).toBe('kitchen')
  })

  it('detect() with language=cs suppresses EN-only friendly_name matches', () => {
    const result = detect({
      entities: [{ ...baseEntity, friendlyName: 'Kitchen Light' }],
      areas: [],
      language: 'cs',
    })
    expect(result[0]?.roomId).toBe('misc')
  })
})

describe('detectEntity — corroboration boost', () => {
  const livingRoomAreaForBoost: HaAreaRegistryEntry = {
    area_id: 'living_room',
    name: 'Living Room',
    floor_id: null,
    icon: null,
  }
  const ctxLR = buildDetectionContext([livingRoomAreaForBoost])
  const ctxNoAreas = buildDetectionContext([])

  it('1 signal → no boost (confidence equals base weight)', () => {
    const result = detectEntity({ ...baseEntity, friendlyName: 'Kitchen Light' }, ctxNoAreas)
    expect(result.confidence).toBe(0.6)
  })

  it('2 corroborators (same target) → +0.05', () => {
    // friendly_name (0.6) → kitchen, entity_id (0.5) → kitchen.
    // Both point to kitchen. Corroboration count = 2 → boost 0.05 → confidence 0.65.
    const result = detectEntity(
      { ...baseEntity, friendlyName: 'Kitchen Light', objectId: 'kitchen_light' },
      ctxNoAreas,
    )
    expect(result.roomId).toBe('kitchen')
    expect(result.confidence).toBeCloseTo(0.65, 5)
  })

  it('3 corroborators (same target) → +0.10, capped at 1.0', () => {
    // entity_area (1.0) + friendly_name (0.6) + entity_id (0.5), all → living_room.
    // Boost would be 0.10 → 1.0 + 0.10 = 1.10 → capped to 1.0.
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Living Room Light',
        objectId: 'living_room_light',
      },
      ctxLR,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0)
    expect(result.signals.length).toBe(3)
  })

  it('4 corroborators stay at +0.10 (boost cap holds)', () => {
    // entity_area + friendly_name + entity_id + device_name, all → living_room.
    // Boost would naively be (4-1)*0.05 = 0.15 → capped to 0.10.
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Living Room Light',
        objectId: 'living_room_light',
        device: {
          id: 'dev1',
          name: 'Living Room Hub',
          nameByUser: null,
          manufacturer: null,
          model: null,
          haAreaId: null,
        },
      },
      ctxLR,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0) // 1.0 + 0.10 = 1.10, capped at 1.0
    expect(result.signals.length).toBe(4)
  })

  it('different-target signals do NOT boost the winner', () => {
    // entity_area → living_room (1.0); friendly_name → kitchen (0.6).
    // Winner = living_room. Corroborators for living_room = 1. Boost = 0.
    // Confidence = 1.0 (already at base).
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Kitchen Light',
      },
      ctxLR,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0)
    expect(result.signals.length).toBe(2)
  })

  it('mixed corroboration: only same-target signals boost', () => {
    // entity_area → living_room (1.0); friendly_name → living_room (0.6); entity_id → kitchen (0.5).
    // Winner = living_room. Corroborators for living_room = 2 (entity_area + friendly_name).
    // The kitchen signal does NOT contribute. Boost = 0.05. Confidence = 1.0 + 0.05 = 1.0 (capped).
    const result = detectEntity(
      {
        ...baseEntity,
        haAreaId: 'living_room',
        friendlyName: 'Living Room Light',
        objectId: 'kitchen_thermostat',
      },
      ctxLR,
    )
    expect(result.roomId).toBe('living_room')
    expect(result.confidence).toBe(1.0)
    // All three signals appear in signals[] regardless of which corroborated.
    expect(result.signals.length).toBe(3)
  })

  it('corroboration boost makes a non-1.0 confidence visible', () => {
    // 2 weak signals at the same target. friendly_name (0.6) + entity_id (0.5), both → bedroom.
    // Boost +0.05. Confidence = 0.6 + 0.05 = 0.65.
    const result = detectEntity(
      { ...baseEntity, friendlyName: 'Bedroom Sensor', objectId: 'bedroom_sensor' },
      ctxNoAreas,
    )
    expect(result.roomId).toBe('bedroom')
    expect(result.confidence).toBeCloseTo(0.65, 5)
  })
})
