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

  it('on dismiss failure: phase ends error, key NOT added, error set, throws', async () => {
    const apiErr: ApiError = { error: 'storage_error', message: 'disk full' }
    vi.mocked(postDismissSuggestion).mockRejectedValueOnce(apiErr)
    const store = useSuggestionsStore()
    await expect(store.dismiss('sensor.foo', 'set_area_id')).rejects.toEqual(apiErr)
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
    expect(store.isDismissed('sensor.foo', 'set_area_id')).toBe(false)
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
