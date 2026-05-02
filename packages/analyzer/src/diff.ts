import type {
  AppliedSnapshot,
  CanonicalRoomId,
  DiffResult,
  EntityDiff,
  RoomDiffSummary,
  SnapshotAssignment,
} from '@lovelacer/shared'

export interface ComputeDiffInput {
  snapshot: AppliedSnapshot
  current: { assignments: SnapshotAssignment[] }
}

/**
 * Compute the diff between a previously-applied dashboard snapshot and the
 * current analysis. Pure — no IO, no HA, no SQLite. Caller is responsible
 * for converting analyzed rooms + misc into the flat assignments list.
 *
 * Misc entities are encoded as `roomId: null` on both sides; misc↔room
 * transitions surface as `kind: 'moved'` with the appropriate side null.
 *
 * Removed entities (in snapshot, not in current) intentionally do NOT
 * accumulate into `perRoom` — they have no current room. The frontend
 * surfaces them in a dedicated `RemovedEntitiesPanel`.
 *
 * Caller must deduplicate `assignments` on both sides — duplicates are
 * silently last-wins via `Map.set()`.
 */
export function computeDiff(input: ComputeDiffInput): DiffResult {
  const prev = new Map<string, CanonicalRoomId | null>()
  for (const a of input.snapshot.assignments) prev.set(a.entityId, a.roomId)

  const curr = new Map<string, CanonicalRoomId | null>()
  for (const a of input.current.assignments) curr.set(a.entityId, a.roomId)

  const entities: EntityDiff[] = []
  let added = 0
  let moved = 0
  let removed = 0
  const perRoom: Partial<Record<CanonicalRoomId, RoomDiffSummary>> = {}

  function bucket(roomId: CanonicalRoomId): RoomDiffSummary {
    const existing = perRoom[roomId]
    if (existing !== undefined) return existing
    const fresh: RoomDiffSummary = { added: 0, movedIn: 0, movedOut: 0 }
    perRoom[roomId] = fresh
    return fresh
  }

  for (const [entityId, currRoom] of curr) {
    if (!prev.has(entityId)) {
      entities.push({ entityId, kind: 'added', currentRoomId: currRoom })
      added++
      if (currRoom !== null) bucket(currRoom).added++
      continue
    }
    const prevRoom = prev.get(entityId) as CanonicalRoomId | null
    if (prevRoom !== currRoom) {
      entities.push({
        entityId,
        kind: 'moved',
        previousRoomId: prevRoom,
        currentRoomId: currRoom,
      })
      moved++
      if (currRoom !== null) {
        const dest = bucket(currRoom)
        dest.added++
        dest.movedIn++
      }
      if (prevRoom !== null) bucket(prevRoom).movedOut++
    }
  }

  for (const [entityId, prevRoom] of prev) {
    if (!curr.has(entityId)) {
      entities.push({ entityId, kind: 'removed', previousRoomId: prevRoom })
      removed++
    }
  }

  return {
    entities,
    perRoom,
    totals: { added, moved, removed },
    appliedAt: input.snapshot.appliedAt,
  }
}
