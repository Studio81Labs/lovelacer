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
import { detectInitialLocale } from '../i18n/locale-detect.js'
import { useAnalyzeStore } from './analyze.js'
import { useI18nStore } from './i18n.js'

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

  const hasDirty = computed(() => dirtyState.value !== null)
  const effective = computed<Settings>(
    () => dirtyState.value ?? serverState.value ?? DEFAULT_SETTINGS,
  )

  /** Returns a fresh deep-cloned copy of the effective settings. */
  function cloneEffective(): Settings {
    const e = effective.value
    const next: Settings = {
      language: e.language,
      cardPack: e.cardPack,
      sections: { ...e.sections },
    }
    // uiLanguage is optional; only carry it forward when explicitly set.
    if (e.uiLanguage !== undefined) {
      next.uiLanguage = e.uiLanguage
    }
    return next
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

  function discardChanges(): void {
    dirtyState.value = null
    if (phase.value === 'error') {
      phase.value = 'idle'
      error.value = null
    }
    // P2-9 — revert the active UI locale to the server-side authoritative
    // value. SettingsModal mirrors uiLanguage edits to `useI18nStore.locale`
    // (and localStorage) on every change so the modal re-renders in the
    // chosen language for instant feedback. Without this revert, clicking
    // Cancel would clear `dirtyState` but leave the picked locale active in
    // the UI + localStorage — next reload would silently restore the
    // "discarded" choice. Resolve i18nStore at action-call time (Pinia's
    // recommended pattern for cross-store access) rather than module init.
    //
    // When the server has no explicit uiLanguage (fresh install / pre-P2-9
    // legacy row), fall back to `detectInitialLocale()` so the user lands
    // on whichever locale they would have seen on first paint rather than
    // a hardcoded 'en'.
    const i18nStore = useI18nStore()
    i18nStore.locale = serverState.value?.uiLanguage ?? detectInitialLocale()
  }

  async function loadFromServer(): Promise<void> {
    phase.value = 'loading'
    error.value = null
    try {
      const result = await getSettings()
      serverState.value = result.settings
      dirtyState.value = null
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
    }
  }

  async function saveAndReanalyze(): Promise<void> {
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
    discardChanges,
    loadFromServer,
    saveAndReanalyze,
  }
})
