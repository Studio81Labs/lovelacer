import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getSettings, putSettings } from '../api/client.js'
import type {
  ApiError,
  RoomDisplayOverride,
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
  let writePromise: Promise<void> = Promise.resolve()
  let serverStateRevision = 0

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
    if (settings.roomOverrides !== undefined) {
      next.roomOverrides = cloneRoomOverrides(settings.roomOverrides)
    }
    return next
  }

  function cloneRoomOverrides(
    roomOverrides: NonNullable<Settings['roomOverrides']>,
  ): NonNullable<Settings['roomOverrides']> {
    return Object.fromEntries(
      Object.entries(roomOverrides).map(([roomId, override]) => [roomId, { ...override }]),
    )
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

  function sanitizeRoomOverride(override: RoomDisplayOverride): RoomDisplayOverride | null {
    const next: RoomDisplayOverride = {}
    const name = override.name?.trim()
    const icon = override.icon?.trim()
    if (name) next.name = name
    if (icon) next.icon = icon
    if (override.showNameOnCard === false) next.showNameOnCard = false
    return Object.keys(next).length === 0 ? null : next
  }

  function withRoomOverride(
    settings: Settings | null,
    roomId: string,
    override: RoomDisplayOverride | null,
  ): Settings | null {
    if (settings === null) return null
    const next = cloneSettings(settings)
    const roomOverrides = cloneRoomOverrides(next.roomOverrides ?? {})
    if (override === null) {
      delete roomOverrides[roomId]
    } else {
      roomOverrides[roomId] = { ...override }
    }
    if (Object.keys(roomOverrides).length === 0) {
      delete next.roomOverrides
    } else {
      next.roomOverrides = roomOverrides
    }
    return next
  }

  function roomOverrideFor(settings: Settings | null, roomId: string): RoomDisplayOverride | null {
    if (settings === null) return null
    return settings.roomOverrides?.[roomId] ?? null
  }

  function roomOverrideEqual(
    a: RoomDisplayOverride | null,
    b: RoomDisplayOverride | null,
  ): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  function dirtyRoomOverrideStillMatches(roomId: string, snapshot: Settings | null): boolean {
    return roomOverrideEqual(
      roomOverrideFor(dirtyState.value, roomId),
      roomOverrideFor(snapshot, roomId),
    )
  }

  function replaceDirtyRoomOrder(roomOrder: string[] | undefined): void {
    dirtyState.value = withRoomOrder(dirtyState.value, roomOrder)
  }

  function reconcileDirtyWithServer(): void {
    if (serverState.value !== null && settingsEqual(dirtyState.value, serverState.value)) {
      dirtyState.value = null
    }
  }

  function replaceServerState(settings: Settings): void {
    serverState.value = settings
    serverStateRevision += 1
  }

  async function enqueueSettingsWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = writePromise.then(task, task)
    writePromise = run.then(
      () => undefined,
      () => undefined,
    )
    return run
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

  function setRoomOverride(roomId: string, override: RoomDisplayOverride): void {
    dirtyState.value = withRoomOverride(cloneEffective(), roomId, sanitizeRoomOverride(override))
    reconcileDirtyWithServer()
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
    const loadStartedAtRevision = serverStateRevision
    if (phase.value !== 'saving') {
      phase.value = 'loading'
    }
    error.value = null
    loadPromise = (async () => {
      try {
        const result = await getSettings()
        if (serverStateRevision === loadStartedAtRevision) {
          replaceServerState(result.settings)
          reconcileDirtyWithServer()
        }
        if (phase.value === 'loading') {
          phase.value = 'idle'
        }
      } catch (err) {
        if (serverStateRevision === loadStartedAtRevision) {
          error.value = err as ApiError
          if (phase.value === 'loading') {
            phase.value = 'error'
          }
        }
      } finally {
        loadPromise = null
      }
    })()
    return loadPromise
  }

  async function saveOnly(): Promise<void> {
    return enqueueSettingsWrite(async () => {
      const savedDirty = snapshotDirtyState()
      if (savedDirty === null) return
      phase.value = 'saving'
      error.value = null
      try {
        const result = await putSettings({ settings: savedDirty })
        replaceServerState(result.settings)
        if (settingsEqual(dirtyState.value, savedDirty)) {
          dirtyState.value = null
        } else {
          reconcileDirtyWithServer()
        }
        phase.value = 'idle'
      } catch (err) {
        error.value = err as ApiError
        phase.value = 'error'
        // Re-throw so the modal can keep itself open and the test can assert.
        throw err
      }
    })
  }

  async function saveRoomOrder(roomIds: string[]): Promise<void> {
    if (serverState.value === null) return

    const previousDirty = snapshotDirtyState()
    const previousRoomOrder = previousDirty?.roomOrder ?? serverState.value.roomOrder
    setRoomOrder(roomIds)
    const optimisticDirty = snapshotDirtyState()

    return enqueueSettingsWrite(async () => {
      if (serverState.value === null) return
      phase.value = 'saving'
      error.value = null
      const next = cloneSettings(serverState.value)
      next.roomOrder = [...roomIds]

      try {
        const result = await putSettings({ settings: next })
        replaceServerState(result.settings)
        if (settingsEqual(dirtyState.value, optimisticDirty)) {
          dirtyState.value = withRoomOrder(previousDirty, result.settings.roomOrder)
        } else {
          replaceDirtyRoomOrder(result.settings.roomOrder)
        }
        reconcileDirtyWithServer()
        phase.value = 'idle'
      } catch (err) {
        if (settingsEqual(dirtyState.value, optimisticDirty)) {
          dirtyState.value = withRoomOrder(previousDirty, previousRoomOrder)
        } else {
          replaceDirtyRoomOrder(previousRoomOrder)
        }
        reconcileDirtyWithServer()
        error.value = err as ApiError
        phase.value = 'error'
        throw err
      }
    })
  }

  async function saveRoomOverride(roomId: string, override: RoomDisplayOverride): Promise<void> {
    if (serverState.value === null) return

    const sanitized = sanitizeRoomOverride(override)
    const previousDirty = snapshotDirtyState()
    const previousOverride =
      previousDirty === null
        ? roomOverrideFor(serverState.value, roomId)
        : roomOverrideFor(previousDirty, roomId)
    setRoomOverride(roomId, override)
    const optimisticDirty = snapshotDirtyState()

    return enqueueSettingsWrite(async () => {
      if (serverState.value === null) return
      phase.value = 'saving'
      error.value = null
      const next = withRoomOverride(serverState.value, roomId, sanitized)
      if (next === null) return

      try {
        const result = await putSettings({ settings: next })
        replaceServerState(result.settings)
        const savedOverride = result.settings.roomOverrides?.[roomId] ?? null
        if (settingsEqual(dirtyState.value, optimisticDirty)) {
          dirtyState.value = withRoomOverride(previousDirty, roomId, savedOverride)
        } else if (dirtyRoomOverrideStillMatches(roomId, optimisticDirty)) {
          dirtyState.value = withRoomOverride(dirtyState.value, roomId, savedOverride)
        }
        reconcileDirtyWithServer()
        phase.value = 'idle'
      } catch (err) {
        if (settingsEqual(dirtyState.value, optimisticDirty)) {
          dirtyState.value = withRoomOverride(previousDirty, roomId, previousOverride)
        } else if (dirtyRoomOverrideStillMatches(roomId, optimisticDirty)) {
          dirtyState.value = withRoomOverride(dirtyState.value, roomId, previousOverride)
        }
        reconcileDirtyWithServer()
        error.value = err as ApiError
        phase.value = 'error'
        throw err
      }
    })
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
    setRoomOverride,
    snapshotDirtyState,
    restoreDirtyState,
    discardChanges,
    loadFromServer,
    saveOnly,
    saveRoomOrder,
    saveRoomOverride,
    saveAndReanalyze,
  }
})
