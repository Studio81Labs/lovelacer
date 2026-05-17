import type { CanonicalRoomId, NormalizedEntity } from '@lovelacer/shared'
import type { DomainGroup, DomainGroupKey, RoomGrouping } from '@lovelacer/analyzer'
import type {
  EntityCardEntry,
  EntitiesCard,
  GridSection,
  HeadingCard,
  LovelaceCard,
  MediaControlCard,
  PictureEntityCard,
  RoomView,
  ThermostatCard,
  TileCard,
} from './lovelace-types.js'
import { resolveRoomDisplay, shouldShowRoomNameOnCard, type RoomDisplayOverrides } from './rooms.js'

export type RoomDisplayNames = Partial<Record<CanonicalRoomId, string>>
export type RoomNamePrefixCandidates = Partial<Record<CanonicalRoomId, string[]>>

const GROUP_HEADINGS: Record<DomainGroupKey, string> = {
  lights: 'Lights & Outlets',
  climate: 'Climate',
  covers: 'Covers',
  media: 'Media',
  cameras: 'Cameras',
  activity: 'Activity',
  environment: 'Environment',
  security: 'Security',
  vacuum: 'Vacuum',
  fans: 'Fans',
  other: 'Other',
}

/**
 * Convert one analyzer RoomGrouping into a Lovelace `type: 'sections'`
 * view. Each input group becomes one grid section with a heading card
 * followed by per-entity cards (or a single grouped entities card,
 * depending on the group key).
 *
 * Pure function. Preserves the input's entity order within groups and
 * the input's group order within the room (P1a-5 already sorted both).
 */
export function buildRoomView(
  grouping: RoomGrouping,
  roomOverrides: RoomDisplayOverrides = {},
  roomDisplayNames: RoomDisplayNames = {},
  roomNamePrefixCandidates: RoomNamePrefixCandidates = {},
): RoomView {
  const display = resolveRoomDisplay(grouping.roomId, roomOverrides)
  const overrideTitle = roomOverrides[grouping.roomId]?.name?.trim()
  const detectedTitle = roomDisplayNames[grouping.roomId]?.trim()
  const roomNames = buildRoomNameCandidates(
    overrideTitle,
    detectedTitle,
    ...(roomNamePrefixCandidates[grouping.roomId] ?? []),
  )
  return {
    type: 'sections',
    title: overrideTitle || detectedTitle || display.title,
    path: display.path,
    icon: display.icon,
    show_icon_and_title: shouldShowRoomNameOnCard(grouping.roomId, roomOverrides),
    sections: grouping.groups.map((group) => buildSection(group, roomNames)),
  }
}

/**
 * Bulk wrapper. Filters out groupings with no groups before mapping
 * (no point producing an empty-sections view that HA renders as a
 * blank page). Preserves input order for non-empty groupings.
 */
export function buildRoomViews(
  groupings: RoomGrouping[],
  roomOverrides: RoomDisplayOverrides = {},
  roomDisplayNames: RoomDisplayNames = {},
  roomNamePrefixCandidates: RoomNamePrefixCandidates = {},
): RoomView[] {
  return groupings
    .filter((g) => g.groups.length > 0)
    .map((g) => buildRoomView(g, roomOverrides, roomDisplayNames, roomNamePrefixCandidates))
}

function buildSection(group: DomainGroup, roomNames: string[]): GridSection {
  const heading = GROUP_HEADINGS[group.key]
  const headingCard: HeadingCard = { type: 'heading', heading }

  let bodyCards: LovelaceCard[]
  switch (group.key) {
    case 'lights':
    case 'covers':
    case 'security':
    case 'vacuum':
    case 'fans':
      bodyCards = group.entities.map((e) => buildTileCard(e, roomNames))
      break
    case 'climate':
      bodyCards = group.entities.map((e) => buildThermostatCard(e, roomNames))
      break
    case 'media':
      bodyCards = group.entities.map((e) => buildMediaControlCard(e, roomNames))
      break
    case 'cameras':
      bodyCards = group.entities.map((e) => buildPictureEntityCard(e, roomNames))
      break
    case 'environment':
    case 'activity':
    case 'other':
      bodyCards = [buildEntitiesCard(group.entities, roomNames)]
      break
  }

  return { type: 'grid', cards: [headingCard, ...bodyCards] }
}

