<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface HealthResponse {
  ok: boolean
  version: string
  ha: { connected: boolean }
}

const health = ref<HealthResponse | null>(null)
const error = ref<string | null>(null)

async function fetchHealth() {
  try {
    // Use a document-relative URL (no leading slash) so the request stays
    // inside the add-on path under HA Supervisor ingress, where the SPA is
    // served from a `/api/hassio_ingress/<token>/` prefix. Vite's dev proxy
    // also resolves this correctly to the backend at :3000.
    const res = await fetch('api/health')
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
  <section class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
    <div v-if="error" class="text-sm text-brand-800">
      Backend unreachable: {{ error }}
    </div>

    <div v-else-if="!health" class="text-sm text-stone-500">Loading…</div>

    <div v-else class="flex items-center justify-between text-sm">
      <span class="text-stone-600">
        Version <span class="font-mono text-stone-900">{{ health.version }}</span>
      </span>
      <span
        class="inline-block rounded px-2 py-0.5 text-xs font-medium"
        :class="
          health.ha.connected ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-700'
        "
      >
        HA {{ health.ha.connected ? 'connected' : 'disconnected' }}
      </span>
    </div>
  </section>
</template>
