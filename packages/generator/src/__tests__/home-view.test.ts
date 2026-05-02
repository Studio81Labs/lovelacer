import { describe, it, expect } from 'vitest'
import type { NormalizedEntity } from '@lovelacer/shared'
import {
  buildActiveRoomsSection,
  buildCamerasSection,
  buildHomeView,
  buildPeopleSection,
  buildScenesSection,
  pickQuickStatsEntities,
} from '../home-view.js'
import type { RoomGrouping } from '@lovelacer/analyzer'

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
    const view = buildHomeView({ entities: [], groupings: [] })
    expect(view.type).toBe('sections')
    expect(view.title).toBe('Home')
    expect(view.path).toBe('home')
    expect(view.icon).toBe('mdi:home-variant')
  })
})

describe('buildHomeView — Welcome section', () => {
  it('always emits a Welcome section even with empty entities', () => {
    const view = buildHomeView({ entities: [], groupings: [] })
    expect(view.sections).toHaveLength(1)
    const card = view.sections[0]!.cards[0]
    expect(card?.type).toBe('markdown')
  })

  it('Welcome card has greeting only when no weather entity exists', () => {
    const view = buildHomeView({ entities: [ent('light.kitchen')], groupings: [] })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain('Good ')
    expect(card.content).toContain("now().strftime('%H')")
    // No weather template line
    expect(card.content).not.toContain('states(')
    expect(card.content).not.toContain('state_attr(')
  })

  it('Welcome card adds weather template when weather entity exists', () => {
    const view = buildHomeView({ entities: [ent('weather.home')], groupings: [] })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain("{{ states('weather.home') }}")
    expect(card.content).toContain("{{ state_attr('weather.home', 'temperature') }}°")
  })

  it('Welcome card uses the first weather entity when multiple exist', () => {
    const view = buildHomeView({
      entities: [ent('weather.home'), ent('weather.forecast')],
      groupings: [],
    })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain("states('weather.home')")
    expect(card.content).not.toContain("states('weather.forecast')")
  })
})

describe('buildHomeView — Quick stats section', () => {
  it('skips Quick stats section when 0 entities match', () => {
    const view = buildHomeView({ entities: [ent('light.kitchen')], groupings: [] })
    expect(view.sections).toHaveLength(1) // Welcome only
  })

  it('skips Quick stats section when only 1 entity matches', () => {
    const view = buildHomeView({
      entities: [ent('sensor.outdoor_temperature', { deviceClass: 'temperature' })],
      groupings: [],
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

  it('tile has tap_action.navigation_path === room.roomId', () => {
    const groupings = [grp('living_room', ['light.lr_main'])]
    const section = buildActiveRoomsSection(groupings)
    const cond = section!.cards[0] as { card: { tap_action: { navigation_path: string } } }
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
    const view = buildHomeView({ entities: [], groupings: [] })
    expect(view.sections).toHaveLength(1)
  })
})

describe('buildHomeView — section ordering and conditional rendering', () => {
  const emptyGroupings: RoomGrouping[] = []

  it('empty input → only Welcome section appears', () => {
    const view = buildHomeView({ entities: [], groupings: emptyGroupings })
    expect(view.sections).toHaveLength(1)
    expect(view.sections[0]!.cards[0]!.type).toBe('markdown')
  })

  it('sections appear in spec order: Welcome, Quick stats, People, Active Rooms, Scenes, Cameras', () => {
    const entities = [
      ent('weather.home'),
      ent('sensor.outdoor_temp', { deviceClass: 'temperature' }),
      ent('sensor.outdoor_humidity', { deviceClass: 'humidity' }),
      ent('person.alice', { friendlyName: 'Alice' }),
      ent('scene.movie_night', { friendlyName: 'Movie Night' }),
      ent('camera.front_door', { friendlyName: 'Front Door' }),
    ]
    const groupings = [grp('kitchen', ['light.kitchen_main'])]
    const view = buildHomeView({ entities, groupings })

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
    const view = buildHomeView({ entities, groupings })

    expect(view.sections).toHaveLength(2)
    expect(view.sections[0]!.cards[0]!.type).toBe('markdown') // Welcome
    expect(view.sections[1]!.cards[0]!.type).toBe('conditional') // Active Rooms
  })
})
