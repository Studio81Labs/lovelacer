import { describe, it, expect } from 'vitest'
import type { NormalizedEntity } from '@lovelacer/shared'
import { buildHomeView, pickQuickStatsEntities } from '../home-view.js'

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
    const result = pickQuickStatsEntities([
      ent('sensor.house_power_now', { deviceClass: 'power' }),
    ])
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
    const result = pickQuickStatsEntities([
      ent('weather.home'),
      ent('weather.forecast'),
    ])
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
    const view = buildHomeView({ entities: [] })
    expect(view.type).toBe('sections')
    expect(view.title).toBe('Home')
    expect(view.path).toBe('home')
    expect(view.icon).toBe('mdi:home-variant')
  })
})

describe('buildHomeView — Welcome section', () => {
  it('always emits a Welcome section even with empty entities', () => {
    const view = buildHomeView({ entities: [] })
    expect(view.sections).toHaveLength(1)
    const card = view.sections[0]!.cards[0]
    expect(card?.type).toBe('markdown')
  })

  it('Welcome card has greeting only when no weather entity exists', () => {
    const view = buildHomeView({ entities: [ent('light.kitchen')] })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain('Good ')
    expect(card.content).toContain("now().strftime('%H')")
    // No weather template line
    expect(card.content).not.toContain('states(')
    expect(card.content).not.toContain('state_attr(')
  })

  it('Welcome card adds weather template when weather entity exists', () => {
    const view = buildHomeView({ entities: [ent('weather.home')] })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain("{{ states('weather.home') }}")
    expect(card.content).toContain("{{ state_attr('weather.home', 'temperature') }}°")
  })

  it('Welcome card uses the first weather entity when multiple exist', () => {
    const view = buildHomeView({
      entities: [ent('weather.home'), ent('weather.forecast')],
    })
    const card = view.sections[0]!.cards[0] as { type: 'markdown'; content: string }
    expect(card.content).toContain("states('weather.home')")
    expect(card.content).not.toContain("states('weather.forecast')")
  })
})

describe('buildHomeView — Quick stats section', () => {
  it('skips Quick stats section when 0 entities match', () => {
    const view = buildHomeView({ entities: [ent('light.kitchen')] })
    expect(view.sections).toHaveLength(1) // Welcome only
  })

  it('skips Quick stats section when only 1 entity matches', () => {
    const view = buildHomeView({
      entities: [ent('sensor.outdoor_temperature', { deviceClass: 'temperature' })],
    })
    expect(view.sections).toHaveLength(1) // Welcome only
  })

  it('emits Quick stats section when 2 entities match', () => {
    const view = buildHomeView({
      entities: [
        ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
        ent('sensor.outdoor_humidity', { deviceClass: 'humidity' }),
      ],
    })
    expect(view.sections).toHaveLength(2)
    const glance = view.sections[1]!.cards[0] as {
      type: 'glance'
      title: string
      entities: string[]
    }
    expect(glance.type).toBe('glance')
    expect(glance.title).toBe('Quick stats')
    expect(glance.entities).toEqual([
      'sensor.outdoor_temperature',
      'sensor.outdoor_humidity',
    ])
  })

  it('Quick stats section has exactly one glance card', () => {
    const view = buildHomeView({
      entities: [
        ent('weather.home'),
        ent('sensor.outdoor_temperature', { deviceClass: 'temperature' }),
        ent('binary_sensor.anyone_home'),
      ],
    })
    expect(view.sections[1]!.cards).toHaveLength(1)
    expect(view.sections[1]!.cards[0]!.type).toBe('glance')
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
    const view = buildHomeView({ entities: [] })
    expect(view.sections).toHaveLength(1)
  })
})
