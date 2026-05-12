<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOverridesStore } from '../stores/overrides.js'
import { roomIdToDisplay } from '../rooms.js'
import { entityMatchesSearch, normalizeEntitySearch } from '../entity-search.js'
import type { HiddenEntity } from '../api/types.js'

const { t } = useI18n()
const props = defineProps<{
  hiddenEntities?: HiddenEntity[]
}>()
const overrides = useOverridesStore()
const searchQuery = ref('')

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
const hasSearch = computed(() => normalizeEntitySearch(searchQuery.value) !== '')
const filteredHidden = computed(() =>
  hidden.value.filter((entry) =>
    entityMatchesSearch(searchQuery.value, entry.entityId, entry.friendlyName),
  ),
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
      <label class="mt-3 block">
        <span class="sr-only">{{ t('sectionSearch.hiddenLabel') }}</span>
        <input
          v-model="searchQuery"
          type="search"
          data-testid="section-search"
          :aria-label="t('sectionSearch.hiddenLabel')"
          :placeholder="t('sectionSearch.hiddenPlaceholder')"
          class="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
        />
      </label>
    </div>

    <div
      v-if="hasSearch && filteredHidden.length === 0"
      class="border-t border-stone-100 bg-stone-50/30 px-5 py-4 text-sm text-stone-600"
    >
      {{ t('sectionSearch.empty') }}
    </div>

    <ul v-else class="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/30">
      <li
        v-for="entry in filteredHidden"
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
