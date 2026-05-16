import { setActivePinia, createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiError, Settings } from '../../api/types.js'
import { DEFAULT_SETTINGS } from '../../api/types.js'

vi.mock('../../api/client.js', () => ({
  getLatestAnalysis: vi.fn(),
  getSettings: vi.fn(),
  putSettings: vi.fn(),
  postPreview: vi.fn().mockResolvedValue({
    rooms: [],
    misc: [],
    summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
    config: { title: 'Lovelacer — Home', views: [] },
    diff: null,
    suggestions: [],
  }),
}))

import { getSettings, putSettings } from '../../api/client.js'
import { useSettingsStore } from '../../stores/settings.js'

const SAMPLE: Settings = {
  language: 'cs',
  cardPack: 'default',
  sections: {
    welcome: false,
    quickStats: true,
    people: true,
    roomsByFloor: true,
    activeRooms: true,
    scenes: true,
    cameras: true,
  },
  uiLanguage: 'en',
}

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getSettings).mockReset()
    vi.mocked(putSettings).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with phase=idle, serverState=null, dirtyState=null, effective=DEFAULT_SETTINGS', () => {
    const store = useSettingsStore()
    expect(store.phase).toBe('idle')
    expect(store.serverState).toBeNull()
    expect(store.dirtyState).toBeNull()
    expect(store.hasDirty).toBe(false)
    expect(store.effective).toEqual(DEFAULT_SETTINGS)
  })

  it('loadFromServer happy path: sets serverState, phase ends idle', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: SAMPLE })
    const store = useSettingsStore()
    await store.loadFromServer()
    expect(store.phase).toBe('idle')
    expect(store.serverState).toEqual(SAMPLE)
    expect(store.effective).toEqual(SAMPLE)
  })

  it('loadFromServer reuses an in-flight settings request', async () => {
    let resolveSettings: (value: { settings: Settings }) => void = () => {}
    vi.mocked(getSettings).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSettings = resolve
      }),
    )
    const store = useSettingsStore()

    const first = store.loadFromServer()
    const second = store.loadFromServer()
    resolveSettings({ settings: SAMPLE })

    await Promise.all([first, second])

    expect(getSettings).toHaveBeenCalledOnce()
    expect(store.serverState).toEqual(SAMPLE)
    expect(store.phase).toBe('idle')
  })

  it('setLanguage clones effective into dirtyState and sets the field', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    const store = useSettingsStore()
    await store.loadFromServer()

    store.setLanguage('cs')
    expect(store.hasDirty).toBe(true)
    expect(store.dirtyState?.language).toBe('cs')
    expect(store.effective.language).toBe('cs')
    // Server state unchanged.
    expect(store.serverState?.language).toBe('auto')
  })

  it('setSection updates the dirty section flag', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    const store = useSettingsStore()
    await store.loadFromServer()

    store.setSection('cameras', false)
    expect(store.dirtyState?.sections.cameras).toBe(false)
    // Other flags unchanged.
    expect(store.dirtyState?.sections.welcome).toBe(true)
  })

  it('setRoomOrder stages a copy of the preferred room order', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    const store = useSettingsStore()
    await store.loadFromServer()

    const order = ['bedroom', 'kitchen']
    store.setRoomOrder(order)
    order.reverse()

    expect(store.hasDirty).toBe(true)
    expect(store.dirtyState?.roomOrder).toEqual(['bedroom', 'kitchen'])
    expect(store.effective.roomOrder).toEqual(['bedroom', 'kitchen'])
  })

  it('setRoomOverride stages a sanitized room override', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    const store = useSettingsStore()
    await store.loadFromServer()

    store.setRoomOverride('kitchen', {
      name: '  Breakfast nook  ',
      icon: '  mdi:coffee  ',
      showNameOnCard: false,
    })

    expect(store.dirtyState?.roomOverrides).toEqual({
      kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee', showNameOnCard: false },
    })
  })

  it('setRoomOverride omits redundant true showNameOnCard overrides', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    const store = useSettingsStore()
    await store.loadFromServer()

    store.setRoomOverride('kitchen', {
      name: '  Breakfast nook  ',
      icon: '  mdi:coffee  ',
      showNameOnCard: true,
    })

    expect(store.dirtyState?.roomOverrides).toEqual({
      kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' },
    })
  })

  it('setRoomOverride persists explicit hidden-label overrides without name or icon', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    const store = useSettingsStore()
    await store.loadFromServer()

    store.setRoomOverride('kitchen', { name: '', icon: '', showNameOnCard: false })

    expect(store.dirtyState?.roomOverrides).toEqual({
      kitchen: { showNameOnCard: false },
    })
  })

  it('setRoomOverride reset removes empty room override entries', async () => {
    const saved: Settings = {
      ...DEFAULT_SETTINGS,
      roomOverrides: { kitchen: { name: 'Breakfast nook' } },
    }
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: saved })
    const store = useSettingsStore()
    await store.loadFromServer()

    store.setRoomOverride('kitchen', { name: '', icon: '', showNameOnCard: true })

    expect(store.dirtyState?.roomOverrides).toBeUndefined()
  })

  it('setRoomOverride collapses reset override against fresh server state', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    const store = useSettingsStore()
    await store.loadFromServer()

    store.setRoomOverride('kitchen', { name: '', icon: '', showNameOnCard: true })

    expect(store.dirtyState).toBeNull()
    expect(store.hasDirty).toBe(false)
  })

  it('snapshots and restores dirty settings without sharing references', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    const store = useSettingsStore()
    await store.loadFromServer()
    store.setLanguage('cs')

    const snapshot = store.snapshotDirtyState()
    store.setRoomOrder(['bedroom', 'kitchen'])
    snapshot!.roomOrder = ['mutated']
    snapshot!.sections.cameras = false

    store.restoreDirtyState(snapshot)
    snapshot!.roomOrder = ['changed-again']

    expect(store.dirtyState?.language).toBe('cs')
    expect(store.dirtyState?.roomOrder).toEqual(['mutated'])
    expect(store.dirtyState?.sections.cameras).toBe(false)
  })

  it('snapshots and restores roomOverrides without sharing nested references', async () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      roomOverrides: {
        kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee', showNameOnCard: false },
      },
    }
    vi.mocked(getSettings).mockResolvedValueOnce({ settings })
    const store = useSettingsStore()
    await store.loadFromServer()
    store.setLanguage('cs')

    const snapshot = store.snapshotDirtyState()
    snapshot!.roomOverrides!.kitchen.name = 'Mutated'

    store.restoreDirtyState(snapshot)
    snapshot!.roomOverrides!.kitchen.icon = 'mdi:tea'

    expect(store.dirtyState?.roomOverrides?.kitchen).toEqual({
      name: 'Mutated',
      icon: 'mdi:coffee',
      showNameOnCard: false,
    })
  })

  it('discardChanges clears dirtyState only (locale revert lives in SettingsModal — P2-9)', async () => {
    // The store's discardChanges() intentionally does NOT touch i18n.
    // The active-locale revert is owned by SettingsModal because only
    // the modal has a clean session boundary (component setup runs once
    // when the modal opens). See SettingsModal.onDiscard.
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    const store = useSettingsStore()
    await store.loadFromServer()
    store.setLanguage('en')
    expect(store.hasDirty).toBe(true)

    store.discardChanges()
    expect(store.hasDirty).toBe(false)
    expect(store.effective).toEqual(DEFAULT_SETTINGS)
  })

  it('saveAndReanalyze happy path: PUT, replace serverState, clear dirty, trigger analyze', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    vi.mocked(putSettings).mockResolvedValueOnce({ settings: SAMPLE })
    const store = useSettingsStore()
    await store.loadFromServer()
    store.setLanguage('cs')
    store.setSection('welcome', false)

    await store.saveAndReanalyze()
    expect(vi.mocked(putSettings)).toHaveBeenCalledOnce()
    expect(store.serverState).toEqual(SAMPLE)
    expect(store.dirtyState).toBeNull()
    expect(store.phase).toBe('idle')
  })

  it('saveOnly happy path: PUT, replace serverState, clear dirty, does not trigger analyze', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    vi.mocked(putSettings).mockResolvedValueOnce({ settings: SAMPLE })
    const store = useSettingsStore()
    await store.loadFromServer()
    store.setRoomOrder(['bedroom', 'kitchen'])

    await store.saveOnly()

    expect(vi.mocked(putSettings)).toHaveBeenCalledOnce()
    expect(store.serverState).toEqual(SAMPLE)
    expect(store.dirtyState).toBeNull()
    expect(store.phase).toBe('idle')
  })

  it('saveRoomOrder saves only the room order and preserves existing dirty settings', async () => {
    const savedSettings: Settings = {
      ...DEFAULT_SETTINGS,
      roomOrder: ['bedroom', 'kitchen'],
    }
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    vi.mocked(putSettings).mockResolvedValueOnce({ settings: savedSettings })
    const store = useSettingsStore()
    await store.loadFromServer()
    store.setLanguage('cs')

    await store.saveRoomOrder(['bedroom', 'kitchen'])

    expect(vi.mocked(putSettings)).toHaveBeenCalledWith({ settings: savedSettings })
    expect(store.serverState).toEqual(savedSettings)
    expect(store.dirtyState?.language).toBe('cs')
    expect(store.dirtyState?.roomOrder).toEqual(['bedroom', 'kitchen'])
    expect(store.phase).toBe('idle')
  })

  it('saveRoomOverride saves one room override and preserves existing dirty settings', async () => {
    const savedSettings: Settings = {
      ...DEFAULT_SETTINGS,
      roomOverrides: { kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' } },
    }
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    vi.mocked(putSettings).mockResolvedValueOnce({ settings: savedSettings })
    const store = useSettingsStore()
    await store.loadFromServer()
    store.setLanguage('cs')

    await store.saveRoomOverride('kitchen', { name: 'Breakfast nook', icon: 'mdi:coffee' })

    expect(vi.mocked(putSettings)).toHaveBeenCalledWith({ settings: savedSettings })
    expect(store.serverState).toEqual(savedSettings)
    expect(store.dirtyState?.language).toBe('cs')
    expect(store.dirtyState?.roomOverrides).toEqual(savedSettings.roomOverrides)
  })

  it('saveRoomOverride preserves newer same-room dirty edits made while save is in flight on success', async () => {
    const savedSettings: Settings = {
      ...DEFAULT_SETTINGS,
      roomOverrides: { kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' } },
    }
    let resolveSave: (value: { settings: Settings }) => void = () => {}
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    vi.mocked(putSettings).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve
      }),
    )
    const store = useSettingsStore()
    await store.loadFromServer()

    const save = store.saveRoomOverride('kitchen', {
      name: 'Breakfast nook',
      icon: 'mdi:coffee',
    })
    await Promise.resolve()
    store.setRoomOverride('kitchen', { name: 'Dinner nook', icon: 'mdi:silverware' })
    resolveSave({ settings: savedSettings })
    await save

    expect(store.serverState).toEqual(savedSettings)
    expect(store.dirtyState?.roomOverrides?.kitchen).toEqual({
      name: 'Dinner nook',
      icon: 'mdi:silverware',
    })
  })

  it('saveRoomOverride preserves newer same-room dirty edits made while save is in flight on failure', async () => {
    const apiErr: ApiError = { error: 'storage_error', message: 'disk full' }
    let rejectSave: (reason: ApiError) => void = () => {}
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    vi.mocked(putSettings).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectSave = reject
      }),
    )
    const store = useSettingsStore()
    await store.loadFromServer()

    const save = store.saveRoomOverride('kitchen', {
      name: 'Breakfast nook',
      icon: 'mdi:coffee',
    })
    await Promise.resolve()
    store.setRoomOverride('kitchen', { name: 'Dinner nook', icon: 'mdi:silverware' })
    rejectSave(apiErr)
    await expect(save).rejects.toEqual(apiErr)

    expect(store.dirtyState?.roomOverrides?.kitchen).toEqual({
      name: 'Dinner nook',
      icon: 'mdi:silverware',
    })
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
  })

  it('saveRoomOverride keeps a previous dirty reset removed on failure', async () => {
    const serverSettings: Settings = {
      ...DEFAULT_SETTINGS,
      roomOverrides: { kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' } },
    }
    const apiErr: ApiError = { error: 'storage_error', message: 'disk full' }
    let rejectSave: (reason: ApiError) => void = () => {}
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: serverSettings })
    vi.mocked(putSettings).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectSave = reject
      }),
    )
    const store = useSettingsStore()
    await store.loadFromServer()
    store.setRoomOverride('kitchen', { name: '', icon: '', showNameOnCard: true })

    const save = store.saveRoomOverride('kitchen', { name: 'Dinner nook' })
    await Promise.resolve()
    rejectSave(apiErr)
    await expect(save).rejects.toEqual(apiErr)

    expect(store.serverState).toEqual(serverSettings)
    expect(store.dirtyState?.roomOverrides).toBeUndefined()
    expect(store.effective.roomOverrides).toBeUndefined()
  })

  it('saveRoomOrder preserves modal edits made while the save is in flight', async () => {
    const savedSettings: Settings = {
      ...DEFAULT_SETTINGS,
      roomOrder: ['bedroom', 'kitchen'],
    }
    let resolveSave: (value: { settings: Settings }) => void = () => {}
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    vi.mocked(putSettings).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve
      }),
    )
    const store = useSettingsStore()
    await store.loadFromServer()

    const save = store.saveRoomOrder(['bedroom', 'kitchen'])
    await Promise.resolve()
    store.setLanguage('cs')
    resolveSave({ settings: savedSettings })
    await save

    expect(store.serverState).toEqual(savedSettings)
    expect(store.dirtyState?.language).toBe('cs')
    expect(store.dirtyState?.roomOrder).toEqual(['bedroom', 'kitchen'])
    expect(store.phase).toBe('idle')
  })

  it('serializes modal saves after in-flight room order saves so neither full PUT wins stale', async () => {
    const roomOrderSettings: Settings = {
      ...DEFAULT_SETTINGS,
      roomOrder: ['bedroom', 'kitchen'],
    }
    const combinedSettings: Settings = {
      ...roomOrderSettings,
      language: 'cs',
    }
    let resolveRoomOrderSave: (value: { settings: Settings }) => void = () => {}
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    vi.mocked(putSettings)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRoomOrderSave = resolve
        }),
      )
      .mockResolvedValueOnce({ settings: combinedSettings })
    const store = useSettingsStore()
    await store.loadFromServer()

    const roomOrderSave = store.saveRoomOrder(['bedroom', 'kitchen'])
    await Promise.resolve()
    store.setLanguage('cs')
    const modalSave = store.saveOnly()
    await Promise.resolve()

    expect(vi.mocked(putSettings)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(putSettings)).toHaveBeenNthCalledWith(1, { settings: roomOrderSettings })

    resolveRoomOrderSave({ settings: roomOrderSettings })
    await roomOrderSave
    await modalSave

    expect(vi.mocked(putSettings)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(putSettings)).toHaveBeenNthCalledWith(2, { settings: combinedSettings })
    expect(store.serverState).toEqual(combinedSettings)
    expect(store.dirtyState).toBeNull()
    expect(store.phase).toBe('idle')
  })

  it('ignores stale settings reloads that resolve after an in-flight room order save', async () => {
    const roomOrderSettings: Settings = {
      ...DEFAULT_SETTINGS,
      roomOrder: ['bedroom', 'kitchen'],
    }
    let resolveRoomOrderSave: (value: { settings: Settings }) => void = () => {}
    let resolveReload: (value: { settings: Settings }) => void = () => {}
    vi.mocked(getSettings)
      .mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveReload = resolve
        }),
      )
    vi.mocked(putSettings).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRoomOrderSave = resolve
      }),
    )
    const store = useSettingsStore()
    await store.loadFromServer()

    const roomOrderSave = store.saveRoomOrder(['bedroom', 'kitchen'])
    await Promise.resolve()
    const reload = store.loadFromServer()
    await Promise.resolve()

    resolveRoomOrderSave({ settings: roomOrderSettings })
    await roomOrderSave
    resolveReload({ settings: DEFAULT_SETTINGS })
    await reload

    expect(vi.mocked(getSettings)).toHaveBeenCalledTimes(2)
    expect(store.serverState).toEqual(roomOrderSettings)
    expect(store.effective.roomOrder).toEqual(['bedroom', 'kitchen'])
    expect(store.phase).toBe('idle')
  })

  it('serializes room order saves after in-flight modal saves so neither full PUT wins stale', async () => {
    const modalSettings: Settings = {
      ...DEFAULT_SETTINGS,
      language: 'cs',
    }
    const combinedSettings: Settings = {
      ...modalSettings,
      roomOrder: ['bedroom', 'kitchen'],
    }
    let resolveModalSave: (value: { settings: Settings }) => void = () => {}
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    vi.mocked(putSettings)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveModalSave = resolve
        }),
      )
      .mockResolvedValueOnce({ settings: combinedSettings })
    const store = useSettingsStore()
    await store.loadFromServer()
    store.setLanguage('cs')

    const modalSave = store.saveOnly()
    await Promise.resolve()
    const roomOrderSave = store.saveRoomOrder(['bedroom', 'kitchen'])
    await Promise.resolve()

    expect(vi.mocked(putSettings)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(putSettings)).toHaveBeenNthCalledWith(1, { settings: modalSettings })

    resolveModalSave({ settings: modalSettings })
    await modalSave
    await roomOrderSave

    expect(vi.mocked(putSettings)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(putSettings)).toHaveBeenNthCalledWith(2, { settings: combinedSettings })
    expect(store.serverState).toEqual(combinedSettings)
    expect(store.dirtyState).toBeNull()
    expect(store.phase).toBe('idle')
  })

  it('saveRoomOrder keeps modal edits but reverts the room order when saving fails', async () => {
    const serverSettings: Settings = {
      ...DEFAULT_SETTINGS,
      roomOrder: ['kitchen', 'bedroom'],
    }
    const apiErr: ApiError = { error: 'storage_error', message: 'disk full' }
    let rejectSave: (reason: ApiError) => void = () => {}
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: serverSettings })
    vi.mocked(putSettings).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectSave = reject
      }),
    )
    const store = useSettingsStore()
    await store.loadFromServer()

    const save = store.saveRoomOrder(['bedroom', 'kitchen'])
    await Promise.resolve()
    store.setLanguage('cs')
    rejectSave(apiErr)
    await expect(save).rejects.toEqual(apiErr)

    expect(store.serverState).toEqual(serverSettings)
    expect(store.dirtyState?.language).toBe('cs')
    expect(store.dirtyState?.roomOrder).toEqual(['kitchen', 'bedroom'])
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
  })

  it('saveAndReanalyze on PUT failure: phase=error, dirtyState preserved', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    const apiErr: ApiError = { error: 'storage_error', message: 'disk full' }
    vi.mocked(putSettings).mockRejectedValueOnce(apiErr)
    const store = useSettingsStore()
    await store.loadFromServer()
    store.setLanguage('cs')

    await expect(store.saveAndReanalyze()).rejects.toEqual(apiErr)
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
    // dirty preserved for retry
    expect(store.hasDirty).toBe(true)
    expect(store.effective.language).toBe('cs')
  })
})
