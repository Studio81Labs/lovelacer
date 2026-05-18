import { describe, expect, it } from 'vitest'
import en from '../../locales/en.json'
import cs from '../../locales/cs.json'
import de from '../../locales/de.json'
import es from '../../locales/es.json'
import fr from '../../locales/fr.json'
import itLocale from '../../locales/it.json'
import nl from '../../locales/nl.json'
import pl from '../../locales/pl.json'

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...flatten(v as Record<string, unknown>, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

describe('locale completeness', () => {
  const enKeys = new Set(flatten(en as Record<string, unknown>))
  const locales = { cs, de, es, fr, it: itLocale, nl, pl } as const

  for (const [locale, messages] of Object.entries(locales)) {
    it(`${locale}.json contains every key from en.json`, () => {
      const localeKeys = new Set(flatten(messages as Record<string, unknown>))
      const missing = Array.from(enKeys).filter((k) => !localeKeys.has(k))
      expect(missing, `missing ${missing.length} key(s) in ${locale}.json`).toEqual([])
    })

    it(`${locale}.json does not contain stray keys not in en.json`, () => {
      const localeKeys = Array.from(flatten(messages as Record<string, unknown>))
      const extra = localeKeys.filter((k) => !enKeys.has(k))
      expect(extra, `${extra.length} stray key(s) in ${locale}.json`).toEqual([])
    })
  }
})
