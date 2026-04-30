import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { czechTidy } from '../../../../tests/fixtures/czech-tidy.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import type { Fixture } from '../../../../tests/fixtures/_builder/index.js'
import { normalize } from '@lovelacer/analyzer'
import { buildHomeView } from '../home-view.js'

function pipe(fixture: Fixture) {
  const ha = fixtureToHaRegistries(fixture)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const view = buildHomeView({ entities })
  return { entities, view }
}

function summarize(view: ReturnType<typeof pipe>['view']) {
  return {
    title: view.title,
    path: view.path,
    icon: view.icon,
    sections: view.sections.map((s) => ({
      cards: s.cards.map((c) => {
        if (c.type === 'glance') return { type: c.type, entities: c.entities }
        if (c.type === 'markdown')
          return { type: c.type, hasWeather: c.content.includes("states('") }
        return { type: c.type }
      }),
    })),
  }
}

describe('buildHomeView — english-cluttered fixture', () => {
  const { entities, view } = pipe(englishCluttered)

  it('matches structural snapshot', () => {
    expect(summarize(view)).toMatchInlineSnapshot(`
      {
        "icon": "mdi:home-variant",
        "path": "home",
        "sections": [
          {
            "cards": [
              {
                "hasWeather": false,
                "type": "markdown",
              },
            ],
          },
          {
            "cards": [
              {
                "entities": [
                  "sensor.outdoor_temperature",
                  "sensor.outdoor_humidity",
                  "binary_sensor.couch_presence",
                ],
                "type": "glance",
              },
            ],
          },
        ],
        "title": "Home",
      }
    `)
  })

  it('produces Welcome + Quick stats — 2 outdoor sensors plus 1 presence by entityId pattern', () => {
    expect(view.sections).toHaveLength(2)
  })

  it('every glance entityId exists in the input entity list', () => {
    const inputIds = new Set(entities.map((e) => e.entityId))
    for (const section of view.sections) {
      for (const card of section.cards) {
        if (card.type === 'glance') {
          for (const id of card.entities) {
            expect(inputIds.has(id)).toBe(true)
          }
        }
      }
    }
  })

  it('Welcome card is the first card in the first section', () => {
    expect(view.sections[0]!.cards[0]!.type).toBe('markdown')
  })
})

describe('buildHomeView — czech-tidy fixture', () => {
  const { view } = pipe(czechTidy)

  it('matches structural snapshot', () => {
    expect(summarize(view)).toMatchInlineSnapshot(`
      {
        "icon": "mdi:home-variant",
        "path": "home",
        "sections": [
          {
            "cards": [
              {
                "hasWeather": false,
                "type": "markdown",
              },
            ],
          },
        ],
        "title": "Home",
      }
    `)
  })

  it('produces Welcome only (czech-tidy has no outdoor/weather/presence/power entities)', () => {
    expect(view.sections).toHaveLength(1)
    expect(view.sections[0]!.cards[0]!.type).toBe('markdown')
  })
})
