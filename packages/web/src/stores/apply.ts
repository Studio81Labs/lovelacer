import { defineStore } from 'pinia'
import { ref } from 'vue'
import { postApply, type PostApplyInput } from '../api/client.js'
import type { ApiError, ApplyResult, LovelaceConfig, SnapshotAssignment } from '../api/types.js'

type Phase = 'idle' | 'applying' | 'success' | 'error'

export interface ApplyInput {
  config: LovelaceConfig
  snapshot?: {
    assignments: SnapshotAssignment[]
    config: LovelaceConfig
  }
}

export const useApplyStore = defineStore('apply', () => {
  const phase = ref<Phase>('idle')
  const result = ref<ApplyResult | null>(null)
  const error = ref<ApiError | null>(null)
  let requestVersion = 0

  async function apply(input: ApplyInput) {
    const version = ++requestVersion
    phase.value = 'applying'
    error.value = null
    try {
      const fetchInput: PostApplyInput = { config: input.config }
      if (input.snapshot !== undefined) fetchInput.snapshot = input.snapshot
      const applyResult = await postApply(fetchInput)
      if (version !== requestVersion) return
      result.value = applyResult
      phase.value = 'success'
    } catch (err) {
      if (version !== requestVersion) return
      error.value = err as ApiError
      result.value = null
      phase.value = 'error'
    }
  }

  function reset() {
    requestVersion += 1
    phase.value = 'idle'
    result.value = null
    error.value = null
  }

  return { phase, result, error, apply, reset }
})
