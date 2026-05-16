import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getLatestAnalysis, postPreview } from '../api/client.js'
import type { ApiError, PreviewOutput } from '../api/types.js'
import { useApplyStore } from './apply.js'

type Phase = 'idle' | 'loading' | 'ready' | 'error'
type RequestKind = 'restore' | 'analyze' | null
type AnalysisStatus = 'empty' | 'loading' | 'loaded' | 'analyzing' | 'applying' | 'error'

export const useAnalyzeStore = defineStore('analyze', () => {
  const phase = ref<Phase>('idle')
  const preview = ref<PreviewOutput | null>(null)
  const error = ref<ApiError | null>(null)
  const isRefreshingPreview = ref(false)
  const analyzedAt = ref<number | null>(null)
  const requestKind = ref<RequestKind>(null)
  const apply = useApplyStore()

  const status = computed<AnalysisStatus>(() => {
    if (apply.phase === 'applying') return 'applying'
    if (phase.value === 'error') return 'error'
    if (phase.value === 'ready') return 'loaded'
    if (phase.value === 'loading') return requestKind.value === 'restore' ? 'loading' : 'analyzing'
    return 'empty'
  })

  function setFreshPreview(next: PreviewOutput): void {
    preview.value = next
    analyzedAt.value = Math.floor(Date.now() / 1000)
    apply.reset()
  }

  async function analyze() {
    phase.value = 'loading'
    requestKind.value = 'analyze'
    error.value = null
    try {
      setFreshPreview(await postPreview())
      phase.value = 'ready'
    } catch (err) {
      error.value = err as ApiError
      preview.value = null
      analyzedAt.value = null
      phase.value = 'error'
    } finally {
      requestKind.value = null
    }
  }

  async function restoreLatest() {
    phase.value = 'loading'
    requestKind.value = 'restore'
    error.value = null
    try {
      const latest = await getLatestAnalysis()
      if (latest === null) {
        preview.value = null
        analyzedAt.value = null
        phase.value = 'idle'
        return
      }
      preview.value = latest.analysis
      analyzedAt.value = latest.analyzedAt
      phase.value = 'ready'
    } catch (err) {
      error.value = err as ApiError
      preview.value = null
      analyzedAt.value = null
      phase.value = 'error'
    } finally {
      requestKind.value = null
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
    analyzedAt.value = null
    requestKind.value = null
  }

  return {
    phase,
    status,
    preview,
    error,
    isRefreshingPreview,
    analyzedAt,
    analyze,
    restoreLatest,
    refreshPreview,
    reset,
  }
})
