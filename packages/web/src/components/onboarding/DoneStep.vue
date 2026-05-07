<script setup lang="ts">
import { computed } from 'vue'
import { useApplyStore } from '../../stores/apply.js'

defineEmits<{ finish: []; skip: [] }>()

const apply = useApplyStore()

const dashboardPath = computed(() => apply.result?.urlPath ?? 'lovelacer-home')
const dashboardUrl = computed(() => `/lovelace/${dashboardPath.value}`)

function openDashboard(): void {
  window.open(dashboardUrl.value, '_blank')
}
</script>

<template>
  <div data-testid="done-step" class="rounded-lg bg-white p-8 text-center shadow-sm">
    <div class="mx-auto h-12 w-12 rounded-full bg-forest-50 flex items-center justify-center">
      <span class="text-2xl text-forest-700">✓</span>
    </div>
    <h1 class="mt-4 text-2xl font-semibold text-stone-900">All set!</h1>
    <p class="mt-2 text-stone-600">
      Your dashboard is at <code class="font-mono text-sm">{{ dashboardUrl }}</code
      >.
    </p>

    <div class="mt-6 space-y-2">
      <button
        type="button"
        data-testid="done-open-dashboard"
        class="w-full rounded bg-amber-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
        @click="openDashboard"
      >
        Open dashboard
      </button>
      <button
        type="button"
        data-testid="done-finish"
        class="w-full rounded border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        @click="$emit('finish')"
      >
        Continue to Lovelacer
      </button>
    </div>

    <button
      type="button"
      data-testid="done-skip"
      class="mt-3 text-sm text-stone-500 hover:text-stone-700"
      @click="$emit('skip')"
    >
      Skip onboarding
    </button>
  </div>
</template>
