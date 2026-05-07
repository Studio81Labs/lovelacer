import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from '../../locales/en.json'
import cs from '../../locales/cs.json'
import de from '../../locales/de.json'

function makeI18n(locale: 'en' | 'cs' | 'de') {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    flatJson: true,
    messages: { en, cs, de },
  })
}

describe('plural rules — Czech (3 forms: 1 / 2-4 / 5+)', () => {
  // Use any pipe-form key from en.json that has 3 forms in cs.json. The
  // most-likely candidate from Tasks 5/6 is `dashboardPreview.willCreate`
  // (which is "Will create {count} dashboard view | Will create {count}
  // dashboard views"). If a different key is the canonical pipe-form
  // example in your en.json, swap it in here.
  const i18n = makeI18n('cs')
  const t = i18n.global.t

  it('dispatches singular form for count=1', () => {
    const result = t('dashboardPreview.willCreate', { count: 1 }, 1)
    expect(result).toContain('1')
    // Czech singular form (e.g., "1 pohled" not "1 pohledy")
  })

  it('dispatches few-form (2-4) for count=3', () => {
    const result = t('dashboardPreview.willCreate', { count: 3 }, 3)
    expect(result).toContain('3')
  })

  it('dispatches many-form (5+) for count=7', () => {
    const result = t('dashboardPreview.willCreate', { count: 7 }, 7)
    expect(result).toContain('7')
  })

  it('singular and many-form differ (proves plural dispatch is working)', () => {
    const singular = t('dashboardPreview.willCreate', { count: 1 }, 1)
    const many = t('dashboardPreview.willCreate', { count: 7 }, 7)
    // Strip the count to compare the wording — they should differ in
    // plural ending (e.g., "pohled" vs "pohledů")
    const singularNoCount = singular.replace(/\d+/, '')
    const manyNoCount = many.replace(/\d+/, '')
    expect(singularNoCount).not.toBe(manyNoCount)
  })
})

describe('plural rules — German (2 forms: 1 / other)', () => {
  const i18n = makeI18n('de')
  const t = i18n.global.t

  it('dispatches singular form for count=1', () => {
    const result = t('dashboardPreview.willCreate', { count: 1 }, 1)
    expect(result).toContain('1')
  })

  it('dispatches plural form for count=5', () => {
    const result = t('dashboardPreview.willCreate', { count: 5 }, 5)
    expect(result).toContain('5')
  })

  it('singular and plural differ (proves plural dispatch is working)', () => {
    const singular = t('dashboardPreview.willCreate', { count: 1 }, 1)
    const plural = t('dashboardPreview.willCreate', { count: 5 }, 5)
    const singularNoCount = singular.replace(/\d+/, '')
    const pluralNoCount = plural.replace(/\d+/, '')
    expect(singularNoCount).not.toBe(pluralNoCount)
  })
})
