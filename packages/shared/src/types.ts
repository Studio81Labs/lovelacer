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
