import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { czechTidy } from '../../../../tests/fixtures/czech-tidy.js'
import { germanMassive } from '../../../../tests/fixtures/german-massive.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import { normalize } from '../normalize.js'
import { detect } from '../detect.js'
import { groupByDomain } from '../grouping.js'

function pipe(fixture: typeof englishCluttered) {
  const ha = fixtureToHaRegistries(fixture)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })
  const groupings = groupByDomain({ assignments, entities })
  return { ha, entities, assignments, groupings }
}

function summarize(groupings: ReturnType<typeof pipe>['groupings']) {
  return groupings.map((g) => ({
    roomId: g.roomId,
    groups: g.groups.map((grp) => ({ key: grp.key, count: grp.entities.length })),
  }))
}

describe('groupByDomain — english-cluttered fixture', () => {
  const { entities, groupings } = pipe(englishCluttered)

  it('matches structural snapshot', () => {
    expect(summarize(groupings)).toMatchInlineSnapshot(`
      [
        {
          "groups": [
            {
              "count": 1,
              "key": "activity",
            },
            {
              "count": 2,
              "key": "environment",
            },
          ],
          "roomId": "attic",
        },
        {
          "groups": [
            {
              "count": 4,
              "key": "lights",
            },
            {
              "count": 2,
              "key": "activity",
            },
            {
              "count": 3,
              "key": "environment",
            },
            {
              "count": 1,
              "key": "other",
            },
          ],
          "roomId": "bathroom",
        },
        {
          "groups": [
            {
              "count": 4,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "climate",
            },
            {
              "count": 6,
              "key": "activity",
            },
            {
              "count": 5,
              "key": "environment",
            },
            {
              "count": 4,
              "key": "other",
            },
          ],
          "roomId": "bedroom",
        },
        {
          "groups": [
            {
              "count": 4,
              "key": "lights",
            },
            {
              "count": 2,
              "key": "activity",
            },
            {
              "count": 2,
              "key": "environment",
            },
            {
              "count": 4,
              "key": "other",
            },
          ],
          "roomId": "garage",
        },
        {
          "groups": [
            {
              "count": 2,
              "key": "environment",
            },
            {
              "count": 3,
              "key": "other",
            },
          ],
          "roomId": "garden",
        },
        {
          "groups": [
            {
              "count": 3,
              "key": "activity",
            },
            {
              "count": 2,
              "key": "environment",
            },
            {
              "count": 1,
              "key": "other",
            },
          ],
          "roomId": "hallway",
        },
        {
          "groups": [
            {
              "count": 7,
              "key": "lights",
            },
            {
              "count": 5,
              "key": "activity",
            },
            {
              "count": 7,
              "key": "environment",
            },
            {
              "count": 3,
              "key": "other",
            },
          ],
          "roomId": "kitchen",
        },
        {
          "groups": [
            {
              "count": 7,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "climate",
            },
            {
              "count": 6,
              "key": "activity",
            },
            {
              "count": 6,
              "key": "environment",
            },
            {
              "count": 4,
              "key": "other",
            },
          ],
          "roomId": "living_room",
        },
        {
          "groups": [
            {
              "count": 1,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "activity",
            },
            {
              "count": 9,
              "key": "environment",
            },
            {
              "count": 15,
              "key": "other",
            },
          ],
          "roomId": "misc",
        },
        {
          "groups": [
            {
              "count": 6,
              "key": "lights",
            },
            {
              "count": 5,
              "key": "activity",
            },
            {
              "count": 5,
              "key": "environment",
            },
            {
              "count": 4,
              "key": "other",
            },
          ],
          "roomId": "office",
        },
      ]
    `)
  })

  it('drops hidden + disabled entities from output', () => {
    const totalGrouped = groupings.reduce(
      (sum, room) => sum + room.groups.reduce((s, g) => s + g.entities.length, 0),
      0,
    )
    const expectedGrouped = entities.filter((e) => !e.isHidden && !e.isDisabled).length
    expect(totalGrouped).toBe(expectedGrouped)
  })

  it('contains no empty groups', () => {
    for (const room of groupings) {
      for (const group of room.groups) {
        expect(group.entities.length).toBeGreaterThan(0)
      }
    }
  })

  it('contains no hidden or disabled entities anywhere in output', () => {
    for (const room of groupings) {
      for (const group of room.groups) {
        for (const entity of group.entities) {
          expect(entity.isHidden).toBe(false)
          expect(entity.isDisabled).toBe(false)
        }
      }
    }
  })

  it('every `other` group contains at least one entity that is genuinely a fallback', () => {
    // A "genuine fallback" is an entity whose (domain, deviceClass) does not
    // match any P1a routing rule. This proves `other` is actually catching
    // the fallback path, not just collecting bugs.
    const isP1aRouted = (e: { domain: string; deviceClass: string | null }): boolean => {
      if (e.domain === 'light' || e.domain === 'switch') return true
      if (e.domain === 'climate') return true
      if (e.domain === 'sensor' && e.deviceClass !== null) {
        return ['temperature', 'humidity'].includes(e.deviceClass)
      }
      if (e.domain === 'binary_sensor' && e.deviceClass !== null) {
        return ['motion', 'occupancy', 'door'].includes(e.deviceClass)
      }
      return false
    }
    for (const room of groupings) {
      const other = room.groups.find((g) => g.key === 'other')
      if (other === undefined) continue
      const hasGenuineFallback = other.entities.some((e) => !isP1aRouted(e))
      expect(
        hasGenuineFallback,
        `room ${room.roomId} 'other' group has no fallback-routed entity`,
      ).toBe(true)
    }
  })

  it('within each group, entities are sorted alphabetically by friendlyName (case-insensitive)', () => {
    for (const room of groupings) {
      for (const group of room.groups) {
        const names = group.entities.map((e) => e.friendlyName.toLowerCase())
        // Mirror the production comparator exactly (locale 'en'). Default
        // Array.sort() does UTF-16 code-point comparison, which diverges
        // from localeCompare on accented characters — using sort() as the
        // reference would silently false-pass or false-fail on future
        // fixtures that introduce diacritic-sorted entries.
        const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en'))
        expect(names).toEqual(sorted)
      }
    }
  })
})

