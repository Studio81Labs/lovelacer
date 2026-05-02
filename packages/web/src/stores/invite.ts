import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getInvite, postInvite } from '../api/client.js'
import type { ApiError } from '../api/types.js'

type Phase = 'idle' | 'loading' | 'submitting' | 'error'

/**
 * Invite-flow state for the closed-beta gate.
 *
 * `accepted: boolean | null` distinguishes:
 * - `null` — haven't checked yet (App is loading)
 * - `false` — checked, not accepted (modal renders)
 * - `true` — checked, accepted (modal hidden, app proceeds)
 */
export const useInviteStore = defineStore('invite', () => {
  const accepted = ref<boolean | null>(null)
  const phase = ref<Phase>('idle')
  const error = ref<ApiError | null>(null)

  /**
   * Whether the gate modal should be shown. Encapsulates the three-state
   * `accepted` logic so callers don't have to:
   * - `true` accepted → never show
   * - `false` not accepted → always show (submission keeps `accepted`
   *   pinned at `false`, so the gate stays mounted for free)
   * - `null` unknown → show on `error` (load failed; user needs a way in)
   *   AND on `submitting` (the user is mid-request from the error gate;
   *   unmounting would destroy the typed code in the component-local
   *   `code` ref and remount with an empty input on failure). `idle` and
   *   `loading` with null both stay hidden so the page doesn't flash a
   *   modal during the initial status check.
   */
  const shouldShowGate = computed<boolean>(() => {
    if (accepted.value === true) return false
    if (accepted.value === false) return true
    return phase.value === 'error' || phase.value === 'submitting'
  })

  async function loadStatus(): Promise<void> {
    phase.value = 'loading'
    error.value = null
    try {
      const result = await getInvite()
      accepted.value = result.accepted
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
    }
  }

  async function submit(code: string): Promise<void> {
    phase.value = 'submitting'
    error.value = null
    try {
      const result = await postInvite({ code })
      accepted.value = result.accepted
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
    }
  }

  return { accepted, phase, error, shouldShowGate, loadStatus, submit }
})
