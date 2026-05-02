/**
 * TypeScript shapes for the Lovelace structures the generator constructs.
 *
 * Discriminated `LovelaceCard` union narrows on the `type` literal — code
 * that branches on `card.type === 'tile'` gets full TileCard typing without
 * casts. New card kinds (e.g., 'media-control', 'picture-glance') get added
 * to the union in P1b-2.
 *
 * Structural types (RoomView, GridSection) reflect HA's stable
 * sections-view schema. If HA changes the schema in a future release, these
 * types update in lockstep with the generator.
 */

export interface RoomView {
  type: 'sections'
  title: string
  path: string
  icon: string
  sections: GridSection[]
}

export interface GridSection {
  type: 'grid'
  cards: LovelaceCard[]
}

export type LovelaceCard =
  | HeadingCard
  | TileCard
  | ThermostatCard
  | EntitiesCard
  | MarkdownCard
  | GlanceCard
  | MediaControlCard
  | PictureEntityCard
  | ConditionalCard

export interface HeadingCard {
  type: 'heading'
  heading: string
}

export interface TileCard {
  type: 'tile'
  entity: string
  features?: TileFeature[]
  /** Display name override; default is HA's friendly_name. */
  name?: string
  /**
   * Click behavior; default is HA's per-domain default (toggle for
   * lights, activate for scenes). P1b-5 uses navigate to make Active
   * Rooms tiles deep-link into the room view.
   *
   * Only `navigate` is modelled here; HA also supports `more-info`,
   * `toggle`, `call-service`, `url`, `none`. Future tickets widen the
   * type if/when they need those variants.
   */
  tap_action?: NavigateAction
}

export interface LightBrightnessFeature {
  type: 'light-brightness'
}

export interface CoverOpenCloseFeature {
  type: 'cover-open-close'
}

export interface FanSpeedFeature {
  type: 'fan-speed'
}

export type TileFeature = LightBrightnessFeature | CoverOpenCloseFeature | FanSpeedFeature

/**
 * Condition types discriminate on `condition` (not `type`) to match HA's
 * YAML schema. This is intentionally different from LovelaceCard's `type`
 * discriminator.
 *
 * Single-entity state check: matches when `entity`'s state equals `state`.
 *
 * `state: string` is kept as `string` (not `'on' | 'off'`) because HA
 * state values vary by domain — `'open'`, `'home'`, numeric sensor
 * strings, etc.
 */
export interface StateCondition {
  condition: 'state'
  entity: string
  state: string
}

/** Composite: matches when ANY child condition matches. */
export interface OrCondition {
  condition: 'or'
  conditions: ConditionEntry[]
}

export type ConditionEntry = StateCondition | OrCondition

/** Tap-action variant: navigate to a sibling view in the dashboard. */
export interface NavigateAction {
  action: 'navigate'
  navigation_path: string
}

export interface ThermostatCard {
  type: 'thermostat'
  entity: string
}

export interface EntitiesCard {
  type: 'entities'
  title?: string
  entities: string[]
}

export interface MarkdownCard {
  type: 'markdown'
  content: string
}

/**
 * P2-3 — per-entry overrides on a glance card. HA's actual schema accepts
 * each entries[] element as either a string or an object with overrides.
 * Used by `buildRoomsByFloorSection` to surface room display names + tap-
 * to-navigate on each room glance entry.
 */
export interface GlanceEntityEntry {
  entity: string
  /** Override for HA's friendly_name. Used to surface room names instead of entity names. */
  name?: string
  /** Click behavior. Only `navigate` is modeled today; matches TileCard.tap_action. */
  tap_action?: NavigateAction
}

export interface GlanceCard {
  type: 'glance'
  title?: string
  entities: (string | GlanceEntityEntry)[]
}

export interface MediaControlCard {
  type: 'media-control'
  entity: string
}

export interface PictureEntityCard {
  type: 'picture-entity'
  entity: string
  /** `live` streams the camera; `auto` shows a refreshing snapshot. Snake_case matches HA's YAML schema. */
  camera_view?: 'live' | 'auto'
}

/**
 * HA's conditional card: renders `card` only when ALL `conditions`
 * match. Combine with an `or` composite to get an OR-ANY semantic.
 *
 * P1b-5 uses this for the Active Rooms section: per room, an `or`
 * composite of state checks (lights/motion sensors), wrapping a tile
 * that navigates to the room view.
 */
export interface ConditionalCard {
  type: 'conditional'
  conditions: ConditionEntry[]
  card: LovelaceCard
}
