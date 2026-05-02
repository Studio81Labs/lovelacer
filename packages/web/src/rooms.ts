/**
 * Assignable canonical rooms (mirrors the server's CANONICAL_ROOMS set
 * minus 'misc' — the analyzer's unclassified bucket is not a user-
 * assignable target). Plus a display-name lookup used by the override
 * dropdown in EntityRow.vue.
 */

export const ASSIGNABLE_ROOMS = [
  'kitchen',
  'living_room',
  'bedroom',
  'bathroom',
  'office',
  'hallway',
  'garage',
  'garden',
  'dining_room',
  'laundry',
  'basement',
  'attic',
  'kids_room',
  'guest_room',
] as const

export type AssignableRoomId = (typeof ASSIGNABLE_ROOMS)[number]

const ROOM_DISPLAY: Record<string, string> = {
  kitchen: 'Kitchen',
  living_room: 'Living Room',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  office: 'Office',
  hallway: 'Hallway',
  garage: 'Garage',
  garden: 'Garden',
  dining_room: 'Dining Room',
  laundry: 'Laundry',
  basement: 'Basement',
  attic: 'Attic',
  kids_room: "Kids' Room",
  guest_room: 'Guest Room',
  misc: 'Other',
}

export function roomIdToDisplay(roomId: string): string {
  return ROOM_DISPLAY[roomId] ?? roomId
}
