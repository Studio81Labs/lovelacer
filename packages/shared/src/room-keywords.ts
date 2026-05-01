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
  { canonical: 'kitchen', language: 'de', patterns: ['kuche', 'kochnische'] },

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
  {
    canonical: 'living_room',
    language: 'de',
    patterns: ['wohnzimmer', 'wohnraum', 'wohnbereich'],
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
  // `excludes: ['bad']` mirrors the CS pattern's `excludes: ['koupelna']`
  {
    canonical: 'bedroom',
    language: 'de',
    patterns: ['schlafzimmer', 'schlafraum'],
    excludes: ['bad'],
  },

  // ── bathroom ─────────────────────────────────────────────────────
  { canonical: 'bathroom', language: 'en', patterns: ['bathroom', 'shower', 'bath'] },
  { canonical: 'bathroom', language: 'cs', patterns: ['koupelna', 'sprcha'] },
  {
    canonical: 'bathroom',
    language: 'de',
    patterns: ['bad', 'badezimmer', 'dusche', 'waschraum'],
  },

  // ── office ───────────────────────────────────────────────────────
  { canonical: 'office', language: 'en', patterns: ['office', 'study', 'workroom'] },
  { canonical: 'office', language: 'cs', patterns: ['kancelar', 'pracovna'] },
  { canonical: 'office', language: 'de', patterns: ['buro', 'arbeitszimmer', 'arbeitsraum'] },

  // ── hallway ──────────────────────────────────────────────────────
  {
    canonical: 'hallway',
    language: 'en',
    patterns: ['hallway', 'corridor', 'entry', 'entryway'],
  },
  { canonical: 'hallway', language: 'cs', patterns: ['chodba', 'predsin'] },
  // `Diele` is regional (Northern Germany alternative to `Flur`)
  {
    canonical: 'hallway',
    language: 'de',
    patterns: ['flur', 'diele', 'eingang', 'eingangsbereich'],
  },

  // ── garage ───────────────────────────────────────────────────────
  { canonical: 'garage', language: 'en', patterns: ['garage', 'garage bay'] },
  { canonical: 'garage', language: 'cs', patterns: ['garaz', 'garaze'] },
  { canonical: 'garage', language: 'de', patterns: ['garage'] },

  // ── garden ───────────────────────────────────────────────────────
  { canonical: 'garden', language: 'en', patterns: ['garden', 'yard', 'outdoor'] },
  { canonical: 'garden', language: 'cs', patterns: ['zahrada', 'dvorek', 'venku'] },
  { canonical: 'garden', language: 'de', patterns: ['garten', 'aussen', 'terrasse', 'balkon'] },

  // ── dining_room ──────────────────────────────────────────────────
  {
    canonical: 'dining_room',
    language: 'en',
    patterns: ['dining room', 'diningroom'],
  },
  { canonical: 'dining_room', language: 'cs', patterns: ['jidelna'] },
  {
    canonical: 'dining_room',
    language: 'de',
    patterns: ['esszimmer', 'essbereich', 'speisezimmer'],
  },

  // ── laundry ──────────────────────────────────────────────────────
  {
    canonical: 'laundry',
    language: 'en',
    patterns: ['laundry', 'laundry room', 'utility room'],
  },
  { canonical: 'laundry', language: 'cs', patterns: ['pradelna', 'pradlo'] },
  // `waschraum` overlap with bathroom is intentional; corroboration breaks ties
  {
    canonical: 'laundry',
    language: 'de',
    patterns: ['waschkuche', 'hauswirtschaftsraum', 'waschraum'],
  },

  // ── basement ─────────────────────────────────────────────────────
  { canonical: 'basement', language: 'en', patterns: ['basement', 'cellar'] },
  { canonical: 'basement', language: 'cs', patterns: ['sklep', 'suteren'] },
  { canonical: 'basement', language: 'de', patterns: ['keller', 'untergeschoss'] },

  // ── attic ────────────────────────────────────────────────────────
  { canonical: 'attic', language: 'en', patterns: ['attic', 'loft'] },
  { canonical: 'attic', language: 'cs', patterns: ['puda'] },
  // `'speicher'` alone is too generic; use the explicit compound
  {
    canonical: 'attic',
    language: 'de',
    patterns: ['dachboden', 'speicherraum', 'dachgeschoss'],
  },

  // ── kids_room ────────────────────────────────────────────────────
  {
    canonical: 'kids_room',
    language: 'en',
    patterns: ['kids room', 'children room', 'nursery', 'playroom'],
  },
  { canonical: 'kids_room', language: 'cs', patterns: ['detsky pokoj'] },
  { canonical: 'kids_room', language: 'de', patterns: ['kinderzimmer', 'kinder'] },

  // ── guest_room ───────────────────────────────────────────────────
  {
    canonical: 'guest_room',
    language: 'en',
    patterns: ['guest room', 'guestroom'],
  },
  { canonical: 'guest_room', language: 'cs', patterns: ['hostinsky pokoj', 'pokoj pro hosty'] },
  { canonical: 'guest_room', language: 'de', patterns: ['gastezimmer', 'gastzimmer'] },
]
