import type { RoomKeyword } from './types.js'

/**
 * Room keyword database. Localized substring patterns the analyzer uses
 * to detect which canonical room an entity belongs to.
 *
 * STORAGE CONVENTION: patterns and excludes are stored PRE-NORMALIZED —
 * lowercase, no diacritics, single-space-separated, only [a-z0-9 ']. The
 * matcher normalizes its input the same way and uses substring matching.
 * Writing `kuchyně` here will silently fail to match anything; the schema
 * test in __tests__/room-keywords.test.ts catches this at CI time.
 *
 * Adding a new keyword language: append rows. No type changes are needed
 * because LanguageCode reserves future locales. Add the language to
 * SUPPORTED_LANGUAGES only when it should become explicitly user-selectable;
 * until then, rows participate through the `auto` setting.
 */
export const ROOM_KEYWORDS: RoomKeyword[] = [
  // ── kitchen ──────────────────────────────────────────────────────
  { canonical: 'kitchen', language: 'en', patterns: ['kitchen', 'kitchenette'] },
  { canonical: 'kitchen', language: 'cs', patterns: ['kuchyne', 'kuch'] },
  { canonical: 'kitchen', language: 'de', patterns: ['kuche', 'kochnische'] },
  { canonical: 'kitchen', language: 'es', patterns: ['cocina', 'cocineta'] },
  { canonical: 'kitchen', language: 'fr', patterns: ['cuisine', 'kitchenette'] },
  { canonical: 'kitchen', language: 'it', patterns: ['cucina', 'cucinino', 'angolo cottura'] },
  { canonical: 'kitchen', language: 'nl', patterns: ['keuken', 'kitchenette'] },
  { canonical: 'kitchen', language: 'pl', patterns: ['kuchnia', 'aneks kuchenny'] },

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
  {
    canonical: 'living_room',
    language: 'es',
    patterns: ['salon', 'sala', 'sala de estar'],
  },
  {
    canonical: 'living_room',
    language: 'fr',
    patterns: ['salon', 'sejour', 'salle de sejour'],
  },
  {
    canonical: 'living_room',
    language: 'it',
    patterns: ['soggiorno', 'salotto', 'living'],
  },
  {
    canonical: 'living_room',
    language: 'nl',
    patterns: ['woonkamer', 'zitkamer'],
  },
  {
    canonical: 'living_room',
    language: 'pl',
    patterns: ['salon', 'pokoj dzienny'],
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
  {
    canonical: 'bedroom',
    language: 'es',
    patterns: ['dormitorio', 'habitacion', 'cuarto'],
    excludes: ['bano'],
  },
  {
    canonical: 'bedroom',
    language: 'fr',
    patterns: ['chambre'],
    excludes: ['salle de bain'],
  },
  {
    canonical: 'bedroom',
    language: 'it',
    patterns: ['camera da letto', 'stanza letto'],
    excludes: ['bagno'],
  },
  {
    canonical: 'bedroom',
    language: 'nl',
    patterns: ['slaapkamer', 'slaapruimte'],
    excludes: ['badkamer'],
  },
  {
    canonical: 'bedroom',
    language: 'pl',
    patterns: ['sypialnia'],
    excludes: ['lazienka'],
  },

  // ── bathroom ─────────────────────────────────────────────────────
  { canonical: 'bathroom', language: 'en', patterns: ['bathroom', 'shower', 'bath'] },
  { canonical: 'bathroom', language: 'cs', patterns: ['koupelna', 'sprcha'] },
  {
    canonical: 'bathroom',
    language: 'de',
    patterns: ['bad', 'badezimmer', 'dusche', 'waschraum'],
  },
  { canonical: 'bathroom', language: 'es', patterns: ['bano', 'cuarto de bano', 'ducha'] },
  {
    canonical: 'bathroom',
    language: 'fr',
    patterns: ['salle de bain', 'salle de bains', 'douche'],
  },
  { canonical: 'bathroom', language: 'it', patterns: ['bagno', 'doccia'] },
  { canonical: 'bathroom', language: 'nl', patterns: ['badkamer', 'douche'] },
  { canonical: 'bathroom', language: 'pl', patterns: ['lazienka', 'prysznic'] },

  // ── office ───────────────────────────────────────────────────────
  { canonical: 'office', language: 'en', patterns: ['office', 'study', 'workroom'] },
  { canonical: 'office', language: 'cs', patterns: ['kancelar', 'pracovna'] },
  { canonical: 'office', language: 'de', patterns: ['buro', 'arbeitszimmer', 'arbeitsraum'] },
  { canonical: 'office', language: 'es', patterns: ['oficina', 'despacho', 'estudio'] },
  { canonical: 'office', language: 'fr', patterns: ['bureau'] },
  { canonical: 'office', language: 'it', patterns: ['ufficio', 'studio'] },
  { canonical: 'office', language: 'nl', patterns: ['kantoor', 'studeerkamer', 'werkkamer'] },
  { canonical: 'office', language: 'pl', patterns: ['biuro', 'gabinet'] },

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
  {
    canonical: 'hallway',
    language: 'es',
    patterns: ['pasillo', 'entrada', 'recibidor', 'vestibulo'],
  },
  { canonical: 'hallway', language: 'fr', patterns: ['couloir', 'entree'] },
  { canonical: 'hallway', language: 'it', patterns: ['corridoio', 'ingresso', 'atrio'] },
  { canonical: 'hallway', language: 'nl', patterns: ['gang', 'entree'] },
  { canonical: 'hallway', language: 'pl', patterns: ['korytarz', 'przedpokoj', 'wejscie'] },

  // ── garage ───────────────────────────────────────────────────────
  { canonical: 'garage', language: 'en', patterns: ['garage', 'garage bay'] },
  { canonical: 'garage', language: 'cs', patterns: ['garaz', 'garaze'] },
  { canonical: 'garage', language: 'de', patterns: ['garage'] },
  { canonical: 'garage', language: 'es', patterns: ['garaje', 'cochera'] },
  { canonical: 'garage', language: 'fr', patterns: ['garage'] },
  { canonical: 'garage', language: 'it', patterns: ['garage', 'autorimessa'] },
  { canonical: 'garage', language: 'nl', patterns: ['garage'] },
  { canonical: 'garage', language: 'pl', patterns: ['garaz'] },

  // ── garden ───────────────────────────────────────────────────────
  { canonical: 'garden', language: 'en', patterns: ['garden', 'yard', 'outdoor'] },
  { canonical: 'garden', language: 'cs', patterns: ['zahrada', 'dvorek', 'venku'] },
  { canonical: 'garden', language: 'de', patterns: ['garten', 'aussen', 'terrasse', 'balkon'] },
  {
    canonical: 'garden',
    language: 'es',
    patterns: ['jardin', 'patio', 'exterior', 'terraza', 'balcon'],
  },
  {
    canonical: 'garden',
    language: 'fr',
    patterns: ['jardin', 'exterieur', 'terrasse', 'balcon'],
  },
  {
    canonical: 'garden',
    language: 'it',
    patterns: ['giardino', 'esterno', 'terrazza', 'balcone'],
  },
  { canonical: 'garden', language: 'nl', patterns: ['tuin', 'buiten', 'terras', 'balkon'] },
  { canonical: 'garden', language: 'pl', patterns: ['ogrod', 'zewnatrz', 'taras', 'balkon'] },

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
  { canonical: 'dining_room', language: 'es', patterns: ['comedor'] },
  { canonical: 'dining_room', language: 'fr', patterns: ['salle a manger'] },
  { canonical: 'dining_room', language: 'it', patterns: ['sala da pranzo', 'pranzo'] },
  { canonical: 'dining_room', language: 'nl', patterns: ['eetkamer', 'eethoek'] },
  { canonical: 'dining_room', language: 'pl', patterns: ['jadalnia'] },

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
  {
    canonical: 'laundry',
    language: 'es',
    patterns: ['lavanderia', 'lavadero', 'cuarto de lavado'],
  },
  { canonical: 'laundry', language: 'fr', patterns: ['buanderie', 'lingerie'] },
  { canonical: 'laundry', language: 'it', patterns: ['lavanderia', 'bucato'] },
  { canonical: 'laundry', language: 'nl', patterns: ['wasruimte', 'bijkeuken'] },
  { canonical: 'laundry', language: 'pl', patterns: ['pralnia'] },

  // ── basement ─────────────────────────────────────────────────────
  { canonical: 'basement', language: 'en', patterns: ['basement', 'cellar'] },
  { canonical: 'basement', language: 'cs', patterns: ['sklep', 'suteren'] },
  { canonical: 'basement', language: 'de', patterns: ['keller', 'untergeschoss'] },
  { canonical: 'basement', language: 'es', patterns: ['sotano', 'bodega'] },
  { canonical: 'basement', language: 'fr', patterns: ['sous sol', 'cave'] },
  { canonical: 'basement', language: 'it', patterns: ['seminterrato', 'cantina'] },
  { canonical: 'basement', language: 'nl', patterns: ['kelder'] },
  { canonical: 'basement', language: 'pl', patterns: ['piwnica'] },

  // ── attic ────────────────────────────────────────────────────────
  { canonical: 'attic', language: 'en', patterns: ['attic', 'loft'] },
  { canonical: 'attic', language: 'cs', patterns: ['puda'] },
  // `'speicher'` alone is too generic; use the explicit compound
  {
    canonical: 'attic',
    language: 'de',
    patterns: ['dachboden', 'speicherraum', 'dachgeschoss'],
  },
  { canonical: 'attic', language: 'es', patterns: ['atico', 'desvan', 'buhardilla'] },
  { canonical: 'attic', language: 'fr', patterns: ['grenier', 'combles'] },
  { canonical: 'attic', language: 'it', patterns: ['soffitta', 'mansarda'] },
  { canonical: 'attic', language: 'nl', patterns: ['zolder'] },
  { canonical: 'attic', language: 'pl', patterns: ['strych', 'poddasze'] },

  // ── kids_room ────────────────────────────────────────────────────
  {
    canonical: 'kids_room',
    language: 'en',
    patterns: ['kids room', 'children room', 'nursery', 'playroom'],
  },
  { canonical: 'kids_room', language: 'cs', patterns: ['detsky pokoj'] },
  { canonical: 'kids_room', language: 'de', patterns: ['kinderzimmer', 'kinder'] },
  {
    canonical: 'kids_room',
    language: 'es',
    patterns: ['habitacion infantil', 'cuarto infantil', 'habitacion ninos'],
  },
  {
    canonical: 'kids_room',
    language: 'fr',
    patterns: ['chambre enfant', 'chambre enfants', 'salle de jeux'],
  },
  {
    canonical: 'kids_room',
    language: 'it',
    patterns: ['camera bambini', 'cameretta', 'stanza giochi'],
  },
  { canonical: 'kids_room', language: 'nl', patterns: ['kinderkamer', 'speelkamer'] },
  { canonical: 'kids_room', language: 'pl', patterns: ['pokoj dzieciecy', 'pokoj dzieci'] },

  // ── guest_room ───────────────────────────────────────────────────
  {
    canonical: 'guest_room',
    language: 'en',
    patterns: ['guest room', 'guestroom'],
  },
  { canonical: 'guest_room', language: 'cs', patterns: ['hostinsky pokoj', 'pokoj pro hosty'] },
  { canonical: 'guest_room', language: 'de', patterns: ['gastezimmer', 'gastzimmer'] },
  {
    canonical: 'guest_room',
    language: 'es',
    patterns: [
      'habitacion invitados',
      'habitacion de invitados',
      'cuarto invitados',
      'cuarto de invitados',
      'dormitorio invitados',
      'dormitorio de invitados',
    ],
  },
  {
    canonical: 'guest_room',
    language: 'fr',
    patterns: [
      'chambre invite',
      'chambre invites',
      "chambre d'invite",
      "chambre d'invites",
      'chambre amis',
      "chambre d'amis",
    ],
  },
  {
    canonical: 'guest_room',
    language: 'it',
    patterns: ['camera ospiti', 'stanza ospiti'],
  },
  { canonical: 'guest_room', language: 'nl', patterns: ['logeerkamer', 'gastenkamer'] },
  { canonical: 'guest_room', language: 'pl', patterns: ['pokoj goscinny', 'pokoj dla gosci'] },
]
