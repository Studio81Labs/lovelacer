import type { CanonicalRoomId, NormalizedEntity, RoomAssignment } from '@lovelacer/shared'

/**
 * Display categories for the generator. P1a populates 5 of these
 * (lights, environment, activity, climate, other). The other 6 keys
 * are pre-declared for P1b-2 — `domainGroup` doesn't return them yet.
 */
export type DomainGroupKey =
  | 'lights' // P1a — light + switch
  | 'environment' // P1a — sensor (temperature, humidity)
  | 'activity' // P1a — binary_sensor (motion, occupancy, door)
  | 'climate' // P1a — climate
  | 'covers' // P1b
  | 'media' // P1b
  | 'security' // P1b — lock
  | 'cameras' // P1b
  | 'vacuum' // P1b
  | 'fans' // P1b
  | 'other' // fallback

export interface DomainGroup {
  key: DomainGroupKey
  /** Sorted alphabetically by friendlyName (case-insensitive). */
  entities: NormalizedEntity[]
}

export interface RoomGrouping {
  roomId: CanonicalRoomId
  /** Groups in GROUP_ORDER, with empty groups dropped. */
  groups: DomainGroup[]
}

export interface GroupByDomainInput {
  assignments: RoomAssignment[]
  entities: NormalizedEntity[]
}

const SENSOR_ENVIRONMENT_CLASSES = new Set(['temperature', 'humidity'])
const BINARY_SENSOR_ACTIVITY_CLASSES = new Set(['motion', 'occupancy', 'door'])

/**
 * Pure routing: given an entity, which display group does it belong to?
 *
 * Routes light/switch → lights, climate → climate, filtered sensor →
 * environment, filtered binary_sensor → activity, everything else →
 * other. `entityCategory` does not affect routing — diagnostic entities
 * still go to their natural group.
 */
export function domainGroup(entity: NormalizedEntity): DomainGroupKey {
  if (entity.domain === 'light' || entity.domain === 'switch') return 'lights'
  if (entity.domain === 'climate') return 'climate'
  if (entity.domain === 'sensor' && entity.deviceClass !== null) {
    if (SENSOR_ENVIRONMENT_CLASSES.has(entity.deviceClass)) return 'environment'
  }
  if (entity.domain === 'binary_sensor' && entity.deviceClass !== null) {
    if (BINARY_SENSOR_ACTIVITY_CLASSES.has(entity.deviceClass)) return 'activity'
  }
  return 'other'
}

/**
 * Display order for groups within a room. `lights` first because
 * they're the most-interacted control. `other` always last. P1b keys
 * have positions reserved so adding their data doesn't shift existing
 * orders in snapshots.
 */
const GROUP_ORDER: readonly DomainGroupKey[] = [
  'lights',
  'climate',
  'covers',
  'media',
  'cameras',
  'activity',
  'environment',
  'security',
  'vacuum',
  'fans',
  'other',
]

// groupByDomain lands in Task 2.
// The unused imports/declarations below are referenced via type re-exports
// so noUnusedLocals doesn't flag them. Task 2 removes these placeholders.
export type _Internal_RoomAssignment = RoomAssignment
export type _Internal_GroupByDomainInput = GroupByDomainInput
export type _Internal_RoomGrouping = RoomGrouping
export type _Internal_DomainGroup = DomainGroup
// GROUP_ORDER is referenced via this expression so noUnusedLocals doesn't
// flag it. Task 2 uses it directly.
export const _Internal_GroupOrderRef = GROUP_ORDER
