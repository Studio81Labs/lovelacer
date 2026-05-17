import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getInvite, postInvite } from '../api/client.js'
import type { ApiError } from '../api/types.js'

type Phase = 'idle' | 'loading' | 'submitting' | 'error'

/**
 * Compatibility state for the retired closed-beta invite gate.
 *
 * The app is public now, so `accepted` starts true and the current server
 * reports true. The GET/POST calls remain during the transition so older
 * servers and browser bundles continue to agree on the response shape; if a
 * legacy server reports false, the modal still appears so the user can submit
 * the invite code required by that server.
 */
export const useInviteStore = defineStore('invite', () => {
  const accepted = ref<boolean | null>(true)
  const phase = ref<Phase>('idle')
  const error = ref<ApiError | null>(null)

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
