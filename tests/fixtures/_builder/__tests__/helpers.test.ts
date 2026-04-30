import { describe, it, expect } from 'vitest'
import {
  area,
  device,
  floor,
  light,
  motion,
  switch_,
  tempSensor,
  registryEntry,
} from '../helpers.js'

const FIXTURE_NAME = 'helpers-test'

describe('floor()', () => {
  it('slugs the name into the id', () => {
    expect(floor('Ground')).toEqual({ id: 'ground', name: 'Ground', level: null, icon: null })
  })
  it('accepts level and icon overrides', () => {
    expect(floor('Upstairs', { level: 1, icon: 'mdi:stairs-up' })).toEqual({
      id: 'upstairs',
      name: 'Upstairs',
      level: 1,
      icon: 'mdi:stairs-up',
    })
  })
})

describe('area()', () => {
  it('produces an AreaSpec with slugged id', () => {
    expect(area('Living Room')).toEqual({
      id: 'living_room',
      name: 'Living Room',
      floor: null,
      icon: null,
    })
  })
  it('accepts a floor reference', () => {
    expect(area('Bedroom', { floor: 'upstairs' }).floor).toBe('upstairs')
  })
})

describe('device()', () => {
  it('produces a DeviceSpec with slugged id', () => {
    expect(device('Aqara TH 158d')).toEqual({
      id: 'aqara_th_158d',
      name: 'Aqara TH 158d',
      nameByUser: null,
      manufacturer: null,
      model: null,
      area: null,
    })
  })
})

describe('light()', () => {
  it('emits a light entity with sensible defaults', () => {
    const e = light(FIXTURE_NAME, 'Ceiling Light', { area: 'living_room' })
    expect(e.domain).toBe('light')
    expect(e.objectId).toBe('ceiling_light')
    expect(e.uniqueId).toBe('helpers-test__light.ceiling_light')
    expect(e.originalName).toBe('Ceiling Light')
    expect(e.area).toBe('living_room')
    expect(e.templateState).toBeNull()
    expect(e.hidden).toBe(false)
    expect(e.disabled).toBe(false)
  })
})

describe('switch_()', () => {
  it('emits a switch entity with template state defaulting to "off"', () => {
    const e = switch_(FIXTURE_NAME, 'Coffee Machine')
    expect(e.domain).toBe('switch')
    expect(e.templateState).toBe('off')
  })
})

describe('tempSensor()', () => {
  it('emits a sensor with device_class=temperature and a numeric template state', () => {
    const e = tempSensor(FIXTURE_NAME, 'Living Room Temperature')
    expect(e.domain).toBe('sensor')
    expect(e.deviceClass).toBe('temperature')
    expect(e.templateState).toBe('21.5')
  })
})

describe('motion()', () => {
  it('emits a binary_sensor with device_class=motion', () => {
    const e = motion(FIXTURE_NAME, 'Hallway Motion')
    expect(e.domain).toBe('binary_sensor')
    expect(e.deviceClass).toBe('motion')
    expect(e.templateState).toBe('off')
  })
})

describe('registryEntry()', () => {
  it('emits a registry-only entity with no template state', () => {
    const e = registryEntry(FIXTURE_NAME, 'cover', 'Garage Door', { area: 'garage' })
    expect(e.domain).toBe('cover')
    expect(e.templateState).toBeNull()
  })
})

describe('helper option overrides', () => {
  it('applies hidden, disabled, nameByUser, entityCategory', () => {
    const e = light(FIXTURE_NAME, 'Closet Light', {
      hidden: true,
      disabled: true,
      nameByUser: 'Wardrobe',
      entityCategory: 'diagnostic',
    })
    expect(e.hidden).toBe(true)
    expect(e.disabled).toBe(true)
    expect(e.nameByUser).toBe('Wardrobe')
    expect(e.entityCategory).toBe('diagnostic')
  })
})
