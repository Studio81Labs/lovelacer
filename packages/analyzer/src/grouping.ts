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
  if (entity.domain === 'cover') return 'covers'
  if (entity.domain === 'media_player') return 'media'
  if (entity.domain === 'lock') return 'security'
  if (entity.domain === 'camera') return 'cameras'
  if (entity.domain === 'vacuum') return 'vacuum'
  if (entity.domain === 'fan') return 'fans'
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
const GROUP_ORDER: readonly DomainGroupKey[] = Object.freeze([
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
])

/**
 * Bulk grouping. Takes the detection chain's RoomAssignment[] paired
 * with the corresponding NormalizedEntity[], and produces a per-room
 * RoomGrouping[]:
 *
 *   - Hidden + disabled entities dropped before grouping.
 *   - Diagnostic entities preserved in their natural group.
 *   - Within-group entities sorted by friendlyName (case-insensitive).
 *   - Groups within a room ordered by GROUP_ORDER; empty groups dropped.
 *   - Rooms ordered lexicographically by roomId for snapshot stability.
 *
 * Assignments referencing entities not in the entity list are skipped
 * silently (defensive — shouldn't happen with the in-process pipeline).
 */
export function groupByDomain(input: GroupByDomainInput): RoomGrouping[] {
  const entityById = new Map(input.entities.map((e) => [e.entityId, e]))

  // roomId → groupKey → entities[]
  const buckets = new Map<string, Map<DomainGroupKey, NormalizedEntity[]>>()

  for (const assignment of input.assignments) {
    const entity = entityById.get(assignment.entityId)
    if (entity === undefined) continue
    if (entity.isHidden || entity.isDisabled) continue

    const key = domainGroup(entity)
    let roomBucket = buckets.get(assignment.roomId)
    if (roomBucket === undefined) {
      roomBucket = new Map()
      buckets.set(assignment.roomId, roomBucket)
    }
    let groupBucket = roomBucket.get(key)
    if (groupBucket === undefined) {
      groupBucket = []
      roomBucket.set(key, groupBucket)
    }
    groupBucket.push(entity)
  }

  const sortedRoomIds = [...buckets.keys()].sort()
  const result: RoomGrouping[] = []
  for (const roomId of sortedRoomIds) {
    const roomBucket = buckets.get(roomId)!
    const groups: DomainGroup[] = []
    for (const key of GROUP_ORDER) {
      const entities = roomBucket.get(key)
      if (entities === undefined || entities.length === 0) continue
      const sorted = [...entities].sort((a, b) =>
        a.friendlyName.toLowerCase().localeCompare(b.friendlyName.toLowerCase(), 'en'),
      )
      groups.push({ key, entities: sorted })
    }
    result.push({ roomId: roomId as CanonicalRoomId, groups })
  }
  return result
}
