<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { roomIdToIcon } from '../icons.js'
import EntityRow from './EntityRow.vue'
import type { AnalyzedRoom, EntityDiff, RoomDiffSummary } from '../api/types.js'

defineProps<{
  rooms: AnalyzedRoom[]
  diffByRoom?: Record<string, RoomDiffSummary>
  diffByEntityId?: Map<string, EntityDiff>
  /**
   * P2-7 — when true, EntityRow children render in read-only mode
   * (no override dropdowns, no hide toggles). Forwarded as-is.
   */
  readOnly?: boolean
}>()

function confidencePillClass(confidence: number): string {
  if (confidence >= 0.8) return 'bg-forest-50 text-forest-700'
  if (confidence >= 0.5) return 'bg-amber-100 text-amber-800'
  return 'bg-danger-50 text-danger-700'
}

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}% avg confidence`
}

/**
 * `RoomAssignment` doesn't carry `friendlyName`. Until the API surfaces
 * it on assignments, derive a fallback from the entityId — readable
 * enough for the alpha demo.
 *   light.kitchen_ceiling → Kitchen Ceiling
 */
function entityIdToFriendly(entityId: string): string {
  const parts = entityId.split('.')
  if (parts.length < 2) return entityId
  const objectId = parts.slice(1).join('.')
  return objectId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
</script>

<template>
  <div
    v-if="rooms.length === 0"
    class="rounded border border-stone-200 bg-stone-50 p-6 text-sm text-stone-600"
  >
    No rooms detected — check that your HA install has at least one area assigned to entities or
    device names matching room patterns.
  </div>

  <ul v-else class="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
    <li v-for="room in rooms" :key="room.id" data-testid="room-row">
      <details class="group">
        <summary
          class="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 hover:bg-stone-50"
        >
          <div class="flex items-center gap-3">
            <Icon :icon="roomIdToIcon(room.id)" class="h-5 w-5 text-stone-700" />
            <span class="text-sm font-medium text-stone-900">{{ room.displayName }}</span>
          </div>

          <div class="flex items-center gap-3 text-xs text-stone-600">
            <span>{{ room.entityCount }} entities</span>
            <template v-if="(diffByRoom ?? {})[room.id]">
              <span
                v-if="(diffByRoom ?? {})[room.id]!.added > 0"
                data-testid="room-diff-added"
                class="rounded bg-forest-50 px-2 py-0.5 text-xs font-medium text-forest-700"
                >+{{ (diffByRoom ?? {})[room.id]!.added }} new</span
              >
              <span
                v-if="(diffByRoom ?? {})[room.id]!.movedOut > 0"
                data-testid="room-diff-moved-out"
                class="rounded bg-stone-50 px-2 py-0.5 text-xs font-medium text-stone-700"
                >↻ {{ (diffByRoom ?? {})[room.id]!.movedOut }} left</span
              >
            </template>
            <span
              data-testid="confidence-pill"
              class="rounded px-2 py-0.5 text-xs font-medium"
              :class="confidencePillClass(room.averageConfidence)"
            >
              {{ confidenceLabel(room.averageConfidence) }}
            </span>
          </div>
        </summary>

        <ul class="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/30">
          <li v-for="a in room.assignments" :key="a.entityId">
            <EntityRow
              :entity-id="a.entityId"
              :friendly-name="entityIdToFriendly(a.entityId)"
              :room-id="a.roomId"
              :read-only="readOnly ?? false"
              v-bind="{
                ...(a.manual !== undefined ? { manual: a.manual } : {}),
                ...((diffByEntityId ?? new Map()).has(a.entityId)
                  ? { diff: (diffByEntityId ?? new Map()).get(a.entityId) }
                  : {}),
              }"
            />
          </li>
        </ul>
      </details>
    </li>
  </ul>
</template>
