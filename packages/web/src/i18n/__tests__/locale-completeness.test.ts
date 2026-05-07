import { describe, expect, it } from 'vitest'
import en from '../../locales/en.json'
import cs from '../../locales/cs.json'
import de from '../../locales/de.json'

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

  it('cs.json contains every key from en.json', () => {
    const csKeys = new Set(flatten(cs as Record<string, unknown>))
    const missing = Array.from(enKeys).filter((k) => !csKeys.has(k))
    expect(missing, `missing ${missing.length} key(s) in cs.json`).toEqual([])
  })

  it('de.json contains every key from en.json', () => {
    const deKeys = new Set(flatten(de as Record<string, unknown>))
    const missing = Array.from(enKeys).filter((k) => !deKeys.has(k))
    expect(missing, `missing ${missing.length} key(s) in de.json`).toEqual([])
  })

  it('cs.json does not contain stray keys not in en.json', () => {
    const csKeys = Array.from(flatten(cs as Record<string, unknown>))
    const extra = csKeys.filter((k) => !enKeys.has(k))
    expect(extra, `${extra.length} stray key(s) in cs.json`).toEqual([])
  })

  it('de.json does not contain stray keys not in en.json', () => {
    const deKeys = Array.from(flatten(de as Record<string, unknown>))
    const extra = deKeys.filter((k) => !enKeys.has(k))
    expect(extra, `${extra.length} stray key(s) in de.json`).toEqual([])
  })
})
