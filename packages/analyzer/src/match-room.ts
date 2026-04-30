import type { CanonicalRoomId, LanguageCode, RoomKeyword } from '@lovelacer/shared'
import { ROOM_KEYWORDS } from '@lovelacer/shared'
import { normalizeForMatching } from './normalize-text.js'

export interface RoomMatch {
  canonical: Exclude<CanonicalRoomId, 'misc'>
  language: LanguageCode
  pattern: string
  matchedAt: number
}

export interface FindRoomOptions {
  language?: LanguageCode
  keywords?: readonly RoomKeyword[]
}

interface Hit extends RoomMatch {
  ruleIndex: number
}

/**
 * Find the most-likely canonical room for a candidate string.
 *
 * Returns the winning match by (1) earliest position in the normalized
 * text, (2) longer pattern as tiebreaker, (3) document order in the
 * keywords array as final tiebreaker. Returns `null` if no rule matches.
 *
 * Rules whose `excludes` substrings appear anywhere in the normalized
 * text are skipped wholesale.
 */
export function findRoom(text: string, opts: FindRoomOptions = {}): RoomMatch | null {
  const normalized = normalizeForMatching(text)
  if (normalized.length === 0) return null

  const keywords = opts.keywords ?? ROOM_KEYWORDS
  const filtered =
    opts.language !== undefined ? keywords.filter((r) => r.language === opts.language) : keywords

  const hits: Hit[] = []
  for (let i = 0; i < filtered.length; i++) {
    const rule = filtered[i]!
    if (rule.excludes && rule.excludes.some((ex) => normalized.includes(ex))) continue

    for (const pattern of rule.patterns) {
      const matchedAt = normalized.indexOf(pattern)
      if (matchedAt === -1) continue
      hits.push({
        canonical: rule.canonical,
        language: rule.language,
        pattern,
        matchedAt,
        ruleIndex: i,
      })
    }
  }

  if (hits.length === 0) return null

  hits.sort((a, b) => {
    if (a.matchedAt !== b.matchedAt) return a.matchedAt - b.matchedAt
    if (a.pattern.length !== b.pattern.length) return b.pattern.length - a.pattern.length
    return a.ruleIndex - b.ruleIndex
  })

  const winner = hits[0]!
  return {
    canonical: winner.canonical,
    language: winner.language,
    pattern: winner.pattern,
    matchedAt: winner.matchedAt,
  }
}
