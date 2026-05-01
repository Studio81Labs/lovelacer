import { defineStore } from 'pinia'
import { ref } from 'vue'
import { postApply } from '../api/client.js'
import type { ApiError, ApplyResult, LovelaceConfig } from '../api/types.js'

type Phase = 'idle' | 'applying' | 'success' | 'error'

export const useApplyStore = defineStore('apply', () => {
  const phase = ref<Phase>('idle')
  const result = ref<ApplyResult | null>(null)
  const error = ref<ApiError | null>(null)

  async function apply(config: LovelaceConfig) {
    phase.value = 'applying'
    error.value = null
    try {
      result.value = await postApply({ config })
      phase.value = 'success'
    } catch (err) {
      error.value = err as ApiError
      result.value = null
      phase.value = 'error'
    }
  }

  function reset() {
    phase.value = 'idle'
    result.value = null
    error.value = null
  }

  return { phase, result, error, apply, reset }
})
