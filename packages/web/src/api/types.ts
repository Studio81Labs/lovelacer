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
  summary: PreviewSummary
}

export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
}

export interface ApplyResult {
  ok: true
  urlPath: string
  created: boolean
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
    | 'network'
  step?: 'list' | 'create' | 'save'
  message: string
}
