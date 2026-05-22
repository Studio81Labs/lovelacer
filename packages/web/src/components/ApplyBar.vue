<script setup lang="ts">
import { computed } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useApplyStore } from '../stores/apply.js'
import { useSettingsStore } from '../stores/settings.js'
import type { SnapshotAssignment } from '../api/types.js'
import { openHomeAssistantPath } from '../navigation.js'

const { t } = useI18n()
const analyze = useAnalyzeStore()
const apply = useApplyStore()
const settings = useSettingsStore()

function startOver() {
  // Safer Start over semantics: clear only this browser session's loaded
  // preview. The persisted latest analysis and user overrides remain intact,
  // so reopening the app can still restore the last successful analysis.
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

const applyDisabled = computed(
  () =>
    apply.phase === 'applying' ||
    analyze.phase !== 'ready' ||
    analyze.isRefreshingPreview ||
    settings.phase === 'saving',
)

const viewCount = computed(() => analyze.preview?.config.views.length ?? 0)

const lastAnalyzedLabel = computed(() => {
  if (analyze.analyzedAt === null) return ''
  const analyzed = new Date(analyze.analyzedAt * 1000)
  const now = new Date()
  const analyzedDay = new Date(
    analyzed.getFullYear(),
    analyzed.getMonth(),
    analyzed.getDate(),
  ).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const daysAgo = Math.max(0, Math.floor((today - analyzedDay) / (24 * 60 * 60 * 1000)))
  if (daysAgo === 0) return t('analysisStatus.lastAnalyzedToday')
  if (daysAgo === 1) return t('analysisStatus.lastAnalyzedYesterday')
  return t('analysisStatus.lastAnalyzedDaysAgo', { count: daysAgo })
})

const dashboardUrl = computed(() => {
  const path = apply.result?.urlPath
  return path === undefined ? '' : `/${path}`
})

function openDashboard(): void {
  if (dashboardUrl.value === '') return
  openHomeAssistantPath(dashboardUrl.value)
}
</script>

<template>
  <section
    data-testid="apply-bar"
    class="fixed inset-x-0 bottom-0 z-30 !m-0 border-t border-stone-200 bg-white/95 px-4 pt-3 pb-2 shadow-[0_-8px_24px_rgba(44,44,42,0.08)] backdrop-blur sm:pb-3"
  >
    <div
      class="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div v-if="apply.phase === 'idle' || apply.phase === 'applying'" class="min-w-0">
        <p class="text-sm font-medium text-stone-900">
          {{ t('dashboardPreview.willCreate', { count: viewCount }, viewCount) }}
        </p>
        <p v-if="lastAnalyzedLabel" class="mt-0.5 text-xs text-stone-500">
          {{ lastAnalyzedLabel }}
        </p>
      </div>

      <div v-else-if="apply.phase === 'success' && apply.result !== null" class="min-w-0">
        <p class="text-sm font-medium text-forest-700">{{ t('applyBar.success.heading') }}</p>
        <I18nT
          :keypath="apply.result.created ? 'applyBar.success.created' : 'applyBar.success.updated'"
          tag="p"
          class="mt-0.5 text-xs text-stone-500"
        >
          <template #urlPath>
            <span class="font-mono">{{ apply.result.urlPath }}</span>
          </template>
        </I18nT>
      </div>

      <div v-else-if="apply.phase === 'error'" class="min-w-0">
        <p class="text-sm font-medium text-danger-700">{{ errorMessage }}</p>
      </div>

      <div class="flex shrink-0 items-center justify-end gap-2">
        <button
          v-if="apply.phase === 'idle' || apply.phase === 'applying'"
          type="button"
          class="ll-btn ll-btn-primary px-5"
          :disabled="applyDisabled"
          @click="applyClicked"
        >
          {{ apply.phase === 'applying' ? t('applyBar.applying') : t('applyBar.apply') }}
        </button>
        <button
          v-else-if="apply.phase === 'success' && apply.result !== null"
          type="button"
          data-testid="apply-open-dashboard"
          class="ll-btn ll-btn-primary px-5"
          @click="openDashboard"
        >
          {{ t('applyBar.openDashboard') }}
        </button>
        <button
          v-else-if="showRetry"
          type="button"
          class="ll-btn ll-btn-danger"
          @click="applyClicked"
        >
          {{ t('common.retry') }}
        </button>
        <button type="button" class="ll-btn ll-btn-secondary" @click="startOver">
          {{ t('applyBar.startOver') }}
        </button>
      </div>
    </div>
  </section>
</template>
