import type {
  AnalyzedRoom,
  CanonicalRoomId,
  FloorAssignment,
  NormalizedEntity,
  SettingsSections,
} from '@lovelacer/shared'
import type { RoomGrouping } from '@lovelacer/analyzer'
import type {
  ConditionalCard,
  ConditionEntry,
  GlanceCard,
  GlanceEntityEntry,
  GridSection,
  LovelaceCard,
  MarkdownCard,
  PictureEntityCard,
  RoomView,
  StateCondition,
  TileCard,
} from './lovelace-types.js'
import {
  resolveRoomDisplay,
  shouldShowRoomNameOnCard,
  type RoomDisplayOverrides,
} from './rooms.js'

/**
 * Home view shares RoomView's structural shape (sections layout). The
 * discriminator is the `path: 'home'` value, not the type itself.
 */
export type HomeView = RoomView

export interface BuildHomeViewInput {
  entities: NormalizedEntity[]
  groupings: RoomGrouping[]
  rooms: AnalyzedRoom[]
  floorAssignments: Map<CanonicalRoomId, FloorAssignment | null>
  /**
   * P2-6 — per-section toggles. Each conditional builder is gated by
   * its corresponding flag. With all flags false, the returned HomeView
   * has an empty `sections` array (valid but empty home view).
   */
  sections: SettingsSections
  roomOverrides?: RoomDisplayOverrides
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
 * Build the dashboard's first view: a list of grid sections gated by
 * `input.sections` flags. Each builder may also return null when the
 * input has nothing to render (e.g., no scenes); both gates apply.
 *
 * Pure function. Returns a HomeView with `sections: []` when all
 * P2-6 toggles are off — valid but empty home view.
 */
export function buildHomeView(input: BuildHomeViewInput): HomeView {
  const sections: GridSection[] = []
  const roomOverrides = input.roomOverrides ?? {}

  if (input.sections.welcome) {
    sections.push(buildWelcomeSection(input.entities))
  }

  if (input.sections.quickStats) {
    const quickStats = buildQuickStatsSection(input.entities)
    if (quickStats !== null) sections.push(quickStats)
  }

  if (input.sections.people) {
    const people = buildPeopleSection(input.entities)
    if (people !== null) sections.push(people)
  }

  if (input.sections.roomsByFloor) {
    const roomsByFloor = buildRoomsByFloorSection({
      rooms: input.rooms,
      groupings: input.groupings,
      floorAssignments: input.floorAssignments,
      roomOverrides,
    })
    if (roomsByFloor !== null) sections.push(roomsByFloor)
  }

  if (input.sections.activeRooms) {
    const activeRooms = buildActiveRoomsSection(input.groupings, roomOverrides)
    if (activeRooms !== null) sections.push(activeRooms)
  }

  if (input.sections.scenes) {
    const scenes = buildScenesSection(input.entities)
    if (scenes !== null) sections.push(scenes)
  }

  if (input.sections.cameras) {
    const cameras = buildCamerasSection(input.entities)
    if (cameras !== null) sections.push(cameras)
  }

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
 * Pick a room's "primary" navigable entity: first visible light if any,
 * else first visible activity sensor. Returns null if the room has no
 * lights and no activity sensors (or only hidden/disabled ones).
 *
 * Used by buildActiveRoomsSection (existing) and buildRoomsByFloorSection
 * (P2-3) — both surface a tile or glance per room and need a single
 * representative entity per room.
 */
function pickPrimaryEntity(grouping: RoomGrouping): NormalizedEntity | null {
  const lights = grouping.groups.find((g) => g.key === 'lights')?.entities ?? []
  const activity = grouping.groups.find((g) => g.key === 'activity')?.entities ?? []
  const candidates = [...lights, ...activity].filter((e) => !e.isHidden && !e.isDisabled)
  return candidates.length === 0 ? null : candidates[0]!
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
export function buildActiveRoomsSection(
  groupings: RoomGrouping[],
  roomOverrides: RoomDisplayOverrides = {},
): GridSection | null {
  const entries: { card: ConditionalCard; sortTitle: string }[] = []

  for (const grouping of groupings) {
    if (grouping.roomId === 'misc') continue

    const primary = pickPrimaryEntity(grouping)
    if (primary === null) continue

    // The OR condition still needs the full candidates list. Recompute
    // here rather than threading it through pickPrimaryEntity's return.
    const lights = grouping.groups.find((g) => g.key === 'lights')?.entities ?? []
    const activity = grouping.groups.find((g) => g.key === 'activity')?.entities ?? []
    const candidates = [...lights, ...activity].filter((e) => !e.isHidden && !e.isDisabled)

    const stateConditions: StateCondition[] = candidates.map((e) => ({
      condition: 'state',
      entity: e.entityId,
      state: 'on',
    }))
    const innerCondition: ConditionEntry =
      stateConditions.length === 1
        ? stateConditions[0]!
        : { condition: 'or', conditions: stateConditions }

    const display = resolveRoomDisplay(grouping.roomId, roomOverrides)
    const tile: TileCard = {
      type: 'tile',
      entity: primary.entityId,
      ...(shouldShowRoomNameOnCard(grouping.roomId, roomOverrides) ? { name: display.title } : {}),
      tap_action: { action: 'navigate', navigation_path: display.path },
    }

    entries.push({
      sortTitle: display.title,
      card: {
        type: 'conditional',
        conditions: [innerCondition],
        card: tile,
      },
    })
  }

  if (entries.length === 0) return null

  entries.sort((a, b) => a.sortTitle.localeCompare(b.sortTitle, 'en'))

  return { type: 'grid', cards: entries.map((entry) => entry.card) }
}

export interface BuildRoomsByFloorSectionInput {
  rooms: AnalyzedRoom[]
  groupings: RoomGrouping[]
  floorAssignments: Map<CanonicalRoomId, FloorAssignment | null>
  roomOverrides?: RoomDisplayOverrides
}

/**
 * Build the "Rooms by floor" section: per floor, a HeadingCard followed
 * by a GlanceCard whose entries each carry a tap_action: navigate to the
 * room view. Floors are ordered by `level` ascending (nulls last,
 * alphabetical within the null group). Rooms without a floor are
 * grouped under an "Other" heading at the bottom.
 *
 * Returns null when no rooms are floored (the section adds no value),
 * or when every room's primary entity is missing.
 *
 * Skips the misc room defensively (assignFloors already excludes it
 * from the map; this is a second layer).
 */
export function buildRoomsByFloorSection(input: BuildRoomsByFloorSectionInput): GridSection | null {
  // Index groupings by roomId for O(1) primary-entity lookup.
  const groupingByRoom = new Map<CanonicalRoomId, RoomGrouping>()
  for (const g of input.groupings) groupingByRoom.set(g.roomId, g)

  // Bucket rooms by their floor (or null for unfloored).
  const buckets = new Map<string | null, { floor: FloorAssignment | null; rooms: AnalyzedRoom[] }>()
  for (const room of input.rooms) {
    if (room.id === 'misc') continue
    const floor = input.floorAssignments.get(room.id) ?? null
    const key = floor === null ? null : floor.floorId
    const existing = buckets.get(key)
    if (existing === undefined) {
      buckets.set(key, { floor, rooms: [room] })
    } else {
      existing.rooms.push(room)
    }
  }

  // Early exit: only a null bucket means no rooms are floored.
  const hasFlooredBucket = Array.from(buckets.keys()).some((k) => k !== null)
  if (!hasFlooredBucket) return null

  // Order non-null buckets by (level ?? Infinity, name); null bucket last.
  const flooredEntries = Array.from(buckets.entries())
    .filter(([key]) => key !== null)
    .sort(([, a], [, b]) => {
      const la = a.floor?.level ?? Infinity
      const lb = b.floor?.level ?? Infinity
      if (la !== lb) return la - lb
      return (a.floor?.name ?? '').localeCompare(b.floor?.name ?? '', 'en')
    })
  const nullEntry = buckets.get(null)

  const cards: LovelaceCard[] = []
  for (const [, { floor, rooms }] of flooredEntries) {
    const glance = buildFloorGlance(rooms, groupingByRoom, input.roomOverrides)
    if (glance === null) continue
    cards.push({ type: 'heading', heading: floor!.name })
    cards.push(glance)
  }
  if (nullEntry !== undefined) {
    const glance = buildFloorGlance(nullEntry.rooms, groupingByRoom, input.roomOverrides)
    if (glance !== null) {
      cards.push({ type: 'heading', heading: 'Other' })
      cards.push(glance)
    }
  }

  if (cards.length === 0) return null
  return { type: 'grid', cards }
}

/**
 * Build a single floor's GlanceCard from its rooms. Skips rooms whose
 * primary entity is missing. Returns null if every room is skipped.
 */
function buildFloorGlance(
  rooms: AnalyzedRoom[],
  groupingByRoom: Map<CanonicalRoomId, RoomGrouping>,
  roomOverrides: RoomDisplayOverrides = {},
): GlanceCard | null {
  const entries: GlanceEntityEntry[] = []
  for (const room of rooms) {
    const grouping = groupingByRoom.get(room.id)
    if (grouping === undefined) continue
    const primary = pickPrimaryEntity(grouping)
    if (primary === null) continue
    const display = resolveRoomDisplay(room.id, roomOverrides)
    entries.push({
      entity: primary.entityId,
      ...(shouldShowRoomNameOnCard(room.id, roomOverrides) ? { name: display.title } : {}),
      tap_action: { action: 'navigate', navigation_path: display.path },
    })
  }
  if (entries.length === 0) return null
  return { type: 'glance', entities: entries }
}
