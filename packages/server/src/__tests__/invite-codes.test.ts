import { describe, it, expect } from 'vitest'
import { ACCEPTED_INVITE_CODES, isValidInviteCode } from '../invite-codes.js'

describe('isValidInviteCode', () => {
  it('returns true for an exact match', () => {
    expect(isValidInviteCode('BETA-2026-ALPHA')).toBe(true)
  })

  it('returns true for case-insensitive match', () => {
    expect(isValidInviteCode('beta-2026-alpha')).toBe(true)
    expect(isValidInviteCode('Beta-2026-Alpha')).toBe(true)
  })

  it('returns true for whitespace-trimmed match', () => {
    expect(isValidInviteCode('  BETA-2026-ALPHA  ')).toBe(true)
    expect(isValidInviteCode('\tBETA-2026-ALPHA\n')).toBe(true)
  })

  it('returns false for unknown code', () => {
    expect(isValidInviteCode('BETA-2026-WRONG')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidInviteCode('')).toBe(false)
  })

  it('returns false for non-string input', () => {
    expect(isValidInviteCode(null as unknown as string)).toBe(false)
    expect(isValidInviteCode(undefined as unknown as string)).toBe(false)
  })
})

describe('ACCEPTED_INVITE_CODES', () => {
  it('is non-empty', () => {
    expect(ACCEPTED_INVITE_CODES.length).toBeGreaterThan(0)
  })

  it('contains the BETA-2026-ALPHA test code', () => {
    expect(ACCEPTED_INVITE_CODES).toContain('BETA-2026-ALPHA')
  })
})
