import { defineStore } from 'pinia'
import { ref } from 'vue'
import { postDismissSuggestion } from '../api/client.js'
import type { ApiError, SuggestionType } from '../api/types.js'

type Phase = 'idle' | 'dismissing' | 'error'

/**
 * P2-5 — Pinia layer for the Suggestions panel. Holds in-flight POST
 * state + an optimistic-dismissed key set. The server's `suggestions[]`
 * is the source of truth on every preview; this store layers on
 * "things the user just clicked Dismiss on" so the UI doesn't lag a
 * full re-analyze cycle.
 *
 * Reset on every preview so the optimistic set doesn't drift past the
 * authoritative server response. App.vue wires the watch.
 */
export const useSuggestionsStore = defineStore('suggestions', () => {
  const phase = ref<Phase>('idle')
  const error = ref<ApiError | null>(null)
  const optimisticallyDismissed = ref<Set<string>>(new Set())

  function isDismissed(entityId: string, type: SuggestionType): boolean {
    return optimisticallyDismissed.value.has(`${entityId}|${type}`)
  }

  async function dismiss(entityId: string, type: SuggestionType): Promise<void> {
    const key = `${entityId}|${type}`
    phase.value = 'dismissing'
    error.value = null
    // Add the key before awaiting so the card disappears on click — this is
    // the optimistic part the variable name promises. Replace the Set
    // (don't mutate in place) so Vue's reactivity picks up the change.
    const optimistic = new Set(optimisticallyDismissed.value)
    optimistic.add(key)
    optimisticallyDismissed.value = optimistic
    try {
      await postDismissSuggestion({ entityId, suggestionType: type })
      phase.value = 'idle'
    } catch (err) {
      // Roll back the optimistic add so the card re-appears for retry.
      const rolled = new Set(optimisticallyDismissed.value)
      rolled.delete(key)
      optimisticallyDismissed.value = rolled
      error.value = err as ApiError
      phase.value = 'error'
      throw err
    }
  }

  function reset(): void {
    optimisticallyDismissed.value = new Set()
    phase.value = 'idle'
    error.value = null
  }

  return { phase, error, optimisticallyDismissed, isDismissed, dismiss, reset }
})
