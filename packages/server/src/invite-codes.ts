/**
 * Closed-beta invite codes. Distributed by the project owner via DM/email
 * to ~10 invitees. Rotation = new release with a different list.
 *
 * NOTE: this list is in a public repo — the codes are a velvet rope, not
 * authentication. The threat model is "casual r/homeassistant visitor",
 * not a determined attacker. A dedicated reader can self-invite.
 */
export const ACCEPTED_INVITE_CODES: readonly string[] = [
  'BETA-2026-ALPHA',
  'BETA-2026-BRAVO',
  'BETA-2026-CHARLIE',
  'BETA-2026-DELTA',
  'BETA-2026-ECHO',
  'BETA-2026-FOXTROT',
  'BETA-2026-GOLF',
  'BETA-2026-HOTEL',
  'BETA-2026-INDIA',
  'BETA-2026-JULIET',
]

const NORMALIZED_CODES = new Set(ACCEPTED_INVITE_CODES.map((c) => c.trim().toLowerCase()))

/**
 * Case-insensitive, whitespace-trimmed comparison. Friendly to invitees
 * who copy-paste with leading spaces or lowercase the code.
 */
export function isValidInviteCode(code: string): boolean {
  if (typeof code !== 'string' || code.length === 0) return false
  return NORMALIZED_CODES.has(code.trim().toLowerCase())
}
