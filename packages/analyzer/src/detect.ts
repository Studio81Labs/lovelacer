import type {
  CanonicalRoomId,
  HaAreaRegistryEntry,
  NormalizedEntity,
  RoomAssignment,
} from '@lovelacer/shared'
import { findRoom } from './match-room.js'

export interface AreaIndexEntry {
  /** The HA area's name (used as `matchedValue` on priority-1/2 signals). */
  name: string
  /**
   * Canonical room the area's name maps to via findRoom, or null when the
   * area exists but its name doesn't match any of the 14 canonical patterns.
   */
  canonical: Exclude<CanonicalRoomId, 'misc'> | null
}

export interface DetectionContext {
  /**
   * Maps HA area_id → AreaIndexEntry. Absence from the map means the
   * area_id doesn't exist in the input areas list at all (stale registry);
   * priorities 1/2 treat that the same as a null canonical (they don't fire).
   */
  areaIndex: ReadonlyMap<string, AreaIndexEntry>
}

export interface DetectInput {
  entities: NormalizedEntity[]
  areas: HaAreaRegistryEntry[]
}

export function buildDetectionContext(areas: HaAreaRegistryEntry[]): DetectionContext {
  const areaIndex = new Map<string, AreaIndexEntry>()
  for (const area of areas) {
    const match = findRoom(area.name)
    areaIndex.set(area.area_id, {
      name: area.name,
      canonical: match !== null ? match.canonical : null,
    })
  }
  return { areaIndex }
}

// detectEntity and detect land in subsequent tasks.
// Suppress the unused-imports warning by referencing them as types only here.
export type _Internal_NormalizedEntity = NormalizedEntity
export type _Internal_RoomAssignment = RoomAssignment
