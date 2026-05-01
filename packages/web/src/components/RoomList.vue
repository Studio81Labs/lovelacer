<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { roomIdToIcon } from '../icons.js'
import type { AnalyzedRoom } from '../api/types.js'

defineProps<{ rooms: AnalyzedRoom[] }>()

function confidencePillClass(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800'
  if (confidence >= 0.5) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}% avg confidence`
}
</script>

<template>
  <div v-if="rooms.length === 0" class="rounded border border-stone-200 bg-stone-50 p-6 text-sm text-stone-600">
    No rooms detected — check that your HA install has at least one area assigned to entities or
    device names matching room patterns.
  </div>

  <ul v-else class="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
    <li
      v-for="room in rooms"
      :key="room.id"
      data-testid="room-row"
      class="flex items-center justify-between gap-4 px-5 py-3"
    >
      <div class="flex items-center gap-3">
        <Icon :icon="roomIdToIcon(room.id)" class="h-5 w-5 text-stone-700" />
        <span class="text-sm font-medium text-stone-900">{{ room.displayName }}</span>
      </div>

      <div class="flex items-center gap-3 text-xs text-stone-600">
        <span>{{ room.entityCount }} entities</span>
        <span
          data-testid="confidence-pill"
          class="rounded px-2 py-0.5 text-xs font-medium"
          :class="confidencePillClass(room.averageConfidence)"
        >
          {{ confidenceLabel(room.averageConfidence) }}
        </span>
      </div>
    </li>
  </ul>
</template>
