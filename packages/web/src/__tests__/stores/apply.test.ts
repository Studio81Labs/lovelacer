import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useApplyStore } from '../../stores/apply.js'
import type { ApiError, ApplyResult, LovelaceConfig } from '../../api/types.js'

vi.mock('../../api/client.js', () => ({
  postApply: vi.fn(),
}))

const { postApply } = await import('../../api/client.js')

const config: LovelaceConfig = {
  title: 'Lovelacer — Home',
  views: [
    {
      type: 'sections',
      title: 'Home',
      path: 'home',
      icon: 'mdi:home-variant',
    },
  ],
}

const mockResult: ApplyResult = {
  ok: true,
  urlPath: 'lovelacer-home',
  created: true,
}

describe('useApplyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes idle', () => {
    const store = useApplyStore()
    expect(store.phase).toBe('idle')
    expect(store.result).toBeNull()
    expect(store.error).toBeNull()
  })

  it('happy path: applying → success, populates result', async () => {
    vi.mocked(postApply).mockResolvedValueOnce(mockResult)
    const store = useApplyStore()

    const promise = store.apply({ config })
    expect(store.phase).toBe('applying')
    await promise

    expect(store.phase).toBe('success')
    expect(store.result).toEqual(mockResult)
    expect(vi.mocked(postApply)).toHaveBeenCalledWith({ config })
  })

  it('502 ha_apply_failed path: error preserves step', async () => {
    const apiErr: ApiError = {
      error: 'ha_apply_failed',
      step: 'save',
      message: 'failed at save',
    }
    vi.mocked(postApply).mockRejectedValueOnce(apiErr)
    const store = useApplyStore()

    await store.apply({ config })

    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
    expect(store.error?.step).toBe('save')
    expect(store.result).toBeNull()
  })

  it('400 invalid_config path: error preserved for UI', async () => {
    const apiErr: ApiError = { error: 'invalid_config', message: 'bad title' }
    vi.mocked(postApply).mockRejectedValueOnce(apiErr)
    const store = useApplyStore()

    await store.apply({ config })

    expect(store.phase).toBe('error')
    expect(store.error?.error).toBe('invalid_config')
  })

  it('reset() clears all fields', async () => {
    vi.mocked(postApply).mockResolvedValueOnce(mockResult)
    const store = useApplyStore()
    await store.apply({ config })

    store.reset()

    expect(store.phase).toBe('idle')
    expect(store.result).toBeNull()
    expect(store.error).toBeNull()
  })

  it('reset() ignores a later successful response from an in-flight apply', async () => {
    let resolveApply!: (value: ApplyResult) => void
    vi.mocked(postApply).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveApply = resolve
      }),
    )
    const store = useApplyStore()

    const promise = store.apply({ config })
    expect(store.phase).toBe('applying')

    store.reset()
    expect(store.phase).toBe('idle')

    resolveApply(mockResult)
    await promise

    expect(store.phase).toBe('idle')
    expect(store.result).toBeNull()
    expect(store.error).toBeNull()
  })

  it('reset() ignores a later failed response from an in-flight apply', async () => {
    const apiErr: ApiError = {
      error: 'ha_apply_failed',
      step: 'save',
      message: 'failed at save',
    }
    let rejectApply!: (reason: ApiError) => void
    vi.mocked(postApply).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectApply = reject
      }),
    )
    const store = useApplyStore()

    const promise = store.apply({ config })
    expect(store.phase).toBe('applying')

    store.reset()
    expect(store.phase).toBe('idle')

    rejectApply(apiErr)
    await promise

    expect(store.phase).toBe('idle')
    expect(store.result).toBeNull()
    expect(store.error).toBeNull()
  })

  it('passes snapshot through to postApply when provided', async () => {
    const snapshot = {
      assignments: [{ entityId: 'light.k', roomId: 'kitchen' }],
      config,
    }
    vi.mocked(postApply).mockResolvedValueOnce(mockResult)
    const store = useApplyStore()

    await store.apply({ config, snapshot })

    expect(vi.mocked(postApply)).toHaveBeenCalledWith({ config, snapshot })
  })
})
