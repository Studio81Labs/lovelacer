<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import EntityRow from './EntityRow.vue'
import { roomIdToDisplay } from '../rooms.js'
import { entityMatchesSearch, normalizeEntitySearch } from '../entity-search.js'
import type { AdministrativeEntity } from '../api/types.js'

const { t } = useI18n()

const props = defineProps<{
  administrative: AdministrativeEntity[]
}>()

const searchQuery = ref('')
const hasSearch = computed(() => normalizeEntitySearch(searchQuery.value) !== '')
const filteredAdministrative = computed(() =>
  props.administrative.filter((entity) =>
    entityMatchesSearch(searchQuery.value, entity.entityId, entity.friendlyName),
  ),
)
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
      <label class="mt-3 block">
        <span class="sr-only">{{ t('sectionSearch.administrativeLabel') }}</span>
        <input
          v-model="searchQuery"
          type="search"
          data-testid="section-search"
          :aria-label="t('sectionSearch.administrativeLabel')"
          :placeholder="t('sectionSearch.administrativePlaceholder')"
          class="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
        />
      </label>
    </div>

    <div
      v-if="hasSearch && filteredAdministrative.length === 0"
      class="border-t border-stone-100 bg-stone-50/30 px-5 py-4 text-sm text-stone-600"
    >
      {{ t('sectionSearch.empty') }}
    </div>

    <ul v-else class="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/30">
      <li v-for="entity in filteredAdministrative" :key="entity.entityId" class="space-y-1">
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
