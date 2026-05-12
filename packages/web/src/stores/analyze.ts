import { defineStore } from 'pinia'
import { ref } from 'vue'
import { postPreview } from '../api/client.js'
import type { ApiError, PreviewOutput } from '../api/types.js'

type Phase = 'idle' | 'loading' | 'ready' | 'error'

export const useAnalyzeStore = defineStore('analyze', () => {
  const phase = ref<Phase>('idle')
  const preview = ref<PreviewOutput | null>(null)
  const error = ref<ApiError | null>(null)

  async function analyze() {
    phase.value = 'loading'
    error.value = null
    try {
      preview.value = await postPreview()
      phase.value = 'ready'
    } catch (err) {
      error.value = err as ApiError
      preview.value = null
      phase.value = 'error'
    }
  }

  async function refreshPreview() {
    error.value = null
    try {
      preview.value = await postPreview()
      phase.value = 'ready'
    } catch (err) {
      error.value = err as ApiError
      if (preview.value === null) {
        phase.value = 'error'
      }
    }
  }

  function reset() {
    phase.value = 'idle'
    preview.value = null
    error.value = null
  }

  return { phase, preview, error, analyze, refreshPreview, reset }
})
