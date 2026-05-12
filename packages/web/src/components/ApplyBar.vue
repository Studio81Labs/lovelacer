<script setup lang="ts">
import { computed } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useApplyStore } from '../stores/apply.js'
import type { SnapshotAssignment } from '../api/types.js'

const { t } = useI18n()
const analyze = useAnalyzeStore()
const apply = useApplyStore()

function startOver() {
  apply.reset()
  analyze.reset()
}

function applyClicked() {
  if (analyze.preview === null) return
  // Build the assignments list the server expects: every visible entity →
  // its assigned room (or null for misc). Mirrors the server's preview
  // route, so what the user sees IS what gets snapshotted.
  const assignments: SnapshotAssignment[] = []
  for (const room of analyze.preview.rooms) {
    for (const a of room.assignments) {
      assignments.push({ entityId: a.entityId, roomId: room.id })
    }
  }
  for (const m of analyze.preview.misc) {
    assignments.push({ entityId: m.entityId, roomId: null })
  }
  void apply.apply({
    config: analyze.preview.config,
    snapshot: { assignments, config: analyze.preview.config },
  })
}

const errorMessage = computed(() => {
  if (apply.error === null) return ''
  switch (apply.error.error) {
    case 'ha_unavailable':
      return t('applyBar.error.haUnavailable')
    case 'invalid_config':
      return t('applyBar.error.invalidConfig')
    case 'ha_apply_failed':
      return t('applyBar.error.haApplyFailed', {
        step: apply.error.step ?? t('common.unknown'),
        message: apply.error.message,
      })
    default:
      return apply.error.message
  }
})

const showRetry = computed(
  () =>
    apply.error !== null &&
    apply.error.error !== 'ha_unavailable' &&
    apply.error.error !== 'invalid_config',
)
</script>

<template>
  <section>
    <button
      v-if="apply.phase === 'idle' || apply.phase === 'applying'"
      type="button"
      class="w-full rounded bg-amber-500 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-300"
      :disabled="apply.phase === 'applying' || analyze.phase !== 'ready'"
      @click="applyClicked"
    >
      {{ apply.phase === 'applying' ? t('applyBar.applying') : t('applyBar.apply') }}
    </button>

    <div
      v-else-if="apply.phase === 'success' && apply.result !== null"
      class="flex items-center justify-between rounded-lg bg-forest-50 px-5 py-3 text-sm text-forest-700"
    >
      <I18nT
        :keypath="apply.result.created ? 'applyBar.success.created' : 'applyBar.success.updated'"
        tag="span"
      >
        <template #urlPath>
          <span class="font-mono">{{ apply.result.urlPath }}</span>
        </template>
      </I18nT>
      <button
        type="button"
        class="rounded bg-forest-700 px-3 py-1 text-xs font-medium text-white hover:bg-forest-900"
        @click="startOver"
      >
        {{ t('applyBar.doneStartOver') }}
      </button>
    </div>

    <div
      v-else-if="apply.phase === 'error'"
      class="flex items-center justify-between rounded-lg bg-danger-50 px-5 py-3 text-sm text-danger-700"
    >
      <span>{{ errorMessage }}</span>
      <button
        v-if="showRetry"
        type="button"
        class="rounded bg-danger-700 px-3 py-1 text-xs font-medium text-white hover:bg-danger-900"
        @click="applyClicked"
      >
        {{ t('common.retry') }}
      </button>
      <button
        v-else
        type="button"
        class="rounded bg-stone-600 px-3 py-1 text-xs font-medium text-white hover:bg-stone-700"
        @click="startOver"
      >
        {{ t('applyBar.startOver') }}
      </button>
    </div>
  </section>
</template>
