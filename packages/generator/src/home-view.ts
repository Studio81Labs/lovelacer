import type { NormalizedEntity } from '@lovelacer/shared'
import type { RoomGrouping } from '@lovelacer/analyzer'
import type {
  ConditionalCard,
  ConditionEntry,
  GlanceCard,
  GridSection,
  MarkdownCard,
  PictureEntityCard,
  RoomView,
  StateCondition,
  TileCard,
} from './lovelace-types.js'
import { roomIdToDisplay } from './rooms.js'

/**
 * Home view shares RoomView's structural shape (sections layout). The
 * discriminator is the `path: 'home'` value, not the type itself.
 */
export type HomeView = RoomView

export interface BuildHomeViewInput {
  entities: NormalizedEntity[]
  groupings: RoomGrouping[]
}

const PRESENCE_ID_PATTERN = /anyone[_-]?home|someone[_-]?home|presence/i
const SCENE_NAME_FILTER = /test|setup/i

const GREETING_LINE =
  "## Good {{ now().strftime('%H')|int < 12 and 'morning' or now().strftime('%H')|int < 18 and 'afternoon' or 'evening' }}"

/**
 * Apply the quick-stats patterns to the input entities.
 *
 * Patterns are applied in declared order; the first match per pattern
 * is taken. Result is capped at 4 entities. Returns up to 4 entities
 * in pattern order; caller decides whether to render (the rule
 * "skip glance if <2" lives in `buildHomeView`, not here).
 */
export function pickQuickStatsEntities(entities: NormalizedEntity[]): NormalizedEntity[] {
  const finders: ((e: NormalizedEntity) => boolean)[] = [
    // Weather: any weather.* domain
    (e) => e.domain === 'weather',
    // Outdoor temperature: sensor + temperature deviceClass + outdoor/outside marker
    (e) => e.domain === 'sensor' && e.deviceClass === 'temperature' && hasOutdoorMarker(e),
    // Outdoor humidity: sensor + humidity deviceClass + outdoor/outside marker
    (e) => e.domain === 'sensor' && e.deviceClass === 'humidity' && hasOutdoorMarker(e),
    // Presence: binary_sensor + (presence deviceClass OR anyone_home/someone_home/presence in entityId)
    (e) =>
      e.domain === 'binary_sensor' &&
      (e.deviceClass === 'presence' || PRESENCE_ID_PATTERN.test(e.entityId)),
    // Power: sensor + power deviceClass
    (e) => e.domain === 'sensor' && e.deviceClass === 'power',
  ]

  const picked: NormalizedEntity[] = []
  for (const finder of finders) {
    if (picked.length >= 4) break
    const match = entities.find(finder)
    if (match !== undefined) picked.push(match)
  }
  return picked
}

function hasOutdoorMarker(entity: NormalizedEntity): boolean {
  const id = entity.entityId.toLowerCase()
  const name = entity.friendlyName.toLowerCase()
  return (
    id.includes('outdoor') ||
    id.includes('outside') ||
    name.includes('outdoor') ||
    name.includes('outside')
  )
}

/**
 * Build the dashboard's first view: Welcome markdown card + an
 * optional Quick stats glance card (dropped when fewer than 2
 * entities match the curated patterns).
 *
 * Pure function. Always emits the Welcome section.
 */
export function buildHomeView(input: BuildHomeViewInput): HomeView {
  const sections: GridSection[] = [buildWelcomeSection(input.entities)]

  const quickStats = buildQuickStatsSection(input.entities)
  if (quickStats !== null) sections.push(quickStats)

  const people = buildPeopleSection(input.entities)
  if (people !== null) sections.push(people)

  const activeRooms = buildActiveRoomsSection(input.groupings)
  if (activeRooms !== null) sections.push(activeRooms)

  const scenes = buildScenesSection(input.entities)
  if (scenes !== null) sections.push(scenes)

  const cameras = buildCamerasSection(input.entities)
  if (cameras !== null) sections.push(cameras)

  return {
    type: 'sections',
    title: 'Home',
    path: 'home',
    icon: 'mdi:home-variant',
    sections,
  }
}

function buildWelcomeSection(entities: NormalizedEntity[]): GridSection {
  const weather = entities.find((e) => e.domain === 'weather')
  const content =
    weather !== undefined
      ? `${GREETING_LINE}\n\n{{ states('${weather.entityId}') }} · {{ state_attr('${weather.entityId}', 'temperature') }}°`
      : GREETING_LINE
  const card: MarkdownCard = { type: 'markdown', content }
  return { type: 'grid', cards: [card] }
}

