<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import HealthBar from './components/HealthBar.vue'
import AnalyzeButton from './components/AnalyzeButton.vue'
import RoomList from './components/RoomList.vue'
import MiscBucket from './components/MiscBucket.vue'
import OverridesBar from './components/OverridesBar.vue'
import DashboardPreview from './components/DashboardPreview.vue'
import ApplyBar from './components/ApplyBar.vue'
import InviteGate from './components/InviteGate.vue'
import DiffBanner from './components/DiffBanner.vue'
import RemovedEntitiesPanel from './components/RemovedEntitiesPanel.vue'
import SuggestionsPanel from './components/SuggestionsPanel.vue'
import SettingsModal from './components/SettingsModal.vue'
import { useAnalyzeStore } from './stores/analyze.js'
import { useOverridesStore } from './stores/overrides.js'
import { useInviteStore } from './stores/invite.js'
import { useSuggestionsStore } from './stores/suggestions.js'
import { useSettingsStore } from './stores/settings.js'
import type { EntityDiff, RoomDiffSummary } from './api/types.js'

const analyze = useAnalyzeStore()
const overrides = useOverridesStore()
const invite = useInviteStore()
const suggestions = useSuggestionsStore()
const settings = useSettingsStore()
const settingsOpen = ref(false)

function openSettings(): void {
  void settings.loadFromServer()
  settingsOpen.value = true
}

const diffByRoom = computed<Record<string, RoomDiffSummary>>(
  () => analyze.preview?.diff?.perRoom ?? {},
)

const diffByEntityId = computed<Map<string, EntityDiff>>(() => {
  const map = new Map<string, EntityDiff>()
  const entities = analyze.preview?.diff?.entities ?? []
  for (const e of entities) map.set(e.entityId, e)
  return map
})

onMounted(() => {
  void invite.loadStatus()
})

let loadedOnce = false
watch(
  () => analyze.phase,
  (phase) => {
    if (phase === 'ready' && !loadedOnce) {
      loadedOnce = true
      void overrides.loadFromServer()
    }
  },
)

// On every fresh preview, clear the optimistic-dismissed set so the
// authoritative server response in `analyze.preview.suggestions[]`
// drives what's visible. Dismissed-on-server keys are filtered there;
// if the user cleared a dismissal out-of-band, it'll re-appear.
watch(
  () => analyze.preview,
  () => {
    suggestions.reset()
  },
)
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-6 p-8">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-semibold text-stone-900">Lovelacer</h1>
        <p class="text-sm text-stone-600">Home Assistant dashboard generator · alpha</p>
      </div>
      <button
        type="button"
        data-testid="settings-button"
        aria-label="Settings"
        class="rounded p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        @click="openSettings"
      >
        ⚙
      </button>
    </header>

    <HealthBar />

    <section class="flex justify-center">
      <AnalyzeButton />
    </section>

    <section
      v-if="analyze.phase === 'error' && analyze.error !== null"
      class="rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-900"
    >
      <div class="flex items-center justify-between">
        <span>{{ analyze.error.message }}</span>
        <button
          type="button"
          class="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          @click="analyze.analyze()"
        >
          Retry
        </button>
      </div>
    </section>

    <section v-if="analyze.phase === 'ready' && analyze.preview !== null" class="space-y-4">
      <DiffBanner :diff="analyze.preview.diff" />
      <RemovedEntitiesPanel
        v-if="analyze.preview.diff !== null && analyze.preview.diff.totals.removed > 0"
        :diff="analyze.preview.diff"
      />
      <SuggestionsPanel :suggestions="analyze.preview.suggestions" />
      <RoomList
        :rooms="analyze.preview.rooms"
        :diff-by-room="diffByRoom"
        :diff-by-entity-id="diffByEntityId"
      />
      <MiscBucket :misc="analyze.preview.misc" />
      <OverridesBar />
      <DashboardPreview :config="analyze.preview.config" />
      <ApplyBar />
    </section>
  </main>

  <SettingsModal v-if="settingsOpen" @close="settingsOpen = false" />
  <InviteGate v-if="invite.shouldShowGate" />
</template>
