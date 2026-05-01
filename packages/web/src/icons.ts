/**
 * Per-icon registration for the MDI icons we render. Listing them
 * explicitly keeps the bundled icon payload tiny (~3 KB total instead
 * of ~750 KB for the full @iconify-json/mdi set).
 *
 * If the server emits a view with an MDI icon not in this list,
 * @iconify/vue falls back to fetching it from api.iconify.design at
 * runtime. P1a-11 add-on packaging will need to harden this for offline
 * installs (either add the missing icons here or configure a local
 * Iconify proxy).
 *
 * Mirrors the canonical-room → icon mapping in
 * `packages/generator/src/room-view.ts` (`ROOM_DISPLAY`) plus the
 * home view's `mdi:home-variant`.
 */
import { addIcon } from '@iconify/vue'
import attic from '@iconify-icons/mdi/home-roof'
import basement from '@iconify-icons/mdi/stairs-down'
import bathroom from '@iconify-icons/mdi/shower-head'
import bedroom from '@iconify-icons/mdi/bed'
import diningRoom from '@iconify-icons/mdi/silverware'
import dotsHorizontal from '@iconify-icons/mdi/dots-horizontal'
import garage from '@iconify-icons/mdi/garage-variant'
import garden from '@iconify-icons/mdi/flower-tulip'
import guestRoom from '@iconify-icons/mdi/bed-empty'
import hallway from '@iconify-icons/mdi/door'
import homeOutline from '@iconify-icons/mdi/home-outline'
import homeVariant from '@iconify-icons/mdi/home-variant'
import kidsRoom from '@iconify-icons/mdi/teddy-bear'
import kitchen from '@iconify-icons/mdi/silverware-fork-knife'
import laundry from '@iconify-icons/mdi/washing-machine'
import livingRoom from '@iconify-icons/mdi/sofa'
import office from '@iconify-icons/mdi/desk'

const REGISTRY: Record<string, Parameters<typeof addIcon>[1]> = {
  'mdi:bed': bedroom,
  'mdi:bed-empty': guestRoom,
  'mdi:desk': office,
  'mdi:door': hallway,
  'mdi:dots-horizontal': dotsHorizontal,
  'mdi:flower-tulip': garden,
  'mdi:garage-variant': garage,
  'mdi:home-outline': homeOutline,
  'mdi:home-roof': attic,
  'mdi:home-variant': homeVariant,
  'mdi:shower-head': bathroom,
  'mdi:silverware': diningRoom,
  'mdi:silverware-fork-knife': kitchen,
  'mdi:sofa': livingRoom,
  'mdi:stairs-down': basement,
  'mdi:teddy-bear': kidsRoom,
  'mdi:washing-machine': laundry,
}

export function registerMdiIcons(): void {
  for (const [name, data] of Object.entries(REGISTRY)) {
    addIcon(name, data)
  }
}

/**
 * Maps the analyzer's canonical room IDs to MDI icon strings used in
 * the dashboard preview. Mirrors the `ROOM_DISPLAY` table in
 * `packages/generator/src/room-view.ts`.
 *
 * Duplicated here (~14 lines) rather than fetched from the server so
 * the frontend is self-contained for offline rendering. P1b extracts
 * this into a shared `@lovelacer/api-types` package along with the
 * AnalyzedRoom etc. types.
 */
const ROOM_ICONS: Record<string, string> = {
  kitchen: 'mdi:silverware-fork-knife',
  living_room: 'mdi:sofa',
  bedroom: 'mdi:bed',
  bathroom: 'mdi:shower-head',
  office: 'mdi:desk',
  garage: 'mdi:garage-variant',
  garden: 'mdi:flower-tulip',
  dining_room: 'mdi:silverware',
  laundry: 'mdi:washing-machine',
  basement: 'mdi:stairs-down',
  attic: 'mdi:home-roof',
  kids_room: 'mdi:teddy-bear',
  guest_room: 'mdi:bed-empty',
  hallway: 'mdi:door',
  misc: 'mdi:dots-horizontal',
}

export function roomIdToIcon(roomId: string): string {
  return ROOM_ICONS[roomId] ?? 'mdi:home-outline'
}
