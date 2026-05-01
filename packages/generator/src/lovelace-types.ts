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

export interface HeadingCard {
  type: 'heading'
  heading: string
}

export interface TileCard {
  type: 'tile'
  entity: string
  features?: TileFeature[]
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

export interface GlanceCard {
  type: 'glance'
  title?: string
  entities: string[]
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
