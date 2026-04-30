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
