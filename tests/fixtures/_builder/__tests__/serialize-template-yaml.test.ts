import { describe, it, expect } from 'vitest'
import { parse } from 'yaml'
import { serializeTemplateYaml } from '../serialize-template-yaml.js'
import type { Fixture } from '../types.js'

const baseEntity = {
  area: null,
  device: null,
  nameByUser: null,
  entityCategory: null,
  hidden: false,
  disabled: false,
  deviceClass: null,
} as const

const FIXTURE: Fixture = {
  meta: { name: 'tiny', description: 'tiny' },
  floors: [],
  areas: [],
  devices: [],
  entities: [
    {
      ...baseEntity,
      domain: 'sensor',
      objectId: 'living_room_temperature',
      uniqueId: 'tiny__sensor.living_room_temperature',
      originalName: 'Living Room Temperature',
      deviceClass: 'temperature',
      templateState: '21.5',
    },
    {
      ...baseEntity,
      domain: 'binary_sensor',
      objectId: 'hallway_motion',
      uniqueId: 'tiny__binary_sensor.hallway_motion',
      originalName: 'Hallway Motion',
      deviceClass: 'motion',
      templateState: 'off',
    },
    {
      ...baseEntity,
      domain: 'switch',
      objectId: 'coffee_machine',
      uniqueId: 'tiny__switch.coffee_machine',
      originalName: 'Coffee Machine',
      templateState: 'off',
    },
    {
      ...baseEntity,
      domain: 'light',
      objectId: 'ceiling_light',
      uniqueId: 'tiny__light.ceiling_light',
      originalName: 'Ceiling Light',
      templateState: null,
    },
    {
      ...baseEntity,
      domain: 'sensor',
      objectId: 'disabled_one',
      uniqueId: 'tiny__sensor.disabled_one',
      originalName: 'Disabled One',
      templateState: '12',
      disabled: true,
    },
  ],
}

describe('serializeTemplateYaml', () => {
  it('produces a YAML document with a top-level template: sequence', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    const parsed = parse(yaml) as { template: unknown }
    expect(Array.isArray(parsed.template)).toBe(true)
  })

  it('groups entities under sensor / binary_sensor / switch keys', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    const parsed = parse(yaml) as { template: { sensor?: unknown; binary_sensor?: unknown; switch?: unknown }[] }
    const groups = parsed.template
    const keysFound = new Set<string>()
    for (const g of groups) for (const k of Object.keys(g)) keysFound.add(k)
    expect(keysFound).toEqual(new Set(['sensor', 'binary_sensor', 'switch']))
  })

  it('omits domains that template integration cannot represent (light, climate, …)', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    expect(yaml).not.toContain('ceiling_light')
  })

  it('omits disabled entities', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    expect(yaml).not.toContain('disabled_one')
  })

  it('emits unique_id, name, and state per entity', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    const parsed = parse(yaml) as { template: { sensor?: { unique_id: string; name: string; state: string }[] }[] }
    const sensorGroup = parsed.template.find((g) => g.sensor)
    expect(sensorGroup?.sensor).toContainEqual(
      expect.objectContaining({
        unique_id: 'tiny__sensor.living_room_temperature',
        name: 'Living Room Temperature',
        state: '21.5',
      }),
    )
  })

  it('includes device_class for sensor and binary_sensor entries when set', () => {
    const yaml = serializeTemplateYaml(FIXTURE)
    const parsed = parse(yaml) as { template: { sensor?: { device_class?: string }[]; binary_sensor?: { device_class?: string }[] }[] }
    const sensorGroup = parsed.template.find((g) => g.sensor)
    expect(sensorGroup?.sensor?.[0]?.device_class).toBe('temperature')
    const binaryGroup = parsed.template.find((g) => g.binary_sensor)
    expect(binaryGroup?.binary_sensor?.[0]?.device_class).toBe('motion')
  })

  it('returns an empty template: list when no state-supported entities exist', () => {
    const empty: Fixture = { ...FIXTURE, entities: [FIXTURE.entities[3]!] }
    const yaml = serializeTemplateYaml(empty)
    expect(parse(yaml)).toEqual({ template: [] })
  })
})
