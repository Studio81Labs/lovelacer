import { describe, it, expect } from 'vitest'
import type { CanonicalRoomId, NormalizedEntity } from '@lovelacer/shared'
import type { DomainGroup, RoomGrouping } from '@lovelacer/analyzer'
import { buildRoomView, buildRoomViews } from '../room-view.js'

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

const grouping = (
  roomId: CanonicalRoomId,
  groups: DomainGroup[],
): RoomGrouping => ({
  roomId,
  groups,
})

describe('buildRoomView — per-room metadata', () => {
  it('produces title, path, icon for each canonical room', () => {
    const expected: Record<CanonicalRoomId, { title: string; path: string; icon: string }> = {
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
    for (const [roomId, expectedDisplay] of Object.entries(expected)) {
      const view = buildRoomView(grouping(roomId as CanonicalRoomId, []))
      expect(view.title).toBe(expectedDisplay.title)
      expect(view.path).toBe(expectedDisplay.path)
      expect(view.icon).toBe(expectedDisplay.icon)
    }
  })

  it('returns type=sections for every room', () => {
    const view = buildRoomView(grouping('kitchen', []))
    expect(view.type).toBe('sections')
  })

  it('misc room uses path "other" (not "misc")', () => {
    const view = buildRoomView(grouping('misc', []))
    expect(view.path).toBe('other')
    expect(view.title).toBe('Other')
  })
})

describe('buildRoomView — empty groups', () => {
  it('produces an empty sections array when grouping has no groups', () => {
    const view = buildRoomView(grouping('kitchen', []))
    expect(view.sections).toEqual([])
  })
})

describe('buildRoomView — lights group', () => {
  it('produces heading + tile per light entity with light-brightness feature', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'lights',
          entities: [
            ent('light.kitchen_ceiling', { friendlyName: 'Kitchen Ceiling' }),
            ent('light.kitchen_counter', { friendlyName: 'Kitchen Counter' }),
          ],
        },
      ]),
    )
    expect(view.sections).toHaveLength(1)
    expect(view.sections[0]).toEqual({
      type: 'grid',
      cards: [
        { type: 'heading', heading: 'Lights & Outlets' },
        {
          type: 'tile',
          entity: 'light.kitchen_ceiling',
          features: [{ type: 'light-brightness' }],
        },
        {
          type: 'tile',
          entity: 'light.kitchen_counter',
          features: [{ type: 'light-brightness' }],
        },
      ],
    })
  })

  it('switches get a tile WITHOUT features', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'lights',
          entities: [ent('switch.coffee_maker', { friendlyName: 'Coffee Maker' })],
        },
      ]),
    )
    const cards = view.sections[0]!.cards
    expect(cards[1]).toEqual({ type: 'tile', entity: 'switch.coffee_maker' })
    // Specifically: the `features` key is absent (not `features: undefined`).
    expect('features' in (cards[1] as object)).toBe(false)
  })

  it('mixed light + switch entities each get the right tile shape', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'lights',
          entities: [
            ent('light.a', { friendlyName: 'A' }),
            ent('switch.b', { friendlyName: 'B' }),
            ent('light.c', { friendlyName: 'C' }),
          ],
        },
      ]),
    )
    const cards = view.sections[0]!.cards
    expect(cards[1]).toEqual({
      type: 'tile',
      entity: 'light.a',
      features: [{ type: 'light-brightness' }],
    })
    expect(cards[2]).toEqual({ type: 'tile', entity: 'switch.b' })
    expect(cards[3]).toEqual({
      type: 'tile',
      entity: 'light.c',
      features: [{ type: 'light-brightness' }],
    })
  })
})

describe('buildRoomView — climate group', () => {
  it('produces heading + thermostat per entity', () => {
    const view = buildRoomView(
      grouping('living_room', [
        {
          key: 'climate',
          entities: [
            ent('climate.living_room_thermostat', { friendlyName: 'Living Room Thermostat' }),
          ],
        },
      ]),
    )
    expect(view.sections[0]).toEqual({
      type: 'grid',
      cards: [
        { type: 'heading', heading: 'Climate' },
        { type: 'thermostat', entity: 'climate.living_room_thermostat' },
      ],
    })
  })
})

