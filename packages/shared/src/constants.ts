/**
 * Canonical room identifiers used throughout the system.
 *
 * These are language-agnostic IDs. Localized display names live in
 * the keyword tables (added in P1a-2).
 */
export const CANONICAL_ROOMS = [
  'kitchen',
  'living_room',
  'bedroom',
  'bathroom',
  'office',
  'hallway',
  'garage',
  'garden',
  'dining_room',
  'laundry',
  'basement',
  'attic',
  'kids_room',
  'guest_room',
  'misc',
] as const

export type CanonicalRoomId = (typeof CANONICAL_ROOMS)[number]

/**
 * Domains we generate proper card mappings for in Phase 1a.
 * Everything else routes to the generic `entities` fallback card.
 *
 * Phase 1b adds: cover, media_player, lock, camera, vacuum, fan.
 */
export const PHASE_1A_DOMAINS = ['light', 'switch', 'sensor', 'binary_sensor', 'climate'] as const

export type SupportedDomain = (typeof PHASE_1A_DOMAINS)[number]

/**
 * Confidence buckets used in UI display.
 * See HEURISTICS.md "Confidence buckets for UI".
 */
export const CONFIDENCE_BUCKETS = {
  high: { min: 0.85, max: 1.0 },
  medium: { min: 0.5, max: 0.84 },
  low: { min: 0.01, max: 0.49 },
  none: { min: 0, max: 0 },
} as const

export type ConfidenceBucket = keyof typeof CONFIDENCE_BUCKETS

export function bucketForConfidence(confidence: number): ConfidenceBucket {
  if (confidence >= 0.85) return 'high'
  if (confidence >= 0.5) return 'medium'
  if (confidence > 0) return 'low'
  return 'none'
}
