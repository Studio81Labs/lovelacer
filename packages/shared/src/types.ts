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
 * Analyzer-level language union. This is intentionally broader than the
 * user-facing detection setting so future keyword packs can be added as
 * data. `ROOM_KEYWORDS` contains the keyword data that ships today, while
 * `SUPPORTED_LANGUAGES` below controls which languages users can select
 * explicitly in settings.
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
  /**
   * P2-5 — top-N candidate rooms (excluding the winner) that scored
   * above the detector's alternative threshold. Used by the suggestion
   * engine to power "consider X instead" prompts. Capped at 2 entries
   * to avoid noise. Field is omitted entirely when empty so consumers
   * can `if (a.alternatives !== undefined)` cleanly under
   * exactOptionalPropertyTypes.
   */
  alternatives?: AlternativeAssignment[]
}

export interface AlternativeAssignment {
  roomId: CanonicalRoomId
  confidence: number
}

/**
 * P2-5 — the canonical list of valid SuggestionType values, exposed as
 * a tuple `as const` so Zod (and any future runtime validator) can
 * derive an enum from it. Keep this in lockstep with the union below;
 * adding a new type means appending here AND extending `SuggestionType`.
 */
export const SUGGESTION_TYPES = ['set_area_id', 'move_room', 'hide_diagnostic'] as const

/**
 * P2-5 — three rule-based hints surfaced on the analyze view. Each has
 * an Accept verb (delegated to existing override calls or a HA deep-link)
 * and a Dismiss verb that persists across runs via DismissedSuggestionStore.
 */
export type SuggestionType = (typeof SUGGESTION_TYPES)[number]

export interface Suggestion {
  entityId: string
  type: SuggestionType
  /** Brief user-facing prose. Localizable later (P2-9). */
  message: string
  /** For move_room only: the suggested target room (top alternative). */
  suggestedRoomId?: CanonicalRoomId
  /** For set_area_id only: the canonical room we matched. Used for the deep-link + display. */
  matchedRoomId?: CanonicalRoomId
}

/**
 * P2-6 — User-facing language setting values. Subset of `LanguageCode`
 * plus the `'auto'` sentinel, restricted to languages supported as
 * explicit settings today. Expand this tuple when a language is ready
 * to be user-selectable, not merely present as keyword data.
 *
 * Exposed as a tuple `as const` so the route's Zod enum derives from
 * a single source of truth. `'auto'` matches all available keyword
 * sets simultaneously and preserves HA area names for room titles when
 * available. Specific languages narrow the matcher to that language's
 * keywords for priorities 3-5 and localize generated room titles from
 * canonical room IDs.
 */
export const SUPPORTED_LANGUAGES = ['auto', 'en', 'cs', 'de', 'es', 'fr', 'it', 'nl', 'pl'] as const

/**
 * Detection language for name-based matching and generated room titles.
 * `'auto'` is the match-all default across shipped keyword data and keeps
 * HA area names as room titles when available.
 */
export type SettingsLanguage = (typeof SUPPORTED_LANGUAGES)[number]

/**
 * P2-6 — User-facing card-pack setting values. Stub for a future
 * ticket; only `'default'` ships today. Exposed as a tuple `as const`
 * so the route's Zod enum derives from a single source of truth.
 */
export const SUPPORTED_CARD_PACKS = ['default'] as const

/**
 * Card-style pack identifier. Persisted but the generator currently
 * ignores the value — wire-up for a future ticket.
 */
export type SettingsCardPack = (typeof SUPPORTED_CARD_PACKS)[number]

/**
 * P2-9 — UI display language for the web app's interface. ORTHOGONAL
 * to `SettingsLanguage` (which controls room-name keyword detection).
 * Limited to the locales with shipped vue-i18n message bundles today.
 * Exposed as a tuple `as const` so the route's Zod enum and the web
 * store's union type derive from a single source.
 */
export const SUPPORTED_UI_LANGUAGES = ['en', 'cs', 'de', 'es', 'fr', 'it', 'nl', 'pl'] as const

/**
 * UI display language. Persisted on the server alongside detection
 * `language`; the web app mirrors it into vue-i18n's `locale` ref.
 */
export type UiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number]

export const SUPPORTED_THEMES = ['system', 'light', 'dark'] as const

/**
 * Web UI color theme. `system` follows `prefers-color-scheme` and is the
 * default for fresh installs.
 */
export type SettingsTheme = (typeof SUPPORTED_THEMES)[number]

/** Visibility toggles for the seven sections of the home view. */
export interface SettingsSections {
  welcome: boolean
  quickStats: boolean
  people: boolean
  roomsByFloor: boolean
  activeRooms: boolean
  scenes: boolean
  cameras: boolean
}

export interface RoomDisplayOverride {
  name?: string
  icon?: string
  showNameOnCard?: boolean
  hiddenFromDashboard?: boolean
}

export interface Settings {
  /**
   * Detection language for name-based matching and generated room titles.
   * `'auto'` matches all available keyword sets simultaneously — today's
   * behavior — and preserves HA area names for room titles when available.
   * Specific languages narrow the matcher to that set's keywords and use
   * localized canonical room names for generated titles. Priorities 1-2
   * (HA-supplied area names) stay multilingual for assignment.
   */
  language: SettingsLanguage

  /**
   * Card-style pack for the generator. Stub for a future ticket — only
   * `'default'` is shipped today. Persisted but the generator currently
   * ignores the value.
   */
  cardPack: SettingsCardPack

  /**
   * Per-section visibility toggles for the home view. Each flag controls
   * whether the corresponding section is rendered in `buildHomeView`.
   */
  sections: SettingsSections

  /**
   * P2-9 — UI display language for the web interface. Orthogonal to
   * `language` above (which controls room detection). OPTIONAL by
   * design: when absent, the user has not explicitly chosen a UI
   * language, and the SPA preserves whatever locale
   * `detectInitialLocale()` picked (browser language → cached → 'en').
   * When present, it represents an explicit user choice and the
   * reconciliation watcher syncs the active locale to it.
   */
  uiLanguage?: UiLanguage

  /**
   * Color theme for the Lovelacer web UI. `system` follows the
   * browser/OS preference and is the default.
   */
  theme: SettingsTheme

  /**
   * Optional user-preferred room order. Values are room ids as surfaced
   * by analysis output. Missing ids are appended by the UI/server in
   * deterministic display-name order, so legacy rows and newly detected
   * rooms keep working without migration.
   */
  roomOrder?: string[]

  /**
   * Optional user-preferred room display metadata keyed by analyzed room id.
   * Missing fields fall back to detected/canonical defaults.
   */
  roomOverrides?: Record<string, RoomDisplayOverride>
}

/**
 * Defaults preserve every current behavior. A user who installs P2-6
 * and never opens the modal sees zero change.
 */
export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  cardPack: 'default',
  theme: 'system',
  sections: {
    welcome: true,
    quickStats: true,
    people: true,
    roomsByFloor: true,
    activeRooms: true,
    scenes: true,
    cameras: true,
  },
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
  icon: string
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
