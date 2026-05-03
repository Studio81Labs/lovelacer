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
  emit('close')
}

function onFinishFromDone(): void {
  emit('close')
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
