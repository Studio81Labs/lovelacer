<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useApplyStore } from '../stores/apply.js'

const { t } = useI18n()
const analyze = useAnalyzeStore()
const apply = useApplyStore()

// Disabled while either store is mid-flight to prevent racing the
// in-progress request. Re-enabled in idle/ready/error/success.
const disabled = computed(
  () =>
    analyze.status === 'loading' || analyze.status === 'analyzing' || apply.phase === 'applying',
)

const label = computed(() =>
  analyze.status === 'analyzing' ? t('analyzeButton.analyzing') : t('analyzeButton.analyze'),
)

function clickAnalyze() {
  // Reset applyStore before kicking off a new analyze so a stale
  // success banner or error from a prior apply doesn't persist into
  // the new flow.
  apply.reset()
  void analyze.analyze()
}
</script>

<template>
  <button
    type="button"
    class="ll-btn ll-btn-primary px-5"
    :disabled="disabled"
    @click="clickAnalyze"
  >
    {{ label }}
  </button>
</template>
