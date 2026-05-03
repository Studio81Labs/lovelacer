import { describe, it, expect } from 'vitest'
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  FloorAssignment,
  NormalizedEntity,
} from '@lovelacer/shared'
import {
  buildActiveRoomsSection,
  buildCamerasSection,
  buildHomeView,
  buildPeopleSection,
  buildRoomsByFloorSection,
  buildScenesSection,
  pickQuickStatsEntities,
} from '../home-view.js'
import type { BuildHomeViewInput } from '../home-view.js'
import type { RoomGrouping } from '@lovelacer/analyzer'
import type { SettingsSections } from '@lovelacer/shared'
import type { GlanceCard, HeadingCard } from '../lovelace-types.js'

const ent = (id: string, overrides: Partial<NormalizedEntity> = {}): NormalizedEntity => ({
  entityId: id,
  domain: id.split('.')[0]!,
  objectId: id.split('.')[1]!,
  friendlyName: id,
  deviceClass: null,
  entityCategory: null,
  haAreaId: null,
  device: null,
  isHidden: false,
  isDisabled: false,
  ...overrides,
})

/** All sections enabled — used by pre-P2-6 tests to preserve existing behaviour. */
const ALL_SECTIONS_ON: SettingsSections = {
  welcome: true,
  quickStats: true,
  people: true,
  roomsByFloor: true,
  activeRooms: true,
  scenes: true,
  cameras: true,
}

describe('pickQuickStatsEntities — patterns', () => {
  it('picks weather entity (any weather.* domain)', () => {
    const result = pickQuickStatsEntities([ent('weather.home')])
    expect(result).toHaveLength(1)
    expect(result[0]!.entityId).toBe('weather.home')
  })

  it('picks outdoor temperature by entity_id substring', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
    ])
    expect(result.map((e) => e.entityId)).toEqual(['sensor.outdoor_temperature'])
  })

  it('picks outdoor temperature by friendlyName substring (case-insensitive)', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.x', { deviceClass: 'temperature', friendlyName: 'Outside Temp' }),
    ])
    expect(result.map((e) => e.entityId)).toEqual(['sensor.x'])
  })

  it('does NOT pick indoor temperature (no outdoor/outside marker)', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.kitchen_temperature', { deviceClass: 'temperature' }),
    ])
    expect(result).toEqual([])
  })

  it('picks outdoor humidity by entity_id substring', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.outdoor_humidity', { deviceClass: 'humidity' }),
    ])
    expect(result.map((e) => e.entityId)).toEqual(['sensor.outdoor_humidity'])
  })

  it('picks presence by deviceClass', () => {
    const result = pickQuickStatsEntities([
      ent('binary_sensor.living_room_motion', { deviceClass: 'presence' }),
    ])
    expect(result).toHaveLength(1)
  })

  it('picks presence by entity_id pattern: anyone_home', () => {
    const result = pickQuickStatsEntities([ent('binary_sensor.anyone_home')])
    expect(result).toHaveLength(1)
  })

  it('picks presence by entity_id pattern: someone-home (hyphen variant)', () => {
    const result = pickQuickStatsEntities([ent('binary_sensor.someone-home')])
    expect(result).toHaveLength(1)
  })

  it('picks presence by entity_id pattern: any "presence" substring', () => {
    const result = pickQuickStatsEntities([ent('binary_sensor.home_presence')])
    expect(result).toHaveLength(1)
  })

  it('picks power by deviceClass', () => {
    const result = pickQuickStatsEntities([ent('sensor.house_power_now', { deviceClass: 'power' })])
    expect(result).toHaveLength(1)
  })

  it('does NOT pick energy as power (different deviceClass)', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.house_energy_today', { deviceClass: 'energy' }),
    ])
    expect(result).toEqual([])
  })
})

