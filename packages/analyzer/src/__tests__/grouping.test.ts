import { describe, it, expect } from 'vitest'
import type { NormalizedEntity, RoomAssignment } from '@lovelacer/shared'
import { domainGroup, groupByDomain } from '../grouping.js'

const baseEntity: NormalizedEntity = {
  entityId: 'sensor.test',
  domain: 'sensor',
  objectId: 'test',
  friendlyName: 'Test',
  deviceClass: null,
  entityCategory: null,
  haAreaId: null,
  device: null,
  isHidden: false,
  isDisabled: false,
}

describe('domainGroup — routing', () => {
  it('routes light → lights', () => {
    expect(domainGroup({ ...baseEntity, domain: 'light' })).toBe('lights')
  })

  it('routes switch → lights', () => {
    expect(domainGroup({ ...baseEntity, domain: 'switch' })).toBe('lights')
  })

  it('routes climate → climate', () => {
    expect(domainGroup({ ...baseEntity, domain: 'climate' })).toBe('climate')
  })

  it('routes sensor with deviceClass=temperature → environment', () => {
    expect(domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: 'temperature' })).toBe(
      'environment',
    )
  })

  it('routes sensor with deviceClass=humidity → environment', () => {
    expect(domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: 'humidity' })).toBe(
      'environment',
    )
  })

  it('routes sensor with deviceClass=illuminance → other (not in P1a env filter)', () => {
    expect(domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: 'illuminance' })).toBe(
      'other',
    )
  })

  it('routes sensor with no deviceClass → other', () => {
    expect(domainGroup({ ...baseEntity, domain: 'sensor', deviceClass: null })).toBe('other')
  })

  it('routes binary_sensor with deviceClass=motion → activity', () => {
    expect(domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'motion' })).toBe(
      'activity',
    )
  })

  it('routes binary_sensor with deviceClass=occupancy → activity', () => {
    expect(domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'occupancy' })).toBe(
      'activity',
    )
  })

  it('routes binary_sensor with deviceClass=door → activity', () => {
    expect(domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'door' })).toBe(
      'activity',
    )
  })

  it('routes binary_sensor with deviceClass=window → other (not in P1a activity filter)', () => {
    expect(domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: 'window' })).toBe(
      'other',
    )
  })

  it('routes binary_sensor with no deviceClass → other', () => {
    expect(domainGroup({ ...baseEntity, domain: 'binary_sensor', deviceClass: null })).toBe('other')
  })

  it('routes cover → covers', () => {
    expect(domainGroup({ ...baseEntity, domain: 'cover' })).toBe('covers')
  })

  it('routes media_player → media', () => {
    expect(domainGroup({ ...baseEntity, domain: 'media_player' })).toBe('media')
  })

  it('routes lock → security', () => {
    expect(domainGroup({ ...baseEntity, domain: 'lock' })).toBe('security')
  })

  it('routes camera → cameras', () => {
    expect(domainGroup({ ...baseEntity, domain: 'camera' })).toBe('cameras')
  })

  it('routes vacuum → vacuum', () => {
    expect(domainGroup({ ...baseEntity, domain: 'vacuum' })).toBe('vacuum')
  })

  it('routes fan → fans', () => {
    expect(domainGroup({ ...baseEntity, domain: 'fan' })).toBe('fans')
  })

  it('routes unknown domain → other (e.g., lawn_mower)', () => {
    expect(domainGroup({ ...baseEntity, domain: 'lawn_mower' })).toBe('other')
  })

  it('routes diagnostic light → lights (entityCategory filtering is separate)', () => {
    expect(domainGroup({ ...baseEntity, domain: 'light', entityCategory: 'diagnostic' })).toBe(
      'lights',
    )
  })
})

const ent = (id: string, overrides: Partial<NormalizedEntity> = {}): NormalizedEntity => ({
  ...baseEntity,
  entityId: id,
  domain: id.split('.')[0]!,
  objectId: id.split('.')[1]!,
  ...overrides,
})

