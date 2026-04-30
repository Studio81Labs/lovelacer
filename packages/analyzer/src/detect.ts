import type {
  CanonicalRoomId,
  DetectionSignal,
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

interface FiredSignal extends DetectionSignal {
  /** The canonical room this signal targets. */
  target: Exclude<CanonicalRoomId, 'misc'>
}

export function detectEntity(entity: NormalizedEntity, ctx: DetectionContext): RoomAssignment {
  const fired: FiredSignal[] = []

  // Priority 1 — entity_area
  if (entity.haAreaId !== null) {
    const entry = ctx.areaIndex.get(entity.haAreaId)
    if (entry !== undefined && entry.canonical !== null) {
      fired.push({
        source: 'entity_area',
        weight: 1.0,
        matchedValue: entry.name,
        target: entry.canonical,
      })
    }
  }

  // Priority 2 — device_area
  if (entity.device !== null && entity.device.haAreaId !== null) {
    const entry = ctx.areaIndex.get(entity.device.haAreaId)
    if (entry !== undefined && entry.canonical !== null) {
      fired.push({
        source: 'device_area',
        weight: 0.85,
        matchedValue: entry.name,
        target: entry.canonical,
      })
    }
  }

  return assemble(entity.entityId, fired)
}

function assemble(entityId: string, fired: FiredSignal[]): RoomAssignment {
  if (fired.length === 0) {
    return { entityId, roomId: 'misc', confidence: 0, signals: [] }
  }
  // Highest-weight target wins; ties broken by priority (insertion) order.
  let winner = fired[0]!
  for (const s of fired) {
    if (s.weight > winner.weight) winner = s
  }
  // Strip the internal `target` field before exposing signals publicly.
  const signals: DetectionSignal[] = fired.map(({ target: _t, ...rest }) => rest)
  return {
    entityId,
    roomId: winner.target,
    confidence: winner.weight,
    signals,
  }
}
