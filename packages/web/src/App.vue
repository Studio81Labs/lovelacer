<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface HealthResponse {
  ok: boolean
  version: string
  ha: { connected: boolean; entityCount: number | null }
}

const health = ref<HealthResponse | null>(null)
const error = ref<string | null>(null)

async function fetchHealth() {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    health.value = await res.json()
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'unknown error'
  }
}

onMounted(() => {
  void fetchHealth()
})
</script>

<template>
  <main class="mx-auto max-w-2xl p-8">
    <header class="mb-8">
      <h1 class="text-3xl font-semibold text-stone-900">Lovelacer</h1>
      <p class="text-sm text-stone-600">Home Assistant dashboard generator · dev preview</p>
    </header>

    <section class="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <h2 class="mb-4 text-lg font-medium text-stone-800">System status</h2>

      <div v-if="error" class="rounded bg-brand-50 p-3 text-sm text-brand-800">
        Backend unreachable: {{ error }}
      </div>

      <div v-else-if="!health" class="text-sm text-stone-500">Loading…</div>

      <dl v-else class="space-y-2 text-sm">
        <div class="flex justify-between">
          <dt class="text-stone-600">Version</dt>
          <dd class="font-mono text-stone-900">{{ health.version }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-stone-600">HA connection</dt>
          <dd>
            <span
              class="inline-block rounded px-2 py-0.5 text-xs font-medium"
              :class="
                health.ha.connected ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-700'
              "
            >
              {{ health.ha.connected ? 'connected' : 'disconnected' }}
            </span>
          </dd>
        </div>
        <div v-if="health.ha.entityCount !== null" class="flex justify-between">
          <dt class="text-stone-600">Entities</dt>
          <dd class="font-mono text-stone-900">{{ health.ha.entityCount }}</dd>
        </div>
      </dl>

      <button
        type="button"
        class="mt-6 rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        @click="fetchHealth"
      >
        Refresh
      </button>
    </section>

    <p class="mt-8 text-xs text-stone-500">Phase 0 scaffold — no analysis features yet.</p>
  </main>
</template>
