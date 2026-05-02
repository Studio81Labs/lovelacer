import { defineStore } from 'pinia'
import { ref } from 'vue'
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

  return { accepted, phase, error, loadStatus, submit }
})
