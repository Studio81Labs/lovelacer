<script setup lang="ts">
import { computed } from 'vue'
import { useAnalyzeStore } from '../../stores/analyze.js'
import { useApplyStore } from '../../stores/apply.js'
import DashboardPreview from '../DashboardPreview.vue'
import RoomList from '../RoomList.vue'
import MiscBucket from '../MiscBucket.vue'
import type { SnapshotAssignment } from '../../api/types.js'

defineEmits<{ back: []; skip: [] }>()

const analyze = useAnalyzeStore()
const apply = useApplyStore()

const summary = computed(() => {
  const p = analyze.preview
  if (p === null) return ''
  const ent = p.summary.entityCount
  const rooms = p.summary.roomCount
  // Pluralization: "1 room" / "N rooms".
  const roomWord = rooms === 1 ? 'room' : 'rooms'
  return `Detected ${ent} entities across ${rooms} ${roomWord}.`
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
    <h1 class="text-2xl font-semibold text-stone-900">Preview</h1>

    <!-- Loading state -->
    <p v-if="analyze.phase === 'loading'" class="mt-4 text-stone-600">Scanning…</p>

    <!-- Analyze error -->
    <div
      v-else-if="analyze.phase === 'error' && analyze.error !== null"
      class="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      <p>{{ analyze.error.message }}</p>
      <button
        type="button"
        class="mt-2 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
        @click="analyze.analyze()"
      >
        Retry
      </button>
    </div>

    <!-- Preview ready -->
    <div v-else-if="analyze.preview !== null" class="mt-4 space-y-4">
      <p class="text-stone-600">{{ summary }}</p>

      <div data-testid="dashboard-preview">
        <DashboardPreview :config="analyze.preview.config" />
      </div>

      <details class="rounded border border-stone-200 px-4 py-2">
        <summary class="cursor-pointer text-sm font-medium text-stone-700">Show breakdown</summary>
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
        class="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      >
        <p>Apply failed: {{ apply.error.message }}</p>
        <button
          type="button"
          class="mt-2 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          @click="applyClicked"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Footer: Back + Apply -->
    <div class="mt-6 flex items-center justify-between">
      <button
        type="button"
        data-testid="preview-back"
        class="text-sm text-stone-500 hover:text-stone-700"
        @click="$emit('back')"
      >
        ← Back
      </button>
      <button
        type="button"
        data-testid="preview-apply"
        class="rounded bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        :disabled="analyze.phase !== 'ready' || apply.phase === 'applying'"
        @click="applyClicked"
      >
        {{ apply.phase === 'applying' ? 'Applying…' : 'Apply to Home Assistant' }}
      </button>
    </div>

    <button
      type="button"
      data-testid="preview-skip"
      class="mt-3 w-full text-sm text-stone-500 hover:text-stone-700"
      @click="$emit('skip')"
    >
      Skip onboarding
    </button>
  </div>
</template>
