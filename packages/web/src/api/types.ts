/**
 * API surface mirroring the server's pipeline output. Defined locally
 * (not imported from `@lovelacer/server`) so the web package doesn't
 * drag Fastify's deps into the browser bundle.
 *
 * P1b extracts these into a shared `@lovelacer/api-types` package.
 * For now, server-side snapshot tests catch any shape change here.
 */

export interface DetectionSignal {
  source: string
  weight: number
  matchedValue?: string
}

export interface RoomAssignment {
  entityId: string
  roomId: string
  confidence: number
  signals: DetectionSignal[]
  /** Set to true by the server's pipeline patch when an override moved this entity. */
  manual?: boolean
}

/**
 * P2-5 — three rule-based hints. Mirrored from `@lovelacer/shared`.
 * `suggestedRoomId` and `matchedRoomId` are widened to `string` to match
 * this package's CanonicalRoomId-isolation convention (see Override.roomId).
 */
export type SuggestionType = 'set_area_id' | 'move_room' | 'hide_diagnostic'

export interface Suggestion {
  entityId: string
  type: SuggestionType
  message: string
  /** For move_room only. */
  suggestedRoomId?: string
  /** For set_area_id only. */
  matchedRoomId?: string
}

/**
 * User-specified override for a single entity. Mirrors the server-side
 * shape from @lovelacer/shared (duplicated here to keep the web package
 * independent — the server's shape evolves in lockstep).
 */
export interface Override {
  entityId: string
  /** CanonicalRoomId at runtime; widened to string to avoid duplicating the union here. */
  roomId?: string
  hidden?: boolean
}

export interface AnalyzedRoom {
  id: string
  haAreaId: string | null
  displayName: string
  entityCount: number
  averageConfidence: number
  assignments: RoomAssignment[]
}

export interface MiscEntity {
  entityId: string
  friendlyName: string
  domain: string
}

export interface HiddenEntity {
  entityId: string
  friendlyName: string
  domain: string
  roomId?: string
}

export interface PreviewSummary {
  entityCount: number
  roomCount: number
  miscCount: number
}

export interface LovelaceView {
  type: string
  title: string
  path: string
  icon: string
  sections?: unknown[]
}

export interface LovelaceConfig {
  title: string
  views: LovelaceView[]
}

export interface AnalyzeOutput {
  rooms: AnalyzedRoom[]
  misc: MiscEntity[]
  hidden?: HiddenEntity[]
  summary: PreviewSummary
}

export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
  /**
   * Diff vs. the last applied snapshot, or `null` on first ever preview
   * (no prior snapshot to compare against).
   */
  diff: DiffResult | null
  /** P2-5 — actionable suggestions. Always present (empty array when none). */
  suggestions: Suggestion[]
}

export interface ApplyResult {
  ok: true
  urlPath: string
  created: boolean
  /**
   * Snake_case is intentional — these fields match the server wire shape
   * (see `packages/server/src/routes/apply.ts` `ApplySuccessResponse`).
   * Don't auto-reformat to camelCase or the contract breaks.
   */
  /** Server flag: snapshot was rejected as malformed. Push still succeeded. */
  snapshot_skipped?: 'invalid'
  /** Server flag: snapshot persist failed. Push still succeeded. */
  snapshot_persisted?: false
}

/**
 * Snapshot/diff types mirror the server contract.
 *
 * `roomId` is `string | null` (not the full `CanonicalRoomId` union from
 * `@lovelacer/shared`) to keep the web package independent of the shared
 * runtime — same widening pattern used by `Override.roomId` above.
 */
export interface SnapshotAssignment {
  entityId: string
  roomId: string | null
}

export interface AppliedSnapshot {
  assignments: SnapshotAssignment[]
  config: unknown
  appliedAt: number
}

export type DiffKind = 'added' | 'moved' | 'removed'

export interface EntityDiff {
  entityId: string
  kind: DiffKind
  previousRoomId?: string | null
  currentRoomId?: string | null
}

export interface RoomDiffSummary {
  added: number
  movedIn: number
  movedOut: number
}

export interface DiffResult {
  entities: EntityDiff[]
  perRoom: Record<string, RoomDiffSummary>
  totals: { added: number; moved: number; removed: number }
  appliedAt: number
}

/**
 * P2-6 — Settings shape. Mirrored from `@lovelacer/shared`. All field
 * names match the server-side shape exactly. `language` and `cardPack`
 * stay as their string literal unions (no widening — there's no
 * CanonicalRoomId concern here).
 */
export type SettingsLanguage = 'auto' | 'en' | 'cs'

export type SettingsCardPack = 'default'

/**
 * P2-9 — UI display language. Mirrored from `@lovelacer/shared`. The
 * web's vue-i18n `UiLocale` is the same string union; this type lives
 * on `Settings` because the field is server-persisted.
 */
export type UiLanguage = 'en' | 'cs' | 'de'

export interface SettingsSections {
  welcome: boolean
  quickStats: boolean
  people: boolean
  roomsByFloor: boolean
  activeRooms: boolean
  scenes: boolean
  cameras: boolean
}

export interface Settings {
  language: SettingsLanguage
  cardPack: SettingsCardPack
  sections: SettingsSections
  /**
   * P2-9 — Optional. Absent when the user has never explicitly chosen a
   * UI language. The SPA preserves whatever locale `detectInitialLocale`
   * picked in that case. When set, it represents an explicit user choice
   * and the reconciliation watcher syncs the active locale to it.
   */
  uiLanguage?: UiLanguage
}

/** Defaults preserve current behavior — mirror of @lovelacer/shared's value. */
export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  cardPack: 'default',
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
 * P2-7 — Onboarding wizard completion status. Mirrored from
 * `@lovelacer/server`'s `OnboardingStore`. `completedAt: null` means
 * the user hasn't completed the wizard yet (fresh install). A unix
 * timestamp means they completed it (via Apply success or Skip).
 */
export interface OnboardingStatus {
  completedAt: number | null
}

/**
 * The error envelope every non-2xx response body conforms to. `step` is
 * present only when `error === 'ha_apply_failed'`. `'network'` is a
 * client-side signal that fetch itself rejected or the response wasn't
 * parseable JSON — never sent by the server.
 */
export interface ApiError {
  error:
    | 'ha_unavailable'
    | 'analyze_failed'
    | 'preview_failed'
    | 'invalid_config'
    | 'ha_apply_failed'
    | 'apply_failed'
    | 'invalid_body'
    | 'storage_error'
    | 'invite_required'
    | 'invalid_code'
    | 'network'
  step?: 'list' | 'create' | 'save'
  message: string
}
