import type { HomeView } from './home-view.js'
import type { RoomView } from './lovelace-types.js'

/**
 * The full Lovelace dashboard envelope HA accepts via `lovelace/config/save`.
 * `views` is the home view first, followed by per-room views sorted by title.
 */
export interface LovelaceConfig {
  title: string
  views: (HomeView | RoomView)[]
}

export interface BuildLovelaceConfigInput {
  home: HomeView
  rooms: RoomView[]
}

const DASHBOARD_TITLE = 'Lovelacer — Home'

/**
 * Wrap the home view and room views into the `{ title, views }` envelope
 * HA's `lovelace/config/save` expects.
 *
 * Rooms are sorted alphabetically by view title using `localeCompare(_, 'en')`
 * — the same comparator P1a-5 uses for domain-group ordering. The home view
 * is always at index 0; rooms follow.
 *
 * Pure function. Doesn't mutate input.
 */
export function buildLovelaceConfig(input: BuildLovelaceConfigInput): LovelaceConfig {
  const sortedRooms = [...input.rooms].sort((a, b) => a.title.localeCompare(b.title, 'en'))
  return {
    title: DASHBOARD_TITLE,
    views: [input.home, ...sortedRooms],
  }
}