describe('pickQuickStatsEntities — ordering and limits', () => {
  it('returns matched entities in pattern order (weather, outdoor temp, outdoor humidity, presence, power)', () => {
    const result = pickQuickStatsEntities([
      ent('sensor.house_power_now', { deviceClass: 'power' }),
      ent('binary_sensor.anyone_home'),
      ent('sensor.outdoor_humidity', { deviceClass: 'humidity' }),
      ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
      ent('weather.home'),
    ])
    expect(result.map((e) => e.entityId)).toEqual([
      'weather.home',
      'sensor.outdoor_temperature',
      'sensor.outdoor_humidity',
      'binary_sensor.anyone_home',
    ])
    // Power not included because the cap is 4.
    expect(result).toHaveLength(4)
  })

  it('caps at 4 entities even when more patterns could match', () => {
    const result = pickQuickStatsEntities([
      ent('weather.home'),
      ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
      ent('sensor.outdoor_humidity', { deviceClass: 'humidity' }),
      ent('binary_sensor.anyone_home'),
      ent('sensor.house_power_now', { deviceClass: 'power' }),
    ])
    expect(result).toHaveLength(4)
  })

  it('multiple matches per pattern → only first picked', () => {
    const result = pickQuickStatsEntities([ent('weather.home'), ent('weather.forecast')])
    expect(result).toHaveLength(1)
    expect(result[0]!.entityId).toBe('weather.home')
  })

  it('returns empty array when nothing matches', () => {
    const result = pickQuickStatsEntities([
      ent('light.kitchen_ceiling'),
      ent('switch.coffee_maker'),
    ])
    expect(result).toEqual([])
  })

  it('returns empty array on empty input', () => {
    expect(pickQuickStatsEntities([])).toEqual([])
  })
})

