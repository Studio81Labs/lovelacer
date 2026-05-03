import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OnboardingStore } from '../onboarding-store.js'

describe('OnboardingStore (in-memory)', () => {
  let store: OnboardingStore

  beforeEach(() => {
    store = new OnboardingStore(':memory:')
  })

  afterEach(() => {
    store.close()
  })

  it('returns { completedAt: null } on a fresh store', () => {
    expect(store.get()).toEqual({ completedAt: null })
  })

  it('complete() returns the persisted timestamp', () => {
    const before = Math.floor(Date.now() / 1000)
    const result = store.complete()
    const after = Math.floor(Date.now() / 1000) + 1

    expect(result.completedAt).not.toBeNull()
    expect(result.completedAt).toBeGreaterThanOrEqual(before)
    expect(result.completedAt).toBeLessThanOrEqual(after)
  })

  it('subsequent get() returns the timestamp set by complete()', () => {
    const result = store.complete()
    expect(store.get()).toEqual(result)
  })

  it('complete() twice is idempotent (INSERT OR REPLACE updates timestamp)', () => {
    const first = store.complete()
    // Sleep briefly to allow the timestamp to advance.
    const start = Date.now()
    while (Date.now() - start < 1100) {
      /* spin */
    }
    const second = store.complete()
    expect(second.completedAt).toBeGreaterThanOrEqual(first.completedAt!)
    expect(store.get()).toEqual(second)
  })
})

describe('OnboardingStore (file-backed)', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'onboarding-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates the parent directory if missing', () => {
    const filename = join(dir, 'nested', 'lovelacer.sqlite')
    const store = new OnboardingStore(filename)
    try {
      const result = store.complete()
      expect(result.completedAt).not.toBeNull()
    } finally {
      store.close()
    }
  })

  it('persists across instances', () => {
    const filename = join(dir, 'lovelacer.sqlite')
    const first = new OnboardingStore(filename)
    const result = first.complete()
    first.close()

    const second = new OnboardingStore(filename)
    try {
      expect(second.get()).toEqual(result)
    } finally {
      second.close()
    }
  })
})
