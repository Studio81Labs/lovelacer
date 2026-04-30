import { describe, it, expect } from 'vitest'
import { slug, uniqueIdFor } from '../ids.js'

describe('slug', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(slug('Living Room')).toBe('living_room')
  })

  it('strips punctuation and collapses multiple separators', () => {
    expect(slug("Bart's  Office!")).toBe('barts_office')
  })

  it('preserves digits and underscores', () => {
    expect(slug('Sensor 4_b')).toBe('sensor_4_b')
  })

  it('strips leading/trailing separators', () => {
    expect(slug('  --hello--  ')).toBe('hello')
  })

  it('throws on input that slugs to empty string', () => {
    expect(() => slug('!!!')).toThrow(/cannot slug/i)
  })

  it('strips Unicode apostrophes (U+2018, U+2019)', () => {
    expect(slug('Bart’s Office')).toBe('barts_office')
    expect(slug('‘Hello’')).toBe('hello')
  })
})

describe('uniqueIdFor', () => {
  it('combines fixture name and entity id', () => {
    expect(uniqueIdFor('english-cluttered', 'sensor.living_room_temperature')).toBe(
      'english-cluttered__sensor.living_room_temperature',
    )
  })
})
