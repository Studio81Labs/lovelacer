<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DiffResult, EntityDiff } from '../api/types.js'
import { roomIdToDisplay } from '../rooms.js'

const { t } = useI18n()
const props = defineProps<{ diff: DiffResult }>()
const showAll = ref(false)
const VISIBLE_LIMIT = 10

const removed = computed<EntityDiff[]>(() =>
  props.diff.entities.filter((e) => e.kind === 'removed'),
)
const displayed = computed(() =>
  showAll.value ? removed.value : removed.value.slice(0, VISIBLE_LIMIT),
)
const hiddenCount = computed(() => Math.max(removed.value.length - displayed.value.length, 0))
const isTruncated = computed(() => hiddenCount.value > 0)

watch(
  () => props.diff,
  () => {
    showAll.value = false
  },
)

function formatPrevious(roomId: string | null | undefined): string {
  if (roomId === null || roomId === undefined) return t('removedEntitiesPanel.misc')
  return roomIdToDisplay(roomId)
}
</script>

<template>
  <section
    v-if="removed.length > 0"
    data-testid="removed-panel"
    class="rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900"
  >
    <p class="font-medium">
      {{ t('removedEntitiesPanel.heading', { count: removed.length }, removed.length) }}
    </p>
    <ul class="mt-2 space-y-1">
      <li
        v-for="entity in displayed"
        :key="entity.entityId"
        data-testid="removed-entity"
        class="flex items-center gap-3 text-xs"
      >
        <span class="font-mono">{{ entity.entityId }}</span>
        <span class="text-amber-700"
          >{{ t('removedEntitiesPanel.wasIn', { room: formatPrevious(entity.previousRoomId) }) }}
        </span>
      </li>
    </ul>
    <div v-if="isTruncated || showAll" class="mt-3 border-t border-amber-200/70 pt-3">
      <button
        type="button"
        data-testid="removed-entities-toggle"
        class="ll-btn ll-btn-ghost ll-btn-compact"
        :aria-expanded="showAll"
        @click="showAll = !showAll"
      >
        {{
          showAll
            ? t('removedEntitiesPanel.showFewer')
            : t('removedEntitiesPanel.showMore', { count: hiddenCount }, hiddenCount)
        }}
      </button>
    </div>
  </section>
</template>