function buildTileCard(entity: NormalizedEntity, roomNames: string[]): TileCard {
  const name = strippedEntityName(entity, roomNames)
  if (entity.domain === 'light') {
    return {
      type: 'tile',
      entity: entity.entityId,
      ...(name !== undefined ? { name } : {}),
      features: [{ type: 'light-brightness' }],
    }
  }
  if (entity.domain === 'cover') {
    return {
      type: 'tile',
      entity: entity.entityId,
      ...(name !== undefined ? { name } : {}),
      features: [{ type: 'cover-open-close' }],
    }
  }
  if (entity.domain === 'fan') {
    return {
      type: 'tile',
      entity: entity.entityId,
      ...(name !== undefined ? { name } : {}),
      features: [{ type: 'fan-speed' }],
    }
  }
  // switch, lock, vacuum — plain tile, no features
  return { type: 'tile', entity: entity.entityId, ...(name !== undefined ? { name } : {}) }
}

function buildThermostatCard(entity: NormalizedEntity, roomNames: string[]): ThermostatCard {
  const name = strippedEntityName(entity, roomNames)
  return { type: 'thermostat', entity: entity.entityId, ...(name !== undefined ? { name } : {}) }
}

function buildEntitiesCard(entities: NormalizedEntity[], roomNames: string[]): EntitiesCard {
  return { type: 'entities', entities: entities.map((e) => buildEntitiesCardEntry(e, roomNames)) }
}

function buildMediaControlCard(entity: NormalizedEntity, roomNames: string[]): MediaControlCard {
  const name = strippedEntityName(entity, roomNames)
  return {
    type: 'media-control',
    entity: entity.entityId,
    ...(name !== undefined ? { name } : {}),
  }
}

function buildPictureEntityCard(entity: NormalizedEntity, roomNames: string[]): PictureEntityCard {
  const name = strippedEntityName(entity, roomNames)
  return {
    type: 'picture-entity',
    entity: entity.entityId,
    ...(name !== undefined ? { name } : {}),
    camera_view: 'live',
  }
}

function buildEntitiesCardEntry(
  entity: NormalizedEntity,
  roomNames: string[],
): string | EntityCardEntry {
  const name = strippedEntityName(entity, roomNames)
  return name === undefined ? entity.entityId : { entity: entity.entityId, name }
}

function strippedEntityName(entity: NormalizedEntity, roomNames: string[]): string | undefined {
  for (const roomName of roomNames) {
    const stripped = stripRoomNamePrefix(entity.friendlyName, roomName)
    if (stripped !== null) return stripRepeatedFinalWord(stripped)
  }
  return undefined
}

function buildRoomNameCandidates(...names: (string | undefined)[]): string[] {
  const candidates: string[] = []
  const seen = new Set<string>()
  for (const name of names) {
    const trimmed = name?.trim()
    if (!trimmed) continue
    const key = normalizeForRoomPrefix(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(trimmed)
  }
  return candidates
}

function stripRoomNamePrefix(friendlyName: string, roomName: string): string | null {
  const friendly = Array.from(friendlyName)
  const room = Array.from(roomName.trim())
  if (room.length === 0 || friendly.length <= room.length) return null

  for (let index = 0; index < room.length; index += 1) {
    if (normalizeForRoomPrefix(friendly[index]!) !== normalizeForRoomPrefix(room[index]!)) {
      return null
    }
  }

  if (friendly[room.length] === undefined || !isPrefixSeparator(friendly[room.length]!)) return null

  let suffixStart = room.length
  while (friendly[suffixStart] !== undefined && isPrefixSeparator(friendly[suffixStart]!)) {
    suffixStart += 1
  }

  const stripped = friendly.slice(suffixStart).join('').trim()
  return stripped.length > 0 ? stripped : null
}

function normalizeForRoomPrefix(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function isPrefixSeparator(value: string): boolean {
  return /^[\s:_-]$/u.test(value)
}

function stripRepeatedFinalWord(value: string): string {
  const words = value.trim().split(/\s+/u)
  if (words.length < 2) return value

  const finalWord = words[words.length - 1]!
  const normalizedFinal = normalizeForRoomPrefix(finalWord)
  const repeatsEarlier = words
    .slice(0, -1)
    .some((word) => normalizeForRoomPrefix(word) === normalizedFinal)

  return repeatsEarlier ? words.slice(0, -1).join(' ') : value
}
