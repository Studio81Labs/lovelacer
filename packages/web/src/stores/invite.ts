import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getInvite, postInvite } from '../api/client.js'
import type { ApiError } from '../api/types.js'

type Phase = 'idle' | 'loading' | 'submitting' | 'error'

/**
 * Compatibility state for the retired closed-beta invite gate.
 *
 * The app is public now, so `accepted` starts and stays true. The GET/POST
 * calls remain during the transition so older servers and browser bundles
 * continue to agree on the response shape, but the modal no longer gates
 * access.
 */
export const useInviteStore = defineStore('invite', () => {
  const accepted = ref<boolean | null>(true)
  const phase = ref<Phase>('idle')
  const error = ref<ApiError | null>(null)

  const shouldShowGate = computed<boolean>(() => false)

  async function loadStatus(): Promise<void> {
    phase.value = 'loading'
    error.value = null
    try {
      await getInvite()
      accepted.value = true
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      accepted.value = true
      phase.value = 'error'
    }
  }

  async function submit(code: string): Promise<void> {
    phase.value = 'submitting'
    error.value = null
    try {
      await postInvite({ code })
      accepted.value = true
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      accepted.value = true
      phase.value = 'error'
    }
  }

  return { accepted, phase, error, shouldShowGate, loadStatus, submit }
})
