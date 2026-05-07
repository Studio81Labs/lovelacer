<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useApplyStore } from '../stores/apply.js'
import type { SnapshotAssignment } from '../api/types.js'

const analyze = useAnalyzeStore()
const apply = useApplyStore()

let resetTimer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (resetTimer !== null) {
    clearTimeout(resetTimer)
    resetTimer = null
  }
}

function startOver() {
  clearTimer()
  apply.reset()
  analyze.reset()
}

// 5s auto-dismiss after success, per spec. Clearing the timer on
// unmount avoids `apply.reset()` firing against a stale store if the
// component is destroyed while the timer is pending.
watch(
  () => apply.phase,
  (phase) => {
    clearTimer()
    if (phase === 'success') {
      resetTimer = setTimeout(startOver, 5000)
    }
  },
)

onUnmounted(clearTimer)

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
      return 'Home Assistant is not connected. Check the connection bar at the top.'
    case 'invalid_config':
      return 'Cached config is invalid. Click Start over to re-analyze.'
    case 'ha_apply_failed':
      return `Apply failed at step ${apply.error.step ?? 'unknown'}: ${apply.error.message}`
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
      {{ apply.phase === 'applying' ? 'Applying…' : 'Apply to Home Assistant' }}
    </button>

    <div
      v-else-if="apply.phase === 'success' && apply.result !== null"
      class="flex items-center justify-between rounded-lg bg-forest-50 px-5 py-3 text-sm text-forest-700"
    >
      <span>
        Dashboard <span class="font-mono">{{ apply.result.urlPath }}</span>
        {{ apply.result.created ? 'created' : 'updated' }}.
      </span>
      <button
        type="button"
        class="rounded bg-forest-700 px-3 py-1 text-xs font-medium text-white hover:bg-forest-900"
        @click="startOver"
      >
        Done — start over
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
        class="rounded bg-danger-700 px-3 py-1 text-xs font-medium text-white hover:bg-danger-700"
        @click="applyClicked"
      >
        Retry
      </button>
      <button
        v-else
        type="button"
        class="rounded bg-stone-600 px-3 py-1 text-xs font-medium text-white hover:bg-stone-700"
        @click="startOver"
      >
        Start over
      </button>
    </div>
  </section>
</template>
