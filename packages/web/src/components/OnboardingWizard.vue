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

const currentStep = ref<Step>('welcome')

const onboarding = useOnboardingStore()
const settings = useSettingsStore()
const analyze = useAnalyzeStore()
const apply = useApplyStore()

// On apply success, mark onboarding complete and advance to Done.
// We swallow errors from complete() — the dashboard is already live in
// HA, so the user sees the success state. Next visit's loadStatus
// retries via the GET endpoint.
watch(
  () => apply.phase,
  async (phase) => {
    if (phase === 'success' && currentStep.value === 'preview') {
      try {
        await onboarding.complete()
      } catch {
        // Silent — let the user reach DoneStep; retry happens on reload.
      }
      currentStep.value = 'done'
    }
  },
)

async function onContinueFromWelcome(): Promise<void> {
  await settings.saveAndReanalyze()
  currentStep.value = 'preview'
}

async function onSkip(): Promise<void> {
  // Preserve language pick if user changed it but skipped without continuing.
  // saveAndReanalyze persists settings AND triggers analyze.analyze.
  if (settings.hasDirty) {
    await settings.saveAndReanalyze()
  } else {
    void analyze.analyze() // populate the post-skip view
  }
  try {
    await onboarding.complete()
  } catch {
    // Silent — main view will retry on next loadStatus.
  }
  // Wizard unmounts via App.vue's shouldShowWizard flip.
}

function onFinishFromDone(): void {
  // No-op — shouldShowWizard already false (complete ran on apply success).
  // Vue unmounts the wizard on the next render.
}
</script>

<template>
  <div
    data-testid="onboarding-wizard"
    class="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-stone-50 p-8"
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
      <DoneStep v-else @finish="onFinishFromDone" @skip="onSkip" />
    </div>
  </div>
</template>
