<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import EntityRow from './EntityRow.vue'
import { roomIdToDisplay } from '../rooms.js'
import type { AdministrativeEntity } from '../api/types.js'

const { t } = useI18n()

defineProps<{
  administrative: AdministrativeEntity[]
}>()
</script>

<template>
  <details
    v-if="administrative.length > 0"
    data-testid="administrative-entities-panel"
    class="rounded-lg border border-stone-200 bg-white"
  >
    <summary class="cursor-pointer px-5 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">
      {{
        t(
          'administrativeEntitiesPanel.summary',
          { count: administrative.length },
          administrative.length,
        )
      }}
    </summary>

    <div class="border-t border-stone-100 px-5 py-3">
      <p class="mt-1 text-xs text-stone-500">
        {{ t('administrativeEntitiesPanel.description') }}
      </p>
    </div>

    <ul class="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/30">
      <li v-for="entity in administrative" :key="entity.entityId" class="space-y-1">
        <p v-if="entity.roomId !== undefined" class="px-5 pt-2 text-xs text-stone-500">
          {{
            t('administrativeEntitiesPanel.detectedRoom', {
              room: roomIdToDisplay(entity.roomId),
            })
          }}
        </p>
        <EntityRow
          :entity-id="entity.entityId"
          :friendly-name="entity.friendlyName"
          room-id="misc"
        />
      </li>
    </ul>
  </details>
</template>
