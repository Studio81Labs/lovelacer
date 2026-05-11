import { describe, expect, it } from 'vitest'
import { findAdminKeyword, findAdminKeywords } from '../admin-match.js'

describe('findAdminKeyword', () => {
  it('matches English integration-style names', () => {
    expect(findAdminKeyword('Bathroom Occupancy Sensor Radar Sensitivity')).toMatchObject({
      language: 'en',
      pattern: 'radar sensitivity',
    })
  })

  it('matches Czech labels with diacritics', () => {
    expect(findAdminKeyword('Koupelna senzor citlivost')).toMatchObject({
      language: 'cs',
      pattern: 'citlivost',
    })
    expect(findAdminKeyword('Koupelna zpoždění detekce')).toMatchObject({
      language: 'cs',
      pattern: 'zpozdeni detekce',
    })
  })

  it('matches Slovak labels with diacritics', () => {
    expect(findAdminKeyword('Kúpeľňa oneskorenie detekcie')).toMatchObject({
      language: 'sk',
      pattern: 'oneskorenie detekcie',
    })
    expect(findAdminKeyword('Snímač vlastný test')).toMatchObject({
      language: 'sk',
      pattern: 'vlastny test',
    })
  })

  it('matches German labels with diacritics and eszett normalization', () => {
    expect(findAdminKeyword('Bad Erkennungsverzögerung')).toMatchObject({
      language: 'de',
      pattern: 'erkennungsverzogerung',
    })
    expect(findAdminKeyword('Bad Maßeinheit')).toMatchObject({
      language: 'de',
      pattern: 'masseinheit',
    })
  })

  it('returns null for ordinary room-facing labels', () => {
    expect(findAdminKeyword('Bathroom Occupancy')).toBeNull()
    expect(findAdminKeyword('Kitchen Temperature')).toBeNull()
  })

  it('returns all matches in priority order', () => {
    expect(findAdminKeywords('Bathroom Power Calibration').map((match) => match.pattern)).toEqual([
      'power',
      'calibration',
    ])
  })
})
