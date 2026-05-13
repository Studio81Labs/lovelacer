import { describe, it, expect } from 'vitest'
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  NormalizedEntity,
  Override,
  RoomAssignment,
} from '@lovelacer/shared'
import { computeSuggestions } from '../suggestions.js'

function makeEntity(over: Partial<NormalizedEntity> = {}): NormalizedEntity {
  return {
    entityId: 'sensor.foo',
    domain: 'sensor',
    objectId: 'foo',
    friendlyName: 'Foo',
    deviceClass: null,
    entityCategory: null,
    haAreaId: null,
    device: null,
    isHidden: false,
    isDisabled: false,
    ...over,
  }
}

function makeAssignment(over: Partial<RoomAssignment> = {}): RoomAssignment {
  return {
    entityId: 'sensor.foo',
    roomId: 'kitchen' as CanonicalRoomId,
    confidence: 0.6,
    signals: [{ source: 'friendly_name', weight: 0.6, matchedValue: 'kitchen' }],
    ...over,
  }
}

function makeRoom(assignments: RoomAssignment[]): AnalyzedRoom {
  return {
    id: 'kitchen' as CanonicalRoomId,
    haAreaId: null,
    displayName: 'Kitchen',
    icon: 'mdi:silverware-fork-knife',
    entityCount: assignments.length,
    averageConfidence: 0,
    assignments,
  }
}

function input(overrides: {
  rooms?: AnalyzedRoom[]
  miscEntityIds?: Set<string>
  entitiesById?: Map<string, NormalizedEntity>
  overridesById?: Map<string, Override>
  dismissed?: Set<string>
}) {
  return {
    rooms: overrides.rooms ?? [],
    miscEntityIds: overrides.miscEntityIds ?? new Set<string>(),
    entitiesById: overrides.entitiesById ?? new Map(),
    overridesById: overrides.overridesById ?? new Map(),
    dismissed: overrides.dismissed ?? new Set<string>(),
  }
}

describe('computeSuggestions — empty input', () => {
  it('returns empty array when there are no rooms or misc', () => {
    expect(computeSuggestions(input({}))).toEqual([])
  })
})

describe('computeSuggestions — set_area_id', () => {
  const entity = makeEntity({ entityId: 'sensor.foo', haAreaId: null })
  const entitiesById = new Map([[entity.entityId, entity]])
  const assignment = makeAssignment({ entityId: entity.entityId, confidence: 0.6 })

  it('emits when entity has no haAreaId, name-based dominant signal, confidence >= 0.6', () => {
    const result = computeSuggestions(input({ rooms: [makeRoom([assignment])], entitiesById }))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      entityId: entity.entityId,
      type: 'set_area_id',
      matchedRoomId: 'kitchen',
    })
  })

  it('does NOT emit when entity already has haAreaId set', () => {
    const e = makeEntity({ entityId: 'sensor.foo', haAreaId: 'area_1' })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([assignment])],
        entitiesById: new Map([[e.entityId, e]]),
      }),
    )
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })

  it('does NOT emit when device has haAreaId set', () => {
    const e = makeEntity({
      entityId: 'sensor.foo',
      haAreaId: null,
      device: {
        id: 'd1',
        name: 'X',
        nameByUser: null,
        manufacturer: null,
        model: null,
        haAreaId: 'area_1',
      },
    })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([assignment])],
        entitiesById: new Map([[e.entityId, e]]),
      }),
    )
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })

  it('does NOT emit when confidence < 0.6', () => {
    const a = makeAssignment({ entityId: entity.entityId, confidence: 0.59 })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })

  it('does NOT emit when dominant signal is entity_area', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      signals: [{ source: 'entity_area', weight: 1.0 }],
      confidence: 1.0,
    })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })

  it('does NOT emit when dominant signal is device_area', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      signals: [{ source: 'device_area', weight: 0.85 }],
      confidence: 0.85,
    })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })
})

describe('computeSuggestions — move_room', () => {
  const entity = makeEntity({ entityId: 'sensor.bar', haAreaId: 'area_1' })
  const entitiesById = new Map([[entity.entityId, entity]])

  it('emits when confidence < 0.5 and top alternative is within 0.15', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      confidence: 0.45,
      signals: [{ source: 'entity_area', weight: 0.45 }],
      alternatives: [{ roomId: 'living_room' as CanonicalRoomId, confidence: 0.4 }],
    })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    const move = result.find((s) => s.type === 'move_room')
    expect(move).toBeDefined()
    expect(move?.suggestedRoomId).toBe('living_room')
  })

  it('does NOT emit when confidence >= 0.5', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      confidence: 0.5,
      alternatives: [{ roomId: 'living_room' as CanonicalRoomId, confidence: 0.45 }],
    })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'move_room')).toBeUndefined()
  })

  it('does NOT emit when alternatives is missing', () => {
    const a = makeAssignment({ entityId: entity.entityId, confidence: 0.45 })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'move_room')).toBeUndefined()
  })

  it('does NOT emit when top alternative is more than 0.15 below winner', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      confidence: 0.45,
      alternatives: [{ roomId: 'living_room' as CanonicalRoomId, confidence: 0.25 }],
    })
    const result = computeSuggestions(input({ rooms: [makeRoom([a])], entitiesById }))
    expect(result.find((s) => s.type === 'move_room')).toBeUndefined()
  })

  it('does NOT emit when an override with roomId already exists', () => {
    const a = makeAssignment({
      entityId: entity.entityId,
      confidence: 0.45,
      alternatives: [{ roomId: 'living_room' as CanonicalRoomId, confidence: 0.4 }],
    })
    const overridesById = new Map<string, Override>([
      [entity.entityId, { entityId: entity.entityId, roomId: 'office' as CanonicalRoomId }],
    ])
    const result = computeSuggestions(
      input({ rooms: [makeRoom([a])], entitiesById, overridesById }),
    )
    expect(result.find((s) => s.type === 'move_room')).toBeUndefined()
  })
})

