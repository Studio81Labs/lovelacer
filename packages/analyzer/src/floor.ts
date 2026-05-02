import type {
  AnalyzedRoom,
  CanonicalRoomId,
  FloorAssignment,
  HaAreaRegistryEntry,
  HaFloorRegistryEntry,
} from '@lovelacer/shared'

export interface AssignFloorsInput {
  rooms: AnalyzedRoom[]
  areas: HaAreaRegistryEntry[]
  floors: HaFloorRegistryEntry[]
}

/**
 * Map each canonical room to its floor assignment via:
 *   room.haAreaId → area.floor_id → floor.
 *
 * Returns `null` for rooms without a dominant haAreaId, or whose area
 * lacks a floor_id, or whose floor_id isn't in the floor registry. The
 * misc bucket is excluded from the result map entirely (not navigable;
 * distinct from "in the map with null").
 */
export function assignFloors(
  input: AssignFloorsInput,
): Map<CanonicalRoomId, FloorAssignment | null> {
  const areasById = new Map(input.areas.map((a) => [a.area_id, a]))
  const floorsById = new Map(input.floors.map((f) => [f.floor_id, f]))
  const result = new Map<CanonicalRoomId, FloorAssignment | null>()

  for (const room of input.rooms) {
    if (room.id === 'misc') continue
    if (room.haAreaId === null) {
      result.set(room.id, null)
      continue
    }
    const area = areasById.get(room.haAreaId)
    if (area === undefined || area.floor_id === null) {
      result.set(room.id, null)
      continue
    }
    const floor = floorsById.get(area.floor_id)
    if (floor === undefined) {
      result.set(room.id, null)
      continue
    }
    result.set(room.id, {
      floorId: floor.floor_id,
      name: floor.name,
      level: floor.level,
      icon: floor.icon,
    })
  }

  return result
}
