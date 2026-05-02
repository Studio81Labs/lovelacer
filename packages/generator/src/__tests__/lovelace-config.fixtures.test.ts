import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { czechTidy } from '../../../../tests/fixtures/czech-tidy.js'
import { kitchenSink } from '../../../../tests/fixtures/kitchen-sink.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import type { Fixture } from '../../../../tests/fixtures/_builder/index.js'
import { detect, groupByDomain, normalize } from '@lovelacer/analyzer'
import { buildHomeView } from '../home-view.js'
import { buildLovelaceConfig } from '../lovelace-config.js'
import { buildRoomViews } from '../room-view.js'

function pipe(fixture: Fixture) {
  const ha = fixtureToHaRegistries(fixture)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })
  const groupings = groupByDomain({ assignments, entities })
  // Mirror the production pipeline: misc entities surface only via the
  // analyze response's `misc[]` field, never as a dashboard view.
  const dashboardGroupings = groupings.filter((g) => g.roomId !== 'misc')
  const home = buildHomeView({
    entities,
    groupings: dashboardGroupings,
    rooms: [],
    floorAssignments: new Map(),
  })
  const rooms = buildRoomViews(dashboardGroupings)
  const config = buildLovelaceConfig({ home, rooms })
  return { entities, config }
}

function summarize(config: ReturnType<typeof pipe>['config']) {
  return {
    title: config.title,
    viewCount: config.views.length,
    views: config.views.map((v) => ({ title: v.title, path: v.path })),
  }
}

describe('buildLovelaceConfig — english-cluttered fixture', () => {
  const { config } = pipe(englishCluttered)

  it('matches structural snapshot', () => {
    expect(summarize(config)).toMatchInlineSnapshot(`
      {
        "title": "Lovelacer — Home",
        "viewCount": 10,
        "views": [
          {
            "path": "home",
            "title": "Home",
          },
          {
            "path": "attic",
            "title": "Attic",
          },
          {
            "path": "bathroom",
            "title": "Bathroom",
          },
          {
            "path": "bedroom",
            "title": "Bedroom",
          },
          {
            "path": "garage",
            "title": "Garage",
          },
          {
            "path": "garden",
            "title": "Garden",
          },
          {
            "path": "hallway",
            "title": "Hallway",
          },
          {
            "path": "kitchen",
            "title": "Kitchen",
          },
          {
            "path": "living_room",
            "title": "Living Room",
          },
          {
            "path": "office",
            "title": "Office",
          },
        ],
      }
    `)
  })

  it('home view is at index 0', () => {
    expect(config.views[0]!.path).toBe('home')
  })

  it('every view path is unique', () => {
    const paths = config.views.map((v) => v.path)
    expect(paths.length).toBe(new Set(paths).size)
  })

  it('rooms after home are sorted alphabetically by title', () => {
    const roomTitles = config.views.slice(1).map((v) => v.title)
    const sorted = [...roomTitles].sort((a, b) => a.localeCompare(b, 'en'))
    expect(roomTitles).toEqual(sorted)
  })
})

describe('buildLovelaceConfig — kitchen-sink fixture', () => {
  const { config } = pipe(kitchenSink)

  it('matches structural snapshot', () => {
    expect(summarize(config)).toMatchInlineSnapshot(`
      {
        "title": "Lovelacer — Home",
        "viewCount": 4,
        "views": [
          {
            "path": "home",
            "title": "Home",
          },
          {
            "path": "bedroom",
            "title": "Bedroom",
          },
          {
            "path": "kitchen",
            "title": "Kitchen",
          },
          {
            "path": "living_room",
            "title": "Living Room",
          },
        ],
      }
    `)
  })

  it('home view is at index 0', () => {
    expect(config.views[0]!.path).toBe('home')
  })

  it('every view path is unique', () => {
    const paths = config.views.map((v) => v.path)
    expect(paths.length).toBe(new Set(paths).size)
  })

  it('rooms after home are sorted alphabetically by title', () => {
    const roomTitles = config.views.slice(1).map((v) => v.title)
    const sorted = [...roomTitles].sort((a, b) => a.localeCompare(b, 'en'))
    expect(roomTitles).toEqual(sorted)
  })
})

describe('buildLovelaceConfig — czech-tidy fixture', () => {
  const { config } = pipe(czechTidy)

  it('matches structural snapshot', () => {
    expect(summarize(config)).toMatchInlineSnapshot(`
      {
        "title": "Lovelacer — Home",
        "viewCount": 6,
        "views": [
          {
            "path": "home",
            "title": "Home",
          },
          {
            "path": "bathroom",
            "title": "Bathroom",
          },
          {
            "path": "bedroom",
            "title": "Bedroom",
          },
          {
            "path": "kitchen",
            "title": "Kitchen",
          },
          {
            "path": "living_room",
            "title": "Living Room",
          },
          {
            "path": "office",
            "title": "Office",
          },
        ],
      }
    `)
  })

  it('home view is at index 0', () => {
    expect(config.views[0]!.path).toBe('home')
  })

  it('every view path is unique', () => {
    const paths = config.views.map((v) => v.path)
    expect(paths.length).toBe(new Set(paths).size)
  })
})