describe('computeSuggestions — hide_diagnostic', () => {
  it('emits for diagnostic entities not yet hidden', () => {
    const entity = makeEntity({
      entityId: 'sensor.batt',
      entityCategory: 'diagnostic',
      isHidden: false,
    })
    const a = makeAssignment({ entityId: entity.entityId, confidence: 1.0 })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([a])],
        entitiesById: new Map([[entity.entityId, entity]]),
      }),
    )
    const hide = result.find((s) => s.type === 'hide_diagnostic')
    expect(hide).toBeDefined()
    expect(hide?.entityId).toBe(entity.entityId)
  })

  it('does NOT emit for non-diagnostic entities', () => {
    const entity = makeEntity({ entityId: 'sensor.x', entityCategory: null })
    const a = makeAssignment({ entityId: entity.entityId, confidence: 1.0 })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([a])],
        entitiesById: new Map([[entity.entityId, entity]]),
      }),
    )
    expect(result.find((s) => s.type === 'hide_diagnostic')).toBeUndefined()
  })

  it('does NOT emit when entity.isHidden is already true', () => {
    const entity = makeEntity({
      entityId: 'sensor.batt',
      entityCategory: 'diagnostic',
      isHidden: true,
    })
    const a = makeAssignment({ entityId: entity.entityId, confidence: 1.0 })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([a])],
        entitiesById: new Map([[entity.entityId, entity]]),
      }),
    )
    expect(result.find((s) => s.type === 'hide_diagnostic')).toBeUndefined()
  })

  it('does NOT emit when an override has hidden=true', () => {
    const entity = makeEntity({
      entityId: 'sensor.batt',
      entityCategory: 'diagnostic',
      isHidden: false,
    })
    const a = makeAssignment({ entityId: entity.entityId, confidence: 1.0 })
    const overridesById = new Map<string, Override>([
      [entity.entityId, { entityId: entity.entityId, hidden: true }],
    ])
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([a])],
        entitiesById: new Map([[entity.entityId, entity]]),
        overridesById,
      }),
    )
    expect(result.find((s) => s.type === 'hide_diagnostic')).toBeUndefined()
  })

  it('emits for misc entities that are diagnostic', () => {
    const entity = makeEntity({
      entityId: 'sensor.misc_diag',
      entityCategory: 'diagnostic',
      isHidden: false,
    })
    const result = computeSuggestions(
      input({
        miscEntityIds: new Set([entity.entityId]),
        entitiesById: new Map([[entity.entityId, entity]]),
      }),
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('hide_diagnostic')
  })
})

describe('computeSuggestions — dismissed filter', () => {
  it('drops suggestions whose (entityId|type) is in the dismissed set', () => {
    const entity = makeEntity({ entityId: 'sensor.foo', haAreaId: null })
    const a = makeAssignment({ entityId: entity.entityId, confidence: 0.6 })
    const dismissed = new Set([`${entity.entityId}|set_area_id`])
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([a])],
        entitiesById: new Map([[entity.entityId, entity]]),
        dismissed,
      }),
    )
    expect(result.find((s) => s.type === 'set_area_id')).toBeUndefined()
  })
})

describe('computeSuggestions — sort order', () => {
  it('sorts by entityId ascending then by type ascending', () => {
    const a = makeEntity({
      entityId: 'sensor.aaa',
      entityCategory: 'diagnostic',
      isHidden: false,
      haAreaId: null,
    })
    const b = makeEntity({
      entityId: 'sensor.bbb',
      entityCategory: 'diagnostic',
      isHidden: false,
      haAreaId: null,
    })
    const aa = makeAssignment({ entityId: a.entityId, confidence: 0.6 })
    const ba = makeAssignment({ entityId: b.entityId, confidence: 0.6 })
    const result = computeSuggestions(
      input({
        rooms: [makeRoom([aa, ba])],
        entitiesById: new Map([
          [a.entityId, a],
          [b.entityId, b],
        ]),
      }),
    )
    // Each entity emits set_area_id + hide_diagnostic. Expect:
    //   sensor.aaa | hide_diagnostic
    //   sensor.aaa | set_area_id
    //   sensor.bbb | hide_diagnostic
    //   sensor.bbb | set_area_id
    expect(result.map((s) => `${s.entityId}|${s.type}`)).toEqual([
      'sensor.aaa|hide_diagnostic',
      'sensor.aaa|set_area_id',
      'sensor.bbb|hide_diagnostic',
      'sensor.bbb|set_area_id',
    ])
  })
})
