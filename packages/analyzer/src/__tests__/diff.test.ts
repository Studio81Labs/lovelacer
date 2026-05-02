import { describe, it, expect } from 'vitest'
import type { AppliedSnapshot, SnapshotAssignment } from '@lovelacer/shared'
import { computeDiff } from '../diff.js'

function snap(assignments: SnapshotAssignment[], appliedAt = 1_700_000_000): AppliedSnapshot {
  return { assignments, config: { title: 'x', views: [] }, appliedAt }
}

describe('computeDiff', () => {
  it('empty snapshot vs empty current → all-zero diff', () => {
    const result = computeDiff({ snapshot: snap([]), current: { assignments: [] } })
    expect(result.entities).toEqual([])
    expect(result.totals).toEqual({ added: 0, moved: 0, removed: 0 })
    expect(result.perRoom).toEqual({})
    expect(result.appliedAt).toBe(1_700_000_000)
  })

  it('entity in current but not snapshot → kind: added', () => {
    const result = computeDiff({
      snapshot: snap([]),
      current: { assignments: [{ entityId: 'light.kitchen_ceiling', roomId: 'kitchen' }] },
    })
    expect(result.entities).toEqual([
      { entityId: 'light.kitchen_ceiling', kind: 'added', currentRoomId: 'kitchen' },
    ])
    expect(result.totals).toEqual({ added: 1, moved: 0, removed: 0 })
    expect(result.perRoom.kitchen).toEqual({ added: 1, movedIn: 0, movedOut: 0 })
  })

  it('entity in snapshot but not current → kind: removed', () => {
    const result = computeDiff({
      snapshot: snap([{ entityId: 'light.guest_lamp', roomId: 'guest_room' }]),
      current: { assignments: [] },
    })
    expect(result.entities).toEqual([
      { entityId: 'light.guest_lamp', kind: 'removed', previousRoomId: 'guest_room' },
    ])
    expect(result.totals).toEqual({ added: 0, moved: 0, removed: 1 })
    expect(result.perRoom).toEqual({})
  })

  it('entity in both with different roomId → kind: moved', () => {
    const result = computeDiff({
      snapshot: snap([{ entityId: 'light.lamp', roomId: 'living_room' }]),
      current: { assignments: [{ entityId: 'light.lamp', roomId: 'bedroom' }] },
    })
    expect(result.entities).toEqual([
      {
        entityId: 'light.lamp',
        kind: 'moved',
        previousRoomId: 'living_room',
        currentRoomId: 'bedroom',
      },
    ])
    expect(result.totals).toEqual({ added: 0, moved: 1, removed: 0 })
    expect(result.perRoom.living_room).toEqual({ added: 0, movedIn: 0, movedOut: 1 })
    expect(result.perRoom.bedroom).toEqual({ added: 1, movedIn: 1, movedOut: 0 })
  })

  it('misc → room and room → misc both surface as moved with null on the right side', () => {
    const result = computeDiff({
      snapshot: snap([
        { entityId: 'light.was_misc', roomId: null },
        { entityId: 'light.was_kitchen', roomId: 'kitchen' },
      ]),
      current: {
        assignments: [
          { entityId: 'light.was_misc', roomId: 'kitchen' },
          { entityId: 'light.was_kitchen', roomId: null },
        ],
      },
    })
    const byEntity = new Map(result.entities.map((d) => [d.entityId, d]))
    expect(byEntity.get('light.was_misc')).toEqual({
      entityId: 'light.was_misc',
      kind: 'moved',
      previousRoomId: null,
      currentRoomId: 'kitchen',
    })
    expect(byEntity.get('light.was_kitchen')).toEqual({
      entityId: 'light.was_kitchen',
      kind: 'moved',
      previousRoomId: 'kitchen',
      currentRoomId: null,
    })
    expect(result.totals).toEqual({ added: 0, moved: 2, removed: 0 })
    expect(result.perRoom.kitchen).toEqual({ added: 1, movedIn: 1, movedOut: 1 })
  })

  it('entity unchanged in same room → not in entities[]', () => {
    const result = computeDiff({
      snapshot: snap([{ entityId: 'light.lamp', roomId: 'kitchen' }]),
      current: { assignments: [{ entityId: 'light.lamp', roomId: 'kitchen' }] },
    })
    expect(result.entities).toEqual([])
    expect(result.totals).toEqual({ added: 0, moved: 0, removed: 0 })
    expect(result.perRoom).toEqual({})
  })

  it('mixed scenario rolls up correctly across three rooms', () => {
    const result = computeDiff({
      snapshot: snap([
        { entityId: 'light.k1', roomId: 'kitchen' },
        { entityId: 'light.k2', roomId: 'kitchen' },
        { entityId: 'light.l1', roomId: 'living_room' },
        { entityId: 'light.gone', roomId: 'office' },
      ]),
      current: {
        assignments: [
          { entityId: 'light.k1', roomId: 'kitchen' },
          { entityId: 'light.k2', roomId: 'bedroom' },
          { entityId: 'light.l1', roomId: 'bedroom' },
          { entityId: 'light.new', roomId: 'kitchen' },
        ],
      },
    })
    expect(result.totals).toEqual({ added: 1, moved: 2, removed: 1 })
    expect(result.perRoom.kitchen).toEqual({ added: 1, movedIn: 0, movedOut: 1 })
    expect(result.perRoom.living_room).toEqual({ added: 0, movedIn: 0, movedOut: 1 })
    expect(result.perRoom.bedroom).toEqual({ added: 2, movedIn: 2, movedOut: 0 })
    expect(result.perRoom.office).toBeUndefined()
  })

  it('idempotent on identical snapshot/current', () => {
    const assignments: SnapshotAssignment[] = [
      { entityId: 'light.a', roomId: 'kitchen' },
      { entityId: 'light.b', roomId: 'bedroom' },
      { entityId: 'sensor.x', roomId: null },
    ]
    const result = computeDiff({ snapshot: snap(assignments), current: { assignments } })
    expect(result.entities).toEqual([])
    expect(result.totals).toEqual({ added: 0, moved: 0, removed: 0 })
    expect(result.perRoom).toEqual({})
  })

  it('appliedAt copied from snapshot to result', () => {
    const result = computeDiff({ snapshot: snap([], 1_700_999_999), current: { assignments: [] } })
    expect(result.appliedAt).toBe(1_700_999_999)
  })
})
