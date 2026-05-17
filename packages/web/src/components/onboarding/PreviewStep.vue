<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnalyzeStore } from '../../stores/analyze.js'
import { useApplyStore } from '../../stores/apply.js'
import DashboardPreview from '../DashboardPreview.vue'
import RoomList from '../RoomList.vue'
import MiscBucket from '../MiscBucket.vue'
import type { SnapshotAssignment } from '../../api/types.js'

defineEmits<{ back: []; skip: [] }>()

const { t } = useI18n()
const analyze = useAnalyzeStore()
const apply = useApplyStore()

const summary = computed(() => {
  const p = analyze.preview
  if (p === null) return ''
  const ent = p.summary.entityCount
  const rooms = p.summary.roomCount
  // Pluralization handled by the i18n catalogue (English | plural form).
  // Other locales bring their own plural rules in their respective catalogs.
  return t('previewStep.summary', { entities: ent, count: rooms }, rooms)
})

function applyClicked(): void {
  if (analyze.preview === null) return
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
</script>

<template>
  <div data-testid="preview-step" class="rounded-lg bg-white p-8 shadow-sm">
    <h1 class="text-2xl font-semibold text-stone-900">{{ t('previewStep.heading') }}</h1>

    <!-- Loading state -->
    <p v-if="analyze.phase === 'loading'" class="mt-4 text-stone-600">
      {{ t('previewStep.scanning') }}
    </p>

    <!-- Analyze error -->
    <div
      v-else-if="analyze.phase === 'error' && analyze.error !== null"
      class="mt-4 rounded bg-danger-50 px-4 py-3 text-sm text-danger-700"
    >
      <p>{{ analyze.error.message }}</p>
      <button
        type="button"
        class="ll-btn ll-btn-danger ll-btn-compact mt-2"
        @click="analyze.analyze()"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <!-- Preview ready -->
    <div v-else-if="analyze.preview !== null" class="mt-4 space-y-4">
      <p class="text-stone-600">{{ summary }}</p>

      <div data-testid="dashboard-preview">
        <DashboardPreview :config="analyze.preview.config" />
      </div>

      <details class="rounded border border-stone-200 px-4 py-2">
        <summary class="cursor-pointer text-sm font-medium text-stone-700">
          {{ t('previewStep.showBreakdown') }}
        </summary>
        <div class="mt-3 space-y-3">
          <RoomList
            :rooms="analyze.preview.rooms"
            :diff-by-room="{}"
            :diff-by-entity-id="new Map()"
            :read-only="true"
          />
          <MiscBucket :misc="analyze.preview.misc" :read-only="true" />
        </div>
      </details>

      <!-- Apply error -->
      <div
        v-if="apply.phase === 'error' && apply.error !== null"
        class="rounded bg-danger-50 px-4 py-3 text-sm text-danger-700"
      >
        <p>{{ t('previewStep.applyError', { message: apply.error.message }) }}</p>
        <button
          type="button"
          class="ll-btn ll-btn-danger ll-btn-compact mt-2"
          @click="applyClicked"
        >
          {{ t('common.retry') }}
        </button>
      </div>
    </div>

    <!-- Footer: Back + Apply -->
    <div class="mt-6 flex items-center justify-between">
      <button
        type="button"
        data-testid="preview-back"
        class="ll-btn ll-btn-ghost"
        @click="$emit('back')"
      >
        {{ t('common.back') }}
      </button>
      <button
        type="button"
        data-testid="preview-apply"
        class="ll-btn ll-btn-primary px-5"
        :disabled="analyze.phase !== 'ready' || apply.phase === 'applying'"
        @click="applyClicked"
      >
        {{ apply.phase === 'applying' ? t('applyBar.applying') : t('applyBar.apply') }}
      </button>
    </div>

    <button
      type="button"
      data-testid="preview-skip"
      class="ll-btn ll-btn-ghost ll-btn-full mt-3"
      @click="$emit('skip')"
    >
      {{ t('common.skipOnboarding') }}
    </button>
  </div>
</template>
