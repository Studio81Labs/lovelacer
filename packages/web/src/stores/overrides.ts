import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getOverrides, putOverrides } from '../api/client.js'
import type { ApiError, Override } from '../api/types.js'
import { useAnalyzeStore } from './analyze.js'

type Phase = 'idle' | 'loading' | 'saving' | 'error'

/**
 * Per-entity override edit state.
 *
 * Two parallel maps:
 *   - serverState: last-known server-saved overrides, populated by
 *     loadFromServer() and replaced wholesale by saveAndReanalyze().
 *   - dirtyState: pending edits. Map value of `null` means "delete this
 *     override on save" (distinguishes opt-out from "user hasn't touched
 *     it" where the key is absent).
 *
 * effective(entityId) is the single source of truth for the UI.
 */
export const useOverridesStore = defineStore('overrides', () => {
  const phase = ref<Phase>('idle')
  const error = ref<ApiError | null>(null)

  const serverState = ref(new Map<string, Override>())
  const dirtyState = ref(new Map<string, Override | null>())

  const hasDirty = computed(() => dirtyState.value.size > 0)
  const dirtyCount = computed(() => dirtyState.value.size)

  function effective(entityId: string): Override | null {
    if (dirtyState.value.has(entityId)) {
      return dirtyState.value.get(entityId) ?? null
    }
    return serverState.value.get(entityId) ?? null
  }

  function setRoomId(entityId: string, roomId: string | null): void {
    const current = effective(entityId)
    const next: Override = { entityId }
    if (roomId !== null) next.roomId = roomId
    if (current?.hidden === true) next.hidden = true
    setDirtyOrCollapse(entityId, next)
  }

  function setHidden(entityId: string, hidden: boolean): void {
    const current = effective(entityId)
    const next: Override = { entityId }
    if (current?.roomId !== undefined) next.roomId = current.roomId
    if (hidden) next.hidden = true
    setDirtyOrCollapse(entityId, next)
  }

  /**
   * Internal: lift `next` to dirtyState, but collapse to "no edit" if
   * the result equals the server value, or to pending-delete (`null`)
   * if the override is now meaningless and a server entry exists.
   */
  function setDirtyOrCollapse(entityId: string, next: Override): void {
    const meaningful = next.roomId !== undefined || next.hidden === true
    const server = serverState.value.get(entityId) ?? null

    if (!meaningful) {
      // Override no longer says anything. If server has it, schedule a
      // delete; if server doesn't have it, we're back to no-state.
      if (server !== null) {
        dirtyState.value.set(entityId, null)
      } else {
        dirtyState.value.delete(entityId)
      }
      return
    }

    if (overridesEqual(next, server)) {
      dirtyState.value.delete(entityId) // back to server value
      return
    }
    dirtyState.value.set(entityId, next)
  }

  function discardChanges(): void {
    dirtyState.value.clear()
  }

  async function loadFromServer(): Promise<void> {
    phase.value = 'loading'
    error.value = null
    try {
      const result = await getOverrides()
      const next = new Map<string, Override>()
      for (const o of result.overrides) {
        next.set(o.entityId, o)
      }
      serverState.value = next
      dirtyState.value.clear()
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
    }
  }

  async function saveAndReanalyze(): Promise<void> {
    phase.value = 'saving'
    error.value = null

    // Compose the merged list: server entries the user didn't touch +
    // dirty entries that aren't pending deletes.
    const merged: Override[] = []
    for (const [entityId, server] of serverState.value) {
      if (!dirtyState.value.has(entityId)) {
        merged.push(server)
      }
    }
    for (const [, dirty] of dirtyState.value) {
      if (dirty !== null) {
        merged.push(dirty)
      }
      // null entries skipped — that's a pending delete
    }

    try {
      const result = await putOverrides({ overrides: merged })
      const next = new Map<string, Override>()
      for (const o of result.overrides) {
        next.set(o.entityId, o)
      }
      serverState.value = next
      dirtyState.value.clear()
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
      return
    }

    // Refresh the analyzer preview so the UI reflects the new overrides.
    // This runs outside the save try/catch — a failed re-analyze is the
    // analyze store's concern (surfaced via the existing error UI in App.vue),
    // not the overrides store's. The save already succeeded.
    const analyze = useAnalyzeStore()
    await analyze.analyze()
  }

  return {
    phase,
    error,
    hasDirty,
    dirtyCount,
    effective,
    setRoomId,
    setHidden,
    discardChanges,
    loadFromServer,
    saveAndReanalyze,
  }
})

function overridesEqual(a: Override | null, b: Override | null): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return a.entityId === b.entityId && a.roomId === b.roomId && a.hidden === b.hidden
}
