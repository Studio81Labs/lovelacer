import { describe, it, expect } from 'vitest'
import { fixture } from '../fixture.js'
import type { AreaSpec, DeviceSpec, EntitySpec, FloorSpec } from '../types.js'

const meta = { name: 'tiny', description: 'tiny test fixture' }
const floor: FloorSpec = { id: 'ground', name: 'Ground', level: 0, icon: null }
const area: AreaSpec = { id: 'living_room', name: 'Living Room', floor: 'ground', icon: null }
const device: DeviceSpec = {
  id: 'dev1',
  name: 'Sensor',
  nameByUser: null,
  manufacturer: null,
  model: null,
  area: 'living_room',
}
const entity: EntitySpec = {
  domain: 'sensor',
  objectId: 'living_room_temperature',
  uniqueId: 'tiny__sensor.living_room_temperature',
  originalName: 'Living Room Temperature',
  nameByUser: null,
  area: 'living_room',
  device: 'dev1',
  deviceClass: 'temperature',
  entityCategory: null,
  hidden: false,
  disabled: false,
  templateState: '21.5',
}

describe('fixture()', () => {
  it('returns the input unchanged when valid', () => {
    const result = fixture({
      meta,
      floors: [floor],
      areas: [area],
      devices: [device],
      entities: [entity],
    })
    expect(result.entities).toHaveLength(1)
  })

  it('rejects duplicate floor ids', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor, floor],
        areas: [area],
        devices: [device],
        entities: [entity],
      }),
    ).toThrow(/duplicate floor id/i)
  })

  it('rejects duplicate area ids', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [area, area],
        devices: [device],
        entities: [entity],
      }),
    ).toThrow(/duplicate area id/i)
  })

  it('rejects duplicate device ids', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [area],
        devices: [device, device],
        entities: [entity],
      }),
    ).toThrow(/duplicate device id/i)
  })

  it('rejects duplicate entity ids (domain + objectId)', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [area],
        devices: [device],
        entities: [entity, entity],
      }),
    ).toThrow(/duplicate entity id/i)
  })

  it('rejects an entity referencing an unknown area', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [area],
        devices: [device],
        entities: [{ ...entity, area: 'no_such_area' }],
      }),
    ).toThrow(/unknown area/i)
  })

  it('rejects an entity referencing an unknown device', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [area],
        devices: [device],
        entities: [{ ...entity, device: 'no_such_device' }],
      }),
    ).toThrow(/unknown device/i)
  })

  it('rejects an area referencing an unknown floor', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [{ ...area, floor: 'no_such_floor' }],
        devices: [device],
        entities: [entity],
      }),
    ).toThrow(/unknown floor/i)
  })

  it('rejects a device referencing an unknown area', () => {
    expect(() =>
      fixture({
        meta,
        floors: [floor],
        areas: [area],
        devices: [{ ...device, area: 'no_such_area' }],
        entities: [entity],
      }),
    ).toThrow(/unknown area/i)
  })
})
