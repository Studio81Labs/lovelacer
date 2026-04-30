/**
 * Normalize a candidate string for substring matching against the room
 * keyword database.
 *
 * Pipeline (in order):
 *   1. Lowercase
 *   2. Unicode NFKD decomposition
 *   3. Strip combining marks (`\p{M}`) — diacritics, accents, etc.
 *   4. Collapse runs of `[\s_\-/]` to a single space
 *   5. Trim
 *
 * Output is suitable for `String.prototype.indexOf` against patterns
 * stored pre-normalized in `ROOM_KEYWORDS`.
 */
export function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s_\-/]+/g, ' ')
    .trim()
}
