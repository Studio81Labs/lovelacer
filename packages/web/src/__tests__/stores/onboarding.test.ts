import { setActivePinia, createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiError } from '../../api/types.js'

vi.mock('../../api/client.js', () => ({
  getOnboarding: vi.fn(),
  postOnboardingComplete: vi.fn(),
}))

import { getOnboarding, postOnboardingComplete } from '../../api/client.js'
import { useOnboardingStore } from '../../stores/onboarding.js'

describe('useOnboardingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getOnboarding).mockReset()
    vi.mocked(postOnboardingComplete).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with completedAt=undefined and shouldShowWizard=false (avoid flash)', () => {
    const store = useOnboardingStore()
    expect(store.completedAt).toBeUndefined()
    expect(store.shouldShowWizard).toBe(false)
    expect(store.phase).toBe('idle')
  })

  it('after loadStatus resolves with null: completedAt=null, shouldShowWizard=true', async () => {
    vi.mocked(getOnboarding).mockResolvedValueOnce({ completedAt: null })
    const store = useOnboardingStore()
    await store.loadStatus()
    expect(store.completedAt).toBeNull()
    expect(store.shouldShowWizard).toBe(true)
    expect(store.phase).toBe('idle')
  })

  it('after loadStatus resolves with a timestamp: completedAt=<number>, shouldShowWizard=false', async () => {
    const ts = 1700000000
    vi.mocked(getOnboarding).mockResolvedValueOnce({ completedAt: ts })
    const store = useOnboardingStore()
    await store.loadStatus()
    expect(store.completedAt).toBe(ts)
    expect(store.shouldShowWizard).toBe(false)
    expect(store.phase).toBe('idle')
  })

  it('loadStatus failure: phase=error, completedAt stays undefined, shouldShowWizard=false', async () => {
    const apiErr: ApiError = { error: 'network', message: 'connection lost' }
    vi.mocked(getOnboarding).mockRejectedValueOnce(apiErr)
    const store = useOnboardingStore()
    await store.loadStatus()
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
    expect(store.completedAt).toBeUndefined()
    expect(store.shouldShowWizard).toBe(false)
  })

  it('isResolved: false initially, true after successful load, true after error (regression: Bugbot #25 Medium blank screen)', async () => {
    // Initial — neither loaded nor errored
    const store = useOnboardingStore()
    expect(store.isResolved).toBe(false)

    // Successful load
    vi.mocked(getOnboarding).mockResolvedValueOnce({ completedAt: null })
    await store.loadStatus()
    expect(store.isResolved).toBe(true)

    // Error — fresh store so completedAt stays undefined; isResolved must
    // still flip true so App.vue's gating fails open into the main view.
    setActivePinia(createPinia())
    vi.mocked(getOnboarding).mockRejectedValueOnce({
      error: 'network',
      message: 'down',
    } satisfies ApiError)
    const errStore = useOnboardingStore()
    await errStore.loadStatus()
    expect(errStore.completedAt).toBeUndefined()
    expect(errStore.phase).toBe('error')
    expect(errStore.isResolved).toBe(true)
  })

  it('complete() happy path: completedAt set to result, phase=idle', async () => {
    const ts = 1700000000
    vi.mocked(postOnboardingComplete).mockResolvedValueOnce({ completedAt: ts })
    const store = useOnboardingStore()
    await store.complete()
    expect(store.completedAt).toBe(ts)
    expect(store.phase).toBe('idle')
    expect(store.shouldShowWizard).toBe(false)
  })

  it('complete() failure: phase=error, completedAt unchanged, error stored, throws', async () => {
    const apiErr: ApiError = { error: 'storage_error', message: 'disk full' }
    vi.mocked(postOnboardingComplete).mockRejectedValueOnce(apiErr)
    const store = useOnboardingStore()
    await expect(store.complete()).rejects.toEqual(apiErr)
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
    expect(store.completedAt).toBeUndefined()
  })
})
