import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { czechTidy } from '../../../../tests/fixtures/czech-tidy.js'
import { kitchenSink } from '../../../../tests/fixtures/kitchen-sink.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import type { Fixture } from '../../../../tests/fixtures/_builder/index.js'
import { normalize, detect, groupByDomain } from '@lovelacer/analyzer'
import { buildRoomViews } from '../room-view.js'
import type { LovelaceCard } from '../lovelace-types.js'

function pipe(fixture: Fixture) {
  const ha = fixtureToHaRegistries(fixture)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })
  const groupings = groupByDomain({ assignments, entities })
  const views = buildRoomViews(groupings)
  return { entities, groupings, views }
}

function summarize(views: ReturnType<typeof pipe>['views']) {
  return views.map((v) => ({
    title: v.title,
    path: v.path,
    icon: v.icon,
    sections: v.sections.map((s) => {
      const heading = (s.cards[0] as { heading?: string }).heading
      const cardTypeCounts: Record<string, number> = {}
      for (let i = 1; i < s.cards.length; i++) {
        const t = s.cards[i]!.type
        cardTypeCounts[t] = (cardTypeCounts[t] ?? 0) + 1
      }
      return { heading, cards: cardTypeCounts }
    }),
  }))
}

function entityIdsInCard(card: LovelaceCard): string[] {
  if (card.type === 'tile' || card.type === 'thermostat') return [card.entity]
  if (card.type === 'media-control' || card.type === 'picture-entity') return [card.entity]
  if (card.type === 'entities') return card.entities
  if (card.type === 'conditional') return entityIdsInCard(card.card)
  return [] // heading, markdown, glance
}

