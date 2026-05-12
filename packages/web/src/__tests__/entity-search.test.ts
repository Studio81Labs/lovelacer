import { afterEach, describe, expect, it, vi } from 'vitest'
import { entityMatchesSearch, normalizeEntitySearch } from '../entity-search.js'

const originalToLocaleLowerCase = String.prototype.toLocaleLowerCase

afterEach(() => {
  vi.restoreAllMocks()
})

describe('entity search', () => {
  it('normalizes search text without depending on runtime locale casing', () => {
    vi.spyOn(String.prototype, 'toLocaleLowerCase').mockImplementation(function () {
      return originalToLocaleLowerCase.call(this, 'tr')
    })

    expect(normalizeEntitySearch(' INDOOR ')).toBe('indoor')
  })

  it('matches entity ids and friendly names without depending on runtime locale casing', () => {
    vi.spyOn(String.prototype, 'toLocaleLowerCase').mockImplementation(function () {
      return originalToLocaleLowerCase.call(this, 'tr')
    })

    expect(entityMatchesSearch('LIGHT', 'light.kitchen_ceiling', 'Kitchen Ceiling')).toBe(true)
    expect(entityMatchesSearch('INDOOR', 'sensor.temperature', 'Indoor Sensor')).toBe(true)
  })
})
