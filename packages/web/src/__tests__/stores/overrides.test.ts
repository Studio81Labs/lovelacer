import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useOverridesStore } from '../../stores/overrides.js'
import type { ApiError, Override } from '../../api/types.js'

vi.mock('../../api/client.js', () => ({
  getOverrides: vi.fn(),
  putOverrides: vi.fn(),
  postPreview: vi.fn(),
}))

const { getOverrides, putOverrides, postPreview } = await import('../../api/client.js')

describe('useOverridesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getOverrides).mockReset()
    vi.mocked(putOverrides).mockReset()
    vi.mocked(postPreview).mockReset()
  })

  it('starts with empty server + dirty state and idle phase', () => {
    const store = useOverridesStore()
    expect(store.phase).toBe('idle')
    expect(store.hasDirty).toBe(false)
    expect(store.dirtyCount).toBe(0)
    expect(store.error).toBeNull()
  })

  it('loadFromServer populates serverState and clears dirty', async () => {
    const overrides: Override[] = [{ entityId: 'a.b', roomId: 'kitchen' }]
    vi.mocked(getOverrides).mockResolvedValueOnce({ overrides })

    const store = useOverridesStore()
    store.setRoomId('a.b', 'bedroom') // create some dirty state to verify it clears
    expect(store.hasDirty).toBe(true)

    await store.loadFromServer()

    expect(store.effective('a.b')).toEqual({ entityId: 'a.b', roomId: 'kitchen' })
    expect(store.hasDirty).toBe(false)
    expect(store.phase).toBe('idle')
  })

  it('setRoomId adds an entry to dirtyState and effective() returns it', () => {
    const store = useOverridesStore()
    store.setRoomId('light.a', 'bedroom')

    expect(store.effective('light.a')).toEqual({ entityId: 'light.a', roomId: 'bedroom' })
    expect(store.hasDirty).toBe(true)
    expect(store.dirtyCount).toBe(1)
  })

  it('setRoomId(entityId, null) clears roomId but preserves hidden if set', () => {
    const store = useOverridesStore()
    store.setHidden('sensor.x', true)
    store.setRoomId('sensor.x', 'kitchen')
    store.setRoomId('sensor.x', null) // clear roomId

    expect(store.effective('sensor.x')).toEqual({ entityId: 'sensor.x', hidden: true })
  })

  it('setHidden preserves an existing roomId from server state', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    const store = useOverridesStore()
    await store.loadFromServer()

    store.setHidden('a.b', true)

    expect(store.effective('a.b')).toEqual({ entityId: 'a.b', roomId: 'kitchen', hidden: true })
    expect(store.hasDirty).toBe(true)
  })

  it('reverting an edit back to the server value collapses dirtyState', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    const store = useOverridesStore()
    await store.loadFromServer()

    store.setRoomId('a.b', 'bedroom') // dirty
    expect(store.hasDirty).toBe(true)
    store.setRoomId('a.b', 'kitchen') // back to server value

    expect(store.hasDirty).toBe(false)
    expect(store.dirtyCount).toBe(0)
  })

  it('setting both fields to no-override marks pending delete when server has an entry', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    const store = useOverridesStore()
    await store.loadFromServer()

    store.setRoomId('a.b', null) // both fields now unset
    expect(store.effective('a.b')).toBeNull() // pending delete
    expect(store.hasDirty).toBe(true)
    expect(store.dirtyCount).toBe(1)
  })

  it('setting an already-clean entity to no-op leaves dirtyState clean', () => {
    const store = useOverridesStore()
    // Server has nothing; user clicks something then clicks back to nothing
    store.setRoomId('a.b', 'kitchen')
    store.setRoomId('a.b', null)

    expect(store.effective('a.b')).toBeNull()
    expect(store.hasDirty).toBe(false)
  })

  it('saveAndReanalyze PUTs merged list, replaces serverState, calls analyze', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    vi.mocked(putOverrides).mockResolvedValueOnce({
      overrides: [
        { entityId: 'a.b', roomId: 'bedroom' },
        { entityId: 'c.d', hidden: true },
      ],
    })
    vi.mocked(postPreview).mockResolvedValueOnce({
      rooms: [],
      misc: [],
      summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
      config: { title: 'Lovelacer — Home', views: [] },
    })

    const store = useOverridesStore()
    await store.loadFromServer()

    store.setRoomId('a.b', 'bedroom')
    store.setHidden('c.d', true)

    await store.saveAndReanalyze()

    expect(putOverrides).toHaveBeenCalledWith({
      overrides: [
        { entityId: 'a.b', roomId: 'bedroom' },
        { entityId: 'c.d', hidden: true },
      ],
    })
    expect(store.hasDirty).toBe(false)
    expect(store.effective('a.b')).toEqual({ entityId: 'a.b', roomId: 'bedroom' })
    expect(store.effective('c.d')).toEqual({ entityId: 'c.d', hidden: true })
    expect(store.phase).toBe('idle')

    // Re-analyze called as part of the save flow
    expect(postPreview).toHaveBeenCalledOnce()
  })

  it('saveAndReanalyze with pending-delete entry omits it from the PUT body', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    vi.mocked(putOverrides).mockResolvedValueOnce({ overrides: [] })
    vi.mocked(postPreview).mockResolvedValueOnce({
      rooms: [],
      misc: [],
      summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
      config: { title: 'Lovelacer — Home', views: [] },
    })

    const store = useOverridesStore()
    await store.loadFromServer()
    store.setRoomId('a.b', null) // pending delete

    await store.saveAndReanalyze()

    expect(putOverrides).toHaveBeenCalledWith({ overrides: [] })
    expect(store.effective('a.b')).toBeNull() // gone after save too
  })

  it('saveAndReanalyze on 500 preserves dirtyState and sets phase=error', async () => {
    const apiError: ApiError = { error: 'storage_error', message: 'disk full' }
    vi.mocked(putOverrides).mockRejectedValueOnce(apiError)

    const store = useOverridesStore()
    store.setRoomId('a.b', 'bedroom')

    await store.saveAndReanalyze()

    expect(store.hasDirty).toBe(true) // preserved
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiError)
    // Re-analyze NOT called — save failed
    expect(postPreview).not.toHaveBeenCalled()
  })

  it('saveAndReanalyze: PUT succeeds but post-save analyze fails — overrides save reported successful', async () => {
    // PUT succeeds — overrides ARE saved.
    vi.mocked(putOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'bedroom' }],
    })
    // postPreview (called by analyze.analyze() inside saveAndReanalyze) fails.
    const postPreviewError: ApiError = {
      error: 'ha_unavailable',
      message: 'Home Assistant connection not ready',
    }
    vi.mocked(postPreview).mockRejectedValueOnce(postPreviewError)

    const store = useOverridesStore()
    store.setRoomId('a.b', 'bedroom')

    await store.saveAndReanalyze()

    // The save part succeeded:
    expect(store.hasDirty).toBe(false)
    expect(store.effective('a.b')).toEqual({ entityId: 'a.b', roomId: 'bedroom' })
    // overrides.phase is 'idle' — the override save itself was successful.
    // The analyze failure is the analyze store's concern (surfaced via the
    // existing analyze error UI in App.vue), not the overrides store's.
    expect(store.phase).toBe('idle')
    expect(store.error).toBeNull()
  })

  it('discardChanges clears dirtyState without touching serverState', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
    })
    const store = useOverridesStore()
    await store.loadFromServer()
    store.setRoomId('a.b', 'bedroom')

    store.discardChanges()

    expect(store.hasDirty).toBe(false)
    expect(store.effective('a.b')).toEqual({ entityId: 'a.b', roomId: 'kitchen' }) // server value
  })

  it('loadFromServer on 500 sets phase=error and preserves dirtyState', async () => {
    const apiError: ApiError = { error: 'storage_error', message: 'disk full' }
    vi.mocked(getOverrides).mockRejectedValueOnce(apiError)

    const store = useOverridesStore()
    store.setRoomId('a.b', 'bedroom') // pre-existing dirty
    await store.loadFromServer()

    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiError)
    expect(store.hasDirty).toBe(true) // not cleared on error
  })
})