function buildQuickStatsSection(entities: NormalizedEntity[]): GridSection | null {
  const picked = pickQuickStatsEntities(entities)
  if (picked.length < 2) return null
  const card: GlanceCard = {
    type: 'glance',
    title: 'Quick stats',
    entities: picked.map((e) => e.entityId),
  }
  return { type: 'grid', cards: [card] }
}

/**
 * Find person.* entities and emit a single glance card. HA renders
 * each person's photo + state (home/away). Returns null if no
 * (visible) person entities exist.
 */
export function buildPeopleSection(entities: NormalizedEntity[]): GridSection | null {
  const people = entities
    .filter((e) => e.domain === 'person' && !e.isHidden && !e.isDisabled)
    .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName, 'en'))
  if (people.length === 0) return null
  const card: GlanceCard = {
    type: 'glance',
    title: 'People',
    entities: people.map((e) => e.entityId),
  }
  return { type: 'grid', cards: [card] }
}

/**
 * Find scene.* entities, drop any whose entityId or friendlyName
 * contains "test" or "setup" (case-insensitive), sort alphabetically,
 * cap at 6, emit one tile per scene. Returns null if no scenes
 * survive the filter.
 */
export function buildScenesSection(entities: NormalizedEntity[]): GridSection | null {
  const scenes = entities
    .filter((e) => e.domain === 'scene' && !e.isHidden && !e.isDisabled)
    .filter((e) => !SCENE_NAME_FILTER.test(e.entityId) && !SCENE_NAME_FILTER.test(e.friendlyName))
    .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName, 'en'))
    .slice(0, 6)
  if (scenes.length === 0) return null
  const cards: TileCard[] = scenes.map((e) => ({ type: 'tile', entity: e.entityId }))
  return { type: 'grid', cards }
}

/**
 * Find camera.* entities and emit one picture-entity card per camera
 * with camera_view: 'live' so HA streams the feed. Returns null if no
 * (visible) cameras exist.
 */
export function buildCamerasSection(entities: NormalizedEntity[]): GridSection | null {
  const cameras = entities
    .filter((e) => e.domain === 'camera' && !e.isHidden && !e.isDisabled)
    .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName, 'en'))
  if (cameras.length === 0) return null
  const cards: PictureEntityCard[] = cameras.map((e) => ({
    type: 'picture-entity',
    entity: e.entityId,
    camera_view: 'live',
  }))
  return { type: 'grid', cards }
}

/**
 * Build the Active Rooms section: per room, a conditional card that
 * renders ONLY when at least one of the room's lights or activity
 * sensors is on. The wrapped tile points at the room's primary entity
 * (first light if any, else first activity sensor) and tap-navigates
 * to the room's view.
 *
 * Skips rooms with no lights AND no activity sensors. Skips the misc
 * bucket (no view to navigate to). Returns null if no rooms qualify.
 */
export function buildActiveRoomsSection(groupings: RoomGrouping[]): GridSection | null {
  const cards: ConditionalCard[] = []

  for (const grouping of groupings) {
    if (grouping.roomId === 'misc') continue

    const lights = grouping.groups.find((g) => g.key === 'lights')?.entities ?? []
    const activity = grouping.groups.find((g) => g.key === 'activity')?.entities ?? []
    const candidates = [...lights, ...activity].filter((e) => !e.isHidden && !e.isDisabled)
    if (candidates.length === 0) continue

    const primary = candidates[0]!
    const stateConditions: StateCondition[] = candidates.map((e) => ({
      condition: 'state',
      entity: e.entityId,
      state: 'on',
    }))
    const innerCondition: ConditionEntry =
      stateConditions.length === 1
        ? stateConditions[0]!
        : { condition: 'or', conditions: stateConditions }

    const display = roomIdToDisplay(grouping.roomId)
    const tile: TileCard = {
      type: 'tile',
      entity: primary.entityId,
      name: display.title,
      tap_action: { action: 'navigate', navigation_path: grouping.roomId },
    }

    cards.push({
      type: 'conditional',
      conditions: [innerCondition],
      card: tile,
    })
  }

  if (cards.length === 0) return null

  cards.sort((a, b) => {
    const an = (a.card as TileCard).name ?? ''
    const bn = (b.card as TileCard).name ?? ''
    return an.localeCompare(bn, 'en')
  })

  return { type: 'grid', cards }
}
