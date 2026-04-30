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

export type LovelaceCard = HeadingCard | TileCard | ThermostatCard | EntitiesCard

export interface HeadingCard {
  type: 'heading'
  heading: string
}

export interface TileCard {
  type: 'tile'
  entity: string
  features?: TileFeature[]
}

export type TileFeature = { type: 'light-brightness' }

export interface ThermostatCard {
  type: 'thermostat'
  entity: string
}

export interface EntitiesCard {
  type: 'entities'
  title?: string
  entities: string[]
}
