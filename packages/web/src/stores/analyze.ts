import { defineStore } from 'pinia'
import { ref } from 'vue'
import { postPreview } from '../api/client.js'
import type { ApiError, PreviewOutput } from '../api/types.js'
import { useApplyStore } from './apply.js'

type Phase = 'idle' | 'loading' | 'ready' | 'error'

export const useAnalyzeStore = defineStore('analyze', () => {
  const phase = ref<Phase>('idle')
  const preview = ref<PreviewOutput | null>(null)
  const error = ref<ApiError | null>(null)
  const isRefreshingPreview = ref(false)

  function setFreshPreview(next: PreviewOutput): void {
    preview.value = next
    useApplyStore().reset()
  }

  async function analyze() {
    phase.value = 'loading'
    error.value = null
    try {
      setFreshPreview(await postPreview())
      phase.value = 'ready'
    } catch (err) {
      error.value = err as ApiError
      preview.value = null
      phase.value = 'error'
    }
  }

  async function refreshPreview() {
    error.value = null
    isRefreshingPreview.value = true
    try {
      setFreshPreview(await postPreview())
      phase.value = 'ready'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
    } finally {
      isRefreshingPreview.value = false
    }
  }

  function reset() {
    phase.value = 'idle'
    preview.value = null
    error.value = null
    isRefreshingPreview.value = false
  }

  return { phase, preview, error, isRefreshingPreview, analyze, refreshPreview, reset }
})
