import { setActivePinia, createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import type { ApiError, Settings } from '../../api/types.js'
import { DEFAULT_SETTINGS } from '../../api/types.js'
import { createTestI18n } from '../test-utils.js'

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
import { useI18nStore } from '../../stores/i18n.js'

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

/**
 * P2-9 — `useSettingsStore.discardChanges()` calls `useI18nStore()` to
 * revert the active locale, which in turn calls `vue-i18n`'s `useI18n()`
 * during store setup. That requires an active i18n instance. Mount a
 * tiny harness component with both Pinia and i18n plugins so the
 * Pinia stores resolve in a real Vue setup context, mirroring what
 * App.vue does at runtime.
 */
function withI18nContext<T>(fn: () => T): T {
  let result!: T
  const Harness = defineComponent({
    setup() {
      result = fn()
      return () => h('div')
    },
  })
  mount(Harness, { global: { plugins: [createTestI18n()] } })
  return result
}

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getSettings).mockReset()
    vi.mocked(putSettings).mockReset()
    // P2-9 — `useI18nStore.locale = X` mirrors X to localStorage. Clear
    // it between tests so the optional-uiLanguage fallback path
    // (`detectInitialLocale()`) doesn't read a value from a previous
    // test and produce false-positive assertions.
    localStorage.removeItem('lovelacer.uiLocale')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.removeItem('lovelacer.uiLocale')
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

  it('discardChanges clears dirtyState', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
    const { store } = withI18nContext(() => ({
      store: useSettingsStore(),
      i18n: useI18nStore(),
    }))
    await store.loadFromServer()
    store.setLanguage('en')
    expect(store.hasDirty).toBe(true)

    store.discardChanges()
    expect(store.hasDirty).toBe(false)
    expect(store.effective).toEqual(DEFAULT_SETTINGS)
  })

  it('discardChanges reverts useI18nStore.locale to serverState.uiLanguage (P2-9)', async () => {
    // Spec §5: clicking Cancel must revert BOTH the dirtyState AND the
    // active locale. Without the locale revert, picking a language and
    // discarding would leave the locale + localStorage holding the
    // abandoned choice — next reload would silently restore it.
    vi.mocked(getSettings).mockResolvedValueOnce({
      settings: { ...DEFAULT_SETTINGS, uiLanguage: 'en' },
    })
    const { store, i18n } = withI18nContext(() => ({
      store: useSettingsStore(),
      i18n: useI18nStore(),
    }))
    await store.loadFromServer()

    // Simulate the SettingsModal flow: setUiLanguage stages the dirty
    // change and `onUiLanguageChange` mirrors to the active locale for
    // instant feedback (live re-render of the modal in the chosen
    // language).
    store.setUiLanguage('de')
    i18n.locale = 'de'
    expect(i18n.locale).toBe('de')

    // User clicks Cancel.
    store.discardChanges()

    expect(store.hasDirty).toBe(false)
    expect(i18n.locale).toBe('en')
  })

  it('discardChanges reverts useI18nStore.locale to detectInitialLocale when serverState is null (P2-9)', async () => {
    // Edge case: Cancel before loadFromServer ever resolved (serverState
    // still null). Falls back to `detectInitialLocale()` so the user
    // lands on the locale they would have seen on first paint
    // (browser-detected → 'en' fallback) rather than a hardcoded value
    // that ignores their browser language.
    const { store, i18n } = withI18nContext(() => ({
      store: useSettingsStore(),
      i18n: useI18nStore(),
    }))
    store.setUiLanguage('cs')
    i18n.locale = 'cs'

    // Clear the localStorage write from `i18n.locale = 'cs'` so the
    // fallback path exercises the navigator-language branch, not the
    // localStorage branch. jsdom's `navigator.language` defaults to
    // 'en-US' so detectInitialLocale → 'en'.
    localStorage.removeItem('lovelacer.uiLocale')

    store.discardChanges()
    expect(i18n.locale).toBe('en')
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
