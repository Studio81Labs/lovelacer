<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useApplyStore } from '../../stores/apply.js'
import { openHomeAssistantPath } from '../../navigation.js'

defineEmits<{ finish: [] }>()

const { t } = useI18n()
const apply = useApplyStore()

const dashboardPath = computed(() => apply.result?.urlPath ?? 'lovelacer-home')
const dashboardUrl = computed(() => `/${dashboardPath.value}`)

function openDashboard(): void {
  openHomeAssistantPath(dashboardUrl.value)
}
</script>

<template>
  <div data-testid="done-step" class="rounded-lg bg-white p-8 text-center shadow-sm">
    <div class="mx-auto h-12 w-12 rounded-full bg-forest-50 flex items-center justify-center">
      <span class="text-2xl text-forest-700">✓</span>
    </div>
    <h1 class="mt-4 text-2xl font-semibold text-stone-900">{{ t('doneStep.heading') }}</h1>
    <p class="mt-2 text-stone-600">
      <i18n-t keypath="doneStep.dashboardLocation" tag="span">
        <template #url>
          <code class="font-mono text-sm">{{ dashboardUrl }}</code>
        </template>
      </i18n-t>
    </p>

    <div class="mt-6 space-y-2">
      <button
        type="button"
        data-testid="done-open-dashboard"
        class="ll-btn ll-btn-primary ll-btn-full"
        @click="openDashboard"
      >
        {{ t('doneStep.openDashboard') }}
      </button>
      <button
        type="button"
        data-testid="done-finish"
        class="ll-btn ll-btn-secondary ll-btn-full"
        @click="$emit('finish')"
      >
        {{ t('doneStep.finish') }}
      </button>
    </div>
  </div>
</template>