describe('buildRoomViews — english-cluttered fixture', () => {
  const { groupings, views } = pipe(englishCluttered)

  it('matches structural snapshot', () => {
    expect(summarize(views)).toMatchInlineSnapshot(`
      [
        {
          "icon": "mdi:home-roof",
          "path": "attic",
          "sections": [
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
          ],
          "title": "Attic",
        },
        {
          "icon": "mdi:shower-head",
          "path": "bathroom",
          "sections": [
            {
              "cards": {
                "tile": 4,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
          ],
          "title": "Bathroom",
        },
        {
          "icon": "mdi:bed",
          "path": "bedroom",
          "sections": [
            {
              "cards": {
                "tile": 4,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "thermostat": 1,
              },
              "heading": "Climate",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Covers",
            },
            {
              "cards": {
                "media-control": 1,
              },
              "heading": "Media",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
          ],
          "title": "Bedroom",
        },
        {
          "icon": "mdi:garage-variant",
          "path": "garage",
          "sections": [
            {
              "cards": {
                "tile": 4,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Covers",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Security",
            },
          ],
          "title": "Garage",
        },
        {
          "icon": "mdi:flower-tulip",
          "path": "garden",
          "sections": [
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Other",
            },
          ],
          "title": "Garden",
        },
        {
          "icon": "mdi:door",
          "path": "hallway",
          "sections": [
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Covers",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
          ],
          "title": "Hallway",
        },
        {
          "icon": "mdi:silverware-fork-knife",
          "path": "kitchen",
          "sections": [
            {
              "cards": {
                "tile": 7,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Covers",
            },
            {
              "cards": {
                "media-control": 1,
              },
              "heading": "Media",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
          ],
          "title": "Kitchen",
        },
        {
          "icon": "mdi:sofa",
          "path": "living_room",
          "sections": [
            {
              "cards": {
                "tile": 7,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "thermostat": 1,
              },
              "heading": "Climate",
            },
            {
              "cards": {
                "media-control": 2,
              },
              "heading": "Media",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
          ],
          "title": "Living Room",
        },
        {
          "icon": "mdi:dots-horizontal",
          "path": "other",
          "sections": [
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Security",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Other",
            },
          ],
          "title": "Other",
        },
        {
          "icon": "mdi:desk",
          "path": "office",
          "sections": [
            {
              "cards": {
                "tile": 6,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Fans",
            },
          ],
          "title": "Office",
        },
      ]
    `)
  })

  it('produces one view per non-empty grouping', () => {
    expect(views.length).toBe(groupings.filter((g) => g.groups.length > 0).length)
  })

  it('all view paths are unique', () => {
    const paths = views.map((v) => v.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('every entity that survived grouping appears exactly once across all cards', () => {
    const entityIdsInOutput: string[] = []
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          entityIdsInOutput.push(...entityIdsInCard(card))
        }
      }
    }
    const expectedCount = groupings.reduce(
      (sum, g) => sum + g.groups.reduce((s, grp) => s + grp.entities.length, 0),
      0,
    )
    expect(entityIdsInOutput).toHaveLength(expectedCount)
    expect(new Set(entityIdsInOutput).size).toBe(entityIdsInOutput.length)
  })

  it('every TileCard has a non-empty entity', () => {
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          if (card.type === 'tile') expect(card.entity).not.toBe('')
        }
      }
    }
  })

  it('every ThermostatCard has a non-empty entity', () => {
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          if (card.type === 'thermostat') expect(card.entity).not.toBe('')
        }
      }
    }
  })

  it('every EntitiesCard has at least one entity', () => {
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          if (card.type === 'entities') expect(card.entities.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('first card in every section is a heading', () => {
    for (const view of views) {
      for (const section of view.sections) {
        expect(section.cards[0]?.type).toBe('heading')
      }
    }
  })

  it('lights sections contain only tile cards (after the heading)', () => {
    for (const view of views) {
      for (const section of view.sections) {
        if ((section.cards[0] as { heading: string }).heading !== 'Lights & Outlets') continue
        for (let i = 1; i < section.cards.length; i++) {
          expect(section.cards[i]!.type).toBe('tile')
        }
      }
    }
  })

  it('climate sections contain only thermostat cards (after the heading)', () => {
    for (const view of views) {
      for (const section of view.sections) {
        if ((section.cards[0] as { heading: string }).heading !== 'Climate') continue
        for (let i = 1; i < section.cards.length; i++) {
          expect(section.cards[i]!.type).toBe('thermostat')
        }
      }
    }
  })

  it('environment / activity / other sections contain exactly one entities card after the heading', () => {
    const groupedHeadings = new Set(['Environment', 'Activity', 'Other'])
    for (const view of views) {
      for (const section of view.sections) {
        const heading = (section.cards[0] as { heading: string }).heading
        if (!groupedHeadings.has(heading)) continue
        expect(section.cards.length).toBe(2)
        expect(section.cards[1]?.type).toBe('entities')
      }
    }
  })
})

describe('buildRoomViews — kitchen-sink fixture', () => {
  const { groupings, views } = pipe(kitchenSink)

  it('matches structural snapshot', () => {
    expect(summarize(views)).toMatchInlineSnapshot(`
      [
        {
          "icon": "mdi:bed",
          "path": "bedroom",
          "sections": [
            {
              "cards": {
                "tile": 2,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Covers",
            },
            {
              "cards": {
                "media-control": 1,
              },
              "heading": "Media",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Fans",
            },
          ],
          "title": "Bedroom",
        },
        {
          "icon": "mdi:silverware-fork-knife",
          "path": "kitchen",
          "sections": [
            {
              "cards": {
                "tile": 2,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "media-control": 1,
              },
              "heading": "Media",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Vacuum",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Fans",
            },
          ],
          "title": "Kitchen",
        },
        {
          "icon": "mdi:sofa",
          "path": "living_room",
          "sections": [
            {
              "cards": {
                "tile": 2,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Covers",
            },
            {
              "cards": {
                "media-control": 1,
              },
              "heading": "Media",
            },
            {
              "cards": {
                "picture-entity": 1,
              },
              "heading": "Cameras",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
          ],
          "title": "Living Room",
        },
        {
          "icon": "mdi:dots-horizontal",
          "path": "other",
          "sections": [
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "picture-entity": 1,
              },
              "heading": "Cameras",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "tile": 1,
              },
              "heading": "Security",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Other",
            },
          ],
          "title": "Other",
        },
      ]
    `)
  })

  it('produces one view per non-empty grouping', () => {
    expect(views.length).toBe(groupings.filter((g) => g.groups.length > 0).length)
  })

  it('all view paths are unique', () => {
    const paths = views.map((v) => v.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('every entity that survived grouping appears exactly once across all cards', () => {
    const entityIdsInOutput: string[] = []
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          entityIdsInOutput.push(...entityIdsInCard(card))
        }
      }
    }
    const expectedCount = groupings.reduce(
      (sum, g) => sum + g.groups.reduce((s, grp) => s + grp.entities.length, 0),
      0,
    )
    expect(entityIdsInOutput).toHaveLength(expectedCount)
    expect(new Set(entityIdsInOutput).size).toBe(entityIdsInOutput.length)
  })

  it('every TileCard has a non-empty entity', () => {
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          if (card.type === 'tile') expect(card.entity).not.toBe('')
        }
      }
    }
  })

  it('every ThermostatCard has a non-empty entity', () => {
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          if (card.type === 'thermostat') expect(card.entity).not.toBe('')
        }
      }
    }
  })

  it('every EntitiesCard has at least one entity', () => {
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          if (card.type === 'entities') expect(card.entities.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('first card in every section is a heading', () => {
    for (const view of views) {
      for (const section of view.sections) {
        expect(section.cards[0]?.type).toBe('heading')
      }
    }
  })

  it('lights sections contain only tile cards (after the heading)', () => {
    for (const view of views) {
      for (const section of view.sections) {
        if ((section.cards[0] as { heading: string }).heading !== 'Lights & Outlets') continue
        for (let i = 1; i < section.cards.length; i++) {
          expect(section.cards[i]!.type).toBe('tile')
        }
      }
    }
  })

  it('climate sections contain only thermostat cards (after the heading)', () => {
    for (const view of views) {
      for (const section of view.sections) {
        if ((section.cards[0] as { heading: string }).heading !== 'Climate') continue
        for (let i = 1; i < section.cards.length; i++) {
          expect(section.cards[i]!.type).toBe('thermostat')
        }
      }
    }
  })

  it('environment / activity / other sections contain exactly one entities card after the heading', () => {
    const groupedHeadings = new Set(['Environment', 'Activity', 'Other'])
    for (const view of views) {
      for (const section of view.sections) {
        const heading = (section.cards[0] as { heading: string }).heading
        if (!groupedHeadings.has(heading)) continue
        expect(section.cards.length).toBe(2)
        expect(section.cards[1]?.type).toBe('entities')
      }
    }
  })
})

describe('buildRoomViews — czech-tidy fixture', () => {
  const { groupings, views } = pipe(czechTidy)

  it('matches structural snapshot', () => {
    expect(summarize(views)).toMatchInlineSnapshot(`
      [
        {
          "icon": "mdi:shower-head",
          "path": "bathroom",
          "sections": [
            {
              "cards": {
                "tile": 4,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
          ],
          "title": "Bathroom",
        },
        {
          "icon": "mdi:bed",
          "path": "bedroom",
          "sections": [
            {
              "cards": {
                "tile": 7,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "thermostat": 1,
              },
              "heading": "Climate",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Other",
            },
          ],
          "title": "Bedroom",
        },
        {
          "icon": "mdi:silverware-fork-knife",
          "path": "kitchen",
          "sections": [
            {
              "cards": {
                "tile": 9,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Other",
            },
          ],
          "title": "Kitchen",
        },
        {
          "icon": "mdi:sofa",
          "path": "living_room",
          "sections": [
            {
              "cards": {
                "tile": 11,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "thermostat": 1,
              },
              "heading": "Climate",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Other",
            },
          ],
          "title": "Living Room",
        },
        {
          "icon": "mdi:desk",
          "path": "office",
          "sections": [
            {
              "cards": {
                "tile": 6,
              },
              "heading": "Lights & Outlets",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Activity",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Environment",
            },
            {
              "cards": {
                "entities": 1,
              },
              "heading": "Other",
            },
          ],
          "title": "Office",
        },
      ]
    `)
  })

  it('produces one view per grouping (czech-tidy has no empty groupings)', () => {
    expect(views.length).toBe(groupings.length)
  })

  it('all view paths are unique', () => {
    const paths = views.map((v) => v.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('every entity in groupings appears exactly once across all cards', () => {
    const entityIdsInOutput: string[] = []
    for (const view of views) {
      for (const section of view.sections) {
        for (const card of section.cards) {
          entityIdsInOutput.push(...entityIdsInCard(card))
        }
      }
    }
    const expectedCount = groupings.reduce(
      (sum, g) => sum + g.groups.reduce((s, grp) => s + grp.entities.length, 0),
      0,
    )
    expect(entityIdsInOutput).toHaveLength(expectedCount)
    expect(new Set(entityIdsInOutput).size).toBe(entityIdsInOutput.length)
  })

  it('first card in every section is a heading', () => {
    for (const view of views) {
      for (const section of view.sections) {
        expect(section.cards[0]?.type).toBe('heading')
      }
    }
  })
})
