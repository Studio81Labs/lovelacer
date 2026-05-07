import { setActivePinia, createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiError, Settings } from '../../api/types.js'
import { DEFAULT_SETTINGS } from '../../api/types.js'

vi.mock('../../api/client.js', () => ({
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
