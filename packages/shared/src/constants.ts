/**
 * Canonical room identifiers used throughout the system.
 *
 * These are language-agnostic IDs. Localized display names are keyed by
 * these IDs below so detection can stay canonical while generated
 * dashboards speak the user's selected language.
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
 * Room title languages currently selectable through Settings.language.
 * `auto` is intentionally not represented here: in auto mode the server
 * preserves HA area names when it has them, falling back to English.
 */
export type RoomDisplayLanguage = 'en' | 'cs'

export const ROOM_DISPLAY_NAMES: Record<RoomDisplayLanguage, Record<CanonicalRoomId, string>> = {
  en: {
    kitchen: 'Kitchen',
    living_room: 'Living Room',
    bedroom: 'Bedroom',
    bathroom: 'Bathroom',
    office: 'Office',
    hallway: 'Hallway',
    garage: 'Garage',
    garden: 'Garden',
    dining_room: 'Dining Room',
    laundry: 'Laundry',
    basement: 'Basement',
    attic: 'Attic',
    kids_room: "Kids' Room",
    guest_room: 'Guest Room',
    misc: 'Other',
  },
  cs: {
    kitchen: 'Kuchyně',
    living_room: 'Obývací pokoj',
    bedroom: 'Ložnice',
    bathroom: 'Koupelna',
    office: 'Kancelář',
    hallway: 'Chodba',
    garage: 'Garáž',
    garden: 'Zahrada',
    dining_room: 'Jídelna',
    laundry: 'Prádelna',
    basement: 'Sklep',
    attic: 'Půda',
    kids_room: 'Dětský pokoj',
    guest_room: 'Pokoj pro hosty',
    misc: 'Ostatní',
  },
}

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
 *
 * Range semantics: `min` inclusive, `max` exclusive — with `high.max` (1.0)
 * inclusive (it's the maximum valid confidence). `none` is the exact-zero
 * sentinel; `low.min` is `Number.MIN_VALUE` so the range literally expresses
 * "any positive value below medium" without overlapping `none`.
 */
export const CONFIDENCE_BUCKETS = {
  high: { min: 0.85, max: 1.0 },
  medium: { min: 0.5, max: 0.85 },
  low: { min: Number.MIN_VALUE, max: 0.5 },
  none: { min: 0, max: 0 },
} as const

export type ConfidenceBucket = keyof typeof CONFIDENCE_BUCKETS

export function bucketForConfidence(confidence: number): ConfidenceBucket {
  if (confidence >= CONFIDENCE_BUCKETS.high.min) return 'high'
  if (confidence >= CONFIDENCE_BUCKETS.medium.min) return 'medium'
  if (confidence >= CONFIDENCE_BUCKETS.low.min) return 'low'
  return 'none'
}