const assignment = (entityId: string, roomId: string): RoomAssignment => ({
  entityId,
  roomId: roomId as RoomAssignment['roomId'],
  confidence: 1.0,
  signals: [],
})

describe('groupByDomain — orchestration', () => {
  it('returns empty array for empty input', () => {
    expect(groupByDomain({ assignments: [], entities: [] })).toEqual([])
  })

  it('produces one room with one group containing the single entity', () => {
    const e = ent('light.kitchen_ceiling', { friendlyName: 'Kitchen Ceiling' })
    const result = groupByDomain({
      assignments: [assignment('light.kitchen_ceiling', 'kitchen')],
      entities: [e],
    })
    expect(result).toEqual([
      {
        roomId: 'kitchen',
        groups: [{ key: 'lights', entities: [e] }],
      },
    ])
  })

  it('drops hidden entities', () => {
    const e = ent('light.kitchen_ceiling', { isHidden: true })
    const result = groupByDomain({
      assignments: [assignment('light.kitchen_ceiling', 'kitchen')],
      entities: [e],
    })
    expect(result).toEqual([])
  })

  it('drops disabled entities', () => {
    const e = ent('light.kitchen_ceiling', { isDisabled: true })
    const result = groupByDomain({
      assignments: [assignment('light.kitchen_ceiling', 'kitchen')],
      entities: [e],
    })
    expect(result).toEqual([])
  })

  it('drops diagnostic entities', () => {
    const e = ent('sensor.aqara_battery', {
      friendlyName: 'Aqara Battery',
      deviceClass: 'battery',
      entityCategory: 'diagnostic',
    })
    const result = groupByDomain({
      assignments: [assignment('sensor.aqara_battery', 'kitchen')],
      entities: [e],
    })
    expect(result).toEqual([])
  })

  it('drops empty groups (room with only lights → output has only lights group)', () => {
    const result = groupByDomain({
      assignments: [assignment('light.a', 'kitchen')],
      entities: [ent('light.a', { friendlyName: 'A' })],
    })
    expect(result[0]!.groups.map((g) => g.key)).toEqual(['lights'])
  })

  it('orders rooms lexicographically by roomId', () => {
    const result = groupByDomain({
      assignments: [
        assignment('light.a', 'kitchen'),
        assignment('light.b', 'bedroom'),
        assignment('light.c', 'living_room'),
      ],
      entities: [
        ent('light.a', { friendlyName: 'A' }),
        ent('light.b', { friendlyName: 'B' }),
        ent('light.c', { friendlyName: 'C' }),
      ],
    })
    expect(result.map((r) => r.roomId)).toEqual(['bedroom', 'kitchen', 'living_room'])
  })

  it('orders groups within a room via GROUP_ORDER (lights, climate, covers, activity, environment)', () => {
    const result = groupByDomain({
      assignments: [
        assignment('binary_sensor.m', 'kitchen'),
        assignment('sensor.t', 'kitchen'),
        assignment('climate.c', 'kitchen'),
        assignment('light.l', 'kitchen'),
        assignment('cover.x', 'kitchen'),
      ],
      entities: [
        ent('binary_sensor.m', { friendlyName: 'M', deviceClass: 'motion' }),
        ent('sensor.t', { friendlyName: 'T', deviceClass: 'temperature' }),
        ent('climate.c', { friendlyName: 'C' }),
        ent('light.l', { friendlyName: 'L' }),
        ent('cover.x', { friendlyName: 'X' }),
      ],
    })
    expect(result[0]!.groups.map((g) => g.key)).toEqual([
      'lights',
      'climate',
      'covers',
      'activity',
      'environment',
    ])
  })

  it('places `other` last when populated', () => {
    const result = groupByDomain({
      assignments: [assignment('lawn_mower.x', 'kitchen'), assignment('light.l', 'kitchen')],
      entities: [ent('lawn_mower.x', { friendlyName: 'X' }), ent('light.l', { friendlyName: 'L' })],
    })
    expect(result[0]!.groups.map((g) => g.key)).toEqual(['lights', 'other'])
  })

  it('sorts entities within a group alphabetically by friendlyName, case-insensitive', () => {
    const result = groupByDomain({
      assignments: [
        assignment('light.banana', 'kitchen'),
        assignment('light.apple', 'kitchen'),
        assignment('light.cherry', 'kitchen'),
      ],
      entities: [
        ent('light.banana', { friendlyName: 'Banana' }),
        ent('light.apple', { friendlyName: 'apple' }),
        ent('light.cherry', { friendlyName: 'cherry' }),
      ],
    })
    expect(result[0]!.groups[0]!.entities.map((e) => e.friendlyName)).toEqual([
      'apple',
      'Banana',
      'cherry',
    ])
  })

  it('silently skips assignments referencing entities not in the input', () => {
    const result = groupByDomain({
      assignments: [assignment('light.real', 'kitchen'), assignment('light.ghost', 'kitchen')],
      entities: [ent('light.real', { friendlyName: 'Real' })],
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.groups[0]!.entities).toHaveLength(1)
    expect(result[0]!.groups[0]!.entities[0]!.entityId).toBe('light.real')
  })

  it('handles empty entities with non-empty assignments → empty output', () => {
    const result = groupByDomain({
      assignments: [assignment('light.a', 'kitchen')],
      entities: [],
    })
    expect(result).toEqual([])
  })

  it('drops diagnostic and config entities from dashboard groupings by default', () => {
    const entities = [
      ent('sensor.shelly_rssi', {
        entityId: 'sensor.shelly_rssi',
        friendlyName: 'Shelly RSSI',
        entityCategory: 'diagnostic',
      }),
      ent('button.shelly_restart', {
        entityId: 'button.shelly_restart',
        domain: 'button',
        friendlyName: 'Shelly Restart',
        entityCategory: 'config',
      }),
      ent('light.kitchen_ceiling', {
        entityId: 'light.kitchen_ceiling',
        domain: 'light',
        friendlyName: 'Kitchen Ceiling',
      }),
    ]
    const result = groupByDomain({
      entities,
      assignments: entities.map((entity) => ({
        entityId: entity.entityId,
        roomId: 'kitchen',
        confidence: 1,
        signals: [],
      })),
    })

    expect(
      result[0]?.groups.flatMap((group) => group.entities.map((entity) => entity.entityId)),
    ).toEqual(['light.kitchen_ceiling'])
  })

  it('soft-hides unclassified administrative entities from dashboard groupings by default', () => {
    const entities = [
      ent('sensor.kitchen_temperature', {
        friendlyName: 'Kitchen Temperature',
        deviceClass: 'temperature',
      }),
      ent('sensor.kitchen_voltage', {
        friendlyName: 'Kitchen Voltage',
        deviceClass: 'voltage',
      }),
      ent('sensor.kitchen_current', {
        friendlyName: 'Kitchen Current',
        deviceClass: 'current',
      }),
      ent('sensor.kitchen_rssi', {
        friendlyName: 'Kitchen RSSI',
        deviceClass: null,
      }),
      ent('select.kitchen_temperature_unit', {
        friendlyName: 'Kitchen Temperature Unit',
        domain: 'select',
      }),
      ent('number.kitchen_calibration', {
        friendlyName: 'Kitchen Calibration',
        domain: 'number',
      }),
    ]

    const result = groupByDomain({
      entities,
      assignments: entities.map((entity) => assignment(entity.entityId, 'kitchen')),
    })

    expect(
      result[0]?.groups.flatMap((group) => group.entities.map((entity) => entity.entityId)),
    ).toEqual(['sensor.kitchen_temperature'])
  })

  it('soft-hides radar tuning and electrical telemetry entities by name', () => {
    const entities = [
      ent('binary_sensor.bathroom_occupancy', {
        friendlyName: 'Bathroom Occupancy',
        domain: 'binary_sensor',
        deviceClass: 'occupancy',
      }),
      ent('sensor.bathroom_heater_floor_temperature_voltmeter', {
        friendlyName: 'Bathroom Heater Floor Temperature Voltmeter',
      }),
      ent('number.bathroom_occupancy_sensor_radar_sensitivity', {
        friendlyName: 'Bathroom Occupancy Sensor Radar Sensitivity',
        domain: 'number',
      }),
      ent('number.bathroom_occupancy_sensor_minimum_range', {
        friendlyName: 'Bathroom Occupancy Sensor Minimum Range',
        domain: 'number',
      }),
      ent('number.bathroom_occupancy_sensor_maximum_range', {
        friendlyName: 'Bathroom Occupancy Sensor Maximum Range',
        domain: 'number',
      }),
      ent('number.bathroom_occupancy_sensor_detection_delay', {
        friendlyName: 'Bathroom Occupancy Sensor Detection Delay',
        domain: 'number',
      }),
      ent('sensor.bathroom_occupancy_sensor_self_test', {
        friendlyName: 'Bathroom Occupancy Sensor Self Test',
      }),
      ent('number.bathroom_occupancy_sensor_fading_time', {
        friendlyName: 'Bathroom Occupancy Sensor Fading Time',
        domain: 'number',
      }),
      ent('sensor.bathroom_main_light_power', {
        friendlyName: 'Bathroom Main Light Power',
      }),
      ent('sensor.bathroom_main_light_current', {
        friendlyName: 'Bathroom Main Light Current',
      }),
      ent('sensor.bathroom_main_light_energy', {
        friendlyName: 'Bathroom Main Light Energy',
      }),
      ent('sensor.bathroom_mirror_light_frequency', {
        friendlyName: 'Bathroom Mirror Light Frequency',
      }),
    ]

    const result = groupByDomain({
      entities,
      assignments: entities.map((entity) => assignment(entity.entityId, 'bathroom')),
    })

    expect(
      result[0]?.groups.flatMap((group) => group.entities.map((entity) => entity.entityId)),
    ).toEqual(['binary_sensor.bathroom_occupancy'])
  })

  it('keeps user-facing current-state sensors visible when they are not electrical current', () => {
    const currentTemperature = ent('sensor.weather_current_temperature', {
      friendlyName: 'Weather Current Temperature',
      deviceClass: 'temperature',
    })
    const currentHumidity = ent('sensor.weather_current_humidity', {
      friendlyName: 'Weather Current Humidity',
      deviceClass: 'humidity',
    })

    const result = groupByDomain({
      entities: [currentTemperature, currentHumidity],
      assignments: [
        assignment(currentTemperature.entityId, 'kitchen'),
        assignment(currentHumidity.entityId, 'kitchen'),
      ],
    })

    expect(
      result[0]?.groups.flatMap((group) => group.entities.map((entity) => entity.entityId)),
    ).toEqual(['sensor.weather_current_humidity', 'sensor.weather_current_temperature'])
  })

  it('keeps controllable switches visible when their names contain electrical words', () => {
    const entities = [
      ent('switch.living_room_power_strip', {
        friendlyName: 'Living Room Power Strip',
        domain: 'switch',
      }),
      ent('sensor.living_room_power_strip_power', {
        friendlyName: 'Living Room Power Strip Power',
        domain: 'sensor',
      }),
    ]

    const result = groupByDomain({
      entities,
      assignments: entities.map((entity) => assignment(entity.entityId, 'living_room')),
    })

    expect(
      result[0]?.groups.flatMap((group) => group.entities.map((entity) => entity.entityId)),
    ).toEqual(['switch.living_room_power_strip'])
  })

  it('continues past sensor-only keyword matches to later administrative keywords', () => {
    const entities = [
      ent('number.bathroom_power_calibration', {
        friendlyName: 'Bathroom Power Calibration',
        domain: 'number',
      }),
      ent('button.plug_power_restart', {
        friendlyName: 'Plug Power Restart',
        domain: 'button',
      }),
      ent('select.device_voltage_temperature_unit', {
        friendlyName: 'Device Voltage Temperature Unit',
        domain: 'select',
      }),
      ent('switch.living_room_power_strip', {
        friendlyName: 'Living Room Power Strip',
        domain: 'switch',
      }),
    ]

    const result = groupByDomain({
      entities,
      assignments: entities.map((entity) => assignment(entity.entityId, 'living_room')),
    })

    expect(
      result[0]?.groups.flatMap((group) => group.entities.map((entity) => entity.entityId)),
    ).toEqual(['switch.living_room_power_strip'])
  })

  it('keeps user-facing duration sensors visible while hiding uptime duration sensors', () => {
    const entities = [
      ent('sensor.washer_remaining_time', {
        friendlyName: 'Washer Remaining Time',
        deviceClass: 'duration',
      }),
      ent('sensor.timer_duration', {
        friendlyName: 'Timer Duration',
        deviceClass: 'duration',
      }),
      ent('sensor.router_uptime', {
        friendlyName: 'Router Uptime',
        deviceClass: 'duration',
      }),
    ]

    const result = groupByDomain({
      entities,
      assignments: entities.map((entity) => assignment(entity.entityId, 'utility')),
    })

    expect(
      result[0]?.groups.flatMap((group) => group.entities.map((entity) => entity.entityId)),
    ).toEqual(['sensor.timer_duration', 'sensor.washer_remaining_time'])
  })

  it('keeps user-facing timestamp sensors visible while hiding maintenance timestamp sensors', () => {
    const entities = [
      ent('sensor.bedroom_next_alarm', {
        friendlyName: 'Bedroom Next Alarm',
        deviceClass: 'timestamp',
      }),
      ent('sensor.washer_cycle_complete', {
        friendlyName: 'Washer Cycle Complete',
        deviceClass: 'timestamp',
      }),
      ent('sensor.router_firmware_timestamp', {
        friendlyName: 'Router Firmware Timestamp',
        deviceClass: 'timestamp',
      }),
    ]

    const result = groupByDomain({
      entities,
      assignments: entities.map((entity) => assignment(entity.entityId, 'bedroom')),
    })

    expect(
      result[0]?.groups.flatMap((group) => group.entities.map((entity) => entity.entityId)),
    ).toEqual(['sensor.bedroom_next_alarm', 'sensor.washer_cycle_complete'])
  })

  it('soft-hides administrative entities with localized labels across languages', () => {
    const entities = [
      ent('binary_sensor.bathroom_occupancy', {
        friendlyName: 'Koupelna obsazenost',
        domain: 'binary_sensor',
        deviceClass: 'occupancy',
      }),
      ent('number.bathroom_radar_sensitivity', {
        friendlyName: 'Koupelna citlivost',
        domain: 'number',
      }),
      ent('number.bathroom_detection_delay', {
        friendlyName: 'Kúpeľňa oneskorenie detekcie',
        domain: 'number',
      }),
      ent('sensor.bathroom_self_test', {
        friendlyName: 'Bad Selbsttest',
      }),
    ]

    const result = groupByDomain({
      entities,
      assignments: entities.map((entity) => assignment(entity.entityId, 'bathroom')),
    })

    expect(
      result[0]?.groups.flatMap((group) => group.entities.map((entity) => entity.entityId)),
    ).toEqual(['binary_sensor.bathroom_occupancy'])
  })

  it('includes a soft-hidden administrative entity when the user manually assigns it', () => {
    const voltage = ent('sensor.kitchen_voltage', {
      friendlyName: 'Kitchen Voltage',
      deviceClass: 'voltage',
    })

    const result = groupByDomain({
      entities: [voltage],
      assignments: [{ ...assignment(voltage.entityId, 'kitchen'), manual: true }],
    })

    expect(result[0]?.groups[0]?.entities.map((entity) => entity.entityId)).toEqual([
      'sensor.kitchen_voltage',
    ])
  })
})
