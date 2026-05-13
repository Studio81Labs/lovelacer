import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAnalyzeStore } from '../../stores/analyze.js'
import { useApplyStore } from '../../stores/apply.js'
import type { ApiError, PreviewOutput } from '../../api/types.js'

vi.mock('../../api/client.js', () => ({
  postPreview: vi.fn(),
}))

const { postPreview } = await import('../../api/client.js')

const mockPreview: PreviewOutput = {
  rooms: [
    {
      id: 'kitchen',
      haAreaId: 'kitchen',
      displayName: 'Kitchen',
      icon: 'mdi:silverware-fork-knife',
      entityCount: 12,
      averageConfidence: 0.92,
      assignments: [],
    },
  ],
  misc: [],
  summary: { entityCount: 12, roomCount: 1, miscCount: 0 },
  config: {
    title: 'Lovelacer — Home',
    views: [
      {
        type: 'sections',
        title: 'Home',
        path: 'home',
        icon: 'mdi:home-variant',
      },
    ],
  },
  diff: null,
  suggestions: [],
}

describe('useAnalyzeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes idle', () => {
    const store = useAnalyzeStore()
    expect(store.phase).toBe('idle')
    expect(store.preview).toBeNull()
    expect(store.error).toBeNull()
  })

  it('happy path: loading → ready, populates preview', async () => {
    vi.mocked(postPreview).mockResolvedValueOnce(mockPreview)
    const store = useAnalyzeStore()

    const promise = store.analyze()
    expect(store.phase).toBe('loading')
    await promise

    expect(store.phase).toBe('ready')
    expect(store.preview).toEqual(mockPreview)
    expect(store.error).toBeNull()
  })

  it('clears stale apply success when analyze() produces a fresh preview', async () => {
    vi.mocked(postPreview).mockResolvedValueOnce(mockPreview)
    const store = useAnalyzeStore()
    const apply = useApplyStore()
    apply.$patch({
      phase: 'success',
      result: { ok: true, urlPath: 'lovelacer-home', created: false },
    })

    await store.analyze()

    expect(store.preview).toEqual(mockPreview)
    expect(apply.phase).toBe('idle')
    expect(apply.result).toBeNull()
  })

  it('error path: loading → error, leaves preview null', async () => {
    const apiErr: ApiError = { error: 'ha_unavailable', message: 'down' }
    vi.mocked(postPreview).mockRejectedValueOnce(apiErr)
    const store = useAnalyzeStore()

    await store.analyze()

    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
    expect(store.preview).toBeNull()
  })

  it('reset() returns to idle and clears all fields', async () => {
    vi.mocked(postPreview).mockResolvedValueOnce(mockPreview)
    const store = useAnalyzeStore()
    await store.analyze()

    store.reset()

    expect(store.phase).toBe('idle')
    expect(store.preview).toBeNull()
    expect(store.error).toBeNull()
  })

  it('re-running analyze() after error clears prior error before fetching', async () => {
    vi.mocked(postPreview)
      .mockRejectedValueOnce({ error: 'ha_unavailable', message: 'first' })
      .mockResolvedValueOnce(mockPreview)
    const store = useAnalyzeStore()

    await store.analyze()
    expect(store.error).not.toBeNull()

    const promise = store.analyze()
    expect(store.error).toBeNull() // cleared eagerly when phase flips to loading
    await promise

    expect(store.phase).toBe('ready')
    expect(store.preview).toEqual(mockPreview)
  })

  it('refreshPreview updates preview without switching ready state to loading', async () => {
    const refreshed: PreviewOutput = {
      ...mockPreview,
      summary: { entityCount: 12, roomCount: 2, miscCount: 0 },
    }
    vi.mocked(postPreview).mockResolvedValueOnce(refreshed)
    const store = useAnalyzeStore()
    store.$patch({ phase: 'ready', preview: mockPreview })

    const promise = store.refreshPreview()
    expect(store.phase).toBe('ready')
    expect(store.isRefreshingPreview).toBe(true)
    await promise

    expect(store.phase).toBe('ready')
    expect(store.isRefreshingPreview).toBe(false)
    expect(store.preview).toEqual(refreshed)
  })

  it('clears stale apply success when refreshPreview() produces a fresh preview', async () => {
    const refreshed: PreviewOutput = {
      ...mockPreview,
      summary: { entityCount: 12, roomCount: 2, miscCount: 0 },
    }
    vi.mocked(postPreview).mockResolvedValueOnce(refreshed)
    const store = useAnalyzeStore()
    const apply = useApplyStore()
    store.$patch({ phase: 'ready', preview: mockPreview })
    apply.$patch({
      phase: 'success',
      result: { ok: true, urlPath: 'lovelacer-home', created: false },
    })

    await store.refreshPreview()

    expect(store.preview).toEqual(refreshed)
    expect(apply.phase).toBe('idle')
    expect(apply.result).toBeNull()
  })

  it('refreshPreview keeps the existing preview but marks it stale on failure', async () => {
    const apiErr: ApiError = { error: 'preview_failed', message: 'nope' }
    vi.mocked(postPreview).mockRejectedValueOnce(apiErr)
    const store = useAnalyzeStore()
    store.$patch({ phase: 'ready', preview: mockPreview })

    await store.refreshPreview()

    expect(store.phase).toBe('error')
    expect(store.isRefreshingPreview).toBe(false)
    expect(store.preview).toEqual(mockPreview)
    expect(store.error).toEqual(apiErr)
  })
})
