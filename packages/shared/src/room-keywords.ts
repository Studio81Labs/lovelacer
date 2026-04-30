import type { RoomKeyword } from './types.js'

/**
 * Room keyword database. Localized substring patterns the analyzer uses
 * to detect which canonical room an entity belongs to.
 *
 * STORAGE CONVENTION: patterns and excludes are stored PRE-NORMALIZED —
 * lowercase, no diacritics, single-space-separated, only [a-z0-9 ]. The
 * matcher normalizes its input the same way and uses substring matching.
 * Writing `kuchyně` here will silently fail to match anything; the schema
 * test in __tests__/room-keywords.test.ts catches this at CI time.
 *
 * Adding a new language: append rows. No type changes needed (LanguageCode
 * already declares all 8 documented languages).
 */
export const ROOM_KEYWORDS: RoomKeyword[] = [
  // ── kitchen ──────────────────────────────────────────────────────
  { canonical: 'kitchen', language: 'en', patterns: ['kitchen', 'kitchenette'] },
  { canonical: 'kitchen', language: 'cs', patterns: ['kuchyne', 'kuch'] },

  // ── living_room ──────────────────────────────────────────────────
  {
    canonical: 'living_room',
    language: 'en',
    patterns: ['living room', 'livingroom', 'lounge', 'family room'],
  },
  {
    canonical: 'living_room',
    language: 'cs',
    patterns: ['obyvak', 'obyvaci pokoj'],
  },

  // ── bedroom ──────────────────────────────────────────────────────
  {
    canonical: 'bedroom',
    language: 'en',
    patterns: ['bedroom', 'master bedroom'],
    excludes: ['bathroom'],
  },
  {
    canonical: 'bedroom',
    language: 'cs',
    patterns: ['loznice', 'master loznice'],
    excludes: ['koupelna'],
  },

  // ── bathroom ─────────────────────────────────────────────────────
  { canonical: 'bathroom', language: 'en', patterns: ['bathroom', 'shower', 'bath'] },
  { canonical: 'bathroom', language: 'cs', patterns: ['koupelna', 'sprcha'] },

  // ── office ───────────────────────────────────────────────────────
  { canonical: 'office', language: 'en', patterns: ['office', 'study', 'workroom'] },
  { canonical: 'office', language: 'cs', patterns: ['kancelar', 'pracovna'] },

  // ── hallway ──────────────────────────────────────────────────────
  {
    canonical: 'hallway',
    language: 'en',
    patterns: ['hallway', 'corridor', 'entry', 'entryway'],
  },
  { canonical: 'hallway', language: 'cs', patterns: ['chodba', 'predsin'] },

  // ── garage ───────────────────────────────────────────────────────
  { canonical: 'garage', language: 'en', patterns: ['garage', 'garage bay'] },
  { canonical: 'garage', language: 'cs', patterns: ['garaz', 'garaze'] },

  // ── garden ───────────────────────────────────────────────────────
  { canonical: 'garden', language: 'en', patterns: ['garden', 'yard', 'outdoor'] },
  { canonical: 'garden', language: 'cs', patterns: ['zahrada', 'dvorek', 'venku'] },

  // ── dining_room ──────────────────────────────────────────────────
  {
    canonical: 'dining_room',
    language: 'en',
    patterns: ['dining room', 'diningroom'],
  },
  { canonical: 'dining_room', language: 'cs', patterns: ['jidelna'] },

  // ── laundry ──────────────────────────────────────────────────────
  {
    canonical: 'laundry',
    language: 'en',
    patterns: ['laundry', 'laundry room', 'utility room'],
  },
  { canonical: 'laundry', language: 'cs', patterns: ['pradelna', 'pradlo'] },

  // ── basement ─────────────────────────────────────────────────────
  { canonical: 'basement', language: 'en', patterns: ['basement', 'cellar'] },
  { canonical: 'basement', language: 'cs', patterns: ['sklep', 'suteren'] },

  // ── attic ────────────────────────────────────────────────────────
  { canonical: 'attic', language: 'en', patterns: ['attic', 'loft'] },
  { canonical: 'attic', language: 'cs', patterns: ['puda'] },

  // ── kids_room ────────────────────────────────────────────────────
  {
    canonical: 'kids_room',
    language: 'en',
    patterns: ['kids room', 'children room', 'nursery', 'playroom'],
  },
  { canonical: 'kids_room', language: 'cs', patterns: ['detsky pokoj'] },

  // ── guest_room ───────────────────────────────────────────────────
  {
    canonical: 'guest_room',
    language: 'en',
    patterns: ['guest room', 'guestroom'],
  },
  { canonical: 'guest_room', language: 'cs', patterns: ['hostinsky pokoj', 'pokoj pro hosty'] },
]
