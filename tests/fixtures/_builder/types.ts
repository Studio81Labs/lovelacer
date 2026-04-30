/**
 * Fixture authoring types.
 *
 * The Fixture object is the single source of truth for a named test
 * dataset. The loader script consumes a Fixture and writes both
 * .storage/core.*_registry JSON files and a template: YAML block.
 */

export type FixtureDomain =
  | 'sensor'
  | 'binary_sensor'
  | 'switch'
  | 'light'
  | 'climate'
  | 'cover'
  | 'media_player'
  | 'lock'
  | 'fan'
  | 'camera'
  | 'vacuum'

export interface FloorSpec {
  id: string
  name: string
  level: number | null
  icon: string | null
}

export interface AreaSpec {
  id: string
  name: string
  floor: string | null
  icon: string | null
}

export interface DeviceSpec {
  id: string
  name: string
  nameByUser: string | null
  manufacturer: string | null
  model: string | null
  area: string | null
}

export interface EntitySpec {
  domain: FixtureDomain
  objectId: string
  uniqueId: string
  originalName: string
  nameByUser: string | null
  area: string | null
  device: string | null
  deviceClass: string | null
  entityCategory: 'config' | 'diagnostic' | null
  hidden: boolean
  disabled: boolean
  /**
   * State value used when the loader emits a `template:` YAML block.
   * Ignored for domains the template integration cannot represent.
   */
  templateState: string | null
}

export interface FixtureMeta {
  name: string
  description: string
}

export interface Fixture {
  meta: FixtureMeta
  floors: FloorSpec[]
  areas: AreaSpec[]
  devices: DeviceSpec[]
  entities: EntitySpec[]
}
