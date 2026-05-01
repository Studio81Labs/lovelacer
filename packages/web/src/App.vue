<script setup lang="ts">
import HealthBar from './components/HealthBar.vue'
import AnalyzeButton from './components/AnalyzeButton.vue'
import RoomList from './components/RoomList.vue'
import MiscBucket from './components/MiscBucket.vue'
import DashboardPreview from './components/DashboardPreview.vue'
import ApplyBar from './components/ApplyBar.vue'
import { useAnalyzeStore } from './stores/analyze.js'

const analyze = useAnalyzeStore()
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-6 p-8">
    <header>
      <h1 class="text-3xl font-semibold text-stone-900">Lovelacer</h1>
      <p class="text-sm text-stone-600">Home Assistant dashboard generator · alpha</p>
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
      <RoomList :rooms="analyze.preview.rooms" />
      <MiscBucket :misc="analyze.preview.misc" />
      <DashboardPreview :config="analyze.preview.config" />
      <ApplyBar />
    </section>
  </main>
</template>
