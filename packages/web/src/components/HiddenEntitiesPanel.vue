<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOverridesStore } from '../stores/overrides.js'
import { roomIdToDisplay } from '../rooms.js'
import type { HiddenEntity } from '../api/types.js'

const { t } = useI18n()
const props = defineProps<{
  hiddenEntities?: HiddenEntity[]
}>()
const overrides = useOverridesStore()

const hidden = computed(() =>
  overrides.hiddenOverrides.map((override) => {
    const metadata = (props.hiddenEntities ?? []).find(
      (entity) => entity.entityId === override.entityId,
    )
    return {
      ...override,
      friendlyName: metadata?.friendlyName ?? override.entityId,
      domain: metadata?.domain ?? override.entityId.split('.')[0] ?? 'unknown',
      roomId: override.roomId ?? metadata?.roomId,
    }
  }),
)
const isSaving = computed(() => overrides.phase === 'saving')

function unhide(entityId: string): void {
  overrides.setHidden(entityId, false)
}
</script>

<template>
  <details
    v-if="hidden.length > 0"
    data-testid="hidden-entities-panel"
    class="rounded-lg border border-stone-200 bg-white"
  >
    <summary class="cursor-pointer px-5 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">
      {{ t('hiddenEntitiesPanel.heading') }}
    </summary>

    <div class="border-t border-stone-100 px-5 py-3">
      <p class="mt-1 text-xs text-stone-500">{{ t('hiddenEntitiesPanel.description') }}</p>
    </div>

    <ul class="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/30">
      <li
        v-for="entry in hidden"
        :key="entry.entityId"
        class="flex items-center justify-between gap-3 px-5 py-2"
      >
        <div class="min-w-0">
          <p class="truncate text-sm text-stone-700">{{ entry.friendlyName }}</p>
          <p class="truncate font-mono text-xs text-stone-500">{{ entry.entityId }}</p>
          <p v-if="entry.roomId !== undefined" class="text-xs text-stone-500">
            {{ t('hiddenEntitiesPanel.assignedRoom', { room: roomIdToDisplay(entry.roomId) }) }}
          </p>
        </div>
        <button
          type="button"
          data-testid="hidden-entity-unhide"
          class="shrink-0 rounded border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isSaving"
          @click="unhide(entry.entityId)"
        >
          {{ t('hiddenEntitiesPanel.unhide') }}
        </button>
      </li>
    </ul>
  </details>
</template>
