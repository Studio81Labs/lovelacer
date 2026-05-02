import { setActivePinia, createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiError } from '../../api/types.js'
import { useSuggestionsStore } from '../../stores/suggestions.js'

vi.mock('../../api/client.js', () => ({
  postDismissSuggestion: vi.fn(),
}))

import { postDismissSuggestion } from '../../api/client.js'

describe('useSuggestionsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(postDismissSuggestion).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in idle phase with empty optimistic set', () => {
    const store = useSuggestionsStore()
    expect(store.phase).toBe('idle')
    expect(store.error).toBeNull()
    expect(store.isDismissed('a.b', 'set_area_id')).toBe(false)
  })

  it('on successful dismiss: phase ends idle, key added, isDismissed returns true', async () => {
    vi.mocked(postDismissSuggestion).mockResolvedValueOnce(undefined)
    const store = useSuggestionsStore()
    await store.dismiss('sensor.foo', 'set_area_id')
    expect(store.phase).toBe('idle')
    expect(store.error).toBeNull()
    expect(store.isDismissed('sensor.foo', 'set_area_id')).toBe(true)
    expect(store.isDismissed('sensor.foo', 'hide_diagnostic')).toBe(false)
  })

  it('adds the key optimistically (before the POST resolves)', async () => {
    // Hold the POST in pending state so we can observe the in-flight
    // store state. The card must already be hidden at this point —
    // that's what "optimistic" means.
    let resolvePost: (() => void) | null = null
    vi.mocked(postDismissSuggestion).mockImplementationOnce(
      () =>
        new Promise<void>((res) => {
          resolvePost = res
        }),
    )
    const store = useSuggestionsStore()
    const pending = store.dismiss('sensor.foo', 'set_area_id')
    // Mid-flight: phase is 'dismissing', key is already set.
    expect(store.phase).toBe('dismissing')
    expect(store.isDismissed('sensor.foo', 'set_area_id')).toBe(true)
    // Resolve and let the dismiss settle.
    resolvePost!()
    await pending
    expect(store.phase).toBe('idle')
    expect(store.isDismissed('sensor.foo', 'set_area_id')).toBe(true)
  })

  it('on dismiss failure: phase ends error, key rolled back, error set, throws', async () => {
    const apiErr: ApiError = { error: 'storage_error', message: 'disk full' }
    vi.mocked(postDismissSuggestion).mockRejectedValueOnce(apiErr)
    const store = useSuggestionsStore()
    await expect(store.dismiss('sensor.foo', 'set_area_id')).rejects.toEqual(apiErr)
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
    // Key was added optimistically and rolled back — final state is absent
    // so the card re-appears for retry.
    expect(store.isDismissed('sensor.foo', 'set_area_id')).toBe(false)
  })

  it('rollback on failure does not affect previously-dismissed keys', async () => {
    // First dismiss succeeds; second fails. The first key must survive
    // the second's rollback.
    vi.mocked(postDismissSuggestion)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ error: 'storage_error', message: 'x' } satisfies ApiError)
    const store = useSuggestionsStore()
    await store.dismiss('sensor.aaa', 'set_area_id')
    await expect(store.dismiss('sensor.bbb', 'hide_diagnostic')).rejects.toBeDefined()
    expect(store.isDismissed('sensor.aaa', 'set_area_id')).toBe(true)
    expect(store.isDismissed('sensor.bbb', 'hide_diagnostic')).toBe(false)
  })

  it('reset() clears the optimistic set + error and returns to idle', async () => {
    vi.mocked(postDismissSuggestion).mockResolvedValueOnce(undefined)
    const store = useSuggestionsStore()
    await store.dismiss('sensor.foo', 'set_area_id')
    expect(store.isDismissed('sensor.foo', 'set_area_id')).toBe(true)

    store.reset()
    expect(store.phase).toBe('idle')
    expect(store.error).toBeNull()
    expect(store.isDismissed('sensor.foo', 'set_area_id')).toBe(false)
  })
})