describe('buildHomeView — view metadata', () => {
  it('produces type=sections, title=Home, path=home, icon=mdi:home-variant', () => {
    const view = buildHomeView({
      entities: [],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    expect(view.type).toBe('sections')
    expect(view.title).toBe('Home')
    expect(view.path).toBe('home')
    expect(view.icon).toBe('mdi:home-variant')
  })
})

describe('buildHomeView — Welcome section', () => {
  it('always emits a Welcome section even with empty entities', () => {
    const view = buildHomeView({
      entities: [],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    expect(view.sections).toHaveLength(1)
    const card = view.sections[0]!.cards[0]
    expect(card?.type).toBe('markdown')
  })

  it('Welcome card has greeting only when no weather entity exists', () => {
    const view = buildHomeView({
      entities: [ent('light.kitchen')],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain('Good ')
    expect(card.content).toContain("now().strftime('%H')")
    // No weather template line
    expect(card.content).not.toContain('states(')
    expect(card.content).not.toContain('state_attr(')
  })

  it('Welcome card adds weather template when weather entity exists', () => {
    const view = buildHomeView({
      entities: [ent('weather.home')],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain("{{ states('weather.home') }}")
    expect(card.content).toContain("{{ state_attr('weather.home', 'temperature') }}°")
  })

  it('Welcome card uses the first weather entity when multiple exist', () => {
    const view = buildHomeView({
      entities: [ent('weather.home'), ent('weather.forecast')],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain("states('weather.home')")
    expect(card.content).not.toContain("states('weather.forecast')")
  })
})

describe('buildHomeView — Quick stats section', () => {
  it('skips Quick stats section when 0 entities match', () => {
    const view = buildHomeView({
      entities: [ent('light.kitchen')],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    expect(view.sections).toHaveLength(1) // Welcome only
  })

  it('skips Quick stats section when only 1 entity matches', () => {
    const view = buildHomeView({
      entities: [ent('sensor.outdoor_temperature', { deviceClass: 'temperature' })],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    expect(view.sections).toHaveLength(1) // Welcome only
  })

  it('emits Quick stats section when 2 entities match', () => {
    const view = buildHomeView({
      entities: [
        ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
        ent('sensor.outdoor_humidity', { deviceClass: 'humidity' }),
      ],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    expect(view.sections).toHaveLength(2)
    const glance = view.sections[1]!.cards[0] as {
      type: 'glance'
      title: string
      entities: string[]
    }
    expect(glance.type).toBe('glance')
    expect(glance.title).toBe('Quick stats')
    expect(glance.entities).toEqual(['sensor.outdoor_temperature', 'sensor.outdoor_humidity'])
  })

  it('Quick stats section has exactly one glance card', () => {
    const view = buildHomeView({
      entities: [
        ent('weather.home'),
        ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
        ent('binary_sensor.anyone_home'),
      ],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    expect(view.sections[1]!.cards).toHaveLength(1)
    expect(view.sections[1]!.cards[0]!.type).toBe('glance')
  })
})

describe('buildPeopleSection', () => {
  it('returns null when no person entities', () => {
    expect(buildPeopleSection([ent('light.kitchen')])).toBeNull()
  })

  it('emits a glance card with all person entityIds', () => {
    const section = buildPeopleSection([
      ent('person.alice', { friendlyName: 'Alice' }),
      ent('person.bob', { friendlyName: 'Bob' }),
    ])
    expect(section).toEqual({
      type: 'grid',
      cards: [
        {
          type: 'glance',
          title: 'People',
          entities: ['person.alice', 'person.bob'],
        },
      ],
    })
  })

  it('sorts alphabetically by friendlyName', () => {
    const section = buildPeopleSection([
      ent('person.bob', { friendlyName: 'Bob' }),
      ent('person.alice', { friendlyName: 'Alice' }),
      ent('person.carol', { friendlyName: 'Carol' }),
    ])
    expect((section!.cards[0] as { entities: string[] }).entities).toEqual([
      'person.alice',
      'person.bob',
      'person.carol',
    ])
  })

  it('filters out hidden + disabled people', () => {
    const section = buildPeopleSection([
      ent('person.alice', { friendlyName: 'Alice' }),
      ent('person.bob', { friendlyName: 'Bob', isHidden: true }),
      ent('person.carol', { friendlyName: 'Carol', isDisabled: true }),
    ])
    expect((section!.cards[0] as { entities: string[] }).entities).toEqual(['person.alice'])
  })
})

describe('buildScenesSection', () => {
  it('returns null when no scene entities', () => {
    expect(buildScenesSection([ent('light.kitchen')])).toBeNull()
  })

  it('returns null when all scenes are filtered out by test/setup keyword', () => {
    expect(
      buildScenesSection([
        ent('scene.test_kitchen'),
        ent('scene.setup_lights'),
        ent('scene.foo', { friendlyName: 'Test Scene' }),
      ]),
    ).toBeNull()
  })

  it('emits one tile per surviving scene', () => {
    const section = buildScenesSection([
      ent('scene.movie_night', { friendlyName: 'Movie Night' }),
      ent('scene.dinner', { friendlyName: 'Dinner' }),
    ])
    expect(section!.cards).toHaveLength(2)
    expect(section!.cards[0]).toEqual({ type: 'tile', entity: 'scene.dinner' })
    expect(section!.cards[1]).toEqual({ type: 'tile', entity: 'scene.movie_night' })
  })

  it('filter is case-insensitive on entityId AND friendlyName', () => {
    const section = buildScenesSection([
      ent('scene.morning', { friendlyName: 'Morning' }),
      ent('scene.kitchen_test'), // entityId match
      ent('scene.evening', { friendlyName: 'Evening Setup' }), // friendlyName match
      ent('scene.SETUP_lights'), // case-insensitive match
    ])
    const ids = section!.cards.map((c) => (c as { entity: string }).entity)
    expect(ids).toEqual(['scene.morning'])
  })

  it('caps at 6 scenes (alphabetical, take first 6)', () => {
    const section = buildScenesSection([
      ent('scene.a'),
      ent('scene.b'),
      ent('scene.c'),
      ent('scene.d'),
      ent('scene.e'),
      ent('scene.f'),
      ent('scene.g'),
      ent('scene.h'),
    ])
    expect(section!.cards).toHaveLength(6)
    const ids = section!.cards.map((c) => (c as { entity: string }).entity)
    expect(ids).toEqual(['scene.a', 'scene.b', 'scene.c', 'scene.d', 'scene.e', 'scene.f'])
  })
})

describe('buildCamerasSection', () => {
  it('returns null when no camera entities', () => {
    expect(buildCamerasSection([ent('light.kitchen')])).toBeNull()
  })

  it('emits one picture-entity per camera with camera_view: live', () => {
    const section = buildCamerasSection([
      ent('camera.front_door', { friendlyName: 'Front Door' }),
      ent('camera.back_yard', { friendlyName: 'Back Yard' }),
    ])
    expect(section!.cards).toEqual([
      { type: 'picture-entity', entity: 'camera.back_yard', camera_view: 'live' },
      { type: 'picture-entity', entity: 'camera.front_door', camera_view: 'live' },
    ])
  })

  it('sorts alphabetically and filters hidden + disabled', () => {
    const section = buildCamerasSection([
      ent('camera.zone_a', { friendlyName: 'Zone A', isHidden: true }),
      ent('camera.zone_b', { friendlyName: 'Zone B' }),
      ent('camera.zone_c', { friendlyName: 'Zone C', isDisabled: true }),
    ])
    expect(section!.cards).toHaveLength(1)
    expect((section!.cards[0] as { entity: string }).entity).toBe('camera.zone_b')
  })
})

const grp = (roomId: string, lights: string[] = [], activity: string[] = []): RoomGrouping => ({
  roomId: roomId as RoomGrouping['roomId'],
  groups: [
    ...(lights.length > 0
      ? [
          {
            key: 'lights' as const,
            entities: lights.map((id) => ent(id)),
          },
        ]
      : []),
    ...(activity.length > 0
      ? [
          {
            key: 'activity' as const,
            entities: activity.map((id) => ent(id, { deviceClass: 'motion' })),
          },
        ]
      : []),
  ],
})

describe('buildActiveRoomsSection', () => {
  it('returns null when groupings is empty', () => {
    expect(buildActiveRoomsSection([])).toBeNull()
  })

  it('returns null when no rooms have lights or activity sensors', () => {
    const groupings: RoomGrouping[] = [
      {
        roomId: 'kitchen' as RoomGrouping['roomId'],
        groups: [
          {
            key: 'environment' as const,
            entities: [ent('sensor.kitchen_temp', { deviceClass: 'temperature' })],
          },
        ],
      },
    ]
    expect(buildActiveRoomsSection(groupings)).toBeNull()
  })

  it('skips rooms with roomId === misc', () => {
    const groupings = [grp('misc', ['light.misc_light'])]
    expect(buildActiveRoomsSection(groupings)).toBeNull()
  })

  it('room with one light only — emits flat StateCondition (no OR wrapper)', () => {
    const groupings = [grp('kitchen', ['light.kitchen_main'])]
    const section = buildActiveRoomsSection(groupings)
    expect(section!.cards).toHaveLength(1)
    const cond = section!.cards[0] as {
      type: 'conditional'
      conditions: unknown[]
      card: unknown
    }
    expect(cond.type).toBe('conditional')
    expect(cond.conditions).toEqual([
      { condition: 'state', entity: 'light.kitchen_main', state: 'on' },
    ])
  })

  it('room with multiple lights + motion — emits OR composite', () => {
    const groupings = [
      grp(
        'kitchen',
        ['light.kitchen_main', 'light.kitchen_island'],
        ['binary_sensor.kitchen_motion'],
      ),
    ]
    const section = buildActiveRoomsSection(groupings)
    const cond = section!.cards[0] as {
      conditions: { condition: string; conditions: unknown[] }[]
    }
    expect(cond.conditions).toHaveLength(1)
    expect(cond.conditions[0]!.condition).toBe('or')
    expect(cond.conditions[0]!.conditions).toEqual([
      { condition: 'state', entity: 'light.kitchen_main', state: 'on' },
      { condition: 'state', entity: 'light.kitchen_island', state: 'on' },
      { condition: 'state', entity: 'binary_sensor.kitchen_motion', state: 'on' },
    ])
  })

  it('tile points at first light when present (lights take priority)', () => {
    const groupings = [grp('kitchen', ['light.kitchen_main'], ['binary_sensor.kitchen_motion'])]
    const section = buildActiveRoomsSection(groupings)
    const cond = section!.cards[0] as { card: { entity: string; name: string } }
    expect(cond.card.entity).toBe('light.kitchen_main')
    expect(cond.card.name).toBe('Kitchen')
  })

  it('tile falls back to first activity sensor when no lights', () => {
    const groupings = [grp('kitchen', [], ['binary_sensor.kitchen_motion'])]
    const section = buildActiveRoomsSection(groupings)
    const cond = section!.cards[0] as { card: { entity: string } }
    expect(cond.card.entity).toBe('binary_sensor.kitchen_motion')
  })

  it('filters out hidden + disabled candidates', () => {
    // Construct a room with one hidden light and one visible motion sensor.
    // Expected: hidden light excluded from condition; tile uses the motion sensor.
    const grouping: RoomGrouping = {
      roomId: 'kitchen' as RoomGrouping['roomId'],
      groups: [
        {
          key: 'lights' as const,
          entities: [ent('light.hidden_kitchen', { isHidden: true })],
        },
        {
          key: 'activity' as const,
          entities: [ent('binary_sensor.kitchen_motion', { deviceClass: 'motion' })],
        },
      ],
    }
    const section = buildActiveRoomsSection([grouping])
    const cond = section!.cards[0] as {
      conditions: unknown[]
      card: { entity: string }
    }
    // Hidden light absent from conditions; only motion sensor present.
    expect(cond.conditions).toEqual([
      { condition: 'state', entity: 'binary_sensor.kitchen_motion', state: 'on' },
    ])
    // Tile points at the motion sensor since the light was filtered.
    expect(cond.card.entity).toBe('binary_sensor.kitchen_motion')
  })

  it('tile has tap_action.navigation_path === display.path (matches the room view URL)', () => {
    const groupings = [grp('living_room', ['light.lr_main'])]
    const section = buildActiveRoomsSection(groupings)
    const cond = section!.cards[0] as { card: { tap_action: { navigation_path: string } } }
    // For all assignable rooms, display.path === roomId. The contract is
    // navigation_path = display.path (matches buildRoomView's URL).
    expect(cond.card.tap_action.navigation_path).toBe('living_room')
  })

  it('sorts cards alphabetically by tile name', () => {
    const groupings = [
      grp('living_room', ['light.lr']),
      grp('bedroom', ['light.bedroom']),
      grp('attic', ['light.attic']),
    ]
    const section = buildActiveRoomsSection(groupings)
    const names = section!.cards.map((c) => (c as { card: { name: string } }).card.name)
    expect(names).toEqual(['Attic', 'Bedroom', 'Living Room'])
  })
})

describe('buildHomeView — integration', () => {
  it('full input with weather + outdoor temp + presence → Welcome with weather + Quick stats with 3 entities', () => {
    const view = buildHomeView({
      entities: [
        ent('weather.home'),
        ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
        ent('binary_sensor.anyone_home'),
        ent('light.kitchen'), // not in glance
      ],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    expect(view.sections).toHaveLength(2)
    const welcome = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(welcome.content).toContain("states('weather.home')")
    const glance = view.sections[1]!.cards[0] as { type: 'glance'; entities: string[] }
    expect(glance.entities).toEqual([
      'weather.home',
      'sensor.outdoor_temperature',
      'binary_sensor.anyone_home',
    ])
  })

  it('empty input → Welcome only, no Quick stats', () => {
    const view = buildHomeView({
      entities: [],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    expect(view.sections).toHaveLength(1)
  })
})

describe('buildHomeView — section ordering and conditional rendering', () => {
  const emptyGroupings: RoomGrouping[] = []

  it('empty input → only Welcome section appears', () => {
    const view = buildHomeView({
      entities: [],
      groupings: emptyGroupings,
      rooms: [],
      floorAssignments: new Map(),
      sections: ALL_SECTIONS_ON,
    })
    expect(view.sections).toHaveLength(1)
    expect(view.sections[0]!.cards[0]!.type).toBe('markdown')
  })

  // When floorAssignments is empty (no rooms have a floor), buildRoomsByFloorSection
  // returns null and the section is omitted. The full prod order with floor data is
  // Welcome, Quick stats, People, Rooms by floor, Active Rooms, Scenes, Cameras —
  // the floored path is exercised by buildRoomsByFloorSection's own describe block
  // and by the route-level integration test in preview.test.ts.
  it('sections appear in spec order without floor data: Welcome, Quick stats, People, Active Rooms, Scenes, Cameras', () => {
    const entities = [
      ent('weather.home'),
      ent('sensor.outdoor_temp', { deviceClass: 'temperature' }),
      ent('sensor.outdoor_humidity', { deviceClass: 'humidity' }),
      ent('person.alice', { friendlyName: 'Alice' }),
      ent('scene.movie_night', { friendlyName: 'Movie Night' }),
      ent('camera.front_door', { friendlyName: 'Front Door' }),
    ]
    const groupings = [grp('kitchen', ['light.kitchen_main'])]
    const view = buildHomeView({ entities, groupings, rooms: [], floorAssignments: new Map(), sections: ALL_SECTIONS_ON })

    expect(view.sections).toHaveLength(6)
    expect(view.sections[0]!.cards[0]!.type).toBe('markdown') // Welcome
    expect(view.sections[1]!.cards[0]!.type).toBe('glance') // Quick stats
    expect((view.sections[2]!.cards[0] as { title: string }).title).toBe('People')
    expect(view.sections[3]!.cards[0]!.type).toBe('conditional') // Active Rooms
    expect(view.sections[4]!.cards[0]!.type).toBe('tile') // Scenes (first card)
    expect(view.sections[5]!.cards[0]!.type).toBe('picture-entity') // Cameras
  })

  it('sections that have no qualifying entities are absent', () => {
    // Just enough for Welcome + Active Rooms; no people/scenes/cameras/QuickStats.
    const entities = [ent('light.kitchen_main')]
    const groupings = [grp('kitchen', ['light.kitchen_main'])]
    const view = buildHomeView({ entities, groupings, rooms: [], floorAssignments: new Map(), sections: ALL_SECTIONS_ON })

    expect(view.sections).toHaveLength(2)
    expect(view.sections[0]!.cards[0]!.type).toBe('markdown') // Welcome
    expect(view.sections[1]!.cards[0]!.type).toBe('conditional') // Active Rooms
  })
})

function makeRoom(id: AnalyzedRoom['id'], haAreaId: string | null): AnalyzedRoom {
  return {
    id,
    haAreaId,
    displayName: id === 'misc' ? 'Other' : id,
    entityCount: 1,
    averageConfidence: 0.9,
    assignments: [],
  }
}

function makeFloor(floorId: string, name: string, level: number | null = null): FloorAssignment {
  return { floorId, name, level, icon: null }
}

function makeGroupingWithLight(roomId: CanonicalRoomId, entityId: string): RoomGrouping {
  return {
    roomId,
    groups: [
      {
        key: 'lights',
        entities: [
          {
            entityId,
            domain: 'light',
            objectId: entityId.split('.')[1] ?? entityId,
            friendlyName: entityId,
            deviceClass: null,
            entityCategory: null,
            haAreaId: null,
            device: null,
            isHidden: false,
            isDisabled: false,
          },
        ],
      },
    ],
  }
}

describe('buildRoomsByFloorSection', () => {
  it('returns null when every room has a null floor (all-unfloored)', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', null)],
      groupings: [makeGroupingWithLight('kitchen', 'light.kitchen')],
      floorAssignments: new Map([['kitchen', null]]),
    })
    expect(result).toBeNull()
  })

  it('emits HeadingCard + GlanceCard for a single floor with one room', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area')],
      groupings: [makeGroupingWithLight('kitchen', 'light.kitchen')],
      floorAssignments: new Map([['kitchen', makeFloor('ground', 'Ground Floor', 0)]]),
    })
    expect(result).not.toBeNull()
    expect(result!.cards).toHaveLength(2)
    const heading = result!.cards[0] as HeadingCard
    const glance = result!.cards[1] as GlanceCard
    expect(heading.type).toBe('heading')
    expect(heading.heading).toBe('Ground Floor')
    expect(glance.type).toBe('glance')
    expect(glance.entities).toEqual([
      {
        entity: 'light.kitchen',
        name: 'Kitchen',
        tap_action: { action: 'navigate', navigation_path: 'kitchen' },
      },
    ])
  })

  it('emits two floor groups in level-ascending order', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area'), makeRoom('bedroom', 'bedroom_area')],
      groupings: [
        makeGroupingWithLight('kitchen', 'light.kitchen'),
        makeGroupingWithLight('bedroom', 'light.bedroom'),
      ],
      floorAssignments: new Map<CanonicalRoomId, FloorAssignment | null>([
        ['kitchen', makeFloor('ground', 'Ground', 0)],
        ['bedroom', makeFloor('upstairs', 'Upstairs', 1)],
      ]),
    })
    expect(result).not.toBeNull()
    expect(result!.cards).toHaveLength(4)
    const headings = result!.cards.filter((c) => c.type === 'heading') as HeadingCard[]
    expect(headings.map((h) => h.heading)).toEqual(['Ground', 'Upstairs'])
  })

  it('appends an "Other" heading + glance when some rooms are unfloored', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area'), makeRoom('garage', 'garage_area')],
      groupings: [
        makeGroupingWithLight('kitchen', 'light.kitchen'),
        makeGroupingWithLight('garage', 'light.garage'),
      ],
      floorAssignments: new Map<CanonicalRoomId, FloorAssignment | null>([
        ['kitchen', makeFloor('ground', 'Ground', 0)],
        ['garage', null],
      ]),
    })
    expect(result).not.toBeNull()
    expect(result!.cards).toHaveLength(4)
    const headings = result!.cards.filter((c) => c.type === 'heading') as HeadingCard[]
    expect(headings.map((h) => h.heading)).toEqual(['Ground', 'Other'])
  })

  it('returns null when the only assigned floor is null but the registry has entries', () => {
    // assignFloors emits null for all rooms when no area has a floor_id.
    // The section adds no value in that case.
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area')],
      groupings: [makeGroupingWithLight('kitchen', 'light.kitchen')],
      floorAssignments: new Map([['kitchen', null]]),
    })
    expect(result).toBeNull()
  })

  it('drops a room with no light or activity sensor from its glance', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area'), makeRoom('garden', 'garden_area')],
      groupings: [
        makeGroupingWithLight('kitchen', 'light.kitchen'),
        // garden has no lights or activity entities
        { roomId: 'garden', groups: [] },
      ],
      floorAssignments: new Map<CanonicalRoomId, FloorAssignment | null>([
        ['kitchen', makeFloor('ground', 'Ground', 0)],
        ['garden', makeFloor('ground', 'Ground', 0)],
      ]),
    })
    expect(result).not.toBeNull()
    const glance = result!.cards[1] as GlanceCard
    expect(glance.entities).toHaveLength(1)
    const entry = glance.entities[0] as { entity: string }
    expect(entry.entity).toBe('light.kitchen')
  })

  it('orders level-null floors after level-set floors, alphabetical within nulls', () => {
    const result = buildRoomsByFloorSection({
      rooms: [
        makeRoom('kitchen', 'kitchen_area'),
        makeRoom('bedroom', 'bedroom_area'),
        makeRoom('attic', 'attic_area'),
      ],
      groupings: [
        makeGroupingWithLight('kitchen', 'light.kitchen'),
        makeGroupingWithLight('bedroom', 'light.bedroom'),
        makeGroupingWithLight('attic', 'light.attic'),
      ],
      floorAssignments: new Map<CanonicalRoomId, FloorAssignment | null>([
        ['kitchen', makeFloor('ground', 'Ground', 0)],
        ['bedroom', makeFloor('zeta', 'Zeta', null)],
        ['attic', makeFloor('alpha', 'Alpha', null)],
      ]),
    })
    expect(result).not.toBeNull()
    const headings = result!.cards.filter((c) => c.type === 'heading') as HeadingCard[]
    expect(headings.map((h) => h.heading)).toEqual(['Ground', 'Alpha', 'Zeta'])
  })

  it('filters the misc room defensively even if present in the room list', () => {
    const result = buildRoomsByFloorSection({
      rooms: [makeRoom('kitchen', 'kitchen_area'), makeRoom('misc', null)],
      groupings: [makeGroupingWithLight('kitchen', 'light.kitchen')],
      floorAssignments: new Map<CanonicalRoomId, FloorAssignment | null>([
        ['kitchen', makeFloor('ground', 'Ground', 0)],
      ]),
    })
    expect(result).not.toBeNull()
    const glance = result!.cards[1] as GlanceCard
    expect(glance.entities).toHaveLength(1)
    const entry = glance.entities[0] as { entity: string }
    expect(entry.entity).toBe('light.kitchen')
  })
})

describe('buildHomeView — section toggles (P2-6)', () => {
  // Minimal fixture: one weather entity (powers Welcome + QuickStats),
  // one person (powers People), one scene (powers Scenes), one camera
  // (powers Cameras). Active rooms / floor sections need groupings.

  function makeInput(sections: SettingsSections): BuildHomeViewInput {
    return {
      entities: [
        {
          entityId: 'weather.home',
          domain: 'weather',
          objectId: 'home',
          friendlyName: 'Home weather',
          deviceClass: null,
          entityCategory: null,
          haAreaId: null,
          device: null,
          isHidden: false,
          isDisabled: false,
        },
      ],
      groupings: [],
      rooms: [],
      floorAssignments: new Map(),
      sections,
    }
  }

  const ALL_OFF: SettingsSections = {
    welcome: false,
    quickStats: false,
    people: false,
    roomsByFloor: false,
    activeRooms: false,
    scenes: false,
    cameras: false,
  }

  it('with all toggles on, includes the welcome section', () => {
    const home = buildHomeView(makeInput(ALL_SECTIONS_ON))
    // The Welcome section's first card is a markdown card.
    expect(home.sections[0]?.cards[0]?.type).toBe('markdown')
  })

  it('with welcome=false, omits the welcome section', () => {
    const home = buildHomeView(makeInput({ ...ALL_SECTIONS_ON, welcome: false }))
    const hasMarkdown = home.sections.some((s) =>
      s.cards.some((c) => c.type === 'markdown'),
    )
    expect(hasMarkdown).toBe(false)
  })

  it('with all toggles off, returns a HomeView with empty sections', () => {
    const home = buildHomeView(makeInput(ALL_OFF))
    expect(home.type).toBe('sections')
    expect(home.path).toBe('home')
    expect(home.sections).toEqual([])
  })
})
