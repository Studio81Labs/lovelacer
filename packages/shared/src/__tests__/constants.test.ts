import { describe, it, expect } from 'vitest'
import { bucketForConfidence, CANONICAL_ROOMS } from '../index.js'

describe('bucketForConfidence', () => {
  it('returns "high" for confidence in [0.85, 1.0]', () => {
    expect(bucketForConfidence(1.0)).toBe('high')
    expect(bucketForConfidence(0.95)).toBe('high')
    expect(bucketForConfidence(0.85)).toBe('high')
  })

  it('returns "medium" for confidence in [0.5, 0.85)', () => {
    expect(bucketForConfidence(0.849)).toBe('medium')
    expect(bucketForConfidence(0.7)).toBe('medium')
    expect(bucketForConfidence(0.5)).toBe('medium')
  })

  it('returns "low" for confidence in (0, 0.5)', () => {
    expect(bucketForConfidence(0.499)).toBe('low')
    expect(bucketForConfidence(0.25)).toBe('low')
    expect(bucketForConfidence(0.01)).toBe('low')
    expect(bucketForConfidence(Number.EPSILON)).toBe('low')
  })

  it('returns "none" for confidence of 0', () => {
    expect(bucketForConfidence(0)).toBe('none')
  })
})

describe('CANONICAL_ROOMS', () => {
  it('includes a "misc" fallback', () => {
    expect(CANONICAL_ROOMS).toContain('misc')
  })

  it('contains no duplicates', () => {
    expect(new Set(CANONICAL_ROOMS).size).toBe(CANONICAL_ROOMS.length)
  })
})