describe('groupByDomain — czech-tidy fixture', () => {
  const { entities, groupings } = pipe(czechTidy)

  it('matches structural snapshot', () => {
    expect(summarize(groupings)).toMatchInlineSnapshot(`
      [
        {
          "groups": [
            {
              "count": 4,
              "key": "lights",
            },
            {
              "count": 2,
              "key": "activity",
            },
            {
              "count": 3,
              "key": "environment",
            },
            {
              "count": 1,
              "key": "other",
            },
          ],
          "roomId": "bathroom",
        },
        {
          "groups": [
            {
              "count": 7,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "climate",
            },
            {
              "count": 3,
              "key": "activity",
            },
            {
              "count": 3,
              "key": "environment",
            },
            {
              "count": 4,
              "key": "other",
            },
          ],
          "roomId": "bedroom",
        },
        {
          "groups": [
            {
              "count": 9,
              "key": "lights",
            },
            {
              "count": 2,
              "key": "activity",
            },
            {
              "count": 4,
              "key": "environment",
            },
            {
              "count": 3,
              "key": "other",
            },
          ],
          "roomId": "kitchen",
        },
        {
          "groups": [
            {
              "count": 11,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "climate",
            },
            {
              "count": 2,
              "key": "activity",
            },
            {
              "count": 2,
              "key": "environment",
            },
            {
              "count": 6,
              "key": "other",
            },
          ],
          "roomId": "living_room",
        },
        {
          "groups": [
            {
              "count": 6,
              "key": "lights",
            },
            {
              "count": 2,
              "key": "activity",
            },
            {
              "count": 3,
              "key": "environment",
            },
            {
              "count": 1,
              "key": "other",
            },
          ],
          "roomId": "office",
        },
      ]
    `)
  })

  it('drops hidden + disabled entities (czech-tidy has none, so output count == input count)', () => {
    const totalGrouped = groupings.reduce(
      (sum, room) => sum + room.groups.reduce((s, g) => s + g.entities.length, 0),
      0,
    )
    expect(totalGrouped).toBe(entities.length)
  })

  it('contains no empty groups', () => {
    for (const room of groupings) {
      for (const group of room.groups) {
        expect(group.entities.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('groupByDomain — german-massive fixture', () => {
  const { ha, groupings } = pipe(germanMassive)

  it('matches structural snapshot', () => {
    const summary = groupings
      .filter((g) => g.roomId !== 'misc')
      .map((g) => ({
        roomId: g.roomId,
        groups: g.groups.map((sub) => ({ key: sub.key, count: sub.entities.length })),
      }))
    expect(summary).toMatchInlineSnapshot(`
      [
        {
          "groups": [
            {
              "count": 2,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "activity",
            },
            {
              "count": 2,
              "key": "environment",
            },
            {
              "count": 1,
              "key": "other",
            },
          ],
          "roomId": "basement",
        },
        {
          "groups": [
            {
              "count": 5,
              "key": "lights",
            },
            {
              "count": 2,
              "key": "activity",
            },
            {
              "count": 4,
              "key": "environment",
            },
          ],
          "roomId": "bathroom",
        },
        {
          "groups": [
            {
              "count": 3,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "climate",
            },
            {
              "count": 2,
              "key": "activity",
            },
            {
              "count": 2,
              "key": "environment",
            },
            {
              "count": 1,
              "key": "other",
            },
          ],
          "roomId": "bedroom",
        },
        {
          "groups": [
            {
              "count": 3,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "activity",
            },
            {
              "count": 1,
              "key": "environment",
            },
          ],
          "roomId": "dining_room",
        },
        {
          "groups": [
            {
              "count": 2,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "activity",
            },
            {
              "count": 1,
              "key": "environment",
            },
            {
              "count": 1,
              "key": "other",
            },
          ],
          "roomId": "garage",
        },
        {
          "groups": [
            {
              "count": 3,
              "key": "lights",
            },
            {
              "count": 2,
              "key": "activity",
            },
            {
              "count": 1,
              "key": "environment",
            },
            {
              "count": 1,
              "key": "other",
            },
          ],
          "roomId": "garden",
        },
        {
          "groups": [
            {
              "count": 2,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "activity",
            },
            {
              "count": 1,
              "key": "environment",
            },
          ],
          "roomId": "guest_room",
        },
        {
          "groups": [
            {
              "count": 3,
              "key": "lights",
            },
            {
              "count": 3,
              "key": "activity",
            },
          ],
          "roomId": "hallway",
        },
        {
          "groups": [
            {
              "count": 3,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "activity",
            },
            {
              "count": 2,
              "key": "environment",
            },
          ],
          "roomId": "kids_room",
        },
        {
          "groups": [
            {
              "count": 6,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "activity",
            },
            {
              "count": 2,
              "key": "environment",
            },
            {
              "count": 1,
              "key": "other",
            },
          ],
          "roomId": "kitchen",
        },
        {
          "groups": [
            {
              "count": 3,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "activity",
            },
            {
              "count": 2,
              "key": "environment",
            },
            {
              "count": 1,
              "key": "other",
            },
          ],
          "roomId": "laundry",
        },
        {
          "groups": [
            {
              "count": 4,
              "key": "lights",
            },
            {
              "count": 1,
              "key": "climate",
            },
            {
              "count": 2,
              "key": "activity",
            },
            {
              "count": 2,
              "key": "environment",
            },
            {
              "count": 1,
              "key": "other",
            },
          ],
          "roomId": "living_room",
        },
      ]
    `)
  })

  it('every canonical room has at least one group', () => {
    for (const g of groupings) {
      if (g.roomId === 'misc') continue
      expect(g.groups.length, `room ${g.roomId} should have ≥1 group`).toBeGreaterThan(0)
    }
  })

  it('hidden and disabled entities are excluded from grouping output', () => {
    const visibleEntityIds = new Set(
      ha.entities
        .filter((e) => e.hidden_by === null && e.disabled_by === null)
        .map((e) => e.entity_id),
    )
    for (const g of groupings) {
      for (const sub of g.groups) {
        for (const e of sub.entities) {
          expect(
            visibleEntityIds.has(e.entityId),
            `${e.entityId} (hidden or disabled) leaked into grouping`,
          ).toBe(true)
        }
      }
    }
  })
})
