import type { CanonicalRoomId } from '@lovelacer/shared'

/**
 * Per-canonical-room display metadata used by both home-view and
 * room-view. The `path` mirrors the `roomId` (HA dashboard view paths
 * are kebab-case-or-snake_case strings); kept as an explicit field so
 * a future ticket can introduce non-trivial path overrides without
 * surgery on every call site.
 */
export interface RoomDisplay {
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

export function roomIdToDisplay(roomId: CanonicalRoomId): RoomDisplay {
  return ROOM_DISPLAY[roomId]
}
