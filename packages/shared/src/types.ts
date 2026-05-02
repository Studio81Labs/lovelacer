import type { CanonicalRoomId } from './constants.js'

/**
 * Raw shapes from HA's WebSocket API. Subset — only fields we use.
 */

export interface HaEntityRegistryEntry {
  entity_id: string
  name: string | null
  original_name: string | null
  area_id: string | null
  device_id: string | null
  platform: string
  hidden_by: string | null
  disabled_by: string | null
  entity_category: 'config' | 'diagnostic' | null
  device_class: string | null
}

export interface HaDeviceRegistryEntry {
  id: string
  name: string | null
  name_by_user: string | null
  manufacturer: string | null
  model: string | null
  area_id: string | null
}

export interface HaAreaRegistryEntry {
  area_id: string
  name: string
  floor_id: string | null
  icon: string | null
}

export interface HaFloorRegistryEntry {
  floor_id: string
  name: string
  level: number | null
  icon: string | null
}

/**
 * Languages with localized room keyword sets. Adding a new language is a
 * pure data change in `room-keywords.ts` — this union already declares
 * all 8 documented languages even though EN+CS are the only ones with
 * keyword data shipped today.
 */
export type LanguageCode = 'en' | 'cs' | 'de' | 'es' | 'fr' | 'it' | 'pl' | 'nl'

/**
 * One row of the room keyword database.
 *
 * `patterns` and `excludes` are stored pre-normalized: lowercase, no
 * diacritics, words separated by single space, only `[a-z0-9 ]`
 * characters. The matcher normalizes input text the same way before
 * substring-matching against these.
 */
export interface RoomKeyword {
  canonical: Exclude<CanonicalRoomId, 'misc'>
  language: LanguageCode
  patterns: string[]
  excludes?: string[]
}

/**
 * Lovelacer's internal normalized entity representation.
 * Output of packages/analyzer's normalize step.
 */
export interface NormalizedEntity {
  entityId: string
  domain: string
  objectId: string
  friendlyName: string
  deviceClass: string | null
  entityCategory: 'config' | 'diagnostic' | null
  haAreaId: string | null
  device: NormalizedDevice | null
  isHidden: boolean
  isDisabled: boolean
}

export interface NormalizedDevice {
  id: string
  name: string | null
  nameByUser: string | null
  manufacturer: string | null
  model: string | null
  haAreaId: string | null
}

/**
 * Output of the room detection chain.
 */
export interface DetectionSignal {
  source: 'override' | 'entity_area' | 'device_area' | 'friendly_name' | 'entity_id' | 'device_name'
  weight: number
  matchedValue?: string
}

export interface RoomAssignment {
  entityId: string
  roomId: CanonicalRoomId
  confidence: number
  signals: DetectionSignal[]
  /**
   * True iff this assignment was overridden by user override (P1b-3).
   * Detector-produced assignments leave this undefined; the override
   * patch step in `runFullPipeline` sets it.
   */
  manual?: boolean
}

/**
 * Aggregated analysis output — what /api/analyze returns.
 */
export interface AnalysisResult {
  rooms: AnalyzedRoom[]
  unassignedCount: number
  entityCount: number
  generatedAt: number
}

export interface AnalyzedRoom {
  id: CanonicalRoomId
  haAreaId: string | null
  displayName: string
  entityCount: number
  averageConfidence: number
  assignments: RoomAssignment[]
}

/**
 * P2-1 — diff view types.
 *
 * `SnapshotAssignment.roomId` uses `null` to encode "this entity was/is in
 * the misc bucket" (no room view contains it). The diff treats null as just
 * another assignment value: misc-to-room and room-to-misc both surface as
 * `kind: 'moved'` with the appropriate side null.
 */
export interface SnapshotAssignment {
  entityId: string
  roomId: CanonicalRoomId | null
}

export interface AppliedSnapshot {
  assignments: SnapshotAssignment[]
  /**
   * Full LovelaceConfig that was pushed. Stored for archival — currently
   * not read by the diff (assignments are sufficient). Future tickets may
   * use it for YAML drift detection.
   *
   * Typed as `unknown` here because @lovelacer/shared can't depend on
   * @lovelacer/generator (cyclic). The server casts on read.
   */
  config: unknown
  appliedAt: number
}

export type DiffKind = 'added' | 'moved' | 'removed'

export interface EntityDiff {
  entityId: string
  kind: DiffKind
  /** Room (or misc=null) the entity occupied in the snapshot. Undefined for 'added'. */
  previousRoomId?: CanonicalRoomId | null
  /** Room (or misc=null) the entity is in now. Undefined for 'removed'. */
  currentRoomId?: CanonicalRoomId | null
}

export interface RoomDiffSummary {
  /** Entities new to this room — both fresh adds and moves-in. */
  added: number
  /** Subset of `added`: entities that were assigned to a different room before. */
  movedIn: number
  /**
   * Entities that moved to a different room or to misc. Removals are tracked
   * in the top-level `removed` total, not here.
   */
  movedOut: number
}

export interface DiffResult {
  entities: EntityDiff[]
  perRoom: Partial<Record<CanonicalRoomId, RoomDiffSummary>>
  totals: { added: number; moved: number; removed: number }
  /** Copied through from the snapshot — unix seconds. */
  appliedAt: number
}

/**
 * P2-3 — floor-aware grouping types.
 *
 * Captures the floor a canonical room is associated with via the chain
 * `room.haAreaId → area.floor_id → floor`. Surfaces in the dashboard
 * via `buildRoomsByFloorSection` (a new home-view section); does NOT
 * modify AnalyzedRoom — the room→floor map is a separate output of
 * `assignFloors()` from @lovelacer/analyzer.
 */
export interface FloorAssignment {
  floorId: string
  /** Floor display name from the HA registry. */
  name: string
  /** HA's level number; null if not set. Used for sort order. */
  level: number | null
  /** Optional MDI icon from HA. Captured for forward compatibility — not yet rendered. */
  icon: string | null
}
