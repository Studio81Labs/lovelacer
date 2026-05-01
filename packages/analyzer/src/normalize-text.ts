/**
 * Normalize a candidate string for substring matching against the room
 * keyword database.
 *
 * Pipeline (in order):
 *   1. Lowercase
 *   2. Map German base letters that don't decompose via NFKD:
 *        ß → ss   (eszett — no NFKD decomposition; would otherwise survive
 *                  unchanged and never match ASCII-stored patterns like
 *                  'aussen' for 'Außen')
 *   3. Unicode NFKD decomposition
 *   4. Strip combining marks (`\p{M}`) — diacritics, accents, etc.
 *   5. Collapse runs of `[\s_\-/]` to a single space
 *   6. Trim
 *
 * Output is suitable for `String.prototype.indexOf` against patterns
 * stored pre-normalized in `ROOM_KEYWORDS` (lowercase ASCII, single-space).
 */
export function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s_\-/]+/g, ' ')
    .trim()
}
