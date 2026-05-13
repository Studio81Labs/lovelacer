<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon, addCollection, type IconifyJSON } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue?: string | undefined
  labelledBy?: string | undefined
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()

const isOpen = ref(false)
const query = ref('')
const iconNames = ref<string[]>([])
const isLoading = ref(false)
const loadFailed = ref(false)

const selectedIcon = computed(() => normalizeIconValue(props.modelValue))
const searchTerm = computed(() => normalizeIconQuery(query.value))
const filteredIconNames = computed(() => {
  const names = iconNames.value
  if (names.length === 0) return []
  if (searchTerm.value === '') return prioritizeIconNames(names, POPULAR_ROOM_ICON_NAMES)
  const matches = names.filter((name) => name.includes(searchTerm.value))
  return prioritizeIconNames(matches, [searchTerm.value]).slice(0, 80)
})

watch(isOpen, (open) => {
  if (open) void loadMdiCollection()
})

async function loadMdiCollection(): Promise<void> {
  if (iconNames.value.length > 0) return
  isLoading.value = true
  loadFailed.value = false
  try {
    iconNames.value = await loadMdiIconNames()
  } catch {
    mdiIconNamesPromise = null
    loadFailed.value = true
  } finally {
    isLoading.value = false
  }
}

function selectIcon(iconName: string): void {
  emit('update:modelValue', `mdi:${iconName}`)
  query.value = ''
  isOpen.value = false
}

function normalizeIconQuery(value: string): string {
  return value.trim().toLowerCase().replace(/^mdi:/, '')
}

function normalizeIconValue(value: string | undefined): string {
  return value?.trim() || 'mdi:home-outline'
}

function prioritizeIconNames(names: string[], priorityNames: string[]): string[] {
  const priority = new Map(priorityNames.map((name, index) => [name, index]))
  return [...names]
    .sort((a, b) => {
      const aPriority = priority.get(a)
      const bPriority = priority.get(b)
      if (aPriority !== undefined && bPriority !== undefined) return aPriority - bPriority
      if (aPriority !== undefined) return -1
      if (bPriority !== undefined) return 1
      return a.localeCompare(b)
    })
    .slice(0, 120)
}

const POPULAR_ROOM_ICON_NAMES = [
  'silverware-fork-knife',
  'sofa',
  'bed',
  'shower-head',
  'desk',
  'garage-variant',
  'flower-tulip',
  'silverware',
  'washing-machine',
  'stairs-down',
  'home-roof',
  'teddy-bear',
  'bed-empty',
  'door',
  'coffee',
  'television',
  'lamp',
  'lightbulb',
  'ceiling-light',
  'home-outline',
]

let cachedMdiIconNames: string[] | null = null
let mdiIconNamesPromise: Promise<string[]> | null = null

async function loadMdiIconNames(): Promise<string[]> {
  if (cachedMdiIconNames !== null) return cachedMdiIconNames
  mdiIconNamesPromise ??= (async () => {
    const collection = (await import('@iconify-json/mdi/icons.json')).default as IconifyJSON
    addCollection(collection)
    cachedMdiIconNames = Object.keys({
      ...collection.icons,
      ...(collection.aliases ?? {}),
    }).sort((a, b) => a.localeCompare(b))
    return cachedMdiIconNames
  })()
  return mdiIconNamesPromise
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      data-testid="room-icon-picker-button"
      class="flex w-full items-center justify-between gap-2 rounded border border-stone-300 bg-white px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-50 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
      :aria-expanded="isOpen"
      :aria-labelledby="labelledBy"
      @click="isOpen = !isOpen"
    >
      <span data-testid="room-icon-selected" class="flex min-w-0 items-center gap-2">
        <Icon :icon="selectedIcon" class="h-5 w-5 shrink-0 text-stone-700" />
        <span class="truncate">{{ selectedIcon }}</span>
      </span>
      <span aria-hidden="true" class="text-stone-400">v</span>
    </button>

    <div
      v-if="isOpen"
      class="absolute left-0 right-0 z-30 mt-1 rounded border border-stone-200 bg-white p-2 shadow-lg"
    >
      <input
        v-model="query"
        data-testid="room-icon-search"
        type="search"
        :aria-label="t('roomList.iconSearchLabel')"
        :placeholder="t('roomList.iconSearchPlaceholder')"
        class="mb-2 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
      />

      <div v-if="isLoading" class="px-2 py-3 text-sm text-stone-500">
        {{ t('roomList.iconLoading') }}
      </div>
      <div v-else-if="loadFailed" class="px-2 py-3 text-sm text-danger-700">
        {{ t('roomList.iconLoadFailed') }}
      </div>
      <div v-else-if="filteredIconNames.length === 0" class="px-2 py-3 text-sm text-stone-500">
        {{ t('roomList.iconNoMatches') }}
      </div>
      <div v-else class="max-h-72 overflow-y-auto" role="listbox">
        <button
          v-for="iconName in filteredIconNames"
          :key="iconName"
          type="button"
          data-testid="room-icon-option"
          role="option"
          :aria-selected="selectedIcon === `mdi:${iconName}`"
          class="flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm text-stone-700 hover:bg-amber-50 aria-selected:bg-amber-100 aria-selected:text-stone-900"
          @click="selectIcon(iconName)"
        >
          <Icon :icon="`mdi:${iconName}`" class="h-5 w-5 shrink-0 text-stone-700" />
          <span class="truncate">mdi:{{ iconName }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