describe('buildRoomView — environment / activity / other groups', () => {
  it('environment group becomes heading + single entities card', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'environment',
          entities: [
            ent('sensor.kitchen_temp', { friendlyName: 'Kitchen Temperature' }),
            ent('sensor.kitchen_humidity', { friendlyName: 'Kitchen Humidity' }),
          ],
        },
      ]),
    )
    expect(view.sections[0]).toEqual({
      type: 'grid',
      cards: [
        { type: 'heading', heading: 'Environment' },
        {
          type: 'entities',
          entities: ['sensor.kitchen_temp', 'sensor.kitchen_humidity'],
        },
      ],
    })
  })

  it('activity group becomes heading + single entities card', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'activity',
          entities: [ent('binary_sensor.kitchen_motion', { friendlyName: 'Kitchen Motion' })],
        },
      ]),
    )
    expect(view.sections[0]).toEqual({
      type: 'grid',
      cards: [
        { type: 'heading', heading: 'Activity' },
        {
          type: 'entities',
          entities: ['binary_sensor.kitchen_motion'],
        },
      ],
    })
  })

  it('other group becomes heading + single entities card', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'other',
          entities: [
            ent('cover.kitchen_blinds', { friendlyName: 'Kitchen Blinds' }),
            ent('media_player.kitchen_speaker', { friendlyName: 'Kitchen Speaker' }),
          ],
        },
      ]),
    )
    expect(view.sections[0]).toEqual({
      type: 'grid',
      cards: [
        { type: 'heading', heading: 'Other' },
        {
          type: 'entities',
          entities: ['cover.kitchen_blinds', 'media_player.kitchen_speaker'],
        },
      ],
    })
  })

  it('preserves entity order from grouping (already friendly-name-sorted by P1a-5)', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        {
          key: 'environment',
          entities: [ent('sensor.a'), ent('sensor.b'), ent('sensor.c')],
        },
      ]),
    )
    const card = view.sections[0]!.cards[1] as { entities: string[] }
    expect(card.entities).toEqual(['sensor.a', 'sensor.b', 'sensor.c'])
  })
})

describe('buildRoomView — section ordering', () => {
  it('preserves group order from input (already GROUP_ORDER-sorted by P1a-5)', () => {
    const view = buildRoomView(
      grouping('kitchen', [
        { key: 'lights', entities: [ent('light.l')] },
        { key: 'climate', entities: [ent('climate.c')] },
        { key: 'activity', entities: [ent('binary_sensor.m', { deviceClass: 'motion' })] },
        {
          key: 'environment',
          entities: [ent('sensor.t', { deviceClass: 'temperature' })],
        },
        { key: 'other', entities: [ent('cover.x')] },
      ]),
    )
    const headings = view.sections.map((s) => (s.cards[0] as { heading: string }).heading)
    expect(headings).toEqual([
      'Lights & Outlets',
      'Climate',
      'Activity',
      'Environment',
      'Other',
    ])
  })
})

describe('buildRoomViews — bulk', () => {
  it('returns empty array for empty input', () => {
    expect(buildRoomViews([])).toEqual([])
  })

  it('produces one view per non-empty grouping, preserving order', () => {
    const views = buildRoomViews([
      grouping('kitchen', [{ key: 'lights', entities: [ent('light.k')] }]),
      grouping('bedroom', [{ key: 'lights', entities: [ent('light.b')] }]),
    ])
    expect(views).toHaveLength(2)
    expect(views[0]!.path).toBe('kitchen')
    expect(views[1]!.path).toBe('bedroom')
  })

  it('filters out groupings with no groups', () => {
    const views = buildRoomViews([
      grouping('kitchen', [{ key: 'lights', entities: [ent('light.k')] }]),
      grouping('bedroom', []),
      grouping('living_room', [{ key: 'lights', entities: [ent('light.lr')] }]),
    ])
    expect(views.map((v) => v.path)).toEqual(['kitchen', 'living_room'])
  })
})
