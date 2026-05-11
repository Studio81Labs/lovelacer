import { ADMIN_KEYWORDS, type AdminKeyword } from './admin-keywords.js'
import { normalizeForMatching } from './normalize-text.js'

export interface AdminKeywordMatch {
  language: AdminKeyword['language']
  pattern: string
  matchedAt: number
}

export interface FindAdminKeywordOptions {
  keywords?: readonly AdminKeyword[]
}

interface Hit extends AdminKeywordMatch {
  ruleIndex: number
}

/**
 * Match localized admin/maintenance words in entity ids or friendly names.
 * All keyword languages are active by default because Home Assistant
 * installs commonly mix English integration names and localized labels.
 */
export function findAdminKeyword(
  text: string,
  opts: FindAdminKeywordOptions = {},
): AdminKeywordMatch | null {
  return findAdminKeywords(text, opts)[0] ?? null
}

export function findAdminKeywords(
  text: string,
  opts: FindAdminKeywordOptions = {},
): AdminKeywordMatch[] {
  const normalized = normalizeForMatching(text)
  if (normalized.length === 0) return []

  const keywords = opts.keywords ?? ADMIN_KEYWORDS
  const hits: Hit[] = []

  for (let i = 0; i < keywords.length; i++) {
    const rule = keywords[i]!
    for (const pattern of rule.patterns) {
      const matchedAt = normalized.indexOf(pattern)
      if (matchedAt === -1) continue
      hits.push({ language: rule.language, pattern, matchedAt, ruleIndex: i })
    }
  }

  if (hits.length === 0) return []

  hits.sort((a, b) => {
    if (a.matchedAt !== b.matchedAt) return a.matchedAt - b.matchedAt
    if (a.pattern.length !== b.pattern.length) return b.pattern.length - a.pattern.length
    return a.ruleIndex - b.ruleIndex
  })

  return hits.map((hit) => ({
    language: hit.language,
    pattern: hit.pattern,
    matchedAt: hit.matchedAt,
  }))
}
