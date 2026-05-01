<script setup lang="ts">
import { computed } from 'vue'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useApplyStore } from '../stores/apply.js'

const analyze = useAnalyzeStore()
const apply = useApplyStore()

// Disabled while either store is mid-flight to prevent racing the
// in-progress request. Re-enabled in idle/ready/error/success.
const disabled = computed(() => analyze.phase === 'loading' || apply.phase === 'applying')

const label = computed(() => (analyze.phase === 'loading' ? 'Analyzing…' : 'Analyze'))
</script>

<template>
  <button
    type="button"
    class="rounded bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300"
    :disabled="disabled"
    @click="analyze.analyze()"
  >
    {{ label }}
  </button>
</template>
