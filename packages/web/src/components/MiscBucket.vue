<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EntityRow from './EntityRow.vue'
import { useOverridesStore } from '../stores/overrides.js'
import { ASSIGNABLE_ROOMS, roomIdToDisplay } from '../rooms.js'
import { entityMatchesSearch, normalizeEntitySearch } from '../entity-search.js'
import type { MiscEntity } from '../api/types.js'

const { t } = useI18n()

const props = defineProps<{
  misc: MiscEntity[]
  /**
   * P2-7 — when true, the bulk-select checkboxes, per-row hide toggle,
   * and bulk action bar are hidden. Used by the onboarding wizard's
   * PreviewStep.
   */
  readOnly?: boolean
}>()
const overrides = useOverridesStore()

const READONLY_ROW_LIMIT = 50
const selected = ref<Set<string>>(new Set())
const bulkRoom = ref<string>('') // '' = no room picked yet (Assign disabled)
const searchQuery = ref('')

const hasSearch = computed(() => normalizeEntitySearch(searchQuery.value) !== '')
const filteredMisc = computed(() =>
  props.misc.filter((entity) =>
    entityMatchesSearch(searchQuery.value, entity.entityId, entity.friendlyName),
  ),
)
const displayedMisc = computed(() =>
  props.readOnly === true ? filteredMisc.value.slice(0, READONLY_ROW_LIMIT) : filteredMisc.value,
)
const isTruncated = computed(
  () => props.readOnly === true && filteredMisc.value.length > displayedMisc.value.length,
)
const selectedCount = computed(() => selected.value.size)
const allSelected = computed(
  () =>
    filteredMisc.value.length > 0 &&
    filteredMisc.value.every((entity) => selected.value.has(entity.entityId)),
)
const isSaving = computed(() => overrides.phase === 'saving')

function toggleOne(entityId: string, checked: boolean): void {
  const next = new Set(selected.value)
  if (checked) next.add(entityId)
  else next.delete(entityId)
  selected.value = next
}

function toggleAll(): void {
  selected.value = allSelected.value
    ? new Set()
    : new Set(filteredMisc.value.map((m) => m.entityId))
}

function applyAssign(): void {
  // Defense-in-depth: the Assign button is disabled when bulkRoom is
  // empty, but if a future trigger path (keyboard shortcut, programmatic
  // call) misses that gate, silently calling setRoomId(id, null) for
  // every selected entity would wipe their room overrides without intent.
  if (bulkRoom.value === '') return
  const target = bulkRoom.value
  for (const id of selected.value) overrides.setRoomId(id, target)
  selected.value = new Set()
  bulkRoom.value = ''
}

function applyHide(): void {
  // No bulkRoom reset: hiding is independent of the room dropdown,
  // and the user may want to keep the room picked for a follow-up Assign.
  for (const id of selected.value) overrides.setHidden(id, true)
  selected.value = new Set()
}

function clearSelection(): void {
  selected.value = new Set()
}

// Selection should reset whenever the visible misc list changes identity
// (e.g., after a re-analyze). Otherwise selectedCount could refer to
// entityIds no longer in props.misc — stale state and a misleading UI.
watch(
  () => props.misc,
  () => {
    selected.value = new Set()
  },
)

watch(filteredMisc, (entities) => {
  const visibleIds = new Set(entities.map((entity) => entity.entityId))
  selected.value = new Set([...selected.value].filter((entityId) => visibleIds.has(entityId)))
})
</script>

<template>
  <details v-if="misc.length > 0" class="rounded-lg border border-stone-200 bg-white">
    <summary class="cursor-pointer px-5 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">
      {{ t('miscBucket.summary', { count: misc.length }, misc.length) }}
    </summary>

    <div class="border-t border-stone-100 px-5 py-3">
      <label class="block">
        <span class="sr-only">{{ t('sectionSearch.miscLabel') }}</span>
        <input
          v-model="searchQuery"
          type="search"
          data-testid="section-search"
          :aria-label="t('sectionSearch.miscLabel')"
          :placeholder="t('sectionSearch.miscPlaceholder')"
          class="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
        />
      </label>
    </div>

    <div
      v-if="!readOnly && selectedCount > 0"
      data-testid="misc-bulk-bar"
      class="sticky top-0 z-10 flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs"
    >
      <span class="font-medium text-amber-900">{{
        t('miscBucket.selected', { count: selectedCount })
      }}</span>
      <button
        type="button"
        data-testid="misc-bulk-toggle-all"
        class="text-amber-700 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
        :disabled="isSaving"
        @click="toggleAll"
      >
        {{ allSelected ? t('miscBucket.selectNone') : t('miscBucket.selectAll') }}
      </button>

      <select
        v-model="bulkRoom"
        data-testid="misc-bulk-room"
        :disabled="isSaving"
        class="rounded border border-stone-300 bg-white px-2 py-1 text-xs"
      >
        <option value="">{{ t('miscBucket.pickRoom') }}</option>
        <option v-for="rid in ASSIGNABLE_ROOMS" :key="rid" :value="rid">
          {{ roomIdToDisplay(rid) }}
        </option>
      </select>
      <button
        type="button"
        data-testid="misc-bulk-assign"
        class="rounded bg-amber-500 px-3 py-1 font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="bulkRoom === '' || isSaving"
        @click="applyAssign"
      >
        {{ t('miscBucket.assign') }}
      </button>
      <button
        type="button"
        data-testid="misc-bulk-hide"
        class="rounded border border-stone-300 bg-white px-3 py-1 font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="isSaving"
        @click="applyHide"
      >
        {{ t('miscBucket.hide') }}
      </button>
      <button
        type="button"
        data-testid="misc-bulk-clear"
        class="ml-auto text-stone-600 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="isSaving"
        @click="clearSelection"
      >
        {{ t('miscBucket.clear') }}
      </button>
    </div>

    <div
      v-if="hasSearch && displayedMisc.length === 0"
      class="border-t border-stone-100 bg-stone-50/30 px-5 py-4 text-sm text-stone-600"
    >
      {{ t('sectionSearch.empty') }}
    </div>

    <ul v-else class="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/30">
      <li
        v-for="entity in displayedMisc"
        :key="entity.entityId"
        class="flex items-center gap-3 pl-5"
      >
        <input
          v-if="!readOnly"
          type="checkbox"
          :checked="selected.has(entity.entityId)"
          :disabled="isSaving"
          data-testid="misc-row-checkbox"
          :aria-label="t('miscBucket.selectEntity', { entityId: entity.entityId })"
          class="h-4 w-4 rounded border-stone-300"
          @change="toggleOne(entity.entityId, ($event.target as HTMLInputElement).checked)"
        />
        <div class="flex-1">
          <EntityRow
            :entity-id="entity.entityId"
            :friendly-name="entity.friendlyName"
            room-id="misc"
            :read-only="readOnly ?? false"
          />
        </div>
      </li>
    </ul>
    <p
      v-if="isTruncated"
      data-testid="misc-truncated"
      class="border-t border-stone-100 px-5 py-2 text-xs text-stone-500"
    >
      {{ t('miscBucket.showingSubset', { shown: displayedMisc.length, total: misc.length }) }}
    </p>
  </details>
</template>
