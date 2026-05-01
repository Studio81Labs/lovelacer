/**
 * Types and errors for the storage-mode apply flow. The methods live on
 * `HaClient` (see client.ts) — this file holds the supporting surface so
 * client.ts stays focused on connection lifecycle.
 */

export interface ApplyDashboardOptions {
  /** Default 'lovelacer-home'. The HA `url_path` segment. */
  urlPath?: string
  /** Default 'Lovelacer — Home'. The dashboard title shown in the sidebar. */
  title?: string
  /** Default 'mdi:home-variant'. The sidebar icon. */
  icon?: string
  /** Default true. Whether to show the dashboard in HA's sidebar. */
  showInSidebar?: boolean
  /** Default false. Whether the dashboard requires admin to view. */
  requireAdmin?: boolean
}

export interface ApplyDashboardResult {
  urlPath: string
  /** True if the dashboard was freshly created; false if updated existing. */
  created: boolean
}

export interface HaDashboardEntry {
  id: string
  url_path: string
  title: string
  icon: string | null
  show_in_sidebar: boolean
  require_admin: boolean
  mode: 'storage' | 'yaml'
}

/**
 * Defaults applied when the caller omits the corresponding field from
 * `ApplyDashboardOptions`. Frozen to prevent accidental mutation; the
 * field-by-field merge in `applyDashboard` reads from this constant.
 */
export const DEFAULT_APPLY_OPTIONS = Object.freeze({
  urlPath: 'lovelacer-home',
  title: 'Lovelacer — Home',
  icon: 'mdi:home-variant',
  showInSidebar: true,
  requireAdmin: false,
} as const)

/**
 * Thrown when any of the three WS calls in `applyDashboard` fails. The
 * `step` field tells the caller which call failed so route handlers can
 * surface meaningful errors to the frontend.
 */
export class HaApplyError extends Error {
  readonly step: 'list' | 'create' | 'save'
  override readonly cause: unknown
  constructor(step: HaApplyError['step'], message: string, cause: unknown) {
    super(message)
    this.name = 'HaApplyError'
    this.step = step
    this.cause = cause
  }
}
