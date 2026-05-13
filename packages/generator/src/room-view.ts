import type { NormalizedEntity } from '@lovelacer/shared'
import type { DomainGroup, DomainGroupKey, RoomGrouping } from '@lovelacer/analyzer'
import type {
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
): RoomView {
  const display = resolveRoomDisplay(grouping.roomId, roomOverrides)
  return {
    type: 'sections',
    title: display.title,
    path: display.path,
    icon: display.icon,
    ...(shouldShowRoomNameOnCard(grouping.roomId, roomOverrides) && {
      show_icon_and_title: true,
    }),
    sections: grouping.groups.map((group) => buildSection(group)),
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
): RoomView[] {
  return groupings.filter((g) => g.groups.length > 0).map((g) => buildRoomView(g, roomOverrides))
}

function buildSection(group: DomainGroup): GridSection {
  const heading = GROUP_HEADINGS[group.key]
  const headingCard: HeadingCard = { type: 'heading', heading }

  let bodyCards: LovelaceCard[]
  switch (group.key) {
    case 'lights':
    case 'covers':
    case 'security':
    case 'vacuum':
    case 'fans':
      bodyCards = group.entities.map((e) => buildTileCard(e))
      break
    case 'climate':
      bodyCards = group.entities.map((e) => buildThermostatCard(e))
      break
    case 'media':
      bodyCards = group.entities.map((e) => buildMediaControlCard(e))
      break
    case 'cameras':
      bodyCards = group.entities.map((e) => buildPictureEntityCard(e))
      break
    case 'environment':
    case 'activity':
    case 'other':
      bodyCards = [buildEntitiesCard(group.entities)]
      break
  }

  return { type: 'grid', cards: [headingCard, ...bodyCards] }
}

function buildTileCard(entity: NormalizedEntity): TileCard {
  if (entity.domain === 'light') {
    return {
      type: 'tile',
      entity: entity.entityId,
      features: [{ type: 'light-brightness' }],
    }
  }
  if (entity.domain === 'cover') {
    return {
      type: 'tile',
      entity: entity.entityId,
      features: [{ type: 'cover-open-close' }],
    }
  }
  if (entity.domain === 'fan') {
    return {
      type: 'tile',
      entity: entity.entityId,
      features: [{ type: 'fan-speed' }],
    }
  }
  // switch, lock, vacuum — plain tile, no features
  return { type: 'tile', entity: entity.entityId }
}

function buildThermostatCard(entity: NormalizedEntity): ThermostatCard {
  return { type: 'thermostat', entity: entity.entityId }
}

function buildEntitiesCard(entities: NormalizedEntity[]): EntitiesCard {
  return { type: 'entities', entities: entities.map((e) => e.entityId) }
}

function buildMediaControlCard(entity: NormalizedEntity): MediaControlCard {
  return {
    type: 'media-control',
    entity: entity.entityId,
  }
}

function buildPictureEntityCard(entity: NormalizedEntity): PictureEntityCard {
  return {
    type: 'picture-entity',
    entity: entity.entityId,
    camera_view: 'live',
  }
}
