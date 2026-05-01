import { describe, it, expect } from 'vitest'
import type { NormalizedEntity, Override, RoomAssignment } from '@lovelacer/shared'
import { applyOverrides } from '../pipeline.js'

function makeAssignment(entityId: string, roomId: RoomAssignment['roomId']): RoomAssignment {
  return { entityId, roomId, confidence: 0.6, signals: [] }
}

function makeEntity(entityId: string, isHidden = false): NormalizedEntity {
  return {
    entityId,
    domain: entityId.split('.')[0]!,
    objectId: entityId.split('.')[1]!,
    friendlyName: entityId,
    haAreaId: null,
    deviceClass: null,
    entityCategory: null,
    device: null,
    isHidden,
    isDisabled: false,
  }
}

describe('applyOverrides', () => {
  it('empty overrides → no mutation', () => {
    const assignments = [makeAssignment('light.a', 'kitchen')]
    const entities = [makeEntity('light.a')]
    applyOverrides({ assignments, entities }, [])
    expect(assignments[0]!.roomId).toBe('kitchen')
    expect(assignments[0]!.confidence).toBe(0.6)
    expect(assignments[0]!.manual).toBeUndefined()
    expect(entities[0]!.isHidden).toBe(false)
  })

  it('roomId override updates roomId, sets confidence=1.0 and manual=true', () => {
    const assignments = [makeAssignment('light.a', 'kitchen')]
    const entities = [makeEntity('light.a')]
    const overrides: Override[] = [{ entityId: 'light.a', roomId: 'living_room' }]
    applyOverrides({ assignments, entities }, overrides)
    expect(assignments[0]!.roomId).toBe('living_room')
    expect(assignments[0]!.confidence).toBe(1.0)
    expect(assignments[0]!.manual).toBe(true)
  })

  it('hidden:true override OR-merges entity.isHidden', () => {
    const assignments = [makeAssignment('sensor.x', 'kitchen')]
    const entities = [makeEntity('sensor.x', false)]
    const overrides: Override[] = [{ entityId: 'sensor.x', hidden: true }]
    applyOverrides({ assignments, entities }, overrides)
    expect(entities[0]!.isHidden).toBe(true)
  })

  it('hidden:true does not flip isHidden=true back to false', () => {
    const assignments = [makeAssignment('sensor.x', 'kitchen')]
    const entities = [makeEntity('sensor.x', true)]
    const overrides: Override[] = [{ entityId: 'sensor.x', hidden: true }]
    applyOverrides({ assignments, entities }, overrides)
    expect(entities[0]!.isHidden).toBe(true)
  })

  it('hidden:false (explicit) does NOT flip isHidden=true to false', () => {
    // The patch only OR-merges hidden=true; we never un-hide via override.
    // (The API layer rejects no-op overrides via zod refine, but
    // applyOverrides itself doesn't validate — so a hidden:false-only
    // override is a meaningful test of the OR-merge semantics.)
    const assignments = [makeAssignment('sensor.x', 'kitchen')]
    const entities = [makeEntity('sensor.x', true)]
    const overrides: Override[] = [{ entityId: 'sensor.x', hidden: false }]
    applyOverrides({ assignments, entities }, overrides)
    expect(entities[0]!.isHidden).toBe(true) // stays hidden
    // Pure hidden:false override leaves the assignment untouched too.
    expect(assignments[0]!.roomId).toBe('kitchen')
    expect(assignments[0]!.confidence).toBe(0.6)
    expect(assignments[0]!.manual).toBeUndefined()
  })

  it('combined override (roomId + hidden) applies both', () => {
    const assignments = [makeAssignment('media_player.tv', 'kitchen')]
    const entities = [makeEntity('media_player.tv')]
    const overrides: Override[] = [
      { entityId: 'media_player.tv', roomId: 'bedroom', hidden: true },
    ]
    applyOverrides({ assignments, entities }, overrides)
    expect(assignments[0]!.roomId).toBe('bedroom')
    expect(assignments[0]!.manual).toBe(true)
    expect(entities[0]!.isHidden).toBe(true)
  })

  it('orphaned override (entityId not in assignments) silently no-ops', () => {
    const assignments = [makeAssignment('light.a', 'kitchen')]
    const entities = [makeEntity('light.a')]
    const overrides: Override[] = [{ entityId: 'light.gone', roomId: 'bedroom' }]
    applyOverrides({ assignments, entities }, overrides)
    expect(assignments[0]!.roomId).toBe('kitchen')
    expect(assignments[0]!.manual).toBeUndefined()
    expect(entities).toHaveLength(1) // no entity added
  })

  it('multiple overrides at once — each applies to its target', () => {
    const assignments = [
      makeAssignment('light.a', 'kitchen'),
      makeAssignment('light.b', 'bedroom'),
      makeAssignment('sensor.c', 'kitchen'),
    ]
    const entities = [makeEntity('light.a'), makeEntity('light.b'), makeEntity('sensor.c')]
    const overrides: Override[] = [
      { entityId: 'light.a', roomId: 'living_room' },
      { entityId: 'sensor.c', hidden: true },
    ]
    applyOverrides({ assignments, entities }, overrides)
    expect(assignments[0]!.roomId).toBe('living_room')
    expect(assignments[0]!.manual).toBe(true)
    expect(assignments[1]!.roomId).toBe('bedroom') // untouched
    expect(assignments[1]!.manual).toBeUndefined()
    expect(entities[2]!.isHidden).toBe(true)
    expect(entities[0]!.isHidden).toBe(false) // untouched
  })
})
