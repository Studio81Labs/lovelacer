import type { CanonicalRoomId, NormalizedEntity } from '@lovelacer/shared'
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

interface RoomDisplay {
  title: string
  path: string
  icon: string
}

const ROOM_DISPLAY: Record<CanonicalRoomId, RoomDisplay> = {
  kitchen: { title: 'Kitchen', path: 'kitchen', icon: 'mdi:silverware-fork-knife' },
  living_room: { title: 'Living Room', path: 'living_room', icon: 'mdi:sofa' },
  bedroom: { title: 'Bedroom', path: 'bedroom', icon: 'mdi:bed' },
  bathroom: { title: 'Bathroom', path: 'bathroom', icon: 'mdi:shower-head' },
  office: { title: 'Office', path: 'office', icon: 'mdi:desk' },
  garage: { title: 'Garage', path: 'garage', icon: 'mdi:garage-variant' },
  garden: { title: 'Garden', path: 'garden', icon: 'mdi:flower-tulip' },
  dining_room: { title: 'Dining Room', path: 'dining_room', icon: 'mdi:silverware' },
  laundry: { title: 'Laundry', path: 'laundry', icon: 'mdi:washing-machine' },
  basement: { title: 'Basement', path: 'basement', icon: 'mdi:stairs-down' },
  attic: { title: 'Attic', path: 'attic', icon: 'mdi:home-roof' },
  kids_room: { title: "Kids' Room", path: 'kids_room', icon: 'mdi:teddy-bear' },
  guest_room: { title: 'Guest Room', path: 'guest_room', icon: 'mdi:bed-empty' },
  hallway: { title: 'Hallway', path: 'hallway', icon: 'mdi:door' },
  misc: { title: 'Other', path: 'other', icon: 'mdi:dots-horizontal' },
}

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
export function buildRoomView(grouping: RoomGrouping): RoomView {
  const display = ROOM_DISPLAY[grouping.roomId]
  return {
    type: 'sections',
    title: display.title,
    path: display.path,
    icon: display.icon,
    sections: grouping.groups.map((group) => buildSection(group)),
  }
}

/**
 * Bulk wrapper. Filters out groupings with no groups before mapping
 * (no point producing an empty-sections view that HA renders as a
 * blank page). Preserves input order for non-empty groupings.
 */
export function buildRoomViews(groupings: RoomGrouping[]): RoomView[] {
  return groupings.filter((g) => g.groups.length > 0).map((g) => buildRoomView(g))
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
  // switch, lock, vacuum, scene, script — plain tile, no features
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
