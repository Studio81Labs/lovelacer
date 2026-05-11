<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useApplyStore } from '../stores/apply.js'
import { useOnboardingStore } from '../stores/onboarding.js'
import { useSettingsStore } from '../stores/settings.js'
import WelcomeStep from './onboarding/WelcomeStep.vue'
import PreviewStep from './onboarding/PreviewStep.vue'
import DoneStep from './onboarding/DoneStep.vue'
import ProgressDots from './onboarding/ProgressDots.vue'

type Step = 'welcome' | 'preview' | 'done'

const emit = defineEmits<{ close: [] }>()

const currentStep = ref<Step>('welcome')

const onboarding = useOnboardingStore()
const settings = useSettingsStore()
const analyze = useAnalyzeStore()
const apply = useApplyStore()

// On apply success, transition to Done step and persist completion in
// the background. The wizard stays mounted (App.vue tracks its own
// open state) until the user clicks "Continue to Lovelacer" or Skip.
watch(
  () => apply.phase,
  (phase) => {
    if (phase === 'success' && currentStep.value === 'preview') {
      currentStep.value = 'done'
      // Fire-and-forget — persistence happens in the background while
      // the user reads the DoneStep. If complete() fails, the next visit
      // will re-show the wizard, but the dashboard is already live in HA
      // so the user can just skip.
      void onboarding.complete().catch(() => {
        // Silent — dashboard is live; retry on next visit.
      })
    }
  },
)

/**
 * Persist the language pick (if dirty) and kick off analysis. Wraps
 * `saveAndReanalyze` in try/catch because it intentionally re-throws on
 * PUT failure for the settings modal — but in the onboarding wizard a
 * network error must not silently freeze the flow. On failure we still
 * trigger analyze.analyze so the wizard moves forward; the dirty
 * language pick stays in `dirtyState` and the user can retry via the
 * settings modal later.
 *
 * `saveAndReanalyze` early-returns when nothing is dirty, which would
 * skip analysis entirely (PreviewStep would mount with phase='idle' and
 * no template branch matches), so the non-dirty branch calls
 * analyze.analyze directly.
 */
async function persistAndAnalyze(): Promise<void> {
  if (settings.hasDirty) {
    try {
      await settings.saveAndReanalyze()
    } catch {
      // Save failed — fall back to analyze-only so the wizard still
      // progresses with stale (but valid) settings.
      void analyze.analyze()
    }
  } else {
    void analyze.analyze()
  }
}

async function onContinueFromWelcome(): Promise<void> {
  await persistAndAnalyze()
  currentStep.value = 'preview'
}

async function onSkip(): Promise<void> {
  await persistAndAnalyze()
  try {
    await onboarding.complete()
  } catch {
    // Silent — main view will retry on next loadStatus.
  }
  emit('close')
}

function onFinishFromDone(): void {
  emit('close')
}
</script>

<template>
  <div
    data-testid="onboarding-wizard"
    class="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-stone-50 p-8"
  >
    <div class="w-full max-w-2xl">
      <ProgressDots :current="currentStep" :steps="['welcome', 'preview', 'done']" />

      <WelcomeStep
        v-if="currentStep === 'welcome'"
        @continue="onContinueFromWelcome"
        @skip="onSkip"
      />
      <PreviewStep
        v-else-if="currentStep === 'preview'"
        @back="currentStep = 'welcome'"
        @skip="onSkip"
      />
      <DoneStep v-else @finish="onFinishFromDone" />
    </div>
  </div>
</template>
