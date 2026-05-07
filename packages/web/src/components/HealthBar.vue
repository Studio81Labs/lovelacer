<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

interface HealthResponse {
  ok: boolean
  version: string
  ha: { connected: boolean }
}

const { t } = useI18n()
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
    <div v-if="error" class="text-sm text-amber-700">
      {{ t('healthBar.backendUnreachable', { error }) }}
    </div>

    <div v-else-if="!health" class="text-sm text-stone-500">{{ t('common.loading') }}</div>

    <div v-else class="flex items-center justify-between text-sm">
      <span class="text-stone-600">
        {{ t('healthBar.version') }}
        <span class="font-mono text-stone-900">{{ health.version }}</span>
      </span>
      <span
        class="inline-block rounded px-2 py-0.5 text-xs font-medium"
        :class="
          health.ha.connected ? 'bg-forest-50 text-forest-700' : 'bg-stone-200 text-stone-700'
        "
      >
        {{ health.ha.connected ? t('healthBar.haConnected') : t('healthBar.haDisconnected') }}
      </span>
    </div>
  </section>
</template>
