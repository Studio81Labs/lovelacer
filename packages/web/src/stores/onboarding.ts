import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getOnboarding, postOnboardingComplete } from '../api/client.js'
import type { ApiError } from '../api/types.js'

type Phase = 'idle' | 'loading' | 'completing' | 'error'

/**
 * P2-7 — Pinia layer for the onboarding wizard.
 *
 * `completedAt: undefined | null | number` — three-state to avoid a
 * first-paint flash:
 *   - `undefined` (initial, haven't loaded yet) → don't show wizard
 *   - `null` (loaded, not completed) → show wizard
 *   - `number` (completed timestamp) → never show wizard again
 *
 * `shouldShowWizard` is strictly true only when `completedAt === null`
 * (we know we've loaded AND know there's no completion). Mirror of
 * `useInviteStore.shouldShowGate`'s pattern.
 *
 * `complete()` re-throws on error so the wizard's apply-success watch
 * can decide what to do (current behavior: silently advance to DoneStep
 * because the dashboard is already live in HA, retry on next visit).
 */
export const useOnboardingStore = defineStore('onboarding', () => {
  const phase = ref<Phase>('idle')
  const error = ref<ApiError | null>(null)
  const completedAt = ref<number | null | undefined>(undefined)

  const shouldShowWizard = computed<boolean>(() => completedAt.value === null)

  async function loadStatus(): Promise<void> {
    phase.value = 'loading'
    error.value = null
    try {
      const result = await getOnboarding()
      completedAt.value = result.completedAt
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
    }
  }

  async function complete(): Promise<void> {
    phase.value = 'completing'
    error.value = null
    try {
      const result = await postOnboardingComplete()
      completedAt.value = result.completedAt
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
      throw err
    }
  }

  return { phase, error, completedAt, shouldShowWizard, loadStatus, complete }
})
