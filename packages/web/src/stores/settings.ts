import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getSettings, putSettings } from '../api/client.js'
import type {
  ApiError,
  Settings,
  SettingsCardPack,
  SettingsLanguage,
  SettingsSections,
  UiLanguage,
} from '../api/types.js'
import { DEFAULT_SETTINGS } from '../api/types.js'
import { useAnalyzeStore } from './analyze.js'

type Phase = 'idle' | 'loading' | 'saving' | 'error'

/**
 * P2-6 — Pinia layer for the settings modal.
 *
 * `serverState` is the last-known server-saved settings (null until
 * `loadFromServer()` resolves). `dirtyState` holds pending edits — null
 * means "no edits" so the effective value falls back to serverState (or
 * DEFAULT_SETTINGS before the first load).
 *
 * Mirrors `useOverridesStore`'s staging pattern: edits stage locally,
 * then `saveAndReanalyze()` PUTs them and triggers analyze.analyze()
 * so the user sees the effect on the next tick.
 *
 * Errors leave dirtyState intact for retry and re-throw so the modal
 * can keep itself open.
 */
export const useSettingsStore = defineStore('settings', () => {
  const phase = ref<Phase>('idle')
  const error = ref<ApiError | null>(null)

  const serverState = ref<Settings | null>(null)
  const dirtyState = ref<Settings | null>(null)
  let loadPromise: Promise<void> | null = null

  const hasDirty = computed(() => dirtyState.value !== null)
  const effective = computed<Settings>(
    () => dirtyState.value ?? serverState.value ?? DEFAULT_SETTINGS,
  )

  function cloneSettings(settings: Settings): Settings {
    const next: Settings = {
      language: settings.language,
      cardPack: settings.cardPack,
      sections: { ...settings.sections },
    }
    // uiLanguage is optional; only carry it forward when explicitly set.
    if (settings.uiLanguage !== undefined) {
      next.uiLanguage = settings.uiLanguage
    }
    if (settings.roomOrder !== undefined) {
      next.roomOrder = [...settings.roomOrder]
    }
    return next
  }

  function settingsEqual(a: Settings | null, b: Settings | null): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  function withRoomOrder(
    settings: Settings | null,
    roomOrder: string[] | undefined,
  ): Settings | null {
    if (settings === null) return null
    const next = cloneSettings(settings)
    if (roomOrder === undefined) {
      delete next.roomOrder
    } else {
      next.roomOrder = [...roomOrder]
    }
    return next
  }

  function replaceDirtyRoomOrder(roomOrder: string[] | undefined): void {
    dirtyState.value = withRoomOrder(dirtyState.value, roomOrder)
  }

  /** Returns a fresh deep-cloned copy of the effective settings. */
  function cloneEffective(): Settings {
    return cloneSettings(effective.value)
  }

  function snapshotDirtyState(): Settings | null {
    return dirtyState.value === null ? null : cloneSettings(dirtyState.value)
  }

  function restoreDirtyState(snapshot: Settings | null): void {
    dirtyState.value = snapshot === null ? null : cloneSettings(snapshot)
  }

  function setLanguage(lang: SettingsLanguage): void {
    const next = cloneEffective()
    next.language = lang
    dirtyState.value = next
  }

  function setCardPack(pack: SettingsCardPack): void {
    const next = cloneEffective()
    next.cardPack = pack
    dirtyState.value = next
  }

  function setSection(name: keyof SettingsSections, value: boolean): void {
    const next = cloneEffective()
    next.sections = { ...next.sections, [name]: value }
    dirtyState.value = next
  }

  function setUiLanguage(lang: UiLanguage): void {
    const next = cloneEffective()
    next.uiLanguage = lang
    dirtyState.value = next
  }

  function setRoomOrder(roomIds: string[]): void {
    const next = cloneEffective()
    next.roomOrder = [...roomIds]
    dirtyState.value = next
  }

  function discardChanges(): void {
    // P2-9 — only clears the store's dirtyState. The active i18n locale
    // is reverted by SettingsModal's onDiscard handler, which captures a
    // pre-edit snapshot at component setup time. The store has no clean
    // session boundary; the modal does, so locale ownership lives there.
    dirtyState.value = null
    if (phase.value === 'error') {
      phase.value = 'idle'
      error.value = null
    }
  }

  async function loadFromServer(): Promise<void> {
    if (loadPromise !== null) return loadPromise
    phase.value = 'loading'
    error.value = null
    loadPromise = (async () => {
      try {
        const result = await getSettings()
        serverState.value = result.settings
        dirtyState.value = null
        phase.value = 'idle'
      } catch (err) {
        error.value = err as ApiError
        phase.value = 'error'
      } finally {
        loadPromise = null
      }
    })()
    return loadPromise
  }

  async function saveOnly(): Promise<void> {
    if (dirtyState.value === null) return
    phase.value = 'saving'
    error.value = null
    const next = dirtyState.value
    try {
      const result = await putSettings({ settings: next })
      serverState.value = result.settings
      dirtyState.value = null
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
      // Re-throw so the modal can keep itself open and the test can assert.
      throw err
    }
  }

  async function saveRoomOrder(roomIds: string[]): Promise<void> {
    if (serverState.value === null) return

    const previousDirty = snapshotDirtyState()
    const previousRoomOrder = previousDirty?.roomOrder ?? serverState.value.roomOrder
    setRoomOrder(roomIds)
    const optimisticDirty = snapshotDirtyState()

    phase.value = 'saving'
    error.value = null
    const next = cloneSettings(serverState.value)
    next.roomOrder = [...roomIds]

    try {
      const result = await putSettings({ settings: next })
      serverState.value = result.settings
      if (settingsEqual(dirtyState.value, optimisticDirty)) {
        dirtyState.value = withRoomOrder(previousDirty, result.settings.roomOrder)
      } else {
        replaceDirtyRoomOrder(result.settings.roomOrder)
      }
      phase.value = 'idle'
    } catch (err) {
      if (settingsEqual(dirtyState.value, optimisticDirty)) {
        dirtyState.value = withRoomOrder(previousDirty, previousRoomOrder)
      } else {
        replaceDirtyRoomOrder(previousRoomOrder)
      }
      error.value = err as ApiError
      phase.value = 'error'
      throw err
    }
  }

  async function saveAndReanalyze(): Promise<void> {
    await saveOnly()
    // Trigger a fresh analyze so the dashboard preview reflects the new
    // settings. Runs OUTSIDE the save try/catch — a failed re-analyze is
    // the analyze store's concern (surfaced via the existing error UI in
    // App.vue), not the settings store's. The save already succeeded.
    const analyze = useAnalyzeStore()
    await analyze.analyze()
  }

  return {
    phase,
    error,
    serverState,
    dirtyState,
    hasDirty,
    effective,
    setLanguage,
    setCardPack,
    setSection,
    setUiLanguage,
    setRoomOrder,
    snapshotDirtyState,
    restoreDirtyState,
    discardChanges,
    loadFromServer,
    saveOnly,
    saveRoomOrder,
    saveAndReanalyze,
  }
})
